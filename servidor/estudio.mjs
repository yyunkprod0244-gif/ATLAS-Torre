/* ============================================================================
   ESTÚDIO DE VÍDEO
   ----------------------------------------------------------------------------
   • Recebe os vídeos que você grava (upload) e guarda em ATLAS_DADOS\videos\<id>\
   • Analisa (duração, tamanho, som) e gera a capa
   • Legendas automáticas com o Whisper (whisper.cpp, no seu computador)
   • Edição com o FFmpeg: corte, formato vertical 9:16 (Shorts, Reels, TikTok),
     quadrado, legendas na imagem, título no topo e som equalizado (-14 LUFS,
     o volume que as redes usam). Sai um MP4 H.264/AAC que as cinco redes aceitam.
   • Avaliação: nota, comentário, aprovar ou pedir ajustes
   Nenhum arquivo seu é apagado: o original fica sempre guardado.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { json, lerJSON, mesmaOrigem, servirArquivo, novoId, ID_VALIDO, dentroDe } from './base.mjs';

const EXTENSOES = new Set(['.mp4', '.mov', '.webm', '.mkv', '.m4v', '.avi']);
const MAX_UPLOAD = 4 * 1024 ** 3;   /* 4 GB */
const FORMATOS = {
  vertical: { w: 1080, h: 1920, modo: 'fundo', nome: 'Vertical 9:16 (com fundo desfocado)' },
  'vertical-corte': { w: 1080, h: 1920, modo: 'corte', nome: 'Vertical 9:16 (cortando as laterais)' },
  quadrado: { w: 1080, h: 1080, modo: 'fundo', nome: 'Quadrado 1:1' },
  original: { nome: 'Formato original' },
};
export const STATUS = ['novo', 'preparando', 'revisao', 'aprovado', 'ajustes', 'publicado'];

/* roda um programa e devolve a saída; `tarefa.parar` interrompe */
function rodar(exe, args, { cwd, tarefa, aoLinha, aoErro } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, args, { cwd, windowsHide: true });
    if (tarefa) tarefa.parar = () => { try { p.kill(); } catch { /* já parou */ } };
    let saida = '', erros = '', resto = '', restoErr = '';
    p.stdout.on('data', (c) => {
      saida += c; if (saida.length > 2e6) saida = saida.slice(-1e6);
      if (aoLinha) { resto += c; const ls = resto.split(/\r?\n/); resto = ls.pop(); ls.forEach(aoLinha); }
    });
    p.stderr.on('data', (c) => {
      erros += c; if (erros.length > 20000) erros = erros.slice(-10000);
      if (aoErro) { restoErr += c; const ls = restoErr.split(/\r?\n/); restoErr = ls.pop(); ls.forEach(aoErro); }
    });
    p.on('error', reject);
    p.on('close', (codigo) => {
      if (tarefa?.cancelado) return reject(new Error('cancelado'));
      if (codigo === 0) resolve(saida);
      else reject(new Error(`${path.basename(exe)} terminou com erro (${codigo}): ` + erros.trim().split(/\r?\n/).slice(-3).join(' | ').slice(0, 300)));
    });
  });
}

/* SRT ⇄ lista de trechos */
function tempoSRT(s) { const ms = Math.max(0, Math.round(s * 1000)); const h = Math.floor(ms / 3.6e6), m = Math.floor(ms / 6e4) % 60, se = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(se).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; }
export function lerSRT(texto) {
  const lista = [];
  for (const bloco of String(texto || '').replace(/\r/g, '').split(/\n{2,}/)) {
    const m = /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)\s*\n([\s\S]*)/.exec(bloco);
    if (!m) continue;
    const t = (a, b, c, d) => +a * 3600 + +b * 60 + +c + +d / 1000;
    const txt = m[9].trim(); if (txt) lista.push({ ini: t(m[1], m[2], m[3], m[4]), fim: t(m[5], m[6], m[7], m[8]), texto: txt });
  }
  return lista;
}
export function escreverSRT(lista) { return lista.map((s, i) => `${i + 1}\n${tempoSRT(s.ini)} --> ${tempoSRT(s.fim)}\n${s.texto}\n`).join('\n'); }
/* quebra o título do topo em linhas que caibam na largura */
function quebrar(texto, porLinha) {
  const linhas = []; let atual = '';
  for (const p of String(texto).split(/\s+/).filter(Boolean)) {
    if ((atual + ' ' + p).trim().length > porLinha && atual) { linhas.push(atual); atual = p; } else atual = (atual + ' ' + p).trim();
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 4).join('\n');
}

