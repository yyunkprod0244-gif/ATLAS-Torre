/* ============================================================================
   DASHBOARD — os seus números (reais) e os da torre (simulados), lado a lado
   ----------------------------------------------------------------------------
   Lê os mesmos dados da torre: o que você anota (plano de 90 dias, checklist,
   lembretes) vem do armazenamento deste navegador; a operação vem da
   simulação (js/sim.js), recalculada a cada 20 segundos.
   Regras de gráfico iguais às da torre: a cor pinta as marcas e o texto fica
   nas cores de texto; todo valor também aparece escrito; o que só tem cor
   (estado) vem sempre com ícone e rótulo.
   ========================================================================== */
(function (root) {
  'use strict';
  var T = root.Torre, F = T.fmt, esc = T.esc, S = T.Sim;
  var $ = function (id) { return document.getElementById(id); };
  /* rampa de um tom só (azul da paleta), do mais escuro ao mais claro, para o funil */
  var RAMPA = ['#1f4e8c', '#2a6bbd', '#3987e5', '#7fb0ef'];
  var tabela14 = false;

  function ponto(cor) { return '<span class="ponto" style="--c:' + cor + '"></span>'; }
  function dica(valor, rotulo) { return ' tabindex="0" data-dica="' + esc(valor + '|' + rotulo) + '"'; }
  function medidor(fracao, ritmo, estado) {
    return '<span class="md-trilho ' + (estado || '') + '"><i class="md-barra" style="width:' + Math.min(100, Math.max(0, fracao) * 100).toFixed(1) + '%"></i>' +
      (ritmo != null ? '<em class="md-ritmo" style="left:' + Math.min(100, ritmo * 100).toFixed(1) + '%"></em>' : '') + '</span>';
  }
  function barras(linhas, cls) {
    var max = Math.max.apply(null, linhas.map(function (l) { return l.v; })) || 1;
    return '<div class="barras' + (cls ? ' ' + cls : '') + '">' + linhas.map(function (l) {
      return '<div class="br-linha"' + dica(l.texto, l.nome + (l.extra ? ' · ' + l.extra : '')) + '><span class="br-nome">' + (l.ponto ? ponto(l.ponto) : '') + esc(l.nome) + (l.sub ? '<small>' + esc(l.sub) + '</small>' : '') + '</span>' +
        '<span class="br-trilho"><i class="br-barra" style="width:' + Math.max(1.5, l.v / max * 100).toFixed(1) + '%' + (l.cor ? ';background:' + l.cor : '') + '"></i><b class="br-val">' + esc(l.texto) + '</b></span>' +
        (l.extra ? '<span class="br-extra">' + esc(l.extra) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function faisca(serie) {
    if (!serie) return '';
    var w = 180, h = 30, p = 5, min = Math.min.apply(null, serie), max = Math.max.apply(null, serie), amp = (max - min) || 1, n = serie.length;
    function X(i) { return p + i * (w - 2 * p) / (n - 1); }
    function Y(v) { return h - p - (v - min) / amp * (h - 2 * p); }
    var pts = serie.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); });
    return '<svg class="faisca" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Tendência dos últimos 12 dias"><polyline class="f-base" points="' + pts.slice(0, n - 1).join(' ') + '"/><polyline class="f-hoje" points="' + pts.slice(n - 2).join(' ') + '"/><circle class="f-ponto" cx="' + X(n - 1).toFixed(1) + '" cy="' + Y(serie[n - 1]).toFixed(1) + '" r="4"/></svg>';
  }
  function ladrilho(k) {
    var pe = k.delta ? '<span class="delta ' + (k.delta.bom ? 'bom' : 'ruim') + '"><i aria-hidden="true">' + (k.delta.v >= 0 ? '▲' : '▼') + '</i>' + F.sinal(k.delta.v) + '</span><span class="ref">vs. ontem até agora</span>' : k.nota ? '<span class="ref">' + esc(k.nota) + '</span>' : '';
    return '<div class="ladrilho"><div class="l-rot">' + esc(k.rotulo) + '</div><div class="l-val">' + esc(k.valor) + '</div><div class="l-pe">' + pe + '</div>' + faisca(k.serie) + '</div>';
  }
  function titulo(t, sub, extra) { return '<div class="b-cab"><h3 class="b-tit">' + esc(t) + (sub ? ' <small>' + esc(sub) + '</small>' : '') + '</h3>' + (extra || '') + '</div>'; }
  function linkTorre(texto, destino) { return '<a class="bt bt-mini" href="index.html?semintro' + destino + '">' + esc(texto) + '</a>'; }

  /* ==========================================================================
     SEU NEGÓCIO (dados reais)
     ======================================================================== */
  function cartaoPlano() {
    var pl = S.planoLancamento(), P = T.PLANO;
    if (!pl.dia) {
      $('cPlano').innerHTML = titulo('Plano de 90 dias') + '<div class="vazio-grande"><p>Você ainda não começou o plano.</p><small>Quando começar, aqui aparece o dia, a fase e o que fazer.</small>' + linkTorre('Abrir o plano na torre', '#andar=9&livro=plano-3mil') + '</div>';
      return;
    }
    var dia = Math.min(pl.dia, P.dias), fz = P.fases[pl.fase], seg = P.fases.map(function (f, i) {
      var tam = f.dias[1] - f.dias[0] + 1, feito = Math.max(0, Math.min(tam, dia - f.dias[0] + 1));
      return '<span class="seg' + (i === pl.fase ? ' atual' : '') + '" style="flex:' + tam + '"' + dica(feito + ' de ' + tam + ' dias', 'Fase ' + (i + 1) + ': ' + f.nome) + '><i style="width:' + (feito / tam * 100).toFixed(1) + '%"></i></span>';
    }).join('');
    $('cPlano').innerHTML = titulo('Plano de 90 dias', 'com ' + F.brl(pl.capital) + ' de entrada', linkTorre('Abrir na torre', '#andar=9&livro=plano-3mil')) +
      '<div class="plano-heroi"><div><div class="h-val">' + (pl.terminou ? 'Concluído' : 'Dia ' + dia) + '</div><div class="h-rot">' + (pl.terminou ? 'os 90 dias terminaram' : 'de ' + P.dias + ' · fase ' + (pl.fase + 1) + ': ' + esc(fz.nome)) + '</div></div>' +
      '<p class="plano-obj"><b>Agora:</b> ' + esc(fz.objetivo) + '<br><b>Hoje:</b> ' + esc(fz.tarefas[0][0]) + '.</p></div>' +
      '<div class="segmentos" role="img" aria-label="Dia ' + dia + ' de ' + P.dias + ', fase ' + (pl.fase + 1) + ' de ' + P.fases.length + '">' + seg + '</div>' +
      '<div class="seg-rotulos">' + P.fases.map(function (f, i) { return '<span style="flex:' + (f.dias[1] - f.dias[0] + 1) + '"' + (i === pl.fase ? ' class="atual"' : '') + '>' + (i + 1) + '. ' + esc(f.nome) + '</span>'; }).join('') + '</div>';
  }
  function cartaoNumeros() {
    var pl = S.planoLancamento();
    $('cNumeros').innerHTML = titulo('Seus números', 'meta dos 90 dias', linkTorre('Anotar', '#andar=9&livro=plano-3mil')) + '<div class="medidores">' + pl.metas.map(function (m) {
      var atras = pl.dia && m.fracao + 0.1 < m.ritmo;
      return '<div class="ml-linha"' + dica((m.dinheiro ? F.brl(m.feito) : F.int(m.feito)) + ' de ' + (m.dinheiro ? F.brl(m.meta) : F.int(m.meta)), m.nome) + '><span class="ml-nome">' + esc(m.nome) + '</span>' + medidor(m.fracao, pl.dia ? m.ritmo : null, atras ? 'aviso' : '') +
        '<span class="ml-val">' + (m.dinheiro ? F.brl(m.feito) : F.int(m.feito)) + ' <small>de ' + (m.dinheiro ? F.brl(m.meta) : F.int(m.meta)) + '</small></span>' + (atras ? '<span class="selo aviso"><i aria-hidden="true">▲</i>abaixo do ritmo</span>' : '') + '</div>';
    }).join('') + '</div>' + (pl.dia ? '<p class="b-nota"><em class="md-ritmo exemplo"></em> onde você deveria estar no dia ' + Math.min(pl.dia, 90) + '</p>' : '');
  }
  function cartaoFunil() {
    var pl = S.planoLancamento(), m = {}; pl.metas.forEach(function (x) { m[x.id] = x.feito; });
    var etapas = [['Contatos', m.contatos], ['Conversas', m.conversas], ['Propostas', m.propostas], ['Vendas', m.vendas]];
    var html = titulo('Seu funil', 'de contato a venda');
    if (!m.contatos) { $('cFunil').innerHTML = html + '<p class="vazio">Anote os seus contatos no plano para ver aqui quanto vira conversa, proposta e venda.</p>'; return; }
    $('cFunil').innerHTML = html + barras(etapas.map(function (e, i) {
      var conv = i ? (etapas[i - 1][1] ? F.pct(e[1] / etapas[i - 1][1]) + ' da etapa anterior' : '—') : 'topo do funil';
      return { nome: e[0], v: e[1], texto: F.int(e[1]), extra: conv, cor: RAMPA[i] };
    }), 'funil com-extra');
  }
  function cartaoLancamento() {
    var lc = S.lancamento();
    $('cLancamento').innerHTML = titulo('Lançamento da empresa', lc.feitos + ' de ' + lc.total + ' passos', linkTorre('Checklist', '#andar=9&livro=lancamento')) +
      '<div class="md-grande"' + dica(F.pct(lc.fracao), 'do lançamento concluído') + '>' + medidor(lc.fracao) + '</div>' +
      '<ul class="fases-lista">' + lc.fases.map(function (f) {
        var ok = f.feitos === f.total;
        return '<li><span>' + (ok ? '<i class="ok" aria-hidden="true">✓</i>' : '') + esc(f.fase) + '</span><b>' + f.feitos + '/' + f.total + '</b></li>';
      }).join('') + '</ul>' + (lc.proximos.length ? '<p class="b-nota">Próximo: <b>' + esc(lc.proximos[0].texto) + '</b></p>' : '<p class="b-nota">Tudo concluído.</p>');
  }
  function cartaoDinheiro() {
    var d = S.planoLancamento().divisao;
    $('cDinheiro').innerHTML = titulo('Dinheiro de entrada', F.brl(d.valor) + ', dividido') + barras(d.linhas.map(function (l) {
      return { nome: l.nome, v: l.valor, texto: F.brl(l.valor), extra: l.quando, cor: l.id === 'reserva' ? '#7fb0ef' : '#3987e5' };
    }), 'com-extra dinheiro') + '<p class="b-nota">A reserva cobre cerca de ' + d.mesesDeFolego + (d.mesesDeFolego === 1 ? ' mês' : ' meses') + ' de custos fixos.</p>';
  }
  function cartaoLembretes() {
    var agora = new Date(), p = T.Lembretes.pendentes().slice(0, 6);
    $('cLembretes').innerHTML = titulo('Lembretes', p.length ? T.Lembretes.pendentes().length + ' pendentes' : '', linkTorre('Gerenciar', '&lembretes')) + (p.length ? '<ul class="lembretes-mini">' + p.map(function (l) {
      var d = new Date(l.quando), atras = d <= agora, k = F.chaveDia(d), hoje = F.chaveDia(agora);
      return '<li class="lembrete' + (atras ? ' atrasado' : '') + '"><div><p>' + esc(l.texto) + '</p><time>' + (k === hoje ? 'hoje' : F.dataMedia(d)) + ' às ' + F.hora(d) + '</time>' + (atras ? '<span class="selo critico"><i aria-hidden="true">✕</i>atrasado</span>' : '') + '</div>' +
        '<button class="bt-icone" type="button" data-ok="' + esc(l.id) + '" aria-label="Concluir: ' + esc(l.texto) + '" title="Concluir"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button></li>';
    }).join('') + '</ul>' : '<p class="vazio">Nenhum lembrete pendente. Peça ao Jarvis: “me lembre de ligar para a Ana amanhã às 10h”.</p>');
  }

  /* ==========================================================================
     OPERAÇÃO DA TORRE (simulada)
     ======================================================================== */
  function cartaoKpis() {
    var k = S.kpis(2), a = { rotulo: 'Agentes ativos agora', valor: F.int(S.agentesAtivos()), nota: 'de ' + F.int(T.TOTAIS.agentes) + ' em ' + T.ANDARES.length + ' andares' };
    $('cKpis').innerHTML = [k[3], k[2], k[0]].map(ladrilho).join('') + ladrilho(a);
  }
  function cartaoLinha() {
    var d = S.serie14(), W = 640, Hh = 220, mE = 52, mD = 70, mT = 12, mB = 26, pw = W - mE - mD, ph = Hh - mT - mB, n = d.length;
    var max = Math.max.apply(null, d.map(function (x) { return Math.max(x.receita, x.gastos); }));
    var passo = max > 160000 ? 50000 : max > 80000 ? 40000 : 20000, topo = Math.ceil(max / passo) * passo;
    function X(i) { return mE + i * pw / (n - 1); }
    function Y(v) { return mT + ph - v / topo * ph; }
    function linha(ch) { return d.map(function (x, i) { return X(i).toFixed(1) + ',' + Y(x[ch]).toFixed(1); }).join(' '); }
    var cab = titulo('Receita e gastos por dia', 'últimos 14 dias', '<button class="bt bt-mini" type="button" id="btTabela" aria-pressed="' + tabela14 + '">' + (tabela14 ? 'Ver gráfico' : 'Ver tabela') + '</button>');
    if (tabela14) {
      $('cLinha').innerHTML = cab + '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Dia</th><th class="num">Receita</th><th class="num">Gastos</th></tr></thead><tbody>' + d.slice().reverse().map(function (x) { return '<tr><td>' + F.dataMedia(x.d) + '</td><td class="num">' + F.brl(x.receita) + '</td><td class="num">' + F.brl(x.gastos) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      return;
    }
    var s = '<svg class="g14" id="g14" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" tabindex="0" aria-label="Receita e gastos por dia nos últimos 14 dias. Use as setas para percorrer os dias.">';
    for (var v = 0; v <= topo; v += passo) s += '<line class="g-grade" x1="' + mE + '" x2="' + (W - mD) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="g-eixo" x="' + (mE - 6) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end">' + (v ? F.compacto(v) : '0') + '</text>';
    [0, Math.floor((n - 1) / 2), n - 1].forEach(function (i) { s += '<text class="g-eixo" x="' + X(i) + '" y="' + (Hh - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '">' + F.dataCurta(d[i].d) + '</text>'; });
    s += '<polygon class="g-area" points="' + X(0) + ',' + Y(0) + ' ' + linha('receita') + ' ' + X(n - 1) + ',' + Y(0) + '"/><polyline class="g-linha g-gastos" points="' + linha('gastos') + '"/><polyline class="g-linha g-receita" points="' + linha('receita') + '"/>' +
      '<circle class="g-fim g-fim-gastos" cx="' + X(n - 1) + '" cy="' + Y(d[n - 1].gastos) + '" r="4"/><circle class="g-fim g-fim-receita" cx="' + X(n - 1) + '" cy="' + Y(d[n - 1].receita) + '" r="4"/>' +
      '<text class="g-rot" x="' + (X(n - 1) + 9) + '" y="' + (Y(d[n - 1].receita) + 4) + '">Receita</text><text class="g-rot" x="' + (X(n - 1) + 9) + '" y="' + (Y(d[n - 1].gastos) + 4) + '">Gastos</text>' +
      '<g id="g14Mira" visibility="hidden"><line class="g-mira" y1="' + mT + '" y2="' + (mT + ph) + '"/><circle class="g-fim g-fim-gastos" r="4"/><circle class="g-fim g-fim-receita" r="4"/></g></svg>';
    $('cLinha').innerHTML = cab + '<div class="legenda"><span><i class="chave k-receita"></i>Receita</span><span><i class="chave k-gastos"></i>Gastos</span></div>' + s;
    var svg = $('g14'), mira = $('g14Mira'), ln = mira.querySelector('line'), c = mira.querySelectorAll('circle'), atual = -1;
    function mostrar(i, cx, cy) {
      atual = Math.max(0, Math.min(n - 1, i));
      var x = X(atual), b = svg.getBoundingClientRect();
      ln.setAttribute('x1', x); ln.setAttribute('x2', x);
      c[0].setAttribute('cx', x); c[0].setAttribute('cy', Y(d[atual].gastos)); c[1].setAttribute('cx', x); c[1].setAttribute('cy', Y(d[atual].receita));
      mira.setAttribute('visibility', 'visible');
      mostrarDica(cx != null ? cx : b.left + x / W * b.width, cy != null ? cy : b.top + 30, F.dataMedia(d[atual].d), null, [{ cls: 'k-receita', valor: F.brl(d[atual].receita), nome: 'Receita' }, { cls: 'k-gastos', valor: F.brl(d[atual].gastos), nome: 'Gastos' }]);
    }
    function sumir() { mira.setAttribute('visibility', 'hidden'); $('dica').hidden = true; atual = -1; }
    svg.addEventListener('pointermove', function (e) { var b = svg.getBoundingClientRect(); mostrar(Math.round(((e.clientX - b.left) / b.width * W - mE) / pw * (n - 1)), e.clientX, e.clientY); });
    svg.addEventListener('pointerleave', sumir); svg.addEventListener('blur', sumir);
    svg.addEventListener('focus', function () { mostrar(n - 1); });
    svg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { mostrar((atual < 0 ? n : atual) - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { mostrar((atual < 0 ? -1 : atual) + 1); e.preventDefault(); }
    });
  }
  function cartaoProdutos() {
    var v = S.vendasPorPlano(), prods = (T.CATALOGO && T.CATALOGO.produtos) || [];
    var linhas = prods.map(function (p) { var q = v[p.nome + (p.mensal ? ' (mensal)' : '')] || 0; return { nome: p.nome, v: q, texto: F.int(q), extra: F.brl(q * p.preco) + ' em vendas' }; }).sort(function (a, b) { return b.v - a.v; });
    $('cProdutos').innerHTML = titulo('Vendas por produto', 'hoje') + barras(linhas, 'com-extra');
  }
  function cartaoAndares() {
    var linhas = T.ANDARES.map(function (a) {
      var at = a.agentes.filter(function (g) { return g.status === 'trabalhando' || g.status === 'reuniao'; }).length;
      return { nome: a.nome, v: at, texto: F.int(at), extra: F.pct(at / a.agentes.length) + ' de ' + F.int(a.agentes.length), cor: a.cor, ponto: a.cor };
    });
    $('cAndares').innerHTML = titulo('Agentes ativos por andar', 'agora') + barras(linhas, 'com-extra');
  }
  function cartaoOrcamento() {
    var f = S.financeiro();
    $('cOrcamento').innerHTML = titulo('Orçamento do mês', F.pct(f.ritmo) + ' do mês já passou') +
      '<div class="heroi"><div><div class="h-val">' + F.brlc(f.gastoMes) + '</div><div class="h-rot">gastos de ' + F.brlc(f.planejado) + ' planejados</div></div><div class="h-lado"><b>' + F.brlc(f.restante) + '</b><span>ainda disponíveis</span></div></div>' +
      '<div class="md-grande"' + dica(F.pct(f.usado), 'do orçamento já gasto') + '>' + medidor(f.usado, f.ritmo) + '</div><div class="medidores duas">' + f.categorias.map(function (c) {
        var est = c.usado >= 1 ? 'critico' : c.usado - f.ritmo > 0.05 ? 'aviso' : '';
        return '<div class="ml-linha"' + dica(F.brlc(c.gasto), c.nome + ' · ' + F.pct(c.usado) + ' de ' + F.brlc(c.planejado)) + '><span class="ml-nome">' + esc(c.nome) + '</span>' + medidor(c.usado, f.ritmo, est) +
          '<span class="ml-val">' + F.brlc(c.gasto) + ' <small>de ' + F.brlc(c.planejado) + '</small></span>' + (est ? '<span class="selo ' + est + '"><i aria-hidden="true">' + (est === 'critico' ? '✕' : '▲') + '</i>' + (est === 'critico' ? 'estourou' : 'acima do ritmo') + '</span>' : '') + '</div>';
      }).join('') + '</div>';
  }

  /* ==========================================================================
     DICA (tooltip) E AVISO
     ======================================================================== */
  function mostrarDica(x, y, valor, rotulo, linhas) {
    var el = $('dica'); el.textContent = '';
    var b = document.createElement('b'); b.textContent = valor; el.appendChild(b);
    if (rotulo) { var s = document.createElement('span'); s.textContent = rotulo; el.appendChild(s); }
    (linhas || []).forEach(function (l) { var dv = document.createElement('div'), k = document.createElement('i'), v = document.createElement('b'), nm = document.createElement('span'); k.className = 'chave ' + l.cls; v.textContent = l.valor; nm.textContent = l.nome; dv.appendChild(k); dv.appendChild(v); dv.appendChild(nm); el.appendChild(dv); });
    el.hidden = false;
    var w = el.offsetWidth, h = el.offsetHeight, px = Math.min(root.innerWidth - w - 10, Math.max(10, x + 14)), py = y - h - 14;
    if (py < 10) py = y + 18;
    el.style.transform = 'translate3d(' + Math.round(px) + 'px,' + Math.round(py) + 'px,0)';
  }
  document.addEventListener('pointermove', function (e) {
    var t = e.target.closest && e.target.closest('[data-dica]');
    if (t) { var p = t.dataset.dica.split('|'); mostrarDica(e.clientX, e.clientY, p[0], p.slice(1).join('|')); }
    else if (!(e.target.closest && e.target.closest('#g14'))) $('dica').hidden = true;
  });
  document.addEventListener('focusin', function (e) {
    var t = e.target.closest && e.target.closest('[data-dica]');
    if (t) { var p = t.dataset.dica.split('|'), b = t.getBoundingClientRect(); mostrarDica(b.left + b.width / 2, b.top, p[0], p.slice(1).join('|')); }
  });
  document.addEventListener('focusout', function (e) { if (e.target.closest && e.target.closest('[data-dica]')) $('dica').hidden = true; });
  var tAviso = null;
  function aviso(texto) {
    var el = $('aviso'); el.textContent = texto; el.hidden = false; el.classList.add('on');
    clearTimeout(tAviso); tAviso = setTimeout(function () { el.classList.remove('on'); setTimeout(function () { el.hidden = true; }, 300); }, 6000);
  }

  /* ==========================================================================
     MONTAGEM
     ======================================================================== */
  function desenharReal() { cartaoPlano(); cartaoNumeros(); cartaoFunil(); cartaoLancamento(); cartaoDinheiro(); cartaoLembretes(); }
  function desenharSim() { cartaoKpis(); cartaoLinha(); cartaoProdutos(); cartaoAndares(); cartaoOrcamento(); }
  function relogio() { var d = new Date(); $('pgData').textContent = F.dataLonga(d) + ' · ' + F.hora(d); }
  function tudo() {
    S.preparar();              /* relê o que você salvou na torre e recalcula a simulação do dia */
    var foco = document.activeElement && document.activeElement.closest && document.activeElement.closest('.cartao');
    if (!foco) { desenharReal(); desenharSim(); } else { desenharSim(); }
    relogio();
  }

  T.gerar();
  tudo();
  var marca = document.querySelector('[data-empresa-curto]');
  if (marca) marca.textContent = S.nomeEmpresa().split(/\s+/)[0].toUpperCase();
  document.title = 'Dashboard — ' + S.nomeEmpresa();
  setInterval(tudo, 20000);
  setInterval(relogio, 30000);

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-ok],#btTabela');
    if (!t) return;
    if (t.id === 'btTabela') { tabela14 = !tabela14; cartaoLinha(); $('btTabela').focus(); return; }
    T.Lembretes.concluir(t.dataset.ok); aviso('Lembrete concluído.');
  });
  T.Lembretes.aoMudar(cartaoLembretes);
  T.vigiarLembretes(function (l) {
    aviso('⏰ Lembrete: ' + l.texto);
    try { if (root.speechSynthesis) { var u = new root.SpeechSynthesisUtterance('Lembrete: ' + l.texto); u.lang = 'pt-BR'; root.speechSynthesis.speak(u); } } catch (e) { /* sem voz: o aviso na tela basta */ }
    cartaoLembretes();
  });
  /* outra aba mudou o plano, a checklist ou os números: redesenha a parte real */
  root.addEventListener('storage', function (e) { if (e.key && /^torre\.(plano|lancamento|lidos)/.test(e.key)) { S.preparar(); desenharReal(); } });
})(window);
