/* ============================================================================
   ATLAS DIGITAL ENGINEERING — site de vendas
   ----------------------------------------------------------------------------
   Monta as vitrines, os planos, a comparação e as dúvidas a partir de
   catalogo.js (o mesmo arquivo que a torre usa) e cuida do formulário de
   orçamento: ele abre o WhatsApp ou o e-mail com a mensagem pronta, conforme
   o que estiver preenchido em catalogo.js → contato.
   ========================================================================== */
(function () {
  'use strict';
  var CAT = window.ATLAS_CATALOGO || { empresa: {}, contato: {}, produtos: [], duvidas: [] };
  var PRODUTOS = CAT.produtos || [], CONTATO = CAT.contato || {}, EMP = CAT.empresa || {};
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return MAPA[c]; }); }
  var nf = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  function brl(n) { return nf.format(n).replace(/ /g, ' '); }
  function produto(id) { for (var i = 0; i < PRODUTOS.length; i++) if (PRODUTOS[i].id === id) return PRODUTOS[i]; return null; }
  function cobranca(p) { return p.mensal ? 'por mês' : 'pagamento único'; }
  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';

  /* ---------- nome da empresa ---------- */
  (function () {
    var nome = EMP.nome || 'Atlas Digital Engineering', partes = nome.split(/\s+/), curto = EMP.curto || partes[0], resto = nome.slice(curto.length).trim();
    $$('[data-empresa-curto]').forEach(function (el) { el.textContent = curto; });
    $$('[data-empresa-resto]').forEach(function (el) { el.textContent = resto; });
    $$('[data-empresa]').forEach(function (el) { el.textContent = nome; });
    $$('[data-slogan]').forEach(function (el) { el.textContent = EMP.slogan || 'Sites que vendem'; });
    var ano = $('#ano'); if (ano) ano.textContent = new Date().getFullYear();
    var avulsos = PRODUTOS.filter(function (p) { return !p.mensal; });
    if (avulsos.length) {
      var menor = avulsos.reduce(function (a, p) { return p.preco < a.preco ? p : a; });
      $('#heroiNota').innerHTML = 'A partir de <b>' + esc(brl(menor.preco)) + '</b> · ' + esc(menor.nome) + ' pronta em ' + esc(menor.prazo) + ' · Pronto para celular e Google';
    }
  })();

  /* ==========================================================================
     VITRINES DOS SITES (ilustrações em CSS; não são sites de clientes)
     ======================================================================== */
  var ARTE = {
    institucional: '<div class="a-janela"><div class="a-barra"><i></i><i></i><i></i></div><div class="a-nav"><b></b><span></span><span></span><span></span></div>' +
      '<div class="a-topo"><div><b></b><p></p><p class="c"></p><em></em></div><i class="a-foto"></i></div><div class="a-tres"><i></i><i></i><i></i></div></div>',
    landing: '<div class="a-fone"><div><i class="a-notch"></i><b></b><p></p><p class="c"></p><em>Quero meu orçamento</em><div class="a-linha"><i></i><i></i><i></i></div></div></div>',
    blog: '<div class="a-blog">' + [['Como aparecer no Google', '4 min de leitura'], ['5 erros que afastam clientes', '3 min de leitura'], ['Guia do primeiro anúncio', '6 min de leitura']].map(function (x) {
      return '<div class="a-post"><i></i><div><b></b><p></p><small>' + esc(x[1]) + '</small></div></div>';
    }).join('') + '</div>',
    loja: '<div class="a-loja">' + ['R$ 89', 'R$ 129', 'R$ 59', 'R$ 199'].map(function (v, i) {
      return '<div class="a-prod" style="position:relative">' + (i === 0 ? '<em class="a-carrinho">2</em>' : '') + '<i></i><b></b><span>' + v + '</span></div>';
    }).join('') + '</div>',
    presenca: '<div class="a-presenca"><svg class="a-graf" viewBox="0 0 300 140" role="img" aria-label="Ilustração de um gráfico subindo"><polygon points="0,140 0,112 50,104 100,90 150,94 200,62 250,48 300,20 300,140"/><polyline points="0,112 50,104 100,90 150,94 200,62 250,48 300,20"/><circle cx="300" cy="20" r="6"/></svg>' +
      '<ul><li>Atualizações todo mês</li><li>Backup e segurança</li><li>Relatório de resultados</li></ul></div>'
  };
  var VITRINE = [['institucional', 'tile-escuro'], ['landing', 'tile-roxo'], ['blog', 'tile-claro'], ['loja', 'tile-escuro'], ['presenca', 'tile-roxo']];

  (function () {
    var bento = $('#bento'), usados = {}, html = '';
    function tile(p, tom) {
      usados[p.id] = true;
      return '<article class="tile ' + tom + ' t-' + esc(p.id) + '" data-rev>' +
        '<div class="tile-txt"><p class="tile-rot">' + esc(p.nome) + '</p><h3>' + esc(p.chamada || p.nome) + '</h3><p class="tile-ch">' + esc(p.resumo) + '</p>' +
        '<p class="tile-pr"><b>' + esc(brl(p.preco)) + '</b> ' + esc(cobranca(p)) + (p.prazo && !p.mensal ? ' · pronto em ' + esc(p.prazo) : '') + '</p>' +
        '<div class="tile-links"><a class="btn btn-pequeno ' + (tom === 'tile-claro' ? 'btn-roxo' : 'btn-claro') + '" href="#orcamento" data-plano="' + esc(p.id) + '">Quero este</a>' +
        '<a class="seta" href="#plano-' + esc(p.id) + '">Ver detalhes <span aria-hidden="true">›</span></a></div></div>' +
        '<div class="tile-arte" aria-hidden="true">' + (ARTE[p.id] || '') + '</div></article>';
    }
    VITRINE.forEach(function (v) { var p = produto(v[0]); if (p) html += tile(p, v[1]); });
    /* produtos novos que você criar em catalogo.js também ganham vitrine */
    PRODUTOS.forEach(function (p, i) { if (!usados[p.id]) html += tile(p, i % 2 ? 'tile-escuro' : 'tile-claro'); });
    bento.innerHTML = html;
  })();

  /* ==========================================================================
     PLANOS, COMPARAÇÃO E DÚVIDAS
     ======================================================================== */
  (function () {
    var avulsos = PRODUTOS.filter(function (p) { return !p.mensal; }), mensais = PRODUTOS.filter(function (p) { return p.mensal; });
    function itens(p) { return '<ul class="pl-itens">' + (p.itens || []).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>'; }
    function botao(p, rec) { return '<a class="btn ' + (rec ? 'btn-claro' : 'btn-fantasma') + '" href="#orcamento" data-plano="' + esc(p.id) + '">Pedir este plano</a>'; }
    $('#listaPlanos').innerHTML = avulsos.map(function (p) {
      return '<article class="plano' + (p.recomendado ? ' rec' : '') + '" id="plano-' + esc(p.id) + '" data-rev>' + (p.recomendado ? '<span class="selo">Recomendado</span>' : '') +
        '<h3>' + esc(p.nome) + '</h3><p class="pl-ch">' + esc(p.ideal || p.chamada || '') + '</p>' +
        '<p class="pl-preco"><b>' + esc(brl(p.preco)) + '</b><span>' + esc(cobranca(p)) + '</span></p><p class="pl-res">' + esc(p.resumo) + '</p>' + itens(p) +
        '<p class="pl-prazo">Prazo: <b>' + esc(p.prazo || 'a combinar') + '</b>' + (p.suporte ? ' · Suporte: <b>' + esc(p.suporte) + '</b>' : '') + '</p>' + botao(p, p.recomendado) + '</article>';
    }).join('');
    $('#listaMensais').innerHTML = mensais.map(function (p) {
      return '<article class="plano mensal" id="plano-' + esc(p.id) + '" data-rev><div><span class="selo fino">Mensal</span><h3>' + esc(p.nome) + '</h3><p class="pl-ch">' + esc(p.chamada || '') + '</p><p class="pl-res">' + esc(p.resumo) + '</p></div>' +
        itens(p) + '<div class="pl-lado"><p class="pl-preco"><b>' + esc(brl(p.preco)) + '</b><span>' + esc(cobranca(p)) + '</span></p>' + botao(p, true) + '</div></article>';
    }).join('');

    /* tabela de comparação: o texto diz "sim"/"não" além do símbolo, para leitores de tela */
    function simNao(v) { return v ? '<td class="sim"><span aria-hidden="true">✓</span><span class="so-leitor">sim</span></td>' : '<td class="nao"><span aria-hidden="true">—</span><span class="so-leitor">não</span></td>'; }
    var linhas = [
      ['Preço', function (p) { return '<td class="dest">' + esc(brl(p.preco)) + (p.mensal ? '<br><small>por mês</small>' : '') + '</td>'; }],
      ['Prazo', function (p) { return '<td>' + esc(p.prazo || '—') + '</td>'; }],
      ['Tamanho', function (p) { return '<td>' + esc(p.tamanho || '—') + '</td>'; }],
      ['Pronto para celular', function () { return simNao(true); }],
      ['Painel para você editar', function (p) { return simNao(p.painel); }],
      ['Blog', function (p) { return simNao(p.blog); }],
      ['Loja com carrinho e pagamento', function (p) { return simNao(p.loja); }],
      ['Suporte incluído', function (p) { return '<td>' + esc(p.suporte || '—') + '</td>'; }]
    ];
    $('#compara').innerHTML = '<caption class="so-leitor">Comparação entre os planos</caption><thead><tr><th scope="col"><span class="so-leitor">Item</span></th>' + PRODUTOS.map(function (p) { return '<th scope="col">' + esc(p.nome) + '</th>'; }).join('') + '</tr></thead>' +
      '<tbody>' + linhas.map(function (l) { return '<tr><th scope="row">' + esc(l[0]) + '</th>' + PRODUTOS.map(l[1]).join('') + '</tr>'; }).join('') + '</tbody>';

    $('#listaDuvidas').innerHTML = (CAT.duvidas || []).map(function (d, i) {
      return '<details class="duvida" data-rev' + (i === 0 ? ' open' : '') + '><summary>' + esc(d[0]) + '<i aria-hidden="true"></i></summary><p>' + esc(d[1]) + '</p></details>';
    }).join('');

    var sel = $('#fPlano');
    PRODUTOS.forEach(function (p) { var o = document.createElement('option'); o.value = p.id; o.textContent = p.nome + ' · ' + brl(p.preco) + (p.mensal ? '/mês' : ''); sel.appendChild(o); });
  })();

  /* ==========================================================================
     CONTATO E FORMULÁRIO DE ORÇAMENTO
     ======================================================================== */
  var zap = String(CONTATO.whatsapp || '').replace(/\D/g, ''), email = String(CONTATO.email || '').trim(), insta = String(CONTATO.instagram || '').replace(/^@/, '').trim();
  (function () {
    var ul = $('#contatos'), html = '';
    if (zap) html += '<li><span>WhatsApp</span><a href="https://wa.me/' + esc(zap) + '" target="_blank" rel="noopener">' + esc(formatarFone(zap)) + '</a></li>';
    if (email) html += '<li><span>E-mail</span><a href="mailto:' + esc(email) + '">' + esc(email) + '</a></li>';
    if (insta) html += '<li><span>Instagram</span><a href="https://instagram.com/' + esc(insta) + '" target="_blank" rel="noopener">@' + esc(insta) + '</a></li>';
    if (CONTATO.cidade) html += '<li><span>Atendimento</span>' + esc(CONTATO.cidade) + '</li>';
    ul.innerHTML = html; ul.hidden = !html;
    /* aviso só para você, enquanto testa no seu computador: o público nunca vê */
    if (!zap && !email && local) {
      var aviso = document.createElement('div');
      aviso.className = 'aviso-dono'; aviso.setAttribute('role', 'note');
      aviso.innerHTML = '<b>Antes de publicar:</b> preencha o WhatsApp ou o e-mail em <code>site/catalogo.js</code> (bloco "contato"). Sem isso, o formulário de orçamento não tem para onde enviar. <small>Este aviso só aparece no seu computador.</small>';
      document.body.insertBefore(aviso, document.body.firstChild);
      var medir = function () { document.body.style.setProperty('--aviso-h', aviso.offsetHeight + 'px'); };
      medir(); window.addEventListener('resize', medir);
    }
  })();
  function formatarFone(n) {
    var m = n.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
    return m ? '(' + m[1] + ') ' + m[2] + '-' + m[3] : '+' + n;
  }

  /* "Quero este" / "Pedir este plano" já deixam o plano escolhido no formulário */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-plano]');
    if (a) { $('#fPlano').value = a.getAttribute('data-plano'); setTimeout(function () { $('#fNome').focus({ preventScroll: true }); }, 650); }
  });

  var form = $('#formOrcamento'), retorno = $('#retorno');
  function marcarErro(campo, texto) {
    campo.classList.add('erro'); campo.setAttribute('aria-invalid', 'true');
    var id = campo.id + 'Erro', p = document.getElementById(id);
    if (!p) { p = document.createElement('p'); p.id = id; p.className = 'aviso-erro'; campo.parentNode.appendChild(p); }
    p.textContent = texto; campo.setAttribute('aria-describedby', id);
  }
  function limparErro(campo) {
    campo.classList.remove('erro'); campo.removeAttribute('aria-invalid'); campo.removeAttribute('aria-describedby');
    var p = document.getElementById(campo.id + 'Erro'); if (p) p.parentNode.removeChild(p);
  }
  $$('input, textarea, select', form).forEach(function (c) { c.addEventListener('input', function () { if (c.classList.contains('erro')) limparErro(c); }); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var nome = form.nome, contato = form.contato, erros = [];
    [nome, contato].forEach(limparErro);
    if (nome.value.trim().length < 2) { marcarErro(nome, 'Escreva o seu nome.'); erros.push(nome); }
    var c = contato.value.trim(), digitos = c.replace(/\D/g, '');
    if (!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) || digitos.length >= 10)) { marcarErro(contato, 'Informe um WhatsApp com DDD ou um e-mail válido.'); erros.push(contato); }
    if (erros.length) { erros[0].focus(); return; }

    var p = produto(form.plano.value);
    var texto = 'Olá! Quero um orçamento.\n\nNome: ' + nome.value.trim() + '\nContato: ' + c +
      (form.negocio.value.trim() ? '\nNegócio: ' + form.negocio.value.trim() : '') +
      '\nInteresse: ' + (p ? p.nome + ' (' + brl(p.preco) + (p.mensal ? ' por mês' : '') + ')' : 'quero uma indicação') +
      (form.mensagem.value.trim() ? '\n\n' + form.mensagem.value.trim() : '');

    retorno.hidden = false;
    if (zap) {
      window.open('https://wa.me/' + zap + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
      retorno.innerHTML = '<b>Quase lá!</b>Abrimos o WhatsApp com a sua mensagem pronta: é só tocar em enviar. Se ele não abriu, <a href="https://wa.me/' + esc(zap) + '?text=' + esc(encodeURIComponent(texto)) + '" target="_blank" rel="noopener">clique aqui</a>.';
    } else if (email) {
      location.href = 'mailto:' + email + '?subject=' + encodeURIComponent('Pedido de orçamento — ' + nome.value.trim()) + '&body=' + encodeURIComponent(texto);
      retorno.innerHTML = '<b>Quase lá!</b>Abrimos o seu programa de e-mail com a mensagem pronta. Se nada abriu, escreva para <a href="mailto:' + esc(email) + '">' + esc(email) + '</a>.';
    } else {
      /* sem canal de contato configurado: a mensagem fica pronta para copiar */
      retorno.innerHTML = '<b>Seu pedido está pronto.</b>O canal de atendimento deste site ainda está sendo configurado. Copie a mensagem abaixo para enviar.<textarea readonly id="retornoTexto" aria-label="Mensagem do pedido">' + esc(texto) + '</textarea><button class="btn btn-pequeno btn-claro" type="button" id="btCopiar">Copiar mensagem</button>';
      $('#btCopiar').addEventListener('click', function () {
        var t = $('#retornoTexto'), b = this;
        function feito() { b.textContent = 'Copiada!'; }
        if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(feito, function () { t.select(); });
        else { t.select(); try { document.execCommand('copy'); feito(); } catch (x) { /* o texto já está selecionado para copiar à mão */ } }
      });
    }
    retorno.focus && retorno.setAttribute('tabindex', '-1');
    retorno.focus({ preventScroll: true });
    retorno.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  /* ==========================================================================
     NAVEGAÇÃO, ENTRADA SUAVE E MOVIMENTO
     ======================================================================== */
  var nav = $('#nav'), menu = $('#navMenu'), links = $('#navLinks');
  function abrirMenu(sim) { links.classList.toggle('aberto', sim); menu.setAttribute('aria-expanded', sim); menu.setAttribute('aria-label', sim ? 'Fechar o menu' : 'Abrir o menu'); }
  menu.addEventListener('click', function () { abrirMenu(menu.getAttribute('aria-expanded') !== 'true'); });
  links.addEventListener('click', function (e) { if (e.target.closest('a')) abrirMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { abrirMenu(false); menu.focus(); } });

  /* cada grupo de cartões entra em cascata */
  $$('.bento, .recursos, .passos, .planos, .duvidas').forEach(function (g) {
    $$('[data-rev]', g).forEach(function (el, i) { el.style.setProperty('--atraso', Math.min(i, 6) * 0.07 + 's'); });
  });
  var revelar = $$('[data-rev]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('visivel'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revelar.forEach(function (el) { io.observe(el); });
  } else revelar.forEach(function (el) { el.classList.add('visivel'); });

  /* a vitrine do topo se endireita conforme a página rola; a barra do topo ganha fundo */
  var vitrine = $('#vitrine'), marcado = false;
  function aoRolar() {
    marcado = false;
    nav.classList.toggle('rolou', window.scrollY > 8);
    if (vitrine) {
      var r = vitrine.getBoundingClientRect(), h = window.innerHeight;
      vitrine.style.setProperty('--p', Math.max(0, Math.min(1, 1 - (r.top - h * 0.2) / (h * 0.55))).toFixed(3));
    }
  }
  window.addEventListener('scroll', function () { if (!marcado) { marcado = true; requestAnimationFrame(aoRolar); } }, { passive: true });
  window.addEventListener('resize', aoRolar);
  aoRolar();

  /* brilho que segue o ponteiro nas vitrines */
  $('#bento').addEventListener('pointermove', function (e) {
    var t = e.target.closest('.tile'); if (!t) return;
    var b = t.getBoundingClientRect();
    t.style.setProperty('--mx', (e.clientX - b.left) + 'px'); t.style.setProperty('--my', (e.clientY - b.top) + 'px');
  });
})();
