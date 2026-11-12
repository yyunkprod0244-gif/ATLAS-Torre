/* ============================================================================
   TORRE — cena 3D (Three.js)
   ----------------------------------------------------------------------------
   Desenha a torre, andar por andar: as salas de cada squad (paredes de vidro,
   porta, telão e uma estação de trabalho por agente — mesa, computador e
   cadeira —, além da área de convivência mobiliada sozinha), os agentes (um
   boneco por agente, desenhados em lote para ficar leve), o núcleo de dados
   que liga tudo ao Mega Brain, a estante de livros do andar de estudo e os
   pacotes de informação que viajam entre os andares.

   Três níveis de zoom:  torre inteira → andar → sala (ou livro).

   Este arquivo só desenha. Quem decide o que acontece é js/sim.js; quem liga
   os dois é js/app.js.
   ========================================================================== */
(function (root) {
  'use strict';
  var T = root.Torre;

  /* Usada quando o 3D não pode ser criado (sem WebGL ou sem o motor 3D):
     a interface continua funcionando, só sem a torre. */
  T.cenaVazia = function () {
    var f = function () {};
    return {
      vazia: true, irPara: f, irParaSala: f, focarAgente: f, focarLivro: f, limparFoco: f, pacote: f, pulsoAgente: f, difundir: f, statusAgente: f,
      margemDireita: f, qualidade: f, reuniaoAtiva: f, orcamento: f, entrar: f, andarAtual: function () { return 0; }, salaAtual: function () { return -1; }
    };
  };

  T.criarCena = function (L, canvas, cb) {
    cb = cb || {};
    var THREE = L.THREE, GEO = T.GEO, ANDARES = T.ANDARES, N = ANDARES.length;
    var R = GEO.RAIO, H = 3.2, LIFT = 13, BASE = 0.7, PISO = 0.22;
    /* salas: raio da parede do átrio, altura das divisórias, largura da porta e altura do assento das cadeiras */
    var R_SALA = GEO.R_SALA, ALT_PAREDE = 1.45, PORTA = 0.84, ASSENTO = 0.09;
    function indiceDe(id, padrao) { for (var i = 0; i < N; i++) if (ANDARES[i].id === id) return i; return padrao; }
    /* andares com papel especial, encontrados pelo id (a ordem dos andares pode mudar) */
    var IB = indiceDe('cerebro', N - 1), IR = indiceDe('reunioes', -1), IF = indiceDe('financeiro', -1), IE = indiceDe('estudo', -1);
    var TOPO = BASE + N * H;
    var FUNDO = 0x05070d;
    var calmo = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /* ---------- renderizador, cena, câmera ---------- */
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    if (T.vigiarContexto) T.vigiarContexto(canvas);   /* deixa o 3D voltar sozinho se o driver reiniciar */
    var aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(FUNDO);
    scene.fog = new THREE.FogExp2(FUNDO, 0.0072);

    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 900);
    var controls = new L.OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.07;
    controls.minDistance = 6; controls.maxDistance = 125;
    controls.maxPolarAngle = Math.PI * 0.497;
    controls.enablePan = false;
    controls.autoRotate = !calmo; controls.autoRotateSpeed = 0.35;

    scene.add(new THREE.HemisphereLight(0x9bbcff, 0x05070d, 1.1));
    var sol = new THREE.DirectionalLight(0xffffff, 1.3); sol.position.set(24, 46, 18); scene.add(sol);

    /* ---------- pós-processamento (brilho) ---------- */
    var alvoRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    var composer = new L.EffectComposer(renderer, alvoRT);
    composer.addPass(new L.RenderPass(scene, camera));
    if (T.passoLimpo) { var limpo = T.passoLimpo(L); if (limpo) composer.addPass(limpo); }
    var bloom = new L.UnrealBloomPass(new THREE.Vector2(4, 4), 0.6, 0.6, 0.22);
    composer.addPass(bloom);
    composer.addPass(new L.OutputPass());
    var modo = 'alta';

    var dummy = new THREE.Object3D(), d2 = new THREE.Object3D(), corTmp = new THREE.Color(), BRANCO = new THREE.Color(1, 1, 1);
    function hdr(hex, k) { return new THREE.Color(hex).multiplyScalar(k); }
    function texturaDe(c) { var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; }
    function aditivo(o) { o.transparent = true; o.depthWrite = false; o.blending = THREE.AdditiveBlending; return o; }

    /* ==========================================================================
       FERRAMENTAS DE MODELAGEM
       "Malha" junta planos sem iluminação (vidros, frisos de luz, destaques).
       caixa/cilindro/esfera criam peças iluminadas, com cor por vértice, que
       depois são fundidas em uma malha só (móveis).
       Convenção de ângulos em todo o arquivo: x = cos(ang)·raio, z = sin(ang)·raio.
       ======================================================================== */
    function Malha() { this.p = []; }
    Malha.prototype.quad = function (a, b, c, d) {
      this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    };
    Malha.prototype.geo = function () {
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      return g;
    };
    function pol(raio, ang, y) { return [Math.cos(ang) * raio, y, Math.sin(ang) * raio]; }
    function paredeRadial(m, ang, r0, r1, y0, y1) { m.quad(pol(r0, ang, y0), pol(r1, ang, y0), pol(r1, ang, y1), pol(r0, ang, y1)); }
    function paredeArco(m, raio, a0, a1, y0, y1) {
      var n = Math.max(1, Math.ceil((a1 - a0) / 0.08));
      for (var i = 0; i < n; i++) { var u0 = a0 + (a1 - a0) * i / n, u1 = a0 + (a1 - a0) * (i + 1) / n; m.quad(pol(raio, u0, y0), pol(raio, u1, y0), pol(raio, u1, y1), pol(raio, u0, y1)); }
    }
    function faixaChao(m, r0, r1, a0, a1, y) {
      var n = Math.max(1, Math.ceil((a1 - a0) / 0.08));
      for (var i = 0; i < n; i++) { var u0 = a0 + (a1 - a0) * i / n, u1 = a0 + (a1 - a0) * (i + 1) / n; m.quad(pol(r0, u0, y), pol(r1, u0, y), pol(r1, u1, y), pol(r0, u1, y)); }
    }
    /* frisos de luz: duas fitas cruzadas, para aparecerem de qualquer ângulo */
    var FRISO = 0.018;
    function frisoRadial(m, ang, r0, r1, y) {
      var nx = -Math.sin(ang) * FRISO, nz = Math.cos(ang) * FRISO, a = pol(r0, ang, y), b = pol(r1, ang, y);
      m.quad([a[0], y - FRISO, a[2]], [b[0], y - FRISO, b[2]], [b[0], y + FRISO, b[2]], [a[0], y + FRISO, a[2]]);
      m.quad([a[0] - nx, y, a[2] - nz], [b[0] - nx, y, b[2] - nz], [b[0] + nx, y, b[2] + nz], [a[0] + nx, y, a[2] + nz]);
    }
    function frisoArco(m, raio, a0, a1, y) { paredeArco(m, raio, a0, a1, y - FRISO, y + FRISO); faixaChao(m, raio - FRISO, raio + FRISO, a0, a1, y); }
    function frisoVertical(m, raio, ang, y0, y1) {
      var p = pol(raio, ang, 0), tx = -Math.sin(ang) * FRISO, tz = Math.cos(ang) * FRISO, rx = Math.cos(ang) * FRISO, rz = Math.sin(ang) * FRISO;
      m.quad([p[0] - tx, y0, p[2] - tz], [p[0] + tx, y0, p[2] + tz], [p[0] + tx, y1, p[2] + tz], [p[0] - tx, y1, p[2] - tz]);
      m.quad([p[0] - rx, y0, p[2] - rz], [p[0] + rx, y0, p[2] + rz], [p[0] + rx, y1, p[2] + rz], [p[0] - rx, y1, p[2] - rz]);
    }

    function pronta(g, cor) {
      g = g.toNonIndexed(); g.deleteAttribute('uv');
      var n = g.attributes.position.count, c = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) { c[i * 3] = cor.r; c[i * 3 + 1] = cor.g; c[i * 3 + 2] = cor.b; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      return g;
    }
    function caixa(lista, w, h, d, x, y, z, cor) { var g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); lista.push(pronta(g, cor)); }
    function cilindro(lista, r1, r2, h, x, y, z, cor, seg) { var g = new THREE.CylinderGeometry(r1, r2, h, seg || 12); g.translate(x, y, z); lista.push(pronta(g, cor)); }
    function esfera(lista, r, x, y, z, cor, ey) { var g = new THREE.SphereGeometry(r, 10, 7); if (ey) g.scale(1, ey, 1); g.translate(x, y, z); lista.push(pronta(g, cor)); }
    /* Leva peças modeladas "de frente" (o +Z local aponta para a fachada) até o ponto (raio, ang) do andar. */
    var mTmp = new THREE.Matrix4();
    function colocar(destino, pecas, raio, ang) {
      mTmp.makeRotationY(Math.PI / 2 - ang).setPosition(Math.cos(ang) * raio, PISO, Math.sin(ang) * raio);
      for (var i = 0; i < pecas.length; i++) { pecas[i].applyMatrix4(mTmp); destino.push(pecas[i]); }
    }

    /* ==========================================================================
       AMBIENTE: chão, cidade ao fundo, estrelas
       ======================================================================== */
    var chao = new THREE.Mesh(new THREE.CircleGeometry(175, 96), new THREE.ShaderMaterial({
      uniforms: { uCor: { value: new THREE.Color(0x3f74c4) }, uFundo: { value: new THREE.Color(FUNDO) } },
      vertexShader: 'varying vec2 vXZ; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vXZ = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: [
        'uniform vec3 uCor; uniform vec3 uFundo; varying vec2 vXZ;',
        'void main(){',
        '  float r = length(vXZ);',
        '  float g1 = r / 4.0;',
        /* fwidth pode ser zero e atan(0, 0) é indefinido: os dois geram NaN, que o brilho espalha em blocos pretos */
        '  float anel = 1.0 - min(abs(fract(g1 - 0.5) - 0.5) / max(fwidth(g1), 1e-5), 1.0);',
        '  float g2 = atan(vXZ.y, abs(vXZ.x) + abs(vXZ.y) > 1e-4 ? vXZ.x : 1.0) / 0.2617994;',
        '  float fw2 = max(fwidth(g2), 1e-5);',
        '  float raio = r > 13.0 ? 1.0 - min(abs(fract(g2 - 0.5) - 0.5) / fw2, 1.0) : 0.0;',
        '  float some = smoothstep(150.0, 14.0, r);',
        '  vec3 c = uFundo + uCor * (max(anel, raio) * 0.20 * some + exp(-r * 0.05) * 0.30);',
        '  gl_FragColor = vec4(c, 1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}'].join('\n')
    }));
    chao.rotation.x = -Math.PI / 2;
    scene.add(chao);

    var podio = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.6, R + 2.6, BASE, 72), new THREE.MeshStandardMaterial({ color: 0x0a0f1c, metalness: 0.7, roughness: 0.4 }));
    podio.position.y = BASE / 2; scene.add(podio);
    var aroPodio = new THREE.Mesh(new THREE.TorusGeometry(R + 1.6, 0.04, 8, 120), new THREE.MeshBasicMaterial({ color: hdr(0x9fd0ff, 1.4) }));
    aroPodio.rotation.x = Math.PI / 2; aroPodio.position.y = BASE; scene.add(aroPodio);

    (function cidade() {
      var r = T.rng('cidade'), n = 380, geo = new THREE.BoxGeometry(1, 1, 1);
      geo.translate(0, 0.5, 0);
      var predios = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
      var luzes = [], v = new THREE.Vector3(), c1 = new THREE.Color(0x090e1b), c2 = new THREE.Color(0x15203a);
      for (var i = 0; i < n; i++) {
        var ang = r() * Math.PI * 2, dist = 60 + r() * r() * 92 + r() * 14;
        dummy.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
        dummy.rotation.set(0, r() * Math.PI, 0);
        dummy.scale.set(2.6 + r() * 5.5, 2 + r() * r() * (dist > 90 ? 36 : 22), 2.6 + r() * 5.5);
        dummy.updateMatrix();
        predios.setMatrixAt(i, dummy.matrix);
        predios.setColorAt(i, corTmp.copy(c1).lerp(c2, r()));
        for (var k = 0; k < 6; k++) {
          var lado = r() < 0.5;
          v.set(lado ? (r() < 0.5 ? -0.51 : 0.51) : r() - 0.5, 0.12 + r() * 0.84, lado ? r() - 0.5 : (r() < 0.5 ? -0.51 : 0.51)).applyMatrix4(dummy.matrix);
          luzes.push(v.x, v.y, v.z);
        }
      }
      predios.instanceColor.needsUpdate = true;
      scene.add(predios);
      var gl = new THREE.BufferGeometry();
      gl.setAttribute('position', new THREE.Float32BufferAttribute(luzes, 3));
      scene.add(new THREE.Points(gl, new THREE.PointsMaterial({ color: 0xa9c9ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false })));
      dummy.rotation.set(0, 0, 0);
    })();

    (function estrelas() {
      var r = T.rng('estrelas'), pos = [];
      for (var i = 0; i < 900; i++) {
        var a = r() * Math.PI * 2, e = 0.06 + r() * 1.45;
        pos.push(Math.cos(a) * Math.cos(e) * 430, Math.sin(e) * 430, Math.sin(a) * Math.cos(e) * 430);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.7, fog: false, depthWrite: false })));
    })();

    /* ==========================================================================
       NÚCLEO DE DADOS (a coluna central que liga os andares ao Mega Brain)
       ======================================================================== */
    var altNucleo = TOPO + LIFT + 70;
    var geoNucleo = new THREE.CylinderGeometry(0.62, 0.62, altNucleo, 28, 1, true);
    geoNucleo.translate(0, altNucleo / 2, 0);
    var matNucleo = new THREE.ShaderMaterial(aditivo({
      side: THREE.DoubleSide,
      uniforms: { uTempo: { value: 0 }, uCor: { value: hdr(0xbfe6ff, 1.1) }, uTopo: { value: TOPO } },
      vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform float uTempo; uniform vec3 uCor; uniform float uTopo; varying float vY;',
        'void main(){',
        '  float faixas = smoothstep(0.72, 1.0, sin(vY * 2.4 - uTempo * 5.5) * 0.5 + 0.5);',
        '  float onda = smoothstep(0.90, 1.0, sin(vY * 0.5 - uTempo * 2.0) * 0.5 + 0.5);',
        '  float some = 1.0 - smoothstep(uTopo, uTopo + 46.0, vY);',
        '  float a = (0.07 + 0.16 * faixas + 0.30 * onda) * some;',
        '  gl_FragColor = vec4(uCor, a);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}'].join('\n')
    }));
    var nucleo = new THREE.Mesh(geoNucleo, matNucleo);
    nucleo.position.y = BASE; scene.add(nucleo);

    /* ==========================================================================
       TEXTURAS DESENHADAS (planta do andar, telas de vídeo, placas das redes)
       ======================================================================== */
    /* planta do andar: o tapete de cada sala, as fileiras de mesas, o corredor com o nome e as paredes */
    function texturaPiso(def) {
      var c = document.createElement('canvas'); c.width = c.height = 1024;
      var x = c.getContext('2d'), e = 512 / R, i, set = def.setores, meiaLarg = GEO.CORREDOR / 2, porta = PORTA / 2 / R_SALA;
      var fileiras = Math.round((def.agentes.reduce(function (m, ag) { return Math.max(m, ag.raio); }, GEO.R0) - GEO.R0) / GEO.PASSO) + 1;
      x.translate(512, 512);
      x.strokeStyle = def.cor; x.fillStyle = def.cor;
      set.forEach(function (s, k) {
        x.globalAlpha = k % 2 ? 0.02 : 0.038;                                   /* tapete da sala */
        x.beginPath(); x.arc(0, 0, 9.0 * e, s.ini, s.fim); x.arc(0, 0, R_SALA * e, s.fim, s.ini, true); x.closePath(); x.fill();
        x.globalAlpha = 0.06;                                                   /* área de convivência, junto à fachada */
        x.beginPath(); x.arc(0, 0, 9.93 * e, s.ini + 0.012, s.fim - 0.012); x.arc(0, 0, 9.0 * e, s.fim - 0.012, s.ini + 0.012, true); x.closePath(); x.fill();
        x.lineWidth = 1.2; x.globalAlpha = 0.16;                                /* fileiras de mesas */
        for (i = 0; i < fileiras; i++) {
          var raio = GEO.R0 + i * GEO.PASSO - 0.27, vao = (meiaLarg + 0.04) / raio;
          if (s.meio - vao > s.ini + GEO.FOLGA / 2) {
            x.beginPath(); x.arc(0, 0, raio * e, s.ini + GEO.FOLGA / 2, s.meio - vao); x.stroke();
            x.beginPath(); x.arc(0, 0, raio * e, s.meio + vao, s.fim - GEO.FOLGA / 2); x.stroke();
          }
        }
        x.save(); x.rotate(s.meio);                                             /* corredor, com o nome da sala no chão */
        x.globalAlpha = 0.05; x.fillRect(R_SALA * e, -meiaLarg * e, (9.0 - R_SALA) * e, meiaLarg * 2 * e);
        x.globalAlpha = 0.72; x.font = '600 18px system-ui, "Segoe UI", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.translate(6.1 * e, 0);
        if (Math.cos(s.meio) < 0) x.rotate(Math.PI);
        x.fillText(def.squads[k].nome.toUpperCase(), 0, 1);
        x.restore();
        x.globalAlpha = 0.6; x.lineWidth = 2.5;                                 /* parede entre as salas */
        x.beginPath(); x.moveTo(Math.cos(s.ini) * R_SALA * e, Math.sin(s.ini) * R_SALA * e); x.lineTo(Math.cos(s.ini) * 9.93 * e, Math.sin(s.ini) * 9.93 * e); x.stroke();
        x.globalAlpha = 0.85; x.lineWidth = 3;                                  /* parede do átrio, com a porta no meio */
        x.beginPath(); x.arc(0, 0, R_SALA * e, s.ini, s.meio - porta); x.stroke();
        x.beginPath(); x.arc(0, 0, R_SALA * e, s.meio + porta, s.fim); x.stroke();
      });
      x.globalAlpha = 0.5; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 9.93 * e, 0, Math.PI * 2); x.stroke();
      return texturaDe(c);
    }

    /* o que aparece nos monitores das mesas (a cor do andar entra depois, por agente) */
    function texturaMonitor() {
      var c = document.createElement('canvas'); c.width = 64; c.height = 40;
      var x = c.getContext('2d');
      x.fillStyle = '#2b3038'; x.fillRect(0, 0, 64, 40);
      x.fillStyle = '#ffffff'; x.fillRect(5, 5, 26, 4); x.fillRect(5, 13, 40, 2); x.fillRect(5, 18, 32, 2); x.fillRect(5, 23, 36, 2); x.fillRect(5, 30, 14, 5);
      x.fillStyle = '#c9d2de'; x.fillRect(46, 12, 13, 13);
      return texturaDe(c);
    }

    /* telões das salas de um andar, todos na mesma imagem (3 por linha) */
    function texturaTeloes(def) {
      var cols = 3, lin = Math.ceil(def.squads.length / cols), cw = 384, ch = 192;
      var c = document.createElement('canvas'); c.width = cols * cw; c.height = lin * ch;
      var x = c.getContext('2d');
      def.squads.forEach(function (s, k) {
        var ox = (k % cols) * cw, oy = Math.floor(k / cols) * ch, r = T.rng('telao:' + def.id + ':' + k), nome = s.nome.toUpperCase(), tam = 42, i;
        var g = x.createLinearGradient(ox, oy, ox + cw, oy + ch); g.addColorStop(0, '#0b1020'); g.addColorStop(1, '#151d33');
        x.fillStyle = g; x.fillRect(ox, oy, cw, ch);
        x.strokeStyle = def.cor; x.lineWidth = 4; x.strokeRect(ox + 4, oy + 4, cw - 8, ch - 8);
        x.fillStyle = def.cor; x.fillRect(ox + 20, oy + 22, 44, 5);
        x.textAlign = 'left'; x.textBaseline = 'alphabetic';
        x.fillStyle = 'rgba(238,241,246,.66)'; x.font = '500 15px "JetBrains Mono", ui-monospace, Consolas, monospace';
        x.fillText('SALA ' + def.n + '.' + (k + 1) + '  ·  ' + (s.qtd || 0) + ' AGENTES', ox + 20, oy + 54);
        x.fillStyle = '#eef1f6';
        do { tam -= 2; x.font = '700 ' + tam + 'px Sora, system-ui, "Segoe UI", sans-serif'; } while (x.measureText(nome).width > cw - 40 && tam > 16);
        x.fillText(nome, ox + 20, oy + 102);
        for (i = 0; i < 16; i++) {                                              /* barras decorativas: não representam dados */
          var h = 10 + r() * 44;
          x.globalAlpha = 0.3 + 0.7 * (i / 15); x.fillStyle = def.cor; x.fillRect(ox + 20 + i * 21.6, oy + ch - 20 - h, 14, h);
        }
        x.globalAlpha = 1;
      });
      return { tex: texturaDe(c), cols: cols, lin: lin };
    }

    /* capa de um livro da biblioteca */
    function texturaCapa(b, corHex, nomeSala) {
      var c = document.createElement('canvas'); c.width = 256; c.height = 352;
      var x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 256, 352), linhas = [], atual = '';
      g.addColorStop(0, corHex); g.addColorStop(1, '#0b1020');
      x.fillStyle = '#0b1020'; x.fillRect(0, 0, 256, 352);
      x.globalAlpha = 0.94; x.fillStyle = g; x.fillRect(0, 0, 256, 352); x.globalAlpha = 1;
      x.fillStyle = 'rgba(5,7,13,.32)'; x.fillRect(0, 0, 18, 352);              /* lombada */
      x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2; x.strokeRect(30, 14, 212, 324);
      x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '500 13px "JetBrains Mono", ui-monospace, Consolas, monospace';
      x.fillText((b.tipo ? 'GUIA PRÁTICO' : nomeSala.toUpperCase()).slice(0, 23), 44, 46);
      x.fillStyle = '#ffffff'; x.font = '700 29px Sora, system-ui, "Segoe UI", sans-serif';
      b.titulo.split(' ').forEach(function (p) {
        var t = atual ? atual + ' ' + p : p;
        if (atual && x.measureText(t).width > 188) { linhas.push(atual); atual = p; } else atual = t;
      });
      if (atual) linhas.push(atual);
      linhas.slice(0, 5).forEach(function (l, i) { x.fillText(l, 44, 98 + i * 35); });
      x.fillStyle = 'rgba(255,255,255,.88)'; x.fillRect(44, 288, 40, 3);
      x.font = '500 14px Sora, system-ui, "Segoe UI", sans-serif'; x.fillStyle = 'rgba(255,255,255,.85)';
      x.fillText(b.min + ' min de leitura', 44, 318);
      return texturaDe(c);
    }

    function texturaTela(def, k) {
      var c = document.createElement('canvas'); c.width = 320; c.height = 180;
      var x = c.getContext('2d'), r = T.rng('tela:' + k), g = x.createLinearGradient(0, 0, 320, 180);
      g.addColorStop(0, '#131827'); g.addColorStop(1, def.cor);
      x.fillStyle = g; x.fillRect(0, 0, 320, 180);
      x.fillStyle = 'rgba(5,7,13,.5)'; x.fillRect(0, 0, 320, 180);
      x.fillStyle = 'rgba(238,241,246,.9)'; x.fillRect(22, 26, 90 + r() * 70, 12);
      x.fillStyle = 'rgba(238,241,246,.38)'; x.fillRect(22, 48, 150, 7); x.fillRect(22, 62, 118, 7);
      x.fillStyle = def.cor; x.fillRect(22, 86, 66, 20);
      x.fillStyle = 'rgba(5,7,13,.72)'; x.beginPath(); x.arc(240, 78, 34, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#eef1f6'; x.beginPath(); x.moveTo(230, 60); x.lineTo(230, 96); x.lineTo(260, 78); x.closePath(); x.fill();
      x.fillStyle = 'rgba(238,241,246,.25)'; x.fillRect(22, 150, 276, 6);
      x.fillStyle = def.cor; x.fillRect(22, 150, 276 * (0.2 + r() * 0.7), 6);
      return texturaDe(c);
    }

    function cantos(x, px, py, w, h, raio) {
      x.beginPath(); x.moveTo(px + raio, py); x.arcTo(px + w, py, px + w, py + h, raio); x.arcTo(px + w, py + h, px, py + h, raio);
      x.arcTo(px, py + h, px, py, raio); x.arcTo(px, py, px + w, py, raio); x.closePath();
    }
    /* desenhos genéricos (não são os logotipos das redes) */
    var GLIFOS = {
      youtube: function (x) { cantos(x, -36, -25, 72, 50, 14); x.stroke(); x.beginPath(); x.moveTo(-9, -13); x.lineTo(-9, 13); x.lineTo(14, 0); x.closePath(); x.fill(); },
      instagram: function (x) { cantos(x, -31, -31, 62, 62, 18); x.stroke(); x.beginPath(); x.arc(0, 0, 13, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(19, -19, 3.5, 0, Math.PI * 2); x.fill(); },
      tiktok: function (x) { x.beginPath(); x.moveTo(6, -32); x.lineTo(6, 14); x.stroke(); x.beginPath(); x.arc(-8, 16, 14, 0, Math.PI * 2); x.fill(); x.beginPath(); x.moveTo(6, -32); x.quadraticCurveTo(12, -14, 30, -12); x.stroke(); },
      facebook: function (x) { cantos(x, -34, -28, 68, 46, 14); x.stroke(); x.beginPath(); x.moveTo(-14, 18); x.lineTo(-22, 34); x.lineTo(0, 18); x.closePath(); x.fill(); },
      linkedin: function (x) { cantos(x, -34, -16, 68, 46, 10); x.stroke(); x.beginPath(); x.moveTo(-13, -16); x.lineTo(-13, -28); x.lineTo(13, -28); x.lineTo(13, -16); x.stroke(); x.beginPath(); x.moveTo(-34, 4); x.lineTo(34, 4); x.stroke(); }
    };
    function texturaPlataforma(p, cor) {
      var c = document.createElement('canvas'); c.width = 512; c.height = 160;
      var x = c.getContext('2d');
      cantos(x, 6, 6, 500, 148, 44); x.fillStyle = 'rgba(11,15,26,.92)'; x.fill(); x.lineWidth = 4; x.strokeStyle = cor; x.stroke();
      x.save(); x.translate(88, 80); x.strokeStyle = '#eef1f6'; x.fillStyle = '#eef1f6'; x.lineWidth = 7; x.lineJoin = 'round'; x.lineCap = 'round';
      (GLIFOS[p.id] || GLIFOS.youtube)(x); x.restore();
      x.fillStyle = '#eef1f6'; x.font = '600 58px Sora, system-ui, "Segoe UI", sans-serif'; x.textBaseline = 'middle';
      x.fillText(p.nome, 152, 84);
      return texturaDe(c);
    }

    /* ==========================================================================
       PEÇAS CENTRAIS — o que torna cada andar reconhecível
       Cada função devolve { atualizar(t, dt), ...extras }
       ======================================================================== */
    var PECAS = {
      /* 1 · informação chegando de fora para dentro */
      rh: function (g, cor) {
        var n = 170, pos = new Float32Array(n * 3), d = [], r = T.rng('p-rh');
        for (var i = 0; i < n; i++) d.push({ ang: r() * Math.PI * 2, alt: 0.5 + r() * 2.0, fase: r(), vel: 0.1 + r() * 0.16, longe: 15 + r() * 12 });
        var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        var pts = new THREE.Points(geo, new THREE.PointsMaterial(aditivo({ color: hdr(cor.getHex(), 2.4), size: 0.17 })));
        pts.frustumCulled = false; g.add(pts);
        var a1 = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.035, 8, 72), new THREE.MeshBasicMaterial({ color: hdr(cor.getHex(), 2.2) }));
        var a2 = a1.clone(); a1.position.y = a2.position.y = 1.55; a2.scale.setScalar(0.78); g.add(a1); g.add(a2);
        return {
          atualizar: function (t) {
            for (var i = 0; i < n; i++) {
              var o = d[i], u = (t * o.vel + o.fase) % 1, s = u * u * (3 - 2 * u), raio = o.longe + (1.5 - o.longe) * s;
              pos[i * 3] = Math.cos(o.ang) * raio; pos[i * 3 + 1] = 0.5 + o.alt * (1 - 0.55 * s); pos[i * 3 + 2] = Math.sin(o.ang) * raio;
            }
            geo.attributes.position.needsUpdate = true;
            a1.rotation.set(t * 0.7, t * 0.4, 0); a2.rotation.set(-t * 0.5, 0, t * 0.6);
          }
        };
      },

      /* 2 · gráfico de barras que sobe em espiral */
      vendas: function (g, cor) {
        var n = 12, barras = [], geo = new THREE.BoxGeometry(0.3, 1, 0.3); geo.translate(0, 0.5, 0);
        var mat = new THREE.MeshBasicMaterial({ color: hdr(cor.getHex(), 1.5), transparent: true, opacity: 0.9 });
        var grupo = new THREE.Group(); g.add(grupo);
        for (var i = 0; i < n; i++) {
          var m = new THREE.Mesh(geo, mat), a = i / n * Math.PI * 2;
          m.position.set(Math.cos(a) * 1.95, PISO, Math.sin(a) * 1.95); grupo.add(m); barras.push(m);
        }
        return {
          atualizar: function (t) {
            grupo.rotation.y = -t * 0.22;
            for (var i = 0; i < n; i++) barras[i].scale.y = 0.35 + (i / n) * 1.5 + 0.28 * Math.sin(t * 1.6 + i * 0.9);
          }
        };
      },

      /* 3 · ondas de divulgação saindo do centro */
      marketing: function (g, cor) {
        var ondas = [], geo = new THREE.RingGeometry(0.965, 1, 96);
        for (var k = 0; k < 4; k++) {
          var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial(aditivo({ color: hdr(cor.getHex(), 2.0), side: THREE.DoubleSide })));
          m.rotation.x = -Math.PI / 2; m.position.y = 1.45; g.add(m); ondas.push(m);
        }
        var joia = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(1.05)), new THREE.LineBasicMaterial({ color: hdr(cor.getHex(), 2.4) }));
        joia.position.y = 1.5; g.add(joia);
        return {
          atualizar: function (t) {
            for (var k = 0; k < 4; k++) {
              var u = (t * 0.2 + k / 4) % 1;
              ondas[k].scale.setScalar(1.9 + u * (R - 2.4)); ondas[k].material.opacity = 0.6 * (1 - u);
            }
            joia.rotation.set(t * 0.5, t * 0.8, 0);
          }
        };
      },

      /* 4 · carrossel de telas com os vídeos em edição */
      video: function (g, cor, def) {
        var grupo = new THREE.Group(); grupo.position.y = 1.6; g.add(grupo);
        for (var k = 0; k < 6; k++) {
          var a = k / 6 * Math.PI * 2;
          var tela = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.91), new THREE.MeshBasicMaterial({ map: texturaTela(def, k), side: THREE.DoubleSide, transparent: true, opacity: 0.96 }));
          tela.position.set(Math.cos(a) * 2.25, 0, Math.sin(a) * 2.25); tela.rotation.y = Math.PI / 2 - a; grupo.add(tela);
        }
        return { atualizar: function (t) { grupo.rotation.y = t * 0.24; } };
      },

      /* 5 · redes sociais em órbita, com os posts saindo do andar */
      publicacao: function (g, cor, def) {
        var orbita = new THREE.Group(); orbita.position.y = 1.5; g.add(orbita);
        var plats = T.CONFIG.plataformas, pontos = [], geoP = new THREE.SphereGeometry(0.11, 8, 6), matP = new THREE.MeshBasicMaterial({ color: hdr(cor.getHex(), 2.6) });
        plats.forEach(function (p, k) {
          var a = k / plats.length * Math.PI * 2, fim = new THREE.Vector3(Math.cos(a) * 15.2, Math.sin(k * 1.9) * 1.1, Math.sin(a) * 15.2), ini = new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
          var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaPlataforma(p, def.cor), transparent: true, depthWrite: false }));
          sp.scale.set(4.7, 1.47, 1); sp.position.copy(fim); orbita.add(sp);
          var gl = new THREE.BufferGeometry().setFromPoints([ini, fim]);
          orbita.add(new THREE.Line(gl, new THREE.LineBasicMaterial(aditivo({ color: hdr(cor.getHex(), 1.5), opacity: 0.35 }))));
          for (var j = 0; j < 3; j++) { var m = new THREE.Mesh(geoP, matP); orbita.add(m); pontos.push({ m: m, ini: ini, fim: fim, fase: j / 3 + k * 0.13 }); }
        });
        return {
          atualizar: function (t) {
            orbita.rotation.y = t * 0.045;
            for (var i = 0; i < pontos.length; i++) { var p = pontos[i], u = (t * 0.42 + p.fase) % 1; p.m.position.lerpVectors(p.ini, p.fim, u); p.m.scale.setScalar(u > 0.93 ? (1 - u) / 0.07 : 1); }
          }
        };
      },

      /* 6 · pilhas de moedas e o medidor do orçamento do mês */
      financeiro: function (g, cor) {
        var moedas = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.27, 0.27, 0.075, 20), new THREE.MeshBasicMaterial({ color: hdr(cor.getHex(), 1.9) }), 90);
        var k = 0, giro = new THREE.Group(); g.add(giro); giro.add(moedas);
        for (var s = 0; s < 8; s++) {
          var alt = 3 + ((s * 5) % 7), a = s / 8 * Math.PI * 2;
          for (var c = 0; c < alt; c++) { dummy.position.set(Math.cos(a) * 1.95, PISO + 0.05 + c * 0.1, Math.sin(a) * 1.95); dummy.scale.setScalar(1); dummy.updateMatrix(); moedas.setMatrixAt(k++, dummy.matrix); }
        }
        moedas.count = k;
        var trilho = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.03, 6, 96), new THREE.MeshBasicMaterial({ color: hdr(cor.getHex(), 0.5) }));
        trilho.rotation.x = Math.PI / 2; trilho.position.y = PISO + 0.06; g.add(trilho);
        var matArco = new THREE.MeshBasicMaterial({ color: hdr(cor.getHex(), 2.6) }), arco = null;
        function definir(p) {
          if (arco) { g.remove(arco); arco.geometry.dispose(); }
          arco = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.07, 8, 96, Math.PI * 2 * Math.max(0.01, Math.min(1, p))), matArco);
          arco.rotation.x = Math.PI / 2; arco.position.y = PISO + 0.08; g.add(arco);
        }
        definir(0.33);
        return { atualizar: function (t) { giro.rotation.y = t * 0.16; }, orcamento: definir };
      },

      /* 7 · mesa redonda com projeção holográfica */
      reunioes: function (g, cor) {
        var mesa = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.07, 56), new THREE.MeshBasicMaterial({ color: hdr(cor.getHex(), 0.9), transparent: true, opacity: 0.4 }));
        mesa.position.y = 0.95; g.add(mesa);
        var borda = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color: hdr(cor.getHex(), 2.2) }));
        borda.rotation.x = Math.PI / 2; borda.position.y = 0.99; g.add(borda);
        var geoC = new THREE.SphereGeometry(0.15, 10, 8), matC = new THREE.MeshBasicMaterial({ color: hdr(cor.getHex(), 1.6) });
        for (var i = 0; i < 10; i++) { var a = i / 10 * Math.PI * 2, c = new THREE.Mesh(geoC, matC); c.position.set(Math.cos(a) * 2.42, 0.62, Math.sin(a) * 2.42); g.add(c); }
        var holo = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.85, 1.7, 40, 1, true), new THREE.MeshBasicMaterial(aditivo({ color: hdr(cor.getHex(), 1.6), side: THREE.DoubleSide, opacity: 0.08 })));
        holo.position.y = 1.9; g.add(holo);
        var ativa = false;
        return {
          atualizar: function (t) {
            holo.rotation.y = t * 0.5;
            holo.material.opacity = ativa ? 0.2 + 0.07 * Math.sin(t * 3.2) : 0.07;
            borda.scale.setScalar(ativa ? 1 + 0.025 * Math.sin(t * 3.2) : 1);
          },
          reuniao: function (b) { ativa = !!b; }
        };
      },

      /* 8 · o cérebro: núcleo pulsante, cascas, elétrons e sinapses até os agentes */
      cerebro: function (g, cor, def) {
        var c = new THREE.Group(); c.position.y = 1.75; g.add(c);
        var miolo = new THREE.Mesh(new THREE.SphereGeometry(0.78, 32, 20), new THREE.MeshBasicMaterial({ color: hdr(cor.getHex(), 3.0) })); c.add(miolo);
        var casca1 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.3, 1)), new THREE.LineBasicMaterial({ color: hdr(cor.getHex(), 2.4) })); c.add(casca1);
        var casca2 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.9, 2)), new THREE.LineBasicMaterial(aditivo({ color: hdr(cor.getHex(), 1.6), opacity: 0.4 }))); c.add(casca2);
        var ne = 15, eletrons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: hdr(0xffffff, 1.6) }), ne); c.add(eletrons);
        var r = T.rng('p-cerebro'), pts = [], ags = def.agentes;
        for (var i = 0; i < 46; i++) { var a = ags[Math.floor(r() * ags.length)]; pts.push(0, 1.75, 0, a.x, PISO + 0.55, a.z); }
        var gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        var sinapses = new THREE.LineSegments(gs, new THREE.LineBasicMaterial(aditivo({ color: hdr(cor.getHex(), 1.6), opacity: 0.16 }))); g.add(sinapses);
        var pulso = 0;
        return {
          atualizar: function (t, dt) {
            casca1.rotation.set(t * 0.32, t * 0.41, 0); casca2.rotation.set(-t * 0.14, -t * 0.19, t * 0.09);
            pulso = Math.max(0, pulso - dt * 1.6);
            miolo.scale.setScalar(1 + 0.07 * Math.sin(t * 2.6) + pulso * 0.5);
            sinapses.material.opacity = 0.1 + 0.07 * Math.sin(t * 1.8) + pulso * 0.3;
            for (var i = 0; i < ne; i++) {
              var o = i % 3, a = t * (0.9 + o * 0.25) + i * 2.1, inc = o * 1.05 + 0.4, raio = 2.25 + o * 0.12;
              dummy.position.set(Math.cos(a) * raio, Math.sin(a) * Math.sin(inc) * raio, Math.sin(a) * Math.cos(inc) * raio);
              dummy.scale.setScalar(1); dummy.updateMatrix(); eletrons.setMatrixAt(i, dummy.matrix);
            }
            eletrons.instanceMatrix.needsUpdate = true;
          },
          pulsar: function () { pulso = 1; }
        };
      },

      /* 9 · estante giratória da biblioteca: cada livro é um conteúdo e pode ser clicado */
      estudo: function (g, cor, def) {
        var acervo = T.BIBLIOTECA || [], n = acervo.length, emCima = Math.ceil(n / 2), livros = [];
        var grupo = new THREE.Group(); g.add(grupo);
        var geo = new THREE.BoxGeometry(0.62, 0.86, 0.11), matPagina = new THREE.MeshBasicMaterial({ color: 0xd3d9e4 });
        acervo.forEach(function (b, i) {
          var embaixo = i >= emCima, j = embaixo ? i - emCima : i, tot = embaixo ? n - emCima : emCima;
          var a = (j + (embaixo ? 0.5 : 0)) / Math.max(1, tot) * Math.PI * 2, sq = def.squads[b.sala] || {}, corSala = sq.corLivro || def.cor;
          var lombada = new THREE.MeshBasicMaterial({ color: new THREE.Color(corSala).multiplyScalar(0.5) });
          var capa = new THREE.MeshBasicMaterial({ map: texturaCapa(b, corSala, sq.nome || def.nome) });
          /* faces da caixa: +x páginas, -x lombada, cima, baixo, +z capa (virada para fora), -z contracapa */
          var m = new THREE.Mesh(geo, [matPagina, lombada, matPagina, matPagina, capa, lombada]);
          m.position.set(Math.cos(a) * 1.78, embaixo ? 1.0 : 2.02, Math.sin(a) * 1.78);
          m.rotation.y = Math.PI / 2 - a;
          m.userData.livro = i; m.userData.ang = a; m.userData.y = m.position.y;
          grupo.add(m); livros.push(m);
        });
        var matAro = new THREE.MeshBasicMaterial({ color: hdr(cor.getHex(), 1.9) }), geoAroE = new THREE.TorusGeometry(1.78, 0.022, 6, 80);
        [0.5, 1.51, 2.52].forEach(function (y) { var aro = new THREE.Mesh(geoAroE, matAro); aro.rotation.x = Math.PI / 2; aro.position.y = y; g.add(aro); });
        var giro = 0, foco = -1, sobre = -1, escala = livros.map(function () { return 1; });
        return {
          livros: livros,
          atualizar: function (t, dt) {
            if (foco < 0 && !calmo) giro += dt * 0.1;
            grupo.rotation.y = -giro;
            for (var i = 0; i < livros.length; i++) {
              var alvo = i === foco ? 1.2 : i === sobre ? 1.1 : 1;
              escala[i] += (alvo - escala[i]) * Math.min(1, dt * 8);
              livros[i].scale.setScalar(escala[i]);
              livros[i].position.y = livros[i].userData.y + (foco < 0 && !calmo ? Math.sin(t * 0.9 + i * 1.7) * 0.03 : 0);
            }
          },
          focar: function (i) { foco = i; },
          soltar: function () { foco = -1; },
          apontar: function (i) { sobre = i; },
          angulo: function (i) { return livros[i].userData.ang + giro; },   /* onde o livro i está agora, no mundo */
          altura: function (i) { return livros[i].userData.y; }
        };
      }
    };

    /* ==========================================================================
       MÓVEIS
       Estação de trabalho (uma por agente): mesa, monitor, teclado e cadeira em
       uma peça só; a tela acesa é uma segunda malha, para poder mudar de brilho
       conforme o estado do agente. Modelada com o agente na origem, olhando
       para o centro do andar (-Z); a cadeira fica atrás dele (+Z).
       ======================================================================== */
    var geoEstacao = (function () {
      /* cores claras/escuras em tons de cinza: a cor do andar entra depois, pelo material de cada andar */
      var l = [], tampo = new THREE.Color(0.4, 0.42, 0.5), perna = new THREE.Color(0.2, 0.22, 0.28), preto = new THREE.Color(0.05, 0.055, 0.075), estofado = new THREE.Color(0.95, 0.95, 0.95);
      caixa(l, 0.42, 0.025, 0.24, 0, 0.25, -0.27, tampo);
      caixa(l, 0.02, 0.24, 0.2, -0.2, 0.12, -0.27, perna); caixa(l, 0.02, 0.24, 0.2, 0.2, 0.12, -0.27, perna);
      caixa(l, 0.27, 0.17, 0.016, 0, 0.4, -0.345, preto);                       /* monitor */
      caixa(l, 0.03, 0.07, 0.02, 0, 0.295, -0.352, preto); caixa(l, 0.11, 0.01, 0.07, 0, 0.267, -0.345, preto);
      caixa(l, 0.17, 0.008, 0.055, 0, 0.267, -0.215, preto);                    /* teclado */
      caixa(l, 0.27, 0.03, 0.26, 0, ASSENTO, 0.01, estofado); caixa(l, 0.25, 0.21, 0.025, 0, ASSENTO + 0.19, 0.145, estofado);   /* cadeira */
      caixa(l, 0.03, ASSENTO, 0.03, 0, ASSENTO / 2, 0.01, perna);
      return L.mergeGeometries(l);
    })();
    var geoTela = new THREE.PlaneGeometry(0.25, 0.15); geoTela.translate(0, 0.4, -0.3365);
    var matMoveis = new THREE.MeshLambertMaterial({ vertexColors: true });
    var matTela = new THREE.MeshBasicMaterial({ map: texturaMonitor() });

    /* Móveis da área de convivência. Cada função recebe a lista de peças, a cor
       do andar e um sorteador; quem escolhe o que vai em cada sala é T.mobiliar(). */
    var CINZA = new THREE.Color(0x232b45), ESCURO = new THREE.Color(0x121727), CLARO = new THREE.Color(0x7d889c), VERDE = new THREE.Color(0x24804a), AGUA = new THREE.Color(0x3f8fc9);
    var CORES_LIVROS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767', '#b9c4d8'].map(function (h) { return new THREE.Color(h).multiplyScalar(0.62); });
    var MOBILIA = {
      planta: function (l, cor, r) {
        var h = 0.3 + r() * 0.16;
        cilindro(l, 0.11, 0.085, 0.17, 0, 0.085, 0, CINZA, 10);
        cilindro(l, 0.015, 0.015, h, 0, 0.17 + h / 2, 0, VERDE.clone().multiplyScalar(0.5), 5);
        esfera(l, 0.17, 0, 0.17 + h, 0, VERDE, 1.25); esfera(l, 0.12, 0.07, 0.12 + h * 0.75, 0.04, VERDE.clone().multiplyScalar(0.78), 1.1);
      },
      sofa: function (l, cor) {
        var c1 = cor.clone().multiplyScalar(0.62), c2 = cor.clone().multiplyScalar(0.42);
        caixa(l, 0.92, 0.13, 0.36, 0, 0.115, -0.04, c1); caixa(l, 0.92, 0.27, 0.09, 0, 0.245, 0.17, c2);
        caixa(l, 0.09, 0.21, 0.4, -0.46, 0.155, -0.02, c2); caixa(l, 0.09, 0.21, 0.4, 0.46, 0.155, -0.02, c2);
        cilindro(l, 0.13, 0.13, 0.025, 0, 0.15, -0.36, CLARO, 14); cilindro(l, 0.025, 0.045, 0.14, 0, 0.07, -0.36, CINZA, 8);   /* mesinha de centro */
      },
      mesa: function (l, cor) {
        var c1 = cor.clone().multiplyScalar(0.6);
        cilindro(l, 0.3, 0.3, 0.03, 0, 0.255, 0.02, CLARO, 20); cilindro(l, 0.045, 0.09, 0.24, 0, 0.12, 0.02, CINZA, 10);
        for (var i = 0; i < 4; i++) { var a = i / 4 * Math.PI * 2 + 0.785; cilindro(l, 0.085, 0.085, 0.15, Math.cos(a) * 0.42, 0.075, 0.02 + Math.sin(a) * 0.42, c1, 10); }
      },
      armario: function (l, cor) {
        caixa(l, 0.86, 0.62, 0.24, 0, 0.31, 0.2, CINZA); caixa(l, 0.88, 0.02, 0.26, 0, 0.63, 0.2, CLARO);
        caixa(l, 0.4, 0.5, 0.012, -0.215, 0.31, 0.074, ESCURO); caixa(l, 0.4, 0.5, 0.012, 0.215, 0.31, 0.074, ESCURO);
        caixa(l, 0.015, 0.12, 0.02, -0.03, 0.34, 0.064, cor); caixa(l, 0.015, 0.12, 0.02, 0.03, 0.34, 0.064, cor);
      },
      bebedouro: function (l) {
        caixa(l, 0.17, 0.42, 0.17, 0, 0.21, 0.18, CLARO);
        cilindro(l, 0.07, 0.07, 0.17, 0, 0.505, 0.18, AGUA, 10); cilindro(l, 0.04, 0.07, 0.03, 0, 0.605, 0.18, AGUA, 10);
      },
      quadro: function (l, cor) {
        caixa(l, 0.82, 0.46, 0.025, 0, 0.52, 0.22, CLARO);
        caixa(l, 0.86, 0.03, 0.035, 0, 0.765, 0.22, CINZA); caixa(l, 0.86, 0.03, 0.035, 0, 0.275, 0.22, CINZA);
        caixa(l, 0.03, 0.78, 0.03, -0.4, 0.39, 0.22, CINZA); caixa(l, 0.03, 0.78, 0.03, 0.4, 0.39, 0.22, CINZA);
        caixa(l, 0.3, 0.02, 0.006, -0.18, 0.6, 0.204, cor); caixa(l, 0.42, 0.02, 0.006, -0.12, 0.54, 0.204, ESCURO); caixa(l, 0.22, 0.02, 0.006, -0.22, 0.48, 0.204, ESCURO);
      },
      estante: function (l, cor, r) {
        caixa(l, 0.94, 0.9, 0.04, 0, 0.45, 0.31, ESCURO);
        caixa(l, 0.04, 0.9, 0.24, -0.47, 0.45, 0.2, CINZA); caixa(l, 0.04, 0.9, 0.24, 0.47, 0.45, 0.2, CINZA);
        for (var p = 0; p < 4; p++) caixa(l, 0.94, 0.03, 0.24, 0, 0.015 + p * 0.29, 0.2, CINZA);
        for (p = 0; p < 3; p++) {
          var x = -0.43;
          while (x < 0.39) {
            var w = 0.035 + r() * 0.035, h = 0.17 + r() * 0.08;
            if (r() < 0.86) caixa(l, w, h, 0.17, x + w / 2, 0.03 + p * 0.29 + h / 2, 0.19, CORES_LIVROS[Math.floor(r() * CORES_LIVROS.length)]);
            x += w + 0.006;
          }
        }
      },
      leitura: function (l, cor) {
        var c1 = cor.clone().multiplyScalar(0.6);
        caixa(l, 1.0, 0.03, 0.44, 0, 0.26, 0.02, CLARO);
        caixa(l, 0.04, 0.25, 0.4, -0.46, 0.125, 0.02, CINZA); caixa(l, 0.04, 0.25, 0.4, 0.46, 0.125, 0.02, CINZA);
        caixa(l, 0.2, 0.012, 0.15, -0.22, 0.282, 0.0, cor); caixa(l, 0.2, 0.012, 0.15, 0.2, 0.282, 0.06, CORES_LIVROS[1]);       /* livros abertos */
        cilindro(l, 0.02, 0.045, 0.16, 0, 0.355, 0.16, CINZA, 8); esfera(l, 0.05, 0, 0.45, 0.16, new THREE.Color(0xd9c98a));    /* luminária */
        cilindro(l, 0.085, 0.085, 0.15, -0.28, 0.075, -0.32, c1, 10); cilindro(l, 0.085, 0.085, 0.15, 0.28, 0.075, -0.32, c1, 10);
      }
    };
    var matMobilia = new THREE.MeshLambertMaterial({ vertexColors: true });

    /* ==========================================================================
       OS ANDARES
       ======================================================================== */
    var geoLaje = new THREE.CylinderGeometry(R + 0.35, R + 0.35, PISO, 72);
    var matLaje = new THREE.MeshStandardMaterial({ color: 0x0b1020, metalness: 0.65, roughness: 0.42 });
    var geoAro = new THREE.TorusGeometry(R + 0.35, 0.04, 8, 128);
    var geoAroFino = new THREE.TorusGeometry(R, 0.018, 6, 128);
    var geoVidro = new THREE.CylinderGeometry(R, R, H - 0.32, 72, 1, true);
    var geoPlanta = new THREE.CircleGeometry(R, 72);
    var geoToque = new THREE.CylinderGeometry(R + 0.6, R + 0.6, H, 20);
    var matToque = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    var geoColuna = new THREE.CylinderGeometry(0.05, 0.05, H - 0.32, 6);
    /* ==========================================================================
       OS AGENTES: bonecos com roupa
       Cabelo, cabeça, pescoço, camisa, braços, mãos, calça e sapatos. A camisa
       tem a cor do setor (e muda de brilho conforme o estado do agente); pele e
       cabelo variam de pessoa para pessoa. Duas poses: sentado na estação de
       trabalho (mãos no teclado) e em pé, para quem circula pela sala.
       Modelados olhando para -Z, com os pés no chão (y = 0), como a estação.
       Cada vértice diz de que parte é: 0 cor fixa (calça, sapato) · 1 camisa
       (cor da instância) · 2 pele · 3 cabelo (cores por agente, em atributos).
       ======================================================================== */
    var CALCA = new THREE.Color().setRGB(0.17, 0.2, 0.29, THREE.SRGBColorSpace), SAPATO = new THREE.Color().setRGB(0.06, 0.06, 0.07, THREE.SRGBColorSpace), BRANCA = new THREE.Color(1, 1, 1);
    var vA = new THREE.Vector3(), vB = new THREE.Vector3(), qT = new THREE.Quaternion(), mT = new THREE.Matrix4(), CIMA = new THREE.Vector3(0, 1, 0), UM = new THREE.Vector3(1, 1, 1);
    function parteBoneco(lista, g, parte, cor) {
      g.deleteAttribute('uv');
      var n = g.attributes.position.count, c = new Float32Array(n * 3), p = new Float32Array(n), base = parte === 0 ? (cor || CALCA) : BRANCA;
      for (var i = 0; i < n; i++) { c[i * 3] = base.r; c[i * 3 + 1] = base.g; c[i * 3 + 2] = base.b; p[i] = parte; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('parte', new THREE.BufferAttribute(p, 1));
      lista.push(g);
    }
    function bloco(l, w, h, d, x, y, z, parte, cor) { var g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parteBoneco(l, g, parte, cor); }
    /* caixa esticada entre dois pontos (braços) */
    function membro(l, a, b, w, parte) {
      vA.fromArray(a); vB.fromArray(b);
      var dir = vB.clone().sub(vA), g = new THREE.BoxGeometry(w, dir.length(), w);
      qT.setFromUnitVectors(CIMA, dir.normalize()); mT.compose(vA.clone().add(vB).multiplyScalar(0.5), qT, UM); g.applyMatrix4(mT);
      parteBoneco(l, g, parte);
    }
    function tronco(l, rTopo, rBase, h, x, y, z, parte, achata) { var g = new THREE.CylinderGeometry(rTopo, rBase, h, 8); g.scale(1, 1, achata || 1); g.translate(x, y, z); parteBoneco(l, g, parte); }
    function cabecaBoneco(l, x, y, z) {
      tronco(l, 0.026, 0.03, 0.05, x, y - 0.075, z, 2);                                            /* pescoço */
      var c = new THREE.SphereGeometry(0.07, 10, 8); c.scale(1, 1.1, 1); c.translate(x, y, z); parteBoneco(l, c, 2);   /* cabeça */
      var h = new THREE.SphereGeometry(0.077, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); h.scale(1, 1.08, 1); h.rotateX(0.32); h.translate(x, y + 0.006, z + 0.006);
      parteBoneco(l, h, 3);                                                                          /* cabelo: topo, deixando a testa à mostra */
      bloco(l, 0.135, 0.08, 0.04, x, y - 0.022, z + 0.052, 3);                                       /* cabelo: nuca */
    }
    function boneco(sentado) {
      var l = [];
      [-1, 1].forEach(function (s) {
        if (sentado) {
          bloco(l, 0.062, 0.055, 0.17, s * 0.04, 0.135, -0.06, 0);                                 /* coxa */
          bloco(l, 0.055, 0.12, 0.055, s * 0.04, 0.075, -0.15, 0);                                 /* canela */
          bloco(l, 0.06, 0.03, 0.09, s * 0.04, 0.015, -0.175, 0, SAPATO);
          membro(l, [s * 0.1, 0.33, 0.03], [s * 0.112, 0.235, -0.035], 0.046, 1);                  /* braço (manga) */
          membro(l, [s * 0.112, 0.235, -0.035], [s * 0.066, 0.268, -0.185], 0.038, 2);             /* antebraço */
          bloco(l, 0.036, 0.022, 0.046, s * 0.06, 0.271, -0.205, 2);                               /* mão no teclado */
        } else {
          bloco(l, 0.06, 0.03, 0.09, s * 0.04, 0.015, -0.015, 0, SAPATO);
          bloco(l, 0.06, 0.22, 0.06, s * 0.04, 0.14, 0, 0);                                        /* perna */
          membro(l, [s * 0.105, 0.47, 0], [s * 0.12, 0.37, 0.012], 0.046, 1);
          membro(l, [s * 0.12, 0.37, 0.012], [s * 0.12, 0.272, -0.008], 0.038, 2);
          bloco(l, 0.034, 0.046, 0.03, s * 0.12, 0.246, -0.008, 2);                                /* mão */
        }
      });
      var y0 = sentado ? 0 : 0.13, z0 = sentado ? 0.025 : 0;
      bloco(l, 0.15, 0.065, sentado ? 0.13 : 0.1, 0, 0.135 + y0, z0 - (sentado ? 0.005 : 0), 0);   /* quadril */
      tronco(l, 0.094, 0.08, 0.2, 0, 0.26 + y0, z0, 1, 0.72);                                      /* camisa */
      cabecaBoneco(l, 0, 0.445 + y0, z0);
      var g = L.mergeGeometries(l);
      /* sombreado fixo, gravado no boneco: dá volume de perto sem custar nada (os bonecos não usam as luzes da cena) */
      var nrm = g.attributes.normal, col = g.attributes.color;
      for (var i = 0; i < nrm.count; i++) {
        var f = 0.6 + 0.4 * Math.max(0, Math.min(1, (nrm.getX(i) * 0.33 + nrm.getY(i) * 0.8 + nrm.getZ(i) * 0.5) * 0.6 + 0.5));
        col.setXYZ(i, col.getX(i) * f, col.getY(i) * f, col.getZ(i) * f);
      }
      return g;
    }
    var geoSentado = boneco(true), geoEmPe = boneco(false);
    /* tons de pele e cores de cabelo (sRGB), sorteados por agente */
    var PELES = [[0.98, 0.84, 0.71], [0.94, 0.76, 0.6], [0.84, 0.62, 0.45], [0.7, 0.49, 0.33], [0.53, 0.35, 0.22], [0.38, 0.25, 0.16]].map(function (c) { return new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); });
    var CABELOS = [[0.05, 0.045, 0.04, 30], [0.17, 0.1, 0.06, 28], [0.33, 0.2, 0.11, 17], [0.75, 0.6, 0.33, 10], [0.55, 0.22, 0.1, 6], [0.62, 0.62, 0.64, 9]].map(function (c) { return { cor: new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace), peso: c[3] }; });
    function vestir(geo, def, indices) {
      var n = indices.length, pele = new Float32Array(n * 3), cab = new Float32Array(n * 3), total = CABELOS.reduce(function (s, c) { return s + c.peso; }, 0);
      indices.forEach(function (ai, j) {
        var r = T.rng('boneco:' + def.id + ':' + ai), p = PELES[Math.floor(r() * PELES.length)], x = r() * total, c = CABELOS[0];
        for (var k = 0; k < CABELOS.length; k++) { if (x < CABELOS[k].peso) { c = CABELOS[k]; break; } x -= CABELOS[k].peso; }
        pele[j * 3] = p.r; pele[j * 3 + 1] = p.g; pele[j * 3 + 2] = p.b;
        cab[j * 3] = c.cor.r; cab[j * 3 + 1] = c.cor.g; cab[j * 3 + 2] = c.cor.b;
      });
      geo.setAttribute('pele', new THREE.InstancedBufferAttribute(pele, 3));
      geo.setAttribute('cabelo', new THREE.InstancedBufferAttribute(cab, 3));
      return geo;
    }
    /* a cor de cada instância pinta só a camisa; pele e cabelo vêm dos atributos de cada agente */
    var matAgente = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
    matAgente.onBeforeCompile = function (s) {
      s.vertexShader = 'attribute float parte;\nattribute vec3 pele;\nattribute vec3 cabelo;\n' + s.vertexShader.replace('#include <color_vertex>', [
        'vColor = vec3(1.0);',
        '#ifdef USE_COLOR', '  vColor = color.rgb;', '#endif',
        'vec3 tinta = vec3(1.0);',
        '#ifdef USE_INSTANCING_COLOR', '  if (parte > 0.5 && parte < 1.5) tinta = instanceColor.rgb;', '#endif',
        'if (parte > 1.5 && parte < 2.5) tinta = pele;',
        'if (parte > 2.5) tinta = cabelo;',
        'vColor *= tinta;'].join('\n'));
    };
    matAgente.customProgramCacheKey = function () { return 'boneco-1'; };
    var toques = [];

    var andares = ANDARES.map(function (def, i) {
      var g = new THREE.Group(); g.position.y = BASE + i * H; scene.add(g);
      var cor = new THREE.Color(def.cor);

      var laje = new THREE.Mesh(geoLaje, matLaje); laje.position.y = PISO / 2; g.add(laje);
      var matAro = new THREE.MeshBasicMaterial({ color: cor.clone().multiplyScalar(1.7) });
      var aro = new THREE.Mesh(geoAro, matAro); aro.rotation.x = Math.PI / 2; aro.position.y = PISO; g.add(aro);
      var aroTopo = new THREE.Mesh(geoAroFino, matAro); aroTopo.rotation.x = Math.PI / 2; aroTopo.position.y = H - 0.1; g.add(aroTopo);

      var planta = new THREE.Mesh(geoPlanta, new THREE.MeshBasicMaterial(aditivo({ map: texturaPiso(def), opacity: 0.95 })));
      planta.rotation.x = -Math.PI / 2; planta.position.y = PISO + 0.012; g.add(planta);

      var matVidro = new THREE.MeshBasicMaterial(aditivo({ color: cor, side: THREE.DoubleSide, opacity: 0.045 }));
      var vidro = new THREE.Mesh(geoVidro, matVidro); vidro.position.y = PISO + (H - 0.32) / 2; g.add(vidro);

      var colunas = new THREE.InstancedMesh(geoColuna, new THREE.MeshBasicMaterial({ color: cor.clone().multiplyScalar(0.55) }), 8);
      for (var k = 0; k < 8; k++) { var a = (k + 0.5) / 8 * Math.PI * 2; dummy.position.set(Math.cos(a) * R, PISO + (H - 0.32) / 2, Math.sin(a) * R); dummy.scale.setScalar(1); dummy.updateMatrix(); colunas.setMatrixAt(k, dummy.matrix); }
      g.add(colunas);

      /* ---------- salas: uma por squad, com divisórias de vidro, porta e telão ---------- */
      var set = def.setores, vidros = new Malha(), frisos = new Malha(), yP = PISO + ALT_PAREDE, vaoPorta = PORTA / 2 / R_SALA;
      set.forEach(function (s) {
        paredeRadial(vidros, s.ini, R_SALA, R, PISO, yP); frisoRadial(frisos, s.ini, R_SALA, R, yP);
        paredeArco(vidros, R_SALA, s.ini, s.meio - vaoPorta, PISO, yP); frisoArco(frisos, R_SALA, s.ini, s.meio - vaoPorta, yP);
        paredeArco(vidros, R_SALA, s.meio + vaoPorta, s.fim, PISO, yP); frisoArco(frisos, R_SALA, s.meio + vaoPorta, s.fim, yP);
        frisoVertical(frisos, R_SALA, s.meio - vaoPorta, PISO, yP + 0.3); frisoVertical(frisos, R_SALA, s.meio + vaoPorta, PISO, yP + 0.3);   /* batentes da porta */
        frisoArco(frisos, R_SALA, s.meio - vaoPorta, s.meio + vaoPorta, yP + 0.3);
      });
      g.add(new THREE.Mesh(vidros.geo(), new THREE.MeshBasicMaterial(aditivo({ color: cor, side: THREE.DoubleSide, opacity: 0.07 }))));
      g.add(new THREE.Mesh(frisos.geo(), new THREE.MeshBasicMaterial({ color: cor.clone().multiplyScalar(0.95), side: THREE.DoubleSide })));

      /* telão de cada sala, acima da porta, virado para dentro da sala */
      var tl = texturaTeloes(def), pt = [], uv = [];
      set.forEach(function (s, k) {
        var meia = Math.min(0.85, (s.fim - s.ini) * R_SALA / 2 - 0.22), y0 = yP + 0.42, y1 = y0 + meia, rc = R_SALA + 0.05;
        var cx = Math.cos(s.meio) * rc, cz = Math.sin(s.meio) * rc, tx = -Math.sin(s.meio) * meia, tz = Math.cos(s.meio) * meia;
        var u0 = (k % tl.cols) / tl.cols, u1 = u0 + 1 / tl.cols, v1 = 1 - Math.floor(k / tl.cols) / tl.lin, v0 = v1 - 1 / tl.lin;
        pt.push(cx + tx, y0, cz + tz, cx - tx, y0, cz - tz, cx - tx, y1, cz - tz, cx + tx, y0, cz + tz, cx - tx, y1, cz - tz, cx + tx, y1, cz + tz);
        uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
      });
      var geoTeloes = new THREE.BufferGeometry();
      geoTeloes.setAttribute('position', new THREE.Float32BufferAttribute(pt, 3)); geoTeloes.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      /* os telões só aparecem com uma sala aberta: no andar visto de cima, tapariam a peça central (e os livros) */
      var teloes = new THREE.Mesh(geoTeloes, new THREE.MeshBasicMaterial({ map: tl.tex }));
      teloes.visible = false; g.add(teloes);

      /* uma estação de trabalho por agente: a mesa fica entre ele e o centro do andar */
      var nAg = def.agentes.length, matEst = matMoveis.clone(); matEst.color.copy(cor).lerp(BRANCO, 0.15).multiplyScalar(0.6);
      var estacoes = new THREE.InstancedMesh(geoEstacao, matEst, nAg), telas = new THREE.InstancedMesh(geoTela, matTela, nAg);
      def.agentes.forEach(function (ag, j) {
        d2.position.set(ag.x, PISO, ag.z); d2.rotation.set(0, Math.PI / 2 - ag.ang, 0); d2.updateMatrix();
        estacoes.setMatrixAt(j, d2.matrix); telas.setMatrixAt(j, d2.matrix);
      });
      estacoes.computeBoundingSphere(); telas.computeBoundingSphere();
      estacoes.visible = false; g.add(estacoes); g.add(telas);

      /* área de convivência de cada sala: mobília sorteada por T.mobiliar() */
      var pecas = [];
      set.forEach(function (s, k) {
        T.mobiliar(def, k).forEach(function (m) {
          var l = [];
          (MOBILIA[m.tipo] || MOBILIA.planta)(l, cor, T.rng('movel:' + def.id + ':' + k + ':' + m.ang.toFixed(3)));
          colocar(pecas, l, m.raio, m.ang);
        });
      });
      var mobilia = new THREE.Mesh(pecas.length ? L.mergeGeometries(pecas) : new THREE.BufferGeometry(), matMobilia);
      mobilia.visible = false; g.add(mobilia);

      /* todos os agentes sentados (índice = agente); quem circula vai também para a malha "em pé",
         e na sentada fica com escala zero enquanto anda */
      var todos = def.agentes.map(function (ag, j) { return j; }), quemAnda = def.agentes.filter(function (ag) { return ag.movel; }).map(function (ag) { return ag.i; });
      var mesh = new THREE.InstancedMesh(vestir(geoSentado.clone(), def, todos), matAgente, def.agentes.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      g.add(mesh);
      var meshPe = new THREE.InstancedMesh(vestir(geoEmPe.clone(), def, quemAnda), matAgente, Math.max(1, quemAnda.length));
      meshPe.instanceMatrix.setUsage(THREE.DynamicDrawUsage); meshPe.frustumCulled = false; meshPe.count = quemAnda.length;
      g.add(meshPe);
      var posPe = {}; quemAnda.forEach(function (ai, j) { posPe[ai] = j; });

      var toque = new THREE.Mesh(geoToque, matToque); toque.position.y = H / 2; toque.userData.andar = i; g.add(toque); toques.push(toque);

      var o = {
        def: def, g: g, cor: cor, matAro: matAro, matVidro: matVidro, aroTopo: aroTopo, agentes: mesh, agentesPe: meshPe, posPe: posPe, estacoes: estacoes, telas: telas, mobilia: mobilia, teloes: teloes,
        escala: new Float32Array(def.agentes.length).fill(1),
        moveis: def.agentes.filter(function (ag) { return ag.movel; }).map(function (ag) { return ag.i; }),
        /* até onde quem circula pode ir sem atravessar as paredes da própria sala */
        vai: def.agentes.map(function (ag) { var s = set[ag.squad]; return Math.max(0.02, Math.min(0.3, ag.ang - s.ini - 0.07, s.fim - ag.ang - 0.07)); }),
        brilho: 0, flash: 0, peca: null
      };
      o.peca = PECAS[def.id] ? PECAS[def.id](g, cor, def) : null;
      return o;
    });

    /* cúpula de luz sobre o último andar */
    (function () {
      var topo = andares[N - 1];
      var cupula = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(R, 22, 6, 0, Math.PI * 2, 0, Math.PI / 2)), new THREE.LineBasicMaterial(aditivo({ color: hdr(topo.cor.getHex(), 1.3), opacity: 0.16 })));
      cupula.scale.y = 0.42; cupula.position.y = H - 0.2; topo.g.add(cupula);
    })();

    /* ---------- agentes: posição, cor, estado ---------- */
    var FATOR = { trabalhando: 1.22, reuniao: 1.28, ocioso: 0.5, pausa: 0.24 };          /* já compensa o sombreado gravado no boneco */
    var BRILHO_TELA = { trabalhando: 1.0, reuniao: 0.3, ocioso: 0.4, pausa: 0.1 };      /* o monitor acompanha o estado do agente */
    var destaque = null;   /* agente sob o ponteiro: { a, i } */
    var escolhido = null;  /* agente selecionado: { a, i } */

    function corAgente(a, i, alvo) {
      var ag = a.def.agentes[i];
      alvo.copy(a.cor).multiplyScalar(FATOR[ag.status] || 1);
      if (ag.status === 'reuniao') alvo.lerp(BRANCO, 0.55);
      if ((destaque && destaque.a === a && destaque.i === i) || (escolhido && escolhido.a === a && escolhido.i === i)) alvo.set(2.2, 2.2, 2.2);
      return alvo;
    }
    function corTela(a, i, alvo) {
      var ag = a.def.agentes[i];
      return alvo.copy(a.cor).multiplyScalar(ag.movel && !calmo ? 0.12 : (BRILHO_TELA[ag.status] || 0.5));
    }
    /* cor da camisa nas duas malhas (sentados e em pé) */
    function corDaCamisa(a, i, cor) {
      a.agentes.setColorAt(i, cor); a.agentes.instanceColor.needsUpdate = true;
      var j = a.posPe[i]; if (j != null) { a.agentesPe.setColorAt(j, cor); a.agentesPe.instanceColor.needsUpdate = true; }
    }
    function marcarPosicoes(a) { a.agentes.instanceMatrix.needsUpdate = true; a.agentesPe.instanceMatrix.needsUpdate = true; }
    function pintar(a, i) {
      corDaCamisa(a, i, corAgente(a, i, corTmp));
      a.telas.setColorAt(i, corTela(a, i, corTmp)); a.telas.instanceColor.needsUpdate = true;
    }
    function posicionar(a, i, t) {
      var ag = a.def.agentes[i], j = a.posPe[i], anda = ag.movel && !calmo;
      if (anda) {
        /* quem circula caminha pelo vão atrás da própria fileira, sem sair da sala, olhando para onde vai */
        var fase = t * 0.32 + ag.fase, ang = ag.ang + Math.sin(fase) * a.vai[i], raio = ag.raio + 0.22;
        dummy.position.set(Math.cos(ang) * raio, PISO, Math.sin(ang) * raio);
        dummy.rotation.set(0, Math.cos(fase) >= 0 ? Math.PI - ang : -ang, 0);
        dummy.scale.setScalar(a.escala[i]); dummy.updateMatrix();
        a.agentesPe.setMatrixAt(j, dummy.matrix);
        dummy.scale.setScalar(0); dummy.updateMatrix(); a.agentes.setMatrixAt(i, dummy.matrix);
      } else {
        /* sentado na cadeira, de frente para a mesa (a mesma rotação da estação de trabalho) */
        dummy.position.set(ag.x, PISO, ag.z); dummy.rotation.set(0, Math.PI / 2 - ag.ang, 0);
        dummy.scale.setScalar(a.escala[i]); dummy.updateMatrix();
        a.agentes.setMatrixAt(i, dummy.matrix);
        if (j != null) { dummy.scale.setScalar(0); dummy.updateMatrix(); a.agentesPe.setMatrixAt(j, dummy.matrix); }
      }
      dummy.rotation.set(0, 0, 0);
    }
    andares.forEach(function (a) {
      for (var i = 0; i < a.def.agentes.length; i++) { posicionar(a, i, 0); pintar(a, i); }
      marcarPosicoes(a);
      a.agentes.computeBoundingSphere();
    });

    /* destaque de sala: uma mancha de luz no chão da sala sob o ponteiro e outra na sala aberta */
    function luzDeSala(opacidade) {
      var m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(aditivo({ color: 0xffffff, side: THREE.DoubleSide, opacity: opacidade })));
      m.visible = false; m.userData.a = null; m.userData.k = -1;
      return m;
    }
    var luzSobre = luzDeSala(0.12), luzAberta = luzDeSala(0.07);
    function acender(luz, a, k) {
      if (!a || k < 0 || !a.def.setores[k]) { luz.visible = false; return; }
      if (luz.userData.a !== a || luz.userData.k !== k) {
        var s = a.def.setores[k], m = new Malha();
        faixaChao(m, R_SALA, R, s.ini, s.fim, PISO + 0.02);
        luz.geometry.dispose(); luz.geometry = m.geo();
        luz.material.color.copy(a.cor); luz.userData.a = a; luz.userData.k = k; a.g.add(luz);
      }
      luz.visible = true;
    }

    var pulsos = [];
    function pulsoAgente(n, i) {
      var a = andares[n - 1];
      if (!a || i == null || i < 0 || i >= a.def.agentes.length || pulsos.length > 60) return;
      pulsos.push({ a: a, i: i, t: 0 });
    }

    /* marcador do agente selecionado */
    var marcador = new THREE.Group(); marcador.visible = false;
    var anelSel = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.37, 40), new THREE.MeshBasicMaterial({ color: hdr(0xffffff, 2.2), side: THREE.DoubleSide, transparent: true, depthWrite: false }));
    anelSel.rotation.x = -Math.PI / 2; anelSel.position.y = 0.03; marcador.add(anelSel);
    var feixe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.5, 6), new THREE.MeshBasicMaterial(aditivo({ color: hdr(0xffffff, 1.6), opacity: 0.6 })));
    feixe.position.y = 1.85; marcador.add(feixe);

    /* ==========================================================================
       PACOTES DE INFORMAÇÃO
       ======================================================================== */
    var MAXP = 72, RASTRO = 3, pacotes = [];
    var meshPac = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXP * RASTRO);
    meshPac.instanceMatrix.setUsage(THREE.DynamicDrawUsage); meshPac.frustumCulled = false;
    for (var q = 0; q < MAXP * RASTRO; q++) meshPac.setColorAt(q, BRANCO);
    meshPac.count = 0; scene.add(meshPac);

    var P = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], DUR = [0, 0, 0, 0], vPac = new THREE.Vector3();

    function lugar(n, i) {
      var a = andares[n - 1];
      if (!a || i == null || i < 0) return null;
      var ag = a.def.agentes[i];
      return ag ? { x: ag.x, z: ag.z } : null;
    }
    /* o: { de, para, via, agDe, agPara, destaque, suave, doCentro } */
    function pacote(o) {
      if (pacotes.length >= MAXP || !andares[o.de - 1] || !andares[o.para - 1]) return;
      var a = o.doCentro ? { x: 0, z: 0 } : (lugar(o.de, o.agDe) || { x: 0, z: 0 }), b = lugar(o.para, o.agPara) || { x: 0, z: 0 };
      pacotes.push({
        de: o.de - 1, para: o.para - 1, via: !!o.via && o.de !== IB + 1 && o.para !== IB + 1 && o.de !== o.para,
        ax: a.x, az: a.z, bx: b.x, bz: b.z, agPara: o.agPara, t: 0, suave: !!o.suave, doCentro: !!o.doCentro,
        cor: andares[o.de - 1].cor.clone().multiplyScalar(o.suave ? 1.2 : 2.6), tam: o.destaque ? 1.9 : o.suave ? 0.6 : 1
      });
    }
    function trajeto(p) {
      var ya = andares[p.de].g.position.y, yb = andares[p.para].g.position.y, k = 0;
      P[0].set(p.ax, ya + 0.8, p.az);
      if (p.de === p.para) {
        P[1].set((p.ax + p.bx) / 2, ya + 2.0, (p.az + p.bz) / 2); P[2].set(p.bx, yb + 0.8, p.bz);
        DUR[0] = DUR[1] = 0.32; return 3;
      }
      if (!p.doCentro) { P[++k].set(0, ya + 1.5, 0); DUR[k - 1] = 0.4; } else P[0].set(0, ya + 1.75, 0);
      if (p.via) { var yc = andares[IB].g.position.y + 1.75; P[++k].set(0, yc, 0); DUR[k - 1] = Math.max(0.2, Math.abs(yc - P[k - 1].y) / 58); }
      P[++k].set(0, yb + 1.5, 0); DUR[k - 1] = Math.max(0.2, Math.abs(P[k].y - P[k - 1].y) / 58);
      P[++k].set(p.bx, yb + 0.8, p.bz); DUR[k - 1] = 0.4;
      return k + 1;
    }
    function noTrajeto(n, t, out) {
      if (t <= 0) return out.copy(P[0]);
      for (var s = 0; s < n - 1; s++) {
        if (t <= DUR[s]) { var u = t / DUR[s]; u = u * u * (3 - 2 * u); return out.lerpVectors(P[s], P[s + 1], u); }
        t -= DUR[s];
      }
      return out.copy(P[n - 1]);
    }
    function atualizarPacotes(dt) {
      var k = 0;
      for (var i = pacotes.length - 1; i >= 0; i--) {
        var p = pacotes[i], n = trajeto(p), total = 0, s;
        for (s = 0; s < n - 1; s++) total += DUR[s];
        p.t += dt;
        if (p.t >= total) {
          if (!p.suave) { andares[p.para].flash = Math.min(1.4, andares[p.para].flash + (p.tam > 1.5 ? 1.2 : 0.55)); pulsoAgente(p.para + 1, p.agPara); }
          pacotes.splice(i, 1); continue;
        }
        for (s = 0; s < RASTRO; s++) {
          noTrajeto(n, p.t - s * 0.05, vPac);
          dummy.position.copy(vPac); dummy.scale.setScalar(p.tam * (1 - s * 0.28)); dummy.updateMatrix();
          meshPac.setMatrixAt(k, dummy.matrix); meshPac.setColorAt(k, p.cor); k++;
        }
      }
      meshPac.count = k;
      meshPac.instanceMatrix.needsUpdate = true;
      if (meshPac.instanceColor) meshPac.instanceColor.needsUpdate = true;
    }
    function difundir() {
      var c = andares[IB];
      if (c.peca && c.peca.pulsar) c.peca.pulsar();
      for (var i = 1; i <= N; i++) if (i !== IB + 1) pacote({ de: IB + 1, para: i, doCentro: true, agPara: Math.floor(Math.random() * ANDARES[i - 1].agentes.length) });
      c.flash = 1.2;
    }

    /* ==========================================================================
       CÂMERA
       ======================================================================== */
    var larg = 1, alt = 1, sel = -1, sala = -1, livroFoco = -1, voo = null, margemAlvo = 0, margem = 0;
    var alvoGeral = new THREE.Vector3(0, TOPO * 0.5 + 0.5, 0);

    function destino(alvo, dist, elev) {
      var az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
      return new THREE.Vector3(alvo.x + Math.sin(az) * Math.cos(elev) * dist, alvo.y + Math.sin(elev) * dist, alvo.z + Math.cos(az) * Math.cos(elev) * dist);
    }
    function tg() { return Math.tan(camera.fov * Math.PI / 360); }
    function distGeral() {
      var asp = Math.max(0.3, (larg - margemAlvo) / alt);
      return Math.max((TOPO + 9) / 2 * 1.15 / tg(), 15.5 / (tg() * asp));
    }
    function distAndar() {
      var asp = Math.max(0.3, (larg - margemAlvo) / alt);
      return Math.max(8.6 / tg(), (R + 1.4) / (tg() * asp));
    }
    /* emArco: contorna a torre (interpola ângulo, raio e altura) em vez de atravessá-la em linha reta */
    function voar(pos, alvo, dur, emArco) {
      voo = { p0: camera.position.clone(), a0: controls.target.clone(), p1: pos, a1: alvo, t: 0, dur: calmo ? 0.01 : dur, arco: null };
      if (emArco) {
        var r0 = Math.hypot(voo.p0.x, voo.p0.z), r1 = Math.hypot(pos.x, pos.z), g0 = Math.atan2(voo.p0.z, voo.p0.x), dg = Math.atan2(pos.z, pos.x) - g0;
        while (dg > Math.PI) dg -= Math.PI * 2;
        while (dg < -Math.PI) dg += Math.PI * 2;
        if (r0 > 0.5 && r1 > 0.5) voo.arco = { r0: r0, r1: r1, g0: g0, dg: dg };
      }
      controls.enabled = false;
    }
    /* marca qual andar está aberto (sem mexer na câmera) */
    function escolherAndar(i) {
      sel = i;
      if (elRotulos) elRotulos.classList.toggle('oculto', i >= 0);
      rotularSalas(i);
      controls.minDistance = i < 0 ? 6 : 2.5;
    }
    function irPara(n, o) {
      n = Math.max(0, Math.min(N, n | 0));
      limparFoco();
      escolherAndar(n - 1);
      sala = -1; acender(luzAberta, null, -1);
      var alvo = n === 0 ? alvoGeral.clone() : new THREE.Vector3(0, BASE + (n - 1) * H + 0.9, 0);
      voar(destino(alvo, n === 0 ? distGeral() : distAndar(), n === 0 ? 0.2 : 0.66), alvo, o && o.rapido ? 0.01 : 1.5);
      controls.autoRotate = !calmo; controls.autoRotateSpeed = n === 0 ? 0.35 : 0.1;
    }
    /* zoom em uma sala: a câmera vai para junto da fachada e olha para dentro, na direção da porta */
    function irParaSala(n, k, o) {
      var a = andares[n - 1];
      if (!a || !a.def.setores[k]) return;
      limparFoco();
      escolherAndar(n - 1);
      sala = k; acender(luzAberta, a, k);
      var s = a.def.setores[k], y = BASE + (n - 1) * H, estreita = (larg - margemAlvo) / alt < 0.9;
      var longe = estreita ? 17.5 : 14.4, alto = estreita ? 8 : 5;
      var alvo = new THREE.Vector3(Math.cos(s.meio) * 4.8, y + 0.8, Math.sin(s.meio) * 4.8);
      voar(new THREE.Vector3(Math.cos(s.meio) * longe, y + alto, Math.sin(s.meio) * longe), alvo, o && o.rapido ? 0.01 : 1.5, true);
      controls.autoRotate = false;
    }
    function focarAgente(n, i) {
      var a = andares[n - 1];
      if (!a || !a.def.agentes[i]) return;
      if (sel !== n - 1) { escolherAndar(n - 1); sala = -1; acender(luzAberta, null, -1); }
      soltarLivro();
      var antigo = escolhido, ag = a.def.agentes[i];
      escolhido = { a: a, i: i };
      if (antigo) pintar(antigo.a, antigo.i);
      pintar(a, i);
      a.g.add(marcador); marcador.position.set(ag.x, PISO, ag.z); marcador.visible = true;
      var alvo = new THREE.Vector3(ag.x, BASE + (n - 1) * H + 0.5, ag.z);
      voar(destino(alvo, 7.5, 0.55), alvo, 1.1);
      controls.autoRotate = !calmo; controls.autoRotateSpeed = 0.1;
    }
    /* aproxima a câmera de um livro da estante do andar de estudo (a estante para de girar) */
    function focarLivro(i) {
      var a = IE >= 0 ? andares[IE] : null, p = a && a.peca;
      if (!p || !p.livros || !p.livros[i]) return;
      limparFoco();
      escolherAndar(IE);
      sala = -1; acender(luzAberta, null, -1);
      p.focar(i); livroFoco = i;
      var ang = p.angulo(i), y = BASE + IE * H + p.altura(i), longe = (larg - margemAlvo) / alt < 0.9 ? 9 : 6.4;
      var alvo = new THREE.Vector3(Math.cos(ang) * 1.6, y, Math.sin(ang) * 1.6);
      voar(new THREE.Vector3(Math.cos(ang) * longe, y + 0.5, Math.sin(ang) * longe), alvo, 1.3, true);
      controls.autoRotate = false;
    }
    function soltarLivro() {
      if (livroFoco < 0) return;
      livroFoco = -1;
      if (IE >= 0 && andares[IE].peca && andares[IE].peca.soltar) andares[IE].peca.soltar();
    }
    function limparFoco() {
      soltarLivro();
      if (!escolhido) return;
      var e = escolhido; escolhido = null; pintar(e.a, e.i); marcador.visible = false;
    }
    function entrar() {
      camera.position.copy(destino(alvoGeral, 150, 0.52));
      controls.target.copy(alvoGeral);
      voar(destino(alvoGeral, distGeral(), 0.2), alvoGeral.clone(), 3.4);
    }

    /* ==========================================================================
       RÓTULOS DOS ANDARES (HTML por cima do 3D, só na visão geral)
       ======================================================================== */
    var elRotulos = document.getElementById('rotulos'), rotulos = [], passandoAndar = -1, vDir = new THREE.Vector3(), vRot = new THREE.Vector3();
    if (elRotulos) ANDARES.forEach(function (def, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'rotulo'; b.tabIndex = -1; b.style.setProperty('--cor', def.cor);
      b.innerHTML = '<i>' + T.fmt.dois(def.n) + '</i><b>' + T.esc(def.nome) + '</b><span>' + T.fmt.int(def.agentes.length) + ' agentes</span>';
      b.addEventListener('click', function () { if (cb.aoClicarAndar) cb.aoClicarAndar(def.n); });
      b.addEventListener('pointerenter', function () { passandoAndar = i; });
      b.addEventListener('pointerleave', function () { if (passandoAndar === i) passandoAndar = -1; });
      elRotulos.appendChild(b); rotulos.push(b);
    });
    function atualizarRotulos() {
      if (!rotulos.length || sel !== -1) return;
      vDir.setFromMatrixColumn(camera.matrixWorld, 0);
      for (var i = 0; i < N; i++) {
        vRot.set(0, andares[i].g.position.y + H * 0.5, 0).addScaledVector(vDir, R + 1.0).project(camera);
        var x = (vRot.x * 0.5 + 0.5) * larg, y = (-vRot.y * 0.5 + 0.5) * alt, ok = vRot.z < 1 && x > 0 && x < larg - 120 && y > 60 && y < alt - 30;
        rotulos[i].style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translateY(-50%)';
        rotulos[i].style.opacity = ok ? '' : '0';
        rotulos[i].style.pointerEvents = ok ? '' : 'none';
        rotulos[i].classList.toggle('ativo', passandoAndar === i);
      }
    }

    /* ==========================================================================
       RÓTULOS DAS SALAS (aparecem quando um andar está aberto; clicar entra na sala)
       ======================================================================== */
    var elSalas = null, rotSalas = [], andarRotulado = -1, salaRotulo = -1, salaSob = -1, livroSob = -1;
    if (elRotulos && elRotulos.parentNode) {
      elSalas = document.createElement('div');
      elSalas.className = 'rotulos rotulos-salas'; elSalas.setAttribute('aria-hidden', 'true');
      elRotulos.parentNode.insertBefore(elSalas, elRotulos.nextSibling);
    }
    function rotularSalas(i) {
      if (!elSalas || andarRotulado === i) return;
      andarRotulado = i; salaRotulo = -1; rotSalas = []; elSalas.textContent = '';
      if (i < 0) return;
      var def = ANDARES[i];
      def.squads.forEach(function (s, k) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'rotulo rotulo-sala'; b.tabIndex = -1; b.style.setProperty('--cor', def.cor);
        b.innerHTML = '<i>' + (k + 1) + '</i><b>' + T.esc(s.nome) + '</b><span>' + T.fmt.int(s.qtd || 0) + '</span>';
        b.addEventListener('click', function () { if (cb.aoClicarSala) cb.aoClicarSala(def.n, k); });
        b.addEventListener('pointerenter', function () { salaRotulo = k; });
        b.addEventListener('pointerleave', function () { if (salaRotulo === k) salaRotulo = -1; });
        elSalas.appendChild(b); rotSalas.push(b);
      });
    }
    function atualizarRotulosSalas() {
      if (!rotSalas.length || sel < 0) return;
      var a = andares[sel], limite = larg - margemAlvo - 20;
      for (var k = 0; k < rotSalas.length; k++) {
        var s = a.def.setores[k];
        /* o rótulo flutua sobre o meio da sala; o da sala em que você já está fica escondido */
        vRot.set(Math.cos(s.meio) * 6.4, a.g.position.y + 1.7, Math.sin(s.meio) * 6.4).project(camera);
        var x = (vRot.x * 0.5 + 0.5) * larg, y = (-vRot.y * 0.5 + 0.5) * alt;
        var ok = !voo && k !== sala && livroFoco < 0 && !escolhido && vRot.z < 1 && x > 90 && x < limite && y > 96 && y < alt - 46;
        rotSalas[k].style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-50%)';
        rotSalas[k].style.opacity = ok ? '' : '0';
        rotSalas[k].style.pointerEvents = ok ? '' : 'none';
        rotSalas[k].classList.toggle('ativo', salaRotulo === k || salaSob === k || sala === k);
      }
    }

    /* ==========================================================================
       PONTEIRO: passar o mouse e clicar em andares e agentes
       ======================================================================== */
    var raio = new THREE.Raycaster(), ponteiro = new THREE.Vector2(), precisaRaio = false, apertou = null, px = 0, py = 0;

    /* O que está sob o ponteiro, por ordem de prioridade:
       livro da estante → agente (só com uma sala aberta) → sala do andar aberto → outro andar.
       Com o andar aberto e nenhuma sala escolhida, a sala inteira é o alvo do clique:
       assim "clicar no grupo" sempre entra na sala, mesmo acertando um boneco. */
    function apontarLivro(i) {
      if (i === livroSob) return;
      livroSob = i;
      var p = IE >= 0 ? andares[IE].peca : null;
      if (p && p.apontar) p.apontar(i);
    }
    function lancarRaio() {
      raio.setFromCamera(ponteiro, camera);
      var novo = null, andarSob = -1, livro = -1, novaSala = -1, hits, a = sel >= 0 ? andares[sel] : null;
      if (a) {
        if (a.peca && a.peca.livros) { hits = raio.intersectObjects(a.peca.livros, false); if (hits.length) livro = hits[0].object.userData.livro; }
        if (livro < 0 && sala >= 0) {
          hits = raio.intersectObjects([a.agentes, a.agentesPe], false);
          /* na malha "em pé", o número da instância vira o número do agente */
          if (hits.length && hits[0].instanceId != null) novo = { a: a, i: hits[0].object === a.agentesPe ? a.moveis[hits[0].instanceId] : hits[0].instanceId };
        }
        if (livro < 0 && !novo) {
          var o = raio.ray.origin, d = raio.ray.direction, dist = d.y < -0.0001 ? (a.g.position.y + PISO - o.y) / d.y : -1;
          if (dist > 0) novaSala = T.salaEm(a.def, o.x + d.x * dist, o.z + d.z * dist);
          if (novaSala >= 0 && novaSala === sala) novaSala = -2;   /* já está dentro desta sala: nada a destacar */
        }
      }
      if (!novo && livro < 0 && novaSala === -1) {
        hits = raio.intersectObjects(toques, false);
        if (hits.length && hits[0].object.userData.andar !== sel) andarSob = hits[0].object.userData.andar;
      }
      apontarLivro(livro);
      salaSob = novaSala >= 0 ? novaSala : -1;
      if ((novo && (!destaque || destaque.a !== novo.a || destaque.i !== novo.i)) || (!novo && destaque)) {
        var antigo = destaque; destaque = novo;
        if (antigo) { antigo.a.escala[antigo.i] = 1; pintar(antigo.a, antigo.i); posicionar(antigo.a, antigo.i, tAgora); marcarPosicoes(antigo.a); }
        if (novo) { novo.a.escala[novo.i] = 1.7; pintar(novo.a, novo.i); posicionar(novo.a, novo.i, tAgora); marcarPosicoes(novo.a); }
      }
      passandoAndar = andarSob;
      canvas.style.cursor = novo || andarSob >= 0 || salaSob >= 0 || livro >= 0 ? 'pointer' : '';
      if (cb.aoPassar) {
        cb.aoPassar(novo ? { tipo: 'agente', andar: novo.a.def.n, idx: novo.i, x: px, y: py }
          : livro >= 0 ? { tipo: 'livro', livro: livro, x: px, y: py }
          : salaSob >= 0 ? { tipo: 'sala', andar: sel + 1, sala: salaSob, x: px, y: py }
          : andarSob >= 0 ? { tipo: 'andar', andar: andarSob + 1, x: px, y: py } : null);
      }
    }
    function lerPonteiro(e) {
      var b = canvas.getBoundingClientRect();
      px = e.clientX; py = e.clientY;
      ponteiro.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    }
    canvas.addEventListener('pointermove', function (e) { lerPonteiro(e); precisaRaio = true; });
    canvas.addEventListener('pointerleave', function () { passandoAndar = -1; salaSob = -1; apontarLivro(-1); precisaRaio = false; if (cb.aoPassar) cb.aoPassar(null); });
    canvas.addEventListener('pointerdown', function (e) { apertou = { x: e.clientX, y: e.clientY, t: Date.now() }; });
    canvas.addEventListener('pointerup', function (e) {
      if (!apertou) return;
      var moveu = Math.abs(e.clientX - apertou.x) + Math.abs(e.clientY - apertou.y), demorou = Date.now() - apertou.t;
      apertou = null;
      if (moveu > 7 || demorou > 650 || voo) return;
      lerPonteiro(e); lancarRaio();
      if (destaque) { if (cb.aoClicarAgente) cb.aoClicarAgente(destaque.a.def.n, destaque.i); }
      else if (livroSob >= 0) { if (cb.aoClicarLivro) cb.aoClicarLivro(livroSob); }
      else if (salaSob >= 0) { if (cb.aoClicarSala) cb.aoClicarSala(sel + 1, salaSob); }
      else if (passandoAndar >= 0) { if (cb.aoClicarAndar) cb.aoClicarAndar(passandoAndar + 1); }
      else if (cb.aoClicarVazio) cb.aoClicarVazio();
    });

    /* ==========================================================================
       TAMANHO DA TELA E QUALIDADE
       ======================================================================== */
    function redimensionar() {
      larg = Math.max(1, canvas.clientWidth || root.innerWidth); alt = Math.max(1, canvas.clientHeight || root.innerHeight);
      renderer.setSize(larg, alt, false);
      composer.setSize(larg, alt);
      camera.aspect = larg / alt;
      aplicarMargem();
    }
    function aplicarMargem() {
      if (Math.abs(margem) > 0.5) camera.setViewOffset(larg, alt, margem / 2, 0, larg, alt);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }
    function qualidade(q) {
      modo = q === 'leve' ? 'leve' : 'alta';
      var pr = modo === 'alta' ? Math.min(root.devicePixelRatio || 1, 1.5) : 1;
      renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
      redimensionar();
    }
    root.addEventListener('resize', redimensionar);

    /* ==========================================================================
       LAÇO DE ANIMAÇÃO
       ======================================================================== */
    var tAntes = 0, tAgora = 0, proxAmbiente = 0, medidas = [], vigiar = cb.vigiarDesempenho !== false, inicioMs = 0;

    function quadro(ms) {
      root.requestAnimationFrame(quadro);
      var t = ms / 1000, dt = Math.min(0.05, Math.max(0.001, t - tAntes)), i;
      tAntes = t; tAgora = t;
      if (!inicioMs) inicioMs = ms;

      /* se a máquina não der conta do brilho, muda sozinha para o modo leve */
      if (vigiar && modo === 'alta' && ms - inicioMs > 6000 && !document.hidden) {
        medidas.push(dt);
        if (medidas.length >= 90) {
          var soma = 0; for (i = 0; i < medidas.length; i++) soma += medidas[i];
          medidas = [];
          if (soma / 90 > 0.042) { vigiar = false; qualidade('leve'); if (cb.aoBaixarQualidade) cb.aoBaixarQualidade(); }
        }
      }

      /* andares: abre espaço acima do andar escolhido, brilho, peça central */
      for (i = 0; i < N; i++) {
        var a = andares[i], yAlvo = BASE + i * H + (sel >= 0 && i > sel ? LIFT : 0);
        a.g.position.y += (yAlvo - a.g.position.y) * Math.min(1, dt * 4.2);
        var alvoB = (passandoAndar === i ? 1 : 0) + (sel === i ? 0.5 : 0) + a.flash;
        a.brilho += (alvoB - a.brilho) * Math.min(1, dt * 9);
        a.flash = Math.max(0, a.flash - dt * 2.4);
        a.matAro.color.copy(a.cor).multiplyScalar(1.7 + a.brilho * 1.9);
        a.matVidro.opacity = 0.045 + Math.min(1.5, a.brilho) * 0.05;
        /* mesas e mobília só são desenhadas no andar aberto; os monitores acesos aparecem na torre toda (menos no modo leve) */
        a.estacoes.visible = a.mobilia.visible = sel === i;
        a.telas.visible = sel === i || modo === 'alta';
        a.aroTopo.visible = !(sel === i && (sala >= 0 || livroFoco >= 0));   /* de dentro da sala, o aro do teto cortaria a vista */
        a.teloes.visible = sel === i && sala >= 0;
        if (a.peca) a.peca.atualizar(t, dt);
        if (!calmo && a.moveis.length) {
          for (var m = 0; m < a.moveis.length; m++) posicionar(a, a.moveis[m], t);
          marcarPosicoes(a);
        }
      }

      /* pulsos dos agentes que acabaram de receber algo */
      for (i = pulsos.length - 1; i >= 0; i--) {
        var p = pulsos[i]; p.t += dt;
        var fim = p.t >= 0.55, s = fim ? 0 : Math.sin(Math.PI * p.t / 0.55), sobPonteiro = destaque && destaque.a === p.a && destaque.i === p.i;
        if (!sobPonteiro) {
          p.a.escala[p.i] = 1 + s * 1.3;
          posicionar(p.a, p.i, t);
          corDaCamisa(p.a, p.i, corAgente(p.a, p.i, corTmp).lerp(BRANCO, s * 0.9));
          marcarPosicoes(p.a);
        }
        if (fim) pulsos.splice(i, 1);
      }

      /* tráfego de fundo no núcleo, para a torre nunca parecer parada */
      if (!calmo && t > proxAmbiente) {
        proxAmbiente = t + 0.5 + Math.random() * 0.7;
        var de = 1 + Math.floor(Math.random() * N), para = 1 + Math.floor(Math.random() * N);
        if (de !== para) pacote({ de: de, para: para, via: Math.random() < 0.5, suave: true, agDe: Math.floor(Math.random() * ANDARES[de - 1].agentes.length), agPara: Math.floor(Math.random() * ANDARES[para - 1].agentes.length) });
      }
      atualizarPacotes(dt);

      matNucleo.uniforms.uTempo.value = t;
      matNucleo.uniforms.uTopo.value = andares[N - 1].g.position.y + 2 - BASE;
      if (marcador.visible) { anelSel.scale.setScalar(1 + 0.18 * Math.sin(t * 5)); feixe.material.opacity = 0.45 + 0.2 * Math.sin(t * 5); }

      /* quanto mais perto a câmera, menos brilho: de dentro da sala o excesso de luz esconderia os móveis */
      var brilhoAlvo = sel < 0 ? 0.6 : (sala >= 0 || escolhido || livroFoco >= 0) ? 0.14 : 0.4;
      bloom.strength += (brilhoAlvo - bloom.strength) * Math.min(1, dt * 3);

      /* salas: luz na que está sob o ponteiro (ou sob o rótulo) e na que está aberta */
      var salaLuz = salaRotulo >= 0 ? salaRotulo : salaSob;
      acender(luzSobre, sel >= 0 && salaLuz >= 0 && salaLuz !== sala ? andares[sel] : null, salaLuz);
      if (luzAberta.visible) luzAberta.material.opacity = 0.06 + 0.02 * Math.sin(t * 2.2);

      /* câmera: voo suave até o destino, depois o usuário assume */
      if (voo) {
        voo.t += dt;
        var u = Math.min(1, voo.t / voo.dur); u = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        if (voo.arco) {
          var giroVoo = voo.arco.g0 + voo.arco.dg * u, raioVoo = voo.arco.r0 + (voo.arco.r1 - voo.arco.r0) * u;
          camera.position.set(Math.cos(giroVoo) * raioVoo, voo.p0.y + (voo.p1.y - voo.p0.y) * u, Math.sin(giroVoo) * raioVoo);
        } else camera.position.lerpVectors(voo.p0, voo.p1, u);
        controls.target.lerpVectors(voo.a0, voo.a1, u);
        camera.lookAt(controls.target);
        if (u >= 1) { voo = null; controls.enabled = true; }
      } else {
        controls.update(dt);
      }
      if (Math.abs(margemAlvo - margem) > 0.5) { margem += (margemAlvo - margem) * Math.min(1, dt * 5); aplicarMargem(); }

      if (precisaRaio && !voo) { precisaRaio = false; lancarRaio(); }
      atualizarRotulos();
      atualizarRotulosSalas();

      if (modo === 'alta') composer.render(dt); else renderer.render(scene, camera);
    }

    qualidade(cb.qualidade || 'alta');
    camera.position.set(Math.sin(0.6) * 150 * 0.86, alvoGeral.y + 150 * 0.5, Math.cos(0.6) * 150 * 0.86);
    controls.target.copy(alvoGeral);
    camera.lookAt(alvoGeral);
    root.requestAnimationFrame(quadro);

    return {
      vazia: false,
      irPara: irPara,
      irParaSala: irParaSala,
      focarAgente: focarAgente,
      focarLivro: focarLivro,
      limparFoco: limparFoco,
      entrar: entrar,
      pacote: pacote,
      pulsoAgente: pulsoAgente,
      difundir: difundir,
      statusAgente: function (n, i) { var a = andares[n - 1]; if (a && a.def.agentes[i]) pintar(a, i); },
      margemDireita: function (px) { margemAlvo = Math.max(0, px || 0); },
      qualidade: qualidade,
      qualidadeAtual: function () { return modo; },
      reuniaoAtiva: function (b) { var p = IR >= 0 ? andares[IR].peca : null; if (p && p.reuniao) p.reuniao(b); },
      orcamento: function (fracao) { var p = IF >= 0 ? andares[IF].peca : null; if (p && p.orcamento) p.orcamento(fracao); },
      andarAtual: function () { return sel + 1; },
      salaAtual: function () { return sala; }
    };
  };
})(window);
