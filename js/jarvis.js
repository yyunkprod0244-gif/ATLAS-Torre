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
  var estado = 'parado', vozLigada = true, ia = { ativa: false, modelo: '' }, historico = [], ocupado = false;

  /* ==========================================================================
     ENTENDER O QUE FOI DITO (modo local)
     ======================================================================== */
  function limpar(t) { return T.normalizar(t).replace(/[?!.,;:"«»]/g, ' ').replace(/\s+/g, ' ').trim(); }
  var ORDINAIS = ['primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto', 'setimo', 'oitavo'];

  function qualAndar(t) {
    var m = t.match(/(\d)\s*(?:o|º|°)?\s*andar/) || t.match(/(?:andar|piso)\s*(?:numero\s*)?(\d)/);
    if (m && +m[1] >= 1 && +m[1] <= 8) return +m[1];
    for (var i = 0; i < 8; i++) if (t.indexOf(ORDINAIS[i] + ' andar') >= 0) return i + 1;
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

    if (/^(pare|para|parar|silencio|chega|cala|quieto|ok pare)\b/.test(t)) return { texto: '', parar: true, local: true };
    if (/(desativ|deslig|sem) (a )?voz|fique mudo|modo mudo/.test(t)) return { texto: 'Voz desligada. Continuo respondendo por texto.', voz: false, local: true };
    if (/(ativ|lig)\w* (a )?voz|pode falar|fale comigo/.test(t)) return { texto: 'Voz ligada.', voz: true, local: true };

    if (/(marc|marq|agend)\w*\s+(uma\s+|um\s+|a\s+)?(reuni|call|encontro|conversa)/.test(t)) {
      var q = quando(t), ands = andaresCitados(t).filter(function (x) { return x !== 7; });
      return { texto: null, comando: true, reuniao: { titulo: tituloDe(original, t), inicio: q.inicio, dur: q.dur, andares: ands, origem: 'jarvis' } };
    }
    if ((m = t.match(/^(anota|anote|anotar|registra|registre|registrar|nova informacao|avisa|avise)\b\s*(ai|isso|que|a torre)?\s*/)) && t.length > m[0].length + 3)
      return { texto: null, comando: true, info: original.slice(m[0].length).replace(/^[:\s]+/, '') };
    if ((m = t.match(/(?:mude|troque|altere|defina)\s+o nome da empresa para\s+(.+)/))) return { texto: null, comando: true, nome: original.slice(original.length - m[1].length) };

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
      return { texto: 'A torre tem 8 andares, ' + F.int(T.TOTAIS.agentes) + ' agentes e ' + F.int(T.TOTAIS.skills) + ' skills. Agora, ' + F.int(S.agentesAtivos()) + ' agentes estão ativos.' };
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
    if (/(mega brain|cerebro|roteada|decis)/.test(t)) return { texto: 'O Mega Brain roteou ' + F.compacto(h.msgs) + ' mensagens entre os andares hoje e tomou ' + F.compacto(h.decisoes) + ' decisões sem intervenção humana. Os 8 andares estão sincronizados.' };
    if (n) return { texto: sobreAndar(n) };
    if (/(como (esta|vai|anda) a empresa|status|tudo (certo|bem|ok)|situacao|panorama|sobre a empresa|fale da empresa|me atualiza)/.test(t)) {
      fin = S.financeiro(); var al = S.resumo().alertas;
      return { texto: S.nomeEmpresa() + ' está operando com ' + F.int(S.agentesAtivos()) + ' agentes ativos. Hoje: ' + F.int(h.vendas) + ' sites vendidos, ' + F.brlc(h.receita) + ' de receita e ' + F.int(h.posts) + ' posts publicados. No mês, o resultado está em ' + F.brlc(fin.resultado) + '. ' + (al.length ? 'Um ponto de atenção: ' + al[0] : 'Nenhum alerta no momento.') };
    }
    if (/(que horas|horario agora|que dia e hoje|data de hoje)/.test(t)) return { texto: 'Agora são ' + F.hora(new Date()) + ' de ' + F.dataLonga(new Date()) + '.' };
    if (/(quem e voce|seu nome|o que voce e|voce e uma ia)/.test(t)) return { texto: 'Sou o Jarvis, o assistente da ' + S.nomeEmpresa() + '. Acompanho os 8 andares da torre e respondo sobre vendas, marketing, vídeos, publicações, financeiro e reuniões. Os números que mostro hoje são simulados.' };
    if (/(ajuda|o que voce (faz|sabe|pode)|comandos|como (te )?uso)/.test(t)) return { texto: 'Posso: levar você a um andar (“abra o financeiro”), contar como estão vendas, marketing, vídeos, redes e gastos, ler o resumo do dia, marcar reuniões (“marque uma reunião amanhã às 15h sobre a proposta”), registrar informações (“anota: cliente quer loja virtual”) e procurar agentes ou skills.' };
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
  function registrar(texto) {
    var r = S.registrarInfo(texto, 'Jarvis');
    return r.erro ? r.erro : 'Anotado. O Mega Brain entregou a informação a ' + r.andar.nome + '.';
  }
  /* ações pedidas pela IA (vêm do servidor) */
  function executarAcao(a) {
    try {
      if (a.tipo === 'ir_para_andar' && cb.irPara) cb.irPara(a.andar | 0);
      else if (a.tipo === 'marcar_reuniao') { S.marcarReuniao({ titulo: a.titulo, inicio: new Date(a.inicio), dur: a.duracao_min, andares: a.andares, origem: 'jarvis' }); if (cb.irPara) cb.irPara(7); }
      else if (a.tipo === 'registrar_informacao') S.registrarInfo(a.texto, 'Jarvis');
      else if (a.tipo === 'abrir_resumo' && cb.abrirResumo) cb.abrirResumo();
      else if (a.tipo === 'mostrar_agente' && cb.abrirAgente) cb.abrirAgente(a.andar | 0, a.indice | 0);
    } catch (e) { console.error('[jarvis] ação falhou', a, e); }
  }

  function responderLocal(r, original) {
    if (r.voz != null) definirVoz(r.voz);
    if (r.ir != null && cb.irPara) cb.irPara(r.ir);
    if (r.reuniao) return marcar(r.reuniao);
    if (r.info) return registrar(r.info);
    if (r.nome) return 'Pronto. A empresa agora se chama ' + S.definirNomeEmpresa(r.nome) + '.';
    if (r.agente && cb.abrirAgente) cb.abrirAgente(r.agente.n, r.agente.i);
    if (r.resumo && cb.abrirResumo) cb.abrirResumo();
    if (r.desconhecido) return 'Essa eu ainda não sei responder no modo local. Tente perguntar sobre vendas, gastos, reuniões, vídeos ou redes — ou diga “ajuda” para ver o que eu faço.' + (ia.ativa ? '' : ' Com o modo IA ligado, respondo perguntas livres.');
    return r.texto;
  }

  async function viaIA(texto) {
    var resp = await root.fetch('/api/jarvis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem: texto, historico: historico.slice(-12), estado: S.snapshot() })
    });
    var j = await resp.json();
    if (!resp.ok || !j.ok) throw new Error(j.erro || 'Falha ao falar com a IA (' + resp.status + ')');
    (j.acoes || []).forEach(executarAcao);
    return j.texto;
  }

  async function perguntar(texto, o) {
    texto = String(texto || '').trim();
    if (!texto || ocupado) return;
    o = o || {};
    pararFala();
    if (!o.oculto) bolha('voce', texto);
    var r = interpretar(texto), resposta;
    if (r.parar) return definirEstado('parado');
    ocupado = true; definirEstado('pensando');
    /* comandos e ajustes simples são resolvidos na hora; o resto vai para a IA quando ela existe */
    if (ia.ativa && !r.local && !(r.comando && texto.split(/\s+/).length <= 7)) {
      try { resposta = await viaIA(texto); }
      catch (e) { console.warn('[jarvis] IA indisponível, respondendo no modo local:', e.message); resposta = null; }
    }
    if (!resposta) resposta = responderLocal(r, texto);
    ocupado = false;
    historico.push({ papel: 'user', texto: texto }, { papel: 'assistant', texto: resposta });
    if (historico.length > 24) historico = historico.slice(-24);
    bolha('jarvis', resposta);
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
      .replace(/(\d)\s?mi\b/g, '$1 milhões').replace(/[«»“”"]/g, '').replace(/×/g, ' com ').replace(/—|–/g, ', ').replace(/\s+/g, ' ');
  }
  function falar(texto) {
    if (!vozLigada || !sint || !texto) { definirEstado('parado'); return; }
    sint.cancel();
    var partes = paraFala(texto).match(/[^.!?;]+[.!?;]*/g) || [texto], restam = partes.length;
    definirEstado('falando');
    partes.forEach(function (p) {
      var u = new root.SpeechSynthesisUtterance(p.trim());
      u.lang = 'pt-BR'; if (vozEscolhida) u.voice = vozEscolhida; u.rate = 1.06; u.pitch = 0.92;
      u.onend = u.onerror = function () { if (--restam <= 0 && estado === 'falando') definirEstado('parado'); };
      sint.speak(u);
    });
  }
  function pararFala() { if (sint) sint.cancel(); if (estado === 'falando') definirEstado('parado'); }
  function definirVoz(ligada) {
    vozLigada = !!ligada; if (!vozLigada) pararFala();
    S.guarda.gravar('torre.voz', vozLigada);
    var b = $('jvVoz'); if (b) { b.setAttribute('aria-pressed', vozLigada); b.title = vozLigada ? 'Voz ligada — clique para silenciar' : 'Voz desligada — clique para ligar'; b.classList.toggle('off', !vozLigada); }
  }

  var Rec = root.SpeechRecognition || root.webkitSpeechRecognition, rec = null, ouvindo = false;
  function alternarMic() {
    if (!Rec) return bolha('jarvis', 'Este navegador não tem reconhecimento de voz. Use o Chrome ou o Edge, ou escreva a pergunta.');
    if (ouvindo) { rec.stop(); return; }
    pararFala();
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
    var s = $('jvStatus'); if (s) s.textContent = { parado: ia.ativa ? 'IA conectada' : 'modo local', ouvindo: 'ouvindo…', pensando: 'pensando…', falando: 'falando…' }[e];
  }
  function bolha(quem, texto) {
    var box = $('jvMsgs'); if (!box) return;
    var d = document.createElement('div'); d.className = 'jv-msg de-' + quem; d.textContent = texto;
    box.appendChild(d);
    while (box.children.length > 60) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }
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

  var SUGESTOES = ['Resumo do dia', 'Como estão as vendas?', 'Quanto ainda dá para gastar?', 'Abra o Mega Brain', 'Próximas reuniões'];

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
    if (/^https?:$/.test(root.location.protocol)) {
      root.fetch('/api/status').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (j && j.ia) { ia = { ativa: true, modelo: j.modelo }; $('jvModo').textContent = 'IA · ' + j.modelo; $('jvModo').classList.add('on'); definirEstado(estado); }
      }).catch(function () { /* sem servidor de IA: segue no modo local */ });
    }
  }

  T.Jarvis = {
    montar: montar, perguntar: perguntar, falar: function (t) { bolha('jarvis', t); falar(t); }, parar: pararFala, abrir: abrir, alternarMic: alternarMic,
    interpretar: interpretar, estado: function () { return estado; }, iaAtiva: function () { return ia.ativa; },
    saudar: function () {
      var h = S.hoje;
      T.Jarvis.falar(saudacaoHora() + '. Bem-vindo à torre da ' + S.nomeEmpresa() + '. Os 8 andares estão operando: ' + F.int(S.agentesAtivos()) + ' agentes ativos e ' + F.int(h.vendas) + ' sites vendidos hoje. Clique em um andar para entrar, ou me pergunte o que quiser.');
    }
  };
})(window);
