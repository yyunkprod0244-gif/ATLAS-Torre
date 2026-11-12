/* ============================================================================
   TORRE — JARVIS, o assistente da empresa
   ----------------------------------------------------------------------------
   Funciona de dois jeitos:
   1. MODO LOCAL (sempre disponível): entende perguntas e comandos comuns em
      português e responde com os números da torre. Não usa internet.
   2. MODO IA (opcional): se o site estiver rodando pelo server.mjs com uma
      credencial da Anthropic, as perguntas livres vão para o Claude, que
      recebe um retrato da empresa e pode executar ações na torre.
   A voz usa os recursos do próprio navegador (fala e microfone).
   ========================================================================== */
(function (root) {
  'use strict';
  var T = root.Torre, F = T.fmt, S = null, cb = {};
  var $ = function (id) { return document.getElementById(id); };
  var estado = 'parado', vozLigada = true, ia = { ativa: false, modelo: '' }, historico = [];

  /* ==========================================================================
     ENTENDER O QUE FOI DITO (modo local)
     ======================================================================== */
  function limpar(t) { return T.normalizar(t).replace(/[?!.,;:"«»]/g, ' ').replace(/\s+/g, ' ').trim(); }
  var ORDINAIS = ['primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto', 'setimo', 'oitavo', 'nono', 'decimo'];

  function qualAndar(t) {
    var m = t.match(/(\d+)\s*(?:o|º|°)?\s*andar/) || t.match(/(?:andar|piso)\s*(?:numero\s*)?(\d+)/), total = T.ANDARES.length;
    if (m && +m[1] >= 1 && +m[1] <= total) return +m[1];
    for (var i = 0; i < total && i < ORDINAIS.length; i++) if (t.indexOf(ORDINAIS[i] + ' andar') >= 0) return i + 1;
    var melhor = 0, tam = 0;
    T.ANDARES.forEach(function (a) {
      a.chaves.forEach(function (c) { if (c.length > tam && new RegExp('(^|\\s)' + c + '(\\s|$)').test(t)) { melhor = a.n; tam = c.length; } });
    });
    return melhor;
  }

  var DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  function quando(t) {
    var agora = new Date(), d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()), m, h = null, min = 0;
    if (/depois de amanha/.test(t)) d.setDate(d.getDate() + 2);
    else if (/amanha/.test(t)) d.setDate(d.getDate() + 1);
    else if ((m = t.match(/dia (\d{1,2})(?:\s*(?:\/|do|de)\s*(\d{1,2}))?/)) || (m = t.match(/(\d{1,2})\/(\d{1,2})/))) {
      if (m[2]) d.setMonth(+m[2] - 1, +m[1]); else { d.setDate(+m[1]); if (d < new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())) d.setMonth(d.getMonth() + 1); }
    } else {
      for (var i = 0; i < 7; i++) if (new RegExp('\\b' + DIAS[i]).test(t)) { var dif = (i - agora.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + dif); break; }
    }
    if (/meio dia/.test(t)) h = 12;
    else if ((m = t.match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/)) || (m = t.match(/as (\d{1,2})(?:\s*e\s*(\d{2}|meia))?/))) {
      h = +m[1]; min = m[2] === 'meia' ? 30 : +(m[2] || 0);
      if (h < 12 && /(da tarde|da noite)/.test(t)) h += 12;
    }
    if (h == null || h > 23) { h = agora.getHours() + 1; min = 0; if (d.getDate() !== agora.getDate()) h = 10; }
    d.setHours(h, min, 0, 0);
    m = t.match(/(\d{1,3})\s*min/); var dur = m ? +m[1] : /(uma|1) hora/.test(t) ? 60 : /meia hora/.test(t) ? 30 : 30;
    return { inicio: d, dur: dur };
  }

  function tituloDe(original, t) {
    var i = t.search(/\b(sobre|para falar de|para tratar de|com o cliente|com a cliente)\b/), titulo = '';
    if (i >= 0) titulo = original.slice(i).replace(/^(sobre|para falar de|para tratar de)\s+/i, '');
    titulo = titulo.replace(/\s+(hoje|amanh[ãa]|depois de amanh[ãa]|[àa]s \d.*|dia \d.*|na (segunda|ter[çc]a|quarta|quinta|sexta)|no (s[áa]bado|domingo)|\d{1,2}\s*h\b.*|por \d+ min.*)$/i, '').replace(/[.?!]+$/, '').trim();
    return titulo ? titulo.charAt(0).toUpperCase() + titulo.slice(1) : 'Reunião marcada pelo Jarvis';
  }
  function andaresCitados(t) {
    var out = [];
    T.ANDARES.forEach(function (a) { if (a.chaves.some(function (c) { return new RegExp('(^|\\s)' + c + '(\\s|$)').test(t); })) out.push(a.n); });
    return out;
  }

  /* "entre na sala de prospecção", "mostre o squad de SEO": devolve { andar, k } ou null.
     Um nome de sala exato ganha; se o que sobrar for o nome de um andar ("sala de reuniões"),
     é o andar que a pessoa quer, e quem responde é a regra dos andares. */
  var SOBRAS_SALA = /\b(sala|salas|squad|squads|time|equipe|grupo|entre|entrar|entra|abra|abrir|abre|mostre|mostrar|mostra|ir|va|vai|vamos|para|pra|ver|quero|me|leve|leva|na|no|nas|nos|da|do|das|dos|de|a|o|as|os|dentro|interior|zoom|andar|piso|\d+)\b/g;
  function qualSala(t) {
    if (!/\b(sala|squad|time|equipe|grupo)\b/.test(t)) return null;
    var termo = t.replace(SOBRAS_SALA, ' ').replace(/\s+/g, ' ').trim(), exata = null, n = qualAndar(t), semAndar = termo;
    if (!termo) return null;
    if (n) T.andar(n).chaves.forEach(function (c) { semAndar = (' ' + semAndar + ' ').replace(' ' + c + ' ', ' ').trim(); });
    [semAndar, termo].forEach(function (alvo) {
      if (exata || !alvo) return;
      T.ANDARES.forEach(function (a) { a.squads.forEach(function (s, k) { if (!exata && T.normalizar(s.nome) === alvo) exata = { andar: a, k: k }; }); });
    });
    if (exata) return exata;
    if (T.ANDARES.some(function (a) { return a.chaves.indexOf(termo) >= 0; })) return null;
    return (n && semAndar && T.buscarSala(semAndar, n)) || T.buscarSala(termo, 0);
  }
  /* "meu salário é de 2.500", "salário de 3 mil": devolve o valor citado, ou null */
  function valorCitado(original) {
    var m = String(original).match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?\s*(mil\b)?/i);
    if (!m) return null;
    var v = +m[1].replace(/\./g, '') * (m[2] ? 1000 : 1);
    return v >= 100 ? v : null;
  }

  /* ==========================================================================
     RESPOSTAS DO MODO LOCAL
     Cada resposta: { texto, acao? }  (acao é executada antes de falar)
     ======================================================================== */
  function sobreAndar(n) {
    var a = T.andar(n), k = S.kpis(n);
    return 'O ' + n + 'º andar é ' + a.titulo + '. ' + a.missao + ' São ' + F.int(a.agentes.length) + ' agentes e ' + F.int(a.skills.length) + ' skills. Agora: ' +
      k.slice(0, 3).map(function (x) { return x.rotulo.toLowerCase() + ', ' + x.valor; }).join('; ') + '.';
  }
  function saudacaoHora() { var h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }

  function interpretar(original) {
    var t = limpar(original), h = S.hoje, n = qualAndar(t), fin, re, m, lista;

    /* só a ordem sozinha: "para que serve…" é pergunta, não pedido para parar */
    if (/^(ok |jarvis )?(pare|para|parar|silencio|chega|cala a boca|cala|quieto|fica quieto)( de falar| jarvis| ai| por favor)?$/.test(t)) return { texto: '', parar: true, local: true };
    if (/(desativ|deslig|sem) (a )?voz|fique mudo|modo mudo/.test(t)) return { texto: 'Voz desligada. Continuo respondendo por texto.', voz: false, local: true };
    if (/(ativ|lig)\w* (a )?voz|pode falar|fale comigo/.test(t)) return { texto: 'Voz ligada.', voz: true, local: true };

    /* ---------- calculadora: "quanto é 1490 vezes 3", "20% de 3000", "1490 - 10%" ---------- */
    if (T.Calc) {
      var pc = original.match(/^\s*(?:jarvis[,\s]+)?(?:quanto (?:é|e|da|dá|fica|sao|são)|calcul[ae]|faz(?: a)? conta(?: de)?|conta)\s*:?\s+(.+?)\s*\??\s*$/i);
      var expr = pc ? pc[1] : original;
      if (T.Calc.pareceConta(expr)) {
        var rc = T.Calc.avaliar(expr);
        if (!rc.erro) return { texto: 'Dá ' + rc.texto + '.', local: true };
      }
    }

    /* ---------- lembretes ---------- */
    if (T.Lembretes) {
      if (/(quais|quantos|meus|mostr\w*|list\w*|ver|abr\w*)\b.*\blembretes\b|^lembretes\b/.test(t)) return { texto: null, comando: true, verLembretes: true, local: true };
      var ml = original.match(/^\s*(?:jarvis[,\s]+)?(?:me lembr[ae]|lembre-me|me avis[ae]|avise-me|cri[ae] um lembrete|novo lembrete|lembrete)\s*(?:de|que|para|pra|:)?\s+(.+)$/i);
      if (ml) return { texto: null, comando: true, lembrete: ml[1], local: true };
    }

    /* cancelar vem antes de marcar: "desmarque" também contém "marque" */
    if (/(cancel|desmar[cq]|remov|apag|exclu)\w*\s+(a\s+|essa\s+|aquela\s+|minha\s+|uma\s+)?(ultima\s+)?(reuni|call|encontro)/.test(t)) return { texto: null, comando: true, cancelar: t };
    if (/(marc|marq|agend)\w*\s+(uma\s+|um\s+|a\s+)?(reuni|call|encontro|conversa)/.test(t)) {
      var q = quando(t), ands = andaresCitados(t).filter(function (x) { return x !== 7; });
      return { texto: null, comando: true, reuniao: { titulo: tituloDe(original, t), inicio: q.inicio, dur: q.dur, andares: ands, origem: 'jarvis' } };
    }
    if ((m = t.match(/^(anota|anote|anotar|registra|registre|registrar|nova informacao|avisa|avise)\b\s*(ai|isso|que|a torre)?\s*/)) && t.length > m[0].length + 3)
      return { texto: null, comando: true, info: original.slice(m[0].length).replace(/^[:\s]+/, '') };
    if ((m = t.match(/(?:mude|troque|altere|defina)\s+o nome da empresa para\s+(.+)/))) return { texto: null, comando: true, nome: original.slice(original.length - m[1].length) };

    /* ---------- skills externas (projetos do GitHub catalogados na torre) ---------- */
    if (T.SKILLS_EXTERNAS) {
      var ext = T.buscarSkillExterna(t);
      if (ext || /(skills? externas?|ferramentas? externas?|do github|no github|skills? (que )?(voce )?(adicionou|instalou|catalogou))/.test(t)) return { texto: null, comando: true, externa: ext ? ext.id : '' };
    }

    /* ---------- produtos, guias, livros e salas (vêm antes dos andares: "livro" e "sala" também são nomes de andar) ---------- */
    if (/\b(produtos?|catalogo|planos|precos?|quanto custa)\b/.test(t) && !/(reuni|estudo)/.test(t)) return { texto: null, comando: true, produtos: true };
    if (/\bsalario\b/.test(t)) return { texto: null, comando: true, salario: valorCitado(original) };
    /* plano de 90 dias com dinheiro de verdade */
    if (/(plano de (90|noventa) dias|90 dias|\bmil (reais )?(de entrada|para (comecar|investir|a empresa|tudo))|\d\.?000 (reais )?(de entrada|para (comecar|investir|a empresa|tudo))|dinheiro de entrada|de entrada (para|pra) (a empresa|tudo|comecar)|capital (inicial|de giro)|investimento inicial|(para|pra) (dar|isso dar) certo|o que (eu )?(faco|fazer|devo fazer) hoje|(comecar|investir|abrir a empresa) com .*\b(mil|reais)\b)/.test(t)) {
      var cap = /(entrada|investir|capital|investimento|tenho|comecar com)/.test(t) ? valorCitado(original) : null;
      return { texto: null, comando: true, plano: cap };
    }
    if (/(lanc\w*|coloc\w*|abr\w*|tirar do papel).{0,30}\b(empresa|negocio)\b|\b(empresa|negocio)\b.{0,30}(no ar|lanc\w*)|o que falta|checklist/.test(t)) return { texto: null, comando: true, lancamento: true };
    if (/\b(livros?|guias?|ler|leia|leitura|estudar|estude|aulas?)\b/.test(t)) {
      var achado = T.buscarLivro && T.buscarLivro(t.replace(/\b(abra|abrir|abre|mostre|mostrar|mostra|quero|ler|leia|o|a|os|as|um|uma|livro|livros|guia|guias|sobre|de|do|da|me|estudar|estude|aula|aulas|para|leitura)\b/g, ' '));
      if (achado) return { texto: null, comando: true, livro: achado.id };
      if (/\b(quais|quantos|lista|listar|que livros|tem)\b/.test(t)) return { texto: null, comando: true, acervo: true };
    }
    var salaPedida = qualSala(t);
    if (salaPedida) return { texto: null, comando: true, sala: { n: salaPedida.andar.n, k: salaPedida.k } };

    var querIr = /\b(ir|vai|va|vamos|leve|leva|levar|mostre|mostra|mostrar|abra|abre|abrir|entre|entra|entrar|suba|sobe|desca|desce|visite|visitar|quero ver|me mostra|ver o|ver a)\b/.test(t);
    if (/(visao geral|torre inteira|voltar|volte|sair do andar|saia do andar|afastar|ver a torre|ver tudo)/.test(t)) return { texto: 'Voltando para a visão geral da torre.', comando: true, ir: 0 };
    if (querIr && n) return { texto: 'Abrindo ' + T.andar(n).titulo + '. ' + sobreAndar(n).split('. ').slice(2).join('. '), comando: true, ir: n };

    if (/(resumo|resuma|relatorio do dia|como foi o dia|o que aconteceu hoje|balanco do dia)/.test(t)) return { texto: S.resumo().fala, resumo: true };

    if (/(conta|boleto|fatura)s? (a pagar|a vencer|do mes|vencendo)|o que vence|proximos? vencimentos?/.test(t)) {
      lista = S.contas().filter(function (c) { return !c.paga; }).slice(0, 3);
      return { texto: lista.length ? 'Próximas contas: ' + lista.map(function (c) { return c.nome + ', ' + F.brlc(c.valor) + ', dia ' + c.dia; }).join('; ') + '.' : 'Todas as contas deste mês já foram pagas.' };
    }
    if (/(gast|despesa|custo|orcamento|quanto (posso|da pra|da para|falta|tenho|temos|tem que|preciso)|limite)/.test(t)) {
      fin = S.financeiro();
      var pior = fin.categorias.slice().sort(function (a, b) { return b.usado - a.usado; })[0];
      return { texto: 'Neste mês gastamos ' + F.brlc(fin.gastoMes) + ' dos ' + F.brlc(fin.planejado) + ' planejados, ou ' + F.pct(fin.usado) + '. Ainda dá para gastar ' + F.brlc(fin.restante) + (fin.diasRestantes > 0 ? ', cerca de ' + F.brlc(fin.restante / fin.diasRestantes) + ' por dia até o fim do mês' : '') + '. A categoria mais usada é ' + pior.nome.toLowerCase() + ', com ' + F.pct(pior.usado) + ' do limite.' };
    }
    if (/(receita|faturamento|faturamos|lucro|resultado|dinheiro|caixa|financeiro|financas)/.test(t)) {
      fin = S.financeiro();
      return { texto: 'Receita de hoje: ' + F.brlc(h.receita) + '. No mês: ' + F.brlc(fin.receitaMes) + ' de receita e ' + F.brlc(fin.gastoMes) + ' de gastos, um resultado de ' + F.brlc(fin.resultado) + '.' };
    }
    if (/(melhor|top|destaque).*(agente|vendedor|funcionario)|agente do dia|quem mais (trabalhou|produziu)/.test(t)) {
      var top = S.topAgentes(3, n || 0);
      return { texto: 'Os agentes com mais tarefas hoje' + (n ? ' em ' + T.andar(n).nome : '') + ': ' + top.map(function (x) { return x.agente.nome + ', ' + x.agente.cargo + (n ? '' : ' de ' + x.andar.nome) + ', com ' + F.int(x.tarefas); }).join('; ') + '.' };
    }
    if ((m = t.match(/(?:skills?|habilidades?) (?:de|sobre|com|para) (.+)/)) || (m = t.match(/(?:tem|existe|ha) (?:alguma )?(?:skill|habilidade) (?:de |para |sobre )?(.+)/))) {
      var termo = m[1].replace(/\b(no|na|do|da|em) (andar|rh|vendas|marketing|video|financeiro).*$/, '').trim(), total = T.contarSkills(termo, 0), ex = T.buscarSkills(termo, 0, 3);
      return { texto: total ? 'Encontrei ' + F.int(total) + ' skills com “' + termo + '”. Por exemplo: ' + ex.map(function (x) { return x.skill.nome + ', em ' + x.andar.nome; }).join('; ') + '.' : 'Não encontrei nenhuma skill com “' + termo + '”.' };
    }
    if ((m = t.match(/(?:procure|procura|busque|busca|encontre|ache|quem e) (?:o |a )?(?:agente )?(.+)/)) && m[1].length > 2 && !/voce/.test(m[1])) {
      lista = T.buscarAgentes(m[1], 0, 3);
      if (lista.length) return { texto: 'Encontrei ' + lista.map(function (x) { return x.agente.nome + ', ' + x.agente.cargo + ' no squad ' + x.andar.squads[x.agente.squad].nome + ' de ' + x.andar.nome; }).join('; ') + '. Abri a ficha do primeiro.', comando: true, agente: { n: lista[0].andar.n, i: lista[0].agente.i } };
    }
    if (/quant\w+ (agentes|skills|habilidades|andares)|numero de (agentes|skills)/.test(t)) {
      if (n) return { texto: T.andar(n).titulo + ' tem ' + F.int(T.andar(n).agentes.length) + ' agentes e ' + F.int(T.andar(n).skills.length) + ' skills, em ' + T.andar(n).squads.length + ' squads.' };
      return { texto: 'A torre tem ' + T.ANDARES.length + ' andares, ' + T.TOTAIS.salas + ' salas, ' + F.int(T.TOTAIS.agentes) + ' agentes e ' + F.int(T.TOTAIS.skills) + ' skills. Agora, ' + F.int(S.agentesAtivos()) + ' agentes estão ativos.' };
    }
    if (/(venda|vendeu|vendemos|vendid|lead|proposta|conversao|ticket|fechamos|fechou)/.test(t)) {
      var ult = S.estado.vendas[0];
      return { texto: 'Hoje temos ' + F.int(h.leads) + ' leads, ' + F.int(h.propostas) + ' propostas e ' + F.int(h.vendas) + ' sites vendidos, somando ' + F.brlc(h.receita) + '. A conversão de lead em venda está em ' + F.pct(h.leads ? h.vendas / h.leads : 0, 1) + '.' + (ult ? ' A última venda foi para ' + ult.cliente + ': ' + ult.plano + ' por ' + F.brl(ult.valor) + '.' : '') };
    }
    if (/(campanha|anuncio|alcance|trafego|custo por lead|cpl|marketing)/.test(t)) {
      var c = S.estado.campanhas.slice().sort(function (a, b) { return b.leads - a.leads; })[0];
      return { texto: 'O marketing alcançou ' + F.compacto(h.alcance) + ' pessoas hoje e gerou ' + F.int(h.leadsMkt) + ' leads, a ' + F.brl2(S.cpl()) + ' cada. A campanha que mais traz lead é “' + c.nome + '”, com ' + F.int(c.leads) + '.' };
    }
    if (/(video|edicao|render|fila)/.test(t)) {
      var v = S.estado.fila[0];
      return { texto: 'A edição finalizou ' + F.int(h.videos) + ' vídeos hoje e tem ' + S.estado.fila.length + ' na fila.' + (v ? ' O mais adiantado é “' + v.titulo + '”, na etapa de ' + S.etapaDe(v).nome.toLowerCase() + '.' : '') };
    }
    if (/(post|public|youtube|instagram|tiktok|facebook|linkedin|visualiza|views|engajamento|redes)/.test(t)) {
      var rede = S.estado.plataformas.filter(function (p) { return t.indexOf(p.id) >= 0; })[0];
      if (rede) return { texto: 'No ' + rede.nome + ' foram ' + F.int(rede.posts) + ' posts hoje, com ' + F.compacto(rede.views) + ' visualizações.' };
      var topo = S.estado.plataformas.slice().sort(function (a, b) { return b.views - a.views; })[0];
      return { texto: 'Publicamos ' + F.int(h.posts) + ' posts hoje, com ' + F.compacto(h.views) + ' visualizações e ' + F.pct(h.views ? h.interacoes / h.views : 0, 1) + ' de engajamento. A rede mais forte é o ' + topo.nome + '.' };
    }
    if (/(reuni|agenda|encontro|call)/.test(t)) {
      re = S.resumoReunioes(); var agora = S.emAndamento();
      lista = S.reunioes().filter(function (x) { return x.estado === 'agendada' && x.tipo !== 'auto'; }).slice(0, 3);
      return { texto: 'Hoje são ' + re.total + ' reuniões, ' + re.feitas + ' já concluídas. ' + (agora.length ? 'Agora está acontecendo: ' + agora[0].titulo + '. ' : 'Nenhuma acontecendo neste momento. ') + (lista.length ? 'Próximas: ' + lista.map(function (x) { return x.titulo + ', ' + (F.chaveDia(x.inicio) === F.chaveDia(new Date()) ? '' : 'amanhã ') + 'às ' + F.hora(x.inicio); }).join('; ') + '.' : '') };
    }
    if (/(informac|caixa de entrada|chegou|recebemos|curriculo|triagem)/.test(t)) {
      var it = S.estado.inbox[0];
      return { texto: 'Chegaram ' + F.int(h.info) + ' informações hoje e ' + h.pendentes + ' estão na fila de triagem. ' + (it ? 'A última foi: ' + it.texto + ', entregue a ' + T.andar(it.destino).nome + '.' : '') };
    }
    if (/(mega brain|cerebro|roteada|decis)/.test(t)) return { texto: 'O Mega Brain roteou ' + F.compacto(h.msgs) + ' mensagens entre os andares hoje e tomou ' + F.compacto(h.decisoes) + ' decisões sem intervenção humana. Os ' + T.ANDARES.length + ' andares estão sincronizados.' };
    if (n) return { texto: sobreAndar(n) };
    if (/(como (esta|vai|anda) a empresa|status|tudo (certo|bem|ok)|situacao|panorama|sobre a empresa|fale da empresa|me atualiza)/.test(t)) {
      fin = S.financeiro(); var al = S.resumo().alertas;
      return { texto: S.nomeEmpresa() + ' está operando com ' + F.int(S.agentesAtivos()) + ' agentes ativos. Hoje: ' + F.int(h.vendas) + ' sites vendidos, ' + F.brlc(h.receita) + ' de receita e ' + F.int(h.posts) + ' posts publicados. No mês, o resultado está em ' + F.brlc(fin.resultado) + '. ' + (al.length ? 'Um ponto de atenção: ' + al[0] : 'Nenhum alerta no momento.') };
    }
    if (/(que horas|horario agora|que dia e hoje|data de hoje)/.test(t)) return { texto: 'Agora são ' + F.hora(new Date()) + ' de ' + F.dataLonga(new Date()) + '.' };
    if (/(quem e voce|seu nome|o que voce e|voce e uma ia)/.test(t)) return { texto: 'Sou o Jarvis, o assistente da ' + S.nomeEmpresa() + '. Acompanho os ' + T.ANDARES.length + ' andares da torre e respondo sobre vendas, marketing, vídeos, publicações, financeiro, reuniões e estudo. Os números da operação que mostro hoje são simulados; o seu progresso de estudo é real.' };
    if (/(ajuda|o que voce (faz|sabe|pode)|comandos|como (te )?uso)/.test(t)) return { texto: 'Posso: levar você a um andar (“abra o financeiro”), contar como estão vendas, marketing, vídeos, redes e gastos, ler o resumo do dia, marcar e cancelar reuniões (“marque uma reunião amanhã às 15h sobre a proposta”), registrar informações (“anota: cliente quer loja virtual”) e procurar agentes ou skills. Também entro em uma sala (“entre na sala de prospecção”), mostro os produtos, abro livros da biblioteca (“abra o livro de objeções”), divido o seu salário (“meu salário é de 2.000”), digo o que falta para lançar a empresa, explico as skills externas (“o que é o Ponytail?”), faço contas (“quanto é 1490 vezes 3”) e crio lembretes (“me lembre de ligar para a Ana amanhã às 10h”).' };
    if (/^(oi|ola|e ai|eai|hey|bom dia|boa tarde|boa noite|fala)\b/.test(t)) return { texto: saudacaoHora() + '. ' + S.nomeEmpresa() + ' vendeu ' + F.int(h.vendas) + ' sites hoje, somando ' + F.brlc(h.receita) + '. Sobre o que quer saber?' };
    if (/(obrigad|valeu|show|perfeito|otimo)/.test(t)) return { texto: 'Às ordens.' };
    return { texto: null, desconhecido: true };
  }

  /* ==========================================================================
     AÇÕES NA TORRE
     ======================================================================== */
  function marcar(r) {
    var m = S.marcarReuniao(r);
    if (m.erro) return m.erro;
    if (cb.irPara) cb.irPara(7);
    return 'Reunião marcada: “' + m.reuniao.titulo + '”, ' + F.dataLonga(m.reuniao.inicio) + ' às ' + F.hora(m.reuniao.inicio) + ', com ' + m.reuniao.dur + ' minutos. Já está na agenda do 7º andar.';
  }
  /* Cancela uma reunião marcada por você: a única que existe, a que tem o assunto citado, ou a última marcada. */
  var SEM_PESO = { reuniao: 1, marcada: 1, pelo: 1, jarvis: 1, para: 1, sobre: 1, cliente: 1 };
  function cancelar(t) {
    var agora = new Date(), minhas = S.estado.reunioesUsuario.filter(function (m) { return m.fim > agora; });
    if (!minhas.length) return 'Você não tem nenhuma reunião marcada para cancelar. As reuniões automáticas da torre seguem na agenda.';
    var alvo = null, melhor = 0, empate = false, frase = ' ' + t + ' ';
    minhas.forEach(function (m) {
      var p = limpar(m.titulo).split(' ').filter(function (w) { return w.length > 3 && !SEM_PESO[w] && frase.indexOf(' ' + w + ' ') >= 0; }).length;
      if (p > melhor) { melhor = p; alvo = m; empate = false; } else if (p && p === melhor) empate = true;
    });
    if (!melhor || empate) alvo = minhas.length === 1 || /ultima/.test(t) ? minhas[minhas.length - 1] : null;
    if (!alvo) return 'Você tem ' + minhas.length + ' reuniões marcadas: ' + minhas.map(function (m) { return m.titulo + ', ' + F.dataMedia(m.inicio) + ' às ' + F.hora(m.inicio); }).join('; ') + '. Diga o assunto da que quer cancelar.';
    S.removerReuniao(alvo.id);
    if (cb.irPara) cb.irPara(7);
    return 'Reunião cancelada: “' + alvo.titulo + '”, que estava marcada para ' + F.dataLonga(alvo.inicio) + ' às ' + F.hora(alvo.inicio) + '.';
  }
  function registrar(texto) {
    var r = S.registrarInfo(texto, 'Jarvis');
    return r.erro ? r.erro : 'Anotado. O Mega Brain entregou a informação a ' + r.andar.nome + '.';
  }

  /* ---------- lembretes ---------- */
  function quandoFalado(d) {
    var hoje = new Date(), k = F.chaveDia(d), amanha = F.chaveDia(new Date(hoje.getTime() + 86400000));
    return (k === F.chaveDia(hoje) ? 'hoje' : k === amanha ? 'amanhã' : F.dataLonga(d)) + ' às ' + F.hora(d);
  }
  var FIM_DE_FRASE_TEMPO = /\s+(?:hoje|amanh[ãa]|depois de amanh[ãa]|[àa]s?\s+\d.*|ao meio[- ]dia.*|dia\s+\d.*|na\s+(?:segunda|ter[çc]a|quarta|quinta|sexta)(?:-feira)?.*|no\s+(?:s[áa]bado|domingo).*|(?:de|pela|à)\s+(?:manh[ãa]|tarde|noite).*)$/i;
  function criarLembrete(frase) {
    var t = limpar(frase), d, m, explicitoDia = /(hoje|amanha|dia \d|segunda|terca|quarta|quinta|sexta|sabado|domingo|\d{1,2}\/\d{1,2})/.test(t);
    if ((m = t.match(/(?:daqui a|em|dentro de)\s+(\d+|um|uma|meia)\s*(minutos?|min|horas?|h)\b/))) {
      var n = m[1] === 'meia' ? 0.5 : /^(um|uma)$/.test(m[1]) ? 1 : +m[1];
      d = new Date(Date.now() + n * (/^h/.test(m[2]) ? 3600000 : 60000));
    } else {
      d = quando(t).inicio;
      if (d < new Date() && !explicitoDia) d.setDate(d.getDate() + 1);   /* "às 9h" quando já passou das 9: é amanhã */
    }
    var texto = frase.replace(/\s*,?\s*(?:daqui a|em|dentro de)\s+(\d+|um|uma|meia)\s*(minutos?|min|horas?|h)\b/i, ' ');
    for (var i = 0; i < 3; i++) texto = texto.replace(FIM_DE_FRASE_TEMPO, '');
    texto = texto.replace(/^\s*(?:hoje|amanh[ãa])\s*,?\s*/i, '').replace(/[.!?,\s]+$/, '').trim() || 'Lembrete';
    var r = T.Lembretes.criar(texto, d);
    return r.erro ? r.erro : 'Combinado: vou lembrar você de “' + r.lembrete.texto + '” ' + quandoFalado(d) + '. O aviso aparece enquanto a torre, o dashboard ou esta página estiverem abertos.';
  }
  function listarLembretes() {
    var p = T.Lembretes.pendentes();
    if (cb.abrirLembretes) cb.abrirLembretes();
    if (!p.length) return 'Você não tem lembretes pendentes. Diga, por exemplo: me lembre de ligar para a Ana amanhã às 10h.';
    return 'Você tem ' + p.length + (p.length === 1 ? ' lembrete' : ' lembretes') + ': ' + p.slice(0, 5).map(function (l) { return l.texto + ', ' + quandoFalado(new Date(l.quando)); }).join('; ') + (p.length > 5 ? '; e mais ' + (p.length - 5) + '.' : '.');
  }

  /* ---------- produtos, salas e estudo ---------- */
  function mostrarProdutos() {
    var prods = (T.CATALOGO && T.CATALOGO.produtos) || [];
    if (cb.abrirProdutos) cb.abrirProdutos();
    if (!prods.length) return 'Não encontrei o catálogo de produtos.';
    return 'São ' + prods.length + ' produtos: ' + prods.map(function (p) { return p.nome + ', ' + F.brl(p.preco) + (p.mensal ? ' por mês' : ''); }).join('; ') + '. Abri a lista completa na tela.';
  }
  function entrarNaSala(n, k) {
    var a = T.andar(n), q = a && a.squads[k];
    if (!q) return 'Não encontrei essa sala.';
    if (cb.irParaSala) cb.irParaSala(n, k);
    return 'Entrando na sala ' + q.nome + ', no ' + n + 'º andar. São ' + F.int(q.qtd) + ' agentes, cada um com mesa, computador e cadeira.';
  }
  function abrirLivro(id) {
    var b = T.livro && T.livro(id);
    if (!b) return 'Não encontrei esse livro na biblioteca.';
    if (cb.abrirLivro) cb.abrirLivro(id);
    return 'Abri o livro “' + b.titulo + '”. ' + b.resumo;
  }
  function guiaSalario(valor) {
    if (valor) S.definirSalario(valor, S.estado.estudo.salario.essenciais);
    var p = S.planoSalario();
    if (cb.abrirLivro) cb.abrirLivro('salario');
    return 'Para um salário de ' + F.brl(p.valor) + ': ' + p.linhas.map(function (l) { return l.nome.toLowerCase() + ', ' + F.brl(l.valor); }).join('; ') + '. A reserva sai primeiro, no dia do pagamento. Abri o passo a passo completo.';
  }
  function guiaPlano(capital) {
    if (capital) S.definirCapital(capital);
    var pl = S.planoLancamento(), P = T.PLANO, fz = pl.fase >= 0 ? P.fases[pl.fase] : P.fases[0], d = pl.divisao;
    if (cb.abrirLivro) cb.abrirLivro('plano-3mil');
    return 'Com ' + F.brl(pl.capital) + ': ' + d.linhas.filter(function (l) { return l.valor; }).map(function (l) { return l.nome.toLowerCase() + ', ' + F.brl(l.valor); }).join('; ') + '. ' +
      (pl.dia && !pl.terminou ? 'Você está no dia ' + pl.dia + ' de 90, na fase ' + fz.nome.toLowerCase() + '. Hoje: ' + fz.tarefas[0][0].toLowerCase() + '.' : 'Comece pela semana 1: ' + fz.tarefas.slice(0, 3).map(function (x) { return x[0].toLowerCase(); }).join(', ') + '.') +
      ' O que mais faz dar certo: vender antes de gastar e fazer de 10 a 15 contatos por dia útil. Abri o plano completo.';
  }
  function guiaLancamento() {
    var lc = S.lancamento();
    if (cb.abrirLivro) cb.abrirLivro('lancamento');
    if (!lc.proximos.length) return 'Todos os ' + lc.total + ' passos do lançamento estão concluídos. A empresa está no ar.';
    return 'Lançamento da empresa: ' + lc.feitos + ' de ' + lc.total + ' passos concluídos. Os próximos são: ' + lc.proximos.slice(0, 3).map(function (x) { return x.texto.charAt(0).toLowerCase() + x.texto.slice(1); }).join('; ') + '. Abri o checklist completo.';
  }
  function falarDeSkillExterna(id) {
    var lista = T.SKILLS_EXTERNAS || [], s = id ? T.skillExterna(id) : null;
    if (s) {
      var l = T.lugarDaSkill(s);
      if (cb.mostrarSkillExterna) cb.mostrarSkillExterna(s.id);
      return s.nome + ': ' + s.resumo + ' Fica na sala ' + s.sala + (l ? ', no ' + l.andar.n + 'º andar' : '') + (s.instalado ? ', e já está instalada no disco ' + s.instalado.slice(0, 1) + '. ' : ', e ainda não está instalada. ') + 'Atenção: ' + s.atencao.split('. ')[0].replace(/\.$/, '') + '.';
    }
    if (cb.abrirSkillsExternas) cb.abrirSkillsExternas();
    /* agrupa por andar para a fala não virar uma lista de 16 nomes soltos */
    var porAndar = T.ANDARES.map(function (a) {
      var nomes = lista.filter(function (x) { var l = T.lugarDaSkill(x); return l && l.andar.n === a.n; }).map(function (x) { return x.nome; });
      return nomes.length ? a.nome + ': ' + nomes.join(', ') : '';
    }).filter(Boolean);
    var inst = lista.filter(function (x) { return x.instalado; }).map(function (x) { return x.nome; });
    return 'São ' + lista.length + ' skills externas, todas projetos reais de outros autores. ' +
      (inst.length ? 'Já instaladas no seu computador: ' + inst.join(', ') + '. ' : 'Nenhuma está instalada. ') + porAndar.join('. ') + '. Antes de instalar qualquer uma, passe pelo SkillSpector. Abri o catálogo; diga um nome e eu mostro os detalhes.';
  }
  function falarDoAcervo() {
    var n = S.andarEstudo(), a = n && T.andar(n), total = (T.BIBLIOTECA || []).length;
    if (!a) return 'A biblioteca não está disponível.';
    if (cb.irPara) cb.irPara(n);
    return 'A biblioteca tem ' + total + ' livros em ' + a.squads.length + ' salas: ' + a.squads.map(function (s) { return s.nome; }).join(', ') + '. Você já leu ' + S.livrosLidos() + '. Diga o assunto e eu abro o livro.';
  }
  /* ações pedidas pela IA (vêm do servidor) */
  function executarAcao(a) {
    try {
      if (a.tipo === 'ir_para_andar' && cb.irPara) cb.irPara(a.andar | 0);
      else if (a.tipo === 'marcar_reuniao') { S.marcarReuniao({ titulo: a.titulo, inicio: new Date(a.inicio), dur: a.duracao_min, andares: a.andares, origem: 'jarvis' }); if (cb.irPara) cb.irPara(7); }
      else if (a.tipo === 'cancelar_reuniao') { S.removerReuniao(String(a.id)); if (cb.irPara) cb.irPara(7); }
      else if (a.tipo === 'registrar_informacao') S.registrarInfo(a.texto, 'Jarvis');
      else if (a.tipo === 'abrir_resumo' && cb.abrirResumo) cb.abrirResumo();
      else if (a.tipo === 'mostrar_agente' && cb.abrirAgente) cb.abrirAgente(a.andar | 0, a.indice | 0);
      else if (a.tipo === 'ir_para_sala' && cb.irParaSala) cb.irParaSala(a.andar | 0, a.sala | 0);
      else if (a.tipo === 'abrir_livro' && cb.abrirLivro) cb.abrirLivro(String(a.id));
      else if (a.tipo === 'abrir_produtos' && cb.abrirProdutos) cb.abrirProdutos();
      else if (a.tipo === 'mostrar_skill_externa' && cb.mostrarSkillExterna) cb.mostrarSkillExterna(String(a.id));
      else if (a.tipo === 'criar_lembrete' && T.Lembretes) T.Lembretes.criar(a.texto, new Date(a.quando));
    } catch (e) { console.error('[jarvis] ação falhou', a, e); }
  }

  function responderLocal(r, original) {
    if (r.voz != null) definirVoz(r.voz);
    if (r.ir != null && cb.irPara) cb.irPara(r.ir);
    if (r.reuniao) return marcar(r.reuniao);
    if (r.cancelar) return cancelar(r.cancelar);
    if (r.lembrete) return criarLembrete(r.lembrete);
    if (r.verLembretes) return listarLembretes();
    if (r.externa !== undefined) return falarDeSkillExterna(r.externa);
    if (r.produtos) return mostrarProdutos();
    if (r.salario !== undefined) return guiaSalario(r.salario);
    if (r.plano !== undefined) return guiaPlano(r.plano);
    if (r.lancamento) return guiaLancamento();
    if (r.livro) return abrirLivro(r.livro);
    if (r.acervo) return falarDoAcervo();
    if (r.sala) return entrarNaSala(r.sala.n, r.sala.k);
    if (r.info) return registrar(r.info);
    if (r.nome) return 'Pronto. A empresa agora se chama ' + S.definirNomeEmpresa(r.nome) + '.';
    if (r.agente && cb.abrirAgente) cb.abrirAgente(r.agente.n, r.agente.i);
    if (r.resumo && cb.abrirResumo) cb.abrirResumo();
    if (r.desconhecido) return 'Essa eu ainda não sei responder no modo local. Tente perguntar sobre vendas, gastos, reuniões, vídeos ou redes — ou diga “ajuda” para ver o que eu faço.' + (ia.ativa ? '' : ' Com o modo IA ligado, respondo perguntas livres.');
    return r.texto;
  }

  /* A resposta da IA chega aos poucos: o texto vai aparecendo no balão, cada frase
     completa já é falada e as ações na torre acontecem na hora.
     Devolve o texto final, ou null se a pergunta foi interrompida. */
  var vez = 0, corte = null, balaoAberto = null;

  async function viaIA(texto, balao, minha) {
    corte = root.AbortController ? new root.AbortController() : null;
    var resp = await root.fetch('/api/jarvis/fluxo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: corte ? corte.signal : undefined,
      body: JSON.stringify({ mensagem: texto, historico: historico.slice(-12), estado: S.snapshot() })
    });
    if (!resp.ok || !resp.body) {
      var j = await resp.json().catch(function () { return {}; });
      throw new Error(j.erro || 'Falha ao falar com a IA (' + resp.status + ')');
    }
    var leitor = resp.body.getReader(), dec = new root.TextDecoder(), resto = '', dito = '', fim = null, i, ev;
    abrirFala();
    try {
      for (;;) {
        var p = await leitor.read();
        if (minha !== vez) return null;
        if (p.done) break;
        resto += dec.decode(p.value, { stream: true });
        while ((i = resto.indexOf('\n')) >= 0) {
          ev = resto.slice(0, i).trim(); resto = resto.slice(i + 1);
          if (!ev) continue;
          ev = JSON.parse(ev);
          if (ev.t === 'texto') { dito += ev.d; balao.classList.remove('digitando'); balao.textContent = dito; rolar(); alimentarFala(ev.d); }
          else if (ev.t === 'acao') executarAcao(ev.acao);
          else if (ev.t === 'fim') fim = ev;
          else if (ev.t === 'erro') throw new Error(ev.erro);
        }
      }
      if (!fim && !dito.trim()) throw new Error('a resposta veio vazia');
    } catch (e) {
      if (minha !== vez) return null;
      if (!dito.trim()) throw e; /* nada chegou: quem chamou responde no modo local */
      console.warn('[jarvis] a resposta da IA foi interrompida:', e.message);
    }
    if (fim && fim.substituir) { balao.classList.remove('digitando'); balao.textContent = fim.texto; rolar(); falar(fim.texto); return fim.texto; }
    dito = (fim ? fim.texto : dito).trim();
    balao.textContent = dito; rolar();
    fecharFala();
    return dito;
  }

  /* Larga a pergunta em andamento: corta o pedido à IA, cala a voz e arruma o balão pela metade. */
  function interromper() {
    vez++;
    if (corte) { try { corte.abort(); } catch (e) { /* já terminou */ } corte = null; }
    if (balaoAberto) { if (balaoAberto.textContent.trim()) balaoAberto.classList.remove('digitando'); else if (balaoAberto.parentNode) balaoAberto.parentNode.removeChild(balaoAberto); balaoAberto = null; }
    pararFala();
  }

  async function perguntar(texto, o) {
    texto = String(texto || '').trim();
    if (!texto) return;
    o = o || {};
    interromper(); /* uma pergunta nova substitui a anterior, mesmo no meio da resposta */
    var minha = vez;
    if (!o.oculto) bolha('voce', texto);
    var r = interpretar(texto), resposta = null, balao = null, aoVivo = false;
    if (r.parar) return definirEstado('parado');
    definirEstado('pensando');
    /* comandos e ajustes simples são resolvidos na hora; o resto vai para a IA quando ela existe */
    if (ia.ativa && !r.local && !(r.comando && texto.split(/\s+/).length <= 7)) {
      balao = balaoAberto = bolha('jarvis', ''); balao.classList.add('digitando');
      try { resposta = await viaIA(texto, balao, minha); aoVivo = !!resposta; }
      catch (e) { if (minha === vez) console.warn('[jarvis] IA indisponível, respondendo no modo local:', e.message); }
      if (minha !== vez) return;
      corte = null; balaoAberto = null;
    }
    if (!resposta) resposta = responderLocal(r, texto);
    historico.push({ papel: 'user', texto: texto }, { papel: 'assistant', texto: resposta });
    if (historico.length > 24) historico = historico.slice(-24);
    if (aoVivo) return resposta; /* já está na tela e sendo falada */
    if (balao) { balao.classList.remove('digitando'); balao.textContent = resposta; rolar(); } else bolha('jarvis', resposta);
    falar(resposta);
    return resposta;
  }

  /* ==========================================================================
     VOZ: falar e ouvir
     ======================================================================== */
  var sint = root.speechSynthesis, vozEscolhida = null;
  function escolherVoz() {
    if (!sint) return;
    var v = sint.getVoices().filter(function (x) { return /^pt/i.test(x.lang); });
    vozEscolhida = v.filter(function (x) { return /pt[-_]BR/i.test(x.lang) && /(antonio|daniel|google|natural)/i.test(x.name); })[0] || v.filter(function (x) { return /pt[-_]BR/i.test(x.lang); })[0] || v[0] || null;
  }
  if (sint) { escolherVoz(); if (sint.addEventListener) sint.addEventListener('voiceschanged', escolherVoz); }

  /* deixa o texto natural para ser lido em voz alta */
  function paraFala(t) {
    return t.replace(/R\$\s?([\d.]+(?:,\d+)?)\s?(mil|mi|bi)?/g, function (_, n, e) { return n + (e === 'mi' ? ' milhões de' : e === 'bi' ? ' bilhões de' : e ? ' mil' : '') + ' reais'; })
      .replace(/(\d)\s?mi\b/g, '$1 milhões').replace(/[«»“”"*#`]/g, '').replace(/×/g, ' com ').replace(/—|–/g, ', ')
      /* horários: "10:00" vira "10 horas" e "10:30" vira "10 e 30" (a voz leria "dez zero zero") */
      .replace(/\b(\d{1,2}):(\d{2})\b/g, function (_, h, m) { return (+h) + (m === '00' ? (+h === 1 ? ' hora' : ' horas') : ' e ' + (+m)); })
      .replace(/\s+/g, ' ');
  }
  /* Separa o texto em frases. Só corta depois de pontuação seguida de espaço, para não
     partir números como "R$ 4.800". Sem `tudo`, o trecho final ainda incompleto fica em `resto`. */
  function cortarFrases(t, tudo) {
    var frases = [], re = /[.!?;]+["”»)]*\s+/g, ini = 0;
    while (re.exec(t)) { frases.push(t.slice(ini, re.lastIndex)); ini = re.lastIndex; }
    var resto = t.slice(ini);
    if (tudo && resto.trim()) { frases.push(resto); resto = ''; }
    return { frases: frases, resto: resto };
  }

  /* ger: muda a cada fala nova, para ignorar o fim das frases canceladas;
     aberta: ainda está chegando texto da IA; buf: trecho que ainda não fechou uma frase */
  var fala = { ger: 0, restam: 0, aberta: false, buf: '' };
  /* vozServidor: a torre está com a voz brasileira do Piper ligada (Jarvis local) */
  var vozServidor = false, filaVoz = [], tocandoVoz = false, audioAtual = null;
  function fimDaFrase(g) { if (g === fala.ger && --fala.restam <= 0 && !fala.aberta && estado === 'falando') definirEstado('parado'); }
  function falarNoNavegador(frase, aoTerminar) {
    var u = new root.SpeechSynthesisUtterance(frase);
    u.lang = 'pt-BR'; if (vozEscolhida) u.voice = vozEscolhida; u.rate = 1.06; u.pitch = 0.92;
    u.onend = u.onerror = aoTerminar;
    sint.speak(u);
  }
  function enunciar(frase) {
    frase = paraFala(frase).trim();
    if (!vozLigada || !/[0-9A-Za-zÀ-ÿ]/.test(frase)) return;
    if (vozServidor) return enunciarServidor(frase);
    if (!sint) return;
    var g = fala.ger;
    fala.restam++;
    if (estado !== 'falando') definirEstado('falando');
    falarNoNavegador(frase, function () { fimDaFrase(g); });
  }
  /* Voz do Piper: cada frase vira um áudio pedido ao servidor assim que fica pronta;
     os áudios tocam em ordem, um depois do outro. */
  function enunciarServidor(frase) {
    var item = {
      g: fala.ger, frase: frase,
      audio: root.fetch('/api/voz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: frase }) })
        .then(function (r) { return r.ok ? r.blob() : null; }).catch(function () { return null; })
    };
    filaVoz.push(item); fala.restam++;
    if (estado !== 'falando') definirEstado('falando');
    if (!tocandoVoz) tocarProxima();
  }
  function tocarProxima() {
    var item = filaVoz.shift();
    if (!item) { tocandoVoz = false; return; }
    tocandoVoz = true;
    item.audio.then(function (blob) {
      if (item.g !== fala.ger) return;   /* a fala foi interrompida */
      function fim() { if (item.g !== fala.ger) return; audioAtual = null; fimDaFrase(item.g); tocarProxima(); }
      if (!blob) { if (sint) falarNoNavegador(item.frase, fim); else fim(); return; }   /* a voz local falhou: usa a do navegador */
      var url = root.URL.createObjectURL(blob), a = new root.Audio(url);
      audioAtual = a;
      a.onended = a.onerror = function () { root.URL.revokeObjectURL(url); fim(); };
      var tocou = a.play();
      if (tocou && tocou.catch) tocou.catch(function () { root.URL.revokeObjectURL(url); fim(); });
    });
  }
  function pararFala() {
    fala.ger++; fala.restam = 0; fala.aberta = false; fala.buf = '';
    if (sint) sint.cancel();
    filaVoz = []; tocandoVoz = false;
    if (audioAtual) { try { audioAtual.pause(); } catch (e) { /* já tinha parado */ } audioAtual = null; }
    if (estado === 'falando') definirEstado('parado');
  }
  function falar(texto) {
    pararFala();
    if (vozLigada && (vozServidor || sint) && texto) cortarFrases(texto, true).frases.forEach(enunciar);
    if (fala.restam <= 0) definirEstado('parado');
  }
  /* fala ao vivo: as frases são ditas conforme o texto chega */
  function abrirFala() { pararFala(); fala.aberta = true; }
  function alimentarFala(pedaco) {
    if (!fala.aberta) return;
    var c = cortarFrases(fala.buf + pedaco, false);
    fala.buf = c.resto; c.frases.forEach(enunciar);
  }
  function fecharFala() {
    if (fala.aberta) enunciar(fala.buf);
    fala.aberta = false; fala.buf = '';
    if (fala.restam <= 0 && estado !== 'ouvindo') definirEstado('parado');
  }
  function definirVoz(ligada) {
    vozLigada = !!ligada; if (!vozLigada) pararFala();
    S.guarda.gravar('torre.voz', vozLigada);
    var b = $('jvVoz'); if (b) { b.setAttribute('aria-pressed', vozLigada); b.title = vozLigada ? 'Voz ligada — clique para silenciar' : 'Voz desligada — clique para ligar'; b.classList.toggle('off', !vozLigada); }
  }

  var Rec = root.SpeechRecognition || root.webkitSpeechRecognition, rec = null, ouvindo = false;
  function alternarMic() {
    if (!Rec) return bolha('jarvis', 'Este navegador não tem reconhecimento de voz. Use o Chrome ou o Edge, ou escreva a pergunta.');
    if (ouvindo) { rec.stop(); return; }
    interromper(); /* falar por cima do Jarvis corta a resposta em andamento */
    rec = new Rec(); rec.lang = 'pt-BR'; rec.interimResults = true; rec.maxAlternatives = 1;
    var final = '';
    rec.onstart = function () { ouvindo = true; definirEstado('ouvindo'); $('jvMic').classList.add('on'); $('jvTexto').placeholder = 'Ouvindo…'; };
    rec.onresult = function (e) {
      var parcial = '';
      for (var i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) final += e.results[i][0].transcript; else parcial += e.results[i][0].transcript; }
      $('jvTexto').value = final || parcial;
    };
    rec.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') bolha('jarvis', 'Preciso da permissão do microfone para ouvir. Libere o acesso no navegador e tente de novo.');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') bolha('jarvis', 'Não consegui ouvir agora (' + e.error + '). Você pode escrever a pergunta.');
    };
    rec.onend = function () {
      ouvindo = false; $('jvMic').classList.remove('on'); $('jvTexto').placeholder = 'Pergunte ao Jarvis…';
      if (estado === 'ouvindo') definirEstado('parado');
      var dito = (final || $('jvTexto').value).trim();
      if (dito) { $('jvTexto').value = ''; perguntar(dito); }
    };
    try { rec.start(); } catch (e) { ouvindo = false; }
  }

  /* ==========================================================================
     INTERFACE: orbe, conversa
     ======================================================================== */
  function definirEstado(e) {
    estado = e;
    var j = $('jarvis'); if (j) j.dataset.estado = e;
    var s = $('jvStatus'); if (s) s.textContent = { parado: ia.ativa ? (ia.motor === 'local' ? 'IA no seu computador' : 'IA conectada') : 'respostas prontas', ouvindo: 'ouvindo…', pensando: 'pensando…', falando: 'falando…' }[e];
  }
  function bolha(quem, texto) {
    var box = $('jvMsgs'); if (!box) return;
    var d = document.createElement('div'); d.className = 'jv-msg de-' + quem; d.textContent = texto;
    box.appendChild(d);
    while (box.children.length > 60) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
    return d;
  }
  function rolar() { var box = $('jvMsgs'); if (box) box.scrollTop = box.scrollHeight; }
  function abrir(aberto) {
    var p = $('jvPainel'), on = aberto == null ? p.hidden : aberto;
    p.hidden = !on; $('jvOrbe').setAttribute('aria-expanded', on);
    document.body.classList.toggle('com-jarvis', on);
    if (on) setTimeout(function () { $('jvTexto').focus(); }, 60);
  }

  /* orbe animado (canvas 2D) */
  function animarOrbe() {
    var c = $('jvCanvas'); if (!c) return;
    var x = c.getContext('2d'), dpr = Math.min(2, root.devicePixelRatio || 1), tam = 72, nivel = 0;
    c.width = c.height = tam * dpr; x.scale(dpr, dpr);
    function quadro(ms) {
      root.requestAnimationFrame(quadro);
      var t = ms / 1000, m = tam / 2, alvo = estado === 'falando' ? 0.55 + 0.45 * Math.abs(Math.sin(t * 9) * Math.sin(t * 5.3)) : estado === 'ouvindo' ? 0.7 + 0.3 * Math.sin(t * 6) : estado === 'pensando' ? 0.5 : 0.18;
      nivel += (alvo - nivel) * 0.18;
      x.clearRect(0, 0, tam, tam);
      var g = x.createRadialGradient(m, m, 2, m, m, m);
      g.addColorStop(0, 'rgba(191,230,255,' + (0.55 + nivel * 0.4) + ')'); g.addColorStop(0.45, 'rgba(120,180,240,' + (0.16 + nivel * 0.2) + ')'); g.addColorStop(1, 'rgba(120,180,240,0)');
      x.fillStyle = g; x.beginPath(); x.arc(m, m, m, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#eaf6ff'; x.beginPath(); x.arc(m, m, 6.5 + nivel * 5, 0, Math.PI * 2); x.fill();
      x.lineCap = 'round'; x.strokeStyle = 'rgba(191,230,255,.9)';
      var vel = estado === 'pensando' ? 3.4 : 0.7;
      [[17, 1.6, 1.2, vel], [23, 1.2, 2.0, -vel * 0.7], [29, 1, 0.9, vel * 0.45]].forEach(function (a, i) {
        x.lineWidth = a[1]; x.globalAlpha = 0.45 + nivel * 0.5 - i * 0.1;
        for (var k = 0; k < 3; k++) { var ini = t * a[3] + k * Math.PI * 2 / 3 + i; x.beginPath(); x.arc(m, m, a[0] + (estado === 'falando' ? Math.sin(t * 11 + i * 2) * nivel * 1.6 : 0), ini, ini + a[2]); x.stroke(); }
      });
      x.globalAlpha = 1;
    }
    root.requestAnimationFrame(quadro);
  }

  var SUGESTOES = ['Resumo do dia', 'O que eu faço hoje?', 'Meus lembretes', 'Quanto é 1490 vezes 3?', 'Mostre os produtos', 'Entre na sala de prospecção', 'Como estão as vendas?'];

  function montar(callbacks) {
    S = T.Sim; cb = callbacks || {};
    vozLigada = S.guarda.ler('torre.voz', true);
    $('jvChips').innerHTML = SUGESTOES.map(function (s) { return '<button type="button" class="chip-bt">' + T.esc(s) + '</button>'; }).join('');
    $('jvChips').addEventListener('click', function (e) { if (e.target.classList.contains('chip-bt')) perguntar(e.target.textContent); });
    $('jvOrbe').addEventListener('click', function () { abrir(); });
    $('jvFechar').addEventListener('click', function () { abrir(false); });
    $('jvVoz').addEventListener('click', function () { definirVoz(!vozLigada); });
    $('jvMic').addEventListener('click', alternarMic);
    if (!Rec) { $('jvMic').classList.add('indisponivel'); $('jvMic').title = 'Reconhecimento de voz indisponível neste navegador'; }
    $('jvForm').addEventListener('submit', function (e) { e.preventDefault(); var v = $('jvTexto').value; $('jvTexto').value = ''; perguntar(v); });
    definirVoz(vozLigada); definirEstado('parado'); animarOrbe();

    /* existe servidor com IA? (só quando o site está em http/https) */
    $('jvModo').textContent = 'respostas prontas';
    if (/^https?:$/.test(root.location.protocol)) verificarIA();
  }
  /* Pergunta ao servidor qual IA está ligada (Claude ou a local) e se há voz brasileira.
     Enquanto o modelo local carrega na placa de vídeo, pergunta de novo a cada 5 segundos. */
  function verificarIA() {
    root.fetch('/api/status').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j) return;
      vozServidor = !!j.voz;
      var m = $('jvModo');
      if (j.ia) {
        ia = { ativa: true, modelo: j.modelo, motor: j.motor };
        m.textContent = (j.motor === 'local' ? 'IA local · ' : 'IA · ') + String(j.modelo || '').replace(/-(?:UD-)?I?Q\d[\w]*$/i, '');
        m.title = j.motor === 'local' ? 'Rodando no seu computador, na placa de vídeo' + (j.vozNome ? ', com a voz ' + j.vozNome : '') : 'Claude, pela internet';
        m.classList.add('on'); definirEstado(estado);
      } else if (j.carregando) { m.textContent = 'IA local carregando…'; setTimeout(verificarIA, 5000); }
    }).catch(function () { /* sem servidor: segue com as respostas prontas */ });
  }

  T.Jarvis = {
    montar: montar, perguntar: perguntar, falar: function (t) { bolha('jarvis', t); falar(t); }, parar: pararFala, abrir: abrir, alternarMic: alternarMic,
    interpretar: interpretar, estado: function () { return estado; }, iaAtiva: function () { return ia.ativa; },
    saudar: function () {
      var h = S.hoje;
      T.Jarvis.falar(saudacaoHora() + '. Bem-vindo à torre da ' + S.nomeEmpresa() + '. Os ' + T.ANDARES.length + ' andares estão operando: ' + F.int(S.agentesAtivos()) + ' agentes ativos e ' + F.int(h.vendas) + ' sites vendidos hoje. Clique em um andar para entrar e em uma sala para ver por dentro, ou me pergunte o que quiser.');
    }
  };
})(window);