export function criarEstudio(ctx) {
  const { banco, fila, DADOS, ferramentas } = ctx;
  const PASTA = path.join(DADOS, 'videos'), FONTES = path.join(DADOS, 'fontes');
  fs.mkdirSync(PASTA, { recursive: true }); fs.mkdirSync(FONTES, { recursive: true });
  /* fonte para legendas e títulos: uma cópia dentro da pasta de dados evita caminhos com
     "C:" nos filtros do FFmpeg, onde os dois-pontos precisariam de escape */
  for (const f of ['arialbd.ttf', 'arial.ttf']) {
    const de = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', f), para = path.join(FONTES, f);
    try { if (!fs.existsSync(para) && fs.existsSync(de)) fs.copyFileSync(de, para); } catch { /* sem a fonte: o FFmpeg usa a padrão */ }
  }
  const temFonte = () => fs.existsSync(path.join(FONTES, 'arialbd.ttf'));

  const videos = () => banco.d.videos;
  const achar = (id) => videos().find((v) => v.id === id);
  const pastaDe = (v) => path.join(PASTA, v.id);
  function historico(v, quem, oque) { (v.historico ||= []).push({ em: new Date().toISOString(), quem, oque }); if (v.historico.length > 60) v.historico.shift(); }
  function mudar(v, campos) { Object.assign(v, campos); v.atualizadoEm = new Date().toISOString(); banco.salvar(); }

  /* ---------- análise e capa ---------- */
  async function analisar(v, tarefa) {
    const dir = pastaDe(v);
    const saida = await rodar(ferramentas.ffprobe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', v.original], { cwd: dir, tarefa });
    const j = JSON.parse(saida), vs = (j.streams || []).find((s) => s.codec_type === 'video');
    if (!vs) throw new Error('o arquivo não tem imagem de vídeo');
    let w = vs.width, h = vs.height;
    const rot = Math.abs(Number(vs.tags?.rotate || (vs.side_data_list || []).find((s) => s.rotation !== undefined)?.rotation || 0));
    if (rot === 90 || rot === 270) [w, h] = [h, w];
    const [a, b] = String(vs.avg_frame_rate || vs.r_frame_rate || '30/1').split('/').map(Number);
    const duracao = Number(j.format?.duration || vs.duration || 0);
    v.info = { duracao, largura: w, altura: h, fps: b ? Math.round((a / b) * 100) / 100 : 30, temAudio: (j.streams || []).some((s) => s.codec_type === 'audio'), codec: vs.codec_name };
    v.edicao = { inicio: 0, fim: duracao, formato: 'auto', legendas: true, textoTopo: '', normalizarSom: true, ...(v.edicao || {}) };
    if (!(v.edicao.fim > 0)) v.edicao.fim = duracao;
    await rodar(ferramentas.ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(Math.min(1, duracao * 0.1)), '-i', v.original, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', 'capa.jpg'], { cwd: dir, tarefa });
    v.versoes = { ...(v.versoes || {}), capa: 'capa.jpg' };
    banco.salvar();
  }

  /* ---------- legendas com o Whisper ---------- */
  async function legendar(v, tarefa) {
    if (!ferramentas.whisper) throw new Error('o Whisper não está instalado (S:\\JarvisLocal\\whisper)');
    if (v.info && !v.info.temAudio) throw new Error('o vídeo não tem som para legendar');
    const dir = pastaDe(v);
    await rodar(ferramentas.ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', v.original, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', 'audio16k.wav'], { cwd: dir, tarefa });
    tarefa.progresso = 0.05; ctx.aoMudar?.();
    try {
      await rodar(ferramentas.whisper, ['-m', ferramentas.modeloWhisper, '-l', 'pt', '-t', String(ferramentas.threads), '-osrt', '-otxt', '-of', 'legenda', '-ml', '42', '-sow', '-pp', '-f', 'audio16k.wav'], {
        cwd: dir, tarefa,
        aoErro: (l) => { const m = /progress\s*=\s*(\d+)%/.exec(l); if (m) { tarefa.progresso = 0.05 + 0.95 * (+m[1] / 100); ctx.aoMudar?.(); } },
      });
    } finally { fs.rm(path.join(dir, 'audio16k.wav'), { force: true }, () => {}); }
    const srt = fs.readFileSync(path.join(dir, 'legenda.srt'), 'utf8');
    const trechos = lerSRT(srt);
    fs.writeFileSync(path.join(dir, 'legenda.srt'), escreverSRT(trechos));
    v.versoes = { ...(v.versoes || {}), legenda: 'legenda.srt' };
    v.transcricao = trechos.map((s) => s.texto).join(' ').replace(/\s+/g, ' ').trim();
    banco.salvar();
    return trechos.length;
  }

  /* ---------- edição (render) ---------- */
  function formatoDe(v) {
    const f = v.edicao?.formato || 'auto';
    if (f !== 'auto') return f;
    return v.info && v.info.largura > v.info.altura ? 'vertical' : 'original';
  }
  async function renderizar(v, tarefa) {
    const dir = pastaDe(v), e = v.edicao, info = v.info;
    if (!info) throw new Error('o vídeo ainda não foi analisado');
    const ini = Math.max(0, Math.min(+e.inicio || 0, info.duracao - 0.5)), fim = Math.min(info.duracao, Math.max(ini + 0.5, +e.fim || info.duracao));
    const dur = fim - ini, nomeF = formatoDe(v), F = FORMATOS[nomeF] || FORMATOS.original;
    const args = ['-y', '-hide_banner', '-nostats', '-loglevel', 'error', '-progress', 'pipe:1'];
    if (ini > 0.01) args.push('-ss', ini.toFixed(3));
    if (fim < info.duracao - 0.05) args.push('-to', fim.toFixed(3));
    args.push('-i', v.original);
    if (!info.temAudio) args.push('-f', 'lavfi', '-t', dur.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo');

    /* imagem */
    const filtros = [];
    let rotulo = '0:v';
    if (F.modo === 'fundo') {
      const pw = Math.round(F.w / 4), ph = Math.round(F.h / 4);
      filtros.push(`[0:v]split=2[a][b]`,
        `[a]scale=${pw}:${ph}:force_original_aspect_ratio=increase,crop=${pw}:${ph},boxblur=10:2,scale=${F.w}:${F.h},eq=brightness=-0.07[fundo]`,
        `[b]scale=${F.w}:${F.h}:force_original_aspect_ratio=decrease[frente]`,
        `[fundo][frente]overlay=(W-w)/2:(H-h)/2,setsar=1[base]`);
      rotulo = 'base';
    } else if (F.modo === 'corte') {
      filtros.push(`[0:v]scale=${F.w}:${F.h}:force_original_aspect_ratio=increase,crop=${F.w}:${F.h},setsar=1[base]`);
      rotulo = 'base';
    } else {
      filtros.push(`[0:v]scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))',scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1[base]`);
      rotulo = 'base';
    }
    const vertical = F.h ? F.h > F.w : info.altura > info.largura;
    if (e.legendas && v.versoes?.legenda && fs.existsSync(path.join(dir, v.versoes.legenda))) {
      /* legendas com o tempo do corte */
      const trechos = lerSRT(fs.readFileSync(path.join(dir, v.versoes.legenda), 'utf8'))
        .map((s) => ({ ini: s.ini - ini, fim: Math.min(s.fim, fim) - ini, texto: s.texto })).filter((s) => s.fim > 0 && s.ini < dur)
        .map((s) => ({ ...s, ini: Math.max(0, s.ini) }));
      fs.writeFileSync(path.join(dir, 'legenda-corte.srt'), escreverSRT(trechos));
      const estilo = `Fontname=Arial,Fontsize=${vertical ? 11 : 15},Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=${vertical ? 62 : 18}`;
      filtros.push(`[${rotulo}]subtitles=filename=legenda-corte.srt${temFonte() ? ':fontsdir=../../fontes' : ''}:force_style='${estilo}'[leg]`);
      rotulo = 'leg';
    }
    if (String(e.textoTopo || '').trim()) {
      fs.writeFileSync(path.join(dir, 'topo.txt'), quebrar(e.textoTopo.trim().slice(0, 120), vertical ? 22 : 40));
      const fonte = temFonte() ? 'fontfile=../../fontes/arialbd.ttf:' : '';
      filtros.push(`[${rotulo}]drawtext=${fonte}textfile=topo.txt:fontcolor=white:fontsize=h*${vertical ? 0.042 : 0.06}:line_spacing=12:box=1:boxcolor=black@0.5:boxborderw=26:x=(w-text_w)/2:y=h*0.07[top]`);
      rotulo = 'top';
    }
    args.push('-filter_complex', filtros.join(';'), '-map', `[${rotulo}]`);
    /* som */
    if (info.temAudio) { args.push('-map', '0:a:0'); if (e.normalizarSom) args.push('-af', 'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000'); }
    else args.push('-map', '1:a:0');
    /* MP4 que YouTube, TikTok, Instagram, Facebook e LinkedIn aceitam: H.264 + AAC 48 kHz, até 60 fps,
       GOP fechado de 2 s e o índice no começo do arquivo (exigência do Instagram) */
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-fpsmax', '60', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
      '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', '-t', dur.toFixed(3), 'editado.parcial.mp4');
    await rodar(ferramentas.ffmpeg, args, {
      cwd: dir, tarefa,
      aoLinha: (l) => { const m = /^out_time_(?:us|ms)=(\d+)/.exec(l); if (m) { tarefa.progresso = Math.min(0.99, +m[1] / 1e6 / dur); ctx.aoMudar?.(); } },
    });
    fs.renameSync(path.join(dir, 'editado.parcial.mp4'), path.join(dir, 'editado.mp4'));
    fs.rm(path.join(dir, 'legenda-corte.srt'), { force: true }, () => {});
    v.versoes = { ...(v.versoes || {}), editado: 'editado.mp4' };
    v.render = { em: new Date().toISOString(), formato: nomeF, duracao: dur, tamanho: fs.statSync(path.join(dir, 'editado.mp4')).size, largura: F.w || null, altura: F.h || null };
    banco.salvar();
  }

  /* ---------- trabalhos na fila ---------- */
  function emTrabalho(v) { return fila.tem((t) => t.videoId === v.id); }
  function enfileirar(v, tipo, quem) {
    const nomes = { analisar: 'Analisando', legendar: 'Gerando legendas', renderizar: 'Editando', preparar: 'Preparando para as redes' };
    return fila.adicionar({
      tipo, videoId: v.id, rotulo: `${nomes[tipo]}: ${v.titulo}`, quem,
      fazer: async (t) => {
        const antes = v.status;
        if (tipo !== 'analisar') mudar(v, { status: 'preparando' });
        try {
          if (tipo === 'analisar') await analisar(v, t);
          if (tipo === 'legendar') { const n = await legendar(v, t); historico(v, quem, `legendas geradas (${n} trechos)`); }
          if (tipo === 'renderizar') { await renderizar(v, t); historico(v, quem, `versão editada pronta (${FORMATOS[formatoDe(v)].nome})`); }
          if (tipo === 'preparar') {
            if (v.info?.temAudio && ferramentas.whisper && !v.versoes?.legenda) {
              t.rotulo = `Gerando legendas: ${v.titulo}`; await legendar(v, t); t.progresso = 0;
            }
            t.rotulo = `Editando: ${v.titulo}`; await renderizar(v, t);
            historico(v, quem, `preparado para as redes (${FORMATOS[formatoDe(v)].nome}${v.versoes?.legenda ? ', com legendas' : ''})`);
          }
          if (tipo !== 'analisar') mudar(v, { status: antes === 'aprovado' ? 'aprovado' : 'revisao' });
          ctx.aoTerminar?.(v, tipo, quem);
        } catch (e) {
          if (tipo !== 'analisar') mudar(v, { status: antes === 'preparando' ? 'novo' : antes });
          historico(v, quem, `falhou: ${e.message}`); banco.salvar();
          throw e;
        }
      },
    });
  }

  /* ---------- upload ---------- */
  async function receber(req, res, url) {
    const nome = String(url.searchParams.get('nome') || 'video.mp4').slice(0, 160);
    const ext = path.extname(nome).toLowerCase();
    if (!EXTENSOES.has(ext)) return json(res, 415, { ok: false, erro: 'formato não aceito; envie MP4, MOV, WEBM, MKV, M4V ou AVI' });
    const tamanho = Number(req.headers['content-length'] || 0);
    if (!tamanho) return json(res, 411, { ok: false, erro: 'tamanho do arquivo não informado' });
    if (tamanho > MAX_UPLOAD) return json(res, 413, { ok: false, erro: 'arquivo maior que 4 GB' });
    const v = { id: novoId('v'), titulo: path.basename(nome, ext).replace(/[_-]+/g, ' ').trim().slice(0, 90) || 'Vídeo sem nome', arquivo: nome, original: 'original' + ext, tamanho, tipo: url.searchParams.get('tipo') === 'reuniao' ? 'reuniao' : 'conteudo', criadoEm: new Date().toISOString(), status: 'novo', versoes: {}, historico: [] };
    const dir = pastaDe(v); fs.mkdirSync(dir, { recursive: true });
    const destino = path.join(dir, v.original + '.parcial');
    await new Promise((resolve) => {
      const out = fs.createWriteStream(destino); let recebidos = 0, falhou = false;
      const desistir = (status, erro) => { if (falhou) return; falhou = true; out.destroy(); fs.rm(dir, { recursive: true, force: true }, () => {}); json(res, status, { ok: false, erro }); resolve(); };
      req.on('data', (c) => { recebidos += c.length; if (recebidos > tamanho || recebidos > MAX_UPLOAD) { desistir(413, 'arquivo maior que o informado'); req.destroy(); } });
      req.on('aborted', () => desistir(400, 'envio interrompido'));
      req.pipe(out);
      out.on('finish', () => { if (falhou) return; if (recebidos !== tamanho) return desistir(400, 'envio incompleto'); resolve(); });
      out.on('error', (e) => desistir(500, 'não consegui gravar: ' + e.message));
    });
    if (res.headersSent) return;
    fs.renameSync(destino, path.join(dir, v.original));
    historico(v, 'você', 'enviou o vídeo');
    videos().unshift(v); banco.salvar();
    const t = enfileirar(v, 'analisar', 'Edição de Vídeo');
    ctx.atividade({ andar: 4, texto: `recebeu o vídeo “${v.titulo}” (${(tamanho / 1e6).toFixed(1)} MB)`, ref: v.id, real: true });
    /* quando a análise termina, os agentes decidem se já preparam (conforme a Central de Controle) */
    const esperar = setInterval(() => { if (t.estado === 'feito' || t.estado === 'erro' || t.estado === 'cancelado') { clearInterval(esperar); if (t.estado === 'feito') ctx.aoChegarVideo?.(v); } }, 500);
    json(res, 201, { ok: true, video: v });
  }

  function resumo(v) { return { ...v, emTrabalho: emTrabalho(v), formatoFinal: formatoDe(v) }; }

  /* ---------- rotas ---------- */
  async function rota(req, res, caminho, url) {
    if (!caminho.startsWith('/api/estudio/')) return false;
    if (req.method !== 'GET' && req.method !== 'HEAD' && !mesmaOrigem(req)) { json(res, 403, { ok: false, erro: 'origem não permitida' }); return true; }
    if (!ferramentas.ffmpeg && caminho !== '/api/estudio/estado') { json(res, 503, { ok: false, erro: 'o FFmpeg não foi encontrado (S:\\JarvisLocal\\ffmpeg)' }); return true; }

    if (caminho === '/api/estudio/estado' && req.method === 'GET') {
      const at = fila.atual;
      json(res, 200, {
        ok: true, videos: videos().map(resumo), formatos: Object.fromEntries(Object.entries(FORMATOS).map(([k, f]) => [k, f.nome])),
        fila: { atual: at && { tipo: at.tipo, rotulo: at.rotulo, progresso: at.progresso, videoId: at.videoId, quem: at.quem }, pendentes: fila.pendentes.map((t) => ({ tipo: t.tipo, rotulo: t.rotulo, videoId: t.videoId })) },
        ferramentas: { ffmpeg: !!ferramentas.ffmpeg, whisper: !!ferramentas.whisper }, pasta: PASTA,
      });
      return true;
    }
    if (caminho === '/api/estudio/enviar' && req.method === 'PUT') { await receber(req, res, url); return true; }

    let m = /^\/api\/estudio\/arquivo\/([a-z0-9]+)\/(original|editado|capa|legenda)$/.exec(caminho);
    if (m && (req.method === 'GET' || req.method === 'HEAD')) {
      const v = ID_VALIDO.test(m[1]) && achar(m[1]);
      const nome = v && (m[2] === 'original' ? v.original : v.versoes?.[m[2]]);
      if (!nome) { res.writeHead(404).end(); return true; }
      const arq = path.join(pastaDe(v), nome);
      if (!dentroDe(PASTA, arq)) { res.writeHead(403).end(); return true; }
      servirArquivo(req, res, arq);
      return true;
    }

    m = /^\/api\/estudio\/videos\/([a-z0-9]+)(?:\/(renderizar|legendar|preparar|legenda|avaliar|cancelar))?$/.exec(caminho);
    if (!m) { json(res, 404, { ok: false, erro: 'rota desconhecida' }); return true; }
    const v = ID_VALIDO.test(m[1]) && achar(m[1]);
    if (!v) { json(res, 404, { ok: false, erro: 'vídeo não encontrado' }); return true; }
    const acao = m[2];
    try {
      if (!acao && req.method === 'GET') { json(res, 200, { ok: true, video: resumo(v), legenda: v.versoes?.legenda ? lerSRT(fs.readFileSync(path.join(pastaDe(v), v.versoes.legenda), 'utf8')) : [] }); return true; }
      if (!acao && req.method === 'DELETE') {
        if (emTrabalho(v)) { json(res, 409, { ok: false, erro: 'o vídeo está sendo processado; cancele antes' }); return true; }
        const dir = pastaDe(v);
        if (dentroDe(PASTA, dir)) fs.rmSync(dir, { recursive: true, force: true });
        banco.d.videos = videos().filter((x) => x.id !== v.id);
        banco.d.publicacoes = (banco.d.publicacoes || []).filter((p) => p.videoId !== v.id || p.status === 'publicado');
        banco.salvar();
        ctx.atividade({ andar: 4, texto: `o vídeo “${v.titulo}” foi excluído por você`, real: true });
        json(res, 200, { ok: true }); return true;
      }
      if (req.method !== 'POST') { json(res, 405, { ok: false }); return true; }
      const corpo = await lerJSON(req, 400_000);
      if (!acao) {
        /* título, tipo e ajustes de edição */
        if (typeof corpo.titulo === 'string' && corpo.titulo.trim()) v.titulo = corpo.titulo.trim().slice(0, 90);
        if (corpo.edicao && typeof corpo.edicao === 'object') {
          const e = corpo.edicao, d = v.info?.duracao || 0, ed = v.edicao || {};
          if (Number.isFinite(+e.inicio)) ed.inicio = Math.max(0, Math.min(+e.inicio, d));
          if (Number.isFinite(+e.fim)) ed.fim = Math.max(0, Math.min(+e.fim, d));
          if (ed.fim - ed.inicio < 0.5) { ed.inicio = 0; ed.fim = d; }
          if (e.formato === 'auto' || FORMATOS[e.formato]) ed.formato = e.formato;
          if (typeof e.legendas === 'boolean') ed.legendas = e.legendas;
          if (typeof e.normalizarSom === 'boolean') ed.normalizarSom = e.normalizarSom;
          if (typeof e.textoTopo === 'string') ed.textoTopo = e.textoTopo.slice(0, 120);
          v.edicao = ed;
        }
        if (corpo.post && typeof corpo.post === 'object') {
          v.post = { legenda: String(corpo.post.legenda || '').slice(0, 2200), hashtags: String(corpo.post.hashtags || '').slice(0, 500), tituloYoutube: String(corpo.post.tituloYoutube || '').slice(0, 100) };
        }
        mudar(v, {}); json(res, 200, { ok: true, video: resumo(v) }); return true;
      }
      if (acao === 'cancelar') { fila.cancelar((t) => t.videoId === v.id); json(res, 200, { ok: true }); return true; }
      if (acao === 'legenda') {
        const lista = (Array.isArray(corpo.trechos) ? corpo.trechos : []).slice(0, 2000)
          .map((s) => ({ ini: Math.max(0, +s.ini || 0), fim: Math.max(0, +s.fim || 0), texto: String(s.texto || '').replace(/\s+/g, ' ').trim().slice(0, 200) }))
          .filter((s) => s.texto && s.fim > s.ini).sort((a, b) => a.ini - b.ini);
        fs.writeFileSync(path.join(pastaDe(v), 'legenda.srt'), escreverSRT(lista));
        v.versoes = { ...(v.versoes || {}), legenda: 'legenda.srt' }; v.transcricao = lista.map((s) => s.texto).join(' ');
        historico(v, 'você', 'corrigiu as legendas'); mudar(v, {});
        json(res, 200, { ok: true }); return true;
      }
      if (acao === 'avaliar') {
        const nota = Math.max(0, Math.min(5, Math.round(+corpo.nota || 0)));
        const decisao = ['aprovado', 'ajustes'].includes(corpo.decisao) ? corpo.decisao : null;
        if (decisao === 'aprovado' && !v.versoes?.editado) { json(res, 409, { ok: false, erro: 'gere a versão editada antes de aprovar: é ela que vai para as redes' }); return true; }
        v.avaliacao = { nota, comentario: String(corpo.comentario || '').slice(0, 1000), em: new Date().toISOString() };
        if (decisao) {
          mudar(v, { status: decisao });
          historico(v, 'você', decisao === 'aprovado' ? `aprovou (${nota} de 5)` : `pediu ajustes${v.avaliacao.comentario ? ': ' + v.avaliacao.comentario : ''}`);
          ctx.atividade({ andar: 4, texto: decisao === 'aprovado' ? `“${v.titulo}” foi aprovado por você (${nota} de 5)` : `“${v.titulo}” voltou para ajustes`, ref: v.id, real: true });
          if (decisao === 'aprovado') ctx.aoAprovar?.(v);
        } else mudar(v, {});
        json(res, 200, { ok: true, video: resumo(v) }); return true;
      }
      /* renderizar, legendar, preparar: pedidos seus, executam na hora (não dependem da Central de Controle) */
      if (emTrabalho(v)) { json(res, 409, { ok: false, erro: 'este vídeo já está sendo processado' }); return true; }
      if (!v.info) { json(res, 409, { ok: false, erro: 'o vídeo ainda está sendo analisado' }); return true; }
      if (acao === 'legendar' && !ferramentas.whisper) { json(res, 503, { ok: false, erro: 'o Whisper não está instalado' }); return true; }
      if (acao === 'legendar' && v.versoes?.legenda) { /* gerar de novo: descarta a anterior */ delete v.versoes.legenda; }
      enfileirar(v, acao, 'você');
      json(res, 202, { ok: true }); return true;
    } catch (e) {
      json(res, e.status || 500, { ok: false, erro: e.message }); return true;
    }
  }

  return { rota, enfileirar, achar, videos, emTrabalho, pastaDe, formatoDe, FORMATOS };
}
