/* ============================================================================
   OFICINA NA TORRE — o que acontece de verdade no seu computador
   ----------------------------------------------------------------------------
   • Central de Controle (botão "Controle"): o que cada departamento pode fazer
     sozinho, pedidos de aprovação, trabalho em andamento e o registro do que
     os agentes fizeram.
   • Clientes do site: quem deixou contato no atendimento do site de vendas.
   • Instalar e remover skills externas (no catálogo de skills).
   • O feed "Mega Brain ao vivo" mostra os acontecimentos reais com a etiqueta "real".
   Fala com o servidor da torre (server.mjs → servidor/*.mjs).
   ========================================================================== */
(function (root) {
  'use strict';
  var T = root.Torre, F = T.fmt, esc = T.esc;
  var $ = function (id) { return document.getElementById(id); };
  var UI = null, online = root.location.protocol !== 'file:';

  function api(caminho, corpo, metodo) {
    var op = corpo === undefined && !metodo ? {} : { method: metodo || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) };
    return root.fetch(caminho, op).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.ok === false) throw new Error(j.erro || 'o servidor respondeu ' + r.status); return j; });
    });
  }
  function ico(n) { return UI.ico(UI.ICO[n] || n); }
  function hora(iso) { var d = new Date(iso), hoje = F.chaveDia(d) === F.chaveDia(new Date()); return (hoje ? '' : F.dataMedia(d) + ' ') + F.hora(d); }
  var MODOS = [['desligado', 'Desligado'], ['pedir', 'Pede aprovação'], ['automatico', 'Automático']];
  var semServidor = '<p class="alerta aviso"><i aria-hidden="true">▲</i><span>A torre não está ligada ao servidor. Abra pelo <b>iniciar.bat</b> (endereço http://localhost:5173) para os agentes poderem trabalhar no computador.</span></p>';

  /* ==========================================================================
     CENTRAL DE CONTROLE
     ======================================================================== */
  var ctl = null, tCtl = null;
  function geral(modos) {
    var v = Object.keys(modos).map(function (k) { return modos[k]; });
    return v.every(function (m) { return m === 'automatico'; }) ? 'automatico' : v.every(function (m) { return m === 'desligado'; }) ? 'desligado' : 'pedir';
  }
  function segmentos(nome, atual, rotulo) {
    return '<div class="seg" role="radiogroup" aria-label="' + esc(rotulo) + '">' + MODOS.map(function (m) {
      return '<button type="button" role="radio" aria-checked="' + (m[0] === atual) + '" class="seg-op' + (m[0] === atual ? ' on ' + m[0] : '') + '" data-modo="' + m[0] + '" data-dep="' + nome + '">' + m[1] + '</button>';
    }).join('') + '</div>';
  }
  function htmlControle(c) {
    var g = geral(c.modos);
    var deps = Object.keys(c.deptos).map(function (k) {
      var d = c.deptos[k];
      return '<article class="ctl-dep" style="--cor:' + esc(d.cor || 'var(--gelo)') + '"><div class="ctl-dep-cab">' + UI.ponto(d.cor) + '<b>' + esc(d.nome) + '</b><small>' + d.andar + 'º andar</small></div>' +
        '<p>' + esc(d.faz) + '</p><p class="ctl-usa">Usa: ' + esc(d.usa) + '</p>' + segmentos(k, c.modos[k], d.nome) + '</article>';
    }).join('');
    var pedidos = c.pedidos.length ? '<ul class="ctl-pedidos">' + c.pedidos.map(function (p) {
      return '<li><div><p><b>' + esc(p.agente) + '</b> · ' + esc(c.deptos[p.dep] ? c.deptos[p.dep].nome : p.dep) + '</p><p>' + esc(p.texto) + '</p><time>' + esc(hora(p.criadoEm)) + '</time></div>' +
        '<button class="bt bt-mini bt-cor" type="button" data-pedido="' + esc(p.id) + '" data-decisao="aprovar">' + ico('certo') + 'Aprovar</button><button class="bt bt-mini" type="button" data-pedido="' + esc(p.id) + '" data-decisao="recusar">Recusar</button></li>';
    }).join('') + '</ul>' : '<p class="vazio">Nenhum pedido esperando você.</p>';
    var trab = c.trabalhando ? '<div class="ctl-trab"><p><b>' + esc(c.trabalhando.quem || 'Agentes') + '</b> · ' + esc(c.trabalhando.rotulo) + '</p><div class="barra-prog"><i style="width:' + Math.round((c.trabalhando.progresso || 0) * 100) + '%"></i></div>' +
      (c.naFila ? '<small>mais ' + c.naFila + ' na fila</small>' : '') + '</div>' : '<p class="vazio">Nenhum trabalho rodando agora.</p>';
    var ativ = c.atividade.length ? '<ol class="ctl-ativ">' + c.atividade.slice(0, 25).map(function (e) {
      var a = T.andar(e.andar);
      return '<li>' + UI.ponto(a ? a.cor : 'var(--gelo)') + '<p><b>' + esc(e.agente) + '</b> ' + esc(e.texto) + '</p><time>' + esc(hora(e.em)) + '</time></li>';
    }).join('') + '</ol>' : '<p class="vazio">Os agentes ainda não fizeram nada de verdade. Envie um vídeo no Estúdio para começar.</p>';
    return '<header><div><h2 id="mTit">Central de Controle</h2><p>O que os agentes fazem de verdade no seu computador · trabalham só em <code>' + esc(c.pasta) + '</code>' + (c.ia ? '' : ' · <b>sem IA ligada</b>: textos saem de modelos prontos') + '</p></div>' +
      '<button class="bt-icone" type="button" data-acao="fecharModal" aria-label="Fechar a Central de Controle">' + ico('fechar') + '</button></header>' +
      '<div class="modal-corpo ctl">' +
      '<section class="ctl-geral"><div><h3>Todos os departamentos</h3><p>' + (g === 'automatico' ? '<b>Controle total:</b> cada departamento faz o seu trabalho sozinho.' : g === 'desligado' ? 'Todos desligados: nada acontece sem você.' : 'Os agentes preparam o trabalho e esperam a sua aprovação (ou há modos diferentes por departamento).') + '</p></div>' +
      '<div class="ctl-mestre">' + [['desligado', ico('M6 6h12v12H6z') + 'Parar tudo'], ['pedir', 'Pedir aprovação'], ['automatico', ico('M5 12l5 5 9-10') + 'Controle total']].map(function (b) {
        return '<button class="bt' + (g === b[0] ? ' bt-cor' : '') + '" type="button" data-todos="' + b[0] + '" aria-pressed="' + (g === b[0]) + '">' + b[1] + '</button>';
      }).join('') + '</div></section>' +
      '<div class="ctl-duas"><section><h3>Pedidos esperando você <small>' + c.pedidos.length + '</small></h3>' + pedidos + '</section><section><h3>Trabalhando agora</h3>' + trab + '</section></div>' +
      '<section><h3>Departamentos</h3><div class="ctl-deps">' + deps + '</div></section>' +
      '<section class="ctl-horarios"><h3>Horários de postagem</h3><p>O departamento de Publicação agenda os vídeos aprovados nestes horários.</p><form id="fHorarios" class="ctl-hform">' +
      [0, 1, 2, 3].map(function (i) { return '<input type="time" name="h" value="' + esc(c.horarios[i] || '') + '" aria-label="Horário ' + (i + 1) + '">'; }).join('') + '<button class="bt bt-mini" type="submit">Salvar horários</button></form></section>' +
      '<section><h3>O que os agentes fizeram</h3>' + ativ + '</section>' +
      '<details class="ctl-limites"><summary>O que os agentes não fazem</summary><ul><li>Não abrem outros programas nem mexem no resto do computador.</li><li>Não apagam arquivos seus: o vídeo original fica sempre guardado.</li><li>Não postam em contas que você não conectou na página Publicação.</li><li>Não executam código das skills baixadas.</li><li>“Parar tudo” desliga todos e cancela o que estiver rodando.</li></ul></details>' +
      '</div>';
  }
  function abrirControle() {
    if (!online) { UI.abrirModal('<header><div><h2 id="mTit">Central de Controle</h2></div><button class="bt-icone" type="button" data-acao="fecharModal" aria-label="Fechar">' + ico('fechar') + '</button></header><div class="modal-corpo">' + semServidor + '</div>', 'controle', 'modal-controle'); return; }
    api('/api/controle').then(function (c) {
      ctl = c;
      var m = $('modal'), aberto = UI.modalAtual() === 'controle' && !m.hidden;
      if (aberto) {
        var corpo = m.querySelector('.modal-corpo'), rolagem = corpo ? corpo.scrollTop : 0, foco = document.activeElement && document.activeElement.closest('#fHorarios');
        if (foco) return;   /* não redesenha enquanto você digita um horário */
        m.querySelector('.modal-caixa').innerHTML = htmlControle(c);
        corpo = m.querySelector('.modal-corpo'); if (corpo) corpo.scrollTop = rolagem;
      } else {
        UI.abrirModal(htmlControle(c), 'controle', 'modal-controle');
        var b = m.querySelector('header .bt-icone'); if (b) b.focus();
      }
      clearTimeout(tCtl); tCtl = setTimeout(function () { if (UI.modalAtual() === 'controle' && !$('modal').hidden) abrirControle(); }, 3000);
      selo(c);
    }).catch(function (e) { UI.aviso('Central de Controle: ' + e.message); });
  }
  /* o pontinho do botão Controle: verde = automático, âmbar = pede aprovação, cinza = desligado */
  function selo(c) {
    var p = $('ctlPonto'), bt = $('btControle'); if (!p || !c) return;
    var g = geral(c.modos);
    p.className = 'ctl-ponto ' + g;
    var n = c.pedidos ? c.pedidos.length : 0;
    var cont = bt.querySelector('.contador');
    if (!cont) { cont = document.createElement('span'); cont.className = 'contador'; bt.appendChild(cont); }
    cont.hidden = !n; cont.textContent = n;
    bt.setAttribute('aria-label', 'Central de Controle: ' + (g === 'automatico' ? 'controle total' : g === 'desligado' ? 'agentes desligados' : 'agentes pedem aprovação') + (n ? ', ' + n + ' pedidos esperando' : ''));
  }
  function mudarModo(corpo) {
    api('/api/controle/modo', corpo).then(function () { abrirControle(); }).catch(function (e) { UI.aviso(e.message); });
  }

  /* ==========================================================================
     CLIENTES DO SITE (leads)
     ======================================================================== */
  var leads = [];
  function linkContato(c) {
    var n = String(c || '').replace(/\D/g, '');
    if (/@/.test(c)) return '<a href="mailto:' + esc(c) + '">' + esc(c) + '</a>';
    if (n.length >= 10) return '<a href="https://wa.me/' + (n.length <= 11 ? '55' + n : n) + '" target="_blank" rel="noopener">' + ico('externo') + esc(c) + '</a>';
    return esc(c || 'sem contato');
  }
  function htmlClientes() {
    var lista = leads.length ? '<ul class="leads">' + leads.map(function (l) {
      return '<li class="lead ' + esc(l.status.replace(' ', '-')) + '"><div class="lead-cab"><b>' + esc(l.nome || 'Visitante') + '</b><span class="tag">' + (l.origem === 'chat' ? 'escreveu no chat' : 'formulário') + '</span><time>' + esc(hora(l.criadoEm)) + '</time></div>' +
        '<p class="lead-contato">' + linkContato(l.contato) + (l.negocio ? ' · ' + esc(l.negocio) : '') + (l.produto ? ' · quer <b>' + esc(l.produto) + '</b>' : '') + '</p>' +
        (l.mensagem ? '<p class="lead-msg">“' + esc(l.mensagem) + '”</p>' : '') +
        (l.conversa && l.conversa.length ? '<details><summary>Conversa no site (' + l.conversa.length + ' mensagens)</summary><ul class="lead-conversa">' + l.conversa.map(function (m) { return '<li class="' + (m.de === 'atlas' ? 'de-atlas' : '') + '"><b>' + (m.de === 'atlas' ? 'Atendimento' : 'Cliente') + ':</b> ' + esc(m.texto) + '</li>'; }).join('') + '</ul></details>' : '') +
        '<label class="lead-status">Situação <select data-lead="' + esc(l.id) + '">' + ['novo', 'em contato', 'fechado', 'perdido'].map(function (s) { return '<option' + (s === l.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label></li>';
    }).join('') + '</ul>' : '<p class="vazio">Ninguém deixou contato ainda. O chat do site de vendas registra aqui quem deixa nome e WhatsApp ou e-mail.</p>';
    var novos = leads.filter(function (l) { return l.status === 'novo'; }).length;
    return '<header><div><h2 id="mTit">Clientes do site</h2><p>' + leads.length + ' contatos · ' + novos + ' novos · vindos do atendimento do site de vendas (Vendas, 2º andar)</p></div><button class="bt-icone" type="button" data-acao="fecharModal" aria-label="Fechar clientes do site">' + ico('fechar') + '</button></header>' +
      '<div class="modal-corpo">' + lista + '</div><footer><a class="bt bt-cor" href="site/index.html" target="_blank" rel="noopener">' + ico('externo') + 'Abrir o site e testar o chat</a></footer>';
  }
  function abrirClientes() {
    if (!online) { UI.abrirModal('<header><div><h2 id="mTit">Clientes do site</h2></div><button class="bt-icone" type="button" data-acao="fecharModal" aria-label="Fechar">' + ico('fechar') + '</button></header><div class="modal-corpo">' + semServidor + '</div>', 'clientes', 'modal-clientes'); return; }
    api('/api/vendas/leads').then(function (j) {
      leads = j.leads || [];
      UI.abrirModal(htmlClientes(), 'clientes', 'modal-clientes');
      var b = $('modal').querySelector('header .bt-icone'); if (b) b.focus();
      contarClientes();
    }).catch(function (e) { UI.aviso('Clientes: ' + e.message); });
  }
  function contarClientes() {
    var el = $('clientesConta'); if (!el) return;
    var n = leads.filter(function (l) { return l.status === 'novo'; }).length;
    el.hidden = !n; el.textContent = n;
    $('btClientes').setAttribute('aria-label', 'Clientes do site' + (n ? ': ' + n + ' novos' : ''));
  }

  /* ==========================================================================
     INSTALAR SKILLS (catálogo de skills)
     ======================================================================== */
  var skills = null, tSkills = null;
  function htmlInstalar(s) {
    if (s.instalado) return '';
    var e = skills && skills.estado[s.id], ins = skills && skills.instalando[s.id];
    if (ins && ins.etapa === 'erro') return '<p class="ex-inst-erro">Não instalou: ' + esc(ins.erro) + '</p><button class="bt bt-mini" type="button" data-instalar="' + esc(s.id) + '">Tentar de novo</button>';
    if (ins) return '<div class="ex-inst-prog"><span>' + esc(ins.etapa) + '…</span><div class="barra-prog"><i style="width:' + Math.round((ins.progresso || 0) * 100) + '%"></i></div></div>';
    if (e) {
      var alertas = e.alertas || [], reais = alertas.filter(function (a) { return !a.emTeste; });
      return '<p class="ex-inst-ok">' + ico('certo') + 'Baixada em <code>' + esc(e.pasta) + '</code> · versão ' + esc(String(e.versao).slice(0, 7)) + ' · ' + e.arquivos + ' arquivos' + (e.skills ? ' · ' + e.skills + ' skills' : '') + '</p>' +
        (alertas.length ? '<details class="ex-alertas' + (reais.length ? ' serio' : '') + '"><summary>' + (reais.length ? '▲ ' + reais.length + ' alerta' + (reais.length > 1 ? 's' : '') + ' de segurança para revisar' : alertas.length + ' alerta' + (alertas.length > 1 ? 's' : '') + ' só em arquivos de teste (provavelmente testes de segurança do próprio projeto)') + '</summary><ul>' +
          alertas.map(function (a) { return '<li><b>' + esc(a.tipo) + '</b>' + (a.emTeste ? ' <small>(arquivo de teste)</small>' : '') + '<br><code>' + esc(a.arquivo) + (a.linha ? ':' + a.linha : '') + '</code>' + (a.trecho ? '<pre>' + esc(a.trecho) + '</pre>' : '') + '</li>'; }).join('') + '</ul></details>' : '<p class="ex-inst-limpo">Verificação de segurança: nenhum alerta.</p>') +
        '<p class="ex-inst-nota">Nada foi executado. Para usar, siga “Como instalar” depois de ler os alertas.</p><button class="bt bt-mini" type="button" data-remover="' + esc(s.id) + '">Remover do computador</button>';
    }
    if (!s.repo) return '<p class="ex-inst-nota">Não é um projeto do GitHub: instale pelo site oficial.</p>';
    return '<button class="bt bt-mini bt-cor" type="button" data-instalar="' + esc(s.id) + '">' + ico('M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14') + 'Instalar (baixar e verificar)</button>';
  }
  function desenharInstalar() {
    var slots = document.querySelectorAll('[data-skill-inst]');
    if (!slots.length) return;
    Array.prototype.forEach.call(slots, function (slot) {
      var s = T.skillExterna(slot.getAttribute('data-skill-inst')); if (!s) return;
      var h = htmlInstalar(s); if (slot._h === h) return;
      var abertos = slot.querySelector('details[open]');
      slot._h = h; slot.innerHTML = h;
      if (abertos) { var d = slot.querySelector('details'); if (d) d.open = true; }
      var tag = slot.closest('article') && slot.closest('article').querySelector('.ex-topo .tag');
      if (tag && !s.instalado) { var baixada = skills && skills.estado[s.id]; tag.textContent = baixada ? '✓ baixada' : 'não instalada'; tag.classList.toggle('tag-instalada', !!baixada); }
    });
  }
  function atualizarSkills() {
    if (!online || !document.querySelector('[data-skill-inst]')) return;
    api('/api/skills').then(function (j) {
      skills = j; desenharInstalar();
      clearTimeout(tSkills);
      if (Object.keys(j.instalando).length) tSkills = setTimeout(atualizarSkills, 1500);
    }).catch(function () { /* sem servidor: os cartões ficam como estão */ });
  }

  /* ==========================================================================
     ACONTECIMENTOS REAIS NO FEED
     ======================================================================== */
  var desde = new Date().toISOString();
  function buscarAtividade() {
    api('/api/atividade?desde=' + encodeURIComponent(desde)).then(function (j) {
      (j.eventos || []).forEach(function (e) {
        desde = e.em > desde ? e.em : desde;
        UI.eventoReal({ andar: e.andar || 8, texto: e.agente + ' ' + e.texto, t: new Date(e.em), real: true, destaque: true });
        if (e.andar === 2 && /novo contato/.test(e.texto)) { UI.aviso('Novo contato no site: ' + e.texto.replace(/^novo contato pelo site: /, '')); leadsDeNovo(); }
        if (/pede sua aprovação/.test(e.texto)) UI.aviso(e.agente + ' ' + e.texto + ' · abra a Central de Controle (tecla K)');
      });
    }).catch(function () { /* servidor fora do ar: tenta de novo depois */ });
  }
  function leadsDeNovo() { api('/api/vendas/leads').then(function (j) { leads = j.leads || []; contarClientes(); }).catch(function () {}); }
  function estadoControle() { api('/api/controle').then(function (c) { ctl = c; selo(c); }).catch(function () {}); }

  /* ==========================================================================
     MONTAGEM
     ======================================================================== */
  function montar() {
    UI = T.UI;
    var bc = $('btControle'), bcl = $('btClientes');
    if (bc) bc.addEventListener('click', abrirControle);
    if (bcl) bcl.addEventListener('click', abrirClientes);
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-modo],[data-todos],[data-pedido],[data-instalar],[data-remover]');
      if (!t) return;
      if (t.hasAttribute('data-modo')) return mudarModo({ dep: t.getAttribute('data-dep'), modo: t.getAttribute('data-modo') });
      if (t.hasAttribute('data-todos')) {
        var m = t.getAttribute('data-todos');
        if (m === 'automatico' && !root.confirm('Controle total: cada departamento passa a trabalhar sozinho no computador (preparar vídeos, escrever posts, agendar e publicar nas redes conectadas, responder clientes no site).\n\nVocê pode parar tudo a qualquer momento. Liberar?')) return;
        return mudarModo({ todos: m });
      }
      if (t.hasAttribute('data-pedido')) { t.disabled = true; return api('/api/controle/pedidos/' + t.getAttribute('data-pedido'), { decisao: t.getAttribute('data-decisao') }).then(abrirControle).catch(function (er) { UI.aviso(er.message); }); }
      if (t.hasAttribute('data-instalar')) {
        var id = t.getAttribute('data-instalar'); t.disabled = true;
        return api('/api/skills/' + id + '/instalar', {}).then(function () { skills = skills || { estado: {}, instalando: {} }; skills.instalando[id] = { etapa: 'começando', progresso: 0 }; desenharInstalar(); atualizarSkills(); }).catch(function (er) { t.disabled = false; UI.aviso(er.message); });
      }
      if (t.hasAttribute('data-remover')) {
        var s = T.skillExterna(t.getAttribute('data-remover'));
        if (!root.confirm('Remover ' + s.nome + ' do computador? A pasta baixada será apagada.')) return;
        return api('/api/skills/' + s.id + '/remover', {}).then(atualizarSkills).catch(function (er) { UI.aviso(er.message); });
      }
    });
    document.addEventListener('change', function (e) {
      var s = e.target.closest('select[data-lead]'); if (!s) return;
      api('/api/vendas/leads/' + s.getAttribute('data-lead'), { status: s.value }).then(function (j) {
        leads = leads.map(function (l) { return l.id === j.lead.id ? j.lead : l; }); contarClientes();
        var li = s.closest('.lead'); if (li) li.className = 'lead ' + j.lead.status.replace(' ', '-');
      }).catch(function (er) { UI.aviso(er.message); });
    });
    document.addEventListener('submit', function (e) {
      if (e.target.id !== 'fHorarios') return;
      e.preventDefault();
      var h = Array.prototype.map.call(e.target.querySelectorAll('input[name=h]'), function (i) { return i.value; }).filter(Boolean);
      api('/api/controle/horarios', { horarios: h }).then(function () { UI.aviso('Horários de postagem salvos.'); document.activeElement.blur(); abrirControle(); }).catch(function (er) { UI.aviso(er.message); });
    });
    /* catálogo de skills aberto: preenche os botões de instalar */
    new root.MutationObserver(function () { if (document.querySelector('[data-skill-inst]:empty')) { desenharInstalar(); atualizarSkills(); } }).observe($('modal'), { childList: true });
    /* atalhos: E estúdio · U publicação · K controle · G clientes */
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      var k = e.key.toLowerCase();
      if (k === 'e') root.location.href = 'estudio.html';
      else if (k === 'u') root.location.href = 'publicacao.html';
      else if (k === 'k') abrirControle();
      else if (k === 'g') abrirClientes();
    });
    if (online) {
      estadoControle(); leadsDeNovo();
      setInterval(buscarAtividade, 5000);
      setInterval(function () { estadoControle(); leadsDeNovo(); }, 30000);
    }
  }

  T.Oficina = { montar: montar, abrirControle: abrirControle, abrirClientes: abrirClientes };
})(window);
