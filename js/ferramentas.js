/* ============================================================================
   TORRE — ferramentas: lembretes e calculadora
   ----------------------------------------------------------------------------
   Lembretes: o que você pede para ser lembrado, com dia e hora. Ficam salvos
   neste navegador e tocam enquanto a torre, o dashboard ou o Jarvis
   holográfico estiverem abertos (em qualquer aba).

   Calculadora: entende contas escritas do jeito brasileiro ("1.490,50"),
   por extenso ("1490 vezes 3", "20% de 3000") e porcentagens de calculadora
   ("1490 - 10%" = 1.341). Não usa eval: a conta é lida por um analisador
   próprio, que só aceita números e operadores.
   Nada aqui depende da torre: o mesmo arquivo serve às três páginas.
   ========================================================================== */
(function (root) {
  'use strict';
  var T = (root.Torre = root.Torre || {});

  function ler(chave, padrao) {
    try { var v = root.localStorage && root.localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; }
  }
  function gravar(chave, valor) {
    try { if (root.localStorage) root.localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* armazenamento indisponível: segue sem salvar */ }
  }

  /* ==========================================================================
     LEMBRETES
     Cada lembrete: { id, texto, quando (ISO), feito, avisado }
     ======================================================================== */
  var CHAVE = 'torre.lembretes', ouvintes = [];
  function todos() {
    var l = ler(CHAVE, []);
    return (Array.isArray(l) ? l : []).filter(function (x) { return x && x.id && x.texto && !isNaN(new Date(x.quando)); });
  }
  function avisar() { ouvintes.forEach(function (fn) { try { fn(); } catch (e) { if (root.console) console.error('[lembretes]', e); } }); }
  function salvar(lista) { gravar(CHAVE, lista.slice(-300)); avisar(); }
  function ordenar(lista) { return lista.sort(function (a, b) { return new Date(a.quando) - new Date(b.quando); }); }
  /* outra aba mudou os lembretes: atualiza esta também */
  if (root.addEventListener) root.addEventListener('storage', function (e) { if (e.key === CHAVE) avisar(); });

  T.Lembretes = {
    listar: function () { return ordenar(todos()); },
    pendentes: function () { return ordenar(todos().filter(function (x) { return !x.feito; })); },
    /* os que já passaram da hora e ainda não foram concluídos */
    atrasados: function (agora) { agora = agora || new Date(); return this.pendentes().filter(function (x) { return new Date(x.quando) <= agora; }); },
    criar: function (texto, quando) {
      texto = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 160);
      var d = quando instanceof Date ? quando : new Date(quando);
      if (!texto) return { erro: 'Escreva o que devo lembrar.' };
      if (isNaN(d)) return { erro: 'Não entendi a data e a hora do lembrete.' };
      if (d < new Date(Date.now() - 60000)) return { erro: 'Esse horário já passou. Escolha outro.' };
      var l = { id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), texto: texto.charAt(0).toUpperCase() + texto.slice(1), quando: d.toISOString(), feito: false, avisado: false };
      var lista = todos(); lista.push(l); salvar(lista);
      return { lembrete: l };
    },
    concluir: function (id, sim) {
      var lista = todos(), achou = false;
      lista.forEach(function (x) { if (x.id === id) { x.feito = sim !== false; x.avisado = true; achou = true; } });
      if (achou) salvar(lista);
      return achou;
    },
    remover: function (id) {
      var lista = todos(), nova = lista.filter(function (x) { return x.id !== id; });
      if (nova.length !== lista.length) { salvar(nova); return true; }
      return false;
    },
    /* Devolve os lembretes que acabaram de vencer e os marca como avisados.
       Cada página aberta chama isto de tempos em tempos. */
    verificar: function (agora) {
      agora = agora || new Date();
      var lista = todos(), venceu = [];
      lista.forEach(function (x) { if (!x.feito && !x.avisado && new Date(x.quando) <= agora) { x.avisado = true; venceu.push(x); } });
      if (venceu.length) salvar(lista);
      return venceu;
    },
    aoMudar: function (fn) { ouvintes.push(fn); }
  };

  /* Confere os lembretes a cada 15 segundos e chama aoTocar(lembrete) para cada um que
     chegou na hora. Se a aba estiver em segundo plano e houver permissão, mostra também
     uma notificação do sistema. Usado pela torre, pelo dashboard e pelo Jarvis holográfico. */
  T.vigiarLembretes = function (aoTocar) {
    function conferir() {
      T.Lembretes.verificar().forEach(function (l) {
        try { aoTocar(l); } catch (e) { if (root.console) console.error('[lembretes]', e); }
        try {
          if (root.document && root.document.hidden && 'Notification' in root && root.Notification.permission === 'granted') new root.Notification('Lembrete', { body: l.texto, tag: l.id });
        } catch (e) { /* notificações indisponíveis: o aviso na tela já basta */ }
      });
    }
    conferir();
    return setInterval(conferir, 15000);
  };

  /* ==========================================================================
     CALCULADORA
     ======================================================================== */
  /* "1.490,50" → 1490.5 · "1.490" → 1490 · "1.5" → 1.5 */
  function numeroBR(s) {
    if (s.indexOf(',') >= 0) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, ''));
    return parseFloat(s);
  }
  /* Traduz palavras e símbolos para operadores. Devolve a conta pronta ou null. */
  function preparar(expr) {
    var s = (T.normalizar ? T.normalizar(expr) : String(expr || '').toLowerCase())
      .replace(/r\$\s*/g, '').replace(/\breais?\b/g, '').replace(/\?/g, '')
      .replace(/\bpor cento\b/g, '%').replace(/\bporcento\b/g, '%')
      .replace(/(\d)\s*x\s*(?=[\d(])/g, '$1 * ').replace(/\bvezes\b/g, '*').replace(/×/g, '*').replace(/[−–]/g, '-')
      .replace(/\b(dividido|divididos) por\b/g, '/').replace(/÷/g, '/').replace(/\bmais\b/g, '+').replace(/\bmenos\b/g, '-')
      .replace(/\belevado a\b/g, '^').replace(/\bao quadrado\b/g, '^2')
      /* "20% de 3000" → "(20%) * 3000" */
      .replace(/(\d[\d.,]*)\s*%\s*de\s*/g, '($1%) * ')
      .replace(/\s+/g, ' ').trim();
    return /^[\d\s.,+\-*/^%()]+$/.test(s) && /\d/.test(s) ? s : null;
  }
  function analisar(s) {
    var i = 0;
    function espacos() { while (s[i] === ' ') i++; }
    function erro(m) { throw new Error(m); }
    function primario() {
      espacos();
      if (s[i] === '(') { i++; var v = soma(); espacos(); if (s[i] !== ')') erro('Faltou fechar um parêntese.'); i++; return v; }
      var m = /^\d[\d.,]*/.exec(s.slice(i));
      if (!m) erro('Não entendi a conta.');
      i += m[0].length;
      var n = numeroBR(m[0]);
      if (isNaN(n)) erro('Não entendi o número "' + m[0] + '".');
      return { v: n, pct: false };
    }
    function posfixo() { var p = primario(); espacos(); if (s[i] === '%') { i++; return { v: p.v / 100, pct: true }; } return p; }
    function unario() { espacos(); if (s[i] === '-') { i++; var u = unario(); return { v: -u.v, pct: u.pct }; } if (s[i] === '+') { i++; return unario(); } return posfixo(); }
    function potencia() { var b = unario(); espacos(); if (s[i] === '^') { i++; var e = potencia(); return { v: Math.pow(b.v, e.v), pct: false }; } return b; }
    function produto() {
      var a = potencia();
      for (;;) {
        espacos(); var op = s[i];
        if (op !== '*' && op !== '/') return a;
        i++; var b = potencia();
        if (op === '/' && b.v === 0) erro('Não dá para dividir por zero.');
        a = { v: op === '*' ? a.v * b.v : a.v / b.v, pct: false };
      }
    }
    function soma() {
      var a = produto();
      for (;;) {
        espacos(); var op = s[i];
        if (op !== '+' && op !== '-') return a;
        i++; var b = produto();
        /* como nas calculadoras: 1490 - 10% = 1490 - 149 */
        var parcela = b.pct ? a.v * b.v : b.v;
        a = { v: op === '+' ? a.v + parcela : a.v - parcela, pct: false };
      }
    }
    var r = soma(); espacos();
    if (i < s.length) erro('Não entendi a conta a partir de "' + s.slice(i) + '".');
    if (!isFinite(r.v)) erro('O resultado é grande demais.');
    return r.v;
  }
  var nf = typeof Intl !== 'undefined' ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }) : null;
  T.Calc = {
    /* devolve { valor, texto, conta } ou { erro } */
    avaliar: function (expr) {
      var s = preparar(expr);
      if (!s) return { erro: 'Não entendi a conta. Use números e + − × ÷ %.' };
      try {
        var v = analisar(s), arred = Math.round(v * 1e8) / 1e8;
        return { valor: arred, texto: nf ? nf.format(arred).replace(/ /g, ' ') : String(arred), conta: s };
      } catch (e) { return { erro: e.message }; }
    },
    /* a frase parece uma conta? (para o Jarvis decidir se calcula) */
    pareceConta: function (expr) { var s = preparar(expr); return !!s && /[+\-*/^%]/.test(s.replace(/^\s*-/, '')); }
  };

  /* ==========================================================================
     3D: etapa de limpeza antes do brilho (bloom)
     Um único pixel inválido (NaN ou infinito) vira um retângulo preto enorme
     depois que o brilho desfoca a imagem em várias escalas. Isso acontece
     sobretudo em placas AMD. Esta etapa zera esses pixels antes do brilho.
     ======================================================================== */
  T.passoLimpo = function (L) {
    if (!L || !L.ShaderPass) return null;
    return new L.ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      /* isnan() é apagado pelo compilador do Direct3D ("value cannot be NaN"); olhar os bits não é:
         expoente todo em 1 = NaN ou infinito */
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv;' +
        ' bool ruim(float x){ return (floatBitsToUint(x) & 0x7F800000u) == 0x7F800000u; }' +
        ' void main(){ vec4 c = texture2D(tDiffuse, vUv);' +
        ' if (ruim(c.r) || ruim(c.g) || ruim(c.b) || ruim(c.a)) c = vec4(0.0); gl_FragColor = clamp(c, 0.0, 256.0); }'
    });
  };
  /* se o driver da placa de vídeo reiniciar, o navegador derruba o 3D: avisa e deixa voltar sozinho */
  T.vigiarContexto = function (canvas, aoPerder, aoVoltar) {
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); if (aoPerder) aoPerder(); });
    canvas.addEventListener('webglcontextrestored', function () { if (aoVoltar) aoVoltar(); });
  };
})(typeof window !== 'undefined' ? window : globalThis);
