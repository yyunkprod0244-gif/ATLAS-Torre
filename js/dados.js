/* ============================================================================
   TORRE — geração dos dados (agentes, skills, avatares) e utilitários
   ----------------------------------------------------------------------------
   Nada aqui depende do navegador: o mesmo arquivo é carregado pelo servidor
   (server.mjs) para o Jarvis conseguir pesquisar agentes e skills.
   A geração é determinística: a mesma configuração produz sempre os mesmos
   agentes, com os mesmos nomes, lugares e skills.
   ========================================================================== */
(function (root) {
  'use strict';
  var T = root.Torre;

  /* ---------- números pseudoaleatórios com semente ---------- */
  function hash(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  T.hash = hash;
  T.rng = function (chave) { return mulberry(typeof chave === 'number' ? chave : hash(String(chave))); };
  T.pick = function (r, lista) { return lista[Math.floor(r() * lista.length)]; };
  T.entre = function (r, a, b) { return a + Math.floor(r() * (b - a + 1)); };

  /* ---------- texto ---------- */
  var MAPA_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  T.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return MAPA_ESC[c]; }); };
  T.normalizar = function (s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  };
  function dois(n) { return (n < 10 ? '0' : '') + n; }
  function pad(n, t) { var s = String(n); while (s.length < t) s = '0' + s; return s; }

  /* ---------- formatação pt-BR ---------- */
  var nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nfC = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  var nfR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  var nfR2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nfRC = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
  function limpa(s) { return s.replace(/ /g, ' '); }

  T.fmt = {
    dois: dois,
    pad: pad,
    int: function (n) { return nf0.format(Math.round(n)); },
    dec: function (n) { return nf1.format(n); },
    /* 1.284 · 12,9 mil · 4,2 mi */
    compacto: function (n) { return limpa(Math.abs(n) < 10000 ? nf0.format(Math.round(n)) : nfC.format(n)); },
    brl: function (n) { return limpa(nfR.format(Math.round(n))); },
    brl2: function (n) { return limpa(nfR2.format(n)); },
    brlc: function (n) { return limpa(Math.abs(n) < 10000 ? nfR.format(Math.round(n)) : nfRC.format(n)); },
    pct: function (fracao, casas) { return (fracao * 100).toFixed(casas || 0).replace('.', ',') + '%'; },
    sinal: function (fracao) {
      var v = Math.abs(fracao * 100).toFixed(1).replace('.', ',');
      return (fracao >= 0 ? '+' : '−') + v + '%';
    },
    hora: function (d) { return dois(d.getHours()) + ':' + dois(d.getMinutes()); },
    horaSeg: function (d) { return dois(d.getHours()) + ':' + dois(d.getMinutes()) + ':' + dois(d.getSeconds()); },
    dataCurta: function (d) { return dois(d.getDate()) + '/' + dois(d.getMonth() + 1); },
    dataLonga: function (d) { return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); },
    dataMedia: function (d) { return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }); },
    duracao: function (min) {
      min = Math.max(0, Math.round(min));
      if (min < 60) return min + ' min';
      var h = Math.floor(min / 60), m = min % 60;
      return h + ' h' + (m ? ' ' + m + ' min' : '');
    },
    chaveDia: function (d) { return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()); }
  };

  /* ==========================================================================
     PLANTA DO ANDAR
     Cada andar é um disco. Os agentes sentam em anéis concêntricos em volta do
     núcleo de dados; cada squad ocupa uma "fatia" do disco.
     ======================================================================== */
  var GEO = T.GEO = { RAIO: 10, R0: 2.9, PASSO: 0.68, ESPACO: 0.6, FOLGA: 0.075, MAX_ANEIS: 11 };

  T.setores = function (pesos) {
    var soma = 0, i;
    for (i = 0; i < pesos.length; i++) soma += pesos[i];
    var a = -Math.PI / 2, out = [];
    for (i = 0; i < pesos.length; i++) {
      var larg = Math.PI * 2 * pesos[i] / soma;
      out.push({ ini: a, fim: a + larg });
      a += larg;
    }
    return out;
  };

  function repartir(total, caps) {
    var soma = 0, i;
    for (i = 0; i < caps.length; i++) soma += caps[i];
    var out = caps.map(function (c) { return Math.min(c, Math.floor(total * c / soma)); });
    var falta = total - out.reduce(function (a, b) { return a + b; }, 0);
    for (i = 0; falta > 0 && i < caps.length * 50; i++) {
      var k = i % caps.length;
      if (out[k] < caps[k]) { out[k]++; falta--; }
    }
    return out;
  }

  /* Devolve "qtd" assentos: { x, z, ang, raio, squad, anel } */
  T.layout = function (qtd, pesos) {
    var set = T.setores(pesos), out = [], restante = qtd;
    for (var j = 0; j < GEO.MAX_ANEIS && restante > 0; j++) {
      var raio = GEO.R0 + j * GEO.PASSO;
      var caps = set.map(function (s) {
        return Math.max(1, Math.floor((s.fim - s.ini - GEO.FOLGA) * raio / GEO.ESPACO));
      });
      var cabem = caps.reduce(function (a, b) { return a + b; }, 0);
      var usar = cabem > restante ? repartir(restante, caps) : caps;
      for (var k = 0; k < set.length; k++) {
        var ini = set[k].ini + GEO.FOLGA / 2, fim = set[k].fim - GEO.FOLGA / 2, n = usar[k];
        for (var m = 0; m < n; m++) {
          var ang = ini + (fim - ini) * (m + 0.5) / n;
          out.push({ x: Math.cos(ang) * raio, z: Math.sin(ang) * raio, ang: ang, raio: raio, squad: k, anel: j });
        }
        restante -= n;
      }
    }
    return out;
  };

  /* ==========================================================================
     GERAÇÃO DE SKILLS E AGENTES
     ======================================================================== */
  var CODINOMES = ['Ária', 'Atlas', 'Aura', 'Axis', 'Bento', 'Brisa', 'Byte', 'Caju', 'Celeste', 'Cipher', 'Cora', 'Cosmo',
    'Dara', 'Delta', 'Duna', 'Eco', 'Elo', 'Ember', 'Faro', 'Fênix', 'Flux', 'Gaia', 'Gema', 'Glitch', 'Halo', 'Hera',
    'Hexa', 'Íris', 'Jade', 'Juno', 'Kai', 'Kira', 'Lumen', 'Luna', 'Lyra', 'Mira', 'Nexo', 'Nilo', 'Nix', 'Nova',
    'Onix', 'Orbe', 'Órion', 'Pixel', 'Polo', 'Prisma', 'Pulsar', 'Quark', 'Quasar', 'Raio', 'Rumo', 'Saga', 'Sirius',
    'Sol', 'Tala', 'Tera', 'Titã', 'Turi', 'Uno', 'Vega', 'Vetor', 'Vésper', 'Volt', 'Yara', 'Zen', 'Zênite', 'Zion',
    'Zuri', 'Âmbar', 'Bóson', 'Cometa', 'Dínamo', 'Éter', 'Farol', 'Ícaro', 'Jazz', 'Lótus', 'Maré', 'Néon', 'Ópera'];
  var LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

  function gerarSkills(andar) {
    var v = andar.vocab, r = T.rng('skills:' + andar.id), lista = [], k = 0;
    for (var a = 0; a < v.acoes.length; a++) {
      for (var o = 0; o < v.objetos.length; o++) {
        for (var c = 0; c < v.contextos.length; c++) {
          var sorte = r(), nome = v.acoes[a][0] + ' ' + v.objetos[o] + ' ' + v.contextos[c];
          lista.push({
            i: k,
            id: 'SK-' + andar.sigla + '-' + pad(k + 1, 4),
            nome: nome,
            categoria: v.acoes[a][1],
            nivel: sorte < 0.07 ? 1 : sorte < 0.25 ? 2 : sorte < 0.58 ? 3 : sorte < 0.86 ? 4 : 5,
            usos: Math.floor(r() * r() * 260) + 3,   /* usos por dia (ritmo) */
            agentes: 0,
            _busca: T.normalizar(nome + ' ' + v.acoes[a][1])
          });
          k++;
        }
      }
    }
    return lista;
  }

  function gerarAgentes(andar) {
    var r = T.rng('agentes:' + andar.id);
    var assentos = T.layout(andar.qtd, andar.squads.map(function (s) { return s.peso; }));
    var v = andar.vocab, bloco = v.objetos.length * v.contextos.length, usados = {};

    var lista = assentos.map(function (s, i) {
      var nome;
      do { nome = T.pick(r, CODINOMES) + '-' + LETRAS[Math.floor(r() * LETRAS.length)] + T.entre(r, 1, 98); } while (usados[nome]);
      usados[nome] = true;

      /* skills coerentes: o agente domina 1 ou 2 "verbos" e várias variações deles */
      var skills = [], nFocos = r() < 0.45 ? 2 : 1;
      for (var f = 0; f < nFocos; f++) {
        var acao = Math.floor(r() * v.acoes.length), quantas = T.entre(r, 3, 6);
        for (var q = 0; q < quantas; q++) {
          var idx = acao * bloco + Math.floor(r() * bloco);
          if (skills.indexOf(idx) < 0) skills.push(idx);
        }
      }

      var sorte = r(), squad = andar.squads[s.squad];
      var ag = {
        i: i,
        id: andar.sigla + '-' + pad(i + 1, 4),
        nome: nome,
        cargo: T.pick(r, squad.cargos),
        squad: s.squad,
        x: s.x, z: s.z, ang: s.ang, raio: s.raio,
        status: sorte < 0.74 ? 'trabalhando' : sorte < 0.81 ? 'reuniao' : sorte < 0.94 ? 'ocioso' : 'pausa',
        skills: skills,
        eficiencia: T.entre(r, 78, 99),
        ritmo: 30 + r() * r() * 220,       /* tarefas por dia */
        extra: 0,                          /* tarefas feitas ao vivo nesta sessão */
        movel: r() < 0.045,                /* alguns agentes circulam pelo andar */
        fase: r() * Math.PI * 2
      };
      ag._busca = T.normalizar(ag.nome + ' ' + ag.cargo + ' ' + squad.nome + ' ' + ag.id);
      return ag;
    });

    /* conta quantos agentes dominam cada skill e garante que nenhuma fique órfã */
    lista.forEach(function (ag) { ag.skills.forEach(function (k) { andar.skills[k].agentes++; }); });
    andar.skills.forEach(function (sk) {
      if (sk.agentes === 0) {
        var ag = lista[Math.floor(r() * lista.length)];
        ag.skills.push(sk.i);
        sk.agentes = 1;
      }
    });
    return lista;
  }

  T.gerar = function () {
    if (T.TOTAIS) return T.TOTAIS;
    var totAg = 0, totSk = 0;
    T.ANDARES.forEach(function (andar) {
      andar.skills = gerarSkills(andar);
      andar.agentes = gerarAgentes(andar);
      andar.categorias = andar.vocab.acoes.map(function (a) { return a[1]; })
        .filter(function (c, i, arr) { return arr.indexOf(c) === i; });
      totAg += andar.agentes.length;
      totSk += andar.skills.length;
    });
    T.TOTAIS = { agentes: totAg, skills: totSk };
    return T.TOTAIS;
  };

  T.andar = function (n) { return T.ANDARES[n - 1] || null; };

  /* ---------- busca (usada pela interface e pelo Jarvis) ---------- */
  function casa(busca, termos) {
    for (var i = 0; i < termos.length; i++) if (busca.indexOf(termos[i]) < 0) return false;
    return true;
  }
  function termosDe(texto) { return T.normalizar(texto).split(/\s+/).filter(Boolean); }

  T.buscarAgentes = function (texto, n, limite) {
    var termos = termosDe(texto), out = [];
    limite = limite || 20;
    T.ANDARES.forEach(function (a) {
      if (n && a.n !== n) return;
      for (var i = 0; i < a.agentes.length && out.length < limite; i++) {
        if (casa(a.agentes[i]._busca, termos)) out.push({ andar: a, agente: a.agentes[i] });
      }
    });
    return out;
  };

  T.buscarSkills = function (texto, n, limite) {
    var termos = termosDe(texto), out = [];
    limite = limite || 20;
    T.ANDARES.forEach(function (a) {
      if (n && a.n !== n) return;
      for (var i = 0; i < a.skills.length && out.length < limite; i++) {
        if (casa(a.skills[i]._busca, termos)) out.push({ andar: a, skill: a.skills[i] });
      }
    });
    return out;
  };

  T.contarSkills = function (texto, n) {
    var termos = termosDe(texto), total = 0;
    T.ANDARES.forEach(function (a) {
      if (n && a.n !== n) return;
      for (var i = 0; i < a.skills.length; i++) if (casa(a.skills[i]._busca, termos)) total++;
    });
    return total;
  };

  /* ==========================================================================
     IMAGENS FICTÍCIAS (desenhadas em SVG a partir de uma semente)
     ======================================================================== */
  /* Rosto de robô para cada agente. */
  T.avatar = function (semente, cor) {
    var r = T.rng('av:' + semente);
    var forma = Math.floor(r() * 3), olhos = Math.floor(r() * 4), antena = Math.floor(r() * 3), boca = Math.floor(r() * 3);
    var e = '#0d111c';
    var s = '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
      '<rect width="48" height="48" rx="12" fill="#131827"/>' +
      '<rect width="48" height="48" rx="12" fill="' + cor + '" opacity=".18"/>';
    if (antena === 1) s += '<path d="M24 9.5v5" stroke="' + cor + '" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="8" r="2.2" fill="' + cor + '"/>';
    if (antena === 2) s += '<path d="M17.5 9.5l2.6 5.2M30.5 9.5l-2.6 5.2" stroke="' + cor + '" stroke-width="2" stroke-linecap="round"/>';
    if (forma === 0) s += '<rect x="11" y="15" width="26" height="22" rx="7" fill="' + cor + '"/>';
    else if (forma === 1) s += '<circle cx="24" cy="26.5" r="12.5" fill="' + cor + '"/>';
    else s += '<path d="M24 13.5l11 6.2v13L24 39l-11-6.3v-13z" fill="' + cor + '"/>';
    if (olhos === 0) s += '<circle cx="19" cy="25" r="2.5" fill="' + e + '"/><circle cx="29" cy="25" r="2.5" fill="' + e + '"/>';
    else if (olhos === 1) s += '<rect x="15.5" y="22.5" width="17" height="5.2" rx="2.6" fill="' + e + '"/>';
    else if (olhos === 2) s += '<rect x="16.5" y="21.8" width="4.2" height="6.4" rx="1.6" fill="' + e + '"/><rect x="27.3" y="21.8" width="4.2" height="6.4" rx="1.6" fill="' + e + '"/>';
    else s += '<path d="M16.4 26.2a2.7 2.7 0 0 1 5.2 0M26.4 26.2a2.7 2.7 0 0 1 5.2 0" stroke="' + e + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
    if (boca === 0) s += '<path d="M20.5 32h7" stroke="' + e + '" stroke-width="1.8" stroke-linecap="round"/>';
    else if (boca === 1) s += '<path d="M20 31.2q4 3 8 0" stroke="' + e + '" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    return s + '</svg>';
  };

  /* Miniatura fictícia de vídeo / post (um "site" abstrato com botão de play). */
  T.thumb = function (semente, cor, play) {
    var r = T.rng('th:' + semente), v = Math.floor(r() * 3);
    var s = '<svg viewBox="0 0 64 36" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">' +
      '<rect width="64" height="36" fill="#131827"/>' +
      '<rect width="64" height="36" fill="' + cor + '" opacity="' + (0.22 + r() * 0.2).toFixed(2) + '"/>';
    if (v === 0) {
      s += '<rect x="5" y="5" width="22" height="3" rx="1.5" fill="#eef1f6" opacity=".85"/>' +
        '<rect x="5" y="11" width="30" height="2" rx="1" fill="#eef1f6" opacity=".4"/>' +
        '<rect x="5" y="15" width="24" height="2" rx="1" fill="#eef1f6" opacity=".4"/>' +
        '<rect x="5" y="22" width="13" height="5" rx="2.5" fill="' + cor + '"/>' +
        '<rect x="40" y="6" width="19" height="24" rx="3" fill="#0d111c" opacity=".55"/>';
    } else if (v === 1) {
      s += '<rect x="4" y="4" width="56" height="5" rx="2" fill="#0d111c" opacity=".55"/>' +
        '<rect x="4" y="13" width="17" height="19" rx="2" fill="#0d111c" opacity=".45"/>' +
        '<rect x="23.5" y="13" width="17" height="19" rx="2" fill="#0d111c" opacity=".45"/>' +
        '<rect x="43" y="13" width="17" height="19" rx="2" fill="#0d111c" opacity=".45"/>' +
        '<rect x="6" y="26" width="9" height="3" rx="1.5" fill="' + cor + '"/>';
    } else {
      s += '<circle cx="' + (14 + r() * 10).toFixed(1) + '" cy="15" r="9" fill="' + cor + '" opacity=".75"/>' +
        '<rect x="30" y="8" width="26" height="3.2" rx="1.6" fill="#eef1f6" opacity=".85"/>' +
        '<rect x="30" y="14" width="20" height="2" rx="1" fill="#eef1f6" opacity=".4"/>' +
        '<rect x="30" y="18" width="23" height="2" rx="1" fill="#eef1f6" opacity=".4"/>' +
        '<rect x="5" y="29" width="54" height="2" rx="1" fill="#0d111c" opacity=".6"/>';
    }
    if (play !== false) s += '<circle cx="32" cy="18" r="7" fill="#05070d" opacity=".72"/><path d="M30 14.4v7.2l6-3.6z" fill="#eef1f6"/>';
    return s + '</svg>';
  };
})(typeof window !== 'undefined' ? window : globalThis);
