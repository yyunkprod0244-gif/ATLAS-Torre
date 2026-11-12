/* ============================================================================
   PUBLICAÇÃO NAS REDES — YouTube (e Shorts), TikTok, Instagram, Facebook e LinkedIn
   ----------------------------------------------------------------------------
   Usa as APIs oficiais de cada rede (conferidas na documentação em nov/2026):
     YouTube    videos.insert com envio retomável · OAuth do Google com PKCE
     TikTok     Content Posting API (Direct Post, envio em pedaços)
     Instagram  Reels pela Graph API com envio retomável (rupload.facebook.com)
     Facebook   Reels de Página (start → envio → finish)
     LinkedIn   Videos API (partes + finalize) e Posts API
   Cada rede exige um "app de desenvolvedor" criado por você no site dela; a
   página Publicação mostra o passo a passo. Senhas e tokens ficam só em
   ATLAS_DADOS\segredos.json, nunca vão para o navegador.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { json, lerJSON, mesmaOrigem, novoId, abrirBanco } from './base.mjs';

export const NOMES = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn' };
const GRAPH = process.env.META_GRAPH_VERSAO || 'v27.0';
const LI_VERSAO = process.env.LINKEDIN_VERSAO || '202610';
/* nos testes, todas as chamadas vão para um servidor falso */
const u = (host, caminho) => (process.env.REDES_TESTE_BASE ? `${process.env.REDES_TESTE_BASE}/${host}${caminho}` : `https://${host}${caminho}`);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

class ErroRede extends Error {
  constructor(msg, { temporario = false, reconectar = false } = {}) { super(msg); this.temporario = temporario; this.reconectar = reconectar; }
}
async function chamar(url, op = {}, rotulo = '') {
  let r;
  try { r = await fetch(url, op); } catch (e) { throw new ErroRede(`sem conexão com ${rotulo || new URL(url).host} (${e.cause?.code || e.message})`, { temporario: true }); }
  const texto = await r.text();
  let corpo = null; try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = null; }
  if (!r.ok && r.status !== 308) {
    const codigo = typeof corpo?.error?.code === 'string' ? corpo.error.code : '';
    const msg = [codigo, corpo?.error?.message || corpo?.error_description || corpo?.message || (typeof corpo?.error === 'string' ? corpo.error : '')].filter(Boolean).join(': ') || texto.slice(0, 200);
    throw new ErroRede(`${rotulo} respondeu ${r.status}: ${msg}`, { temporario: r.status >= 500 || r.status === 429, reconectar: r.status === 401 });
  }
  return { r, corpo, texto };
}
const formulario = (o) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString() });
/* corpo de envio que lê o arquivo aos poucos e conta os bytes */
function pedacoDoArquivo(arq, ini, fim, aoEnviar) {
  const s = fs.createReadStream(arq, { start: ini, end: fim, highWaterMark: 1 << 20 });
  return (async function* () { for await (const c of s) { aoEnviar?.(c.length); yield c; } })();
}

