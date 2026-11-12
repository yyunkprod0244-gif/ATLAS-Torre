/* ============================================================================
   JARVIS HOLOGRÁFICO
   ----------------------------------------------------------------------------
   A forma completa do Jarvis: um holograma projetado por uma base de luz,
   com núcleo, cascas geométricas, anéis graduados, uma onda de voz e uma
   nuvem de partículas. Ele reage ao estado do Jarvis:
     parado → respira devagar · ouvindo → os anéis se abrem e clareiam
     pensando → tudo gira rápido · falando → a onda e o núcleo pulsam
   A conversa é o mesmo Jarvis da torre (js/jarvis.js). Pedidos que mexem na
   torre (abrir um andar, uma sala, um livro) viram um atalho na conversa.
   ========================================================================== */
(function (root) {
  'use strict';
  var T = root.Torre, F = T.fmt, S = T.Sim, J = T.Jarvis;
  var $ = function (id) { return document.getElementById(id); };
  var calmo = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- dados e Jarvis ---------- */
  T.gerar();
  S.preparar();
  S.iniciar();

  /* pedido que precisa da torre: deixa um atalho na conversa em vez de sair da página no meio da fala */
  function irTorre(destino, texto) {
    setTimeout(function () {
      var box = $('jvMsgs'), a = document.createElement('a');
      a.className = 'jv-msg ir-torre';
      a.href = 'index.html?semintro' + destino;
      a.textContent = texto + ' ›';
      box.appendChild(a); box.scrollTop = box.scrollHeight;
    }, 0);
  }
  J.montar({
    irPara: function (n) { irTorre(n ? '#andar=' + n : '', n ? 'Abrir o ' + n + 'º andar na torre' : 'Abrir a torre'); },
    irParaSala: function (n, k) { irTorre('#andar=' + n + '&sala=' + (k + 1), 'Entrar na sala, na torre'); },
    abrirLivro: function (id) { irTorre('#andar=9&livro=' + encodeURIComponent(id), 'Abrir o livro na torre'); return true; },
    abrirProdutos: function () { irTorre('&produtos', 'Ver os produtos na torre'); },
    abrirSkillsExternas: function () { irTorre('&skills', 'Ver o catálogo de skills na torre'); },
    mostrarSkillExterna: function () { irTorre('&skills', 'Ver a skill no catálogo da torre'); },
    abrirLembretes: function () { irTorre('&lembretes', 'Gerenciar os lembretes na torre'); },
    abrirAgente: function (n) { irTorre('#andar=' + n, 'Ver o agente na torre'); }
  });
  /* boas-vindas só por escrito: o navegador só deixa falar depois que você interage com a página */
  (function () {
    var h = new Date().getHours(), box = $('jvMsgs'), d = document.createElement('div');
    d.className = 'jv-msg de-jarvis';
    d.textContent = (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite') + '. Estou pronto. Toque no microfone ou escreva: posso abrir andares, fazer contas, criar lembretes e contar como está a empresa.';
    box.appendChild(d);
  })();

  var ESTADOS = { parado: 'pronto · fale ou escreva', ouvindo: 'ouvindo', pensando: 'pensando', falando: 'falando' };
  var ultimoEstado = '';
  function acompanharEstado() {
    var e = J.estado();
    if (e === ultimoEstado) return;
    ultimoEstado = e;
    $('holoEstado').textContent = ESTADOS[e] || e;
    $('holoFalar').classList.toggle('on', e === 'ouvindo');
  }
  $('holoFalar').addEventListener('click', function () { J.alternarMic(); });
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var campo = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === 'Escape') { J.parar(); if (campo) e.target.blur(); return; }
    if (!campo && (e.key === 'm' || e.key === 'M')) { J.alternarMic(); e.preventDefault(); }
  });

  /* ---------- painel lateral ---------- */
  var tAviso = null;
  function aviso(texto) {
    var el = $('aviso'); el.textContent = texto; el.hidden = false; el.classList.add('on');
    clearTimeout(tAviso); tAviso = setTimeout(function () { el.classList.remove('on'); setTimeout(function () { el.hidden = true; }, 300); }, 6000);
  }
  function hud() {
    var d = new Date(), pl = S.planoLancamento(), p = T.Lembretes.pendentes()[0], h = S.hoje;
    $('hudHora').textContent = F.hora(d);
    $('hudData').textContent = F.dataLonga(d);
    $('holoSub').textContent = S.nomeEmpresa();
    if (pl.dia) {
      $('hudPlano').textContent = pl.terminou ? 'Concluído' : 'Dia ' + pl.dia + ' de ' + T.PLANO.dias;
      $('hudPlanoTxt').textContent = pl.terminou ? 'Os 90 dias terminaram.' : 'Fase: ' + T.PLANO.fases[pl.fase].nome + ' · ' + F.int(pl.metas[0].feito) + ' de ' + F.int(pl.metas[0].meta) + ' contatos';
    } else { $('hudPlano').textContent = 'Não começou'; $('hudPlanoTxt').textContent = 'Pergunte: "o que eu faço hoje?"'; }
    if (p) {
      var q = new Date(p.quando), atras = q <= d;
      $('hudLembrete').textContent = (atras ? 'Atrasado · ' : '') + (F.chaveDia(q) === F.chaveDia(d) ? 'hoje' : F.dataMedia(q)) + ' às ' + F.hora(q);
      $('hudLembreteTxt').textContent = p.texto;
    } else { $('hudLembrete').textContent = 'Nenhum'; $('hudLembreteTxt').textContent = 'Diga: "me lembre de…"'; }
    $('hudVendas').textContent = F.int(h.vendas) + ' sites vendidos hoje';
    $('hudTorre').textContent = F.brlc(h.receita) + ' de receita · ' + F.int(S.agentesAtivos()) + ' agentes ativos';
  }
  hud(); setInterval(hud, 5000);
  T.Lembretes.aoMudar(hud);
  T.vigiarLembretes(function (l) { aviso('⏰ Lembrete: ' + l.texto); J.falar('Lembrete: ' + l.texto); hud(); });

  /* ==========================================================================
     O HOLOGRAMA (Three.js)
     ======================================================================== */
  var desenhado = false;
  function reserva() {
    $('holoReserva').hidden = false; $('holoCanvas').hidden = true;
    setInterval(acompanharEstado, 200);
  }

  function desenhar(L) {
    if (desenhado) return;
    desenhado = true;
    if (!L) return reserva();
    var THREE = L.THREE, canvas = $('holoCanvas'), renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' }); }
    catch (e) { console.warn('[holograma] sem WebGL; usando a versão em CSS', e); return reserva(); }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    var CIANO = new THREE.Color(0x7fe4ff);
    function hdr(k) { return CIANO.clone().multiplyScalar(k); }
    function aditivo(o) { o.transparent = true; o.depthWrite = false; o.blending = THREE.AdditiveBlending; return o; }

    var scene = new THREE.Scene();
    /* fundo: o mesmo degradê da página, para o brilho não escurecer as bordas */
    (function () {
      var c = document.createElement('canvas'); c.width = c.height = 512;
      var x = c.getContext('2d'), g = x.createRadialGradient(256, 236, 10, 256, 256, 360);
      g.addColorStop(0, '#0b2a3a'); g.addColorStop(0.38, '#04121c'); g.addColorStop(1, '#010409');
      x.fillStyle = g; x.fillRect(0, 0, 512, 512);
      var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
    })();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.6, 10.5);

    var composer = new L.EffectComposer(renderer);
    composer.addPass(new L.RenderPass(scene, camera));
    var bloom = new L.UnrealBloomPass(new THREE.Vector2(4, 4), 1.0, 0.65, 0.08);
    composer.addPass(bloom);
    composer.addPass(new L.OutputPass());

    /* ---------- a cabeça: núcleo, cascas, anéis, onda e partículas ---------- */
    var cabeca = new THREE.Group(); cabeca.position.y = 0.55; scene.add(cabeca);
    var miolo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 20), new THREE.MeshBasicMaterial({ color: hdr(2.4) })); cabeca.add(miolo);
    var halo = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 20), new THREE.MeshBasicMaterial(aditivo({ color: hdr(0.5), opacity: 0.25 }))); cabeca.add(halo);
    var casca1 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.05, 1)), new THREE.LineBasicMaterial(aditivo({ color: hdr(1.6), opacity: 0.85 }))); cabeca.add(casca1);
    var casca2 = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.48, 3)), new THREE.LineBasicMaterial(aditivo({ color: hdr(1.0), opacity: 0.13 }))); cabeca.add(casca2);

    var aneis = [];
    [[1.95, Math.PI / 2, 0, 0.9], [2.2, Math.PI / 2.6, 0.5, 0.55], [2.45, Math.PI / 1.8, -0.7, 0.35]].forEach(function (a, i) {
      var g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.TorusGeometry(a[0], 0.011, 6, 200), new THREE.MeshBasicMaterial(aditivo({ color: hdr(1.4), opacity: a[3] }))));
      if (i === 0) {
        /* marcas de régua no primeiro anel */
        var n = 96, marcas = new THREE.InstancedMesh(new THREE.BoxGeometry(0.016, 0.1, 0.016), new THREE.MeshBasicMaterial(aditivo({ color: hdr(1.6), opacity: 0.8 })), n), o = new THREE.Object3D();
        for (var k = 0; k < n; k++) {
          var ang = k / n * Math.PI * 2, longa = k % 8 === 0;
          o.position.set(Math.cos(ang) * (a[0] + 0.12), Math.sin(ang) * (a[0] + 0.12), 0);
          o.rotation.set(0, 0, ang - Math.PI / 2); o.scale.set(1, longa ? 2.2 : 1, 1); o.updateMatrix();
          marcas.setMatrixAt(k, o.matrix);
        }
        g.add(marcas);
        /* arco mais forte, que gira */
        var arco = new THREE.Mesh(new THREE.TorusGeometry(a[0] + 0.28, 0.022, 6, 80, Math.PI * 0.55), new THREE.MeshBasicMaterial(aditivo({ color: hdr(2.0), opacity: 0.9 })));
        g.add(arco); g.userData.arco = arco;
      }
      g.rotation.set(a[1], a[2], 0);
      cabeca.add(g); aneis.push(g);
    });

    /* a onda de voz: um laço horizontal que se deforma quando o Jarvis fala */
    var NO = 220, posOnda = new Float32Array(NO * 3), geoOnda = new THREE.BufferGeometry();
    geoOnda.setAttribute('position', new THREE.BufferAttribute(posOnda, 3));
    var onda = new THREE.LineLoop(geoOnda, new THREE.LineBasicMaterial(aditivo({ color: hdr(2.2), opacity: 0.95 })));
    onda.rotation.x = Math.PI / 2.15; cabeca.add(onda);

    /* partículas em volta */
    var NP = calmo ? 500 : 1500, posP = new Float32Array(NP * 3), r = T.rng('holograma');
    for (var i = 0; i < NP; i++) {
      var th = r() * Math.PI * 2, fi = Math.acos(2 * r() - 1), rr = 2.3 + Math.pow(r(), 2) * 1.6;
      posP[i * 3] = Math.sin(fi) * Math.cos(th) * rr; posP[i * 3 + 1] = Math.cos(fi) * rr * 0.8; posP[i * 3 + 2] = Math.sin(fi) * Math.sin(th) * rr;
    }
    var geoP = new THREE.BufferGeometry(); geoP.setAttribute('position', new THREE.BufferAttribute(posP, 3));
    var particulas = new THREE.Points(geoP, new THREE.PointsMaterial(aditivo({ color: hdr(1.4), size: 0.035, opacity: 0.8 })));
    cabeca.add(particulas);

    /* ---------- a base que projeta o holograma ---------- */
    var base = new THREE.Group(); base.position.y = -2.35; scene.add(base);
    (function () {
      var c = document.createElement('canvas'); c.width = c.height = 512;
      var x = c.getContext('2d'); x.translate(256, 256); x.strokeStyle = '#ffffff';
      [[250, 3, 0.9], [215, 1.5, 0.5], [180, 1, 0.35], [120, 6, 0.6], [60, 2, 0.5]].forEach(function (a) { x.globalAlpha = a[2]; x.lineWidth = a[1]; x.beginPath(); x.arc(0, 0, a[0], 0, Math.PI * 2); x.stroke(); });
      x.globalAlpha = 0.5; x.lineWidth = 2;
      for (var k = 0; k < 48; k++) { var ang = k / 48 * Math.PI * 2; x.beginPath(); x.moveTo(Math.cos(ang) * 190, Math.sin(ang) * 190); x.lineTo(Math.cos(ang) * (k % 4 ? 205 : 212), Math.sin(ang) * (k % 4 ? 205 : 212)); x.stroke(); }
      var t = new THREE.CanvasTexture(c);
      var disco = new THREE.Mesh(new THREE.CircleGeometry(2.4, 96), new THREE.MeshBasicMaterial(aditivo({ map: t, color: hdr(1.3), opacity: 0.9 })));
      disco.rotation.x = -Math.PI / 2; base.add(disco); base.userData.disco = disco;
    })();
    /* o cone de luz da base até a cabeça, que some para cima */
    var cone = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 0.55, 3.2, 64, 1, true), new THREE.ShaderMaterial(aditivo({
      side: THREE.DoubleSide,
      uniforms: { uCor: { value: hdr(0.9) }, uForca: { value: 0.18 } },
      vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uCor; uniform float uForca; varying float vY; void main(){ gl_FragColor = vec4(uCor, uForca * pow(1.0 - vY, 1.6)); }'
    })));
    cone.position.y = 1.6; base.add(cone);

    /* ---------- tamanho da tela e mouse ---------- */
    var larg = 1, alt = 1, mx = 0, my = 0;
    function redimensionar() {
      larg = Math.max(1, root.innerWidth); alt = Math.max(1, root.innerHeight);
      var pr = Math.min(root.devicePixelRatio || 1, 1.5);
      renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
      renderer.setSize(larg, alt, false); composer.setSize(larg, alt);
      camera.aspect = larg / alt;
      /* no computador, o holograma fica no meio do espaço livre entre o painel da esquerda (230 px) e a
         conversa (380 px); em tela estreita ele sobe e se afasta, para caber acima da conversa */
      camera.position.z = larg / alt < 0.9 ? 15 : 10.5;
      camera.setViewOffset(larg, alt, larg > 980 ? (380 - 230) / 2 : 0, larg > 980 ? 0 : alt * 0.2, larg, alt);
      camera.updateProjectionMatrix();
    }
    root.addEventListener('resize', redimensionar); redimensionar();
    root.addEventListener('pointermove', function (e) { mx = e.clientX / larg - 0.5; my = e.clientY / alt - 0.5; });

    /* ---------- animação ---------- */
    var nivel = 0, giro = 0, tAntes = 0;
    function quadro(ms) {
      root.requestAnimationFrame(quadro);
      var t = ms / 1000, dt = Math.min(0.05, Math.max(0.001, t - tAntes)); tAntes = t;
      var e = J.estado(); acompanharEstado();
      var alvo = e === 'falando' ? 0.55 + 0.45 * Math.abs(Math.sin(t * 9) * Math.sin(t * 5.3)) : e === 'ouvindo' ? 0.75 + 0.25 * Math.sin(t * 6) : e === 'pensando' ? 0.55 : 0.2;
      nivel += (alvo - nivel) * Math.min(1, dt * 8);
      var vel = calmo ? 0.15 : e === 'pensando' ? 2.6 : e === 'ouvindo' ? 0.9 : 0.4;
      giro += dt * vel;

      miolo.scale.setScalar(1 + nivel * 0.45 + (calmo ? 0 : 0.04 * Math.sin(t * 2.2)));
      halo.scale.setScalar(1 + nivel * 0.8); halo.material.opacity = 0.12 + nivel * 0.25;
      casca1.rotation.set(giro * 0.6, giro * 0.9, 0);
      casca2.rotation.set(-giro * 0.25, -giro * 0.35, giro * 0.15);
      aneis.forEach(function (g, i) {
        g.rotation.z = giro * (i % 2 ? -0.7 : 0.5) * (1 + i * 0.3);
        var abre = e === 'ouvindo' ? 1.08 : 1;
        g.scale.setScalar(g.scale.x + (abre - g.scale.x) * Math.min(1, dt * 4));
        if (g.userData.arco) g.userData.arco.rotation.z = -giro * 2.4;
      });
      for (var k = 0; k < NO; k++) {
        var ang = k / NO * Math.PI * 2;
        var amp = (e === 'falando' ? 0.16 : 0.04) * nivel * (Math.sin(ang * 6 + t * 7) + 0.6 * Math.sin(ang * 11 - t * 11) + 0.35 * Math.sin(ang * 17 + t * 4));
        var raio = 1.68 + amp;
        posOnda[k * 3] = Math.cos(ang) * raio; posOnda[k * 3 + 1] = Math.sin(ang) * raio; posOnda[k * 3 + 2] = amp * 0.6;
      }
      geoOnda.attributes.position.needsUpdate = true;
      particulas.rotation.y = giro * 0.12; particulas.rotation.x = Math.sin(t * 0.1) * 0.1;
      particulas.material.opacity = 0.45 + nivel * 0.45;
      base.userData.disco.rotation.z = -giro * 0.3;
      cone.material.uniforms.uForca.value = 0.12 + nivel * 0.16 + (calmo ? 0 : 0.02 * Math.sin(t * 13));
      cabeca.position.y = 0.55 + (calmo ? 0 : Math.sin(t * 0.8) * 0.08);
      bloom.strength = 0.85 + nivel * 0.9;

      /* a câmera acompanha o mouse de leve */
      camera.position.x += (mx * 1.6 - camera.position.x) * Math.min(1, dt * 2);
      camera.position.y += (0.6 - my * 1.0 - camera.position.y) * Math.min(1, dt * 2);
      camera.lookAt(0, 0.2, 0);
      composer.render(dt);
    }
    root.requestAnimationFrame(quadro);
  }

  T.Holograma = { desenhar: desenhar };
})(window);
