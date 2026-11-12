/* ============================================================================
   PUBLICAÇÃO (publicacao.html)
   ----------------------------------------------------------------------------
   Conecta as contas (passo a passo de cada rede), agenda ou publica os vídeos
   aprovados no Estúdio e mostra a agenda e o histórico. Fala com
   servidor/redes.mjs. Senhas e tokens nunca chegam a esta página.
   ========================================================================== */
(function (root) {
  'use strict';
  var T = root.Torre, F = T.fmt, esc = T.esc;
  var $ = function (id) { return document.getElementById(id); };
  var est = null, abertas = {}, tEstado = null, preVideo = (/v=([a-z0-9]+)/.exec(root.location.hash) || [])[1] || '';
  var REDES = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn' };
  var HTTPS = 'https://localhost/atlas';
  /* passo a passo de cada rede (endereços oficiais, conferidos em nov/2026) */
  var CONTAS = {
    youtube: {
      nome: 'YouTube', redes: ['youtube'], cor: 'var(--a8)', automatico: true,
      faz: 'Vídeos e Shorts (vertical até 3 minutos). Até 100 envios por dia.',
      passos: ['Entre no <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">Google Cloud</a> com a conta do canal e crie um projeto.',
        'Ative a <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener">YouTube Data API v3</a>.',
        'Em “Tela de consentimento OAuth”, escolha “Externo” e adicione o seu e-mail em “Usuários de teste”.',
        'Em “Credenciais”, crie um “ID do cliente OAuth” do tipo <b>Aplicativo da Web</b> e cole em “URIs de redirecionamento autorizados” o endereço abaixo.',
        'Copie o ID do cliente e a chave secreta para cá e clique em Conectar.'],
      nota: 'Enquanto o app estiver “em teste” no Google, o acesso vence a cada 7 dias (é só conectar de novo). Publicar o app no Google acaba com isso.',
      rotulos: ['ID do cliente', 'Chave secreta do cliente']
    },
    tiktok: {
      nome: 'TikTok', redes: ['tiktok'], cor: 'var(--tinta-1)', padrao: HTTPS,
      faz: 'Postagem direta de vídeos. Até o app passar pela auditoria do TikTok, os vídeos saem como privados (só você vê).',
      passos: ['Entre em <a href="https://developers.tiktok.com/apps" target="_blank" rel="noopener">TikTok for Developers</a> e crie um app.',
        'Adicione os produtos <b>Login Kit</b> e <b>Content Posting API</b> (ligue o “Direct Post”) e os escopos user.info.basic, video.upload e video.publish.',
        'No Login Kit, cadastre o endereço de retorno abaixo.',
        'Copie o Client key e o Client secret para cá e clique em Conectar.',
        'Depois de autorizar, o navegador vai para https://localhost e mostra erro de página: <b>é normal</b>. Copie o endereço inteiro da barra e cole aqui.'],
      nota: 'Para publicar como público, peça a auditoria do app no portal do TikTok.',
      rotulos: ['Client key', 'Client secret']
    },
    meta: {
      nome: 'Facebook e Instagram', redes: ['facebook', 'instagram'], cor: 'var(--a1)', padrao: HTTPS, meta: true,
      faz: 'Reels no Instagram (até 100 por dia) e na sua Página do Facebook (até 30 por dia, de 3 a 90 segundos).',
      passos: ['O Instagram precisa ser uma conta <b>profissional</b> (Empresa ou Criador) ligada a uma Página do Facebook.',
        'Em <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">Meta for Developers</a>, crie um app do tipo Empresa e adicione o <b>Login do Facebook para Empresas</b> e o Instagram.',
        'Em “URIs de redirecionamento do OAuth válidos”, cadastre o endereço abaixo. Se criar uma “configuração” do Login para Empresas, copie o ID dela também.',
        'Copie o ID do app e a chave secreta para cá e clique em Conectar.',
        'Depois de autorizar, copie o endereço da barra do navegador (a página dá erro, é normal) e cole aqui.'],
      nota: 'Como o app é só para as suas contas, a Meta não exige análise do app (acesso padrão).',
      rotulos: ['ID do app', 'Chave secreta do app']
    },
    linkedin: {
      nome: 'LinkedIn', redes: ['linkedin'], cor: 'var(--a1)', padrao: HTTPS,
      faz: 'Posts com vídeo no seu perfil (até 500 MB, de 3 segundos a 30 minutos).',
      passos: ['Em <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener">LinkedIn Developers</a>, crie um app (ele pede uma Página de empresa no LinkedIn).',
        'Em “Products”, adicione <b>Sign In with LinkedIn using OpenID Connect</b> e <b>Share on LinkedIn</b>.',
        'Em “Auth”, cadastre o endereço abaixo em “Authorized redirect URLs”.',
        'Copie o Client ID e o Client Secret para cá e clique em Conectar.',
        'Depois de autorizar, copie o endereço da barra do navegador e cole aqui.'],
      nota: 'O acesso do LinkedIn vale 60 dias; depois é só conectar de novo.',
      rotulos: ['Client ID', 'Client Secret']
    }
  };

  function ico(d) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>'; }
  function quando(iso) { var d = new Date(iso); return (F.chaveDia(d) === F.chaveDia(new Date()) ? 'hoje' : F.dataMedia(d)) + ' ' + F.hora(d); }
  var tAviso = null;
  function aviso(t) { var el = $('aviso'); el.textContent = t; el.hidden = false; el.classList.add('on'); clearTimeout(tAviso); tAviso = setTimeout(function () { el.classList.remove('on'); setTimeout(function () { el.hidden = true; }, 300); }, 6000); }
  function api(caminho, corpo) {
    var op = corpo === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) };
    return root.fetch(caminho, op).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.ok === false) throw new Error(j.erro || 'o servidor respondeu ' + r.status); return j; }); });
  }

  /* ---------- contas ---------- */
  function desenharContas() {
    $('contas').innerHTML = Object.keys(CONTAS).map(function (k) {
      var c = CONTAS[k], s = est.contas[k], aberta = abertas[k];
      var status = s.conectada ? (s.precisaReconectar ? '<span class="selo critico"><i aria-hidden="true">▲</i>reconectar</span>' : '<span class="selo ok"><i aria-hidden="true">✓</i>conectado</span>') : '<span class="selo"><i aria-hidden="true">–</i>não conectado</span>';
      var redirect = s.redirectUri && s.redirectUri !== est.retornoPadrao ? s.redirectUri : (c.padrao || est.retornoPadrao);
      var h = '<article class="conta vidro" style="--cor:' + c.cor + '"><div class="conta-cab"><b>' + c.nome + '</b>' + status + '</div>' +
        (s.conectada ? '<p>' + esc(s.conta) + (s.expira ? ' · acesso até ' + esc(new Date(s.expira).toLocaleDateString('pt-BR')) : '') + '</p>' : '') +
        '<p class="redes-da-conta">' + esc(c.faz) + '</p>';
      if (c.meta && s.conectada && s.paginas && s.paginas.length > 1) {
        h += '<label class="campo">Página usada<select data-pagina>' + s.paginas.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === s.paginaId ? ' selected' : '') + '>' + esc(p.nome) + (p.ig ? ' · @' + esc(p.ig) : ' · sem Instagram') + '</option>'; }).join('') + '</select></label>';
      }
      h += '<div class="det-acoes">' + (s.conectada ? '<button class="bt bt-mini" type="button" data-conectar="' + k + '">Conectar de novo</button><button class="bt bt-mini" type="button" data-desconectar="' + k + '">Desconectar</button>'
        : '<button class="bt bt-mini bt-cor" type="button" data-abrir="' + k + '">' + (aberta ? 'Fechar o passo a passo' : 'Conectar') + '</button>') + '</div>';
      if (aberta || (s.conectada && abertas[k + ':colar'])) {
        h += '<ol class="passos">' + c.passos.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ol>' +
          '<div class="copiar"><code>' + esc(redirect) + '</code><button class="bt bt-mini" type="button" data-copiar="' + esc(redirect) + '">Copiar</button></div>' +
          '<form class="form-conta" data-conta="' + k + '"><label class="campo">' + c.rotulos[0] + '<input name="clientId" value="' + esc(s.clientId) + '" autocomplete="off" spellcheck="false"></label>' +
          '<label class="campo">' + c.rotulos[1] + '<input name="clientSecret" type="password" autocomplete="new-password" placeholder="' + (s.configurada ? 'já guardada · preencha só para trocar' : '') + '"></label>' +
          (c.meta ? '<label class="campo">ID da configuração do Login para Empresas (opcional)<input name="configId" value="' + esc(s.configId) + '" autocomplete="off"></label>' : '') +
          '<label class="campo">Endereço de retorno (o mesmo que você cadastrou)<input name="redirectUri" value="' + esc(redirect) + '" spellcheck="false"></label>' +
          '<div class="det-acoes"><button class="bt bt-cor" type="submit">Salvar e conectar</button></div></form>' +
          (redirect !== est.retornoPadrao ? '<form class="form-conta" data-colar="' + k + '"><label class="campo">Depois de autorizar, cole aqui o endereço da barra do navegador<input name="endereco" placeholder="https://localhost/atlas?code=…" spellcheck="false"></label><div class="det-acoes"><button class="bt bt-mini" type="submit">Concluir a conexão</button></div></form>' : '') +
          '<p class="det-nota">' + esc(c.nota) + '</p>';
      }
      return h + '</article>';
    }).join('');
  }

  /* ---------- novo post ---------- */
  function desenharNovo() {
    var f = $('fNovo'), vids = est.videos.filter(function (v) { return v.status === 'aprovado' || v.status === 'publicado' || v.status === 'revisao'; });
    if (document.activeElement && f.contains(document.activeElement)) return;   /* não apaga o que você está escrevendo */
    if (!vids.length) { f.innerHTML = '<div class="vazio-grande"><p>Nenhum vídeo pronto para publicar</p><small>No Estúdio, gere a versão editada e aprove o vídeo. <a href="estudio.html">Abrir o Estúdio</a></small></div>'; return; }
    var escolhido = f.video ? f.video.value : preVideo, v = vids.filter(function (x) { return x.id === escolhido; })[0] || vids[0];
    var agora = new Date(Date.now() + 3600e3); agora.setMinutes(0, 0, 0);
    var local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
    f.innerHTML = '<div class="det-acoes" style="flex-direction:column;align-items:stretch;gap:12px">' +
      '<label class="campo">Vídeo<select name="video">' + vids.map(function (x) { return '<option value="' + x.id + '"' + (x.id === v.id ? ' selected' : '') + '>' + esc(x.titulo) + (x.status === 'aprovado' ? '' : x.status === 'publicado' ? ' (já publicado)' : ' (ainda não aprovado)') + '</option>'; }).join('') + '</select></label>' +
      '<fieldset><legend class="campo">Redes</legend><div class="escolha-redes">' + Object.keys(REDES).map(function (r) {
        var ok = est.conectadas[r];
        return '<label class="' + (ok ? '' : 'off') + '" title="' + (ok ? '' : 'Conecte a conta primeiro') + '"><input type="checkbox" name="redes" value="' + r + '"' + (ok ? ' checked' : ' disabled') + '>' + REDES[r] + '</label>';
      }).join('') + '</div></fieldset>' +
      '<div class="quando"><label class="marcar"><input type="radio" name="quando" value="agora"> Publicar agora</label><label class="marcar"><input type="radio" name="quando" value="data" checked> Agendar para</label><input type="datetime-local" name="data" value="' + local + '" aria-label="Data e hora da publicação"></div>' +
      '<div class="quando"><label class="campo">YouTube<select name="ytPriv"><option value="public">Público</option><option value="unlisted">Não listado</option><option value="private">Privado</option></select></label>' +
      '<label class="campo">TikTok<select name="ttPriv"><option value="SELF_ONLY">Só eu (obrigatório até a auditoria)</option><option value="PUBLIC_TO_EVERYONE">Público</option><option value="FOLLOWER_OF_CREATOR">Seguidores</option><option value="MUTUAL_FOLLOW_FRIENDS">Amigos</option></select></label></div></div>' +
      '<div class="det-acoes" style="flex-direction:column;align-items:stretch;gap:12px"><label class="campo">Texto do post (legenda + hashtags)<textarea name="legenda" rows="7" maxlength="2200">' + esc(v.legenda) + '</textarea></label>' +
      '<small class="det-nota">' + (v.vertical ? 'Vertical' : 'Deitado') + (v.duracao ? ' · ' + Math.round(v.duracao) + ' s' : '') + ' · o texto vem do Estúdio (Marketing); o que mudar aqui vale só para esta publicação.</small>' +
      '<div class="det-acoes"><button class="bt bt-cor" type="submit">' + ico('M12 15V4M7.5 8.5 12 4l4.5 4.5M4 14v6h16v-6') + 'Confirmar</button></div></div>';
  }

  /* ---------- agenda ---------- */
  function desenharFila() {
    var ps = est.publicacoes;
    if (!ps.length) { $('fila').innerHTML = '<li class="vazio">Nada agendado ainda.</li>'; return; }
    var ST = { agendado: ['agendado', '◌', 'aviso'], aguardando: ['esperando sua aprovação', '●', 'aviso'], enviando: ['enviando', '◌', 'aviso'], publicado: ['publicado', '✓', 'ok'], erro: ['erro', '✕', 'critico'], cancelado: ['cancelado', '–', ''] };
    $('fila').innerHTML = ps.map(function (p) {
      var s = ST[p.status] || [p.status, '●', ''];
      var acoes = p.status === 'publicado' ? (p.link ? '<a href="' + esc(p.link) + '" target="_blank" rel="noopener">abrir</a>' : '') :
        p.status === 'enviando' ? '<span class="barra-prog"><i style="width:' + Math.round((p.progresso || 0) * 100) + '%"></i></span>' :
        p.status === 'cancelado' ? '' : '<span class="det-acoes"><button class="bt bt-mini" type="button" data-pub="' + p.id + '" data-op="' + (p.status === 'erro' ? 'tentar' : 'agora') + '">' + (p.status === 'erro' ? 'Tentar de novo' : 'Publicar agora') + '</button>' + (p.status !== 'erro' ? '<button class="bt bt-mini" type="button" data-pub="' + p.id + '" data-op="cancelar">Cancelar</button>' : '') + '</span>';
      return '<li><time>' + esc(quando(p.status === 'publicado' && p.publicadoEm ? p.publicadoEm : p.quando)) + '</time><b>' + REDES[p.rede] + '</b><span class="fp-titulo">' + esc(p.titulo) + ' <small class="det-nota">· ' + esc(p.por || '') + '</small></span>' +
        '<span class="selo ' + s[2] + '"><i aria-hidden="true">' + s[1] + '</i>' + s[0] + '</span>' + (acoes || '<span></span>') +
        (p.erro ? '<p class="fp-erro">' + esc(p.erro) + '</p>' : p.aviso ? '<p class="fp-erro" style="color:var(--tinta-3)">' + esc(p.aviso) + '</p>' : '') + '</li>';
    }).join('');
  }

  function carregar() {
    return api('/api/redes').then(function (j) {
      est = j;
      var modo = { automatico: ['Publicação automática ligada', 'ok', '✓'], pedir: ['os agentes pedem sua aprovação antes de publicar', 'aviso', '●'], desligado: ['Publicação desligada na Central de Controle: só sai o que você mandar', 'critico', '–'] }[j.modoPublicacao];
      $('modoPub').innerHTML = '<span class="selo ' + modo[1] + '"><i aria-hidden="true">' + modo[2] + '</i>' + modo[0] + '</span> <a class="bt bt-mini" href="index.html?semintro&controle">Central de Controle</a>';
      var n = Object.keys(j.conectadas).filter(function (k) { return j.conectadas[k]; }).length;
      $('pgEstado').textContent = n + ' de 5 redes conectadas · horários: ' + (j.horarios.join(', ') || '—');
      var formAberto = document.activeElement && document.activeElement.closest && document.activeElement.closest('.form-conta');
      if (!formAberto) desenharContas();
      desenharNovo(); desenharFila();
      clearTimeout(tEstado);
      tEstado = setTimeout(carregar, j.publicacoes.some(function (p) { return p.status === 'enviando'; }) ? 1500 : 8000);
    }).catch(function (e) {
      $('contas').innerHTML = '<p class="alerta aviso"><i aria-hidden="true">▲</i><span>' + (root.location.protocol === 'file:' ? 'Abra pela torre (iniciar.bat → http://localhost:5173/publicacao.html).' : esc(e.message)) + '</span></p>';
      clearTimeout(tEstado); tEstado = setTimeout(carregar, 8000);
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-abrir],[data-conectar],[data-desconectar],[data-copiar],[data-pub]');
    if (!t) return;
    if (t.hasAttribute('data-abrir')) { var k = t.getAttribute('data-abrir'); abertas[k] = !abertas[k]; desenharContas(); return; }
    if (t.hasAttribute('data-conectar')) { abertas[t.getAttribute('data-conectar')] = true; abertas[t.getAttribute('data-conectar') + ':colar'] = true; desenharContas(); return; }
    if (t.hasAttribute('data-copiar')) { root.navigator.clipboard.writeText(t.getAttribute('data-copiar')).then(function () { aviso('Endereço copiado.'); }); return; }
    if (t.hasAttribute('data-desconectar')) {
      var c = t.getAttribute('data-desconectar');
      if (!root.confirm('Desconectar ' + CONTAS[c].nome + '? As publicações agendadas nessa rede vão dar erro até você conectar de novo.')) return;
      api('/api/redes/' + c + '/desconectar', {}).then(carregar).catch(function (er) { aviso(er.message); }); return;
    }
    if (t.hasAttribute('data-pub')) { t.disabled = true; api('/api/publicacoes/' + t.getAttribute('data-pub') + '/' + t.getAttribute('data-op'), {}).then(carregar).catch(function (er) { t.disabled = false; aviso(er.message); }); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.matches('select[data-pagina]')) api('/api/redes/meta/pagina', { id: e.target.value }).then(function () { aviso('Página escolhida.'); carregar(); }).catch(function (er) { aviso(er.message); });
    if (e.target.name === 'video' && e.target.closest('#fNovo')) { preVideo = e.target.value; e.target.blur(); desenharNovo(); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.matches('[data-conta]')) {
      e.preventDefault();
      var k = f.getAttribute('data-conta'), d = new root.FormData(f);
      var corpo = { clientId: d.get('clientId'), clientSecret: d.get('clientSecret') || '', redirectUri: d.get('redirectUri') };
      if (d.has('configId')) corpo.configId = d.get('configId');
      api('/api/redes/' + k + '/config', corpo).then(function () { return api('/api/redes/' + k + '/autorizar', {}); }).then(function (j) {
        root.open(j.url, '_blank', 'noopener');
        aviso(j.automatico ? 'Autorize na aba que abriu; a conexão termina sozinha.' : 'Autorize na aba que abriu e depois cole aqui o endereço para onde ela foi.');
        f.querySelector('[name=clientSecret]').value = '';
      }).catch(function (er) { aviso(er.message); });
    }
    if (f.matches('[data-colar]')) {
      e.preventDefault();
      var conta = f.getAttribute('data-colar');
      api('/api/redes/' + conta + '/codigo', { endereco: f.endereco.value }).then(function (j) { aviso('Conectado: ' + j.conta); abertas[conta] = false; abertas[conta + ':colar'] = false; document.activeElement.blur(); carregar(); }).catch(function (er) { aviso(er.message); });
    }
    if (f.id === 'fNovo') {
      e.preventDefault();
      var q = new root.FormData(f), redes = q.getAll('redes');
      if (!redes.length) return aviso('Escolha ao menos uma rede conectada.');
      var agora = q.get('quando') === 'agora', quandoIso = agora ? null : new Date(q.get('data')).toISOString();
      if (!agora && new Date(quandoIso) < new Date()) return aviso('Escolha um horário no futuro ou “Publicar agora”.');
      api('/api/publicacoes', { videoId: q.get('video'), redes: redes, quando: quandoIso, legenda: q.get('legenda'), opcoes: { privacidadeYoutube: q.get('ytPriv'), privacidadeTiktok: q.get('ttPriv') } })
        .then(function () { aviso(agora ? 'Publicando…' : 'Agendado.'); document.activeElement.blur(); carregar(); }).catch(function (er) { aviso(er.message); });
    }
  });
  carregar();
})(window);