export function criarRedes(ctx) {
  const { banco, DADOS } = ctx;
  const cofre = abrirBanco(path.join(DADOS, 'segredos.json'), { redes: {} });
  const S = cofre.d.redes;
  banco.d.publicacoes ||= [];
  const pubs = () => banco.d.publicacoes;
  const estados = new Map();   /* state do OAuth → { rede, verificador, criado } */
  const ocupadas = new Set();  /* uma publicação por rede de cada vez */
  const retornoPadrao = () => `http://localhost:${ctx.PORTA}/api/redes/retorno`;
  /* o Facebook e o Instagram usam a mesma conexão (app da Meta) */
  const contaDe = (rede) => (rede === 'facebook' || rede === 'instagram' ? 'meta' : rede);

  function conectada(rede) {
    const c = S[contaDe(rede)];
    if (!c?.token) return false;
    if (rede === 'facebook') return !!paginaMeta();
    if (rede === 'instagram') return !!paginaMeta()?.ig;
    return true;
  }
  function paginaMeta() { const c = S.meta; return c?.paginas?.find((p) => p.id === c.paginaId) || c?.paginas?.[0] || null; }

  /* ---------- OAuth de cada rede ---------- */
  const OAUTH = {
    youtube: {
      url(c, state, desafio) {
        return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: c.clientId, redirect_uri: c.redirectUri, response_type: 'code', scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', code_challenge: desafio, code_challenge_method: 'S256', state });
      },
      async trocar(c, code, verificador) {
        const { corpo } = await chamar(u('oauth2.googleapis.com', '/token'), formulario({ client_id: c.clientId, client_secret: c.clientSecret || '', code, code_verifier: verificador, grant_type: 'authorization_code', redirect_uri: c.redirectUri }), 'Google');
        c.token = corpo.access_token; c.refresh = corpo.refresh_token || c.refresh; c.expira = Date.now() + (corpo.expires_in || 3600) * 1000;
        try { const { corpo: ch } = await chamar(u('www.googleapis.com', '/youtube/v3/channels?part=snippet&mine=true'), { headers: { Authorization: 'Bearer ' + c.token } }, 'YouTube'); c.conta = ch?.items?.[0]?.snippet?.title || 'canal conectado'; } catch { c.conta = 'canal conectado'; }
      },
      async renovar(c) {
        if (!c.refresh) throw new ErroRede('o acesso ao YouTube expirou; conecte de novo', { reconectar: true });
        const { corpo } = await chamar(u('oauth2.googleapis.com', '/token'), formulario({ client_id: c.clientId, client_secret: c.clientSecret || '', grant_type: 'refresh_token', refresh_token: c.refresh }), 'Google');
        c.token = corpo.access_token; c.expira = Date.now() + (corpo.expires_in || 3600) * 1000;
      },
    },
    tiktok: {
      url(c, state) {
        return 'https://www.tiktok.com/v2/auth/authorize/?' + new URLSearchParams({ client_key: c.clientId, scope: 'user.info.basic,video.publish,video.upload', response_type: 'code', redirect_uri: c.redirectUri, state });
      },
      async trocar(c, code) {
        const { corpo } = await chamar(u('open.tiktokapis.com', '/v2/oauth/token/'), formulario({ client_key: c.clientId, client_secret: c.clientSecret, code, grant_type: 'authorization_code', redirect_uri: c.redirectUri }), 'TikTok');
        if (!corpo?.access_token) throw new ErroRede('o TikTok não devolveu o acesso: ' + (corpo?.error_description || corpo?.error || 'resposta vazia'));
        Object.assign(c, { token: corpo.access_token, refresh: corpo.refresh_token, expira: Date.now() + (corpo.expires_in || 7200) * 1000, refreshExpira: Date.now() + (corpo.refresh_expires_in || 0) * 1000, openId: corpo.open_id });
        try { const { corpo: ui } = await chamar(u('open.tiktokapis.com', '/v2/user/info/?fields=display_name'), { headers: { Authorization: 'Bearer ' + c.token } }, 'TikTok'); c.conta = ui?.data?.user?.display_name || 'conta conectada'; } catch { c.conta = 'conta conectada'; }
      },
      async renovar(c) {
        const { corpo } = await chamar(u('open.tiktokapis.com', '/v2/oauth/token/'), formulario({ client_key: c.clientId, client_secret: c.clientSecret, grant_type: 'refresh_token', refresh_token: c.refresh }), 'TikTok');
        if (!corpo?.access_token) throw new ErroRede('o acesso ao TikTok expirou; conecte de novo', { reconectar: true });
        Object.assign(c, { token: corpo.access_token, refresh: corpo.refresh_token || c.refresh, expira: Date.now() + (corpo.expires_in || 7200) * 1000 });
      },
    },
    meta: {
      url(c, state) {
        const p = { client_id: c.clientId, redirect_uri: c.redirectUri, state, response_type: 'code' };
        if (c.configId) p.config_id = c.configId;
        else p.scope = 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management';
        return `https://www.facebook.com/${GRAPH}/dialog/oauth?` + new URLSearchParams(p);
      },
      async trocar(c, code) {
        const g = (cam) => u('graph.facebook.com', `/${GRAPH}${cam}`);
        const { corpo: curto } = await chamar(g('/oauth/access_token?' + new URLSearchParams({ client_id: c.clientId, redirect_uri: c.redirectUri, client_secret: c.clientSecret, code })), {}, 'Meta');
        const { corpo: longo } = await chamar(g('/oauth/access_token?' + new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: c.clientId, client_secret: c.clientSecret, fb_exchange_token: curto.access_token })), {}, 'Meta');
        c.token = longo.access_token; c.expira = Date.now() + (longo.expires_in || 60 * 86400) * 1000;
        await atualizarPaginas(c);
      },
      async renovar(c) { if (c.expira && c.expira < Date.now()) throw new ErroRede('o acesso à Meta expirou (60 dias); conecte de novo', { reconectar: true }); },
    },
    linkedin: {
      url(c, state) {
        return 'https://www.linkedin.com/oauth/v2/authorization?' + new URLSearchParams({ response_type: 'code', client_id: c.clientId, redirect_uri: c.redirectUri, state, scope: 'openid profile w_member_social' });
      },
      async trocar(c, code) {
        const { corpo } = await chamar(u('www.linkedin.com', '/oauth/v2/accessToken'), formulario({ grant_type: 'authorization_code', code, client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: c.redirectUri }), 'LinkedIn');
        Object.assign(c, { token: corpo.access_token, expira: Date.now() + (corpo.expires_in || 60 * 86400) * 1000, refresh: corpo.refresh_token || null });
        const { corpo: eu } = await chamar(u('api.linkedin.com', '/v2/userinfo'), { headers: { Authorization: 'Bearer ' + c.token } }, 'LinkedIn');
        c.pessoa = 'urn:li:person:' + eu.sub; c.conta = eu.name || 'perfil conectado';
      },
      async renovar(c) {
        if (c.refresh) {
          const { corpo } = await chamar(u('www.linkedin.com', '/oauth/v2/accessToken'), formulario({ grant_type: 'refresh_token', refresh_token: c.refresh, client_id: c.clientId, client_secret: c.clientSecret }), 'LinkedIn');
          Object.assign(c, { token: corpo.access_token, expira: Date.now() + (corpo.expires_in || 60 * 86400) * 1000, refresh: corpo.refresh_token || c.refresh });
          return;
        }
        throw new ErroRede('o acesso ao LinkedIn expirou (dura 60 dias); conecte de novo', { reconectar: true });
      },
    },
  };
  async function atualizarPaginas(c) {
    const { corpo } = await chamar(u('graph.facebook.com', `/${GRAPH}/me/accounts?` + new URLSearchParams({ fields: 'id,name,access_token,instagram_business_account{id,username}', access_token: c.token })), {}, 'Meta');
    c.paginas = (corpo?.data || []).map((p) => ({ id: p.id, nome: p.name, token: p.access_token, ig: p.instagram_business_account ? { id: p.instagram_business_account.id, usuario: p.instagram_business_account.username } : null }));
    if (!c.paginas.some((p) => p.id === c.paginaId)) c.paginaId = c.paginas[0]?.id || null;
    const p = c.paginas.find((x) => x.id === c.paginaId);
    c.conta = p ? p.nome + (p.ig ? ` · @${p.ig.usuario}` : ' · sem Instagram profissional ligado') : 'nenhuma Página encontrada';
  }
  async function tokenValido(rede) {
    const c = S[contaDe(rede)];
    if (!c?.token) throw new ErroRede(`${NOMES[rede]} não está conectado`, { reconectar: true });
    if (c.expira && c.expira < Date.now() + 5 * 60_000) { await OAUTH[contaDe(rede)].renovar(c); cofre.salvar(); }
    return c;
  }

  /* ---------- envio de cada rede ---------- */
  const ENVIAR = {
    async youtube(arq, p, v, prog) {
      const c = await tokenValido('youtube'), tam = fs.statSync(arq).size;
      const curto = v.render && v.render.altura > v.render.largura && v.render.duracao <= 180;
      let titulo = (v.post?.tituloYoutube || v.titulo).slice(0, 100);
      if (curto && !/#shorts/i.test(titulo) && titulo.length <= 92) titulo += ' #Shorts';
      const tags = String(v.post?.hashtags || '').split(/\s+/).map((h) => h.replace(/^#/, '')).filter(Boolean).slice(0, 15);
      const { r } = await chamar(u('www.googleapis.com', '/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status'), {
        method: 'POST', headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Length': String(tam), 'X-Upload-Content-Type': 'video/mp4' },
        body: JSON.stringify({ snippet: { title: titulo, description: p.legenda, tags, categoryId: '22', defaultLanguage: 'pt-BR' }, status: { privacyStatus: p.opcoes?.privacidadeYoutube || 'public', selfDeclaredMadeForKids: false } }),
      }, 'YouTube');
      const destino = r.headers.get('location');
      if (!destino) throw new ErroRede('o YouTube não devolveu o endereço de envio');
      let enviados = 0;
      const { corpo } = await chamar(destino, { method: 'PUT', headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'video/mp4', 'Content-Length': String(tam) }, body: pedacoDoArquivo(arq, 0, tam - 1, (n) => prog((enviados += n) / tam)), duplex: 'half' }, 'YouTube');
      if (!corpo?.id) throw new ErroRede('o YouTube não confirmou o vídeo', { temporario: true });
      return { idExterno: corpo.id, link: curto ? `https://www.youtube.com/shorts/${corpo.id}` : `https://www.youtube.com/watch?v=${corpo.id}`, aviso: (p.opcoes?.privacidadeYoutube || 'public') !== 'public' ? 'publicado como ' + (p.opcoes?.privacidadeYoutube === 'unlisted' ? 'não listado' : 'privado') : '' };
    },
    async tiktok(arq, p, v, prog) {
      const c = await tokenValido('tiktok'), tam = fs.statSync(arq).size;
      const H = { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json; charset=UTF-8' };
      const { corpo: info } = await chamar(u('open.tiktokapis.com', '/v2/post/publish/creator_info/query/'), { method: 'POST', headers: H, body: '{}' }, 'TikTok');
      const ci = info?.data || {};
      if (ci.max_video_post_duration_sec && v.render?.duracao > ci.max_video_post_duration_sec) throw new ErroRede(`a conta aceita vídeos de até ${ci.max_video_post_duration_sec} segundos`);
      const opcoes = ci.privacy_level_options || ['SELF_ONLY'];
      const priv = opcoes.includes(p.opcoes?.privacidadeTiktok) ? p.opcoes.privacidadeTiktok : opcoes.includes('SELF_ONLY') ? 'SELF_ONLY' : opcoes[0];
      /* pedaços: de 5 a 64 MB; o último pode ser maior (até 128 MB); abaixo de 64 MB vai inteiro */
      const pedaco = tam <= 64 * 2 ** 20 ? tam : 10 * 2 ** 20, total = tam <= 64 * 2 ** 20 ? 1 : Math.floor(tam / pedaco);
      const legenda = (p.legenda || '').slice(0, 2200);
      let ini;
      try {
        ({ corpo: ini } = await chamar(u('open.tiktokapis.com', '/v2/post/publish/video/init/'), {
          method: 'POST', headers: H,
          body: JSON.stringify({ post_info: { title: legenda, privacy_level: priv, disable_duet: !!ci.duet_disabled, disable_comment: !!ci.comment_disabled, disable_stitch: !!ci.stitch_disabled, video_cover_timestamp_ms: 1000 }, source_info: { source: 'FILE_UPLOAD', video_size: tam, chunk_size: pedaco, total_chunk_count: total } }),
        }, 'TikTok'));
      } catch (e) {
        if (/unaudited/i.test(e.message)) throw new ErroRede('o app do TikTok ainda não passou pela auditoria: até lá, só dá para postar com a conta do TikTok em modo privado (ou peça a auditoria no portal do TikTok)');
        throw e;
      }
      if (ini?.error && ini.error.code !== 'ok') throw new ErroRede('TikTok: ' + (ini.error.message || ini.error.code));
      const { publish_id: pubId, upload_url: destino } = ini.data || {};
      let enviados = 0;
      for (let i = 0; i < total; i++) {
        const a = i * pedaco, b = i === total - 1 ? tam - 1 : a + pedaco - 1;
        const r = await fetch(destino, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(b - a + 1), 'Content-Range': `bytes ${a}-${b}/${tam}` }, body: pedacoDoArquivo(arq, a, b, (n) => prog(0.9 * (enviados += n) / tam)), duplex: 'half' })
          .catch((e) => { throw new ErroRede('envio ao TikTok interrompido: ' + e.message, { temporario: true }); });
        if (![200, 201, 206].includes(r.status)) throw new ErroRede(`o TikTok recusou o pedaço ${i + 1} de ${total} (${r.status})`, { temporario: r.status >= 500 });
      }
      for (let k = 0; k < 40; k++) {
        await espera(k < 3 ? 2000 : 5000);
        const { corpo: st } = await chamar(u('open.tiktokapis.com', '/v2/post/publish/status/fetch/'), { method: 'POST', headers: H, body: JSON.stringify({ publish_id: pubId }) }, 'TikTok');
        const s = st?.data?.status;
        if (s === 'PUBLISH_COMPLETE') return { idExterno: pubId, link: 'https://www.tiktok.com/', aviso: priv === 'SELF_ONLY' ? 'publicado como privado (só você vê) até o app passar pela auditoria do TikTok' : '' };
        if (s === 'FAILED') throw new ErroRede('o TikTok recusou o vídeo: ' + (st.data.fail_reason || 'motivo não informado'));
        prog(0.9 + 0.1 * Math.min(1, k / 20));
      }
      return { idExterno: pubId, link: 'https://www.tiktok.com/', aviso: 'enviado; o TikTok ainda está processando' };
    },
    async instagram(arq, p, v, prog) {
      const c = await tokenValido('instagram'), pg = paginaMeta(), tam = fs.statSync(arq).size;
      if (!pg?.ig) throw new ErroRede('a Página escolhida não tem uma conta profissional do Instagram ligada');
      if (tam > 300 * 1e6) throw new ErroRede('o Instagram aceita Reels de até 300 MB');
      const g = (cam) => u('graph.facebook.com', `/${GRAPH}${cam}`);
      const legenda = (p.legenda || '').slice(0, 2200);
      const { corpo: cont } = await chamar(g(`/${pg.ig.id}/media`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media_type: 'REELS', upload_type: 'resumable', caption: legenda, share_to_feed: true, thumb_offset: 1000, access_token: c.token }) }, 'Instagram');
      const destino = cont.uri || u('rupload.facebook.com', `/ig-api-upload/${GRAPH}/${cont.id}`);
      let enviados = 0;
      await chamar(destino, { method: 'POST', headers: { Authorization: 'OAuth ' + c.token, offset: '0', file_size: String(tam), 'Content-Type': 'application/octet-stream', 'Content-Length': String(tam) }, body: pedacoDoArquivo(arq, 0, tam - 1, (n) => prog(0.8 * (enviados += n) / tam)), duplex: 'half' }, 'Instagram');
      let pronto = false;
      for (let k = 0; k < 24 && !pronto; k++) {
        await espera(k < 2 ? 5000 : 15000);
        const { corpo: st } = await chamar(g(`/${cont.id}?fields=status_code&access_token=${encodeURIComponent(c.token)}`), {}, 'Instagram');
        if (st?.status_code === 'FINISHED') pronto = true;
        else if (st?.status_code === 'ERROR' || st?.status_code === 'EXPIRED') throw new ErroRede('o Instagram não aceitou o vídeo (status ' + st.status_code + ')');
        prog(0.8 + 0.15 * Math.min(1, k / 12));
      }
      if (!pronto) throw new ErroRede('o Instagram demorou demais para processar; tente de novo', { temporario: true });
      const { corpo: pub } = await chamar(g(`/${pg.ig.id}/media_publish`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creation_id: cont.id, access_token: c.token }) }, 'Instagram');
      let link = 'https://www.instagram.com/' + (pg.ig.usuario || '');
      try { const { corpo: md } = await chamar(g(`/${pub.id}?fields=permalink&access_token=${encodeURIComponent(c.token)}`), {}, 'Instagram'); if (md?.permalink) link = md.permalink; } catch { /* fica o perfil */ }
      return { idExterno: pub.id, link };
    },
    async facebook(arq, p, v, prog) {
      await tokenValido('facebook');
      const pg = paginaMeta(), tam = fs.statSync(arq).size;
      if (v.render?.duracao > 90) throw new ErroRede('Reels do Facebook aceitam de 3 a 90 segundos; corte o vídeo no Estúdio');
      const g = (cam) => u('graph.facebook.com', `/${GRAPH}${cam}`);
      const { corpo: ini } = await chamar(g(`/${pg.id}/video_reels`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upload_phase: 'start', access_token: pg.token }) }, 'Facebook');
      let enviados = 0;
      await chamar(ini.upload_url || u('rupload.facebook.com', `/video-upload/${GRAPH}/${ini.video_id}`), { method: 'POST', headers: { Authorization: 'OAuth ' + pg.token, offset: '0', file_size: String(tam), 'Content-Type': 'application/octet-stream', 'Content-Length': String(tam) }, body: pedacoDoArquivo(arq, 0, tam - 1, (n) => prog(0.9 * (enviados += n) / tam)), duplex: 'half' }, 'Facebook');
      await chamar(g(`/${pg.id}/video_reels`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ video_id: ini.video_id, upload_phase: 'finish', video_state: 'PUBLISHED', description: (p.legenda || '').slice(0, 2200), access_token: pg.token }) }, 'Facebook');
      return { idExterno: ini.video_id, link: `https://www.facebook.com/reel/${ini.video_id}` };
    },
    async linkedin(arq, p, v, prog) {
      const c = await tokenValido('linkedin'), tam = fs.statSync(arq).size;
      if (tam > 500 * 1e6) throw new ErroRede('o LinkedIn aceita vídeos de até 500 MB');
      const H = { Authorization: 'Bearer ' + c.token, 'LinkedIn-Version': LI_VERSAO, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' };
      const { corpo: ini } = await chamar(u('api.linkedin.com', '/rest/videos?action=initializeUpload'), { method: 'POST', headers: H, body: JSON.stringify({ initializeUploadRequest: { owner: c.pessoa, fileSizeBytes: tam, uploadCaptions: false, uploadThumbnail: false } }) }, 'LinkedIn');
      const val = ini.value, partes = [];
      let enviados = 0;
      for (const ins of val.uploadInstructions || []) {
        const r = await fetch(ins.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(ins.lastByte - ins.firstByte + 1) }, body: pedacoDoArquivo(arq, ins.firstByte, ins.lastByte, (n) => prog(0.8 * (enviados += n) / tam)), duplex: 'half' })
          .catch((e) => { throw new ErroRede('envio ao LinkedIn interrompido: ' + e.message, { temporario: true }); });
        if (!r.ok) throw new ErroRede(`o LinkedIn recusou uma parte do vídeo (${r.status})`, { temporario: r.status >= 500 });
        partes.push(r.headers.get('etag'));
      }
      await chamar(u('api.linkedin.com', '/rest/videos?action=finalizeUpload'), { method: 'POST', headers: H, body: JSON.stringify({ finalizeUploadRequest: { video: val.video, uploadToken: val.uploadToken || '', uploadedPartIds: partes } }) }, 'LinkedIn');
      let pronto = false;
      for (let k = 0; k < 60 && !pronto; k++) {
        await espera(k < 3 ? 2000 : 5000);
        const { corpo: st } = await chamar(u('api.linkedin.com', '/rest/videos/' + encodeURIComponent(val.video)), { headers: H }, 'LinkedIn');
        if (st?.status === 'AVAILABLE') pronto = true;
        else if (st?.status === 'PROCESSING_FAILED') throw new ErroRede('o LinkedIn não conseguiu processar o vídeo: ' + (st.processingFailureReason || ''));
        prog(0.8 + 0.15 * Math.min(1, k / 20));
      }
      if (!pronto) throw new ErroRede('o LinkedIn demorou demais para processar o vídeo', { temporario: true });
      const { r } = await chamar(u('api.linkedin.com', '/rest/posts'), { method: 'POST', headers: H, body: JSON.stringify({ author: c.pessoa, commentary: (p.legenda || '').slice(0, 3000), visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, content: { media: { title: v.titulo.slice(0, 200), id: val.video } }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false }) }, 'LinkedIn');
      const urn = r.headers.get('x-restli-id') || '';
      return { idExterno: urn, link: urn ? `https://www.linkedin.com/feed/update/${urn}/` : 'https://www.linkedin.com/feed/' };
    },
  };

  /* ---------- publicar ---------- */
  function textoDoPost(v) { return [v.post?.legenda || v.titulo, v.post?.hashtags || ''].filter(Boolean).join('\n\n').trim(); }
  async function publicar(p, quem = 'você') {
    const v = ctx.estudio.achar(p.videoId);
    if (!v) { Object.assign(p, { status: 'erro', erro: 'o vídeo foi excluído' }); banco.salvar(); return; }
    if (ocupadas.has(p.rede) || p.status === 'enviando') return;
    const arq = v.versoes?.editado && path.join(ctx.estudio.pastaDe(v), v.versoes.editado);
    if (!arq || !fs.existsSync(arq)) { Object.assign(p, { status: 'erro', erro: 'gere a versão editada no Estúdio antes de publicar' }); banco.salvar(); return; }
    if (!conectada(p.rede)) { Object.assign(p, { status: 'erro', erro: `${NOMES[p.rede]} não está conectado (página Publicação)` }); banco.salvar(); return; }
    ocupadas.add(p.rede);
    Object.assign(p, { status: 'enviando', progresso: 0, erro: '', inicio: new Date().toISOString(), por: quem });
    banco.salvar();
    const andar = 5;
    ctx.agentes.atividade({ andar, texto: `está publicando “${p.titulo}” no ${NOMES[p.rede]}`, ref: v.id });
    try {
      const r = await ENVIAR[p.rede](arq, p, v, (x) => { p.progresso = Math.max(0, Math.min(1, x)); });
      Object.assign(p, { status: 'publicado', progresso: 1, link: r.link, idExterno: r.idExterno, aviso: r.aviso || '', publicadoEm: new Date().toISOString() });
      if (v.status !== 'publicado') { v.status = 'publicado'; (v.historico ||= []).push({ em: p.publicadoEm, quem, oque: `publicado no ${NOMES[p.rede]}` }); }
      else (v.historico ||= []).push({ em: p.publicadoEm, quem, oque: `publicado no ${NOMES[p.rede]}` });
      ctx.agentes.atividade({ andar, texto: `publicou “${p.titulo}” no ${NOMES[p.rede]}${r.aviso ? ' (' + r.aviso + ')' : ''}`, ref: v.id });
    } catch (e) {
      p.tentativas = (p.tentativas || 0) + 1;
      if (e.reconectar) { const c = S[contaDe(p.rede)]; if (c) { c.precisaReconectar = true; cofre.salvar(); } }
      if (e.temporario && p.tentativas < 3) {
        Object.assign(p, { status: 'agendado', quando: new Date(Date.now() + 10 * 60_000).toISOString(), erro: e.message + ' · nova tentativa em 10 minutos' });
      } else Object.assign(p, { status: 'erro', erro: e.message });
      ctx.agentes.atividade({ andar, texto: `não conseguiu publicar “${p.titulo}” no ${NOMES[p.rede]}: ${e.message}`, ref: v.id });
    } finally { ocupadas.delete(p.rede); banco.salvar(); }
  }

  /* próximos horários livres para cada rede conectada */
  function agendarAprovado(v, horarios) {
    const criadas = [];
    for (const rede of Object.keys(NOMES)) {
      if (!conectada(rede) || pubs().some((p) => p.videoId === v.id && p.rede === rede && p.status !== 'cancelado' && p.status !== 'erro')) continue;
      const ocupados = new Set(pubs().filter((p) => p.rede === rede && ['agendado', 'aguardando', 'enviando'].includes(p.status)).map((p) => p.quando.slice(0, 16)));
      let quando = null;
      for (let dia = 0; dia < 30 && !quando; dia++) {
        for (const h of horarios) {
          const t = new Date(); t.setDate(t.getDate() + dia); const [hh, mm] = h.split(':').map(Number); t.setHours(hh, mm, 0, 0);
          if (t.getTime() > Date.now() + 5 * 60_000 && !ocupados.has(t.toISOString().slice(0, 16))) { quando = t; break; }
        }
      }
      if (!quando) continue;
      const p = { id: novoId('p'), videoId: v.id, titulo: v.titulo, rede, quando: quando.toISOString(), status: 'agendado', legenda: textoDoPost(v), opcoes: {}, criadoEm: new Date().toISOString(), por: 'Publicação' };
      pubs().push(p); criadas.push(p);
    }
    banco.salvar();
    return criadas;
  }

  /* ---------- páginas de retorno do OAuth ---------- */
  function pagina(res, ok, texto) {
    res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ok ? 'Conectado' : 'Não conectado'}</title><body style="font:16px system-ui;background:#05070d;color:#eef1f6;display:grid;place-items:center;min-height:100vh;margin:0"><main style="max-width:460px;padding:24px;text-align:center"><h1 style="font-size:22px">${ok ? '✓ Conta conectada' : '✗ Não deu certo'}</h1><p style="color:#b4bccb">${texto.replace(/[<>&]/g, '')}</p><p><a style="color:#bfe6ff" href="/publicacao.html">Voltar para a Publicação</a></p></main></body></html>`);
  }
  async function concluir(code, state) {
    const e = estados.get(state);
    if (!e || Date.now() - e.criado > 30 * 60_000) throw new ErroRede('este pedido de conexão expirou; clique em Conectar de novo');
    estados.delete(state);
    const c = S[e.conta];
    await OAUTH[e.conta].trocar(c, code, e.verificador);
    c.precisaReconectar = false; c.conectadoEm = new Date().toISOString();
    cofre.salvar();
    ctx.agentes.atividade({ andar: 5, agente: 'Publicação', texto: `${e.conta === 'meta' ? 'Facebook/Instagram' : NOMES[e.conta]} conectado: ${c.conta}` });
    return c;
  }

  /* ---------- rotas ---------- */
  function resumoContas() {
    const r = {};
    for (const conta of ['youtube', 'tiktok', 'meta', 'linkedin']) {
      const c = S[conta] || {};
      r[conta] = { configurada: !!(c.clientId && (c.clientSecret || conta === 'youtube')), clientId: c.clientId || '', redirectUri: c.redirectUri || retornoPadrao(), configId: c.configId || '', conectada: !!c.token, conta: c.conta || '', expira: c.expira || null, precisaReconectar: !!c.precisaReconectar || (c.expira && c.expira < Date.now() && !c.refresh) };
      if (conta === 'meta') { r.meta.paginas = (c.paginas || []).map((p) => ({ id: p.id, nome: p.nome, ig: p.ig?.usuario || null })); r.meta.paginaId = c.paginaId || null; }
    }
    return r;
  }
  async function rota(req, res, caminho, url) {
    if (caminho === '/api/redes/retorno' && req.method === 'GET') {
      const code = url.searchParams.get('code'), state = url.searchParams.get('state') || '';
      if (!code) { pagina(res, false, url.searchParams.get('error_description') || url.searchParams.get('error') || 'a rede não devolveu a autorização'); return true; }
      try { const c = await concluir(code, state); pagina(res, true, `${c.conta}. Pode fechar esta aba.`); } catch (e) { pagina(res, false, e.message); }
      return true;
    }
    if (!caminho.startsWith('/api/redes') && !caminho.startsWith('/api/publicacoes')) return false;
    if (req.method !== 'GET' && !mesmaOrigem(req)) { json(res, 403, { ok: false, erro: 'origem não permitida' }); return true; }
    try {
      if (caminho === '/api/redes' && req.method === 'GET') {
        const vids = ctx.estudio.videos();
        json(res, 200, {
          ok: true, contas: resumoContas(), retornoPadrao: retornoPadrao(), horarios: banco.d.controle?.horarios || [],
          conectadas: Object.fromEntries(Object.keys(NOMES).map((k) => [k, conectada(k)])),
          publicacoes: pubs().slice().sort((a, b) => (a.quando < b.quando ? 1 : -1)).slice(0, 300),
          videos: vids.filter((v) => v.tipo !== 'reuniao' && v.versoes?.editado).map((v) => ({ id: v.id, titulo: v.titulo, status: v.status, legenda: textoDoPost(v), tituloYoutube: v.post?.tituloYoutube || v.titulo, duracao: v.render?.duracao, vertical: v.render ? v.render.altura > v.render.largura : null })),
          modoPublicacao: ctx.agentes.modo('publicacao'),
        });
        return true;
      }
      if (req.method !== 'POST') { json(res, 405, { ok: false }); return true; }
      const corpo = await lerJSON(req, 100_000);
      let m = /^\/api\/redes\/(youtube|tiktok|meta|linkedin)\/(config|autorizar|codigo|desconectar|pagina)$/.exec(caminho);
      if (m) {
        const [, conta, acao] = m, c = (S[conta] ||= {});
        if (acao === 'config') {
          if (typeof corpo.clientId === 'string') c.clientId = corpo.clientId.trim().slice(0, 300);
          if (typeof corpo.clientSecret === 'string' && corpo.clientSecret.trim()) c.clientSecret = corpo.clientSecret.trim().slice(0, 300);
          if (typeof corpo.redirectUri === 'string') { const r = corpo.redirectUri.trim(); c.redirectUri = /^https?:\/\/[^\s]+$/.test(r) ? r.slice(0, 300) : retornoPadrao(); }
          if (typeof corpo.configId === 'string') c.configId = corpo.configId.trim().slice(0, 100);
          cofre.salvar(); json(res, 200, { ok: true, contas: resumoContas() }); return true;
        }
        if (acao === 'autorizar') {
          if (!c.clientId) { json(res, 400, { ok: false, erro: 'preencha os dados do app primeiro' }); return true; }
          c.redirectUri ||= retornoPadrao();
          const state = b64url(randomBytes(18)), verificador = b64url(randomBytes(48)), desafio = b64url(createHash('sha256').update(verificador).digest());
          estados.set(state, { conta, verificador, criado: Date.now() });
          for (const [k, e] of estados) if (Date.now() - e.criado > 30 * 60_000) estados.delete(k);
          cofre.salvar();
          json(res, 200, { ok: true, url: OAUTH[conta].url(c, state, desafio), automatico: c.redirectUri === retornoPadrao() }); return true;
        }
        if (acao === 'codigo') {
          /* para redes que só aceitam endereços https: você cola o endereço para onde foi levado */
          let endereco; try { endereco = new URL(String(corpo.endereco || '').trim()); } catch { json(res, 400, { ok: false, erro: 'cole o endereço completo da barra do navegador (começa com https://)' }); return true; }
          const code = endereco.searchParams.get('code'), state = endereco.searchParams.get('state') || '';
          if (!code) { json(res, 400, { ok: false, erro: endereco.searchParams.get('error_description') || 'esse endereço não tem o código de autorização (parâmetro code)' }); return true; }
          const cc = await concluir(code.replace(/#_$/, ''), state);
          json(res, 200, { ok: true, conta: cc.conta, contas: resumoContas() }); return true;
        }
        if (acao === 'desconectar') {
          for (const k of ['token', 'refresh', 'expira', 'conta', 'paginas', 'paginaId', 'pessoa', 'openId', 'precisaReconectar']) delete c[k];
          cofre.salvar(); json(res, 200, { ok: true, contas: resumoContas() }); return true;
        }
        if (acao === 'pagina' && conta === 'meta') {
          if (!(c.paginas || []).some((p) => p.id === corpo.id)) { json(res, 400, { ok: false, erro: 'Página desconhecida' }); return true; }
          c.paginaId = corpo.id; const p = paginaMeta();
          c.conta = p.nome + (p.ig ? ` · @${p.ig.usuario}` : ' · sem Instagram profissional ligado');
          cofre.salvar(); json(res, 200, { ok: true, contas: resumoContas() }); return true;
        }
      }
      if (caminho === '/api/publicacoes') {
        /* agendar (ou publicar já) um vídeo aprovado em uma ou mais redes */
        const v = ctx.estudio.achar(String(corpo.videoId || ''));
        if (!v) { json(res, 404, { ok: false, erro: 'vídeo não encontrado' }); return true; }
        if (!v.versoes?.editado) { json(res, 409, { ok: false, erro: 'gere a versão editada no Estúdio antes' }); return true; }
        const redes = (Array.isArray(corpo.redes) ? corpo.redes : []).filter((r) => NOMES[r]);
        if (!redes.length) { json(res, 400, { ok: false, erro: 'escolha ao menos uma rede' }); return true; }
        const quando = corpo.quando ? new Date(corpo.quando) : new Date();
        if (Number.isNaN(quando.getTime())) { json(res, 400, { ok: false, erro: 'data inválida' }); return true; }
        const legenda = typeof corpo.legenda === 'string' && corpo.legenda.trim() ? corpo.legenda.trim().slice(0, 2200) : textoDoPost(v);
        const opcoes = { privacidadeYoutube: ['public', 'unlisted', 'private'].includes(corpo.opcoes?.privacidadeYoutube) ? corpo.opcoes.privacidadeYoutube : 'public', privacidadeTiktok: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'].includes(corpo.opcoes?.privacidadeTiktok) ? corpo.opcoes.privacidadeTiktok : 'SELF_ONLY' };
        const novas = redes.map((rede) => ({ id: novoId('p'), videoId: v.id, titulo: v.titulo, rede, quando: quando.toISOString(), status: 'agendado', legenda, opcoes, criadoEm: new Date().toISOString(), por: 'você' }));
        pubs().push(...novas); banco.salvar();
        ctx.agentes.atividade({ andar: 5, texto: corpo.quando ? `você agendou “${v.titulo}” em ${redes.map((r) => NOMES[r]).join(', ')}` : `você mandou publicar “${v.titulo}” agora em ${redes.map((r) => NOMES[r]).join(', ')}`, ref: v.id });
        /* "publicar agora" é uma ordem sua: vai na hora, sem esperar a Central de Controle */
        if (!corpo.quando) for (const p of novas) publicar(p, 'você');
        json(res, 201, { ok: true, publicacoes: novas }); return true;
      }
      m = /^\/api\/publicacoes\/([a-z0-9]+)\/(agora|cancelar|tentar)$/.exec(caminho);
      if (m) {
        const p = pubs().find((x) => x.id === m[1]);
        if (!p) { json(res, 404, { ok: false, erro: 'publicação não encontrada' }); return true; }
        if (m[2] === 'cancelar') { if (p.status === 'enviando') { json(res, 409, { ok: false, erro: 'já está sendo enviada' }); return true; } if (p.status !== 'publicado') p.status = 'cancelado'; banco.salvar(); }
        else { if (p.status === 'publicado' || p.status === 'enviando') { json(res, 409, { ok: false, erro: 'já foi publicada ou está sendo enviada' }); return true; } p.tentativas = 0; publicar(p, 'você'); }
        json(res, 200, { ok: true }); return true;
      }
      json(res, 404, { ok: false, erro: 'rota desconhecida' }); return true;
    } catch (e) { json(res, e.status || (e instanceof ErroRede ? 502 : 500), { ok: false, erro: e.message }); return true; }
  }

  return { rota, publicar, agendarAprovado, conectada, NOMES };
}
