/* ============================================================================
   ESTÚDIO DE VÍDEO (estudio.html)
   ----------------------------------------------------------------------------
   Você envia os vídeos que grava; os agentes de Edição de Vídeo geram as
   legendas e a versão para as redes; você ajusta, avalia e aprova. O que for
   aprovado vai para a página Publicação. Fala com servidor/estudio.mjs.
   ========================================================================== */
(function (root) {
  'use strict';
  var T = root.Torre, F = T.fmt, esc = T.esc;
  var $ = function (id) { return document.getElementById(id); };
  var est = null, sel = null, filtro = 'todos', legenda = null, pubs = [], assinatura = '', tEstado = null, verOriginal = false;
  var STATUS = {
    novo: ['Novo', '●', ''], preparando: ['Sendo preparado', '◌', 'aviso'], revisao: ['Para avaliar', '●', 'aviso'],
    aprovado: ['Aprovado', '✓', 'ok'], ajustes: ['Ajustes pedidos', '▲', 'critico'], publicado: ['Publicado', '✓', 'ok']
  };
  var FILTROS = [['todos', 'Todos'], ['revisao', 'Para avaliar'], ['aprovado', 'Aprovados'], ['publicado', 'Publicados'], ['ajustes', 'Ajustes'], ['reuniao', 'Reuniões']];
  var REDES = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn' };

  function ico(d) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>'; }
  function selo(s) { var x = STATUS[s] || [s, '●', '']; return '<span class="selo ' + x[2] + '"><i aria-hidden="true">' + x[1] + '</i>' + x[0] + '</span>'; }
  function mmss(s) { s = Math.max(0, +s || 0); var m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1).replace('.', ','); }
  function mb(b) { return (b / 1e6).toFixed(b < 1e8 ? 1 : 0).replace('.', ',') + ' MB'; }
  function quando(iso) { var d = new Date(iso); return (F.chaveDia(d) === F.chaveDia(new Date()) ? 'hoje' : F.dataMedia(d)) + ' às ' + F.hora(d); }
  var tAviso = null;
  function aviso(t) { var el = $('aviso'); el.textContent = t; el.hidden = false; el.classList.add('on'); clearTimeout(tAviso); tAviso = setTimeout(function () { el.classList.remove('on'); setTimeout(function () { el.hidden = true; }, 300); }, 5000); }
  function api(caminho, corpo, metodo) {
    var op = corpo === undefined && !metodo ? {} : { method: metodo || 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo === undefined ? undefined : JSON.stringify(corpo) };
    return root.fetch(caminho, op).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.ok === false) throw new Error(j.erro || 'o servidor respondeu ' + r.status); return j; }); });
  }
  var video = function (id) { return est && est.videos.filter(function (v) { return v.id === id; })[0]; };
  var arq = function (v, tipo) { return '/api/estudio/arquivo/' + v.id + '/' + tipo + '?t=' + encodeURIComponent((v.render && v.render.em) || v.atualizadoEm || ''); };

  /* ---------- estado do servidor ---------- */
  function carregar() {
    return api('/api/estudio/estado').then(function (j) {
      est = j;
      var f = j.fila.atual;
      $('pgEstado').textContent = f ? (f.quem || 'Agentes') + ' · ' + f.rotulo + ' · ' + Math.round((f.progresso || 0) * 100) + '%' : (j.ferramentas.ffmpeg ? 'pronto · ' + j.videos.length + ' vídeos' : 'FFmpeg não encontrado');
      desenharFiltros(); desenharLista();
      if (sel && !video(sel)) sel = null;
      var v = sel && video(sel), ass = v ? JSON.stringify([v.status, v.emTrabalho, Object.keys(v.versoes || {}), v.render && v.render.em, v.post && v.post.em, v.avaliacao && v.avaliacao.em, v.ata && v.ata.em, (v.historico || []).length]) : '';
      if (ass !== assinatura) {
        var editando = document.activeElement && document.activeElement.closest && document.activeElement.closest('#detalhe input, #detalhe textarea');
        if (!editando) { assinatura = ass; desenharDetalhe(); }
      }
      atualizarProgresso();
      clearTimeout(tEstado);
      tEstado = setTimeout(carregar, f || j.fila.pendentes.length ? 1500 : 6000);
    }).catch(function (e) {
      $('pgEstado').textContent = 'sem conexão com a torre';
      $('lista').innerHTML = '<li class="alerta aviso"><i aria-hidden="true">▲</i><span>' + (root.location.protocol === 'file:' ? 'Abra o Estúdio pela torre (iniciar.bat → http://localhost:5173/estudio.html).' : esc(e.message)) + '</span></li>';
      clearTimeout(tEstado); tEstado = setTimeout(carregar, 8000);
    });
  }
  function carregarPubs() { return api('/api/redes').then(function (j) { pubs = j.publicacoes || []; }).catch(function () { pubs = []; }); }

  /* ---------- lista ---------- */
  function passa(v) { return filtro === 'todos' ? true : filtro === 'reuniao' ? v.tipo === 'reuniao' : v.status === filtro && v.tipo !== 'reuniao'; }
  function desenharFiltros() {
    $('filtros').innerHTML = FILTROS.map(function (f) {
      var n = est.videos.filter(function (v) { var a = filtro; filtro = f[0]; var r = passa(v); filtro = a; return r; }).length;
      return '<button type="button" role="tab" aria-selected="' + (filtro === f[0]) + '" data-filtro="' + f[0] + '">' + f[1] + ' <small>' + n + '</small></button>';
    }).join('');
  }
  function desenharLista() {
    var vs = est.videos.filter(passa);
    if (!vs.length) { $('lista').innerHTML = '<li class="vazio">' + (est.videos.length ? 'Nenhum vídeo neste filtro.' : 'Nenhum vídeo ainda. Envie o primeiro acima.') + '</li>'; return; }
    $('lista').innerHTML = vs.map(function (v) {
      var trab = est.fila.atual && est.fila.atual.videoId === v.id ? est.fila.atual : null;
      return '<li><button type="button" class="item-video' + (v.id === sel ? ' ativo' : '') + '" data-video="' + v.id + '">' +
        '<span class="capa">' + (v.versoes && v.versoes.capa ? '<img src="' + arq(v, 'capa') + '" alt="" loading="lazy">' : ico('M3 6.5h12.5v11H3zM15.5 10.5 21 7.5v9l-5.5-3')) + (v.info ? '<small>' + mmss(v.info.duracao).replace(/,\d$/, '') + '</small>' : '') + '</span>' +
        '<span class="iv-txt"><b>' + esc(v.titulo) + '</b><span>' + (v.tipo === 'reuniao' ? '<span class="tag">reunião</span> ' : '') + selo(v.status) + '</span>' +
        (trab ? '<span class="barra-prog" data-prog="' + v.id + '"><i style="width:' + Math.round((trab.progresso || 0) * 100) + '%"></i></span>' : '<small>' + esc(quando(v.criadoEm)) + '</small>') + '</span></button></li>';
    }).join('');
  }
  function atualizarProgresso() {
    var f = est.fila.atual; if (!f) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-prog="' + f.videoId + '"] i'), function (i) { i.style.width = Math.round((f.progresso || 0) * 100) + '%'; });
    var r = $('trabRotulo'); if (r && sel === f.videoId) r.textContent = (f.quem || 'Agentes') + ' · ' + f.rotulo + ' · ' + Math.round((f.progresso || 0) * 100) + '%';
  }

  /* ---------- detalhe ---------- */
  function desenharDetalhe() {
    var v = sel && video(sel), el = $('detalhe');
    if (!v) { el.innerHTML = '<div class="vazio-grande"><p>Escolha um vídeo da lista</p><small>Ou envie um vídeo: os agentes de Edição de Vídeo geram as legendas e a versão para as redes (se a Central de Controle deixar), e você avalia aqui.</small></div>'; return; }
    var e = v.edicao || {}, info = v.info, temEd = v.versoes && v.versoes.editado, reuniao = v.tipo === 'reuniao';
    var mostra = temEd && !verOriginal ? 'editado' : 'original';
    var vertical = mostra === 'editado' ? v.render && v.render.altura > v.render.largura : info && info.altura > info.largura;
    var trab = est.fila.atual && est.fila.atual.videoId === v.id ? est.fila.atual : null;
    var naFila = est.fila.pendentes.some(function (t) { return t.videoId === v.id; });
    var minhas = pubs.filter(function (p) { return p.videoId === v.id; });
    var h = '';
    h += '<header class="det-cab"><input class="det-titulo" id="tTitulo" value="' + esc(v.titulo) + '" maxlength="90" aria-label="Título do vídeo">' + selo(v.status) +
      '<button class="bt-icone" type="button" data-acao="excluir" aria-label="Excluir este vídeo" title="Excluir">' + ico('M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13') + '</button></header>';
    h += '<p class="det-info">' + (info ? info.largura + '×' + info.altura + ' · ' + mmss(info.duracao) + ' · ' + mb(v.tamanho) + (info.temAudio ? '' : ' · sem som') : 'analisando…') + ' · enviado ' + esc(quando(v.criadoEm)) + '</p>';
    if (trab || naFila) h += '<div class="det-trab"><p id="trabRotulo">' + (trab ? esc((trab.quem || 'Agentes') + ' · ' + trab.rotulo + ' · ' + Math.round((trab.progresso || 0) * 100) + '%') : 'Na fila dos agentes…') + '</p>' + (trab ? '<div class="barra-prog" data-prog="' + v.id + '"><i style="width:' + Math.round((trab.progresso || 0) * 100) + '%"></i></div>' : '') +
      '<button class="bt bt-mini" type="button" data-acao="cancelar">Cancelar</button></div>';
    /* player */
    h += '<div class="det-player' + (vertical ? ' vertical' : '') + '">' + (temEd ? '<div class="seg-mini" role="tablist"><button type="button" role="tab" aria-selected="' + (mostra === 'editado') + '" data-ver="editado">Editado (para as redes)</button><button type="button" role="tab" aria-selected="' + (mostra === 'original') + '" data-ver="original">Original</button></div>' : '') +
      /* proporção fixa: sem ela o navegador usa a da capa (do original) até o vídeo começar */
      (info ? '<video id="player" controls preload="metadata" playsinline src="' + arq(v, mostra) + '" style="aspect-ratio:' + (mostra === 'editado' && v.render && v.render.largura ? v.render.largura + '/' + v.render.altura : info.largura + '/' + info.altura) + '"' +
        (mostra === 'original' && v.versoes && v.versoes.capa ? ' poster="' + arq(v, 'capa') + '"' : '') + '></video>' : '<div class="vazio">Analisando o vídeo…</div>') +
      (v.render && mostra === 'editado' ? '<p class="det-nota">' + esc(est.formatos[v.render.formato] || v.render.formato) + ' · ' + mmss(v.render.duracao) + ' · ' + mb(v.render.tamanho) + ' · MP4 aceito por YouTube, TikTok, Instagram, Facebook e LinkedIn</p>' : '') + '</div>';

    if (info) {
      /* edição */
      var formatos = [['auto', 'Automático', 'Vertical se o vídeo for deitado; senão mantém'], ['vertical', '9:16 com fundo', 'Shorts, Reels e TikTok, sem cortar nada'], ['vertical-corte', '9:16 cortado', 'Preenche a tela cortando as laterais'], ['quadrado', 'Quadrado 1:1', 'Feed do Instagram e Facebook'], ['original', 'Original', 'Mantém o formato gravado']];
      h += '<section class="det-sec"><h2>Edição</h2><form id="fEdicao" class="edicao">' +
        '<fieldset><legend>Corte</legend><div class="corte"><label>Início<input type="number" name="inicio" step="0.1" min="0" max="' + info.duracao + '" value="' + (+e.inicio || 0).toFixed(1) + '"></label><button class="bt bt-mini" type="button" data-marcar="inicio">Marcar início no ponto atual</button>' +
        '<label>Fim<input type="number" name="fim" step="0.1" min="0" max="' + info.duracao + '" value="' + (+e.fim || info.duracao).toFixed(1) + '"></label><button class="bt bt-mini" type="button" data-marcar="fim">Marcar fim no ponto atual</button></div>' +
        '<div class="corte-barra" aria-hidden="true"><i style="left:' + (100 * (+e.inicio || 0) / info.duracao) + '%;right:' + (100 - 100 * (+e.fim || info.duracao) / info.duracao) + '%"></i></div><small>Em segundos. Para marcar no ponto atual, assista no "Original".</small></fieldset>' +
        '<fieldset><legend>Formato</legend><div class="formatos">' + formatos.map(function (f) { return '<label class="formato"><input type="radio" name="formato" value="' + f[0] + '"' + ((e.formato || 'auto') === f[0] ? ' checked' : '') + '><b>' + f[1] + '</b><small>' + f[2] + '</small></label>'; }).join('') + '</div></fieldset>' +
        '<fieldset><legend>Texto e som</legend><label class="campo">Título em cima do vídeo (opcional)<input name="textoTopo" maxlength="120" value="' + esc(e.textoTopo || '') + '" placeholder="Ex.: 3 sinais de que seu site está perdendo clientes"></label>' +
        '<label class="marcar"><input type="checkbox" name="legendas"' + (e.legendas !== false ? ' checked' : '') + '> Legendas na imagem' + (v.versoes && v.versoes.legenda ? '' : ' <small>(gere as legendas abaixo)</small>') + '</label>' +
        '<label class="marcar"><input type="checkbox" name="normalizarSom"' + (e.normalizarSom !== false ? ' checked' : '') + '> Equalizar o volume (o padrão das redes, −14 LUFS)</label></fieldset>' +
        '<div class="det-acoes"><button class="bt bt-cor" type="submit"' + (trab || naFila ? ' disabled' : '') + '>' + ico('M5 12l5 5 9-10') + (temEd ? 'Salvar e gerar de novo' : 'Salvar e gerar a versão editada') + '</button></div></form></section>';
      /* legendas */
      h += '<section class="det-sec"><h2>' + (reuniao ? 'Transcrição' : 'Legendas') + '</h2>' + (v.info.temAudio ? (est.ferramentas.whisper ? '' : '<p class="alerta aviso"><i aria-hidden="true">▲</i><span>O Whisper não foi encontrado em S:\\JarvisLocal\\whisper.</span></p>') +
        (v.versoes && v.versoes.legenda ? '<div id="legendas" class="legendas"><p class="vazio">Carregando…</p></div><div class="det-acoes"><button class="bt bt-mini" type="button" data-acao="salvarLegendas">Salvar correções</button><button class="bt bt-mini" type="button" data-acao="legendar"' + (trab || naFila ? ' disabled' : '') + '>Gerar de novo com o Whisper</button></div>'
          : '<p class="vazio">Ainda sem ' + (reuniao ? 'transcrição' : 'legendas') + '.</p><div class="det-acoes"><button class="bt bt-mini bt-cor" type="button" data-acao="legendar"' + (trab || naFila || !est.ferramentas.whisper ? ' disabled' : '') + '>' + (reuniao ? 'Transcrever com o Whisper' : 'Gerar legendas com o Whisper') + '</button></div>')
        : '<p class="vazio">O vídeo não tem som.</p>') + '</section>';
    }
    if (reuniao) {
      h += '<section class="det-sec"><h2>Ata da reunião</h2>' + (v.ata ? '<p class="det-nota">Escrita por ' + esc(v.ata.autor) + ' (Reuniões) · ' + esc(quando(v.ata.em)) + '</p><div class="ata">' + esc(v.ata.texto).replace(/\n/g, '<br>') + '</div>' : '<p class="vazio">O departamento de Reuniões escreve a ata depois da transcrição (Central de Controle).</p>') + '</section>';
    } else if (info) {
      /* texto do post */
      var p = v.post || {};
      h += '<section class="det-sec"><h2>Texto do post</h2>' + (p.autor ? '<p class="det-nota">Escrito por ' + esc(p.autor) + ' (Marketing)' + (p.semIA ? ' com um modelo pronto (sem IA)' : '') + ' · revise antes de aprovar</p>' : '<p class="det-nota">O Marketing escreve depois que a versão editada fica pronta. Você também pode escrever.</p>') +
        '<form id="fPost" class="post-form"><label class="campo">Legenda<textarea name="legenda" rows="4" maxlength="2200">' + esc(p.legenda || '') + '</textarea></label>' +
        '<label class="campo">Hashtags<input name="hashtags" maxlength="500" value="' + esc(p.hashtags || '') + '" placeholder="#site #negociolocal"></label>' +
        '<label class="campo">Título no YouTube<input name="tituloYoutube" maxlength="100" value="' + esc(p.tituloYoutube || '') + '" placeholder="' + esc(v.titulo) + '"></label>' +
        '<div class="det-acoes"><button class="bt bt-mini" type="submit">Salvar texto</button></div></form></section>';
      /* avaliação */
      var a = v.avaliacao || {};
      h += '<section class="det-sec avaliar"><h2>Sua avaliação</h2><form id="fAvaliar"><fieldset class="estrelas"><legend>Nota</legend>' + [1, 2, 3, 4, 5].map(function (n) { return '<label title="' + n + ' de 5"><input type="radio" name="nota" value="' + n + '"' + (a.nota === n ? ' checked' : '') + '><span aria-hidden="true">★</span><b class="sr">' + n + ' de 5</b></label>'; }).join('') + '</fieldset>' +
        '<label class="campo">Comentário (o que mudar, se for o caso)<textarea name="comentario" rows="2" maxlength="1000">' + esc(a.comentario || '') + '</textarea></label>' +
        '<div class="det-acoes"><button class="bt bt-cor" type="submit" name="decisao" value="aprovado"' + (temEd ? '' : ' disabled title="Gere a versão editada antes"') + '>' + ico('M5 12l5 5 9-10') + 'Aprovar para publicar</button><button class="bt" type="submit" name="decisao" value="ajustes">Pedir ajustes</button><button class="bt bt-mini" type="submit" name="decisao" value="">Só salvar a nota</button></div>' +
        (temEd ? '' : '<small>Para aprovar, gere a versão editada: é ela que vai para as redes.</small>') + '</form></section>';
      /* publicações */
      h += '<section class="det-sec"><h2>Nas redes</h2>' + (minhas.length ? '<ul class="det-pubs">' + minhas.map(function (q) {
        var st = { agendado: ['Agendado para ' + quando(q.quando), '◌', 'aviso'], aguardando: ['Esperando sua aprovação', '●', 'aviso'], enviando: ['Enviando ' + Math.round((q.progresso || 0) * 100) + '%', '◌', 'aviso'], publicado: ['Publicado ' + quando(q.publicadoEm), '✓', 'ok'], erro: ['Erro: ' + (q.erro || ''), '✕', 'critico'], cancelado: ['Cancelado', '–', ''] }[q.status] || [q.status, '●', ''];
        return '<li><b>' + REDES[q.rede] + '</b><span class="selo ' + st[2] + '"><i aria-hidden="true">' + st[1] + '</i>' + esc(st[0]) + '</span>' + (q.link ? '<a href="' + esc(q.link) + '" target="_blank" rel="noopener">abrir</a>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="vazio">Ainda não foi agendado em nenhuma rede.</p>') +
        '<div class="det-acoes"><a class="bt bt-mini" href="publicacao.html#v=' + v.id + '">' + ico('M12 15V4M7.5 8.5 12 4l4.5 4.5M4 14v6h16v-6') + 'Agendar ou publicar na página Publicação</a></div></section>';
    }
    /* histórico */
    h += '<section class="det-sec"><h2>Histórico</h2><ol class="historico">' + (v.historico || []).slice().reverse().map(function (x) { return '<li><time>' + esc(quando(x.em)) + '</time><b>' + esc(x.quem) + '</b> ' + esc(x.oque) + '</li>'; }).join('') + '</ol></section>';
    el.innerHTML = h;
    if (v.versoes && v.versoes.legenda) carregarLegendas(v);
  }
  function carregarLegendas(v) {
    api('/api/estudio/videos/' + v.id).then(function (j) {
      legenda = j.legenda || [];
      var el = $('legendas'); if (!el) return;
      el.innerHTML = legenda.length ? legenda.map(function (s, i) { return '<div class="leg-linha"><button type="button" class="leg-tempo" data-pular="' + s.ini + '" title="Ouvir este trecho">' + mmss(s.ini) + '</button><input data-leg="' + i + '" value="' + esc(s.texto) + '" maxlength="200" aria-label="Trecho ' + (i + 1) + '"></div>'; }).join('') : '<p class="vazio">O Whisper não encontrou fala.</p>';
    }).catch(function () {});
  }

  /* ---------- envio (upload) ---------- */
  function enviar(arquivos) {
    Array.prototype.forEach.call(arquivos, function (f) {
      var li = document.createElement('li'); li.innerHTML = '<span>' + esc(f.name) + '</span><div class="barra-prog"><i style="width:0"></i></div><small>enviando…</small>';
      $('envios').appendChild(li);
      var x = new root.XMLHttpRequest();
      x.open('PUT', '/api/estudio/enviar?nome=' + encodeURIComponent(f.name) + '&tipo=' + ($('ehReuniao').checked ? 'reuniao' : 'conteudo'));
      x.setRequestHeader('Content-Type', f.type || 'application/octet-stream');
      x.upload.onprogress = function (e) { if (e.lengthComputable) { li.querySelector('i').style.width = Math.round(100 * e.loaded / e.total) + '%'; li.querySelector('small').textContent = Math.round(100 * e.loaded / e.total) + '% de ' + mb(e.total); } };
      x.onload = function () {
        var j = {}; try { j = JSON.parse(x.responseText); } catch (e) { /* resposta vazia */ }
        if (x.status === 201) { li.querySelector('small').textContent = 'enviado ✓'; sel = j.video.id; assinatura = ''; root.location.hash = 'v=' + sel; carregar(); setTimeout(function () { li.remove(); }, 4000); }
        else { li.classList.add('erro'); li.querySelector('small').textContent = j.erro || 'falhou (' + x.status + ')'; }
      };
      x.onerror = function () { li.classList.add('erro'); li.querySelector('small').textContent = 'sem conexão com a torre'; };
      x.send(f);
    });
  }

  /* ---------- eventos ---------- */
  function montar() {
    var sol = $('soltar');
    $('arquivos').addEventListener('change', function () { if (this.files.length) enviar(this.files); this.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { sol.addEventListener(ev, function (e) { e.preventDefault(); sol.classList.add('sobre'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { sol.addEventListener(ev, function (e) { e.preventDefault(); sol.classList.remove('sobre'); }); });
    sol.addEventListener('drop', function (e) { if (e.dataTransfer.files.length) enviar(e.dataTransfer.files); });
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-video],[data-filtro],[data-acao],[data-ver],[data-marcar],[data-pular]');
      if (!t) return;
      if (t.hasAttribute('data-video')) { sel = t.getAttribute('data-video'); verOriginal = false; assinatura = ''; root.location.hash = 'v=' + sel; desenharLista(); carregarPubs().then(function () { assinatura = ''; carregar(); }); $('detalhe').scrollIntoView({ block: 'start' }); return; }
      if (t.hasAttribute('data-filtro')) { filtro = t.getAttribute('data-filtro'); desenharFiltros(); desenharLista(); return; }
      if (t.hasAttribute('data-ver')) { verOriginal = t.getAttribute('data-ver') === 'original'; desenharDetalhe(); return; }
      var pl = $('player');
      if (t.hasAttribute('data-marcar')) { if (!pl) return; var campo = document.querySelector('#fEdicao [name=' + t.getAttribute('data-marcar') + ']'); campo.value = pl.currentTime.toFixed(1); if (verOriginal === false && sel && video(sel).versoes.editado) aviso('Atenção: o player está no “Editado”. Para marcar o corte, assista no “Original”.'); return; }
      if (t.hasAttribute('data-pular')) { if (pl) { pl.currentTime = +t.getAttribute('data-pular'); pl.play(); } return; }
      var v = video(sel); if (!v) return;
      var a = t.getAttribute('data-acao');
      if (a === 'excluir') {
        if (!root.confirm('Excluir “' + v.titulo + '”? O vídeo original e as versões editadas serão apagados do computador. Publicações já feitas continuam nas redes.')) return;
        api('/api/estudio/videos/' + v.id, undefined, 'DELETE').then(function () { sel = null; root.location.hash = ''; assinatura = 'x'; carregar(); aviso('Vídeo excluído.'); }).catch(function (er) { aviso(er.message); });
      }
      if (a === 'cancelar') api('/api/estudio/videos/' + v.id + '/cancelar', {}).then(carregar).catch(function (er) { aviso(er.message); });
      if (a === 'legendar') api('/api/estudio/videos/' + v.id + '/legendar', {}).then(function () { aviso('O Whisper está ouvindo o vídeo…'); assinatura = ''; carregar(); }).catch(function (er) { aviso(er.message); });
      if (a === 'salvarLegendas') {
        var trechos = (legenda || []).map(function (s, i) { var inp = document.querySelector('[data-leg="' + i + '"]'); return { ini: s.ini, fim: s.fim, texto: inp ? inp.value : s.texto }; });
        api('/api/estudio/videos/' + v.id + '/legenda', { trechos: trechos }).then(function () { aviso('Legendas salvas. Gere a versão editada de novo para elas entrarem no vídeo.'); }).catch(function (er) { aviso(er.message); });
      }
    });
    document.addEventListener('submit', function (e) {
      var f = e.target, v = video(sel); if (!v) return;
      e.preventDefault();
      if (f.id === 'fEdicao') {
        var d = new root.FormData(f);
        var edicao = { inicio: +d.get('inicio'), fim: +d.get('fim'), formato: d.get('formato'), textoTopo: d.get('textoTopo') || '', legendas: !!d.get('legendas'), normalizarSom: !!d.get('normalizarSom') };
        api('/api/estudio/videos/' + v.id, { titulo: $('tTitulo').value, edicao: edicao })
          .then(function () { return api('/api/estudio/videos/' + v.id + '/renderizar', {}); })
          .then(function () { aviso('Gerando a versão editada…'); assinatura = ''; carregar(); }).catch(function (er) { aviso(er.message); });
      }
      if (f.id === 'fPost') {
        var p = new root.FormData(f);
        api('/api/estudio/videos/' + v.id, { titulo: $('tTitulo').value, post: { legenda: p.get('legenda'), hashtags: p.get('hashtags'), tituloYoutube: p.get('tituloYoutube') } }).then(function () { aviso('Texto do post salvo.'); assinatura = ''; carregar(); }).catch(function (er) { aviso(er.message); });
      }
      if (f.id === 'fAvaliar') {
        var q = new root.FormData(f), decisao = e.submitter ? e.submitter.value : '';
        api('/api/estudio/videos/' + v.id + '/avaliar', { nota: +q.get('nota') || 0, comentario: q.get('comentario'), decisao: decisao }).then(function () {
          aviso(decisao === 'aprovado' ? 'Aprovado! O departamento de Publicação agenda nas redes conectadas (conforme a Central de Controle).' : decisao === 'ajustes' ? 'Ajustes pedidos.' : 'Nota salva.');
          assinatura = ''; carregarPubs().then(carregar);
        }).catch(function (er) { aviso(er.message); });
      }
    });
    /* título: salva ao sair do campo */
    document.addEventListener('change', function (e) {
      if (e.target.id === 'tTitulo' && sel && e.target.value.trim()) api('/api/estudio/videos/' + sel, { titulo: e.target.value }).then(function () { assinatura = ''; carregar(); }).catch(function (er) { aviso(er.message); });
      if (e.target.closest('#fEdicao') && /^(inicio|fim)$/.test(e.target.name)) {
        var v = video(sel), b = document.querySelector('.corte-barra i'), f = $('fEdicao');
        if (v && b) { b.style.left = (100 * +f.inicio.value / v.info.duracao) + '%'; b.style.right = (100 - 100 * +f.fim.value / v.info.duracao) + '%'; }
      }
    });
    var m = /v=([a-z0-9]+)/.exec(root.location.hash); if (m) sel = m[1];
    carregarPubs().then(carregar);
  }
  montar();
})(window);
