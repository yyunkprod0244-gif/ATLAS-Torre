/* ============================================================================
   TORRE — configuração da empresa e dos 8 andares
   ----------------------------------------------------------------------------
   Tudo aqui é fictício e foi feito para ser editado: nome da empresa, planos,
   orçamento do mês, squads, cargos e o vocabulário que gera as skills.
   Os agentes e as skills NÃO estão escritos um por um: são gerados em
   js/dados.js a partir destas listas (sempre iguais a cada carregamento).
   ========================================================================== */
(function (root) {
  'use strict';
  var T = (root.Torre = root.Torre || {});

  T.CONFIG = {
    empresa: {
      nome: 'ÁPICE',
      slogan: 'Sites que vendem'
    },

    /* Produtos vendidos pelo andar de Vendas (preço em R$). */
    planos: [
      { nome: 'Landing Page', preco: 1490, peso: 34 },
      { nome: 'Site Institucional', preco: 2900, peso: 30 },
      { nome: 'Site + Blog', preco: 3600, peso: 14 },
      { nome: 'Loja Virtual', preco: 5400, peso: 12 },
      { nome: 'Plano Presença (mensal)', preco: 890, peso: 10 }
    ],

    /* Quanto a empresa planeja gastar por mês, por categoria (R$). */
    orcamento: [
      { id: 'trafego', nome: 'Tráfego pago', planejado: 190000 },
      { id: 'ia', nome: 'IA e ferramentas', planejado: 118000 },
      { id: 'parceiros', nome: 'Freelancers e parceiros', planejado: 84000 },
      { id: 'impostos', nome: 'Impostos e taxas', planejado: 62000 },
      { id: 'servidores', nome: 'Servidores e domínios', planejado: 46000 },
      { id: 'reserva', nome: 'Reserva e imprevistos', planejado: 20000 }
    ],

    /* Contas fixas do mês: dia do vencimento e valor (R$). */
    contas: [
      { nome: 'Fatura das plataformas de anúncio', dia: 12, valor: 47500, cat: 'trafego' },
      { nome: 'Créditos de IA dos agentes', dia: 15, valor: 59000, cat: 'ia' },
      { nome: 'Freelancers — 1ª quinzena', dia: 15, valor: 42000, cat: 'parceiros' },
      { nome: 'Hospedagem e CDN', dia: 18, valor: 23000, cat: 'servidores' },
      { nome: 'Impostos do mês', dia: 20, valor: 62000, cat: 'impostos' },
      { nome: 'Domínios e licenças', dia: 25, valor: 8400, cat: 'servidores' },
      { nome: 'Freelancers — 2ª quinzena', dia: 30, valor: 42000, cat: 'parceiros' }
    ],

    /* Redes onde o 5º andar publica. "fatia" = parte dos posts que vai para cada uma. */
    plataformas: [
      { id: 'instagram', nome: 'Instagram', fatia: 0.31 },
      { id: 'tiktok', nome: 'TikTok', fatia: 0.27 },
      { id: 'youtube', nome: 'YouTube', fatia: 0.19 },
      { id: 'facebook', nome: 'Facebook', fatia: 0.13 },
      { id: 'linkedin', nome: 'LinkedIn', fatia: 0.10 }
    ],

    campanhas: [
      { nome: 'Site em 7 dias', canal: 'Meta Ads', fatia: 0.24 },
      { nome: 'Black Friday de Sites', canal: 'Meta Ads', fatia: 0.22 },
      { nome: 'Loja no ar', canal: 'Google Ads', fatia: 0.17 },
      { nome: 'Presença local', canal: 'Google Ads', fatia: 0.14 },
      { nome: 'Landing que converte', canal: 'TikTok Ads', fatia: 0.13 },
      { nome: 'Remarketing de orçamentos', canal: 'Meta Ads', fatia: 0.10 }
    ]
  };

  /* --------------------------------------------------------------------------
     OS 8 ANDARES
     cor      → cor de identidade do andar (paleta validada para daltonismo
                e contraste no fundo escuro; a ORDEM faz parte da validação,
                então evite trocar as cores de lugar).
     qtd      → quantos agentes o andar tem (mínimo 400).
     squads   → times do andar; "peso" define o tamanho relativo de cada um.
     vocab    → ações × objetos × contextos = lista de skills (mínimo 1000).
     ------------------------------------------------------------------------ */
  T.ANDARES = [
    {
      n: 1, id: 'rh', sigla: 'RH', cor: '#3987e5', qtd: 412,
      nome: 'RH · Entrada',
      titulo: 'RH e Entrada de Informação',
      missao: 'Recebe tudo o que chega à empresa — mensagens, pedidos, currículos e documentos — e organiza para o Mega Brain distribuir.',
      icone: 'M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5zm0 0h4.5a3.5 3.5 0 0 0 7 0H20',
      chaves: ['rh', 'recursos humanos', 'entrada', 'recepcao', 'triagem', 'curriculo', 'curriculos', 'caixa de entrada', 'informacao', 'informacoes'],
      squads: [
        { nome: 'Recepção Digital', peso: 1.2, cargos: ['Recepcionista digital', 'Atendente de primeiro contato'] },
        { nome: 'Triagem', peso: 1.3, cargos: ['Analista de triagem', 'Classificador de mensagens'] },
        { nome: 'Recrutamento', peso: 0.9, cargos: ['Recrutador', 'Analista de currículos'] },
        { nome: 'Onboarding', peso: 0.8, cargos: ['Analista de onboarding', 'Mentor de integração'] },
        { nome: 'Cultura e Pessoas', peso: 0.8, cargos: ['Guardião da cultura', 'Analista de clima'] },
        { nome: 'Documentação', peso: 1.0, cargos: ['Arquivista', 'Conferente de dados'] }
      ],
      vocab: {
        acoes: [
          ['Triagem de', 'Triagem'], ['Classificação de', 'Triagem'], ['Priorização de', 'Triagem'],
          ['Registro de', 'Registro'], ['Arquivamento de', 'Registro'], ['Conferência de', 'Registro'],
          ['Resumo de', 'Análise'], ['Análise de', 'Análise'], ['Validação de', 'Análise'],
          ['Encaminhamento de', 'Roteamento'], ['Distribuição de', 'Roteamento'], ['Acompanhamento de', 'Roteamento']
        ],
        objetos: ['mensagens recebidas', 'formulários de contato', 'pedidos de orçamento', 'dúvidas de clientes', 'currículos', 'documentos de admissão', 'feedbacks da equipe', 'solicitações internas', 'cadastros de parceiros', 'avaliações de desempenho', 'pedidos de suporte', 'ideias e sugestões'],
        contextos: ['em tempo real', 'por prioridade', 'por departamento', 'com checagem dupla', 'em lote', 'com resumo automático', 'via WhatsApp', 'via e-mail']
      }
    },
    {
      n: 2, id: 'vendas', sigla: 'VND', cor: '#d95926', qtd: 486,
      nome: 'Vendas',
      titulo: 'Vendas',
      missao: 'Transforma contatos em clientes: qualifica os leads, envia as propostas e fecha a venda dos sites.',
      icone: 'M4 17l5-5 4 4 7-8M15 8h5v5',
      chaves: ['vendas', 'venda', 'comercial', 'vendedor', 'vendedores', 'leads', 'propostas'],
      squads: [
        { nome: 'Prospecção', peso: 1.2, cargos: ['SDR', 'Prospector'] },
        { nome: 'Qualificação', peso: 1.1, cargos: ['Qualificador de leads', 'Analista de perfil'] },
        { nome: 'Propostas', peso: 0.9, cargos: ['Analista de propostas', 'Especialista em orçamentos'] },
        { nome: 'Negociação', peso: 1.0, cargos: ['Negociador', 'Especialista em objeções'] },
        { nome: 'Fechamento', peso: 1.0, cargos: ['Closer', 'Executivo de contas'] },
        { nome: 'Pós-venda', peso: 0.8, cargos: ['Sucesso do cliente', 'Analista de renovação'] }
      ],
      vocab: {
        acoes: [
          ['Prospecção de', 'Prospecção'], ['Abordagem de', 'Prospecção'], ['Reativação de', 'Prospecção'],
          ['Qualificação de', 'Qualificação'], ['Diagnóstico de', 'Qualificação'],
          ['Proposta para', 'Proposta'], ['Demonstração para', 'Proposta'],
          ['Follow-up com', 'Negociação'], ['Negociação com', 'Negociação'],
          ['Fechamento com', 'Fechamento'],
          ['Upsell para', 'Pós-venda'], ['Pós-venda com', 'Pós-venda']
        ],
        objetos: ['restaurantes', 'clínicas', 'lojas de roupa', 'imobiliárias', 'academias', 'escritórios de advocacia', 'salões de beleza', 'e-commerces', 'prestadores de serviço', 'escolas e cursos', 'pet shops', 'startups', 'franquias'],
        contextos: ['via WhatsApp', 'por e-mail', 'por ligação', 'pelo Instagram', 'pelo LinkedIn', 'em videochamada', 'com proposta personalizada', 'com oferta relâmpago']
      }
    },
    {
      n: 3, id: 'marketing', sigla: 'MKT', cor: '#199e70', qtd: 448,
      nome: 'Marketing',
      titulo: 'Marketing',
      missao: 'Atrai as pessoas certas: planeja campanhas, cria anúncios e conteúdo e mede o que realmente traz cliente.',
      icone: 'M4 10v4h3l7 4V6l-7 4H4zm13-1a4 4 0 0 1 0 6',
      chaves: ['marketing', 'mkt', 'campanha', 'campanhas', 'anuncio', 'anuncios', 'trafego', 'seo'],
      squads: [
        { nome: 'Tráfego Pago', peso: 1.2, cargos: ['Gestor de tráfego', 'Analista de anúncios'] },
        { nome: 'Conteúdo', peso: 1.1, cargos: ['Copywriter', 'Estrategista de conteúdo'] },
        { nome: 'SEO', peso: 0.9, cargos: ['Analista de SEO', 'Pesquisador de palavras-chave'] },
        { nome: 'Criação', peso: 1.0, cargos: ['Designer de anúncios', 'Diretor de arte'] },
        { nome: 'E-mail e CRM', peso: 0.8, cargos: ['Especialista em e-mail', 'Analista de CRM'] },
        { nome: 'Dados e Métricas', peso: 1.0, cargos: ['Analista de métricas', 'Cientista de campanhas'] }
      ],
      vocab: {
        acoes: [
          ['Planejamento de', 'Estratégia'], ['Pesquisa de', 'Estratégia'], ['Benchmark de', 'Estratégia'],
          ['Criação de', 'Criação'], ['Revisão de', 'Criação'], ['Padronização de', 'Criação'],
          ['Otimização de', 'Performance'], ['Teste A/B de', 'Performance'], ['Automação de', 'Performance'],
          ['Análise de', 'Dados'], ['Monitoramento de', 'Dados'], ['Auditoria de', 'Dados']
        ],
        objetos: ['anúncios', 'campanhas', 'páginas de captura', 'posts de blog', 'e-mails', 'criativos', 'palavras-chave', 'públicos', 'funis de venda', 'ofertas', 'calendários editoriais', 'relatórios de desempenho'],
        contextos: ['para Meta Ads', 'para Google Ads', 'para TikTok Ads', 'para SEO local', 'para lançamentos', 'para remarketing', 'para negócios locais', 'para e-commerce']
      }
    },
    {
      n: 4, id: 'video', sigla: 'VID', cor: '#c98500', qtd: 424,
      nome: 'Edição de Vídeo',
      titulo: 'Edição de Vídeo',
      missao: 'Produz os vídeos que vendem: roteiro, corte, legenda, trilha e uma versão pronta para cada rede.',
      icone: 'M4 6h16v12H4zM10 9.5v5l4.5-2.5z',
      chaves: ['video', 'videos', 'edicao', 'editor', 'editores', 'edita', 'render', 'renderizacao'],
      squads: [
        { nome: 'Roteiro', peso: 0.9, cargos: ['Roteirista', 'Pesquisador de ganchos'] },
        { nome: 'Corte e Montagem', peso: 1.3, cargos: ['Editor de vídeo', 'Diretor de cortes'] },
        { nome: 'Motion e Efeitos', peso: 1.0, cargos: ['Motion designer', 'Colorista'] },
        { nome: 'Áudio', peso: 0.8, cargos: ['Editor de áudio', 'Sound designer'] },
        { nome: 'Legendas', peso: 0.9, cargos: ['Legendador', 'Revisor de legendas'] },
        { nome: 'Finalização', peso: 1.1, cargos: ['Finalizador', 'Designer de thumbnails'] }
      ],
      vocab: {
        acoes: [
          ['Roteiro de', 'Pré-produção'],
          ['Corte de', 'Edição'], ['Montagem de', 'Edição'], ['Adaptação de', 'Edição'],
          ['Correção de cor de', 'Pós-produção'], ['Animação de', 'Pós-produção'], ['Renderização de', 'Pós-produção'],
          ['Mixagem de áudio de', 'Áudio'], ['Trilha sonora de', 'Áudio'],
          ['Legendagem de', 'Acabamento'], ['Thumbnail de', 'Acabamento'], ['Revisão de', 'Acabamento']
        ],
        objetos: ['vídeos curtos', 'depoimentos de clientes', 'tutoriais', 'anúncios em vídeo', 'bastidores', 'vídeos de portfólio', 'estudos de caso', 'vinhetas', 'apresentações de sites', 'lives gravadas', 'vídeos de oferta', 'trailers de lançamento'],
        contextos: ['para Reels', 'para Shorts', 'para TikTok', 'para YouTube', 'em formato vertical', 'em formato horizontal', 'em 4K', 'com entrega em 24h', 'com revisão final']
      }
    },
    {
      n: 5, id: 'publicacao', sigla: 'PUB', cor: '#d55181', qtd: 436,
      nome: 'Publicação',
      titulo: 'Publicação nas Redes',
      missao: 'Publica e acompanha tudo nas redes — YouTube, Instagram, TikTok e mais — sempre no melhor horário.',
      icone: 'M4 12l16-7-6 16-3-6.5L4 12z',
      chaves: ['publicacao', 'publicacoes', 'publica', 'postagem', 'postagens', 'posts', 'redes', 'redes sociais', 'youtube', 'instagram', 'tiktok', 'facebook', 'linkedin'],
      squads: [
        { nome: 'YouTube', peso: 1.0, cargos: ['Especialista em YouTube', 'Otimizador de títulos'] },
        { nome: 'Instagram', peso: 1.2, cargos: ['Especialista em Instagram', 'Curador de Reels'] },
        { nome: 'TikTok', peso: 1.1, cargos: ['Especialista em TikTok', 'Caçador de tendências'] },
        { nome: 'Facebook e LinkedIn', peso: 0.8, cargos: ['Publicador multicanal', 'Analista de páginas'] },
        { nome: 'Agendamento', peso: 0.9, cargos: ['Agendador de posts', 'Analista de horários'] },
        { nome: 'Comunidade', peso: 1.0, cargos: ['Gestor de comunidade', 'Moderador'] }
      ],
      vocab: {
        acoes: [
          ['Publicação de', 'Publicação'], ['Agendamento de', 'Publicação'], ['Repostagem de', 'Publicação'],
          ['Legenda para', 'Texto'], ['Hashtags para', 'Texto'], ['Otimização de título de', 'Texto'],
          ['Resposta a comentários em', 'Comunidade'], ['Moderação de', 'Comunidade'],
          ['Monitoramento de', 'Dados'], ['Análise de alcance de', 'Dados'],
          ['Impulsionamento de', 'Distribuição'], ['Arquivamento de', 'Distribuição']
        ],
        objetos: ['vídeos curtos', 'stories', 'vídeos longos', 'carrosséis', 'posts de oferta', 'depoimentos', 'lives', 'cortes de podcast', 'anúncios', 'enquetes', 'bastidores', 'chamadas para o site'],
        contextos: ['no YouTube', 'no Instagram', 'no TikTok', 'no Facebook', 'no LinkedIn', 'no melhor horário', 'em vários perfis', 'com link de venda']
      }
    },
    {
      n: 6, id: 'financeiro', sigla: 'FIN', cor: '#008300', qtd: 404,
      nome: 'Financeiro',
      titulo: 'Financeiro',
      missao: 'Controla o dinheiro: o que entra, o que sai e quanto ainda dá para gastar no mês.',
      icone: 'M12 3v18M16.5 7.5c-.8-1.2-2.4-2-4.5-2-2.8 0-4.5 1.3-4.5 3.2 0 4.3 9.5 2 9.5 6.3 0 2-1.9 3.5-5 3.5-2.4 0-4.2-.9-5-2.4',
      chaves: ['financeiro', 'financas', 'dinheiro', 'caixa', 'gastos', 'gasto', 'custos', 'orcamento', 'contas'],
      squads: [
        { nome: 'Contas a Receber', peso: 1.1, cargos: ['Analista de recebíveis', 'Conciliador'] },
        { nome: 'Contas a Pagar', peso: 1.0, cargos: ['Analista de pagamentos', 'Tesoureiro'] },
        { nome: 'Orçamento', peso: 1.0, cargos: ['Planejador de orçamento', 'Analista de custos'] },
        { nome: 'Fiscal', peso: 0.9, cargos: ['Analista fiscal', 'Emissor de notas'] },
        { nome: 'Cobrança', peso: 0.9, cargos: ['Analista de cobrança', 'Negociador de pendências'] },
        { nome: 'Projeções', peso: 1.1, cargos: ['Analista de projeções', 'Controller'] }
      ],
      vocab: {
        acoes: [
          ['Lançamento de', 'Operação'], ['Registro de', 'Operação'], ['Conciliação de', 'Operação'], ['Categorização de', 'Operação'],
          ['Controle de', 'Controle'], ['Aprovação de', 'Controle'], ['Auditoria de', 'Controle'], ['Revisão de', 'Controle'], ['Acompanhamento de', 'Controle'],
          ['Projeção de', 'Planejamento'], ['Previsão de', 'Planejamento'], ['Relatório de', 'Planejamento']
        ],
        objetos: ['receitas de sites', 'mensalidades', 'despesas com anúncios', 'assinaturas de ferramentas', 'custos de servidor', 'pagamentos de freelancers', 'impostos', 'notas fiscais', 'boletos', 'reembolsos', 'comissões de venda'],
        contextos: ['do mês', 'da semana', 'por cliente', 'por centro de custo', 'em tempo real', 'com alerta de limite', 'para o fechamento mensal', 'com comprovante']
      }
    },
    {
      n: 7, id: 'reunioes', sigla: 'REU', cor: '#9085e9', qtd: 408,
      nome: 'Reuniões',
      titulo: 'Sala de Reuniões',
      missao: 'Marca, conduz e registra as reuniões — com clientes e entre os andares — e entrega a ata pronta.',
      icone: 'M5 6h14v13H5zM5 10h14M9 4v4M15 4v4',
      chaves: ['reuniao', 'reunioes', 'sala', 'salas', 'agenda', 'encontro', 'call', 'calls'],
      squads: [
        { nome: 'Agenda', peso: 1.1, cargos: ['Agendador', 'Coordenador de agenda'] },
        { nome: 'Salas Virtuais', peso: 1.0, cargos: ['Anfitrião de sala', 'Técnico de transmissão'] },
        { nome: 'Atas e Registros', peso: 1.2, cargos: ['Redator de atas', 'Transcritor'] },
        { nome: 'Alinhamento Interno', peso: 0.9, cargos: ['Facilitador', 'Mediador'] },
        { nome: 'Reuniões com Clientes', peso: 1.0, cargos: ['Anfitrião de clientes', 'Analista de pautas'] },
        { nome: 'Follow-up', peso: 0.8, cargos: ['Analista de follow-up', 'Cobrador de tarefas'] }
      ],
      vocab: {
        acoes: [
          ['Agendamento de', 'Agenda'], ['Remarcação de', 'Agenda'], ['Confirmação de', 'Agenda'], ['Lembrete de', 'Agenda'],
          ['Pauta de', 'Condução'], ['Condução de', 'Condução'], ['Preparação de', 'Condução'],
          ['Ata de', 'Registro'], ['Resumo de', 'Registro'], ['Gravação de', 'Registro'], ['Transcrição de', 'Registro'],
          ['Follow-up de', 'Pós-reunião']
        ],
        objetos: ['reuniões de kickoff', 'reuniões de vendas', 'alinhamentos semanais', 'apresentações de proposta', 'revisões de projeto', 'reuniões de resultado', 'entrevistas', 'treinamentos', 'reuniões de planejamento', 'retrospectivas', 'reuniões com fornecedores', 'plantões de dúvidas'],
        contextos: ['com clientes', 'com a equipe', 'entre andares', 'por videochamada', 'com pauta fechada', 'em até 30 minutos', 'com tradução automática', 'com tarefas automáticas']
      }
    },
    {
      n: 8, id: 'cerebro', sigla: 'MBR', cor: '#e66767', qtd: 512,
      nome: 'Mega Brain',
      titulo: 'Mega Brain',
      missao: 'O cérebro da torre: conecta todos os andares, distribui informação e tarefas sozinho e escreve o resumo do dia.',
      icone: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.3 4.3M14.1 14.1l4.3 4.3M18.4 5.6l-4.3 4.3M9.9 14.1l-4.3 4.3',
      chaves: ['mega brain', 'megabrain', 'brain', 'cerebro', 'central', 'inteligencia central'],
      squads: [
        { nome: 'Roteamento', peso: 1.3, cargos: ['Roteador de dados', 'Orquestrador'] },
        { nome: 'Memória Central', peso: 1.1, cargos: ['Guardião de contexto', 'Analista de memória'] },
        { nome: 'Decisões Automáticas', peso: 1.0, cargos: ['Estrategista', 'Árbitro de prioridades'] },
        { nome: 'Resumos', peso: 0.9, cargos: ['Sintetizador', 'Redator do resumo diário'] },
        { nome: 'Monitoramento', peso: 1.0, cargos: ['Sentinela', 'Analista de padrões'] },
        { nome: 'Aprendizado', peso: 0.9, cargos: ['Otimizador de fluxos', 'Treinador de agentes'] }
      ],
      vocab: {
        acoes: [
          ['Roteamento de', 'Roteamento'], ['Distribuição de', 'Roteamento'], ['Sincronização de', 'Roteamento'],
          ['Correlação de', 'Inteligência'], ['Detecção de', 'Inteligência'], ['Previsão de', 'Inteligência'], ['Priorização de', 'Inteligência'],
          ['Memorização de', 'Memória'], ['Síntese de', 'Memória'], ['Resumo de', 'Memória'],
          ['Monitoramento de', 'Supervisão'], ['Auditoria de', 'Supervisão'], ['Otimização de', 'Supervisão']
        ],
        objetos: ['informações de vendas', 'métricas de marketing', 'tarefas entre andares', 'alertas financeiros', 'pedidos de clientes', 'atas de reunião', 'status de vídeos', 'resultados de publicações', 'gargalos operacionais', 'decisões do dia', 'dados de agentes', 'prioridades da semana'],
        contextos: ['em tempo real', 'a cada hora', 'para o resumo do dia', 'para todos os andares', 'com contexto histórico', 'com nível de urgência', 'sem intervenção humana', 'com aprendizado contínuo']
      }
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
