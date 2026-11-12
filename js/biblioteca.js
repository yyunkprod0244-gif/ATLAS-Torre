/* ============================================================================
   TORRE — biblioteca do 9º andar (Estudo)
   ----------------------------------------------------------------------------
   Cada livro é um conteúdo diferente. Um livro tem:
     id       identificador curto (não mude: é com ele que o navegador lembra
              o que você já leu)
     sala     em qual sala do 9º andar ele fica (0 a 5, na ordem dos squads do
              andar "estudo" em js/config.js)
     titulo, sub, min (minutos de leitura), resumo
     licoes   lista de [título, texto]
     pratica  uma tarefa para fazer hoje
   Dois livros são guias interativos, com conteúdo próprio mais abaixo:
     tipo: 'salario'     → T.SALARIO e T.planoSalario()
     tipo: 'lancamento'  → T.LANCAMENTO (checklist)

   Para criar um livro novo, copie um bloco, troque o id e escreva o conteúdo.
   Nada aqui depende do navegador (o servidor também carrega este arquivo).
   ========================================================================== */
(function (root) {
  'use strict';
  var T = (root.Torre = root.Torre || {});

  T.BIBLIOTECA = [
    /* ------------------------------ sala 0 · Finanças Pessoais ------------------------------ */
    {
      id: 'salario', sala: 0, tipo: 'salario', min: 6,
      titulo: 'Salário de R$ 2.000', sub: 'O passo a passo para dividir cada real',
      resumo: 'Um plano simples para o dia em que o salário cai: primeiro a reserva, depois o que é essencial, a empresa, o estudo e o lazer. Troque o valor e veja a divisão mudar.'
    },
    {
      id: 'reserva', sala: 0, min: 4,
      titulo: 'Reserva de emergência', sub: 'Do zero ao primeiro mês guardado',
      resumo: 'A reserva é o dinheiro que impede um imprevisto de virar dívida. Ela vem antes de qualquer investimento.',
      licoes: [
        ['Quanto juntar', 'Comece com a meta de 1 mês dos seus gastos essenciais. Depois vá para 3 meses e, por fim, 6. Se os essenciais são R$ 1.100, o primeiro degrau é R$ 1.100.'],
        ['Onde deixar', 'Em uma aplicação segura, que renda todo dia e deixe sacar na hora, como o Tesouro Selic ou um CDB de liquidez diária. Reserva não é lugar de buscar ganho alto.'],
        ['Pague-se primeiro', 'Transfira no dia em que o salário cai, antes de qualquer gasto. O que deveria sobrar no fim do mês quase nunca sobra.'],
        ['Quando usar', 'Só em imprevisto de verdade: saúde, conserto essencial, perda de renda. Usou? A prioridade do mês seguinte é repor.']
      ],
      pratica: 'Abra hoje uma conta ou "caixinha" separada e programe a transferência automática para o dia do pagamento.'
    },
    {
      id: 'dividas', sala: 0, min: 4,
      titulo: 'Sair das dívidas', sub: 'A ordem certa para quitar',
      resumo: 'Dívida cara corrói o orçamento todo mês. Organizar a fila e atacar uma de cada vez é o que funciona.',
      licoes: [
        ['Liste tudo', 'Para cada dívida, anote credor, valor total, parcela e juros ao mês. Dívida que você não vê cresce sem você perceber.'],
        ['Ataque os juros mais altos', 'Rotativo do cartão e cheque especial vêm primeiro. Pague o mínimo das outras e jogue toda a sobra na mais cara.'],
        ['Renegocie', 'Ligue, peça desconto para pagar à vista ou troque por uma linha mais barata. Parcela nova só vale se couber no orçamento.'],
        ['Feche a torneira', 'Enquanto estiver pagando, nada de parcelamento novo. Use débito ou Pix e deixe o cartão em casa.']
      ],
      pratica: 'Monte a lista das dívidas em ordem de juros e decida quanto do lazer e da folga deste mês vai para a primeira da fila.'
    },

    /* ------------------------------ sala 1 · Empreendedorismo ------------------------------ */
    {
      id: 'plano-3mil', sala: 1, tipo: 'plano', min: 10,
      titulo: 'Plano de 90 dias com R$ 3.000', sub: 'Do zero ao primeiro cliente, com dinheiro de verdade',
      resumo: 'Para quem vai começar com R$ 3.000 e nenhum cliente: onde colocar cada real, o que fazer em cada semana dos primeiros 90 dias, as metas para medir e as regras que fazem a diferença. Troque o valor de entrada e a divisão se ajusta.'
    },
    {
      id: 'lancamento', sala: 1, tipo: 'lancamento', min: 8,
      titulo: 'Lançar a empresa no ar', sub: 'O checklist completo, do nome ao primeiro cliente',
      resumo: 'Tudo o que precisa estar pronto para a empresa começar a vender, em ordem e com prazo. Marque cada passo conforme for concluindo: o progresso fica salvo.'
    },
    {
      id: 'preco', sala: 1, min: 4,
      titulo: 'Quanto cobrar por um site', sub: 'Preço que paga o trabalho e dá lucro',
      resumo: 'Preço baixo demais transforma cada venda em prejuízo disfarçado. Estas quatro ideias ajudam a chegar a um valor que se sustenta.',
      licoes: [
        ['Comece pelo custo', 'Some as suas horas (quanto quer ganhar por hora vezes as horas do projeto), as ferramentas, os impostos e a taxa de pagamento. Esse é o piso: abaixo dele você paga para trabalhar.'],
        ['Cobre pelo valor', 'Um site que traz dez clientes por mês vale mais do que as horas gastas nele. Pergunte ao cliente quanto vale um cliente novo.'],
        ['Ofereça três opções', 'Com três planos, a maioria escolhe o do meio, e o mais caro faz o do meio parecer razoável.'],
        ['Tenha receita que se repete', 'Manutenção mensal transforma venda única em renda previsível. Dez clientes no plano mensal já pagam as contas antes de o mês começar.']
      ],
      pratica: 'Calcule o piso do seu plano mais vendido e confira se o preço atual deixa pelo menos 30% de margem.'
    },
    {
      id: 'formalizar', sala: 1, min: 4,
      titulo: 'Formalizar sem medo', sub: 'CNPJ, nota fiscal e conta separada',
      resumo: 'Formalizar abre portas: nota fiscal, conta de empresa e clientes maiores. O caminho é mais simples do que parece.',
      licoes: [
        ['Por que formalizar', 'Com CNPJ você emite nota, vende para empresas, abre conta de pessoa jurídica e contribui para a previdência. Muitos clientes só contratam com nota.'],
        ['MEI ou outro formato', 'O MEI é o caminho mais simples e barato, mas tem limite de R$ 81 mil por ano e uma lista fechada de ocupações. Criação de sites e web design não estão nessa lista oficial; o Sebrae ou um contador indicam o formato certo (por exemplo, uma microempresa no Simples Nacional).'],
        ['Separe as contas', 'Conta de empresa só para a empresa. Defina um valor fixo para você por mês e não misture o resto.'],
        ['Guarde para os impostos', 'Separe uma parte de cada venda para impostos e taxas antes de considerar o resto como lucro.']
      ],
      pratica: 'Marque uma conversa com o Sebrae ou com um contador e pergunte: qual formato serve para criação de sites, quanto custa abrir e quanto custa por mês.'
    },

    /* ------------------------------ sala 2 · Técnicas de Venda ------------------------------ */
    {
      id: 'primeiro-cliente', sala: 2, min: 5,
      titulo: 'Primeiro cliente em 30 dias', sub: 'Um plano de prospecção simples',
      resumo: 'Cliente não aparece: é procurado. Este é um roteiro de quatro passos para sair do zero.',
      licoes: [
        ['Escolha um nicho', 'Um tipo de negócio por vez: clínicas, restaurantes, salões. A mensagem fica específica e o exemplo de um serve para o próximo.'],
        ['Monte uma lista de 50', 'Procure no mapa do Google e no Instagram negócios sem site ou com site fraco. Anote nome, contato e o problema que você viu.'],
        ['Aborde com um diagnóstico', 'Não ofereça "um site". Mostre o que eles estão perdendo: "Procurei dentista no seu bairro e vocês não aparecem. Posso mostrar em 10 minutos como resolver?"'],
        ['Mantenha o ritmo', 'Dez contatos por dia útil. Das conversas saem reuniões, e das reuniões sai o primeiro contrato. Acompanhe cada etapa: contato, resposta, reunião, proposta, venda.']
      ],
      pratica: 'Monte hoje a lista dos dez primeiros negócios e envie as mensagens antes das 11h.'
    },
    {
      id: 'proposta', sala: 2, min: 4,
      titulo: 'A proposta que fecha', sub: 'Uma página que responde tudo',
      resumo: 'Proposta boa não é a mais longa: é a que tira as dúvidas e deixa claro o próximo passo.',
      licoes: [
        ['Comece pelo problema', 'Repita, com as palavras do cliente, o que ele quer resolver. Quem se sente entendido lê até o fim.'],
        ['Mostre o resultado', 'Descreva como o negócio fica depois: aparecer no Google, receber pedidos pelo WhatsApp, passar confiança.'],
        ['Deixe o escopo claro', 'Diga o que está incluído, o que não está, o prazo e o que você precisa receber dele. Clareza evita retrabalho.'],
        ['Termine com data', 'Apresente o plano recomendado ao lado de um maior e feche com uma ação simples: "Para começar na segunda, basta confirmar até sexta."']
      ],
      pratica: 'Reescreva a sua última proposta em uma página única, seguindo estas quatro partes.'
    },
    {
      id: 'objecoes', sala: 2, min: 4,
      titulo: 'Respondendo objeções', sub: 'O que dizer quando o cliente trava',
      resumo: 'Objeção quase nunca é um "não": é uma dúvida que ainda não foi respondida.',
      licoes: [
        ['"Está caro"', 'Volte ao valor: "Quanto vale um cliente novo para você? Com dois clientes por mês, em quanto tempo o site se paga?" Se precisar, reduza o escopo, não o preço.'],
        ['"Vou pensar"', 'Descubra a dúvida real: "Claro. O que falta para você decidir com segurança?" E combine uma data para retomar a conversa.'],
        ['"Meu sobrinho faz"', 'Não ataque. Mostre a diferença: prazo, texto de venda, SEO e suporte. "O site vai trazer clientes ou só existir?"'],
        ['"Já tenho Instagram"', '"Ótimo, ele atrai. O site converte: aparece no Google, reúne todas as informações e não depende do alcance da rede."']
      ],
      pratica: 'Escreva a sua resposta para cada uma das quatro objeções e treine em voz alta.'
    },

    /* ------------------------------ sala 3 · Marketing Digital ------------------------------ */
    {
      id: 'anuncios', sala: 3, min: 4,
      titulo: 'Anúncios com pouco dinheiro', sub: 'Como testar com R$ 10 por dia',
      resumo: 'Anúncio não precisa de verba alta para começar. Precisa de uma oferta clara e de um teste bem medido.',
      licoes: [
        ['Uma oferta, um público', 'Anuncie uma coisa só, por exemplo "landing page em 7 dias", para um tipo de negócio em uma região.'],
        ['Teste pequeno', 'R$ 10 por dia durante uma semana já mostra qual anúncio chama atenção. Use dois ou três criativos com a mesma oferta.'],
        ['Olhe o número certo', 'Curtida não paga boleto. Acompanhe quanto custa cada conversa iniciada e cada orçamento pedido.'],
        ['Corte e reforce', 'Pause o que não traz conversa e ponha a verba no que traz. Só aumente o valor depois da primeira venda.']
      ],
      pratica: 'Defina a oferta, o público e o valor diário do seu primeiro teste de sete dias.'
    },
    {
      id: 'conteudo', sala: 3, min: 4,
      titulo: 'Conteúdo que atrai cliente', sub: 'O que postar sem virar refém da rede',
      resumo: 'Postar todo dia não é o objetivo. O objetivo é que cada post aproxime alguém de pedir um orçamento.',
      licoes: [
        ['Mostre o trabalho', 'Antes e depois, bastidores e entregas. Prova vale mais do que promessa.'],
        ['Responda dúvidas', 'Cada pergunta de cliente vira um post: "Quanto custa um site?", "Preciso de domínio?".'],
        ['Tenha um formato fixo', 'Três posts por semana, sempre nos mesmos dias: um resultado, uma dica, uma oferta. Constância ganha de inspiração.'],
        ['Sempre faça um convite', 'Todo post termina com um próximo passo: "Quer um diagnóstico do seu site? Chame no WhatsApp."']
      ],
      pratica: 'Liste nove ideias (três resultados, três dicas, três ofertas) e agende as três primeiras.'
    },
    {
      id: 'seo-local', sala: 3, min: 4,
      titulo: 'SEO local em uma tarde', sub: 'Aparecer para quem procura perto',
      resumo: 'Quem pesquisa "serviço + bairro" já quer comprar. Aparecer nessa busca custa pouco e rende muito.',
      licoes: [
        ['Perfil da Empresa no Google', 'Crie ou reivindique o perfil, com endereço, horário, fotos e a categoria correta. É gratuito e aparece no mapa.'],
        ['Use as palavras do cliente', 'Coloque "serviço + cidade ou bairro" no título da página, no primeiro parágrafo e na descrição.'],
        ['Peça avaliações', 'Peça uma avaliação a cada cliente atendido e responda todas. Perfil bem avaliado aparece mais e convence mais.'],
        ['Site rápido no celular', 'Página lenta perde visita. Use imagens leves e deixe o botão de contato visível logo no topo.']
      ],
      pratica: 'Atualize o Perfil da Empresa e peça avaliação a três clientes hoje.'
    },

    /* ------------------------------ sala 4 · Criação de Sites ------------------------------ */
    {
      id: 'landing', sala: 4, min: 4,
      titulo: 'Anatomia de uma landing page', sub: 'As seções que fazem o visitante agir',
      resumo: 'Uma landing page tem um trabalho só: levar o visitante até um botão. Cada seção existe para tirar uma dúvida no caminho.',
      licoes: [
        ['Topo em 5 segundos', 'Título com o resultado, uma frase de apoio e um botão. Quem chega precisa entender o que é e o que fazer sem rolar a página.'],
        ['Prova', 'Depoimentos, números reais, marcas atendidas ou fotos do trabalho. Nunca invente: prova falsa destrói a confiança.'],
        ['Como funciona', 'Três passos e a lista do que o cliente recebe. Tire as dúvidas antes que virem objeção.'],
        ['Um único chamado', 'Repita o mesmo botão ao longo da página. Mais de uma ação divide a atenção.']
      ],
      pratica: 'Abra uma landing page sua e responda: dá para entender a oferta em 5 segundos?'
    },
    {
      id: 'briefing', sala: 4, min: 4,
      titulo: 'Briefing: as perguntas certas', sub: '30 minutos que evitam semanas de retrabalho',
      resumo: 'Projeto que começa sem briefing termina em refação. Quatro blocos de perguntas resolvem.',
      licoes: [
        ['Objetivo', '"O que o site precisa fazer acontecer: ligações, pedidos, agendamentos?" Sem objetivo, todo layout parece bom.'],
        ['Público', 'Quem compra, o que procura e que dúvida tem antes de fechar.'],
        ['Referências e marca', 'Três sites de que gosta, três de que não gosta, logotipo, cores e fotos disponíveis.'],
        ['Conteúdo e prazos', 'Quem escreve os textos, quem aprova e até quando. Projeto atrasa por falta de material, não de código.']
      ],
      pratica: 'Monte o seu roteiro de briefing com dez perguntas e use na próxima reunião.'
    },
    {
      id: 'entrega', sala: 4, min: 4,
      titulo: 'Checklist de entrega', sub: 'O que conferir antes de publicar',
      resumo: 'Os erros que o cliente encontra no primeiro dia são sempre os mesmos. Esta conferência pega todos.',
      licoes: [
        ['Celular primeiro', 'Abra em um telefone de verdade. Botões fáceis de tocar, texto legível, nada cortado.'],
        ['Velocidade', 'Imagens comprimidas e no tamanho certo. Teste em uma ferramenta de velocidade e corrija o que estiver em vermelho.'],
        ['Contatos funcionando', 'Clique em todos os botões, envie o formulário, abra o WhatsApp. Um link quebrado custa clientes.'],
        ['O básico invisível', 'Título e descrição de cada página, ícone do site, certificado de segurança (https) e medição de visitas instalada.']
      ],
      pratica: 'Passe este checklist no último site que você publicou.'
    },

    /* ------------------------------ sala 5 · Rotina e Gestão ------------------------------ */
    {
      id: 'rotina', sala: 5, min: 4,
      titulo: 'Rotina de quem trabalha sozinho', sub: 'Vender, produzir e cuidar do caixa na mesma semana',
      resumo: 'Sozinho, você é o comercial, a produção e o financeiro. A rotina é o que impede um de engolir os outros.',
      licoes: [
        ['Blocos fixos', 'Manhã para vender (prospecção e propostas), tarde para produzir. Sem o bloco de venda, o mês seguinte fica sem cliente.'],
        ['Três prioridades', 'Comece o dia com três tarefas que movem a empresa. O resto é bônus.'],
        ['Um dia para o caixa', 'Toda sexta: emitir notas, cobrar, registrar entradas e saídas e separar os impostos.'],
        ['Descanso faz parte', 'Tenha hora para encerrar e um dia livre. Quem trabalha esgotado entrega pior e vende menos.']
      ],
      pratica: 'Bloqueie na agenda desta semana os horários de venda, de produção e de caixa.'
    },
    {
      id: 'pos-venda', sala: 5, min: 4,
      titulo: 'Pós-venda que gera indicação', sub: 'O cliente atual é o melhor vendedor',
      resumo: 'A venda mais barata é a segunda venda para o mesmo cliente, e a seguinte é a indicação dele.',
      licoes: [
        ['Entregue com treinamento', 'Mostre como usar e editar o site. Cliente seguro reclama menos e elogia mais.'],
        ['Acompanhe', 'Mande mensagem com 7 e com 30 dias: "Como estão os contatos pelo site?" Problema resolvido cedo vira elogio.'],
        ['Peça na hora certa', 'Quando o cliente elogiar, peça a avaliação no Google e uma indicação: "Conhece alguém que precisa de um site?"'],
        ['Ofereça a continuidade', 'Manutenção mensal, novas páginas, anúncios. Vender para quem já confia custa menos do que conquistar alguém novo.']
      ],
      pratica: 'Envie hoje a mensagem de 30 dias para os seus últimos clientes.'
    },
    {
      id: 'metas', sala: 5, min: 4,
      titulo: 'Metas e números da semana', sub: 'Cinco números que mostram se a empresa anda',
      resumo: 'Sem número, toda semana parece igual. Com cinco números, dá para ver o que mudar.',
      licoes: [
        ['Poucos números', 'Contatos feitos, propostas enviadas, vendas, receita e dinheiro em caixa. Mais do que isso vira ruído.'],
        ['Meta de trás para frente', 'Quer 4 vendas no mês? Se uma em cada 4 propostas fecha, são 16 propostas. Se uma em cada 3 conversas vira proposta, são 48 conversas.'],
        ['Revisão semanal', 'Vinte minutos na sexta: o que funcionou, o que travou e o que muda na semana seguinte.'],
        ['Uma mudança por vez', 'Altere uma coisa e meça. Mudar tudo junto impede de saber o que deu certo.']
      ],
      pratica: 'Anote os cinco números desta semana e defina a meta da próxima.'
    }
  ];

  T.livro = function (id) {
    for (var i = 0; i < T.BIBLIOTECA.length; i++) if (T.BIBLIOTECA[i].id === id) return T.BIBLIOTECA[i];
    return null;
  };
  /* Procura um livro por palavras do título (ou pelo id). */
  T.buscarLivro = function (texto) {
    var t = T.normalizar ? T.normalizar(texto) : String(texto || '').toLowerCase(), melhor = null, pontos = 0;
    if (T.livro(t.trim())) return T.livro(t.trim());
    var termos = t.split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2; });
    T.BIBLIOTECA.forEach(function (b) {
      var alvo = (T.normalizar ? T.normalizar(b.titulo + ' ' + b.sub + ' ' + b.id) : (b.titulo + ' ' + b.sub).toLowerCase()), p = 0;
      termos.forEach(function (w) { if (alvo.indexOf(w) >= 0) p += w.length; });
      if (p > pontos) { pontos = p; melhor = b; }
    });
    return pontos >= 5 ? melhor : null;
  };
  /* Texto corrido de um livro (para o Jarvis ler em voz alta). */
  T.textoDoLivro = function (b) {
    if (!b) return '';
    if (!b.licoes) return b.titulo + '. ' + b.resumo;
    return b.titulo + '. ' + b.resumo + ' ' + b.licoes.map(function (l, i) { return (i + 1) + '. ' + l[0].replace(/"/g, '') + ': ' + l[1]; }).join(' ') + ' Para praticar: ' + b.pratica;
  };

  /* ==========================================================================
     GUIA 1 — COMO DIVIDIR O SALÁRIO
     "pct" é a fatia sugerida de cada envelope. Quando os gastos essenciais
     passam de 55%, o plano corta os outros envelopes nesta ordem — folga,
     lazer, estudo, empresa, reserva — respeitando o piso ("min") de cada um.
     ======================================================================== */
  T.SALARIO = {
    padrao: 2000,
    envelopes: [
      { id: 'essenciais', nome: 'Essenciais', pct: 55, desc: 'Moradia, contas, mercado e transporte' },
      { id: 'reserva', nome: 'Reserva de emergência', pct: 10, min: 5, desc: 'Sai primeiro, no dia do pagamento' },
      { id: 'empresa', nome: 'Empresa', pct: 15, min: 5, desc: 'Domínio, ferramentas, anúncios e formalização' },
      { id: 'estudo', nome: 'Estudo', pct: 5, min: 0, desc: 'Um curso, um livro ou uma ferramenta por mês' },
      { id: 'lazer', nome: 'Lazer e pessoal', pct: 10, min: 5, desc: 'Dinheiro livre, dividido por semana' },
      { id: 'folga', nome: 'Folga do mês', pct: 5, min: 0, desc: 'Pequenos imprevistos; o que sobrar vai para a reserva' }
    ],
    cortes: ['folga', 'lazer', 'estudo', 'empresa', 'reserva']
  };

  /* valor = salário líquido; essenciais = quanto os gastos essenciais somam de
     verdade (opcional). Devolve o plano pronto para mostrar. */
  T.planoSalario = function (valor, essenciais) {
    valor = Math.max(0, Math.round(+valor || 0));
    var env = T.SALARIO.envelopes, v = {}, teto = Math.round(valor * 0.55), i;
    env.forEach(function (e) { v[e.id] = Math.round(valor * e.pct / 100); });
    var informado = essenciais != null && essenciais !== '' && !isNaN(+essenciais), situacao = 'padrao', sobra = 0, falta = 0;
    if (informado) {
      var real = Math.max(0, Math.round(+essenciais));
      v.essenciais = real;
      if (real <= teto) { sobra = teto - real; v.reserva += sobra; situacao = sobra > 0 ? 'sobra' : 'padrao'; }
      else {
        falta = real - teto; situacao = 'aperto';
        for (i = 0; i < T.SALARIO.cortes.length && falta > 0; i++) {
          var id = T.SALARIO.cortes[i], e = env.filter(function (x) { return x.id === id; })[0];
          var piso = Math.round(valor * (e.min || 0) / 100), corte = Math.min(falta, Math.max(0, v[id] - piso));
          v[id] -= corte; falta -= corte;
        }
        if (falta > 0) situacao = 'estouro';
      }
    }
    /* acerta os centavos de arredondamento na folga (ou na reserva, se a folga zerou) */
    var soma = env.reduce(function (a, e) { return a + v[e.id]; }, 0), dif = valor - soma;
    if (situacao !== 'estouro' && dif) { if (v.folga + dif >= 0) v.folga += dif; else v.reserva += dif; }
    return {
      valor: valor, teto: teto, situacao: situacao, sobra: sobra, falta: falta, informado: informado,
      linhas: env.map(function (e) {
        return { id: e.id, nome: e.nome, desc: e.desc, valor: v[e.id], pct: valor ? v[e.id] / valor : 0, sugerido: Math.round(valor * e.pct / 100), semana: e.id === 'lazer' ? Math.floor(v[e.id] / 4) : null };
      }),
      v: v,
      metaReserva: v.essenciais * 3
    };
  };

  /* Os passos do guia, já com os valores do plano escritos. "brl" formata dinheiro. */
  T.passosSalario = function (p, brl) {
    var v = p.v;
    return [
      ['Parta do valor que cai na conta', 'Planeje com o salário líquido: ' + brl(p.valor) + '. Se o valor muda de mês para mês, use o menor dos últimos três.'],
      ['Separe a reserva primeiro', 'No dia do pagamento, transfira ' + brl(v.reserva) + ' para uma conta separada, que renda todo dia. A meta é juntar 3 meses de gastos essenciais: ' + brl(p.metaReserva) + '.'],
      ['Pague os essenciais', 'Aluguel, contas, mercado e transporte: ' + brl(v.essenciais) + '. O teto saudável é 55% do salário (' + brl(p.teto) + ').'],
      ['Guarde o dinheiro da empresa', brl(v.empresa) + ' por mês em uma conta só da empresa: domínio, ferramentas, primeiros anúncios e formalização.'],
      ['Invista em você', brl(v.estudo) + ' para estudo: um curso, um livro ou uma ferramenta por mês.'],
      ['Divida o lazer por semana', brl(v.lazer) + ' de dinheiro livre, ou ' + brl(Math.floor(v.lazer / 4)) + ' por semana. Acabou o da semana, espera a próxima.'],
      ['Deixe uma folga', brl(v.folga) + ' para pequenos imprevistos. O que sobrar no último dia do mês vai para a reserva.'],
      ['Revise uma vez por mês', 'No dia do pagamento, compare o planejado com o que foi gasto e ajuste. Tem dívida com juros altos? Ela passa na frente da empresa e do lazer até acabar.']
    ];
  };

  /* ==========================================================================
     GUIA 3 — PLANO DE 90 DIAS COM R$ 3.000
     Envelopes com "valor" são custos fixos, pagos nesta ordem; "pct" é a fatia
     do total para anúncios (só a partir de R$ 1.500 de entrada); "resto" fica
     com o que sobrar. Valores de impostos e ferramentas são estimativas:
     confira os atuais antes de pagar.
     ======================================================================== */
  T.PLANO = {
    padrao: 3000,
    dias: 90,
    custoMensal: 230,   /* impostos mínimos (o DAS do MEI de serviços é R$ 86,05 em 2026) + ferramentas (cerca de R$ 150); fora do MEI, some o contador */
    /* onde fazer cada coisa: só endereços oficiais ou dos próprios serviços, conferidos em novembro de 2026 */
    onde: [
      { envelope: 'base', links: [
        ['Registro.br', 'https://registro.br', 'o registro oficial dos domínios .br (cerca de R$ 40 por ano; confira o valor lá)'],
        ['Zoho Mail, plano gratuito', 'https://www.zoho.com/mail/zohomail-pricing.html', 'e-mail com o seu domínio: até 5 contas e 5 GB, pelo navegador e pelo app'],
        ['Google Workspace', 'https://workspace.google.com/intl/pt-BR/pricing', 'alternativa paga: R$ 40,90 por conta por mês'],
        ['Cloudflare Pages: enviar uma pasta', 'https://developers.cloudflare.com/pages/get-started/direct-upload/', 'coloca a pasta site/ no ar arrastando os arquivos'],
        ['Por que não a Vercel grátis', 'https://vercel.com/docs/plans/hobby', 'o plano Hobby é só para uso pessoal, não comercial'],
        ['WhatsApp Business', 'https://whatsappbusiness.com/pt-br/products/business-app/', 'o aplicativo para atender os clientes'],
        ['Perfil da Empresa no Google', 'https://business.google.com/br/business-profile/', 'gratuito: coloca a empresa no mapa e nas buscas']
      ] },
      { envelope: 'formal', links: [
        ['Portal do Empreendedor', 'https://www.gov.br/empresas-e-negocios/pt-br/empreendedor', 'o site oficial do MEI'],
        ['Ocupações permitidas ao MEI', 'https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/quero-ser-mei/atividades-permitidas', 'a lista oficial; criação de sites não aparece nela'],
        ['Perguntas frequentes do MEI', 'https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/perguntas-frequentes', 'limite de R$ 81 mil por ano e o valor do DAS de 2026'],
        ['Conta gov.br', 'https://www.gov.br/governodigital/pt-br/conta-gov-br', 'para abrir empresa pela internet você precisa do nível prata ou ouro'],
        ['Sebrae', 'https://sebrae.com.br', 'orientação para escolher o formato da empresa'],
        ['Emissor Nacional de NFS-e', 'https://www.nfse.gov.br/EmissorNacional', 'onde a nota fiscal de serviço é emitida']
      ] },
      { envelope: 'ferramentas', links: [
        ['Claude', 'https://claude.com/pricing', 'plano Pro: US$ 20 por mês (US$ 17 no anual), cobrado em dólar'],
        ['Canva', 'https://www.canva.com/pt_br/', 'design de posts, propostas e apresentações']
      ] },
      { envelope: 'materiais', links: [
        ['Unsplash', 'https://unsplash.com/pt-br', 'fotos gratuitas para uso comercial; regras em unsplash.com/license'],
        ['Pexels', 'https://www.pexels.com/pt-br/', 'fotos e vídeos gratuitos; não use como logotipo; regras em pexels.com/license'],
        ['Google Fonts', 'https://fonts.google.com', 'fontes gratuitas para os sites']
      ] },
      { envelope: 'anuncios', links: [
        ['Anúncios da Meta (Facebook e Instagram)', 'https://www.facebook.com/business/ads', 'não há orçamento mínimo; o anúncio roda por pelo menos 7 dias'],
        ['Google Ads: orçamento', 'https://business.google.com/br/google-ads/campaign-budget/', 'você define o valor por dia e um limite por mês'],
        ['Cursos gratuitos da Meta', 'https://www.facebook.com/business/learn', 'aprenda a anunciar antes de gastar'],
        ['Cursos do Google (Skillshop)', 'https://skillshop.withgoogle.com', 'cursos de Google Ads']
      ] }
    ],
    envelopes: [
      { id: 'base', nome: 'Domínio, e-mail e site no ar', valor: 200, quando: 'Semana 1', desc: 'Domínio .com.br (cerca de R$ 40 por ano), e-mail com o domínio e o site de vendas hospedado de graça' },
      { id: 'formal', nome: 'Formalização', valor: 300, quando: 'Semana 2', desc: 'CNPJ e os primeiros impostos. Criação de sites não está na lista oficial do MEI: peça orientação ao Sebrae ou a um contador antes de abrir' },
      { id: 'ferramentas', nome: 'Ferramentas por 3 meses', valor: 450, quando: 'Meses 1 a 3', desc: 'IA, design e agenda. Cancele o que não usar no mês.' },
      { id: 'materiais', nome: 'Materiais dos projetos', valor: 250, quando: 'Quando precisar', desc: 'Fotos, fontes, plugins e imprevistos dos primeiros sites' },
      { id: 'anuncios', nome: 'Anúncios de teste', pct: 20, quando: 'A partir da semana 5', desc: 'Só com portfólio pronto: de R$ 10 a R$ 20 por dia, na oferta que mais teve resposta' },
      { id: 'reserva', nome: 'Reserva da empresa', resto: true, quando: 'Só em emergência', desc: 'Não mexa até o primeiro contrato: é ela que garante mais meses de tentativa' }
    ],
    fases: [
      {
        nome: 'Oferta e base', quando: 'Semana 1', dias: [1, 7], gasta: ['base'],
        objetivo: 'Saber exatamente o que você vende e para quem, e ter onde receber contatos.',
        tarefas: [
          ['Escolha um nicho só', 'Um tipo de negócio da sua região: clínicas, salões, restaurantes, oficinas. A mensagem fica específica e um projeto serve de exemplo para o próximo.'],
          ['Defina a oferta de entrada', 'Comece pela Landing Page: é a mais fácil de vender e fica pronta em 7 dias.'],
          ['Crie a oferta de lançamento', 'Para os 3 primeiros clientes, um desconto em troca de depoimento e de poder mostrar o site no portfólio. Deixe claro que é por tempo limitado.'],
          ['Registre o domínio e o e-mail', 'O .com.br custa cerca de R$ 40 por ano no Registro.br. Use um e-mail com o domínio, como contato@seudominio.com.br.'],
          ['Publique o site de vendas', 'Preencha o contato em site/catalogo.js e hospede a pasta site/ de graça no Cloudflare Pages. O plano grátis da Vercel não permite uso comercial.'],
          ['Configure o WhatsApp Business', 'Num número só da empresa, com saudação, horário de atendimento e o catálogo dos planos.']
        ],
        meta: 'Site de vendas no ar e WhatsApp Business pronto.'
      },
      {
        nome: 'Portfólio e formalização', quando: 'Semana 2', dias: [8, 14], gasta: ['formal', 'materiais'],
        objetivo: 'Ter o que mostrar e poder emitir nota fiscal.',
        tarefas: [
          ['Monte 3 sites de demonstração', 'Para negócios fictícios do seu nicho, marcados como "projeto conceito". Use as skills de criação de sites para ir rápido e revise tudo.'],
          ['Crie o Perfil da Empresa no Google', 'É gratuito e coloca a empresa no mapa.'],
          ['Prepare o Instagram', 'Nove posts antes de começar a prospectar: três trabalhos, três dicas e três ofertas.'],
          ['Formalize do jeito certo', 'Na lista oficial de ocupações do MEI (Anexo XI da Resolução CGSN nº 140) não há criação de sites nem web design. Antes de abrir o CNPJ, peça orientação ao Sebrae ou a um contador sobre o formato certo e o custo mensal. Não abra MEI com outra ocupação para fazer sites: é irregular.'],
          ['Prepare proposta e contrato', 'Uma página de proposta e um contrato simples, com escopo, prazo, pagamento e o que o cliente precisa enviar.']
        ],
        meta: '3 projetos no portfólio, perfis prontos e CNPJ encaminhado.'
      },
      {
        nome: 'Prospecção todo dia', quando: 'Semanas 3 e 4', dias: [15, 28], gasta: [],
        objetivo: 'Conversar com o maior número possível de donos de negócio do seu nicho.',
        tarefas: [
          ['Liste 100 negócios', 'Pelo Google Maps e pelo Instagram, com site fraco ou sem site. Anote nome, contato e o problema que você viu.'],
          ['Faça de 10 a 15 contatos por dia útil', 'Mensagem personalizada, com um diagnóstico: "Procurei dentista no seu bairro e vocês não aparecem. Posso mostrar em 10 minutos como resolver?" Um vídeo de 1 minuto mostrando o problema funciona ainda melhor.'],
          ['Responda no mesmo dia', 'Quem demora perde o cliente para quem respondeu primeiro.'],
          ['Reunião curta, proposta em 24 horas', 'Vinte minutos para entender o negócio e a proposta no dia seguinte, com data para começar.'],
          ['Anote os números', 'Contatos, conversas, propostas e vendas, aqui embaixo, em "Seus números".']
        ],
        meta: '150 contatos, 15 conversas, 5 propostas e a primeira venda.'
      },
      {
        nome: 'Primeiro cliente e anúncios', quando: 'Semanas 5 a 8', dias: [29, 56], gasta: ['anuncios', 'ferramentas'],
        objetivo: 'Entregar o primeiro site impecável e transformar o cliente em prova.',
        tarefas: [
          ['Receba 50% de entrada', 'O restante na entrega. A entrada paga os custos do projeto e protege você.'],
          ['Entregue no prazo', 'Prazo curto e cumprido vale mais do que um site perfeito e atrasado.'],
          ['Peça depoimento, avaliação e indicação', 'Depoimento em vídeo, avaliação no Google e duas indicações de quem também precisa de site.'],
          ['Ligue o anúncio de teste', 'De R$ 10 a R$ 20 por dia, para a oferta que mais teve resposta na prospecção. Pause o anúncio que não traz conversa.'],
          ['Ofereça o Plano Presença', 'A manutenção mensal vira renda previsível. Ofereça a todo cliente na entrega.'],
          ['Continue prospectando', 'Dez contatos por dia útil, mesmo com projeto em andamento.']
        ],
        meta: '2 a 3 vendas no total e o primeiro depoimento.'
      },
      {
        nome: 'Repetir e crescer', quando: 'Semanas 9 a 12', dias: [57, 90], gasta: [],
        objetivo: 'Fazer mais do que deu certo e ter fontes de cliente que não dependem só de você.',
        tarefas: [
          ['Dobre o que trouxe venda', 'O canal e a mensagem que mais fecharam recebem o seu tempo e a verba. O resto sai.'],
          ['Feche parcerias de indicação', 'Contadores, fotógrafos, gráficas e gestores de tráfego atendem os mesmos clientes. Ofereça uma comissão por indicação que fechar.'],
          ['Suba o preço', 'Depois de três depoimentos, a oferta de lançamento acaba e o preço volta ao normal.'],
          ['Venda o segundo produto', 'Site Institucional ou Loja Virtual para os clientes que já confiam em você.'],
          ['Defina o seu salário', 'Com receita estável, tire um valor fixo por mês e divida com o guia do salário.']
        ],
        meta: '4 a 6 vendas no total e 2 clientes no Plano Presença.'
      }
    ],
    /* metas dos 90 dias: 10% dos contatos viram conversa, 1 em 3 conversas vira proposta, 1 em 4 propostas fecha */
    metas: [
      { id: 'contatos', nome: 'Contatos feitos', meta: 600 },
      { id: 'conversas', nome: 'Conversas', meta: 60 },
      { id: 'propostas', nome: 'Propostas enviadas', meta: 20 },
      { id: 'vendas', nome: 'Vendas fechadas', meta: 5 },
      { id: 'receita', nome: 'Dinheiro recebido', meta: 9000, dinheiro: true }
    ],
    regras: [
      ['Venda antes de gastar', 'Nada de logotipo caro, escritório, equipamento novo ou curso antes do primeiro cliente. O dinheiro precisa durar até as vendas começarem.'],
      ['Prospecção é o motor', 'Anúncio ajuda, mas no começo quem traz cliente é você conversando com donos de negócio todo dia útil.'],
      ['Um nicho por vez', 'Falar com todo mundo é não falar com ninguém. Troque de nicho só depois de 150 contatos sem resposta.'],
      ['Sempre 50% de entrada', 'Nunca comece um projeto sem a entrada paga e a proposta aceita por escrito.'],
      ['Guarde o imposto de cada venda', 'Separe uma parte de cada pagamento antes de considerar o resto como lucro.'],
      ['Respeite quem você aborda', 'Mensagem personalizada, poucas por dia, e pare se a pessoa pedir. Disparo em massa pode fazer o WhatsApp bloquear o seu número e criar problema com a LGPD.'],
      ['Revise toda sexta', 'Vinte minutos com os números da semana. Mude uma coisa por vez para saber o que funcionou.']
    ]
  };

  /* Divide o dinheiro de entrada nos envelopes. Devolve { valor, situacao, linhas, v, mesesDeFolego }.
     situacao: 'ok' · 'sem-anuncio' (menos de R$ 1.500: anúncio fica para depois) · 'curto' (não cobre nem o básico) */
  T.planoCapital = function (valor) {
    var P = T.PLANO, v = {}, resto, situacao = 'ok', fixos = 0;
    valor = Math.max(0, Math.round(+valor || 0)); resto = valor;
    P.envelopes.forEach(function (e) { if (e.valor) { fixos += e.valor; v[e.id] = Math.min(e.valor, resto); resto -= v[e.id]; } });
    var anuncio = valor >= 1500 ? Math.floor(valor * P.envelopes.filter(function (e) { return e.pct; })[0].pct / 100 / 10) * 10 : 0;
    v.anuncios = Math.min(anuncio, resto); resto -= v.anuncios;
    v.reserva = resto;
    if (valor < fixos) situacao = 'curto'; else if (valor < 1500) situacao = 'sem-anuncio';
    return {
      valor: valor, situacao: situacao, v: v, fixos: fixos,
      mesesDeFolego: Math.floor(v.reserva / P.custoMensal),
      linhas: P.envelopes.map(function (e) { return { id: e.id, nome: e.nome, desc: e.desc, quando: e.quando, valor: v[e.id] || 0, pct: valor ? (v[e.id] || 0) / valor : 0 }; })
    };
  };
  /* Em que fase está o dia d (1 a 90). Depois do dia 90, fica na última. */
  T.faseDoPlano = function (d) {
    var f = T.PLANO.fases;
    for (var i = 0; i < f.length; i++) if (d <= f[i].dias[1]) return i;
    return f.length - 1;
  };

  /* ==========================================================================
     GUIA 2 — LANÇAR A EMPRESA NO AR
     Cada item: [id, o que fazer, dica]. Os ids ficam salvos no navegador
     quando você marca o passo como feito.
     ======================================================================== */
  T.LANCAMENTO = [
    { fase: 'Fundação', prazo: 'semana 1', itens: [
      ['oferta', 'Definir para quem você vende e qual problema resolve', 'Ex.: sites para negócios locais que ainda dependem só do Instagram.'],
      ['produtos', 'Fechar os produtos e os preços', 'Os planos atuais estão no botão Produtos; para mudar, edite site/catalogo.js.'],
      ['nome', 'Conferir se o nome da empresa está livre', 'Pesquise o domínio, o nome de usuário nas redes e a marca no INPI.'],
      ['dominio', 'Registrar o domínio', 'Endereços .com.br são registrados no Registro.br.']
    ] },
    { fase: 'Formalização', prazo: 'semanas 1 e 2', itens: [
      ['cnpj', 'Abrir o CNPJ', 'Criação de sites não está na lista oficial do MEI: peça orientação ao Sebrae ou a um contador sobre o formato certo antes de abrir.'],
      ['conta', 'Abrir uma conta só para a empresa', 'Nada de misturar com a conta pessoal.'],
      ['nota', 'Aprender a emitir nota fiscal', 'Emita uma nota de teste no sistema da sua prefeitura ou no emissor nacional.'],
      ['contrato', 'Preparar os modelos de proposta e de contrato', 'Escopo, prazo, pagamento e o que o cliente precisa enviar.']
    ] },
    { fase: 'Vitrine', prazo: 'semana 2', itens: [
      ['contato', 'Colocar o seu WhatsApp e e-mail no site', 'Preencha o bloco "contato" em site/catalogo.js.'],
      ['site', 'Publicar o site de vendas', 'O site está pronto na pasta site/: falta hospedar e apontar o domínio.'],
      ['portfolio', 'Montar 3 projetos de demonstração', 'Uma landing page, um site institucional e uma loja de exemplo.'],
      ['google', 'Criar o Perfil da Empresa no Google', 'É gratuito e faz a empresa aparecer no mapa e nas buscas.'],
      ['redes', 'Criar e arrumar os perfis nas redes', 'Mesmo nome, foto e descrição em todas, com link para o site.'],
      ['whatsapp', 'Configurar o WhatsApp Business', 'Mensagem de saudação, horário de atendimento e catálogo com os planos.']
    ] },
    { fase: 'Operação', prazo: 'semanas 2 e 3', itens: [
      ['pagamento', 'Definir como vai receber', 'Pix e cartão; uma entrada para começar e o restante na entrega.'],
      ['briefing', 'Criar o roteiro de briefing', 'As perguntas estão no livro "Briefing: as perguntas certas".'],
      ['processo', 'Escrever o passo a passo de entrega', 'Briefing, layout, construção, revisão e publicação, com prazo para cada etapa.'],
      ['ferramentas', 'Escolher as ferramentas de trabalho', 'Hospedagem, editor, agenda e controle financeiro.']
    ] },
    { fase: 'Primeiros clientes', prazo: 'semanas 3 e 4', itens: [
      ['lista', 'Montar uma lista de 50 negócios para abordar', 'Sem site ou com site fraco, todos do mesmo nicho.'],
      ['mensagem', 'Escrever a mensagem de abordagem', 'Com um diagnóstico específico, e não com "faço sites".'],
      ['oferta-inicial', 'Criar a oferta de lançamento', 'Condição especial para os 3 primeiros clientes em troca de depoimento.'],
      ['contatos', 'Fazer 10 contatos por dia útil', 'Registre contatos, respostas, reuniões e propostas.'],
      ['venda', 'Fechar o primeiro contrato', 'Contrato assinado e entrada recebida.']
    ] },
    { fase: 'Dia do lançamento', prazo: 'semana 4', itens: [
      ['anuncio', 'Anunciar a abertura nas redes e para os seus contatos', 'Conte o que a empresa faz, para quem e como pedir orçamento.'],
      ['trafego', 'Ligar o primeiro anúncio pago', 'Um teste pequeno, de R$ 10 por dia, por uma semana.'],
      ['medir', 'Instalar a medição de visitas e contatos', 'Sem medir, não dá para saber o que funcionou.']
    ] },
    { fase: 'Depois de lançar', prazo: 'todo mês', itens: [
      ['entrega', 'Entregar o primeiro site no prazo', 'E pedir a avaliação no Google na mesma semana.'],
      ['recorrente', 'Oferecer o plano mensal aos clientes', 'Manutenção vira receita previsível.'],
      ['numeros', 'Revisar os números toda sexta', 'Contatos, propostas, vendas, receita e caixa.']
    ] }
  ];

  /* feitos = { id: true }. Devolve o andamento do lançamento. */
  T.progressoLancamento = function (feitos) {
    feitos = feitos || {};
    var total = 0, ok = 0, proximos = [], fases = [];
    T.LANCAMENTO.forEach(function (f) {
      var okFase = 0;
      f.itens.forEach(function (it) {
        total++;
        if (feitos[it[0]]) { ok++; okFase++; } else proximos.push({ id: it[0], texto: it[1], dica: it[2], fase: f.fase });
      });
      fases.push({ fase: f.fase, prazo: f.prazo, feitos: okFase, total: f.itens.length });
    });
    return { total: total, feitos: ok, fracao: total ? ok / total : 0, proximos: proximos, fases: fases };
  };
})(typeof window !== 'undefined' ? window : globalThis);
