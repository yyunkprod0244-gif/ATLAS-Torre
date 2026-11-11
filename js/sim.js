/* ============================================================================
   TORRE — motor de simulação
   ----------------------------------------------------------------------------
   Faz a empresa "funcionar sozinha": gera os acontecimentos de cada andar,
   mantém os números do dia, o financeiro do mês, a agenda de reuniões e o
   resumo diário do Mega Brain.

   IMPORTANTE: os números são SIMULADOS (fictícios). Os dias anteriores são
   calculados a partir da data, então ficam iguais a cada visita. O que você
   cria de verdade — reuniões marcadas e informações registradas — fica salvo
   no navegador (localStorage).

   Para ligar dados reais no futuro, este é o arquivo a substituir: a interface
   só conversa com a simulação pelas funções exportadas em T.Sim.
   ========================================================================== */
(function (root) {
  'use strict';
  var T = root.Torre, F = T.fmt;

  /* ---------- eventos internos ---------- */
  var ouvintes = {};
  function on(ev, fn) { (ouvintes[ev] = ouvintes[ev] || []).push(fn); }
  function emitir(ev, dado) {
    (ouvintes[ev] || []).forEach(function (fn) {
      try { fn(dado); } catch (e) { if (root.console) console.error('[sim] ouvinte de "' + ev + '" falhou', e); }
    });
  }

  /* ---------- utilidades ---------- */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rint(a, b) { return Math.floor(rnd(a, b + 1)); }
  function um(lista) { return lista[Math.floor(Math.random() * lista.length)]; }
  function expo(media) { return Math.min(3.2, Math.max(0.25, -Math.log(1 - Math.random()))) * media; }
  function agora() { return new Date(); }
  function fracDia(d) { d = d || agora(); return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400; }
  function addDias(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function inicioDoDia(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function diasNoMes(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }

  var guarda = {
    ler: function (chave, padrao) {
      try { var v = root.localStorage && root.localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; }
    },
    gravar: function (chave, valor) {
      try { if (root.localStorage) root.localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* armazenamento indisponível: segue sem salvar */ }
    }
  };

  /* ==========================================================================
     RITMO DA EMPRESA — de quantos em quantos segundos (em média) acontece cada
     tipo de evento. Os totais do dia saem destes mesmos números, então o que
     aparece ao vivo e o que aparece nos painéis sempre combinam.
     ======================================================================== */
  var RITMO = {
    info: 6, curriculo: 480,
    followup: 12, lead: 150, qualificado: 270, proposta: 700, venda: 2700,
    otimizacao: 10,
    video: 50, post: 25, comentarios: 9,
    lancamento: 15, pagamento: 1500,
    lembrete: 20,
    memoria: 8, difusao: 40
  };

  var ORC_TOTAL = T.CONFIG.orcamento.reduce(function (a, c) { return a + c.planejado; }, 0);
  var ORC_TRAFEGO = (T.CONFIG.orcamento.filter(function (c) { return c.id === 'trafego'; })[0] || { planejado: 0 }).planejado;

  /* Totais de um dia inteiro, calculados a partir da data (sempre iguais). */
  var cacheDias = {};
  function totaisDoDia(d) {
    var k = F.chaveDia(d);
    if (cacheDias[k]) return cacheDias[k];
    var r = T.rng('dia:' + k), fds = d.getDay() === 0 || d.getDay() === 6, fv = fds ? 0.68 : 1;
    function n(tipo, fator, amp) {
      amp = amp || 0.09;
      return Math.max(0, Math.round(86400 / RITMO[tipo] * (fator || 1) * (1 - amp + r() * amp * 2)));
    }
    var o = {};
    o.info = n('info'); o.curriculos = n('curriculo', fds ? 0.5 : 1, 0.2);
    o.followups = n('followup', fv); o.leads = n('lead', fv, 0.14);
    o.qualificados = Math.min(o.leads, n('qualificado', fv, 0.14));
    o.propostas = Math.min(o.qualificados, n('proposta', fv, 0.16));
    o.vendas = Math.max(1, Math.min(o.propostas, n('venda', fv, 0.22)));
    o.ticket = Math.round(2350 + r() * 550);
    o.receita = o.vendas * o.ticket;
    o.otimizacoes = n('otimizacao');
    o.alcance = Math.round(o.otimizacoes * (44 + r() * 10));
    o.cliques = Math.round(o.alcance * (0.017 + r() * 0.004));
    o.leadsMkt = Math.round(o.leads * (0.66 + r() * 0.08));
    o.investMkt = Math.round(ORC_TRAFEGO / 30 * (0.9 + r() * 0.2));
    o.videos = n('video'); o.posts = n('post'); o.comentarios = n('comentarios') * 3;
    o.views = Math.round(o.posts * (760 + r() * 140));
    o.interacoes = Math.round(o.views * (0.056 + r() * 0.012));
    o.lancamentos = n('lancamento'); o.pagamentos = n('pagamento', 1, 0.2);
    o.gastos = Math.round(ORC_TOTAL / 30 * (0.82 + r() * 0.4));
    o.lembretes = n('lembrete'); o.memorias = n('memoria'); o.difusoes = n('difusao');
    o.atas = 0; /* calculado pela agenda */
    o.msgs = o.info + o.curriculos + o.followups + o.leads + o.qualificados + o.propostas + o.vendas + o.otimizacoes +
      o.videos * 4 + o.posts + Math.round(o.comentarios / 3) + o.lancamentos + o.pagamentos + o.lembretes + o.memorias + o.difusoes;
    o.decisoes = Math.round(o.msgs * (0.30 + r() * 0.04));
    o.tarefas = Math.round(o.msgs * 2.5);
    cacheDias[k] = o;
    return o;
  }

  /* ---------- nomes fictícios ---------- */
  var NEG_TIPOS = ['Pizzaria', 'Clínica', 'Studio', 'Barbearia', 'Imobiliária', 'Academia', 'Pet Shop', 'Padaria', 'Ótica', 'Auto Center', 'Escola', 'Doceria', 'Floricultura', 'Hamburgueria', 'Consultório', 'Ateliê', 'Cafeteria', 'Loja'];
  var NEG_NOMES = ['Bela Vista', 'Grão Dourado', 'Horizonte', 'Vila Nova', 'Monte Claro', 'Dois Irmãos', 'Aurora', 'Primavera', 'do Vale', 'Estrela Guia', 'Jardim Secreto', 'Porto Azul', 'Ipê Amarelo', 'Sabiá', 'Girassol', 'Raiz Forte', 'Casa Nova', 'Boa Forma', 'Luz do Sol', 'Sete Mares', 'Pé de Serra', 'Céu Azul'];
  function cliente(r) {
    r = r || Math.random;
    return NEG_TIPOS[Math.floor(r() * NEG_TIPOS.length)] + ' ' + NEG_NOMES[Math.floor(r() * NEG_NOMES.length)];
  }
  function plano(r) {
    r = r || Math.random;
    var alvo = r() * 100, acc = 0, ps = T.CONFIG.planos;
    for (var i = 0; i < ps.length; i++) { acc += ps[i].peso; if (alvo <= acc) return ps[i]; }
    return ps[0];
  }
  var TITULOS = ['Antes e depois: o novo site da {c}', '3 erros que fazem um site perder clientes', 'Como a {c} dobrou os pedidos pelo site',
    'Tour pelo site da {c}', 'Site pronto em 7 dias: bastidores', 'Por que seu negócio precisa de um site', 'Depoimento: {c}',
    'Loja virtual no ar em uma semana', 'O que é uma landing page, em 30 segundos', '5 sinais de que seu site espanta clientes',
    'Do briefing ao site no ar', 'Quanto custa um site profissional?'];
  var ETAPAS = ['Roteiro', 'Corte', 'Legendas', 'Render'];
  var VAGAS = ['designer de interfaces', 'gestor de tráfego', 'editor de vídeo', 'desenvolvedor front-end', 'closer de vendas', 'social media'];
  var ORIGENS = ['WhatsApp', 'Site', 'Instagram', 'E-mail'];

  /* ==========================================================================
     ESTADO
     ======================================================================== */
  var E = null;          /* estado completo, criado em preparar() */
  var hoje = null;       /* atalho para E.hoje */
  var seq = 0;

  function andar(n) { return T.ANDARES[n - 1]; }
  function nomeAndar(n) { return andar(n).nome; }

  function agenteAtivo(n) {
    var lista = andar(n).agentes, i;
    for (var t = 0; t < 6; t++) { i = Math.floor(Math.random() * lista.length); if (lista[i].status === 'trabalhando') return i; }
    return i;
  }
  function tarefasDe(ag) { return Math.floor(ag.ritmo * fracDia()) + ag.extra; }

  function preparar() {
    T.gerar();
    var d = agora(), f = fracDia(d), alvo = totaisDoDia(d), k;
    hoje = {};
    for (k in alvo) if (typeof alvo[k] === 'number') hoje[k] = Math.floor(alvo[k] * f);
    hoje.ticket = alvo.ticket;
    hoje.pendentes = rint(4, 11);
    hoje.atas = 0;

    E = {
      dia: F.chaveDia(d),
      hoje: hoje,
      feed: [],
      porAndar: T.ANDARES.map(function () { return { feed: [], eventos: 0 }; }),
      vendas: [], campanhas: [], fila: [], aPublicar: [], posts: [], plataformas: [], inbox: [],
      orcamento: [], reunioesUsuario: [],
      empresa: guarda.ler('torre.empresa', null) || T.CONFIG.empresa.nome
    };

    /* --- vendas de hoje (para a receita bater com a lista) --- */
    var rv = T.rng('vendas:' + E.dia), base = inicioDoDia(d).getTime(), i;
    for (i = 0; i < hoje.vendas; i++) {
      var p = plano(rv);
      E.vendas.push({
        cliente: cliente(rv), plano: p.nome, valor: p.preco,
        t: new Date(base + Math.floor((i + rv()) / Math.max(1, hoje.vendas) * f * 86400000)),
        agente: Math.floor(rv() * andar(2).agentes.length)
      });
    }
    E.vendas.reverse(); /* mais recente primeiro */
    hoje.receita = E.vendas.reduce(function (a, v) { return a + v.valor; }, 0);

    /* --- campanhas de marketing --- */
    var rc = T.rng('camp:' + E.dia), pesos = T.CONFIG.campanhas.map(function (c) { return c.fatia * (0.75 + rc() * 0.6); });
    var somaP = pesos.reduce(function (a, b) { return a + b; }, 0);
    E.campanhas = T.CONFIG.campanhas.map(function (c, j) {
      return { nome: c.nome, canal: c.canal, fatia: c.fatia, invest: hoje.investMkt * c.fatia, leads: Math.round(hoje.leadsMkt * pesos[j] / somaP) };
    });

    /* --- fila de vídeo --- */
    var rf = T.rng('fila:' + E.dia);
    for (i = 0; i < 7; i++) E.fila.push(novoVideo(rf, (i + rf()) / 7.4));
    E.fila.sort(function (a, b) { return b.prog - a.prog; });

    /* --- redes sociais --- */
    var rp = T.rng('plat:' + E.dia), perf = T.CONFIG.plataformas.map(function (p) { return p.fatia * (0.8 + rp() * 0.5); });
    var somaPerf = perf.reduce(function (a, b) { return a + b; }, 0);
    E.plataformas = T.CONFIG.plataformas.map(function (p, j) {
      return { id: p.id, nome: p.nome, fatia: p.fatia, posts: Math.round(hoje.posts * p.fatia), views: Math.round(hoje.views * perf[j] / somaPerf) };
    });
    for (i = 0; i < 6; i++) {
      var pl = T.CONFIG.plataformas[Math.floor(rp() * T.CONFIG.plataformas.length)];
      E.posts.push({ plataforma: pl.nome, titulo: um2(rp, TITULOS).replace('{c}', cliente(rp)), t: new Date(d.getTime() - (i + 1) * 31000 - rp() * 9000), views: Math.round(300 + rp() * 2400) });
    }

    /* --- orçamento do mês --- */
    var dm = diasNoMes(d), decorrido = (d.getDate() - 1 + f) / dm, ro = T.rng('orc:' + d.getFullYear() + '-' + d.getMonth());
    E.orcamento = T.CONFIG.orcamento.map(function (c) {
      var fator = c.id === 'reserva' ? 0.2 + ro() * 0.4 : 0.84 + ro() * 0.34;
      return { id: c.id, nome: c.nome, planejado: c.planejado, gasto: c.planejado * decorrido * fator };
    });
    var x = new Date(d.getFullYear(), d.getMonth(), 1), receitaAntes = 0;
    while (x < inicioDoDia(d)) { receitaAntes += totaisDoDia(x).receita; x = addDias(x, 1); }
    E.receitaAntes = receitaAntes;

    /* --- caixa de entrada (itens simulados + os que você registrou) --- */
    var ri = T.rng('inbox:' + E.dia);
    for (i = 0; i < 6; i++) {
      var inf = INFOS[Math.floor(ri() * INFOS.length)];
      E.inbox.push({ t: new Date(d.getTime() - (i + 1) * 21000 - ri() * 8000), texto: maiuscula(inf.t.replace('{c}', cliente(ri))), origem: ORIGENS[Math.floor(ri() * ORIGENS.length)], destino: inf.para, usuario: false });
    }
    guarda.ler('torre.inbox', []).forEach(function (it) {
      E.inbox.push({ t: new Date(it.t), texto: it.texto, origem: it.origem, destino: it.destino, usuario: true });
    });
    E.inbox.sort(function (a, b) { return b.t - a.t; });

    /* --- atividade por andar (base do dia) --- */
    var taxa = [1 / RITMO.info + 1 / RITMO.curriculo,
      1 / RITMO.followup + 0.3 / RITMO.lead + 1 / RITMO.qualificado + 1 / RITMO.proposta + 1 / RITMO.venda,
      1 / RITMO.otimizacao + 0.7 / RITMO.lead,
      4 / RITMO.video,
      1 / RITMO.post + 1 / RITMO.comentarios,
      1 / RITMO.lancamento + 1 / RITMO.pagamento,
      1 / RITMO.lembrete,
      1 / RITMO.memoria + 1 / RITMO.difusao];
    E.porAndar.forEach(function (p, j) { p.eventos = Math.floor(taxa[j] * 86400 * f); });

    /* --- reuniões marcadas por você --- */
    E.reunioesUsuario = guarda.ler('torre.reunioes', []).map(function (m) {
      var ini = new Date(m.inicio);
      return { id: m.id, titulo: m.titulo, inicio: ini, fim: new Date(ini.getTime() + m.dur * 60000), dur: m.dur, andares: m.andares, tipo: 'usuario', origem: m.origem || 'manual' };
    }).filter(function (m) { return !isNaN(m.inicio) && m.fim > inicioDoDia(d); });

    hoje.atas = reunioes().filter(function (m) { return m.estado === 'concluida' && ehHoje(m.inicio); }).length;
    contarAtivos();
    return E;
  }
  function um2(r, lista) { return lista[Math.floor(r() * lista.length)]; }
  function maiuscula(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function ehHoje(d) { return F.chaveDia(d) === F.chaveDia(agora()); }

  function novoVideo(r, prog) {
    r = r || Math.random;
    return {
      id: 'v' + (++seq), titulo: um2(r, TITULOS).replace('{c}', cliente(r)), prog: prog || 0,
      vel: 0.0022 + r() * 0.002, agente: Math.floor(r() * andar(4).agentes.length)
    };
  }

  var ativos = 0;
  function contarAtivos() {
    ativos = 0;
    T.ANDARES.forEach(function (a) { a.agentes.forEach(function (g) { if (g.status === 'trabalhando' || g.status === 'reuniao') ativos++; }); });
  }

  /* ==========================================================================
     ACONTECIMENTOS
     ======================================================================== */
  /* o: { tipo, andar, para, via, texto, agente, agentePara, destaque } */
  function evento(o) {
    o.t = agora();
    o.id = ++seq;
    if (o.agente == null) o.agente = agenteAtivo(o.andar);
    if (o.para && o.para !== o.andar && o.agentePara == null) o.agentePara = agenteAtivo(o.para);
    andar(o.andar).agentes[o.agente].extra++;
    hoje.msgs++; hoje.tarefas += rint(1, 4);
    if (Math.random() < 0.32) hoje.decisoes++;
    E.porAndar[o.andar - 1].eventos++;
    E.feed.unshift(o); if (E.feed.length > 160) E.feed.length = 160;
    var fa = E.porAndar[o.andar - 1].feed; fa.unshift(o); if (fa.length > 70) fa.length = 70;
    if (o.para && o.para !== o.andar) { var fb = E.porAndar[o.para - 1].feed; fb.unshift(o); if (fb.length > 70) fb.length = 70; }
    emitir('evento', o);
    return o;
  }
  function ag(n, i) { return andar(n).agentes[i].nome; }

  var INFOS = [
    { t: 'pedido de orçamento de {c}', para: 2, peso: 5 },
    { t: 'mensagem de {c} perguntando sobre prazos', para: 2, peso: 3 },
    { t: 'briefing de site enviado por {c}', para: 2, peso: 2 },
    { t: 'pedido de vídeo institucional de {c}', para: 4, peso: 1 },
    { t: 'comprovante de pagamento de {c}', para: 6, peso: 2 },
    { t: 'pedido de reunião de {c}', para: 7, peso: 2 },
    { t: 'sugestão de campanha vinda da equipe', para: 3, peso: 1 },
    { t: 'elogio de {c} sobre o site entregue', para: 3, peso: 1 },
    { t: 'pedido de troca de fotos no site de {c}', para: 8, peso: 1 },
    { t: 'dúvida de {c} sobre domínio e hospedagem', para: 8, peso: 1 },
    { t: 'nota fiscal recebida de fornecedor', para: 6, peso: 1 },
    { t: 'pedido de postagem urgente de {c}', para: 5, peso: 1 }
  ];
  var INFOS_PESO = INFOS.reduce(function (a, i) { return a + i.peso; }, 0);
  function infoAleatoria() {
    var alvo = Math.random() * INFOS_PESO, acc = 0;
    for (var i = 0; i < INFOS.length; i++) { acc += INFOS[i].peso; if (alvo <= acc) return INFOS[i]; }
    return INFOS[0];
  }

  var gerar = {
    info: function () {
      var inf = infoAleatoria(), i = agenteAtivo(1), texto = inf.t.replace('{c}', cliente());
      hoje.info++; hoje.pendentes = Math.max(2, Math.min(16, hoje.pendentes + rint(-2, 2)));
      E.inbox.unshift({ t: agora(), texto: maiuscula(texto), origem: um(ORIGENS), destino: inf.para, usuario: false });
      if (E.inbox.length > 40) E.inbox.length = 40;
      evento({ tipo: 'info', andar: 1, para: inf.para, via: true, agente: i, texto: ag(1, i) + ' triou: ' + texto });
    },
    curriculo: function () {
      var i = agenteAtivo(1); hoje.curriculos++;
      evento({ tipo: 'curriculo', andar: 1, agente: i, texto: ag(1, i) + ' analisou um currículo para a vaga de ' + um(VAGAS) });
    },
    followup: function () {
      var i = agenteAtivo(2), c = cliente(); hoje.followups++;
      if (Math.random() < 0.12) return evento({ tipo: 'followup', andar: 2, para: 7, via: true, agente: i, texto: ag(2, i) + ' pediu uma reunião de apresentação com ' + c });
      evento({ tipo: 'followup', andar: 2, agente: i, texto: ag(2, i) + um([' enviou follow-up para ', ' respondeu uma objeção de preço de ', ' reativou o contato de ', ' confirmou os dados de ', ' tirou dúvidas de ']) + c });
    },
    lead: function () {
      var c = cliente(); hoje.leads++;
      if (Math.random() < 0.7) {
        var camp = um(E.campanhas), i = agenteAtivo(3);
        camp.leads++; hoje.leadsMkt++;
        return evento({ tipo: 'lead', andar: 3, para: 2, via: true, agente: i, texto: 'A campanha «' + camp.nome + '» gerou um lead: ' + c });
      }
      var j = agenteAtivo(1);
      evento({ tipo: 'lead', andar: 1, para: 2, via: true, agente: j, texto: ag(1, j) + ' encaminhou ' + c + ' como novo lead' });
    },
    qualificado: function () {
      if (hoje.qualificados >= hoje.leads) return;
      var i = agenteAtivo(2); hoje.qualificados++;
      evento({ tipo: 'qualificado', andar: 2, agente: i, texto: ag(2, i) + ' qualificou ' + cliente() + ': interesse em ' + plano().nome });
    },
    proposta: function () {
      if (hoje.propostas >= hoje.qualificados) return;
      var i = agenteAtivo(2), p = plano(); hoje.propostas++;
      evento({ tipo: 'proposta', andar: 2, para: 6, via: true, agente: i, texto: ag(2, i) + ' enviou proposta de ' + p.nome + ' para ' + cliente() + ' — ' + F.brl(p.preco) });
    },
    venda: function () {
      if (hoje.vendas >= hoje.propostas) return;
      var i = agenteAtivo(2), p = plano(), c = cliente();
      hoje.vendas++; hoje.receita += p.preco;
      E.vendas.unshift({ cliente: c, plano: p.nome, valor: p.preco, t: agora(), agente: i });
      evento({ tipo: 'venda', andar: 2, para: 6, via: true, agente: i, destaque: true, texto: 'Venda fechada: ' + c + ' contratou ' + p.nome + ' por ' + F.brl(p.preco) });
      setTimeout(function () {
        var k = agenteAtivo(6);
        evento({ tipo: 'receita', andar: 6, para: 8, agente: k, texto: ag(6, k) + ' registrou a entrada de ' + F.brl(p.preco) + ' de ' + c });
      }, 2600);
      setTimeout(function () {
        var k = agenteAtivo(7);
        evento({ tipo: 'kickoff', andar: 7, para: 2, via: true, agente: k, texto: ag(7, k) + ' agendou o kickoff com ' + c });
      }, 5200);
    },
    otimizacao: function () {
      var i = agenteAtivo(3), camp = um(E.campanhas), alc = rint(40, 58), sorte = Math.random();
      hoje.otimizacoes++; hoje.alcance += alc; hoje.cliques += Math.random() < alc * 0.019 ? 1 : 0;
      var gasto = hoje.investMkt > 0 ? ORC_TRAFEGO / 30 / (86400 / RITMO.otimizacao) : 0;
      hoje.investMkt += gasto; camp.invest += gasto; E.orcamento[0].gasto += gasto;
      if (sorte < 0.1) return evento({ tipo: 'otimizacao', andar: 3, para: 4, via: true, agente: i, texto: ag(3, i) + ' pediu um vídeo novo para «' + camp.nome + '»' });
      if (sorte < 0.17) return evento({ tipo: 'otimizacao', andar: 3, para: 5, via: true, agente: i, texto: ag(3, i) + ' enviou o calendário de posts da semana' });
      evento({
        tipo: 'otimizacao', andar: 3, agente: i,
        texto: ag(3, i) + um([' ajustou o público de «' + camp.nome + '»', ' pausou um anúncio caro em «' + camp.nome + '»', ' aprovou um criativo novo para «' + camp.nome + '»',
          ' publicou um artigo otimizado para SEO', ' encontrou ' + rint(4, 18) + ' palavras-chave novas', ' testou dois títulos em «' + camp.nome + '»'])
      });
    },
    post: function () {
      var alvo = Math.random(), acc = 0, pl = E.plataformas[0], i;
      for (i = 0; i < E.plataformas.length; i++) { acc += E.plataformas[i].fatia; if (alvo <= acc) { pl = E.plataformas[i]; break; } }
      var titulo = E.aPublicar.length ? E.aPublicar.shift() : um(TITULOS).replace('{c}', cliente());
      var a = agenteAtivo(5);
      hoje.posts++; pl.posts++;
      E.posts.unshift({ plataforma: pl.nome, titulo: titulo, t: agora(), views: rint(20, 90) });
      if (E.posts.length > 8) E.posts.length = 8;
      evento({ tipo: 'post', andar: 5, para: Math.random() < 0.25 ? 3 : null, via: true, agente: a, texto: 'Publicado no ' + pl.nome + ': «' + titulo + '»' });
    },
    comentarios: function () {
      var a = agenteAtivo(5), pl = um(E.plataformas), n = rint(2, 5), v = rint(180, 420);
      hoje.comentarios += n; hoje.views += v; pl.views += v; hoje.interacoes += Math.round(v * 0.06) + n;
      E.posts.forEach(function (p) { p.views += rint(0, 60); });
      if (Math.random() < 0.08) return evento({ tipo: 'comentarios', andar: 5, para: 2, via: true, agente: a, texto: ag(5, a) + ' achou um comentário com intenção de compra no ' + pl.nome });
      evento({ tipo: 'comentarios', andar: 5, agente: a, texto: ag(5, a) + um([' respondeu ' + n + ' comentários no ', ' agradeceu ' + n + ' elogios no ', ' moderou a conversa no ']) + pl.nome });
    },
    lancamento: function () {
      var a = agenteAtivo(6), cat = um(E.orcamento); hoje.lancamentos++;
      evento({
        tipo: 'lancamento', andar: 6, agente: a,
        texto: ag(6, a) + um([' conciliou ' + rint(3, 14) + ' lançamentos de ' + cat.nome.toLowerCase(), ' categorizou uma despesa em ' + cat.nome.toLowerCase(),
          ' emitiu a nota fiscal de ' + cliente(), ' conferiu o boleto de ' + cliente(), ' atualizou a projeção de caixa do mês'])
      });
    },
    pagamento: function () {
      var a = agenteAtivo(6), cat = um(E.orcamento.slice(1)), valor = rint(18, 96) * 10;
      hoje.pagamentos++; cat.gasto += valor; hoje.gastos += valor;
      evento({ tipo: 'pagamento', andar: 6, para: 8, agente: a, texto: ag(6, a) + ' registrou um pagamento de ' + F.brl(valor) + ' em ' + cat.nome.toLowerCase() });
    },
    lembrete: function () {
      var a = agenteAtivo(7), prox = proximaReuniao(), sorte = Math.random();
      hoje.lembretes++;
      if (sorte < 0.2) {
        var dest = rint(1, 6);
        return evento({ tipo: 'lembrete', andar: 7, para: dest, via: true, agente: a, texto: ag(7, a) + ' distribuiu as tarefas da última ata' });
      }
      evento({
        tipo: 'lembrete', andar: 7, agente: a,
        texto: ag(7, a) + (prox && sorte < 0.6 ? ' enviou lembrete da reunião das ' + F.hora(prox.inicio) : um([' confirmou a presença de ' + cliente(), ' preparou a pauta do próximo encontro', ' organizou a gravação da última reunião']))
      });
    },
    memoria: function () {
      var a = agenteAtivo(8), sorte = Math.random(), n = rint(1, 7);
      hoje.memorias++;
      if (sorte < 0.22) return evento({ tipo: 'memoria', andar: 8, para: n, agente: a, texto: ag(8, a) + ' repriorizou ' + rint(3, 24) + ' tarefas de ' + nomeAndar(n) });
      if (sorte < 0.3) return evento({ tipo: 'memoria', andar: 8, para: n, agente: a, texto: ag(8, a) + ' detectou fila acumulada em ' + nomeAndar(n) + ' e redistribuiu o trabalho' });
      evento({
        tipo: 'memoria', andar: 8, agente: a,
        texto: ag(8, a) + um([' memorizou o contexto de ' + cliente(), ' cruzou os dados de vendas e marketing', ' atualizou o resumo parcial do dia',
          ' revisou as prioridades da semana', ' registrou uma decisão automática'])
      });
    },
    difusao: function () {
      hoje.difusoes++;
      var o = evento({ tipo: 'difusao', andar: 8, texto: 'Mega Brain sincronizou os 8 andares' });
      emitir('difusao', o);
    }
  };

  function avancarFila(dt) {
    for (var i = E.fila.length - 1; i >= 0; i--) {
      var v = E.fila[i], antes = Math.floor(v.prog * 4);
      v.prog += v.vel * dt;
      if (v.prog >= 1) {
        E.fila.splice(i, 1);
        hoje.videos++;
        E.aPublicar.push(v.titulo); if (E.aPublicar.length > 12) E.aPublicar.shift();
        evento({ tipo: 'video', andar: 4, para: 5, via: true, agente: v.agente, texto: ag(4, v.agente) + ' finalizou «' + v.titulo + '»' });
        E.fila.push(novoVideo());
      } else if (Math.floor(v.prog * 4) !== antes && Math.random() < 0.7) {
        var a = agenteAtivo(4);
        evento({ tipo: 'etapa', andar: 4, agente: a, texto: ag(4, a) + ' concluiu ' + ETAPAS[antes].toLowerCase() + ' de «' + v.titulo + '»' });
      }
    }
    E.fila.sort(function (a, b) { return b.prog - a.prog; });
  }

  /* alguns agentes mudam de estado de tempos em tempos (a torre "respira") */
  function girarStatus() {
    for (var k = 0; k < 7; k++) {
      var a = um(T.ANDARES), i = Math.floor(Math.random() * a.agentes.length), g = a.agentes[i], antes = g.status, sorte = Math.random();
      if (antes === 'trabalhando') g.status = sorte < 0.6 ? 'ocioso' : sorte < 0.8 ? 'pausa' : 'reuniao';
      else g.status = 'trabalhando';
      var era = antes === 'trabalhando' || antes === 'reuniao', eh = g.status === 'trabalhando' || g.status === 'reuniao';
      ativos += (eh ? 1 : 0) - (era ? 1 : 0);
      emitir('status', { andar: a.n, idx: i, status: g.status });
    }
  }

  /* ==========================================================================
     REUNIÕES (7º andar)
     ======================================================================== */
  var PARES = [[2, 3], [3, 4], [4, 5], [2, 6], [1, 8], [5, 3], [6, 8], [7, 2], [1, 2], [3, 5], [4, 3], [8, 2]];
  var MODELOS = [
    ['Kickoff — {c}', [2, 7, 4], 40], ['Apresentação de proposta — {c}', [2, 7], 30],
    ['Alinhamento semanal de Vendas e Marketing', [2, 3], 45], ['Revisão das campanhas da semana', [3, 5, 6], 30],
    ['Planejamento de conteúdo', [3, 4, 5], 40], ['Fechamento financeiro parcial', [6, 8], 25],
    ['Aprovação de vídeos', [4, 5], 20], ['Retrospectiva dos andares', [1, 2, 3, 4, 5, 6, 7, 8], 50],
    ['Entrega de site — {c}', [2, 7], 35], ['Revisão das metas do mês', [2, 6, 8], 30],
    ['Treinamento de novos agentes', [1, 8], 30], ['Reunião de resultado — {c}', [3, 7], 30]
  ];
  var HORARIOS = [570, 630, 675, 810, 870, 920, 990, 1035, 1110, 1170]; /* minutos desde 0h */
  var cacheReun = {};

  function reunioesDoDia(d) {
    var k = F.chaveDia(d);
    if (cacheReun[k]) return cacheReun[k];
    var r = T.rng('reun:' + k), base = inicioDoDia(d).getTime(), lista = [];
    function mk(id, titulo, min, dur, andares, tipo) {
      var ini = new Date(base + min * 60000);
      lista.push({ id: id, titulo: titulo, inicio: ini, fim: new Date(ini.getTime() + dur * 60000), dur: dur, andares: andares, tipo: tipo, origem: 'torre' });
    }
    for (var h = 0; h < 24; h++) {
      var p = PARES[(h + d.getDate()) % PARES.length];
      mk('auto-' + k + '-' + h, 'Sincronização automática — ' + nomeAndar(p[0]) + ' × ' + nomeAndar(p[1]), h * 60, 12, [p[0], p[1], 8], 'auto');
    }
    HORARIOS.forEach(function (min, i) {
      if (r() < 0.86) {
        var m = MODELOS[Math.floor(r() * MODELOS.length)];
        mk('neg-' + k + '-' + i, m[0].replace('{c}', cliente(r)), min, m[2], m[1], 'negocio');
      } else { r(); r(); r(); }
    });
    cacheReun[k] = lista;
    return lista;
  }

  function estadoDe(m, t) { return t >= m.fim ? 'concluida' : t >= m.inicio ? 'andamento' : 'agendada'; }

  /* Tudo de hoje e de amanhã, mais o que você marcou para depois. */
  function reunioes() {
    var d = agora(), lista = reunioesDoDia(d).concat(reunioesDoDia(addDias(d, 1))).concat(E.reunioesUsuario);
    lista.forEach(function (m) { m.estado = estadoDe(m, d); });
    return lista.slice().sort(function (a, b) { return a.inicio - b.inicio; });
  }
  function proximaReuniao() {
    var d = agora(), melhor = null;
    reunioes().forEach(function (m) { if (m.inicio > d && (!melhor || m.inicio < melhor.inicio)) melhor = m; });
    return melhor;
  }
  function emAndamento() { return reunioes().filter(function (m) { return m.estado === 'andamento'; }); }

  function salvarReunioes() {
    guarda.gravar('torre.reunioes', E.reunioesUsuario.map(function (m) {
      return { id: m.id, titulo: m.titulo, inicio: m.inicio.toISOString(), dur: m.dur, andares: m.andares, origem: m.origem };
    }));
  }

  /* o: { titulo, inicio: Date, dur (min), andares: [n], origem: 'manual' | 'jarvis' } */
  function marcarReuniao(o) {
    var ini = o.inicio instanceof Date ? o.inicio : new Date(o.inicio);
    if (isNaN(ini)) return { erro: 'Não entendi a data e a hora da reunião.' };
    var titulo = String(o.titulo || '').trim().slice(0, 90) || 'Reunião';
    var dur = Math.max(5, Math.min(240, Math.round(o.dur || 30)));
    var ands = (o.andares || []).map(Number).filter(function (n, i, arr) { return n >= 1 && n <= 8 && arr.indexOf(n) === i; });
    if (ands.indexOf(7) < 0) ands.push(7);
    ands.sort();
    var m = { id: 'u-' + Date.now() + '-' + (++seq), titulo: titulo, inicio: ini, fim: new Date(ini.getTime() + dur * 60000), dur: dur, andares: ands, tipo: 'usuario', origem: o.origem || 'manual' };
    E.reunioesUsuario.push(m);
    salvarReunioes();
    evento({ tipo: 'reuniao', andar: 7, para: 8, texto: 'Reunião marcada: «' + titulo + '» — ' + F.dataMedia(ini) + ' às ' + F.hora(ini) });
    emitir('reunioes');
    return { reuniao: m };
  }
  function removerReuniao(id) {
    var antes = E.reunioesUsuario.length;
    E.reunioesUsuario = E.reunioesUsuario.filter(function (m) { return m.id !== id; });
    if (E.reunioesUsuario.length !== antes) { salvarReunioes(); emitir('reunioes'); return true; }
    return false;
  }

  var estadosVistos = {};
  function checarReunioes() {
    var d = agora();
    reunioes().forEach(function (m) {
      var antes = estadosVistos[m.id], est = m.estado;
      if (antes && antes !== est) {
        if (est === 'andamento') evento({ tipo: 'reuniao', andar: 7, texto: 'Reunião iniciada: «' + m.titulo + '»' });
        if (est === 'concluida') { hoje.atas++; evento({ tipo: 'reuniao', andar: 7, para: 8, texto: 'Reunião encerrada: «' + m.titulo + '» — ata enviada ao Mega Brain' }); }
        emitir('reunioes');
      }
      estadosVistos[m.id] = est;
    });
    if (F.chaveDia(d) !== E.dia) { preparar(); emitir('novoDia'); }
  }

  var NOTAS = ['Contexto carregado da memória central.', 'Pendências do último encontro revisadas.', 'Prazo de entrega confirmado.',
    'Tarefas distribuídas entre os andares participantes.', 'Dúvida de orçamento encaminhada ao Financeiro.', 'Material de apoio enviado aos participantes.',
    'Decisão registrada: seguir com a proposta atual.', 'Próximo encontro sugerido para a semana que vem.', 'Riscos mapeados e responsáveis definidos.',
    'Ata parcial enviada ao Mega Brain.'];
  var PAUTAS = {
    auto: ['Fila de tarefas entre os andares', 'Pendências do último ciclo', 'Ajuste de prioridades'],
    negocio: ['Objetivo do encontro', 'Pontos em aberto', 'Próximos passos e responsáveis'],
    usuario: ['Assunto principal', 'Decisões necessárias', 'Próximos passos e responsáveis']
  };

  /* A reunião que está acontecendo agora (dá preferência às que não são automáticas). */
  function salaAoVivo() {
    var lista = emAndamento();
    if (!lista.length) return { reuniao: null, proxima: proximaReuniao() };
    lista.sort(function (a, b) { return (a.tipo === 'auto' ? 1 : 0) - (b.tipo === 'auto' ? 1 : 0) || b.inicio - a.inicio; });
    var m = lista[0], dec = (agora() - m.inicio) / 1000, r = T.rng('notas:' + m.id), ordem = NOTAS.slice(), notas = [];
    for (var i = ordem.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), tmp = ordem[i]; ordem[i] = ordem[j]; ordem[j] = tmp; }
    var passo = Math.max(20, m.dur * 60 / 9), n = Math.min(8, Math.floor(dec / passo));
    for (i = 0; i < n; i++) notas.push({ t: new Date(m.inicio.getTime() + (i + 1) * passo * 1000), texto: ordem[i] });
    return { reuniao: m, decorrido: dec, progresso: Math.min(1, dec / (m.dur * 60)), pauta: PAUTAS[m.tipo] || PAUTAS.negocio, notas: notas.reverse(), outras: lista.length - 1 };
  }

  /* ==========================================================================
     ENTRADA DE INFORMAÇÃO (1º andar) — o que você registra de verdade
     ======================================================================== */
  var ROTAS = [
    [7, /(reuni|agenda|\bcall\b|marcar|horario|encontro)/],
    [6, /(pagar|pagamento|pagou|boleto|nota fiscal|imposto|custo|fatura|reembols|cobranc|r\$|dinheiro)/],
    [5, /(publicar|postar|\bposts?\b|instagram|tiktok|youtube|facebook|linkedin|stories|reels)/],
    [4, /(video|edicao|editar|\bcorte|gravar|gravacao|legenda)/],
    [3, /(anuncio|campanha|trafego|\bseo\b|marca|blog|divulg|promoc)/],
    [1, /(curriculo|\bvaga|contrat|candidat|ferias)/],
    [2, /(orcamento|\bsite|\bloja|landing|cliente|proposta|comprar|preco|venda|\blead|interess)/]
  ];
  function classificar(texto) {
    var t = T.normalizar(texto);
    for (var i = 0; i < ROTAS.length; i++) if (ROTAS[i][1].test(t)) return ROTAS[i][0];
    return 8;
  }
  function registrarInfo(texto, origem) {
    texto = String(texto || '').trim().slice(0, 240);
    if (!texto) return { erro: 'Escreva a informação que deseja registrar.' };
    var destino = classificar(texto), item = { t: agora(), texto: texto, origem: origem || 'Você', destino: destino, usuario: true };
    E.inbox.unshift(item);
    hoje.info++;
    var salvos = guarda.ler('torre.inbox', []);
    salvos.unshift({ t: item.t.toISOString(), texto: texto, origem: item.origem, destino: destino });
    guarda.gravar('torre.inbox', salvos.slice(0, 30));
    evento({ tipo: 'info', andar: 1, para: destino, via: true, destaque: true, texto: 'Nova informação registrada: «' + texto + '»' });
    emitir('inbox');
    return { destino: destino, andar: andar(destino) };
  }

  /* ==========================================================================
     LEITURAS — o que a interface e o Jarvis consultam
     ======================================================================== */
  function delta(chave) {
    var d = agora(), ontem = totaisDoDia(addDias(d, -1))[chave] * fracDia(d);
    return ontem > 0 ? (hoje[chave] - ontem) / ontem : null;
  }
  function serie(chave) {
    var d = agora(), f = fracDia(d), out = [];
    for (var i = 11; i >= 1; i--) out.push(totaisDoDia(addDias(d, -i))[chave]);
    out.push(f > 0.04 ? hoje[chave] / f : totaisDoDia(d)[chave]);
    return out;
  }
  function tile(rotulo, valor, o) {
    o = o || {};
    var t = { rotulo: rotulo, valor: valor, nota: o.nota || null, serie: o.serie ? serie(o.serie) : null, delta: null };
    if (o.delta) {
      var v = delta(o.delta);
      if (v != null) t.delta = { v: v, bom: o.menorMelhor ? v <= 0 : v >= 0 };
    }
    if (o.deltaV != null) t.delta = { v: o.deltaV, bom: o.menorMelhor ? o.deltaV <= 0 : o.deltaV >= 0 };
    return t;
  }

  function financeiro() {
    var d = agora(), dm = diasNoMes(d);
    var gastoMes = E.orcamento.reduce(function (a, c) { return a + c.gasto; }, 0);
    var receitaMes = E.receitaAntes + hoje.receita;
    return {
      receitaMes: receitaMes, gastoMes: gastoMes, resultado: receitaMes - gastoMes,
      planejado: ORC_TOTAL, restante: Math.max(0, ORC_TOTAL - gastoMes), usado: gastoMes / ORC_TOTAL,
      ritmo: (d.getDate() - 1 + fracDia(d)) / dm, diasRestantes: dm - d.getDate(),
      receitaHoje: hoje.receita, gastoHoje: hoje.gastos,
      categorias: E.orcamento.map(function (c) { return { id: c.id, nome: c.nome, planejado: c.planejado, gasto: c.gasto, usado: c.gasto / c.planejado }; })
    };
  }
  function contas() {
    var d = agora(), hojeDia = d.getDate(), dm = diasNoMes(d);
    return T.CONFIG.contas.map(function (c) {
      var dia = Math.min(c.dia, dm), falta = dia - hojeDia;
      return { nome: c.nome, valor: c.valor, dia: dia, falta: falta, data: new Date(d.getFullYear(), d.getMonth(), dia), paga: falta < 0 };
    }).sort(function (a, b) { return a.dia - b.dia; });
  }
  function serie14() {
    var d = agora(), out = [];
    for (var i = 14; i >= 1; i--) { var x = addDias(d, -i), t = totaisDoDia(x); out.push({ d: inicioDoDia(x), receita: t.receita, gastos: t.gastos }); }
    return out;
  }
  function historico7() {
    var d = agora(), out = [];
    for (var i = 7; i >= 1; i--) { var x = addDias(d, -i), t = totaisDoDia(x); out.push({ d: inicioDoDia(x), leads: t.leads, vendas: t.vendas, receita: t.receita, videos: t.videos, posts: t.posts }); }
    return out;
  }
  function cpl() { return hoje.leadsMkt > 0 ? hoje.investMkt / hoje.leadsMkt : 0; }
  function resumoReunioes() {
    var lista = reunioes().filter(function (m) { return ehHoje(m.inicio); });
    return {
      total: lista.length,
      feitas: lista.filter(function (m) { return m.estado === 'concluida'; }).length,
      andamento: lista.filter(function (m) { return m.estado === 'andamento'; }).length,
      proxima: proximaReuniao()
    };
  }
  function topAgentes(qtd, n) {
    var todos = [];
    T.ANDARES.forEach(function (a) {
      if (n && a.n !== n) return;
      a.agentes.forEach(function (g) { todos.push({ andar: a, agente: g, tarefas: tarefasDe(g) }); });
    });
    todos.sort(function (x, y) { return y.tarefas - x.tarefas; });
    return todos.slice(0, qtd || 5);
  }

  function kpisGlobais() {
    return [
      { rotulo: 'Agentes ativos', valor: F.int(ativos), nota: 'de ' + F.int(T.TOTAIS.agentes) },
      { rotulo: 'Skills', valor: F.int(T.TOTAIS.skills), nota: 'em 8 andares' },
      { rotulo: 'Tarefas hoje', valor: F.compacto(hoje.tarefas) },
      { rotulo: 'Receita hoje', valor: F.brlc(hoje.receita) }
    ];
  }

  function kpis(n) {
    var fin, re, prox, ontem = totaisDoDia(addDias(agora(), -1));
    switch (n) {
      case 1:
        return [
          tile('Informações recebidas hoje', F.compacto(hoje.info), { delta: 'info', serie: 'info' }),
          tile('Triadas automaticamente', F.pct(Math.max(0, hoje.info - hoje.pendentes) / Math.max(1, hoje.info), 1), { nota: hoje.pendentes + ' na fila agora' }),
          tile('Tempo médio de triagem', '38 s', { nota: 'meta: até 60 s' }),
          tile('Currículos analisados', F.int(hoje.curriculos), { delta: 'curriculos' })
        ];
      case 2:
        return [
          tile('Leads hoje', F.int(hoje.leads), { delta: 'leads', serie: 'leads' }),
          tile('Propostas enviadas', F.int(hoje.propostas), { delta: 'propostas' }),
          tile('Sites vendidos', F.int(hoje.vendas), { delta: 'vendas', serie: 'vendas' }),
          tile('Receita de hoje', F.brlc(hoje.receita), { delta: 'receita' })
        ];
      case 3:
        var cplOntem = ontem.leadsMkt ? ontem.investMkt / ontem.leadsMkt : 0;
        return [
          tile('Pessoas alcançadas', F.compacto(hoje.alcance), { delta: 'alcance', serie: 'alcance' }),
          tile('Cliques nos anúncios', F.compacto(hoje.cliques), { delta: 'cliques' }),
          tile('Leads de campanhas', F.int(hoje.leadsMkt), { delta: 'leadsMkt', serie: 'leadsMkt' }),
          tile('Custo por lead', F.brl2(cpl()), { deltaV: cplOntem ? (cpl() - cplOntem) / cplOntem : null, menorMelhor: true })
        ];
      case 4:
        return [
          tile('Vídeos finalizados hoje', F.int(hoje.videos), { delta: 'videos', serie: 'videos' }),
          tile('Na fila agora', F.int(E.fila.length), { nota: E.fila.filter(function (v) { return v.prog >= 0.75; }).length + ' em render' }),
          tile('Tempo médio por vídeo', '5 min 50 s', { nota: 'do roteiro ao arquivo final' }),
          tile('Aprovados de primeira', '93%', { nota: 'sem refação' })
        ];
      case 5:
        return [
          tile('Posts publicados hoje', F.int(hoje.posts), { delta: 'posts', serie: 'posts' }),
          tile('Visualizações', F.compacto(hoje.views), { delta: 'views', serie: 'views' }),
          tile('Interações', F.compacto(hoje.interacoes), { delta: 'interacoes' }),
          tile('Engajamento', F.pct(hoje.views ? hoje.interacoes / hoje.views : 0, 1), { nota: 'interações ÷ visualizações' })
        ];
      case 6:
        fin = financeiro();
        return [
          tile('Receita do mês', F.brlc(fin.receitaMes), { nota: 'até agora' }),
          tile('Gasto do mês', F.brlc(fin.gastoMes), { nota: F.pct(fin.usado) + ' do planejado' }),
          tile('Resultado do mês', F.brlc(fin.resultado), { nota: 'receita menos gastos' }),
          tile('Ainda dá para gastar', F.brlc(fin.restante), { nota: 'de ' + F.brlc(fin.planejado) + ' planejados' })
        ];
      case 7:
        re = resumoReunioes(); prox = re.proxima;
        return [
          tile('Reuniões hoje', F.int(re.total), { nota: re.feitas + ' concluídas' }),
          tile('Em andamento agora', F.int(re.andamento), { nota: re.andamento ? 'sala ao vivo aberta' : 'salas livres' }),
          tile('Próxima em', prox ? F.duracao(Math.max(1, (prox.inicio - agora()) / 60000)) : '—', { nota: prox ? 'às ' + F.hora(prox.inicio) : 'nada agendado' }),
          tile('Atas geradas hoje', F.int(hoje.atas), { nota: 'enviadas ao Mega Brain' })
        ];
      default:
        return [
          tile('Mensagens roteadas hoje', F.compacto(hoje.msgs), { delta: 'msgs', serie: 'msgs' }),
          tile('Decisões automáticas', F.compacto(hoje.decisoes), { delta: 'decisoes' }),
          tile('Tempo de resposta', '0,4 s', { nota: 'da chegada à distribuição' }),
          tile('Andares sincronizados', '8 de 8', { nota: 'última sincronização há instantes' })
        ];
    }
  }

  /* ---------- resumo do dia (8º andar) ---------- */
  function resumo() {
    var d = agora(), fin = financeiro(), re = resumoReunioes(), top = topAgentes(1)[0];
    var melhorCamp = E.campanhas.slice().sort(function (a, b) { return (a.invest / Math.max(1, a.leads)) - (b.invest / Math.max(1, b.leads)); })[0];
    var topPlat = E.plataformas.slice().sort(function (a, b) { return b.views - a.views; })[0];
    var maior = E.vendas.slice().sort(function (a, b) { return b.valor - a.valor; })[0];
    var ticket = hoje.vendas ? hoje.receita / hoje.vendas : 0;
    var triadas = Math.max(0, hoje.info - hoje.pendentes) / Math.max(1, hoje.info);

    var linhas = [
      { n: 1, texto: F.int(hoje.info) + ' informações recebidas, ' + F.pct(triadas, 1) + ' triadas sem ajuda humana; ' + F.int(hoje.curriculos) + ' currículos analisados.' },
      { n: 2, texto: F.int(hoje.leads) + ' leads, ' + F.int(hoje.propostas) + ' propostas e ' + F.int(hoje.vendas) + ' sites vendidos — ' + F.brlc(hoje.receita) + (ticket ? ' (ticket médio de ' + F.brl(ticket) + ').' : '.') },
      { n: 3, texto: F.compacto(hoje.alcance) + ' pessoas alcançadas e ' + F.int(hoje.leadsMkt) + ' leads de campanhas, a ' + F.brl2(cpl()) + ' cada.' },
      { n: 4, texto: F.int(hoje.videos) + ' vídeos finalizados; ' + E.fila.length + ' na fila neste momento.' },
      { n: 5, texto: F.int(hoje.posts) + ' posts publicados e ' + F.compacto(hoje.views) + ' visualizações. Rede mais forte: ' + topPlat.nome + '.' },
      { n: 6, texto: 'Receita do mês em ' + F.brlc(fin.receitaMes) + '; gasto de ' + F.brlc(fin.gastoMes) + ', ' + F.pct(fin.usado) + ' dos ' + F.brlc(fin.planejado) + ' planejados.' },
      { n: 7, texto: re.feitas + ' reuniões concluídas, ' + re.andamento + ' em andamento' + (re.proxima ? ' e a próxima às ' + F.hora(re.proxima.inicio) : '') + '; ' + hoje.atas + ' atas geradas.' },
      { n: 8, texto: F.compacto(hoje.msgs) + ' mensagens roteadas entre os andares e ' + F.compacto(hoje.decisoes) + ' decisões tomadas sem intervenção humana.' }
    ];

    var destaques = [];
    if (top) destaques.push('Agente do dia: ' + top.agente.nome + ' (' + top.agente.cargo + ', ' + top.andar.nome + '), com ' + F.int(top.tarefas) + ' tarefas.');
    if (maior) destaques.push('Maior venda: ' + maior.cliente + ' — ' + maior.plano + ' por ' + F.brl(maior.valor) + '.');
    if (melhorCamp) destaques.push('Campanha mais eficiente: «' + melhorCamp.nome + '», a ' + F.brl2(melhorCamp.invest / Math.max(1, melhorCamp.leads)) + ' por lead.');

    var alertas = [], amanha = [];
    fin.categorias.forEach(function (c) {
      var folga = c.usado - fin.ritmo;
      if (c.usado >= 1) { alertas.push(c.nome + ' já estourou o planejado do mês (' + F.pct(c.usado) + ').'); amanha.push('Rever o limite de ' + c.nome.toLowerCase() + ' antes de aprovar novos gastos.'); }
      else if (folga > 0.05) { alertas.push(c.nome + ' está ' + Math.round(folga * 100) + ' pontos acima do ritmo do mês.'); amanha.push('Segurar os gastos de ' + c.nome.toLowerCase() + ' até voltar ao ritmo planejado.'); }
    });
    contas().forEach(function (c) { if (!c.paga && c.falta <= 2) alertas.push(c.nome + ' vence ' + (c.falta === 0 ? 'hoje' : c.falta === 1 ? 'amanhã' : 'em 2 dias') + ': ' + F.brl(c.valor) + '.'); });
    if (E.fila.length > 9) { alertas.push('A fila de vídeo está acima do normal (' + E.fila.length + ' vídeos).'); amanha.push('Deslocar agentes de Finalização para aliviar a fila de vídeo.'); }
    var conv = hoje.leads ? hoje.vendas / hoje.leads : 0;
    if (melhorCamp) amanha.push('Aumentar a verba de «' + melhorCamp.nome + '», a campanha com o lead mais barato.');
    amanha.push(conv < 0.05 ? 'A conversão de lead em venda está em ' + F.pct(conv, 1) + ': reforçar o follow-up das propostas abertas.' : 'Manter o ritmo de follow-up: a conversão está em ' + F.pct(conv, 1) + '.');
    if (topPlat) amanha.push('Priorizar publicações no ' + topPlat.nome + ', a rede com mais visualizações hoje.');

    var fala = 'Resumo do dia. Recebemos ' + F.int(hoje.info) + ' informações e geramos ' + F.int(hoje.leads) + ' leads. ' +
      'Vendas fechou ' + F.int(hoje.vendas) + ' sites, somando ' + F.brlc(hoje.receita) + '. ' +
      'Publicamos ' + F.int(hoje.posts) + ' posts, com ' + F.compacto(hoje.views) + ' visualizações. ' +
      'No mês, gastamos ' + F.brlc(fin.gastoMes) + ' de ' + F.brlc(fin.planejado) + ' planejados. ' +
      (alertas.length ? 'Atenção: ' + alertas[0] : 'Nenhum alerta por enquanto.');

    var titulo = 'Resumo do dia — ' + F.dataLonga(d);
    var texto = titulo + '\n' + E.empresa + ' · gerado pelo Mega Brain às ' + F.hora(d) + ' (dados simulados)\n\n' +
      linhas.map(function (l) { return nomeAndar(l.n) + ': ' + l.texto; }).join('\n') +
      '\n\nDestaques\n' + destaques.map(function (s) { return '• ' + s; }).join('\n') +
      '\n\nAlertas\n' + (alertas.length ? alertas.map(function (s) { return '• ' + s; }).join('\n') : '• Nenhum alerta: tudo dentro do planejado.') +
      '\n\nPara amanhã\n' + amanha.slice(0, 4).map(function (s) { return '• ' + s; }).join('\n');

    return { data: d, titulo: titulo, linhas: linhas, destaques: destaques, alertas: alertas, amanha: amanha.slice(0, 4), fala: fala, texto: texto };
  }

  /* ---------- retrato compacto da empresa (enviado ao Jarvis com IA) ---------- */
  function snapshot() {
    var d = agora(), fin = financeiro(), re = resumoReunioes(), rs = resumo();
    return {
      empresa: E.empresa, agora: F.dataLonga(d) + ', ' + F.hora(d), aviso: 'Todos os números são simulados (fictícios).',
      totais: { agentes: T.TOTAIS.agentes, agentesAtivos: ativos, skills: T.TOTAIS.skills, tarefasHoje: hoje.tarefas },
      andares: T.ANDARES.map(function (a) {
        return { andar: a.n, nome: a.titulo, missao: a.missao, agentes: a.agentes.length, skills: a.skills.length, squads: a.squads.map(function (s) { return s.nome; }) };
      }),
      entrada: { recebidasHoje: hoje.info, naFila: hoje.pendentes, curriculos: hoje.curriculos, ultimas: E.inbox.slice(0, 5).map(function (i) { return { texto: i.texto, origem: i.origem, destino: nomeAndar(i.destino) }; }) },
      vendas: {
        leads: hoje.leads, qualificados: hoje.qualificados, propostas: hoje.propostas, vendas: hoje.vendas, receitaHoje: Math.round(hoje.receita),
        ticketMedio: hoje.vendas ? Math.round(hoje.receita / hoje.vendas) : 0, conversao: hoje.leads ? +(hoje.vendas / hoje.leads * 100).toFixed(1) : 0,
        ultimas: E.vendas.slice(0, 5).map(function (v) { return { cliente: v.cliente, plano: v.plano, valor: v.valor, hora: F.hora(v.t) }; }),
        planos: T.CONFIG.planos.map(function (p) { return { nome: p.nome, preco: p.preco }; })
      },
      marketing: {
        alcance: hoje.alcance, cliques: hoje.cliques, leadsDeCampanhas: hoje.leadsMkt, investimentoHoje: Math.round(hoje.investMkt), custoPorLead: +cpl().toFixed(2),
        campanhas: E.campanhas.map(function (c) { return { nome: c.nome, canal: c.canal, leads: c.leads, custoPorLead: +(c.invest / Math.max(1, c.leads)).toFixed(2) }; })
      },
      video: { finalizadosHoje: hoje.videos, naFila: E.fila.length, fila: E.fila.slice(0, 5).map(function (v) { return { titulo: v.titulo, etapa: ETAPAS[Math.min(3, Math.floor(v.prog * 4))], progresso: Math.round(v.prog * 100) }; }) },
      publicacao: { postsHoje: hoje.posts, visualizacoes: hoje.views, interacoes: hoje.interacoes, redes: E.plataformas.map(function (p) { return { rede: p.nome, posts: p.posts, visualizacoes: p.views }; }) },
      financeiro: {
        receitaMes: Math.round(fin.receitaMes), gastoMes: Math.round(fin.gastoMes), resultadoMes: Math.round(fin.resultado), planejadoMes: fin.planejado,
        aindaPodeGastar: Math.round(fin.restante), percentualGasto: Math.round(fin.usado * 100), percentualDoMesDecorrido: Math.round(fin.ritmo * 100),
        categorias: fin.categorias.map(function (c) { return { nome: c.nome, planejado: c.planejado, gasto: Math.round(c.gasto) }; }),
        contasAVencer: contas().filter(function (c) { return !c.paga; }).slice(0, 4).map(function (c) { return { nome: c.nome, valor: c.valor, vencimento: F.dataCurta(c.data) }; })
      },
      reunioes: {
        hoje: re.total, concluidas: re.feitas, emAndamento: emAndamento().map(function (m) { return m.titulo; }),
        proximas: reunioes().filter(function (m) { return m.estado === 'agendada' && m.tipo !== 'auto'; }).slice(0, 6).map(function (m) { return { titulo: m.titulo, quando: F.dataMedia(m.inicio) + ' ' + F.hora(m.inicio), minutos: m.dur }; })
      },
      megaBrain: { mensagensRoteadas: hoje.msgs, decisoesAutomaticas: hoje.decisoes, destaques: rs.destaques, alertas: rs.alertas, recomendacoes: rs.amanha }
    };
  }

  /* ==========================================================================
     RELÓGIO DA SIMULAÇÃO
     ======================================================================== */
  var proximo = {}, timer = null, ultStatus = 0, ultReun = 0, ultTick = 0;

  function passo() {
    var t = Date.now(), disparos = 0, tipo;
    for (tipo in proximo) {
      if (disparos >= 2) break;
      if (t >= proximo[tipo]) {
        try { gerar[tipo](); } catch (e) { if (root.console) console.error('[sim] evento "' + tipo + '" falhou', e); }
        proximo[tipo] = t + expo(RITMO[tipo]) * 1000;
        disparos++;
      }
    }
    avancarFila(0.25);
    if (t - ultStatus > 3500) { girarStatus(); ultStatus = t; }
    if (t - ultReun > 5000) { checarReunioes(); ultReun = t; }
    if (t - ultTick > 1000) { emitir('tick'); ultTick = t; }
  }

  function iniciar() {
    if (timer) return;
    var t = Date.now(), tipo;
    for (tipo in gerar) proximo[tipo] = t + expo(RITMO[tipo]) * 500;
    /* os primeiros acontecimentos importantes chegam logo, para a torre não parecer parada */
    proximo.lead = t + rnd(7000, 16000);
    proximo.proposta = t + rnd(24000, 50000);
    proximo.venda = t + rnd(55000, 110000);
    proximo.difusao = t + rnd(9000, 15000);
    reunioes().forEach(function (m) { estadosVistos[m.id] = m.estado; });
    timer = setInterval(passo, 250);
  }
  function parar() { if (timer) { clearInterval(timer); timer = null; } }

  T.Sim = {
    on: on,
    preparar: preparar,
    iniciar: iniciar,
    parar: parar,
    get estado() { return E; },
    get hoje() { return hoje; },
    fracDia: fracDia,
    totaisDoDia: totaisDoDia,
    tarefasDe: tarefasDe,
    agentesAtivos: function () { return ativos; },
    kpisGlobais: kpisGlobais,
    kpis: kpis,
    financeiro: financeiro,
    contas: contas,
    serie14: serie14,
    historico7: historico7,
    cpl: cpl,
    funil: function () {
      return [{ nome: 'Leads', v: hoje.leads }, { nome: 'Qualificados', v: hoje.qualificados }, { nome: 'Propostas', v: hoje.propostas }, { nome: 'Vendas', v: hoje.vendas }];
    },
    etapaDe: function (v) { var e = Math.min(3, Math.floor(v.prog * 4)); return { nome: ETAPAS[e], indice: e, progresso: Math.min(1, v.prog * 4 - e) }; },
    reunioes: reunioes,
    resumoReunioes: resumoReunioes,
    proximaReuniao: proximaReuniao,
    emAndamento: emAndamento,
    salaAoVivo: salaAoVivo,
    marcarReuniao: marcarReuniao,
    removerReuniao: removerReuniao,
    registrarInfo: registrarInfo,
    classificar: classificar,
    topAgentes: topAgentes,
    resumo: resumo,
    snapshot: snapshot,
    nomeEmpresa: function () { return E.empresa; },
    definirNomeEmpresa: function (nome) {
      nome = String(nome || '').trim().slice(0, 28);
      if (!nome) return E.empresa;
      E.empresa = nome; guarda.gravar('torre.empresa', nome); emitir('empresa', nome);
      return nome;
    },
    guarda: guarda
  };
})(typeof window !== 'undefined' ? window : globalThis);
