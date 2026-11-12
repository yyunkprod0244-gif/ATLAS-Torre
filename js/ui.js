/* ============================================================================
   TORRE — interface (painéis, listas, gráficos, avisos)
   ----------------------------------------------------------------------------
   Regras de desenho dos gráficos usadas aqui:
   · a cor do andar pinta as MARCAS (barras, pontos); o texto fica sempre nas
     cores de texto, para continuar legível;
   · barras finas, ponta arredondada, valor escrito ao lado da barra;
   · verde/amarelo/vermelho só aparecem para estado (bom, atenção, crítico) e
     sempre junto de um ícone e de um rótulo;
   · todo valor de gráfico também aparece escrito (ou na tabela), nunca só na
     dica que aparece ao passar o mouse.
   ========================================================================== */
(function (root) {
  'use strict';
  var T = root.Torre, F = T.fmt, esc = T.esc, S = null, cena = null;
  var $ = function (id) { return document.getElementById(id); };

  /* fichaAberta: { n, i } = ficha de um agente · { livro: id } = livro aberto para leitura.
     salaAberta: índice da sala (squad) em que a câmera está, ou -1. */
  var andarAberto = 0, abaAtual = 'geral', salaAberta = -1, fichaAberta = null, blocos = [], listaV = null, filtro = {}, tabela14 = false;
  var RAMPA_FUNIL = ['#7e3416', '#ad471e', '#db6333', '#e89b7d']; /* rampa de um só tom, validada */

  var ICO = {
    fechar: 'M6 6l12 12M18 6L6 18', voltar: 'M15 5l-7 7 7 7',
    alvo: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v4M12 18v4M2 12h4M18 12h4',
    torre: 'M8 21V7l4-4 4 4v14M5 21h14M10 10h4M10 13.5h4M10 17h4',
    resumo: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
    som: 'M4 10v4h3l5 4V6L7 10H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
    copiar: 'M9 9h10v11H9zM5 15V4h10',
    livro: 'M12 6.5C9.8 4.9 7 4.5 4 5v13c3-.5 5.8-.1 8 1.5 2.2-1.6 5-2 8-1.5V5c-3-.5-5.8-.1-8 1.5zM12 6.5v13',
    certo: 'M5 12.5l4.5 4.5L19 7.5',
    externo: 'M14 5h5v5M19 5l-8 8M11 7H6v11h11v-5'
  };
  function ico(c, cls) { return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + c + '"/></svg>'; }
  function ord(n) { return n + 'º'; }
  function ponto(cor) { return '<span class="ponto" style="--c:' + cor + '"></span>'; }
  function dica(valor, rotulo) { return ' tabindex="0" data-dica="' + esc(valor + '|' + rotulo) + '"'; }

  var ESTADOS = {
    trabalhando: { nome: 'Trabalhando', sinal: '●' }, reuniao: { nome: 'Em reunião', sinal: '◆' },
    ocioso: { nome: 'Livre', sinal: '○' }, pausa: { nome: 'Em pausa', sinal: '‖' }
  };
  function selo(status) { var e = ESTADOS[status] || ESTADOS.ocioso; return '<span class="estado e-' + status + '"><i aria-hidden="true">' + e.sinal + '</i>' + e.nome + '</span>'; }

  /* ==========================================================================
     GRÁFICOS
     ======================================================================== */
  function faisca(serie) {
    if (!serie) return '';
    var w = 180, h = 30, p = 5, min = Math.min.apply(null, serie), max = Math.max.apply(null, serie), amp = (max - min) || 1, n = serie.length;
    function X(i) { return p + i * (w - 2 * p) / (n - 1); }
    function Y(v) { return h - p - (v - min) / amp * (h - 2 * p); }
    var pts = serie.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); });
    return '<svg class="faisca" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Tendência dos últimos 12 dias; o último ponto é a projeção de hoje">' +
      '<polyline class="f-base" points="' + pts.slice(0, n - 1).join(' ') + '"/><polyline class="f-hoje" points="' + pts.slice(n - 2).join(' ') + '"/>' +
      '<circle class="f-ponto" cx="' + X(n - 1).toFixed(1) + '" cy="' + Y(serie[n - 1]).toFixed(1) + '" r="4"/></svg>';
  }
  function ladrilho(k) {
    var pe = '';
    if (k.delta) pe = '<span class="delta ' + (k.delta.bom ? 'bom' : 'ruim') + '"><i aria-hidden="true">' + (k.delta.v >= 0 ? '▲' : '▼') + '</i>' + F.sinal(k.delta.v) + '</span><span class="ref">vs. ontem até agora</span>';
    else if (k.nota) pe = '<span class="ref">' + esc(k.nota) + '</span>';
    return '<div class="ladrilho"><div class="l-rot">' + esc(k.rotulo) + '</div><div class="l-val">' + esc(k.valor) + '</div><div class="l-pe">' + pe + '</div>' + faisca(k.serie) + '</div>';
  }
  /* linhas: [{ nome, sub, v, texto, extra, cor }] — barras em ordem, valor na ponta */
  function barras(linhas, o) {
    o = o || {};
    var max = Math.max.apply(null, linhas.map(function (l) { return l.v; })) || 1;
    return '<div class="barras' + (o.cls ? ' ' + o.cls : '') + '">' + linhas.map(function (l) {
      return '<div class="br-linha"' + dica(l.texto, l.nome + (l.extra ? ' · ' + l.extra : '')) + '>' +
        '<span class="br-nome">' + (l.ponto ? ponto(l.ponto) : '') + esc(l.nome) + (l.sub ? '<small>' + esc(l.sub) + '</small>' : '') + '</span>' +
        '<span class="br-trilho"><i class="br-barra" style="width:' + Math.max(1.5, l.v / max * 100).toFixed(1) + '%' + (l.cor ? ';background:' + l.cor : '') + '"></i><b class="br-val">' + esc(l.texto) + '</b></span>' +
        (l.extra ? '<span class="br-extra">' + esc(l.extra) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function medidor(fracao, ritmo, estado) {
    return '<span class="md-trilho ' + (estado || '') + '"><i class="md-barra" style="width:' + Math.min(100, fracao * 100).toFixed(1) + '%"></i>' +
      (ritmo != null ? '<em class="md-ritmo" style="left:' + Math.min(100, ritmo * 100).toFixed(1) + '%"></em>' : '') + '</span>';
  }

  /* gráfico de linhas: receita × gastos nos últimos 14 dias */
  function grafico14() {
    var d = S.serie14(), W = 400, Hh = 178, mE = 46, mD = 62, mT = 10, mB = 24, pw = W - mE - mD, ph = Hh - mT - mB;
    var max = Math.max.apply(null, d.map(function (x) { return Math.max(x.receita, x.gastos); }));
    var passo = max > 160000 ? 50000 : max > 80000 ? 40000 : 20000, topo = Math.ceil(max / passo) * passo, n = d.length;
    function X(i) { return mE + i * pw / (n - 1); }
    function Y(v) { return mT + ph - v / topo * ph; }
    function linha(ch) { return d.map(function (x, i) { return X(i).toFixed(1) + ',' + Y(x[ch]).toFixed(1); }).join(' '); }
    var s = '<svg class="g14" id="g14" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" tabindex="0" aria-label="Receita e gastos por dia nos últimos 14 dias. Use as setas para percorrer os dias.">';
    for (var v = 0; v <= topo; v += passo) s += '<line class="g-grade" x1="' + mE + '" x2="' + (W - mD) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="g-eixo" x="' + (mE - 6) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end">' + (v ? F.compacto(v) : '0') + '</text>';
    [0, Math.floor((n - 1) / 2), n - 1].forEach(function (i) { s += '<text class="g-eixo" x="' + X(i) + '" y="' + (Hh - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '">' + F.dataCurta(d[i].d) + '</text>'; });
    s += '<polygon class="g-area" points="' + X(0) + ',' + Y(0) + ' ' + linha('receita') + ' ' + X(n - 1) + ',' + Y(0) + '"/>' +
      '<polyline class="g-linha g-gastos" points="' + linha('gastos') + '"/><polyline class="g-linha g-receita" points="' + linha('receita') + '"/>' +
      '<circle class="g-fim g-fim-gastos" cx="' + X(n - 1) + '" cy="' + Y(d[n - 1].gastos) + '" r="4"/><circle class="g-fim g-fim-receita" cx="' + X(n - 1) + '" cy="' + Y(d[n - 1].receita) + '" r="4"/>' +
      '<text class="g-rot" x="' + (X(n - 1) + 9) + '" y="' + (Y(d[n - 1].receita) + 4) + '">Receita</text><text class="g-rot" x="' + (X(n - 1) + 9) + '" y="' + (Y(d[n - 1].gastos) + 4) + '">Gastos</text>' +
      '<g id="g14Mira" visibility="hidden"><line class="g-mira" y1="' + mT + '" y2="' + (mT + ph) + '"/><circle class="g-fim g-fim-gastos" r="4"/><circle class="g-fim g-fim-receita" r="4"/></g></svg>';
    return s;
  }
  function tabela14HTML() {
    return '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Dia</th><th class="num">Receita</th><th class="num">Gastos</th></tr></thead><tbody>' +
      S.serie14().slice().reverse().map(function (x) { return '<tr><td>' + F.dataMedia(x.d) + '</td><td class="num">' + F.brl(x.receita) + '</td><td class="num">' + F.brl(x.gastos) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function ligarGrafico14() {
    var svg = $('g14'); if (!svg) return;
    var d = S.serie14(), n = d.length, mira = $('g14Mira'), W = 400, mE = 46, mD = 62, pw = W - mE - mD, atual = -1;
    var linha = mira.querySelector('line'), c1 = mira.querySelectorAll('circle')[0], c2 = mira.querySelectorAll('circle')[1];
    var max = Math.max.apply(null, d.map(function (x) { return Math.max(x.receita, x.gastos); }));
    var passo = max > 160000 ? 50000 : max > 80000 ? 40000 : 20000, topo = Math.ceil(max / passo) * passo;
    function Y(v) { return 10 + 144 - v / topo * 144; }
    function mostrar(i, cx, cy) {
      atual = Math.max(0, Math.min(n - 1, i));
      var x = mE + atual * pw / (n - 1), b = svg.getBoundingClientRect();
      linha.setAttribute('x1', x); linha.setAttribute('x2', x);
      c1.setAttribute('cx', x); c1.setAttribute('cy', Y(d[atual].gastos)); c2.setAttribute('cx', x); c2.setAttribute('cy', Y(d[atual].receita));
      mira.setAttribute('visibility', 'visible');
      mostrarDica(cx != null ? cx : b.left + x / W * b.width, cy != null ? cy : b.top + 30, F.dataMedia(d[atual].d), null,
        [{ cls: 'k-receita', valor: F.brl(d[atual].receita), nome: 'Receita' }, { cls: 'k-gastos', valor: F.brl(d[atual].gastos), nome: 'Gastos' }]);
    }
    function sumir() { mira.setAttribute('visibility', 'hidden'); esconderDica(); atual = -1; }
    svg.addEventListener('pointermove', function (e) { var b = svg.getBoundingClientRect(); mostrar(Math.round(((e.clientX - b.left) / b.width * W - mE) / pw * (n - 1)), e.clientX, e.clientY); });
    svg.addEventListener('pointerleave', sumir);
    svg.addEventListener('blur', sumir);
    svg.addEventListener('focus', function () { mostrar(n - 1); });
    svg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { mostrar((atual < 0 ? n : atual) - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { mostrar((atual < 0 ? -1 : atual) + 1); e.preventDefault(); }
    });
  }

  /* ==========================================================================
     BLOCOS DE CADA ANDAR (aba "Visão geral")
     vivo: true → o bloco é redesenhado a cada segundo com os números novos
     ======================================================================== */
  var B = {
    kpis: { vivo: true, render: function (n) { return '<div class="ladrilhos">' + S.kpis(n).map(ladrilho).join('') + '</div>'; } },

    /* as salas do andar (uma por squad): clicar leva a câmera para dentro da sala */
    salas: {
      render: function (n) {
        var a = T.andar(n), trab = a.squads.map(function () { return 0; });
        a.agentes.forEach(function (g) { if (g.status === 'trabalhando') trab[g.squad]++; });
        var s = '<h3 class="b-tit">Salas do andar <small>clique para entrar e ver por dentro</small></h3><div class="salas">' + a.squads.map(function (q, k) {
          return '<button class="sala-bt' + (k === salaAberta ? ' on' : '') + '" type="button" data-sala="' + k + '"' + (k === salaAberta ? ' aria-current="true"' : '') + '><i>' + (k + 1) + '</i><span><b>' + esc(q.nome) + '</b><small>' + F.int(q.qtd) + ' agentes · ' + F.int(trab[k]) + ' ativos</small></span></button>';
        }).join('') + '</div>';
        if (salaAberta >= 0 && a.squads[salaAberta]) {
          var q = a.squads[salaAberta], inv = T.inventario(a, salaAberta);
          s += '<div class="sala sala-ficha" id="salaFicha"><div class="sala-topo"><span class="tag">Sala ' + a.n + '.' + (salaAberta + 1) + '</span><span class="aovivo"><i></i>' + F.int(trab[salaAberta]) + ' de ' + F.int(q.qtd) + ' trabalhando</span></div>' +
            '<p class="sala-tit">' + esc(q.nome) + '</p><p class="sala-txt">Cargos: ' + esc(q.cargos.join(' e ')) + '.</p>' +
            '<p class="sala-txt">Mobília montada sozinha: ' + F.int(inv.estacoes) + ' estações de trabalho (mesa, computador e cadeira)' + inv.itens.map(function (x) { return ', ' + x.texto; }).join('') + '.</p>' +
            (function () {
              var ext = T.skillsExternasDe ? T.skillsExternasDe(n, salaAberta) : [];
              return ext.length ? '<p class="sala-txt">Skill externa desta sala: ' + ext.map(function (s) { return '<a href="#ext-' + esc(s.id) + '" data-ext="' + esc(s.id) + '">' + esc(s.nome) + '</a>'; }).join(', ') + ' (não instalada).</p>' : '';
            })() +
            '<p class="b-nota">Arraste para girar, use a roda do mouse para aproximar e clique em um agente para abrir a ficha.</p>' +
            '<div class="sala-acoes"><button class="bt bt-cor bt-mini" type="button" data-acao="agentesDaSala">Ver agentes da sala</button><button class="bt bt-mini" type="button" data-acao="fecharSala">' + ico(ICO.voltar) + 'Voltar para o andar</button></div></div>';
        }
        return s;
      }
    },

    /* projetos reais do GitHub ligados a este andar (js/skills-externas.js): só catalogados, não instalados */
    externas: {
      render: function (n) {
        var lista = T.skillsExternasDe ? T.skillsExternasDe(n) : [], a = T.andar(n), grupos = [];
        if (!lista.length) return '';
        /* agrupadas por sala, na ordem das salas do andar */
        a.squads.forEach(function (q, k) {
          var daSala = lista.filter(function (s) { return T.lugarDaSkill(s).k === k; });
          if (daSala.length) grupos.push('<h4 class="ag-grupo"><button class="ex-sala" type="button" data-sala="' + k + '">Sala ' + esc(q.nome) + '</button></h4>' + daSala.map(function (s) { return cartaoExterna(s); }).join(''));
        });
        return '<h3 class="b-tit">Skills externas <small>' + lista.length + ' ' + (lista.length === 1 ? 'projeto' : 'projetos') + ' do GitHub ligados a este andar</small></h3><div class="externas">' + grupos.join('') + '</div>' +
          '<p class="b-nota">Antes de instalar qualquer skill, passe-a pelo SkillSpector e leia o código: ela roda com as mesmas permissões do seu agente.</p>';
      }
    },

    /* a biblioteca do andar de estudo: cada livro é um conteúdo diferente */
    estante: {
      render: function (n) {
        var a = T.andar(n), lc = S.lancamento(), pl = S.planoLancamento(), acervo = T.BIBLIOTECA || [];
        var s = '<h3 class="b-tit">Estante <small>cada livro é um conteúdo diferente</small></h3>';
        a.squads.forEach(function (q, k) {
          var livros = acervo.filter(function (b) { return b.sala === k; });
          if (!livros.length) return;
          s += '<div class="prateleira"><h4 class="ag-grupo">' + esc(q.nome) + '</h4><div class="livros">' + livros.map(function (b) {
            var lido = S.lido(b.id), selo = b.tipo === 'lancamento' ? lc.feitos + ' de ' + lc.total + ' passos' : b.tipo === 'plano' && pl.dia ? 'Dia ' + Math.min(pl.dia, 90) + ' de 90' : b.tipo ? 'Guia prático' : b.min + ' min';
            return '<button class="livro' + (lido ? ' lido' : '') + '" type="button" data-livro="' + esc(b.id) + '" style="--capa:' + (q.corLivro || a.cor) + '"><span class="lv-selo">' + esc(selo) + '</span><b>' + esc(b.titulo) + '</b><small>' + esc(b.sub) + '</small>' +
              (lido ? '<span class="lv-lido">' + ico(ICO.certo) + 'lido</span>' : '') + '</button>';
          }).join('') + '</div></div>';
        });
        return s + '<p class="b-nota">Os livros também estão na estante giratória no centro do andar: clique em uma capa para abrir.</p>';
      }
    },

    registrar: {
      render: function () {
        return '<h3 class="b-tit">Registrar informação</h3><form class="form-linha" id="formInfo"><input name="texto" maxlength="240" required autocomplete="off" placeholder="Ex.: Cliente Ana quer orçamento de loja virtual" aria-label="Informação para registrar"><button class="bt bt-cor" type="submit">Enviar</button></form>' +
          '<p class="b-nota">O Mega Brain lê o texto e entrega ao andar certo. O que você registrar fica salvo neste navegador.</p>';
      }
    },
    caixa: {
      vivo: true, render: function () {
        return '<h3 class="b-tit">Caixa de entrada <small>últimas chegadas</small></h3><ul class="lista">' + S.estado.inbox.slice(0, 7).map(function (it) {
          var d = T.andar(it.destino);
          return '<li class="item' + (it.usuario ? ' meu' : '') + '"><div class="it-topo"><span class="tag">' + esc(it.origem) + '</span><time>' + F.hora(it.t) + '</time></div><p>' + esc(it.texto) + '</p><div class="rota">' + ponto(d.cor) + 'entregue a ' + esc(d.nome) + '</div></li>';
        }).join('') + '</ul>';
      }
    },

    funil: {
      vivo: true, render: function () {
        var f = S.funil(), topo = f[0].v || 1;
        return '<h3 class="b-tit">Funil de hoje <small>do contato à venda</small></h3><div class="barras funil">' + f.map(function (e, i) {
          var passa = i ? F.pct(f[i - 1].v ? e.v / f[i - 1].v : 0) + ' da etapa anterior' : 'topo do funil';
          return '<div class="br-linha"' + dica(F.int(e.v), e.nome + ' · ' + passa) + '><span class="br-nome">' + esc(e.nome) + '</span><span class="br-trilho"><i class="br-barra" style="width:' + Math.max(1.5, e.v / topo * 100).toFixed(1) + '%;background:' + RAMPA_FUNIL[i] + '"></i><b class="br-val">' + F.int(e.v) + '</b></span><span class="br-extra">' + passa + '</span></div>';
        }).join('') + '</div>';
      }
    },
    vendas: {
      vivo: true, render: function () {
        var v = S.estado.vendas.slice(0, 6);
        return '<h3 class="b-tit">Últimas vendas</h3>' + (v.length ? '<ul class="lista">' + v.map(function (x) {
          return '<li class="item item-linha"><div><p>' + esc(x.cliente) + '</p><small>' + esc(x.plano) + ' · ' + F.hora(x.t) + '</small></div><b class="num">' + F.brl(x.valor) + '</b></li>';
        }).join('') + '</ul>' : '<p class="vazio">Nenhuma venda registrada hoje ainda.</p>');
      }
    },

    campanhas: {
      vivo: true, render: function () {
        var c = S.estado.campanhas.slice().sort(function (a, b) { return b.leads - a.leads; });
        return '<h3 class="b-tit">Campanhas ativas <small>leads gerados hoje</small></h3>' + barras(c.map(function (x) {
          return { nome: x.nome, sub: x.canal, v: x.leads, texto: F.int(x.leads), extra: F.brl2(x.invest / Math.max(1, x.leads)) + ' por lead' };
        }), { cls: 'com-extra' });
      }
    },

    fila: {
      vivo: true, render: function () {
        var cor = T.andar(4).cor;
        return '<h3 class="b-tit">Fila de produção <small>ao vivo</small></h3><ul class="lista fila">' + S.estado.fila.map(function (v) {
          var e = S.etapaDe(v), seg = '';
          for (var i = 0; i < 4; i++) seg += '<i style="--p:' + (i < e.indice ? 100 : i === e.indice ? Math.round(e.progresso * 100) : 0) + '%"></i>';
          return '<li class="item item-midia"><span class="mini">' + T.thumb(v.id, cor) + '</span><div class="grow"><p>' + esc(v.titulo) + '</p><span class="etapas" role="img" aria-label="Etapa ' + (e.indice + 1) + ' de 4: ' + e.nome + '">' + seg + '</span><small>' + e.nome + ' · ' + Math.round(e.progresso * 100) + '%</small></div></li>';
        }).join('') + '</ul>';
      }
    },

    redes: {
      vivo: true, render: function () {
        var p = S.estado.plataformas.slice().sort(function (a, b) { return b.views - a.views; });
        return '<h3 class="b-tit">Visualizações por rede <small>hoje</small></h3>' + barras(p.map(function (x) { return { nome: x.nome, v: x.views, texto: F.compacto(x.views), extra: F.int(x.posts) + ' posts' }; }), { cls: 'com-extra' });
      }
    },
    posts: {
      vivo: true, render: function () {
        var cor = T.andar(5).cor;
        return '<h3 class="b-tit">Acabou de sair</h3><ul class="lista">' + S.estado.posts.slice(0, 5).map(function (p) {
          return '<li class="item item-midia"><span class="mini">' + T.thumb(p.titulo, cor, false) + '</span><div class="grow"><p>' + esc(p.titulo) + '</p><small><span class="tag">' + esc(p.plataforma) + '</span> ' + F.hora(p.t) + ' · ' + F.compacto(p.views) + ' visualizações</small></div></li>';
        }).join('') + '</ul>';
      }
    },

    orcamento: {
      vivo: true, render: function () {
        var f = S.financeiro(), porDia = f.diasRestantes > 0 ? f.restante / f.diasRestantes : f.restante;
        var s = '<h3 class="b-tit">Quanto dá para gastar no mês</h3><div class="heroi"><div><div class="h-val">' + F.brlc(f.gastoMes) + '</div><div class="h-rot">gastos de ' + F.brlc(f.planejado) + ' planejados</div></div><div class="h-lado"><b>' + F.brlc(f.restante) + '</b><span>ainda disponíveis' + (f.diasRestantes > 0 ? ' · ' + F.brlc(porDia) + ' por dia' : '') + '</span></div></div>' +
          '<div class="md-grande"' + dica(F.pct(f.usado), 'do orçamento do mês já gasto · ' + F.pct(f.ritmo) + ' do mês já passou') + '>' + medidor(f.usado, f.ritmo) + '</div>' +
          '<p class="b-nota"><em class="md-ritmo exemplo"></em> A marca vertical mostra o ritmo ideal: ' + F.pct(f.ritmo) + ' do mês já passou.</p><div class="medidores">';
        f.categorias.forEach(function (c) {
          var est = c.usado >= 1 ? 'critico' : c.usado - f.ritmo > 0.05 ? 'aviso' : '';
          s += '<div class="ml-linha"' + dica(F.brlc(c.gasto), c.nome + ' · ' + F.pct(c.usado) + ' de ' + F.brlc(c.planejado)) + '><span class="ml-nome">' + esc(c.nome) + '</span>' + medidor(c.usado, f.ritmo, est) +
            '<span class="ml-val">' + F.brlc(c.gasto) + ' <small>de ' + F.brlc(c.planejado) + '</small></span>' +
            (est ? '<span class="selo ' + est + '"><i aria-hidden="true">' + (est === 'critico' ? '✕' : '▲') + '</i>' + (est === 'critico' ? 'estourou o limite' : 'acima do ritmo') + '</span>' : '') + '</div>';
        });
        return s + '</div>';
      }
    },
    linha14: {
      render: function () {
        return '<div class="b-cab"><h3 class="b-tit">Receita e gastos por dia <small>últimos 14 dias</small></h3><button class="bt bt-mini" id="btTabela14" type="button" aria-pressed="' + tabela14 + '">' + (tabela14 ? 'Ver gráfico' : 'Ver tabela') + '</button></div>' +
          (tabela14 ? tabela14HTML() : '<div class="legenda"><span><i class="chave k-receita"></i>Receita</span><span><i class="chave k-gastos"></i>Gastos</span></div>' + grafico14());
      },
      depois: ligarGrafico14
    },
    contas: {
      render: function () {
        return '<h3 class="b-tit">Contas do mês</h3><table class="tabela"><thead><tr><th>Conta</th><th>Vencimento</th><th class="num">Valor</th></tr></thead><tbody>' + S.contas().map(function (c) {
          var quando = c.paga ? '<span class="selo ok"><i aria-hidden="true">✓</i>paga</span>' : c.falta === 0 ? '<span class="selo aviso"><i aria-hidden="true">▲</i>vence hoje</span>' : c.falta <= 2 ? '<span class="selo aviso"><i aria-hidden="true">▲</i>em ' + c.falta + (c.falta === 1 ? ' dia' : ' dias') + '</span>' : 'dia ' + c.dia;
          return '<tr><td>' + esc(c.nome) + '</td><td>' + quando + '</td><td class="num">' + F.brl(c.valor) + '</td></tr>';
        }).join('') + '</tbody></table>';
      }
    },

    sala: {
      vivo: true, render: function () {
        var s = S.salaAoVivo();
        if (!s.reuniao) return '<h3 class="b-tit">Sala ao vivo</h3><div class="sala vazia"><p>Nenhuma reunião acontecendo agora.</p>' + (s.proxima ? '<small>Próxima: ' + esc(s.proxima.titulo) + ' às ' + F.hora(s.proxima.inicio) + '</small>' : '') + '</div>';
        var m = s.reuniao;
        return '<h3 class="b-tit">Sala ao vivo <small>' + (s.outras ? 'e mais ' + s.outras + ' em paralelo' : 'acontecendo agora') + '</small></h3><div class="sala"><div class="sala-topo"><span class="aovivo"><i></i>ao vivo</span><time>' + F.hora(m.inicio) + '–' + F.hora(m.fim) + '</time></div>' +
          '<p class="sala-tit">' + esc(m.titulo) + '</p><div class="rota">' + m.andares.map(function (n) { return ponto(T.andar(n).cor) + esc(T.andar(n).nome); }).join('<span class="sep">·</span>') + '</div>' +
          '<div class="md-grande">' + medidor(s.progresso) + '</div><div class="sala-cols"><div><h4>Pauta</h4><ol>' + s.pauta.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol></div>' +
          '<div><h4>Anotações da ata</h4>' + (s.notas.length ? '<ul>' + s.notas.slice(0, 4).map(function (x) { return '<li><time>' + F.hora(x.t) + '</time> ' + esc(x.texto) + '</li>'; }).join('') + '</ul>' : '<p class="vazio">A ata começa em instantes.</p>') + '</div></div></div>';
      }
    },
    formReuniao: {
      render: function () {
        var d = new Date(Date.now() + 30 * 60000); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
        return '<h3 class="b-tit">Marcar reunião</h3><form class="form-reuniao" id="formReuniao"><label>Assunto<input name="titulo" required maxlength="90" autocomplete="off" placeholder="Ex.: Apresentar proposta para a Pizzaria Bela Vista"></label>' +
          '<div class="campos3"><label>Dia<input type="date" name="dia" required value="' + F.chaveDia(d) + '"></label><label>Hora<input type="time" name="hora" required value="' + F.hora(d) + '"></label><label>Duração<select name="dur"><option value="15">15 min</option><option value="30" selected>30 min</option><option value="45">45 min</option><option value="60">1 hora</option></select></label></div>' +
          '<fieldset><legend>Quem participa</legend><div class="chips">' + T.ANDARES.map(function (a) {
            return '<label class="chip"><input type="checkbox" name="andar" value="' + a.n + '"' + (a.n === 7 ? ' checked disabled' : '') + '>' + ponto(a.cor) + esc(a.nome) + '</label>';
          }).join('') + '</div></fieldset><button class="bt bt-cor" type="submit">Marcar reunião</button></form>';
      }
    },
    agenda: {
      render: function () {
        var todas = S.reunioes(), agora = new Date(), hojeK = F.chaveDia(agora), amanhaK = F.chaveDia(new Date(agora.getTime() + 86400000));
        var visiveis = todas.filter(function (m) { return m.tipo !== 'auto' && m.estado !== 'concluida'; }), autos = todas.filter(function (m) { return m.tipo === 'auto' && m.estado === 'agendada'; }).length;
        function grupo(titulo, lista) {
          if (!lista.length) return '';
          return '<h4 class="ag-grupo">' + titulo + '</h4><ul class="lista">' + lista.map(function (m) {
            return '<li class="item item-linha"><div><p>' + esc(m.titulo) + '</p><small><time>' + (titulo === 'Depois' ? F.dataMedia(m.inicio) + ' · ' : '') + F.hora(m.inicio) + '–' + F.hora(m.fim) + '</time> · ' + m.andares.map(function (n) { return ponto(T.andar(n).cor); }).join('') + ' ' + m.andares.length + ' andares' + (m.origem === 'jarvis' ? ' · marcada pelo Jarvis' : m.tipo === 'usuario' ? ' · marcada por você' : '') + '</small></div>' +
              (m.estado === 'andamento' ? '<span class="aovivo"><i></i>agora</span>' : '') + (m.tipo === 'usuario' ? '<button class="bt-icone" type="button" data-remover="' + esc(m.id) + '" aria-label="Desmarcar ' + esc(m.titulo) + '">' + ico(ICO.fechar) + '</button>' : '') + '</li>';
          }).join('') + '</ul>';
        }
        var html = grupo('Hoje', visiveis.filter(function (m) { return F.chaveDia(m.inicio) === hojeK; })) + grupo('Amanhã', visiveis.filter(function (m) { return F.chaveDia(m.inicio) === amanhaK; })) +
          grupo('Depois', visiveis.filter(function (m) { var k = F.chaveDia(m.inicio); return k !== hojeK && k !== amanhaK; }));
        return '<h3 class="b-tit">Agenda</h3>' + (html || '<p class="vazio">Nada marcado.</p>') + '<p class="b-nota">Além destas, há ' + autos + ' sincronizações automáticas entre andares, de hora em hora.</p>';
      }
    },

    resumo: {
      vivo: true, render: function () {
        var r = S.resumo();
        return '<div class="b-cab"><h3 class="b-tit">Resumo do dia <small>escrito pelo Mega Brain</small></h3><button class="bt bt-mini" type="button" data-acao="resumo">Abrir completo</button></div><ul class="resumo-linhas">' + r.linhas.map(function (l) {
          var a = T.andar(l.n); return '<li>' + ponto(a.cor) + '<div><b>' + esc(a.nome) + '</b><p>' + esc(l.texto) + '</p></div></li>';
        }).join('') + '</ul>';
      }
    },
    fluxo: {
      vivo: true, render: function () {
        var l = T.ANDARES.map(function (a, i) { var v = S.estado.porAndar[i].eventos; return { nome: a.nome, v: v, texto: F.compacto(v), cor: a.cor, ponto: a.cor }; }).sort(function (a, b) { return b.v - a.v; });
        return '<h3 class="b-tit">Mensagens por andar <small>hoje</small></h3>' + barras(l);
      }
    },
    historico: {
      render: function () {
        return '<h3 class="b-tit">Últimos 7 dias</h3><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Dia</th><th class="num">Leads</th><th class="num">Vendas</th><th class="num">Receita</th><th class="num">Vídeos</th><th class="num">Posts</th></tr></thead><tbody>' + S.historico7().slice().reverse().map(function (x) {
          return '<tr><td>' + F.dataMedia(x.d) + '</td><td class="num">' + F.int(x.leads) + '</td><td class="num">' + F.int(x.vendas) + '</td><td class="num">' + F.brlc(x.receita) + '</td><td class="num">' + F.int(x.videos) + '</td><td class="num">' + F.int(x.posts) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      }
    }
  };
  var PLANTA = {
    1: ['kpis', 'salas', 'registrar', 'caixa'], 2: ['kpis', 'salas', 'funil', 'vendas'], 3: ['kpis', 'salas', 'campanhas'], 4: ['kpis', 'salas', 'fila'], 5: ['kpis', 'salas', 'redes', 'posts'],
    6: ['kpis', 'salas', 'orcamento', 'linha14', 'contas'], 7: ['kpis', 'salas', 'sala', 'formReuniao', 'agenda'], 8: ['kpis', 'salas', 'resumo', 'fluxo', 'historico'], 9: ['kpis', 'estante', 'salas']
  };

  function desenharBloco(id) {
    var el = document.querySelector('#pCorpo [data-b="' + id + '"]');
    if (!el || el.contains(document.activeElement)) return;
    el.innerHTML = B[id].render(andarAberto);
    if (B[id].depois) B[id].depois();
  }

  /* ==========================================================================
     LISTA VIRTUAL — desenha só as linhas visíveis (400+ agentes, 1000+ skills)
     ======================================================================== */
  function ListaVirtual(el, altura, render) {
    el.innerHTML = '<div class="lv-area"><div class="lv-itens"></div></div>';
    var area = el.firstChild, itens = area.firstChild, dados = [], marcado = false;
    function desenhar() {
      marcado = false;
      var ini = Math.max(0, Math.floor(el.scrollTop / altura) - 4), fim = Math.min(dados.length, Math.ceil((el.scrollTop + el.clientHeight) / altura) + 4), html = '';
      for (var i = ini; i < fim; i++) html += render(dados[i], i);
      itens.style.transform = 'translateY(' + ini * altura + 'px)';
      itens.innerHTML = html;
    }
    el.addEventListener('scroll', function () { if (!marcado) { marcado = true; root.requestAnimationFrame(desenhar); } }, { passive: true });
    return { definir: function (lista) { dados = lista; area.style.height = lista.length * altura + 'px'; el.scrollTop = 0; desenhar(); }, redesenhar: desenhar };
  }

  /* ==========================================================================
     ABAS
     ======================================================================== */
  function abaGeral(n) {
    blocos = (PLANTA[n] || ['kpis', 'salas']).slice();
    /* andares com skills externas ganham o bloco logo depois das salas */
    if (T.skillsExternasDe && T.skillsExternasDe(n).length) blocos.splice(blocos.indexOf('salas') + 1, 0, 'externas');
    $('pCorpo').innerHTML = blocos.map(function (id) { return '<section class="bloco" data-b="' + id + '"></section>'; }).join('') + '<p class="rodape-sim">Dados simulados · editáveis em js/config.js</p>';
    blocos.forEach(desenharBloco);
  }

  function abaAgentes(n) {
    var a = T.andar(n);
    $('pCorpo').innerHTML = '<div class="filtros"><input type="search" id="fBusca" placeholder="Buscar por nome, cargo ou squad" aria-label="Buscar agentes" value="' + esc(filtro.busca || '') + '">' +
      '<select id="fSquad" aria-label="Filtrar por squad"><option value="">Todos os squads</option>' + a.squads.map(function (s, i) { return '<option value="' + i + '">' + esc(s.nome) + '</option>'; }).join('') + '</select>' +
      '<select id="fEstado" aria-label="Filtrar por estado"><option value="">Todos os estados</option><option value="trabalhando">Trabalhando</option><option value="reuniao">Em reunião</option><option value="ocioso">Livre</option><option value="pausa">Em pausa</option></select></div>' +
      '<p class="contagem" id="fCont" aria-live="polite"></p><div class="lista-v" id="fLista"></div>';
    listaV = ListaVirtual($('fLista'), 60, function (g) {
      return '<button class="ag-linha" type="button" data-agente="' + g.i + '"><span class="av">' + T.avatar(a.id + ':' + g.i, a.cor) + '</span><span class="ag-id"><b>' + esc(g.nome) + '</b><small>' + esc(g.cargo) + ' · ' + esc(a.squads[g.squad].nome) + '</small></span>' + selo(g.status) + '<span class="ag-num">' + F.int(S.tarefasDe(g)) + '<small>tarefas</small></span></button>';
    });
    function aplicar() {
      var termos = T.normalizar($('fBusca').value).split(/\s+/).filter(Boolean), sq = $('fSquad').value, es = $('fEstado').value;
      filtro.busca = $('fBusca').value;
      var lista = a.agentes.filter(function (g) {
        if (sq !== '' && g.squad !== +sq) return false;
        if (es && g.status !== es) return false;
        for (var i = 0; i < termos.length; i++) if (g._busca.indexOf(termos[i]) < 0) return false;
        return true;
      });
      $('fCont').textContent = F.int(lista.length) + (lista.length === 1 ? ' agente' : ' agentes') + (lista.length < a.agentes.length ? ' de ' + F.int(a.agentes.length) : ' neste andar');
      listaV.definir(lista);
    }
    ['fBusca', 'fSquad', 'fEstado'].forEach(function (id) { $(id).addEventListener('input', aplicar); });
    if (salaAberta >= 0) $('fSquad').value = String(salaAberta);   /* dentro de uma sala, a lista já abre filtrada por ela */
    aplicar();
  }

  function abaSkills(n) {
    var a = T.andar(n), f = S.fracDia(), pips = function (k) { var s = ''; for (var i = 1; i <= 5; i++) s += '<i' + (i <= k ? ' class="on"' : '') + '></i>'; return s; };
    $('pCorpo').innerHTML = '<div class="filtros"><input type="search" id="fBusca" placeholder="Buscar skill" aria-label="Buscar skills"><select id="fCat" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>' + a.categorias.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="fOrdem" aria-label="Ordenar"><option value="">Ordem padrão</option><option value="usos">Mais usadas hoje</option><option value="nivel">Maior nível</option><option value="agentes">Mais agentes</option></select></div><p class="contagem" id="fCont" aria-live="polite"></p><div class="lista-v" id="fLista"></div>';
    listaV = ListaVirtual($('fLista'), 58, function (s) {
      return '<div class="sk-linha"><span class="sk-nome"><b>' + esc(s.nome) + '</b><small><span class="tag">' + esc(s.categoria) + '</span> ' + s.agentes + (s.agentes === 1 ? ' agente' : ' agentes') + '</small></span><span class="pips" role="img" aria-label="Nível ' + s.nivel + ' de 5">' + pips(s.nivel) + '</span><span class="ag-num">' + F.int(s.usos * f) + '<small>usos hoje</small></span></div>';
    });
    function aplicar() {
      var termos = T.normalizar($('fBusca').value).split(/\s+/).filter(Boolean), cat = $('fCat').value, ordem = $('fOrdem').value;
      var lista = a.skills.filter(function (s) {
        if (cat && s.categoria !== cat) return false;
        for (var i = 0; i < termos.length; i++) if (s._busca.indexOf(termos[i]) < 0) return false;
        return true;
      });
      if (ordem) lista.sort(function (x, y) { return y[ordem] - x[ordem]; });
      $('fCont').textContent = F.int(lista.length) + (lista.length === 1 ? ' skill' : ' skills') + (lista.length < a.skills.length ? ' de ' + F.int(a.skills.length) : ' neste andar');
      listaV.definir(lista);
    }
    ['fBusca', 'fCat', 'fOrdem'].forEach(function (id) { $(id).addEventListener('input', aplicar); });
    aplicar();
  }

  function linhaFeed(e) {
    var de = T.andar(e.andar), para = e.para && e.para !== e.andar ? T.andar(e.para) : null;
    return '<li class="item' + (e.destaque ? ' forte' : '') + '"><div class="it-topo"><span class="rota">' + ponto(de.cor) + esc(de.nome) + (para ? '<span class="sep">→</span>' + ponto(para.cor) + esc(para.nome) : '') + '</span><time>' + F.horaSeg(e.t) + '</time></div><p>' + esc(e.texto) + '</p></li>';
  }
  function abaAtividade(n) {
    $('pCorpo').innerHTML = '<p class="contagem">O que este andar fez e recebeu, do mais recente para o mais antigo.</p><ul class="lista" id="fAtiv">' + (S.estado.porAndar[n - 1].feed.slice(0, 50).map(linhaFeed).join('') || '<li class="vazio">Aguardando os primeiros acontecimentos…</li>') + '</ul>';
  }
  var ABAS = { geral: ['Visão geral', abaGeral], agentes: ['Agentes', abaAgentes], skills: ['Skills', abaSkills], atividade: ['Atividade', abaAtividade] };

  function definirAba(aba) {
    if (!andarAberto || !ABAS[aba]) return;
    abaAtual = aba; listaV = null; fecharFicha(true);
    Array.prototype.forEach.call(document.querySelectorAll('#pAbas button'), function (b) { var on = b.dataset.aba === aba; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    $('pCorpo').scrollTop = 0;
    $('pCorpo').className = 'p-corpo aba-' + aba;
    ABAS[aba][1](andarAberto);
  }

  /* ==========================================================================
     PAINEL DO ANDAR
     ======================================================================== */
  function margem() { return root.innerWidth > 900 ? $('painel').offsetWidth + 16 : 0; }

  /* mantém no endereço onde você está: #andar=3, #andar=3&sala=2, #andar=9&livro=salario */
  function endereco() {
    var h = andarAberto ? '#andar=' + andarAberto + (fichaAberta && fichaAberta.livro ? '&livro=' + fichaAberta.livro : salaAberta >= 0 ? '&sala=' + (salaAberta + 1) : '') : '';
    try { root.history.replaceState(null, '', h || (root.location.pathname + root.location.search)); } catch (e) { /* endereço não pode ser alterado (ex.: file://) */ }
  }

  function abrirAndar(n, o) {
    o = o || {};
    var a = T.andar(n); if (!a) return;
    var mudou = n !== andarAberto;
    if (mudou || !o.manterSala) salaAberta = -1;
    andarAberto = n; filtro = {};
    var p = $('painel');
    p.style.setProperty('--cor', a.cor);
    $('pNum').textContent = F.dois(a.n);
    $('pTit').textContent = a.titulo;
    $('pMissao').textContent = a.missao;
    $('pMeta').innerHTML = '<span><b>' + F.int(a.agentes.length) + '</b> agentes</span><span><b>' + F.int(a.skills.length) + '</b> skills</span><span><b>' + a.squads.length + '</b> squads</span><span class="operando"><i></i>operando sozinho</span>';
    p.hidden = false;
    root.requestAnimationFrame(function () { p.classList.add('aberto'); cena.margemDireita(margem()); });
    document.body.classList.add('com-painel');
    marcarElevador(n);
    definirAba(o.aba || (mudou ? 'geral' : abaAtual));
    if (!o.semCamera) cena.irPara(n);
    endereco();
    if (cb.aoAbrirAndar) cb.aoAbrirAndar(n);
  }
  function fechar() {
    if (!andarAberto) { cena.irPara(0); return; }
    fecharFicha(true);
    andarAberto = 0; salaAberta = -1;
    var p = $('painel');
    p.classList.remove('aberto');
    setTimeout(function () { if (!andarAberto) p.hidden = true; }, 320);
    document.body.classList.remove('com-painel');
    cena.margemDireita(0); cena.irPara(0); marcarElevador(0);
    endereco();
  }

  /* ---------- salas: zoom no interior da sala de um squad ---------- */
  function abrirSala(n, k, o) {
    var a = T.andar(n);
    if (!a || !a.squads[k]) return;
    if (andarAberto !== n) abrirAndar(n, { semCamera: true, aba: 'geral' });
    fecharFicha(true);
    salaAberta = k;
    if (abaAtual === 'agentes') definirAba('agentes');
    else if (abaAtual === 'geral') { desenharBlocoForcado('salas'); var f = $('salaFicha'); if (f && f.scrollIntoView) f.scrollIntoView({ block: 'nearest' }); }
    cena.irParaSala(n, k, o);
    endereco();
  }
  function fecharSala() {
    if (salaAberta < 0) return;
    fecharFicha(true);
    salaAberta = -1;
    if (abaAtual === 'geral') desenharBlocoForcado('salas');
    if (andarAberto) cena.irPara(andarAberto);
    endereco();
  }
  function marcarElevador(n) {
    Array.prototype.forEach.call(document.querySelectorAll('#elevador .el-bt'), function (b) {
      var on = +b.dataset.n === n; b.classList.toggle('on', on);
      if (on) { b.setAttribute('aria-current', 'true'); $('cabine').style.transform = 'translateY(' + b.offsetTop + 'px)'; $('cabine').style.setProperty('--cor', n ? T.andar(n).cor : 'var(--gelo)'); }
      else b.removeAttribute('aria-current');
    });
  }

  /* ---------- ficha do agente ---------- */
  function abrirAgente(n, i, o) {
    o = o || {};
    var a = T.andar(n), g = a && a.agentes[i]; if (!g) return;
    if (andarAberto !== n || abaAtual !== 'agentes') abrirAndar(n, { aba: 'agentes', semCamera: true, manterSala: true });
    fichaAberta = { n: n, i: i };
    var f = S.fracDia(), el = $('ficha');
    el.innerHTML = '<button class="bt bt-mini" type="button" data-acao="fecharFicha">' + ico(ICO.voltar) + 'Voltar para a lista</button>' +
      '<div class="ficha-topo"><span class="av grande">' + T.avatar(a.id + ':' + g.i, a.cor) + '</span><div><h3>' + esc(g.nome) + '</h3><p>' + esc(g.cargo) + '</p><small>' + esc(g.id) + ' · squad ' + esc(a.squads[g.squad].nome) + '</small></div></div>' +
      '<div class="ficha-estado">' + selo(g.status) + '</div>' +
      '<div class="ladrilhos tres"><div class="ladrilho"><div class="l-rot">Tarefas hoje</div><div class="l-val" id="fichaTarefas">' + F.int(S.tarefasDe(g)) + '</div></div><div class="ladrilho"><div class="l-rot">Acerto de primeira</div><div class="l-val">' + g.eficiencia + '%</div></div><div class="ladrilho"><div class="l-rot">Skills</div><div class="l-val">' + g.skills.length + '</div></div></div>' +
      '<h4 class="b-tit">Fazendo agora</h4><p class="ficha-tarefa">' + esc(g.status === 'trabalhando' ? a.skills[g.skills[Math.floor(Date.now() / 20000) % g.skills.length]].nome : g.status === 'reuniao' ? 'Participando de uma reunião no 7º andar' : 'Aguardando a próxima tarefa do Mega Brain') + '</p>' +
      '<h4 class="b-tit">Skills que domina</h4><ul class="lista compacta">' + g.skills.map(function (k) { var s = a.skills[k]; return '<li class="item item-linha"><div><p>' + esc(s.nome) + '</p><small><span class="tag">' + esc(s.categoria) + '</span> nível ' + s.nivel + ' de 5</small></div><span class="ag-num">' + F.int(s.usos * f) + '<small>usos hoje</small></span></li>'; }).join('') + '</ul>' +
      '<button class="bt bt-cor" type="button" data-acao="localizar">' + ico(ICO.alvo) + 'Mostrar no andar</button>';
    el.hidden = false; el.scrollTop = 0;
    $('painel').classList.add('com-ficha');
    if (o.focar !== false) cena.focarAgente(n, i);
  }
  function fecharFicha(silencioso) {
    if (!fichaAberta) return;
    var eraLivro = !!fichaAberta.livro;
    fichaAberta = null; $('ficha').hidden = true; $('painel').classList.remove('com-ficha');
    cena.limparFoco();
    if (eraLivro && abaAtual === 'geral') { desenharBlocoForcado('estante'); desenharBlocoForcado('kpis'); }
    if (!silencioso && andarAberto) {
      if (salaAberta >= 0) cena.irParaSala(andarAberto, salaAberta); else cena.irPara(andarAberto);
      endereco();
    }
  }

  /* ==========================================================================
     LIVROS DO ANDAR DE ESTUDO
     O livro abre no lugar da ficha. Dois livros são guias interativos:
     o do salário (com calculadora) e o do lançamento da empresa (checklist).
     ======================================================================== */
  function licoesHTML(lista) { return '<ol class="licoes">' + lista.map(function (x) { return '<li><b>' + esc(x[0]) + '</b><p>' + esc(x[1]) + '</p></li>'; }).join('') + '</ol>'; }
  function alerta(tipo, sinal, texto) { return '<p class="alerta ' + tipo + '"><i aria-hidden="true">' + sinal + '</i><span>' + texto + '</span></p>'; }

  function planoSalarioHTML(p) {
    var max = Math.max.apply(null, p.linhas.map(function (l) { return l.valor; })) || 1;
    var nota = p.situacao === 'sobra' ? alerta('ok', '✓', 'Seus essenciais ficam ' + F.brl(p.sobra) + ' abaixo do teto de 55%. A diferença foi para a reserva.')
      : p.situacao === 'aperto' ? alerta('aviso', '▲', 'Seus essenciais passam do teto de 55% (' + F.brl(p.teto) + '). Para fechar a conta, o plano cortou primeiro a folga e o lazer.')
      : p.situacao === 'estouro' ? alerta('critico', '✕', 'Mesmo com tudo no mínimo, faltam ' + F.brl(p.falta) + ' por mês. É preciso reduzir um gasto fixo ou aumentar a renda.') : '';
    return '<h4 class="b-tit">Como dividir ' + F.brl(p.valor) + ' <small>por mês</small></h4>' + nota + '<div class="barras envelopes">' + p.linhas.map(function (l) {
      return '<div class="br-linha"' + dica(F.brl(l.valor), l.nome + ' · ' + F.pct(l.pct) + ' do salário') + '><span class="br-nome">' + esc(l.nome) + '<small>' + esc(l.desc) + '</small></span>' +
        '<span class="br-trilho"><i class="br-barra" style="width:' + Math.max(1.5, l.valor / max * 100).toFixed(1) + '%"></i><b class="br-val">' + F.brl(l.valor) + '</b></span>' +
        '<span class="br-extra">' + F.pct(l.pct) + ' do salário' + (l.semana != null ? ' · ' + F.brl(l.semana) + ' por semana' : '') + '</span></div>';
    }).join('') + '</div><h4 class="b-tit">Passo a passo</h4>' + licoesHTML(T.passosSalario(p, F.brl));
  }
  function corpoSalario() {
    var p = S.planoSalario(), sal = S.estado.estudo.salario;
    return '<form class="salario-form" id="formSalario" autocomplete="off"><label>Quanto cai na conta por mês (R$)<input name="valor" type="number" inputmode="numeric" min="1" step="50" value="' + p.valor + '"></label>' +
      '<label>Seus gastos essenciais (R$) <small>opcional: aluguel, contas, mercado e transporte</small><input name="essenciais" type="number" inputmode="numeric" min="0" step="50" value="' + (sal.essenciais == null ? '' : sal.essenciais) + '" placeholder="' + p.teto + '"></label></form>' +
      '<div id="salarioPlano">' + planoSalarioHTML(p) + '</div><p class="b-nota">É um ponto de partida para organizar o mês, não uma recomendação de investimento. Ajuste as fatias à sua realidade.</p>';
  }
  function corpoLancamento() {
    var lc = S.lancamento();
    var s = '<div class="lanc-topo"><div class="h-val">' + F.pct(lc.fracao) + '</div><div class="h-rot">' + lc.feitos + ' de ' + lc.total + ' passos concluídos</div><div class="md-grande">' + medidor(lc.fracao) + '</div>' +
      (lc.proximos.length ? '<p class="b-nota">Próximo passo: <b>' + esc(lc.proximos[0].texto) + '</b></p>' : '<p class="b-nota">Tudo concluído: a empresa está no ar.</p>') + '</div>';
    T.LANCAMENTO.forEach(function (f, i) {
      s += '<fieldset class="fase"><legend><b>' + (i + 1) + '. ' + esc(f.fase) + '</b><small>' + esc(f.prazo) + ' · ' + lc.fases[i].feitos + ' de ' + lc.fases[i].total + '</small></legend>' + f.itens.map(function (it) {
        return '<label class="passo"><input type="checkbox" data-passo="' + esc(it[0]) + '"' + (S.passoFeito(it[0]) ? ' checked' : '') + '><span><b>' + esc(it[1]) + '</b><small>' + esc(it[2]) + '</small></span></label>';
      }).join('') + '</fieldset>';
    });
    return s;
  }
  /* ---------- plano de 90 dias com R$ 3.000 ---------- */
  function divisaoPlanoHTML(pl) {
    var d = pl.divisao, max = Math.max.apply(null, d.linhas.map(function (l) { return l.valor; })) || 1, prod = (T.CATALOGO && T.CATALOGO.produtos || []).filter(function (p) { return !p.mensal; })[0];
    var nota = d.situacao === 'curto' ? alerta('critico', '✕', 'Com menos de ' + F.brl(d.fixos) + ', comece só pelo essencial: domínio, WhatsApp Business e prospecção. Formalize quando fechar o primeiro contrato.')
      : d.situacao === 'sem-anuncio' ? alerta('aviso', '▲', 'Com menos de R$ 1.500, deixe os anúncios para depois da primeira venda: a prospecção direta não custa nada.') : '';
    return '<h4 class="b-tit">Onde colocar ' + F.brl(d.valor) + '</h4>' + nota + '<div class="barras envelopes">' + d.linhas.map(function (l) {
      return '<div class="br-linha"' + dica(F.brl(l.valor), l.nome + ' · ' + l.quando) + '><span class="br-nome">' + esc(l.nome) + '<small>' + esc(l.desc) + '</small></span>' +
        '<span class="br-trilho"><i class="br-barra" style="width:' + Math.max(1.5, l.valor / max * 100).toFixed(1) + '%"></i><b class="br-val">' + F.brl(l.valor) + '</b></span>' +
        '<span class="br-extra">' + esc(l.quando) + ' · ' + F.pct(l.pct) + ' do total</span></div>';
    }).join('') + '</div>' +
      '<p class="b-nota">Depois do lançamento, os custos fixos ficam em cerca de ' + F.brl(T.PLANO.custoMensal) + ' por mês (imposto e ferramentas). ' +
      (d.v.reserva ? 'A reserva cobre ' + (d.mesesDeFolego === 1 ? 'cerca de 1 mês' : 'cerca de ' + d.mesesDeFolego + ' meses') + ' desses custos mesmo sem nenhuma venda. ' : '') +
      (prod ? 'Uma única ' + esc(prod.nome) + ' (' + F.brl(prod.preco) + ') paga mais de ' + Math.floor(prod.preco / T.PLANO.custoMensal) + ' meses deles.' : '') + '</p>';
  }
  function metasPlanoHTML(pl) {
    return '<div class="medidores">' + pl.metas.map(function (m) {
      var est = pl.dia && m.fracao + 0.1 < m.ritmo ? 'aviso' : '';
      return '<div class="ml-linha"' + dica((m.dinheiro ? F.brl(m.feito) : F.int(m.feito)) + ' de ' + (m.dinheiro ? F.brl(m.meta) : F.int(m.meta)), m.nome + ' · meta dos 90 dias') + '><span class="ml-nome">' + esc(m.nome) + '</span>' + medidor(m.fracao, pl.dia ? m.ritmo : null, est) +
        '<span class="ml-val">' + (m.dinheiro ? F.brl(m.feito) : F.int(m.feito)) + ' <small>de ' + (m.dinheiro ? F.brl(m.meta) : F.int(m.meta)) + '</small></span>' +
        (est ? '<span class="selo aviso"><i aria-hidden="true">▲</i>abaixo do ritmo</span>' : '') + '</div>';
    }).join('') + '</div>' + (pl.dia ? '<p class="b-nota"><em class="md-ritmo exemplo"></em> A marca vertical mostra onde você deveria estar no dia ' + Math.min(pl.dia, T.PLANO.dias) + '.</p>' : '');
  }
  function corpoPlano() {
    var pl = S.planoLancamento(), P = T.PLANO, s;
    s = '<form class="salario-form" id="formPlano" autocomplete="off"><label>Dinheiro de entrada (R$)<input name="capital" type="number" inputmode="numeric" min="0" step="100" value="' + pl.capital + '"></label>' +
      '<div class="plano-dia">' + (pl.dia ? '<b>' + (pl.terminou ? 'Os 90 dias terminaram' : 'Dia ' + pl.dia + ' de ' + P.dias) + '</b><small>' + (pl.terminou ? 'veja o que deu certo e faça o próximo plano' : 'fase ' + (pl.fase + 1) + ': ' + esc(P.fases[pl.fase].nome)) + '</small>' +
        '<button class="bt bt-mini" type="button" data-acao="reiniciarPlano">Zerar a contagem</button>'
        : '<button class="bt bt-cor" type="button" data-acao="iniciarPlano">Começar o plano hoje</button><small>a torre conta os dias e mostra a fase em que você está</small>') + '</div></form>' +
      '<div id="planoDivisao">' + divisaoPlanoHTML(pl) + '</div>' +
      '<h4 class="b-tit">Os 90 dias, fase por fase</h4>';
    P.fases.forEach(function (f, i) {
      var gasta = f.gasta.map(function (id) { var l = pl.divisao.linhas.filter(function (x) { return x.id === id; })[0]; return l && l.valor ? l.nome.toLowerCase() + ' (' + F.brl(l.valor) + ')' : ''; }).filter(Boolean);
      s += '<section class="fase-plano' + (i === pl.fase ? ' atual' : '') + '"' + (i === pl.fase ? ' aria-current="step"' : '') + '><header><span class="fp-num">' + (i + 1) + '</span><div><b>' + esc(f.nome) + '</b><small>' + esc(f.quando) + ' · dias ' + f.dias[0] + ' a ' + f.dias[1] + (i === pl.fase ? ' · você está aqui' : '') + '</small></div></header>' +
        '<p class="fp-obj">' + esc(f.objetivo) + '</p>' + licoesHTML(f.tarefas) +
        '<p class="fp-meta"><b>Meta da fase:</b> ' + esc(f.meta) + (gasta.length ? '<br><b>Gasta:</b> ' + esc(gasta.join(' e ')) : '<br><b>Gasta:</b> nada além do seu tempo') + '</p></section>';
    });
    s += '<h4 class="b-tit">Seus números <small>anote o total acumulado; fica salvo neste navegador</small></h4>' +
      '<form class="numeros-form" id="formNumeros" autocomplete="off">' + pl.metas.map(function (m) {
        return '<label>' + esc(m.nome) + (m.dinheiro ? ' (R$)' : '') + '<input name="' + m.id + '" type="number" inputmode="numeric" min="0" step="1" value="' + m.feito + '"></label>';
      }).join('') + '</form><div id="planoMetas">' + metasPlanoHTML(pl) + '</div>' +
      '<p class="b-nota">Metas dos 90 dias: 600 contatos viram cerca de 60 conversas, 20 propostas e 5 vendas. São números para medir o caminho, não promessas: se ficar abaixo do ritmo, mude a mensagem ou o nicho, não o esforço.</p>' +
      '<h4 class="b-tit">Regras para dar certo</h4>' + licoesHTML(P.regras) +
      '<div class="pratica"><h4>Para fazer hoje</h4><p>' + (pl.dia && !pl.terminou ? esc(P.fases[pl.fase].tarefas[0][0]) + ': ' + esc(P.fases[pl.fase].tarefas[0][1]) : 'Clique em "Começar o plano hoje", escolha o nicho e escreva em uma frase para quem você vende e qual problema resolve.') + '</p></div>' +
      '<p class="b-nota">Valores de impostos, domínio e ferramentas são estimativas de novembro de 2026: confira os atuais antes de pagar. Este plano é um ponto de partida, não consultoria contábil ou jurídica.</p>';
    return s;
  }

  function desenharLivro() {
    if (!fichaAberta || !fichaAberta.livro) return;
    var b = T.livro(fichaAberta.livro), a = T.andar(S.andarEstudo()), q = a.squads[b.sala] || {}, lido = S.lido(b.id);
    $('ficha').innerHTML = '<button class="bt bt-mini" type="button" data-acao="fecharFicha">' + ico(ICO.voltar) + 'Voltar para a estante</button>' +
      '<div class="livro-topo" style="--capa:' + (q.corLivro || a.cor) + '"><span class="livro-capa" aria-hidden="true">' + ico(ICO.livro) + '</span><div><h3>' + esc(b.titulo) + '</h3><p>' + esc(b.sub) + '</p><small>' + esc(q.nome || a.nome) + ' · ' + b.min + ' min de leitura</small></div></div>' +
      '<p class="livro-resumo">' + esc(b.resumo) + '</p>' +
      (b.tipo === 'salario' ? corpoSalario() : b.tipo === 'lancamento' ? corpoLancamento() : b.tipo === 'plano' ? corpoPlano() : licoesHTML(b.licoes) + '<div class="pratica"><h4>Para fazer hoje</h4><p>' + esc(b.pratica) + '</p></div>') +
      '<div class="livro-acoes">' + (b.tipo === 'lancamento' ? '' : '<button class="bt bt-cor" type="button" data-acao="lerLivro" aria-pressed="' + lido + '">' + ico(ICO.certo) + (lido ? 'Lido · desmarcar' : 'Marcar como lido') + '</button>') +
      '<button class="bt" type="button" data-acao="ouvirLivro">' + ico(ICO.som) + 'Ouvir com o Jarvis</button><button class="bt" type="button" data-acao="localizarLivro">' + ico(ICO.alvo) + 'Mostrar na estante</button></div>';
  }
  function abrirLivro(id, o) {
    o = o || {};
    var b = T.livro && T.livro(id), n = S.andarEstudo();
    if (!b || !n) return false;
    if (andarAberto !== n || abaAtual !== 'geral' || salaAberta >= 0) abrirAndar(n, { aba: 'geral', semCamera: true });
    fichaAberta = { livro: b.id };
    $('painel').style.setProperty('--cor', T.andar(n).cor);
    desenharLivro();
    $('ficha').hidden = false; $('ficha').scrollTop = 0;
    $('painel').classList.add('com-ficha');
    if (o.focar !== false) cena.focarLivro(T.BIBLIOTECA.indexOf(b));
    endereco();
    return true;
  }
  function falaDoPlano() {
    var pl = S.planoLancamento(), P = T.PLANO, fz = pl.fase >= 0 ? P.fases[pl.fase] : P.fases[0];
    return 'Plano de 90 dias com ' + F.brl(pl.capital) + '. Onde colocar o dinheiro: ' + pl.divisao.linhas.map(function (l) { return l.nome.toLowerCase() + ', ' + F.brl(l.valor); }).join('; ') + '. ' +
      (pl.dia && !pl.terminou ? 'Você está no dia ' + pl.dia + ', na fase ' + fz.nome.toLowerCase() + '. ' : 'Comece pela fase 1, ' + fz.nome.toLowerCase() + '. ') +
      'O objetivo agora: ' + fz.objetivo + ' Tarefas: ' + fz.tarefas.map(function (t) { return t[0]; }).join('; ') + '. ' +
      'A regra mais importante: venda antes de gastar e prospecte todo dia útil, de 10 a 15 contatos por dia.';
  }
  /* o que o Jarvis lê em voz alta quando você pede para ouvir o livro aberto */
  function falaDoLivro(b) {
    if (b.tipo === 'salario') {
      var p = S.planoSalario();
      return 'Como dividir um salário de ' + F.brl(p.valor) + '. ' + p.linhas.map(function (l) { return l.nome + ': ' + F.brl(l.valor); }).join('; ') + '. ' +
        T.passosSalario(p, F.brl).map(function (x, i) { return 'Passo ' + (i + 1) + ': ' + x[0] + '. ' + x[1]; }).join(' ');
    }
    if (b.tipo === 'plano') return falaDoPlano();
    if (b.tipo === 'lancamento') {
      var lc = S.lancamento();
      return 'Lançamento da empresa: ' + lc.feitos + ' de ' + lc.total + ' passos concluídos. ' + (lc.proximos.length ? 'Os próximos são: ' + lc.proximos.slice(0, 4).map(function (x) { return x.texto; }).join('; ') + '.' : 'Tudo concluído. A empresa está no ar.');
    }
    return T.textoDoLivro(b);
  }

  /* ==========================================================================
     SKILLS EXTERNAS (projetos do GitHub, js/skills-externas.js)
     ======================================================================== */
  /* cartão de uma skill. o.catalogo: versão do catálogo geral (com o lugar na torre, sem id de âncora) */
  function cartaoExterna(s, o) {
    o = o || {};
    var l = T.lugarDaSkill(s);
    return '<article class="externa"' + (o.catalogo ? ' style="--cor:' + (l ? l.andar.cor : 'var(--gelo)') + '"' : ' id="ext-' + esc(s.id) + '"') + '><div class="ex-topo"><b>' + esc(s.nome) + '</b><span class="tag">não instalada</span></div>' +
      '<p class="ex-tipo">' + esc(s.tipo) + ' · ' + esc(s.licenca) + '</p>' +
      '<p class="ex-resumo">' + esc(s.resumo) + '</p><p class="ex-uso"><b>Aqui serve para:</b> ' + esc(s.uso) + '</p>' +
      '<details class="ex-mais"><summary>O que faz, como instalar e cuidados</summary>' +
      '<ul class="ex-faz">' + s.faz.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
      '<h4>Precisa de</h4><p>' + esc(s.precisa) + '</p><h4>Como instalar</h4><pre class="ex-cmd">' + esc(s.instalar) + '</pre>' +
      '<p class="alerta aviso"><i aria-hidden="true">▲</i><span><b>Atenção:</b> ' + esc(s.atencao) + '</span></p></details>' +
      '<div class="ex-acoes"><a class="bt bt-mini" href="https://github.com/' + esc(s.repo) + '" target="_blank" rel="noopener noreferrer">' + ico(ICO.externo) + 'Ver no GitHub</a>' +
      (o.catalogo && l ? '<button class="bt bt-mini" type="button" data-ext="' + esc(s.id) + '">' + ico(ICO.alvo) + 'Ver na torre</button>' : '') + '</div></article>';
  }

  /* catálogo completo (botão "Skills" do topo), agrupado por andar */
  function abrirSkillsExternas() {
    var lista = T.SKILLS_EXTERNAS || [], ign = T.SKILLS_IGNORADAS || [], m = $('modal'), html = '';
    T.ANDARES.forEach(function (a) {
      var doAndar = lista.filter(function (s) { var l = T.lugarDaSkill(s); return l && l.andar.n === a.n; });
      if (!doAndar.length) return;
      html += '<section class="ex-andar"><h3>' + ponto(a.cor) + ord(a.n) + ' andar · ' + esc(a.nome) + ' <small>' + doAndar.length + '</small></h3><div class="ex-grade">' +
        doAndar.map(function (s) { return '<div class="ex-celula"><p class="ex-onde">Sala ' + esc(s.sala) + '</p>' + cartaoExterna(s, { catalogo: true }) + '</div>'; }).join('') + '</div></section>';
    });
    m.innerHTML = '<div class="modal-fundo" data-acao="fecharModal"></div><div class="modal-caixa modal-skills vidro" role="dialog" aria-modal="true" aria-labelledby="mTit"><header><div><h2 id="mTit">Skills externas</h2>' +
      '<p>' + lista.length + ' projetos do GitHub catalogados nos andares e salas da torre · nenhum instalado · a lista fica em js/skills-externas.js</p></div><button class="bt-icone" type="button" data-acao="fecharModal" aria-label="Fechar skills externas">' + ico(ICO.fechar) + '</button></header>' +
      '<div class="modal-corpo"><p class="alerta aviso"><i aria-hidden="true">▲</i><span>Skills rodam com as mesmas permissões do seu agente. Antes de instalar, passe cada uma pelo <b>SkillSpector</b> (8º andar) e leia o código.</span></p>' + html +
      (ign.length ? '<section class="ex-andar"><h3>Não catalogadas</h3><ul class="ex-ignoradas">' + ign.map(function (x) { return '<li><b>' + esc(x.repo) + '</b> · ' + esc(x.motivo) + '</li>'; }).join('') + '</ul></section>' : '') + '</div></div>';
    focoAntes = document.activeElement; m.hidden = false;
    m.querySelector('header .bt-icone').focus();
  }

  /* abre o andar da skill externa e rola até o cartão dela, já com os detalhes abertos */
  function mostrarSkillExterna(id) {
    fecharModal();
    var s = T.skillExterna && T.skillExterna(id), l = s && T.lugarDaSkill(s);
    if (!l) return false;
    if (andarAberto !== l.andar.n || abaAtual !== 'geral' || fichaAberta) abrirAndar(l.andar.n, { aba: 'geral', manterSala: andarAberto === l.andar.n });
    var el = $('ext-' + id);
    if (el) {
      var d = el.querySelector('details'); if (d) d.open = true;
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      el.classList.add('piscar'); setTimeout(function () { el.classList.remove('piscar'); }, 1600);
    }
    return true;
  }

  /* ==========================================================================
     PRODUTOS DA EMPRESA (botão do topo) — vêm de site/catalogo.js
     ======================================================================== */
  function abrirProdutos() {
    var prods = (T.CATALOGO && T.CATALOGO.produtos) || [], vend = S.vendasPorPlano(), m = $('modal');
    m.innerHTML = '<div class="modal-fundo" data-acao="fecharModal"></div><div class="modal-caixa modal-produtos vidro" role="dialog" aria-modal="true" aria-labelledby="mTit"><header><div><h2 id="mTit">Produtos</h2>' +
      '<p>' + esc(S.nomeEmpresa()) + ' · ' + prods.length + ' produtos à venda · nomes e preços ficam em site/catalogo.js</p></div><button class="bt-icone" type="button" data-acao="fecharModal" aria-label="Fechar produtos">' + ico(ICO.fechar) + '</button></header>' +
      '<div class="modal-corpo">' + (prods.length ? '<div class="produtos">' + prods.map(function (p) {
        var hoje = vend[p.nome + (p.mensal ? ' (mensal)' : '')] || 0;
        return '<article class="produto' + (p.recomendado ? ' rec' : '') + '"><div class="pd-topo"><h3>' + esc(p.nome) + '</h3>' + (p.recomendado ? '<span class="tag">Recomendado</span>' : '') + '</div>' +
          '<p class="pd-preco"><b>' + F.brl(p.preco) + '</b><span>' + (p.mensal ? 'por mês' : 'pagamento único') + '</span></p>' +
          '<p class="pd-resumo">' + esc(p.resumo) + '</p><ul class="pd-itens">' + (p.itens || []).map(function (i) { return '<li>' + ico(ICO.certo) + '<span>' + esc(i) + '</span></li>'; }).join('') + '</ul>' +
          '<p class="pd-ideal"><b>Ideal para:</b> ' + esc(p.ideal || '') + '</p>' +
          '<dl class="pd-dados"><div><dt>Prazo</dt><dd>' + esc(p.prazo || '—') + '</dd></div><div><dt>Tamanho</dt><dd>' + esc(p.tamanho || '—') + '</dd></div><div><dt>Vendas hoje</dt><dd>' + F.int(hoje) + ' <small>simuladas</small></dd></div></dl></article>';
      }).join('') + '</div>' : '<p class="vazio">Nenhum produto cadastrado. Confira se o arquivo site/catalogo.js está sendo carregado.</p>') + '</div>' +
      '<footer><a class="bt bt-cor" href="site/index.html" target="_blank" rel="noopener">' + ico(ICO.externo) + 'Abrir o site de vendas</a><button class="bt" type="button" data-acao="irVendas">Ir para o andar de Vendas</button></footer></div>';
    focoAntes = document.activeElement; m.hidden = false;
    m.querySelector('header .bt-icone').focus();
  }

  /* ==========================================================================
     DICA (tooltip), AVISOS, RESUMO
     ======================================================================== */
  var dicaDaCena = false;
  function mostrarDica(x, y, valor, rotulo, linhas) {
    var el = $('dica'); el.textContent = '';
    var b = document.createElement('b'); b.textContent = valor; el.appendChild(b);
    if (rotulo) { var s = document.createElement('span'); s.textContent = rotulo; el.appendChild(s); }
    (linhas || []).forEach(function (l) {
      var d = document.createElement('div'), k = document.createElement('i'), v = document.createElement('b'), nm = document.createElement('span');
      k.className = 'chave ' + l.cls; v.textContent = l.valor; nm.textContent = l.nome; d.appendChild(k); d.appendChild(v); d.appendChild(nm); el.appendChild(d);
    });
    el.hidden = false;
    var w = el.offsetWidth, h = el.offsetHeight, px = Math.min(root.innerWidth - w - 10, Math.max(10, x + 14)), py = y - h - 14;
    if (py < 10) py = y + 18;
    el.style.transform = 'translate3d(' + Math.round(px) + 'px,' + Math.round(py) + 'px,0)';
  }
  function esconderDica() { $('dica').hidden = true; dicaDaCena = false; }
  function dicaCena(info) {
    if (!info) { if (dicaDaCena) esconderDica(); return; }
    var a = T.andar(info.andar);
    if (info.tipo === 'livro') { var b = (T.BIBLIOTECA || [])[info.livro]; if (!b) return; mostrarDica(info.x, info.y, b.titulo, b.sub + ' · clique para abrir'); }
    else if (info.tipo === 'sala') { var q = a.squads[info.sala]; mostrarDica(info.x, info.y, 'Sala ' + q.nome, F.int(q.qtd) + ' agentes · clique para entrar'); }
    else if (info.tipo === 'agente') { var g = a.agentes[info.idx]; mostrarDica(info.x, info.y, g.nome, g.cargo + ' · ' + (ESTADOS[g.status] || ESTADOS.ocioso).nome.toLowerCase()); }
    else mostrarDica(info.x, info.y, ord(a.n) + ' andar · ' + a.nome, F.int(a.agentes.length) + ' agentes · clique para entrar');
    dicaDaCena = true;
  }

  var tAviso = null;
  function aviso(texto) {
    var el = $('aviso'); el.textContent = texto; el.hidden = false; el.classList.add('on');
    clearTimeout(tAviso); tAviso = setTimeout(function () { el.classList.remove('on'); setTimeout(function () { el.hidden = true; }, 300); }, 4200);
  }

  var focoAntes = null;
  function abrirResumo() {
    var r = S.resumo(), m = $('modal');
    function sec(t, l, vazio) { return '<h3>' + t + '</h3>' + (l.length ? '<ul>' + l.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="vazio">' + vazio + '</p>'); }
    m.innerHTML = '<div class="modal-fundo" data-acao="fecharModal"></div><div class="modal-caixa vidro" role="dialog" aria-modal="true" aria-labelledby="mTit"><header><div><h2 id="mTit">' + esc(r.titulo) + '</h2><p>' + esc(S.nomeEmpresa()) + ' · gerado pelo Mega Brain às ' + F.hora(r.data) + ' · dados simulados</p></div><button class="bt-icone" type="button" data-acao="fecharModal" aria-label="Fechar resumo">' + ico(ICO.fechar) + '</button></header>' +
      '<div class="modal-corpo"><ul class="resumo-linhas">' + r.linhas.map(function (l) { var a = T.andar(l.n); return '<li>' + ponto(a.cor) + '<div><b>' + esc(a.nome) + '</b><p>' + esc(l.texto) + '</p></div></li>'; }).join('') + '</ul>' +
      '<div class="resumo-secoes">' + sec('Destaques', r.destaques, 'Sem destaques ainda.') + sec('Alertas', r.alertas, 'Nenhum alerta: tudo dentro do planejado.') + sec('Para amanhã', r.amanha, 'Sem recomendações.') + '</div></div>' +
      '<footer><button class="bt bt-cor" type="button" data-acao="ouvirResumo">' + ico(ICO.som) + 'Ouvir com o Jarvis</button><button class="bt" type="button" data-acao="copiarResumo">' + ico(ICO.copiar) + 'Copiar texto</button></footer></div>';
    focoAntes = document.activeElement; m.hidden = false;
    m.querySelector('header .bt-icone').focus();
  }
  function fecharModal() { var m = $('modal'); if (m.hidden) return false; m.hidden = true; m.innerHTML = ''; if (focoAntes && focoAntes.focus) focoAntes.focus(); return true; }

  /* ==========================================================================
     FEED AO VIVO (rodapé)
     ======================================================================== */
  var filaFeed = [], ultimoFeed = 0;
  function empurrarFeed() {
    var agora = Date.now();
    if (!filaFeed.length || agora - ultimoFeed < 1100) return;
    ultimoFeed = agora;
    var e = filaFeed.filter(function (x) { return x.destaque; })[0] || filaFeed[filaFeed.length - 1];
    filaFeed = [];
    var ol = $('feedLista'), li = document.createElement('li'), de = T.andar(e.andar);
    li.className = e.destaque ? 'forte' : '';
    li.innerHTML = '<button type="button" data-ir="' + e.andar + '">' + ponto(de.cor) + '<span class="fd-txt"></span><time>' + F.hora(e.t) + '</time></button>';
    li.querySelector('.fd-txt').textContent = e.texto;
    ol.insertBefore(li, ol.firstChild);
    while (ol.children.length > 4) ol.removeChild(ol.lastChild);
  }

  /* ==========================================================================
     MONTAGEM E EVENTOS
     ======================================================================== */
  var cb = {};
  function placar() {
    $('placar').innerHTML = S.kpisGlobais().map(function (k) { return '<div class="pl-item"><span>' + esc(k.rotulo) + '</span><b>' + esc(k.valor) + '</b></div>'; }).join('');
    var d = new Date(); $('relogioHora').textContent = F.hora(d); $('relogioData').textContent = F.dataMedia(d);
  }
  /* a primeira palavra do nome vira a marca em destaque; o restante vai na linha de baixo */
  function nomeEmpresa() {
    var n = S.nomeEmpresa(), partes = n.split(/\s+/), marca = partes[0].toUpperCase(), resto = partes.slice(1).join(' ');
    var bt = $('empresaNome'), sub = $('empresaSub'), i = $('introNome'), is = $('introSub');
    bt.textContent = marca; bt.setAttribute('aria-label', n + '. Clique para trocar o nome da empresa');
    if (sub) sub.textContent = resto || 'Torre de comando';
    document.title = n + ' — Torre de comando';
    if (i) i.textContent = marca;
    if (is) is.textContent = resto ? resto + ' · Torre de comando' : 'Torre de comando';
  }

  function montar(cenaRef, callbacks) {
    S = T.Sim; cena = cenaRef; cb = callbacks || {};

    $('elevador').insertAdjacentHTML('beforeend', T.ANDARES.slice().reverse().map(function (a) {
      return '<button class="el-bt" type="button" data-n="' + a.n + '" style="--cor:' + a.cor + '" aria-label="' + ord(a.n) + ' andar: ' + esc(a.titulo) + '"><span class="el-num">' + a.n + '</span>' + ico(a.icone) + '<span class="el-nome">' + esc(a.nome) + '</span></button>';
    }).join('') + '<button class="el-bt el-geral" type="button" data-n="0" aria-label="Ver a torre inteira">' + ico(ICO.torre) + '<span class="el-nome">Torre inteira</span></button>');
    $('pAbas').innerHTML = Object.keys(ABAS).map(function (k) { return '<button type="button" role="tab" data-aba="' + k + '">' + ABAS[k][0] + '</button>'; }).join('');
    nomeEmpresa(); placar(); marcarElevador(0);

    /* cliques (delegados) */
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-n],[data-aba],[data-agente],[data-sala],[data-livro],[data-ext],[data-acao],[data-ir],[data-remover]');
      if (!t) return;
      if (t.dataset.n != null && t.closest('#elevador')) return +t.dataset.n ? abrirAndar(+t.dataset.n) : fechar();
      if (t.dataset.aba) return definirAba(t.dataset.aba);
      if (t.dataset.agente != null) return abrirAgente(andarAberto, +t.dataset.agente);
      if (t.dataset.sala != null) return abrirSala(andarAberto, +t.dataset.sala);
      if (t.dataset.livro) return abrirLivro(t.dataset.livro);
      if (t.dataset.ext) { e.preventDefault(); return mostrarSkillExterna(t.dataset.ext); }
      if (t.dataset.ir) return abrirAndar(+t.dataset.ir);
      if (t.dataset.remover) { S.removerReuniao(t.dataset.remover); return aviso('Reunião desmarcada.'); }
      var livro = fichaAberta && fichaAberta.livro ? T.livro(fichaAberta.livro) : null;
      switch (t.dataset.acao) {
        case 'fecharPainel': return fechar();
        case 'fecharFicha': return fecharFicha();
        case 'localizar': return fichaAberta && fichaAberta.n && cena.focarAgente(fichaAberta.n, fichaAberta.i);
        case 'fecharSala': return fecharSala();
        case 'agentesDaSala': return definirAba('agentes');
        case 'lerLivro':
          if (!livro) return;
          S.marcarLido(livro.id, !S.lido(livro.id)); desenharLivro();
          return aviso(S.lido(livro.id) ? 'Livro marcado como lido.' : 'Livro desmarcado.');
        case 'ouvirLivro': return livro && cb.aoOuvirTexto && cb.aoOuvirTexto(falaDoLivro(livro));
        case 'localizarLivro': return livro && cena.focarLivro(T.BIBLIOTECA.indexOf(livro));
        case 'iniciarPlano':
        case 'reiniciarPlano':
          var fichaEl = $('ficha'), y = fichaEl.scrollTop;
          S.iniciarPlano(t.dataset.acao === 'iniciarPlano'); desenharLivro(); fichaEl.scrollTop = y;
          return aviso(t.dataset.acao === 'iniciarPlano' ? 'Plano iniciado: hoje é o dia 1 de 90.' : 'Contagem zerada. Comece de novo quando quiser.');
        case 'produtos': return abrirProdutos();
        case 'skillsExternas': return abrirSkillsExternas();
        case 'irVendas': fecharModal(); return abrirAndar(2);
        case 'resumo': return abrirResumo();
        case 'fecharModal': return fecharModal();
        case 'ouvirResumo': return cb.aoOuvirResumo && cb.aoOuvirResumo(S.resumo());
        case 'copiarResumo':
          if (root.navigator.clipboard) root.navigator.clipboard.writeText(S.resumo().texto).then(function () { aviso('Resumo copiado.'); }, function () { aviso('Não consegui copiar; selecione o texto manualmente.'); });
          else aviso('Seu navegador não permite copiar daqui; selecione o texto manualmente.');
          return;
      }
    });
    $('painel').addEventListener('click', function (e) {
      if (e.target.id === 'btTabela14') { tabela14 = !tabela14; desenharBlocoForcado('linha14'); }
    });

    /* guia do salário: a divisão é refeita enquanto você digita */
    document.addEventListener('input', function (e) {
      var f = e.target.form, el;
      if (f && f.id === 'formPlano' && e.target.name === 'capital') {
        if (e.target.value !== '' && +e.target.value >= 0 && (el = $('planoDivisao'))) el.innerHTML = divisaoPlanoHTML(S.definirCapital(e.target.value));
        return;
      }
      if (f && f.id === 'formNumeros') {
        if ((el = $('planoMetas'))) el.innerHTML = metasPlanoHTML(S.definirNumeroPlano(e.target.name, e.target.value));
        return;
      }
      if (!f || f.id !== 'formSalario') return;
      var p = S.definirSalario(f.valor.value, f.essenciais.value), el = $('salarioPlano');
      if (el && +f.valor.value > 0) { el.innerHTML = planoSalarioHTML(p); f.essenciais.placeholder = p.teto; }
    });
    /* checklist de lançamento: marcar um passo salva na hora, sem perder a posição da leitura */
    document.addEventListener('change', function (e) {
      var id = e.target.dataset && e.target.dataset.passo;
      if (!id) return;
      S.marcarPasso(id, e.target.checked);
      var el = $('ficha'), y = el.scrollTop;
      desenharLivro(); el.scrollTop = y;
      var de = el.querySelector('[data-passo="' + id + '"]'); if (de) de.focus();
    });

    /* formulários */
    document.addEventListener('submit', function (e) {
      if (e.target.id === 'formSalario' || e.target.id === 'formPlano' || e.target.id === 'formNumeros') e.preventDefault();
      if (e.target.id === 'formInfo') {
        e.preventDefault();
        var r = S.registrarInfo(e.target.texto.value);
        if (r.erro) return aviso(r.erro);
        e.target.reset(); aviso('Informação entregue a ' + r.andar.nome + '.');
      }
      if (e.target.id === 'formReuniao') {
        e.preventDefault();
        var f = e.target, ands = Array.prototype.filter.call(f.querySelectorAll('[name=andar]'), function (c) { return c.checked; }).map(function (c) { return +c.value; });
        var m = S.marcarReuniao({ titulo: f.titulo.value, inicio: new Date(f.dia.value + 'T' + f.hora.value), dur: +f.dur.value, andares: ands, origem: 'manual' });
        if (m.erro) return aviso(m.erro);
        f.titulo.value = ''; aviso('Reunião marcada para ' + F.dataMedia(m.reuniao.inicio) + ' às ' + F.hora(m.reuniao.inicio) + '.');
      }
    });

    /* dicas dos gráficos: mouse e teclado mostram a mesma coisa */
    document.addEventListener('pointermove', function (e) {
      var t = e.target.closest && e.target.closest('[data-dica]');
      if (t) { var p = t.dataset.dica.split('|'); dicaDaCena = false; mostrarDica(e.clientX, e.clientY, p[0], p.slice(1).join('|')); }
      else if (!dicaDaCena && !(e.target.closest && e.target.closest('#g14'))) $('dica').hidden = true;
    });
    document.addEventListener('focusin', function (e) {
      var t = e.target.closest && e.target.closest('[data-dica]');
      if (t) { var p = t.dataset.dica.split('|'), b = t.getBoundingClientRect(); mostrarDica(b.left + b.width / 2, b.top, p[0], p.slice(1).join('|')); }
    });
    document.addEventListener('focusout', function (e) { if (e.target.closest && e.target.closest('[data-dica]')) $('dica').hidden = true; });

    /* nome da empresa: clique para trocar */
    $('empresaNome').addEventListener('click', function () {
      var bt = this, inp = document.createElement('input');
      inp.className = 'marca-edita'; inp.maxLength = 28; inp.value = S.nomeEmpresa(); inp.setAttribute('aria-label', 'Nome da empresa (a primeira palavra vira a marca em destaque)');
      bt.hidden = true; bt.parentNode.insertBefore(inp, bt); inp.focus(); inp.select();
      function sair(salvar) { if (!inp.parentNode) return; if (salvar) S.definirNomeEmpresa(inp.value); inp.parentNode.removeChild(inp); bt.hidden = false; }
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') sair(true); if (e.key === 'Escape') sair(false); e.stopPropagation(); });
      inp.addEventListener('blur', function () { sair(true); });
    });
    $('btResumo').addEventListener('click', abrirResumo);
    if ($('btProdutos')) $('btProdutos').addEventListener('click', abrirProdutos);
    if ($('btSkills')) $('btSkills').addEventListener('click', abrirSkillsExternas);
    $('btQualidade').addEventListener('click', function () {
      var q = cena.qualidadeAtual && cena.qualidadeAtual() === 'alta' ? 'leve' : 'alta';
      cena.qualidade(q); S.guarda.gravar('torre.qualidade', q);
      aviso(q === 'alta' ? 'Gráficos no máximo, com brilho.' : 'Modo leve ligado: sem brilho, mais rápido.');
    });
    $('btTela').addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () { aviso('Tela cheia não está disponível aqui.'); });
    });
    root.addEventListener('resize', function () { if (andarAberto) cena.margemDireita(margem()); marcarElevador(andarAberto); });

    /* o que a simulação avisa */
    var contador = 0;
    S.on('tick', function () {
      contador++; placar(); empurrarFeed();
      if (andarAberto && abaAtual === 'geral') blocos.forEach(function (id) { if (B[id].vivo) desenharBloco(id); });
      if (andarAberto === 7 && abaAtual === 'geral' && contador % 20 === 0) desenharBloco('agenda');
      if (fichaAberta && fichaAberta.n) { var g = T.andar(fichaAberta.n).agentes[fichaAberta.i], el = $('fichaTarefas'); if (el) el.textContent = F.int(S.tarefasDe(g)); }
      if (contador % 5 === 0) { cena.reuniaoAtiva(S.emAndamento().length > 0); if (contador % 30 === 0) cena.orcamento(S.financeiro().usado); }
    });
    S.on('evento', function (e) {
      filaFeed.push(e);
      if (andarAberto && abaAtual === 'atividade' && (e.andar === andarAberto || e.para === andarAberto)) {
        var ul = $('fAtiv'); if (!ul) return;
        var v = ul.querySelector('.vazio'); if (v) ul.removeChild(v);
        ul.insertAdjacentHTML('afterbegin', linhaFeed(e));
        while (ul.children.length > 50) ul.removeChild(ul.lastChild);
      }
    });
    S.on('reunioes', function () { if (andarAberto === 7 && abaAtual === 'geral') { desenharBloco('agenda'); desenharBloco('sala'); } });
    S.on('status', function (s) { cena.statusAgente(s.andar, s.idx); });
    /* leitura marcada, salário alterado ou passo do lançamento concluído: atualiza a estante */
    S.on('estudo', function () { if (andarAberto === S.andarEstudo() && abaAtual === 'geral' && !fichaAberta) { desenharBloco('estante'); desenharBloco('kpis'); } });
    S.on('empresa', nomeEmpresa);
    S.on('novoDia', function () { if (andarAberto) definirAba(abaAtual); });
    cena.reuniaoAtiva(S.emAndamento().length > 0); cena.orcamento(S.financeiro().usado);
  }
  function desenharBlocoForcado(id) { var el = document.querySelector('#pCorpo [data-b="' + id + '"]'); if (el) { el.innerHTML = B[id].render(andarAberto); if (B[id].depois) B[id].depois(); } }

  T.UI = {
    montar: montar, abrirAndar: abrirAndar, fechar: fechar, definirAba: definirAba, abrirAgente: abrirAgente, fecharFicha: fecharFicha,
    abrirSala: abrirSala, fecharSala: fecharSala, abrirLivro: abrirLivro, abrirProdutos: abrirProdutos, abrirSkillsExternas: abrirSkillsExternas, mostrarSkillExterna: mostrarSkillExterna,
    abrirResumo: abrirResumo, fecharModal: fecharModal, aviso: aviso, dicaCena: dicaCena,
    andarAberto: function () { return andarAberto; }, salaAberta: function () { return salaAberta; }, fichaAberta: function () { return fichaAberta; }
  };
})(window);
