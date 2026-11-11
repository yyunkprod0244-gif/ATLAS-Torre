/* ============================================================================
   TORRE — partida: liga os dados, a simulação, a cena 3D, a interface e o Jarvis
   ----------------------------------------------------------------------------
   Endereços úteis:
     index.html#andar=3        abre direto no 3º andar
     index.html?semintro       pula a tela de entrada
     index.html?qualidade=leve força o modo leve (sem brilho)
   Atalhos de teclado: 1–8 andares · 0 ou Esc volta · J Jarvis · M microfone · R resumo
   ========================================================================== */
(function (root) {
  'use strict';
  var T = root.Torre;
  var $ = function (id) { return document.getElementById(id); };

  T.iniciar = function (libs) {
    if (T.pronto) return;
    T.pronto = true;
    var params = new root.URLSearchParams(root.location.search), S = T.Sim, UI = T.UI, J = T.Jarvis;

    T.gerar();
    S.preparar();

    /* ---------- cena 3D (com plano B se o 3D não puder ser criado) ---------- */
    var cena = null, qual = params.get('qualidade') || S.guarda.ler('torre.qualidade', 'alta');
    if (libs) {
      try {
        cena = T.criarCena(libs, $('cena'), {
          qualidade: qual,
          vigiarDesempenho: !params.has('qualidade'),
          aoClicarAndar: function (n) { UI.abrirAndar(n); },
          aoClicarAgente: function (n, i) { UI.abrirAgente(n, i); },
          aoClicarVazio: function () { if (UI.fichaAberta()) UI.fecharFicha(); },
          aoPassar: function (info) { UI.dicaCena(info); },
          aoBaixarQualidade: function () { UI.aviso('Modo leve ligado para manter a torre fluida neste computador.'); }
        });
      } catch (e) { console.error('[torre] não foi possível criar a cena 3D', e); cena = null; }
    }
    if (!cena) { cena = T.cenaVazia(); document.body.classList.add('sem-3d'); }
    T.cena = cena;

    UI.montar(cena, { aoOuvirResumo: function (r) { UI.fecharModal(); J.abrir(true); J.falar(r.fala); } });
    J.montar({
      irPara: function (n) { if (n) UI.abrirAndar(n); else UI.fechar(); },
      abrirResumo: UI.abrirResumo,
      abrirAgente: function (n, i) { UI.abrirAgente(n, i); }
    });

    /* ---------- a simulação movimenta a torre ---------- */
    S.on('evento', function (e) {
      if (e.tipo === 'difusao') return;
      if (e.para && e.para !== e.andar) cena.pacote({ de: e.andar, para: e.para, via: e.via, agDe: e.agente, agPara: e.agentePara, destaque: e.destaque });
      else {
        cena.pulsoAgente(e.andar, e.agente);
        if (Math.random() < 0.45) cena.pacote({ de: e.andar, para: e.andar, agDe: e.agente, agPara: Math.floor(Math.random() * T.andar(e.andar).agentes.length), suave: true });
      }
      if (e.tipo === 'venda') UI.aviso(e.texto);
    });
    S.on('difusao', function () { cena.difundir(); });
    S.iniciar();

    /* ---------- tela de entrada ---------- */
    var intro = $('intro'), alvo = (root.location.hash.match(/andar=(\d)/) || [])[1];
    function entrar(falar) {
      if (!intro || intro.dataset.fora) return;
      intro.dataset.fora = '1'; intro.classList.add('fora');
      setTimeout(function () { intro.hidden = true; }, 900);
      document.body.classList.add('dentro');
      cena.entrar();
      if (alvo && +alvo >= 1 && +alvo <= 8) setTimeout(function () { UI.abrirAndar(+alvo, { aba: params.get('aba') || 'geral' }); }, falar ? 3300 : 400);
      if (falar) setTimeout(function () { J.saudar(); }, 1200);
      if (params.has('jarvis')) J.abrir(true);
    }
    var linhas = ['Gerando ' + T.fmt.int(T.TOTAIS.agentes) + ' agentes em 8 andares', 'Carregando ' + T.fmt.int(T.TOTAIS.skills) + ' skills', 'Conectando o núcleo de dados ao Mega Brain', cena.vazia ? 'Torre 3D indisponível: abrindo os painéis' : 'Torre pronta'];
    var log = $('introLog'), barra = $('introBarra'), bt = $('introEntrar');
    $('introTotais').textContent = '8 andares · ' + T.fmt.int(T.TOTAIS.agentes) + ' agentes · ' + T.fmt.int(T.TOTAIS.skills) + ' skills';
    linhas.forEach(function (l, i) {
      setTimeout(function () {
        var li = document.createElement('li'); li.textContent = l; log.appendChild(li);
        barra.style.width = ((i + 1) / linhas.length * 100) + '%';
        if (i === linhas.length - 1) { bt.disabled = false; bt.textContent = 'Entrar na torre'; bt.focus(); }
      }, params.has('semintro') ? 0 : 350 + i * 420);
    });
    bt.addEventListener('click', function () { entrar(true); });
    if (params.has('semintro')) entrar(false);

    /* ---------- teclado ---------- */
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var campo = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if (e.key === 'Escape') {
        if (UI.fecharModal()) return;
        if (campo) return e.target.blur();
        if (UI.fichaAberta()) return UI.fecharFicha();
        if (!$('jvPainel').hidden) return J.abrir(false);
        if (UI.andarAberto()) return UI.fechar();
        return;
      }
      if (campo || !document.body.classList.contains('dentro')) return;
      if (e.key >= '1' && e.key <= '8') UI.abrirAndar(+e.key);
      else if (e.key === '0') UI.fechar();
      else if (e.key === 'j' || e.key === 'J') { J.abrir(); e.preventDefault(); }
      else if (e.key === 'm' || e.key === 'M') { J.abrir(true); J.alternarMic(); e.preventDefault(); }
      else if (e.key === 'r' || e.key === 'R') UI.abrirResumo();
    });
  };
})(window);
