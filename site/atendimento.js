/* ============================================================================
   ATENDIMENTO DO SITE — chat com os agentes de Vendas da Atlas
   ----------------------------------------------------------------------------
   Um botão "Fale com a Atlas" no canto da tela abre o chat. Ele conversa com a
   torre (servidor/vendas.mjs): com a IA quando o departamento de Vendas está
   em automático, ou com respostas prontas tiradas do catálogo. Quem deixa nome
   e WhatsApp ou e-mail aparece na torre, em "Clientes do site".

   Onde fica a torre: ATLAS_CATALOGO.atendimento (em catalogo.js). Vazio = o
   mesmo endereço do site (é o caso quando o site abre pela torre).
   Sem a torre no ar, o chat responde com o catálogo e indica o WhatsApp.
   ========================================================================== */
(function (root) {
  'use strict';
  var C = root.ATLAS_CATALOGO || {}, P = C.produtos || [], ct = C.contato || {};
  var base = String(C.atendimento || '').replace(/\/+$/, '');
  var online = base || /^https?:$/.test(root.location.protocol);
  var msgs = [], aberto = false, enviando = false, formMostrado = false;
  var sessao = (function () { try { var s = root.sessionStorage.getItem('atlas.sessao'); if (!s) { s = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); root.sessionStorage.setItem('atlas.sessao', s); } return s; } catch (e) { return 'x' + Date.now().toString(36); } })();
  var brl = function (v) { return 'R$ ' + Number(v).toLocaleString('pt-BR'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var wa = ct.whatsapp ? 'https://wa.me/' + String(ct.whatsapp).replace(/\D/g, '') : '';

  /* respostas do próprio catálogo, para quando a torre não responder */
  function offline(t) {
    t = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/(preco|quanto|valor|custa)/.test(t)) return 'Nossos planos: ' + P.map(function (p) { return p.nome + ' ' + brl(p.preco) + (p.mensal ? '/mês' : ''); }).join(', ') + '.';
    if (/(prazo|tempo|demora|dias)/.test(t)) return P.map(function (p) { return p.nome + ': ' + p.prazo; }).join('; ') + '.';
    return 'Posso te passar preços e prazos. Para um orçamento, deixe seu nome e WhatsApp aqui embaixo' + (wa ? ' ou chame no WhatsApp' : '') + '.';
  }

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  var bt = el('button', 'atd-botao', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg><span>Fale com a Atlas</span>');
  bt.type = 'button'; bt.setAttribute('aria-expanded', 'false'); bt.setAttribute('aria-controls', 'atdPainel');
  var painel = el('section', 'atd-painel');
  painel.id = 'atdPainel'; painel.hidden = true; painel.setAttribute('role', 'dialog'); painel.setAttribute('aria-label', 'Atendimento da ' + ((C.empresa && C.empresa.nome) || 'Atlas'));
  painel.innerHTML = '<header class="atd-cab"><span class="atd-avatar" aria-hidden="true">A</span><div><b>Atendimento Atlas</b><small id="atdStatus">responde na hora</small></div><button type="button" class="atd-fechar" aria-label="Fechar o atendimento">×</button></header>' +
    '<ol class="atd-msgs" id="atdMsgs" aria-live="polite"></ol>' +
    '<div class="atd-chips" id="atdChips"><button type="button">Quanto custa um site?</button><button type="button">Quanto tempo leva?</button><button type="button" data-orcamento>Quero um orçamento</button></div>' +
    '<form class="atd-form" id="atdForm"><input id="atdTexto" maxlength="500" autocomplete="off" placeholder="Escreva sua dúvida…" aria-label="Sua mensagem"><button type="submit" aria-label="Enviar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-7-6 16-3-6.5z"/></svg></button></form>';
  document.body.appendChild(bt); document.body.appendChild(painel);
  var lista = painel.querySelector('#atdMsgs');

  function bolha(de, texto, extra) {
    var li = el('li', 'atd-msg ' + (de === 'atlas' ? 'de-atlas' : 'de-cliente'));
    li.textContent = texto; if (extra) li.appendChild(extra);
    lista.appendChild(li); lista.scrollTop = lista.scrollHeight;
    msgs.push({ de: de, texto: texto });
  }
  function digitando(sim) {
    var d = lista.querySelector('.digitando');
    if (sim && !d) { d = el('li', 'atd-msg de-atlas digitando', '<i></i><i></i><i></i>'); d.setAttribute('aria-label', 'digitando'); lista.appendChild(d); lista.scrollTop = lista.scrollHeight; }
    if (!sim && d) d.remove();
  }
  function formContato() {
    if (formMostrado) return; formMostrado = true;
    var f = el('form', 'atd-lead', '<p><b>Receba seu orçamento</b> · um especialista te chama</p>' +
      '<input name="nome" required maxlength="80" placeholder="Seu nome" autocomplete="name" aria-label="Seu nome">' +
      '<input name="contato" required maxlength="80" placeholder="WhatsApp com DDD ou e-mail" autocomplete="tel" aria-label="WhatsApp ou e-mail">' +
      '<input name="negocio" maxlength="80" placeholder="Seu negócio (ex.: padaria, clínica)" aria-label="Seu negócio">' +
      '<select name="produto" aria-label="O que você procura"><option value="">O que você procura?</option>' + P.map(function (p) { return '<option>' + esc(p.nome) + '</option>'; }).join('') + '<option>Ainda não sei</option></select>' +
      '<button type="submit">Quero meu orçamento</button><small>Usamos seu contato só para responder ao seu pedido.</small>');
    var li = el('li', 'atd-msg de-atlas atd-cartao'); li.appendChild(f); lista.appendChild(li); lista.scrollTop = lista.scrollHeight;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = { sessao: sessao, nome: f.nome.value.trim(), contato: f.contato.value.trim(), negocio: f.negocio.value.trim(), produto: f.produto.value, conversa: msgs };
      var b = f.querySelector('button'); b.disabled = true; b.textContent = 'Enviando…';
      if (!online) { li.remove(); bolha('atlas', wa ? 'O atendimento online está fora do ar agora. Fale com a gente pelo WhatsApp: ' + wa : 'O atendimento online está fora do ar agora. Tente de novo mais tarde.'); return; }
      root.fetch(base + '/api/vendas/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'falhou'); }); })
        .then(function () { li.remove(); bolha('atlas', 'Obrigado, ' + d.nome.split(' ')[0] + '! Recebemos seu pedido e um especialista vai te chamar em breve.'); })
        .catch(function (er) { b.disabled = false; b.textContent = 'Quero meu orçamento'; var s = f.querySelector('small'); s.textContent = er.message; s.classList.add('erro'); });
    });
  }
  function enviar(texto) {
    texto = String(texto || '').trim(); if (!texto || enviando) return;
    bolha('cliente', texto);
    if (/or[cç]amento|contratar/i.test(texto)) formContato();
    if (!online) { setTimeout(function () { bolha('atlas', offline(texto)); formContato(); }, 400); return; }
    enviando = true; digitando(true);
    root.fetch(base + '/api/vendas/conversa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessao: sessao, mensagens: msgs.slice(-12) }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'falhou'); return j; }); })
      .then(function (j) { digitando(false); bolha('atlas', j.resposta); if (j.pedirContato) formContato(); })
      .catch(function () { digitando(false); online = false; painel.querySelector('#atdStatus').textContent = 'respostas automáticas'; bolha('atlas', offline(texto)); formContato(); })
      .then(function () { enviando = false; });
  }
  function abrir(sim) {
    aberto = sim; painel.hidden = !sim; bt.setAttribute('aria-expanded', String(sim)); bt.classList.toggle('aberto', sim);
    if (sim) {
      if (!msgs.length) bolha('atlas', 'Olá! Sou o atendimento da ' + ((C.empresa && C.empresa.nome) || 'Atlas') + '. Me conta: que tipo de negócio você tem e o que precisa no site?');
      painel.querySelector('#atdTexto').focus();
    } else bt.focus();
  }
  bt.addEventListener('click', function () { abrir(!aberto); });
  painel.querySelector('.atd-fechar').addEventListener('click', function () { abrir(false); });
  painel.addEventListener('keydown', function (e) { if (e.key === 'Escape') abrir(false); });
  painel.querySelector('#atdForm').addEventListener('submit', function (e) { e.preventDefault(); var i = painel.querySelector('#atdTexto'); enviar(i.value); i.value = ''; });
  painel.querySelector('#atdChips').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-orcamento')) { bolha('cliente', b.textContent); formContato(); return; }
    enviar(b.textContent);
  });
  /* botões do site com data-atendimento abrem o chat */
  document.addEventListener('click', function (e) { if (e.target.closest('[data-atendimento]')) { e.preventDefault(); abrir(true); } });
  if (online) root.fetch(base + '/api/vendas/estado').then(function (r) { return r.json(); }).then(function (j) { painel.querySelector('#atdStatus').textContent = j.ia ? 'responde na hora' : 'respostas automáticas · um especialista retorna'; }).catch(function () { online = false; painel.querySelector('#atdStatus').textContent = 'respostas automáticas'; });
})(window);
