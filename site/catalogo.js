/* ============================================================================
   ATLAS DIGITAL ENGINEERING — catálogo da empresa
   ----------------------------------------------------------------------------
   Este é o ÚNICO lugar onde ficam o nome da empresa, o contato e os produtos
   com seus preços. Quem usa:
     · o site de vendas (site/index.html)
     · a torre de comando (botão "Produtos", vendas simuladas e o Jarvis)

   Para mudar um preço, um prazo ou um texto, edite aqui e recarregue a página.

   ANTES DE PUBLICAR O SITE: preencha o bloco "contato". Sem WhatsApp nem
   e-mail, o formulário de orçamento não tem para onde enviar o pedido.
   ========================================================================== */
(function (root) {
  'use strict';

  root.ATLAS_CATALOGO = {
    empresa: {
      nome: 'Atlas Digital Engineering',
      curto: 'Atlas',
      slogan: 'Sites que vendem'
    },

    /* Endereço da torre que atende o chat do site (os agentes de Vendas). Vazio = o mesmo
       endereço do site, como quando o site abre pela torre (http://localhost:5173/site/).
       Com o site hospedado na internet, coloque aqui o endereço público da torre
       (por exemplo, um túnel do Cloudflare) e esse endereço em SITE_ORIGENS no .env. */
    atendimento: '',

    contato: {
      whatsapp: '',    /* só números, com país e DDD. Ex.: 5511999998888 */
      email: '',       /* ex.: contato@suaempresa.com.br */
      instagram: '',   /* só o nome do perfil, sem @ */
      cidade: ''       /* ex.: São Paulo, SP */
    },

    /* preco em R$. mensal: true = cobrado todo mês.
       recomendado: true = recebe o selo "Recomendado" no site. */
    produtos: [
      {
        id: 'landing', nome: 'Landing Page', preco: 1490, mensal: false,
        prazo: '7 dias', tamanho: '1 página',
        chamada: 'Uma página. Um objetivo.',
        resumo: 'Página única feita para transformar visita em contato: ideal para anúncios, lançamentos e serviços.',
        ideal: 'Quem anuncia, lança um serviço ou quer começar rápido',
        itens: ['1 página com até 6 seções', 'Texto de venda escrito com você', 'Botão de WhatsApp e formulário', 'Pronta para celular', 'Domínio configurado e medição de visitas'],
        blog: false, loja: false, painel: false, suporte: '30 dias'
      },
      {
        id: 'institucional', nome: 'Site Institucional', preco: 2900, mensal: false, recomendado: true,
        prazo: '15 dias', tamanho: 'Até 5 páginas',
        chamada: 'A sede do seu negócio na internet.',
        resumo: 'Site completo para apresentar a empresa e os serviços e passar confiança para quem pesquisa antes de comprar.',
        ideal: 'Empresas e profissionais que precisam ser encontrados e levados a sério',
        itens: ['Até 5 páginas: início, sobre, serviços, contato…', 'SEO básico para aparecer no Google', 'Mapa, horários e botões de contato', 'Painel para você editar textos e fotos', 'Treinamento de 1 hora na entrega'],
        blog: false, loja: false, painel: true, suporte: '60 dias'
      },
      {
        id: 'blog', nome: 'Site + Blog', preco: 3600, mensal: false,
        prazo: '20 dias', tamanho: 'Até 7 páginas + blog',
        chamada: 'Conteúdo que traz cliente todo mês.',
        resumo: 'Tudo do Site Institucional e mais um blog pronto para publicar artigos e ganhar posição no Google.',
        ideal: 'Quem quer atrair clientes com conteúdo, sem depender só de anúncio',
        itens: ['Tudo do Site Institucional', 'Blog com categorias e busca', '3 artigos iniciais otimizados', 'Modelo de artigo para você continuar', 'Integração com as redes sociais'],
        blog: true, loja: false, painel: true, suporte: '60 dias'
      },
      {
        id: 'loja', nome: 'Loja Virtual', preco: 5400, mensal: false,
        prazo: '30 dias', tamanho: 'Loja completa',
        chamada: 'Sua loja aberta 24 horas.',
        resumo: 'Loja online com carrinho, pagamento e cálculo de frete, pronta para vender todos os dias.',
        ideal: 'Quem vende produtos e quer receber pedidos pela internet',
        itens: ['Até 50 produtos cadastrados por nós', 'Pagamento por Pix, cartão e boleto', 'Cálculo de frete automático', 'Painel de pedidos e estoque', 'Treinamento para cadastrar produtos'],
        blog: true, loja: true, painel: true, suporte: '90 dias'
      },
      {
        id: 'presenca', nome: 'Plano Presença', preco: 890, mensal: true,
        prazo: 'Todo mês', tamanho: 'Manutenção',
        chamada: 'Seu site sempre vivo.',
        resumo: 'Cuidamos do site todo mês: atualizações, segurança, conteúdo novo e relatório de resultados.',
        ideal: 'Quem já tem site e não quer se preocupar com ele',
        itens: ['Atualizações de textos e fotos', 'Backup e segurança', '2 conteúdos novos por mês', 'Relatório mensal de visitas e contatos', 'Atendimento prioritário'],
        blog: true, loja: false, painel: true, suporte: 'Contínuo'
      }
    ],

    /* Perguntas frequentes do site. Revise as respostas: elas descrevem como
       A SUA empresa trabalha (prazos, pagamento, ajustes). */
    duvidas: [
      ['Em quanto tempo meu site fica pronto?', 'Depende do plano: a Landing Page sai em cerca de 7 dias, o Site Institucional em 15 e a Loja Virtual em 30. O prazo começa a contar quando recebemos seus textos, fotos e logotipo.'],
      ['Preciso já ter domínio e hospedagem?', 'Não. Se você ainda não tem, cuidamos do registro do domínio e da hospedagem e deixamos tudo configurado. Explicamos os custos anuais desses serviços antes de você decidir.'],
      ['Como funciona o pagamento?', 'Metade para começar e metade na entrega, por Pix ou cartão. O Plano Presença é cobrado todo mês.'],
      ['Consigo editar o site depois?', 'Sim. Nos planos com painel, você recebe um treinamento para trocar textos, fotos e preços sem depender de programador.'],
      ['O site vai aparecer no Google?', 'Todo site sai com o SEO básico: títulos, descrições, velocidade e cadastro no Google. Chegar ao topo depende de conteúdo e de tempo; o Site + Blog e o Plano Presença foram feitos para isso.'],
      ['E se eu não gostar do layout?', 'Você aprova o visual antes de começarmos a construir, com duas rodadas de ajuste incluídas.']
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
