/* ============================================================================
   TORRE — cena 3D (Three.js)
   ----------------------------------------------------------------------------
   Desenha a torre de 8 andares, os agentes (um boneco por agente, desenhados
   em lote para ficar leve), o núcleo de dados que liga tudo ao Mega Brain e os
   pacotes de informação que viajam entre os andares.

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
    return { vazia: true, irPara: f, focarAgente: f, limparFoco: f, pacote: f, pulsoAgente: f, difundir: f, statusAgente: f, margemDireita: f, qualidade: f, reuniaoAtiva: f, orcamento: f, entrar: f, andarAtual: function () { return 0; } };
  };

  T.criarCena = function (L, canvas, cb) {
    cb = cb || {};
    var THREE = L.THREE, GEO = T.GEO, ANDARES = T.ANDARES, N = ANDARES.length;
    var R = GEO.RAIO, H = 3.2, LIFT = 13, BASE = 0.7, PISO = 0.22;
    var TOPO = BASE + N * H;
    var FUNDO = 0x05070d;
    var calmo = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /* ---------- renderizador, cena, câmera ---------- */
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
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
    var bloom = new L.UnrealBloomPass(new THREE.Vector2(4, 4), 0.6, 0.6, 0.22);
    composer.addPass(bloom);
    composer.addPass(new L.OutputPass());
    var modo = 'alta';

    var dummy = new THREE.Object3D(), corTmp = new THREE.Color(), BRANCO = new THREE.Color(1, 1, 1);
    function hdr(hex, k) { return new THREE.Color(hex).multiplyScalar(k); }
    function texturaDe(c) { var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; }
    function aditivo(o) { o.transparent = true; o.depthWrite = false; o.blending = THREE.AdditiveBlending; return o; }

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
        '  float anel = 1.0 - min(abs(fract(g1 - 0.5) - 0.5) / fwidth(g1), 1.0);',
        '  float g2 = atan(vXZ.y, vXZ.x) / 0.2617994;',
        '  float raio = (1.0 - min(abs(fract(g2 - 0.5) - 0.5) / fwidth(g2), 1.0)) * step(13.0, r);',
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
    function texturaPiso(def) {
      var c = document.createElement('canvas'); c.width = c.height = 1024;
      var x = c.getContext('2d'), e = 512 / R, i;
      x.translate(512, 512);
      x.strokeStyle = def.cor; x.fillStyle = def.cor;
      x.lineWidth = 1.5; x.globalAlpha = 0.3;
      for (i = 0; i < GEO.MAX_ANEIS; i++) { x.beginPath(); x.arc(0, 0, (GEO.R0 + i * GEO.PASSO - GEO.PASSO / 2) * e, 0, Math.PI * 2); x.stroke(); }
      var set = T.setores(def.squads.map(function (s) { return s.peso; }));
      x.font = '600 19px system-ui, "Segoe UI", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      set.forEach(function (s, k) {
        x.globalAlpha = 0.55; x.lineWidth = 2;
        x.beginPath(); x.moveTo(Math.cos(s.ini) * 2.45 * e, Math.sin(s.ini) * 2.45 * e); x.lineTo(Math.cos(s.ini) * 9.86 * e, Math.sin(s.ini) * 9.86 * e); x.stroke();
        x.save(); x.rotate((s.ini + s.fim) / 2); x.translate(9.45 * e, 0); x.rotate(Math.PI / 2);
        x.globalAlpha = 0.9; x.fillText(def.squads[k].nome.toUpperCase(), 0, 0); x.restore();
      });
      x.globalAlpha = 0.8; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 2.3 * e, 0, Math.PI * 2); x.stroke();
      x.globalAlpha = 0.5; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 9.9 * e, 0, Math.PI * 2); x.stroke();
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
        var trilho = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.03, 6, 96), new THREE.MeshBasicMaterial({ color: hdr(cor.getHex(), 0.5) }));
        trilho.rotation.x = Math.PI / 2; trilho.position.y = PISO + 0.06; g.add(trilho);
        var matArco = new THREE.MeshBasicMaterial({ color: hdr(cor.getHex(), 2.6) }), arco = null;
        function definir(p) {
          if (arco) { g.remove(arco); arco.geometry.dispose(); }
          arco = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.07, 8, 96, Math.PI * 2 * Math.max(0.01, Math.min(1, p))), matArco);
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
        var cupula = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(R, 22, 6, 0, Math.PI * 2, 0, Math.PI / 2)), new THREE.LineBasicMaterial(aditivo({ color: hdr(cor.getHex(), 1.3), opacity: 0.16 })));
        cupula.scale.y = 0.42; cupula.position.y = H - 0.2; g.add(cupula);
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
      }
    };

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
    var corpo = new THREE.CylinderGeometry(0.085, 0.125, 0.32, 6); corpo.translate(0, 0.16, 0);
    var cabeca = new THREE.SphereGeometry(0.098, 8, 6); cabeca.translate(0, 0.43, 0);
    var geoAgente = L.mergeGeometries([corpo, cabeca]);
    var matAgente = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var toques = [];

    var andares = ANDARES.map(function (def, i) {
      var g = new THREE.Group(); g.position.y = BASE + i * H; scene.add(g);
      var cor = new THREE.Color(def.cor);

      var laje = new THREE.Mesh(geoLaje, matLaje); laje.position.y = PISO / 2; g.add(laje);
      var matAro = new THREE.MeshBasicMaterial({ color: cor.clone().multiplyScalar(1.7) });
      var aro = new THREE.Mesh(geoAro, matAro); aro.rotation.x = Math.PI / 2; aro.position.y = PISO; g.add(aro);
      var aro2 = new THREE.Mesh(geoAroFino, matAro); aro2.rotation.x = Math.PI / 2; aro2.position.y = H - 0.1; g.add(aro2);

      var planta = new THREE.Mesh(geoPlanta, new THREE.MeshBasicMaterial(aditivo({ map: texturaPiso(def), opacity: 0.95 })));
      planta.rotation.x = -Math.PI / 2; planta.position.y = PISO + 0.012; g.add(planta);

      var matVidro = new THREE.MeshBasicMaterial(aditivo({ color: cor, side: THREE.DoubleSide, opacity: 0.045 }));
      var vidro = new THREE.Mesh(geoVidro, matVidro); vidro.position.y = PISO + (H - 0.32) / 2; g.add(vidro);

      var colunas = new THREE.InstancedMesh(geoColuna, new THREE.MeshBasicMaterial({ color: cor.clone().multiplyScalar(0.55) }), 8);
      for (var k = 0; k < 8; k++) { var a = (k + 0.5) / 8 * Math.PI * 2; dummy.position.set(Math.cos(a) * R, PISO + (H - 0.32) / 2, Math.sin(a) * R); dummy.scale.setScalar(1); dummy.updateMatrix(); colunas.setMatrixAt(k, dummy.matrix); }
      g.add(colunas);

      var mesh = new THREE.InstancedMesh(geoAgente, matAgente, def.agentes.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      g.add(mesh);

      var toque = new THREE.Mesh(geoToque, matToque); toque.position.y = H / 2; toque.userData.andar = i; g.add(toque); toques.push(toque);

      var o = {
        def: def, g: g, cor: cor, matAro: matAro, matVidro: matVidro, agentes: mesh,
        escala: new Float32Array(def.agentes.length).fill(1),
        moveis: def.agentes.filter(function (ag) { return ag.movel; }).map(function (ag) { return ag.i; }),
        brilho: 0, flash: 0, peca: null
      };
      o.peca = PECAS[def.id] ? PECAS[def.id](g, cor, def) : null;
      return o;
    });

    /* ---------- agentes: posição, cor, estado ---------- */
    var FATOR = { trabalhando: 1.05, reuniao: 1.1, ocioso: 0.42, pausa: 0.2 };
    var destaque = null;   /* agente sob o ponteiro: { a, i } */
    var escolhido = null;  /* agente selecionado: { a, i } */

    function corAgente(a, i, alvo) {
      var ag = a.def.agentes[i];
      alvo.copy(a.cor).multiplyScalar(FATOR[ag.status] || 1);
      if (ag.status === 'reuniao') alvo.lerp(BRANCO, 0.55);
      if ((destaque && destaque.a === a && destaque.i === i) || (escolhido && escolhido.a === a && escolhido.i === i)) alvo.set(2.2, 2.2, 2.2);
      return alvo;
    }
    function pintar(a, i) { a.agentes.setColorAt(i, corAgente(a, i, corTmp)); a.agentes.instanceColor.needsUpdate = true; }
    function posicionar(a, i, t) {
      var ag = a.def.agentes[i], x = ag.x, z = ag.z;
      if (ag.movel && !calmo) {
        var ang = ag.ang + Math.sin(t * 0.32 + ag.fase) * 0.34, raio = ag.raio + GEO.PASSO / 2;
        x = Math.cos(ang) * raio; z = Math.sin(ang) * raio;
      }
      dummy.position.set(x, PISO, z); dummy.scale.setScalar(a.escala[i]); dummy.updateMatrix();
      a.agentes.setMatrixAt(i, dummy.matrix);
    }
    andares.forEach(function (a) {
      for (var i = 0; i < a.def.agentes.length; i++) { posicionar(a, i, 0); a.agentes.setColorAt(i, corAgente(a, i, corTmp)); }
      a.agentes.instanceMatrix.needsUpdate = true; a.agentes.instanceColor.needsUpdate = true;
      a.agentes.computeBoundingSphere();
    });

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
        de: o.de - 1, para: o.para - 1, via: !!o.via && o.de !== N && o.para !== N && o.de !== o.para,
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
      if (p.via) { var yc = andares[N - 1].g.position.y + 1.75; P[++k].set(0, yc, 0); DUR[k - 1] = Math.max(0.2, Math.abs(yc - P[k - 1].y) / 58); }
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
      var c = andares[N - 1];
      if (c.peca && c.peca.pulsar) c.peca.pulsar();
      for (var i = 1; i < N; i++) pacote({ de: N, para: i, doCentro: true, agPara: Math.floor(Math.random() * ANDARES[i - 1].agentes.length) });
      c.flash = 1.2;
    }

    /* ==========================================================================
       CÂMERA
       ======================================================================== */
    var larg = 1, alt = 1, sel = -1, voo = null, margemAlvo = 0, margem = 0;
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
    function voar(pos, alvo, dur) {
      voo = { p0: camera.position.clone(), a0: controls.target.clone(), p1: pos, a1: alvo, t: 0, dur: calmo ? 0.01 : dur };
      controls.enabled = false;
    }
    function irPara(n, o) {
      n = Math.max(0, Math.min(N, n | 0));
      limparFoco();
      sel = n - 1;
      var alvo = n === 0 ? alvoGeral.clone() : new THREE.Vector3(0, BASE + (n - 1) * H + 0.9, 0);
      voar(destino(alvo, n === 0 ? distGeral() : distAndar(), n === 0 ? 0.2 : 0.66), alvo, o && o.rapido ? 0.01 : 1.5);
      controls.autoRotateSpeed = n === 0 ? 0.35 : 0.1;
      if (elRotulos) elRotulos.classList.toggle('oculto', n !== 0);
    }
    function focarAgente(n, i) {
      var a = andares[n - 1];
      if (!a || !a.def.agentes[i]) return;
      if (sel !== n - 1) { sel = n - 1; if (elRotulos) elRotulos.classList.add('oculto'); }
      var antigo = escolhido, ag = a.def.agentes[i];
      escolhido = { a: a, i: i };
      if (antigo) pintar(antigo.a, antigo.i);
      pintar(a, i);
      a.g.add(marcador); marcador.position.set(ag.x, PISO, ag.z); marcador.visible = true;
      var alvo = new THREE.Vector3(ag.x, BASE + (n - 1) * H + 0.6, ag.z);
      voar(destino(alvo, 13, 0.62), alvo, 1.1);
      controls.autoRotateSpeed = 0.1;
    }
    function limparFoco() {
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
       PONTEIRO: passar o mouse e clicar em andares e agentes
       ======================================================================== */
    var raio = new THREE.Raycaster(), ponteiro = new THREE.Vector2(), precisaRaio = false, apertou = null, px = 0, py = 0;

    function lancarRaio() {
      raio.setFromCamera(ponteiro, camera);
      var novo = null, andarSob = -1, hits;
      if (sel >= 0) {
        hits = raio.intersectObject(andares[sel].agentes, false);
        if (hits.length && hits[0].instanceId != null) novo = { a: andares[sel], i: hits[0].instanceId };
      }
      if (!novo) {
        hits = raio.intersectObjects(toques, false);
        if (hits.length && hits[0].object.userData.andar !== sel) andarSob = hits[0].object.userData.andar;
      }
      if ((novo && (!destaque || destaque.a !== novo.a || destaque.i !== novo.i)) || (!novo && destaque)) {
        var antigo = destaque; destaque = novo;
        if (antigo) { antigo.a.escala[antigo.i] = 1; pintar(antigo.a, antigo.i); posicionar(antigo.a, antigo.i, tAgora); antigo.a.agentes.instanceMatrix.needsUpdate = true; }
        if (novo) { novo.a.escala[novo.i] = 1.7; pintar(novo.a, novo.i); posicionar(novo.a, novo.i, tAgora); novo.a.agentes.instanceMatrix.needsUpdate = true; }
      }
      passandoAndar = andarSob;
      canvas.style.cursor = novo || andarSob >= 0 ? 'pointer' : '';
      if (cb.aoPassar) cb.aoPassar(novo ? { tipo: 'agente', andar: novo.a.def.n, idx: novo.i, x: px, y: py } : andarSob >= 0 ? { tipo: 'andar', andar: andarSob + 1, x: px, y: py } : null);
    }
    function lerPonteiro(e) {
      var b = canvas.getBoundingClientRect();
      px = e.clientX; py = e.clientY;
      ponteiro.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    }
    canvas.addEventListener('pointermove', function (e) { lerPonteiro(e); precisaRaio = true; });
    canvas.addEventListener('pointerleave', function () { passandoAndar = -1; precisaRaio = false; if (cb.aoPassar) cb.aoPassar(null); });
    canvas.addEventListener('pointerdown', function (e) { apertou = { x: e.clientX, y: e.clientY, t: Date.now() }; });
    canvas.addEventListener('pointerup', function (e) {
      if (!apertou) return;
      var moveu = Math.abs(e.clientX - apertou.x) + Math.abs(e.clientY - apertou.y), demorou = Date.now() - apertou.t;
      apertou = null;
      if (moveu > 7 || demorou > 650 || voo) return;
      lerPonteiro(e); lancarRaio();
      if (destaque) { if (cb.aoClicarAgente) cb.aoClicarAgente(destaque.a.def.n, destaque.i); }
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
        if (a.peca) a.peca.atualizar(t, dt);
        if (!calmo && a.moveis.length) {
          for (var m = 0; m < a.moveis.length; m++) posicionar(a, a.moveis[m], t);
          a.agentes.instanceMatrix.needsUpdate = true;
        }
      }

      /* pulsos dos agentes que acabaram de receber algo */
      for (i = pulsos.length - 1; i >= 0; i--) {
        var p = pulsos[i]; p.t += dt;
        var fim = p.t >= 0.55, s = fim ? 0 : Math.sin(Math.PI * p.t / 0.55), sobPonteiro = destaque && destaque.a === p.a && destaque.i === p.i;
        if (!sobPonteiro) {
          p.a.escala[p.i] = 1 + s * 1.3;
          posicionar(p.a, p.i, t);
          p.a.agentes.setColorAt(p.i, corAgente(p.a, p.i, corTmp).lerp(BRANCO, s * 0.9));
          p.a.agentes.instanceMatrix.needsUpdate = true; p.a.agentes.instanceColor.needsUpdate = true;
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

      /* câmera: voo suave até o destino, depois o usuário assume */
      if (voo) {
        voo.t += dt;
        var u = Math.min(1, voo.t / voo.dur); u = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        camera.position.lerpVectors(voo.p0, voo.p1, u); controls.target.lerpVectors(voo.a0, voo.a1, u);
        camera.lookAt(controls.target);
        if (u >= 1) { voo = null; controls.enabled = true; }
      } else {
        controls.update(dt);
      }
      if (Math.abs(margemAlvo - margem) > 0.5) { margem += (margemAlvo - margem) * Math.min(1, dt * 5); aplicarMargem(); }

      if (precisaRaio && !voo) { precisaRaio = false; lancarRaio(); }
      atualizarRotulos();

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
      focarAgente: focarAgente,
      limparFoco: limparFoco,
      entrar: entrar,
      pacote: pacote,
      pulsoAgente: pulsoAgente,
      difundir: difundir,
      statusAgente: function (n, i) { var a = andares[n - 1]; if (a && a.def.agentes[i]) pintar(a, i); },
      margemDireita: function (px) { margemAlvo = Math.max(0, px || 0); },
      qualidade: qualidade,
      qualidadeAtual: function () { return modo; },
      reuniaoAtiva: function (b) { var p = andares[6].peca; if (p && p.reuniao) p.reuniao(b); },
      orcamento: function (fracao) { var p = andares[5].peca; if (p && p.orcamento) p.orcamento(fracao); },
      andarAtual: function () { return sel + 1; }
    };
  };
})(window);
