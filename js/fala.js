/* ============================================================================
   TEXTO PARA FALA (português do Brasil)
   ----------------------------------------------------------------------------
   As vozes sintéticas (Piper e as do navegador) leem o texto "cru": "6º andar",
   "R$ 55,1 mil", "KPI", "WhatsApp" ou "Tala-T95" saem estranhos ou
   incompreensíveis. Aqui o texto vira o que uma pessoa falaria:
     R$ 1.490        → mil quatrocentos e noventa reais
     R$ 55,1 mil     → cinquenta e cinco mil e cem reais
     6º andar        → sexto andar          20%   → vinte por cento
     10:30 · 10h     → dez e trinta · dez horas
     2026-11-13      → treze de novembro
     KPI · CNPJ      → cá pê í · cê ene pê jota
     WhatsApp        → uótsap (escrito como se pronuncia)
   As grafias foram conferidas gerando o áudio com o Piper (voz cadu) e
   transcrevendo com o Whisper: o que o Whisper entende, uma pessoa entende.
   Usado pelo Jarvis no navegador e pelo servidor (voz do Piper).
   ========================================================================== */
(function (root) {
  'use strict';
  var T = root.Torre = root.Torre || {};

  /* ---------- números por extenso ---------- */
  var UN = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  var DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  var CEN = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  function unidade(n, fem) { return fem && n === 1 ? 'uma' : fem && n === 2 ? 'duas' : UN[n]; }
  function ate999(n, fem) {
    if (n === 100) return 'cem';
    var c = Math.floor(n / 100), r = n % 100, p = [];
    if (c) p.push(fem ? CEN[c].replace(/os$/, 'as') : CEN[c]);
    if (r) p.push(r < 20 ? unidade(r, fem) : DEZ[Math.floor(r / 10)] + (r % 10 ? ' e ' + unidade(r % 10, fem) : ''));
    return p.join(' e ');
  }
  var ESCALA = [null, null, ['milhão', 'milhões'], ['bilhão', 'bilhões'], ['trilhão', 'trilhões']];
  /* inteiro(1490) = "mil quatrocentos e noventa"; fem: "duas", "duzentas" */
  function inteiro(n, fem) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'zero';
    if (n >= 1e15) return String(n).split('').map(function (d) { return UN[+d]; }).join(' ');
    var g = [];
    while (n > 0) { g.push(n % 1000); n = Math.floor(n / 1000); }
    var partes = [];
    for (var i = g.length - 1; i >= 0; i--) {
      if (!g[i]) continue;
      var txt = i === 0 ? ate999(g[i], fem) : i === 1 ? (g[i] === 1 ? 'mil' : ate999(g[i], fem) + ' mil') : ate999(g[i], false) + ' ' + ESCALA[i][g[i] === 1 ? 0 : 1];
      partes.push({ txt: txt, v: g[i] });
    }
    var out = partes[0].txt;
    for (var k = 1; k < partes.length; k++) {
      /* "mil e cem", "dois mil e quinhentos", "mil e vinte"; mas "mil duzentos e trinta" */
      var ultimo = k === partes.length - 1, p = partes[k];
      out += (ultimo && (p.v < 100 || p.v % 100 === 0) ? ' e ' : ' ') + p.txt;
    }
    return out;
  }
  /* "4,5" → "quatro vírgula cinco"; "0,05" → "zero vírgula zero cinco" */
  function decimal(inteiroTxt, frac, fem) {
    var s = inteiro(+inteiroTxt || 0, fem);
    if (!frac) return s;
    var zeros = frac.match(/^0*/)[0].length, resto = frac.slice(zeros);
    return s + ' vírgula ' + (zeros ? Array(zeros + 1).join('zero ') : '') + (resto ? inteiro(+resto) : '').trim();
  }
  /* "1.490,50" → 1490.5 */
  function valorBR(s) { return +String(s).replace(/\./g, '').replace(',', '.'); }

  var ORD_U = ['', 'primeir', 'segund', 'terceir', 'quart', 'quint', 'sext', 'sétim', 'oitav', 'non'];
  var ORD_D = ['', 'décim', 'vigésim', 'trigésim', 'quadragésim', 'quinquagésim', 'sexagésim', 'septuagésim', 'octogésim', 'nonagésim'];
  function ordinal(n, fem) {
    var f = fem ? 'a' : 'o';
    if (n <= 0 || n >= 100) return inteiro(n);
    var d = Math.floor(n / 10), u = n % 10, p = [];
    if (d) p.push(ORD_D[d] + f);
    if (u) p.push(ORD_U[u] + f);
    return p.join(' ');
  }

  /* substantivos femininos comuns nas respostas: "2 horas" → "duas horas" */
  var FEMININOS = /^(horas?|pessoas?|vendas?|semanas?|tarefas?|reuni(ão|ões)|mensage(m|ns)|salas?|vezes|vez|liga(ção|ções)|propostas?|páginas?|fases?|metas?|regras?|contas?|empresas?|campanhas?|skills?|agências?|cidades?|lojas?|landing|imagens?|fotos?|notas?|opções?|perguntas?|respostas?|ideias?|estrelas?|categorias?|etapas?|telas?|seções?|aulas?|unidades?|pastas?|postagens?|publicações?|visualizações?|curtidas?)$/i;
  function eFeminino(depois) { var m = /^\s*([A-Za-zÀ-ÿ]+)/.exec(depois || ''); return !!(m && FEMININOS.test(m[1])); }

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function hora(h, m) {
    h = +h; m = +m || 0;
    var hs = inteiro(h, true) + (m ? '' : h === 1 ? ' hora' : ' horas');
    return m ? hs + ' e ' + inteiro(m) : hs;
  }
  function data(d, m, a) {
    var s = (+d === 1 ? 'primeiro' : inteiro(+d)) + ' de ' + MESES[+m - 1];
    if (a && +a !== new Date().getFullYear()) s += ' de ' + inteiro(+a < 100 ? 2000 + +a : +a);
    return s;
  }

  /* ---------- siglas e palavras estrangeiras ---------- */
  var LETRAS = { A: 'á', B: 'bê', C: 'cê', D: 'dê', E: 'é', F: 'éfe', G: 'gê', H: 'agá', I: 'í', J: 'jóta', K: 'cá', L: 'éle', M: 'ême', N: 'êne', O: 'ó', P: 'pê', Q: 'quê', R: 'érre', S: 'ésse', T: 'tê', U: 'ú', V: 'vê', W: 'dáblio', X: 'xís', Y: 'ípsilon', Z: 'zê' };
  function soletrar(s) { return s.toUpperCase().split('').map(function (c) { return LETRAS[c] || c; }).join(' '); }
  /* siglas que se falam como palavra */
  var SIGLA_PALAVRA = { MEI: 'mêi', DAS: 'dás', KPI: 'quêi pi ai', PIX: 'píx', ATLAS: 'átlas', JARVIS: 'djárvis', SEBRAE: 'sebrái', ONU: 'onú', FAQ: 'féqui', OK: 'ôquêi', CEO: 'ci-i-ôu', IOS: 'ai-ó-ésse', LED: 'léd', RAM: 'rã', NASA: 'nása', TED: 'téd', GIF: 'guíf', JPEG: 'jóta pég', PNG: 'pê êne gê', MP4: 'ême pê quatro', SAAS: 'sás', CTA: 'cê tê á' };
  /* palavras estrangeiras escritas como se pronunciam (minúsculas; a chave pode ter espaço) */
  var PRONUNCIA = [
    /* "landing page" não sai compreensível em nenhuma grafia com esta voz (testado com o Whisper) */
    ['landing pages', 'páginas de vendas'], ['landing page', 'página de vendas'], ['dashboards?', 'déshibórd'], ['mega brain', 'méga brêin'], ['brain', 'brêin'],
    ['whats ?app', 'uótsap'], ['youtube', 'iutúbi'], ['tik ?tok', 'tíquitóqui'], ['instagram', 'ínstagram'], ['linkedin', 'línquedín'],
    ['facebook', 'feicibúqui'], ['shorts', 'xórts'], ['reels', 'ríls'], ['stories', 'istóris'], ['google', 'gúgou'], ['gmail', 'gê mêiu'],
    ['e-?mails?', 'imêiu'], ['sites?', 'sáiti'], ['websites?', 'uébsáiti'], ['online', 'onláini'], ['offline', 'ófláini'],
    ['designers?', 'dizáiner'], ['design', 'dizáin'], ['blogs?', 'blógui'], ['skills?', 'isquíu'], ['jarvis', 'djárvis'],
    ['digital engineering', 'díjitau endjeníring'], ['engineering', 'endjeníring'], ['claude', 'clód'], ['anthropic', 'ântrópic'],
    ['piper', 'páiper'], ['llama\\.cpp', 'lhama cê pê pê'], ['llama', 'lhama'], ['qwen ?3\\.5(-9b)?', 'quên três ponto cinco'], ['qwen', 'quên'],
    ['github', 'guít râb'], ['software', 'sóftuér'], ['marketing', 'márquetin'], ['feedbacks?', 'fídbéqui'], ['briefing', 'brífin'],
    ['layouts?', 'leiáute'], ['templates?', 'témpleit'], ['checklists?', 'tchéquelist'], ['startups?', 'istartâp'], ['links?', 'línqui'],
    ['posts?', 'pôusti'], ['leads?', 'lídi'], ['web', 'uéb'], ['apps?', 'épi'], ['mobile', 'móbaiu'], ['zoho', 'zôrrô'],
    ['workspace', 'uôrqui ispêis'], ['vercel', 'vérsel'], ['cloudflare', 'cláudi flér'], ['canva', 'cânva'], ['notion', 'nôuchion'],
    ['trello', 'trélo'], ['hyperframes', 'ráiper frêims'], ['ponytail', 'pôuni têiu'], ['agents?', 'êidjent'], ['browser', 'bráuzer'],
    ['chrome', 'crôume'], ['devtools', 'dév túls'], ['shadcn', 'xéd cê êne'], ['whisper', 'uísper'], ['windows', 'uíndous'],
    ['upload', 'âploud'], ['download', 'dáunloud'], ['deploy', 'diplói'], ['hosting', 'rôsting'], ['freelancers?', 'frilâncer'],
    ['call', 'cól'], ['meeting', 'mítin'], ['ticket', 'tíquet'], ['spam', 'ispâm'], ['print', 'prínt'], ['play', 'plêi'],
    ['smartphone', 'ismártfôuni'], ['tablet', 'táblet'], ['notebook', 'nôutbúqui'], ['wi-?fi', 'uái fái'], ['streaming', 'istrímin'],
    ['podcast', 'pódcast'], ['influencers?', 'influênser'], ['branding', 'bréndin'], ['copy', 'cópi'], ['copywriting', 'cópirráitin'],
    ['performance', 'perfórmanci'], ['team', 'tím'], ['squads?', 'iscuóde'], ['coach', 'côutch'], ['free', 'frí'], ['premium', 'prêmium'],
    ['plus', 'plâs'], ['xubuntu', 'xubúntu'], ['linux', 'línux'],
    ['ruflo', 'rúflo'], ['opus ?car', 'ópus car'], ['opuscar', 'ópus car'], ['lemo', 'lêmo'], ['spector', 'ispéctor'], ['magic', 'médjic']
  ].map(function (p) { return [new RegExp('(^|[^A-Za-zÀ-ÿ])(' + p[0] + ')(?![A-Za-zÀ-ÿ])', 'gi'), p[1], /s?$/.test(p[0])]; });

  /* ---------- a conversão ---------- */
  function paraFala(texto) {
    var t = String(texto || '');
    /* formatação e símbolos que não se falam */
    t = t.replace(/https?:\/\/\S+/g, ' o link ').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
      .replace(/\*\*|__|[`*#~^<>[\]{}]/g, '').replace(/[«»“”"]/g, '').replace(/[‘’]/g, "'").replace(/…/g, '...')
      .replace(/\s*[·•|]\s*/g, ', ').replace(/\s*[→⇒➜]\s*/g, ', ').replace(/\s*[—–]\s*/g, ', ').replace(/×/g, ' vezes ')
      .replace(/\bn[º°]\s?(?=\d)/gi, 'número ').replace(/\b24\/7\b/g, 'vinte e quatro horas por dia, sete dias por semana');

    /* datas e horas */
    t = t.replace(/\b(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?\b/g, function (_, a, m, d, h, mi) {
      return data(d, m, a) + (h ? ' às ' + hora(h, mi) : '');
    });
    t = t.replace(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g, function (s, d, m, a) {
      return +m >= 1 && +m <= 12 && +d >= 1 && +d <= 31 ? data(d, m, a) : s;
    });
    t = t.replace(/\b(\d{1,2}):(\d{2})\b/g, function (_, h, m) { return hora(h, m); });
    t = t.replace(/\b(\d{1,2})h(\d{2})?\b/g, function (_, h, m) { return hora(h, m); });

    /* dinheiro: "R$ 1.490,50", "R$ 55,1 mil", "R$ 1,2 mi" */
    t = t.replace(/(-\s?)?R\$\s?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)(?:\s?(mil|mi|milhões|milhão|bi|bilhões|bilhão)\b)?/g, function (_, neg, n, esc) {
      var v = valorBR(n) * (esc === 'mil' ? 1e3 : /^mi/.test(esc || '') ? 1e6 : /^bi/.test(esc || '') ? 1e9 : 1);
      var reais = Math.floor(v + 1e-9), cent = Math.round((v - reais) * 100);
      var s = reais || !cent ? inteiro(reais) + (reais === 1 ? ' real' : reais >= 1e6 && reais % 1e6 === 0 ? ' de reais' : ' reais') : '';
      if (cent) s += (s ? ' e ' : '') + inteiro(cent) + (cent === 1 ? ' centavo' : ' centavos');
      return (neg ? 'menos ' : '') + s;
    });
    /* "55,1 mil", "1,2 mi" fora de dinheiro */
    t = t.replace(/\b(\d+),(\d+)\s?(mil|mi|milhões|milhão)\b/g, function (_, a, b, esc) {
      return inteiro(valorBR(a + ',' + b) * (esc === 'mil' ? 1e3 : 1e6));
    });
    t = t.replace(/(\d)\s?mi\b/g, '$1 milhões');
    /* porcentagem e ordinais */
    t = t.replace(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s?%/g, function (_, a, b) { return decimal(String(valorBR(a)), b) + ' por cento'; });
    t = t.replace(/\b(\d{1,2})\s?([ºª°])/g, function (_, n, s) { return ordinal(+n, s === 'ª'); });
    /* "3x" → "três vezes"; "1-7" → "um a sete" */
    t = t.replace(/\b(\d+)\s?x\b/gi, function (_, n) { return inteiro(+n, true) + (+n === 1 ? ' vez' : ' vezes'); });
    t = t.replace(/\b(\d+)\s?-\s?(\d+)\b(?!\s?[A-Za-z]\b)/g, function (_, a, b) { return a + ' a ' + b; });
    /* códigos de agentes: "Tala-T95" → "Tala tê noventa e cinco" */
    t = t.replace(/\b([A-Za-z]+)-([A-Z])(\d+)\b/g, function (_, nome, l, n) { return nome + ' ' + LETRAS[l] + ' ' + inteiro(+n); });
    t = t.replace(/\b([A-Z])(\d+)\b/g, function (_, l, n) { return LETRAS[l] + ' ' + inteiro(+n); });

    /* palavras estrangeiras antes das siglas (MEGA BRAIN, KPIs) */
    /* "sites" → "sáitis": se a palavra veio no plural, a pronúncia também vai */
    PRONUNCIA.forEach(function (p) { t = t.replace(p[0], function (_, antes, palavra) { return antes + p[1] + (p[2] && /s$/i.test(palavra) && !/s$/.test(p[1]) ? 's' : ''); }); });
    /* o \b do JavaScript não conhece acentos: "ATENÇÃO" não pode virar a sigla "ATEN" */
    t = t.replace(/(^|[^A-Za-zÀ-ÿ])([A-Z]{2,6})(s?)(?![A-Za-zÀ-ÿ])/g, function (s, antes, sig, pl) {
      if (SIGLA_PALAVRA[sig]) return antes + SIGLA_PALAVRA[sig] + pl;
      if (/^[IVXLC]+$/.test(sig) && sig.length <= 4) return s;   /* números romanos ficam */
      return antes + soletrar(sig) + pl;
    });

    /* números restantes */
    t = t.replace(/(\d)\.(\d{1,2})(?!\d)/g, '$1 ponto $2');   /* versões: "3.5" */
    t = t.replace(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g, function (n, pos, todo) {
      var fem = eFeminino(todo.slice(pos + n.length)), partes = n.replace(/\./g, '').split(',');
      return decimal(partes[0], partes[1], fem);
    });

    /* símbolos restantes */
    t = t.replace(/\s*\+\s*/g, ' mais ').replace(/\s*=\s*/g, ' igual a ').replace(/\s*&\s*/g, ' e ').replace(/@/g, ' arroba ')
      .replace(/\/\s*(mês|dia|hora|ano|semana|mes)\b/gi, ' por $1').replace(/\s*\/\s*/g, ' ou ')
      .replace(/[()]/g, ', ').replace(/_/g, ' ');
    return t.replace(/\s+([,.!?;:])/g, '$1').replace(/,+\s*([.!?;:])/g, '$1').replace(/([,;:])(?=[^\s])/g, '$1 ').replace(/,(\s*,)+/g, ',').replace(/^[\s,]+/, '').replace(/\s+/g, ' ').trim();
  }

  T.Fala = { paraFala: paraFala, inteiro: inteiro, ordinal: ordinal };
})(typeof window !== 'undefined' ? window : globalThis);
