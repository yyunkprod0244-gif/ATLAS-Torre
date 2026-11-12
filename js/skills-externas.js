/* ============================================================================
   TORRE — skills externas (projetos do GitHub ligados aos andares)
   ----------------------------------------------------------------------------
   Diferente das skills geradas em js/dados.js, estas são projetos reais,
   publicados por outras pessoas no GitHub. A torre só as CATALOGA: mostra no
   andar e na sala certos o que cada uma faz, o que precisa, como instalar e
   os cuidados. Nenhuma está instalada.

   Antes de instalar qualquer uma, passe a skill pelo SkillSpector (abaixo)
   e leia o código: skills rodam com as mesmas permissões que o seu agente.

   Campos: id, nome, repo (dono/projeto), andar (id do andar), sala (nome do
   squad), chaves (como alguém chamaria a skill numa frase; usadas pelo
   Jarvis), tipo, licenca, resumo, uso (para que serve AQUI), faz (lista),
   precisa, instalar (comandos, um por linha), atencao.
   Informações tiradas do README de cada projeto em novembro de 2026.
   Para adicionar outra, copie um bloco e troque os campos.
   ========================================================================== */
(function (root) {
  'use strict';
  var T = (root.Torre = root.Torre || {});

  T.SKILLS_EXTERNAS = [
    /* ---------------------------------------------- 2º andar · Vendas ---------------------------------------------- */
    {
      id: 'anthropic-skills', nome: 'Skills da Anthropic', repo: 'anthropics/skills',
      andar: 'vendas', sala: 'Propostas', chaves: ['anthropic skills', 'skills da anthropic', 'anthropics', 'document skills'],
      tipo: 'Coleção de skills de exemplo e plugin do Claude Code', licenca: 'Apache-2.0 na maioria (confira cada skill)',
      resumo: 'O repositório público de skills de exemplo da Anthropic: documentos (Word, PDF, PowerPoint e Excel), design, testes de aplicações web, comunicação e marca.',
      uso: 'Gerar propostas, contratos e apresentações para clientes em Word, PDF e PowerPoint.',
      faz: ['document-skills: cria e edita arquivos docx, pdf, pptx e xlsx', 'example-skills: exemplos de design, testes de apps web e criação de servidores MCP', 'template-skill: modelo para escrever a sua própria skill'],
      precisa: 'Claude Code. No Claude.ai, as skills de exemplo já vêm nos planos pagos.',
      instalar: '/plugin marketplace add anthropics/skills\n/plugin install document-skills@anthropic-agent-skills',
      atencao: 'A própria Anthropic diz que são para demonstração e estudo: teste no seu ambiente antes de usar em algo importante. Algumas skills executam scripts; leia antes de usar.'
    },

    /* ---------------------------------------------- 3º andar · Marketing ---------------------------------------------- */
    {
      id: 'agent-reach', nome: 'Agent Reach', repo: 'Panniantong/Agent-Reach',
      andar: 'marketing', sala: 'Dados e Métricas', chaves: ['agent reach'],
      tipo: 'Ferramenta de linha de comando (Python)', licenca: 'MIT',
      resumo: 'Dá aos agentes acesso de leitura e busca a plataformas que eles não alcançam sozinhos, como YouTube, Reddit, GitHub, Bilibili e V2EX, com um comando só.',
      uso: 'Pesquisar concorrentes, tendências e o que o público comenta antes de planejar uma campanha.',
      faz: ['agent-reach read <link>: lê uma página, um vídeo ou um post', 'agent-reach <canal> search: busca dentro de uma plataforma', 'agent-reach channels: lista os canais disponíveis', 'Só lê: não publica, não comenta e não curte'],
      precisa: 'Python 3.10 ou mais novo. A transcrição de vídeos do YouTube pede uma chave da Groq ou da OpenAI. Reddit, Xiaohongshu e outros canais pedem login.',
      instalar: 'Peça ao seu agente: "Instale o Agent Reach seguindo https://raw.githubusercontent.com/Panniantong/Agent-Reach/main/docs/install.md"',
      atencao: 'Nos sites que pedem login, ele copia o login do seu Chrome; o próprio projeto recomenda usar uma conta secundária. Ler X, Facebook e Instagram é experimental e pode ir contra as regras dessas redes. Não instale pelo PyPI: o pacote "agent-reach" de lá é de outro autor.'
    },

    /* ---------------------------------------------- 4º andar · Edição de Vídeo ---------------------------------------------- */
    {
      id: 'lemo-opuscar', nome: 'Lemo Opuscar', repo: 'lemomo-ai/lemo-opuscar',
      andar: 'video', sala: 'Motion e Efeitos', chaves: ['lemo', 'opuscar'],
      tipo: 'Plugin do Claude Code', licenca: 'MIT (filmes de exemplo em CC BY 4.0)',
      resumo: 'Faz filmes curtos inteiros em código (animação, texto, narração e trilha) a partir de 66 estilos visuais, sem modelo de vídeo.',
      uso: 'Vídeos de apresentação dos sites, explicações animadas e anúncios com o estilo da marca.',
      faz: ['/lemo-opuscar:lemo-opuscar: abre o menu de estilos', '66 estilos, como aquarela, ukiyo-e, motion suíço, quadro branco e art déco', 'Cria um estilo próprio a partir de um existente', 'Formato horizontal 1920×1080 ou vertical para redes'],
      precisa: 'Node 20+, ffmpeg 7+ e Python 3.11+. Cada filme leva de 30 a 60 minutos e consome bastante token.',
      instalar: 'claude plugin marketplace add lemomo-ai/lemo-opuscar\nclaude plugin install lemo-opuscar@lemolab',
      atencao: 'O agente escreve e executa código de renderização: use uma pasta só para isso. Na primeira vez, baixa guias e estilos para ~/lemo-opuscar. Seis narrações dos filmes de exemplo não podem ser reaproveitadas.'
    },
    {
      id: 'hyperframes', nome: 'HyperFrames', repo: 'heygen-com/hyperframes',
      andar: 'video', sala: 'Finalização', chaves: ['hyperframes', 'hyper frames', 'heygen'],
      tipo: 'Framework de vídeo (TypeScript), com plugin do Claude Code', licenca: 'Apache-2.0',
      resumo: 'Da HeyGen: transforma HTML, CSS e animações em vídeo MP4, sempre com o mesmo resultado, usando um Chrome sem janela e o FFmpeg.',
      uso: 'Vídeos de produto, legendas animadas e apresentações dos sites feitos a partir de páginas HTML.',
      faz: ['npx hyperframes init: cria um projeto de vídeo', 'npx hyperframes preview: mostra a prévia', 'npx hyperframes render: gera o MP4', 'npx hyperframes add <bloco>: adiciona efeitos prontos'],
      precisa: 'Node.js 22+ e FFmpeg. Conta na HeyGen só para compartilhar; algumas skills e modelos exigem o plano Pro, que é pago.',
      instalar: 'claude plugin marketplace add heygen-com/hyperframes\nclaude plugin install hyperframes@hyperframes',
      atencao: '"npx hyperframes share" publica o vídeo na internet (o plano grátis permite cinco projetos). /media-use pode enviar mídia para a HeyGen. /reverse-any-video e /style-sampling são pagos.'
    },

    /* ---------------------------------------------- 8º andar · Mega Brain ---------------------------------------------- */
    {
      id: 'freellmapi', nome: 'FreeLLMAPI', repo: 'tashfeenahmed/freellmapi',
      andar: 'cerebro', sala: 'Roteamento', chaves: ['freellmapi', 'free llm', 'freellm'],
      tipo: 'Servidor próprio (Node/TypeScript) com painel', licenca: 'MIT',
      resumo: 'Um endereço só, no formato da API da OpenAI, que distribui os pedidos entre os planos gratuitos de vários provedores de IA e troca de provedor quando um chega ao limite.',
      uso: 'Experimentar modelos gratuitos. Não é indicado para o Jarvis nem para clientes.',
      faz: ['Formatos /v1/chat/completions, /v1/messages e outros', 'Escolha automática de modelo: auto, auto:fast e auto:smart', 'Painel com modelos, chaves, testes e consumo', 'Controle de cota por chave'],
      precisa: 'Uma conta e uma chave em cada provedor que quiser usar. Node 20+ ou Docker; para Windows há um instalador .exe na página de Releases.',
      instalar: 'Instalador .exe na página de Releases do projeto, ou a partir do código:\nnpm install && npm run dev',
      atencao: 'O próprio projeto diz que é só para experimentação pessoal e que você responde pelos termos de cada provedor; usar várias contas grátis para fugir de limites pode violar esses termos. Prefira o instalador oficial a "curl … | bash" e guarde a chave unificada em segredo.'
    },
    {
      id: 'ruflo', nome: 'Ruflo', repo: 'ruvnet/ruflo',
      andar: 'cerebro', sala: 'Roteamento', chaves: ['ruflo', 'claude flow'],
      tipo: 'Orquestrador de agentes (CLI, servidor MCP e plugins)', licenca: 'MIT',
      resumo: 'Antigo Claude Flow: coloca no Claude Code enxames de agentes, memória compartilhada, hooks e ferramentas MCP, para dividir tarefas grandes entre vários agentes.',
      uso: 'Experimentar dividir projetos grandes entre vários agentes, como o Mega Brain faz na torre.',
      faz: ['/plugin install ruflo-core@ruflo: o núcleo, em forma de plugin', 'ruflo-swarm: enxames de agentes', 'ruflo-agentdb: memória dos agentes', 'npx ruflo@latest init: instala agentes, hooks e memória direto no projeto'],
      precisa: 'Claude Code 2.1.287 ou mais novo (para os plugins) e Node.js. No Windows, o instalador por script precisa do Git Bash ou do WSL.',
      instalar: '/plugin marketplace add ruvnet/ruflo\n/plugin install ruflo-core@ruflo',
      atencao: 'É grande: a instalação completa adiciona dezenas de agentes e hooks ao projeto, e vários agentes ao mesmo tempo gastam muito token. Os "mods" rodam com as suas permissões e sem isolamento. Prefira os plugins a "curl … | bash" e teste num projeto separado.'
    },
    {
      id: 'skillspector', nome: 'SkillSpector', repo: 'NVIDIA/SkillSpector',
      andar: 'cerebro', sala: 'Monitoramento', chaves: ['skillspector', 'skill spector'],
      tipo: 'Scanner de segurança (Python), com servidor MCP', licenca: 'Apache-2.0',
      resumo: 'Da NVIDIA: examina uma skill de agente antes da instalação, procurando injeção de prompt, vazamento de dados, padrões maliciosos e dependências com falhas conhecidas, e dá uma nota de risco.',
      uso: 'Passar toda skill nova por ele antes de instalar, inclusive as outras desta lista.',
      faz: ['skillspector scan <pasta ou link>: nota de risco e lista de achados', '--no-llm: análise só no seu computador, sem enviar arquivos para uma IA', 'skillspector mcp: vira uma ferramenta para o Claude Code checar skills', 'Relatório em JSON, Markdown ou SARIF'],
      precisa: 'Python 3.12 ou mais novo e o uv. A análise com IA usa uma chave de API (NVIDIA, OpenAI, Anthropic e outras); sem chave, use --no-llm.',
      instalar: 'uv tool install git+https://github.com/NVIDIA/skillspector.git\nskillspector scan ./pasta-da-skill --no-llm',
      atencao: 'Com a análise por IA, o conteúdo da skill vai para o provedor escolhido. Os nomes das dependências são consultados no OSV.dev mesmo com --no-llm. O projeto aponta limitações no Windows: teste antes de depender dele aqui. Ele avisa riscos, mas não isola nem bloqueia a skill.'
    },
    {
      id: 'chrome-devtools-mcp', nome: 'Chrome DevTools MCP', repo: 'ChromeDevTools/chrome-devtools-mcp',
      andar: 'cerebro', sala: 'Monitoramento', chaves: ['chrome devtools', 'devtools mcp', 'devtools'],
      tipo: 'Servidor MCP e plugin do Claude Code', licenca: 'Apache-2.0',
      resumo: 'As ferramentas de desenvolvedor do Chrome para agentes: o agente abre o site, mede o desempenho, lê o console e a rede e tira fotos da tela.',
      uso: 'Descobrir por que um site está lento ou quebrado e medir a velocidade antes da entrega.',
      faz: ['Rastreamento e análise de desempenho, inclusive o tempo de carregamento (LCP)', 'Pedidos de rede e mensagens do console', 'Fotos da tela e automação com espera automática', 'Skills incluídas: a11y-debugging, debug-optimize-lcp e memory-leak-debugging'],
      precisa: 'Node.js LTS e o Google Chrome atualizado. Não pede chave nem conta.',
      instalar: '/plugin marketplace add ChromeDevTools/chrome-devtools-mcp\n/plugin install chrome-devtools-mcp@chrome-devtools-plugins',
      atencao: 'O agente vê e pode alterar tudo o que está no navegador que ele controla: não use com contas pessoais abertas. O Google coleta estatísticas de uso por padrão (desligue com --no-usage-statistics), e a análise de desempenho pode enviar os endereços testados à API CrUX do Google (desligue com --no-performance-crux).'
    },
    {
      id: 'agent-browser', nome: 'Agent Browser', repo: 'vercel-labs/agent-browser',
      andar: 'cerebro', sala: 'Monitoramento', chaves: ['agent browser', 'agentbrowser'],
      tipo: 'Ferramenta de linha de comando (Rust), com servidor MCP', licenca: 'Apache-2.0',
      resumo: 'Da Vercel: dá ao agente um navegador que ele controla um comando por vez. Ele lê a página como texto, clica, preenche e confere o resultado.',
      uso: 'Testar os sites dos clientes como um visitante: navegar, preencher o formulário e tirar fotos da tela.',
      faz: ['agent-browser open <site>: abre a página', 'agent-browser snapshot -i: lista os elementos clicáveis', 'agent-browser click @e1: clica num elemento', 'screenshot, pdf e record: foto, PDF e gravação da tela', 'agent-browser mcp: funciona como servidor MCP'],
      precisa: 'Node.js para instalar. Na primeira vez, baixa o Chrome for Testing. Funciona no Windows.',
      instalar: 'npm install -g agent-browser\nagent-browser install',
      atencao: 'Pode se conectar a um Chrome já aberto (--cdp ou --auto-connect); nesse caso, enxerga o que estiver logado nele. O comando eval roda JavaScript na página. Os provedores de navegador na nuvem recebem o que você navega.'
    },
    {
      id: 'ponytail', nome: 'Ponytail', repo: 'DietrichGebert/ponytail',
      andar: 'cerebro', sala: 'Aprendizado', chaves: ['ponytail'],
      tipo: 'Skill e plugin do Claude Code', licenca: 'MIT',
      resumo: 'Faz o agente escrever menos código, só o necessário, e traz comandos para revisar mudanças e auditar o projeto inteiro.',
      uso: 'Revisar o código dos sites antes da entrega e manter a própria torre enxuta.',
      faz: ['/ponytail lite | full | ultra | off: escolhe a intensidade', '/ponytail-review: revisa a mudança atual (bugs, segurança, testes e o que cortar)', '/ponytail-audit: revisa o projeto inteiro, por prioridade', '/ponytail-debt: junta os atalhos deixados no código'],
      precisa: 'Claude Code. Não pede chave de API nem conta.',
      instalar: '/plugin marketplace add DietrichGebert/ponytail\n/plugin install ponytail@ponytail',
      atencao: 'Instala hooks que rodam a cada sessão: leia antes de aprovar. Instale só a partir de DietrichGebert/ponytail; o autor avisa que nunca distribui .exe nem .dll. O painel de custos ("band") não aparece na extensão do VS Code.'
    },
    {
      id: 'mattpocock-skills', nome: 'Skills do Matt Pocock', repo: 'mattpocock/skills',
      andar: 'cerebro', sala: 'Aprendizado', chaves: ['matt pocock', 'mattpocock', 'pocock'],
      tipo: 'Coleção de skills e plugin do Claude Code', licenca: 'MIT',
      resumo: 'Skills curtas de engenharia para corrigir as falhas mais comuns dos agentes: entender errado o pedido, falar demais, quebrar o código e acumular dívida de projeto.',
      uso: 'Planejar antes de construir, testar com TDD e prototipar telas para mostrar ao cliente.',
      faz: ['/grill-me: entrevista sobre o plano antes de começar', '/tdd: ciclo de teste, falha e correção, uma parte por vez', '/prototype: protótipo descartável em HTML ou várias versões de uma tela', '/diagnosing-bugs e /code-review: investigação de erros e revisão'],
      precisa: 'Um agente com suporte a skills. Na primeira vez, /setup-matt-pocock-skills pergunta qual gerenciador de tarefas você usa.',
      instalar: 'claude plugin install mattpocock-skills@claude-plugins-official',
      atencao: 'O plugin se atualiza sozinho. /to-spec e /to-tickets podem criar tarefas no seu GitHub ou GitLab, e /wizard gera scripts para credenciais e infraestrutura: leia antes de rodar. Instale por um caminho só; senão as skills aparecem duas vezes.'
    },
    {
      id: 'skills-cli', nome: 'Skills CLI', repo: 'vercel-labs/skills',
      andar: 'cerebro', sala: 'Aprendizado', chaves: ['skills cli', 'npx skills', 'vercel skills', 'cli de skills', 'instalador de skills'],
      tipo: 'Ferramenta de linha de comando (Node)', licenca: 'MIT',
      resumo: 'Da Vercel: o instalador do ecossistema aberto de skills. Procura, instala, atualiza e remove skills em vários agentes, como Claude Code, Codex e Cursor.',
      uso: 'Instalar e manter atualizadas as outras skills desta lista com um comando só.',
      faz: ['npx skills find <termo>: procura skills', 'npx skills add <repositório> --skill <nome>: instala uma skill escolhida', 'npx skills list e npx skills update: lista e atualiza as instaladas', 'npx skills remove: desinstala'],
      precisa: 'Node.js 22.20 ou mais novo. Não pede chave nem conta.',
      instalar: 'Não precisa instalar: roda com npx. Exemplo:\nnpx skills add vercel-labs/agent-skills --skill web-design-guidelines -a claude-code',
      atencao: 'Envia dados de uso anônimos por padrão; para desligar, defina DISABLE_TELEMETRY=1. Ele não verifica o conteúdo das skills que instala: passe cada uma pelo SkillSpector. Os comandos "experimental" podem mudar sem aviso.'
    },

    /* ---------------------------------------------- 9º andar · Estudo ---------------------------------------------- */
    {
      id: 'agent-skills', nome: 'Agent Skills da Vercel', repo: 'vercel-labs/agent-skills',
      andar: 'estudo', sala: 'Criação de Sites', chaves: ['agent skills', 'web design guidelines', 'skills da vercel'],
      tipo: 'Coleção de skills', licenca: 'MIT',
      resumo: 'Skills oficiais da Vercel para quem cria sites com React e Next.js: revisão de interface, desempenho, animações de transição e publicação.',
      uso: 'Revisar cada site antes da entrega com mais de 100 regras de acessibilidade, formulários, tipografia e modo escuro.',
      faz: ['web-design-guidelines: revisa a interface com mais de 100 regras', 'react-best-practices: mais de 40 regras de desempenho para React e Next.js', 'react-view-transitions e composition-patterns: animações e componentes', 'deploy-to-vercel: publica o site na Vercel'],
      precisa: 'Node.js, para o npx. Para publicar ou otimizar, uma conta na Vercel.',
      instalar: 'npx skills add vercel-labs/agent-skills --skill web-design-guidelines -a claude-code',
      atencao: 'deploy-to-vercel coloca o site no ar de verdade; sem login, cria uma publicação temporária. vercel-optimize lê as métricas do seu projeto na Vercel. Algumas skills executam scripts.'
    },
    {
      id: 'taste-skill', nome: 'Taste Skill', repo: 'Leonxlnx/taste-skill',
      andar: 'estudo', sala: 'Criação de Sites', chaves: ['taste skill', 'taste'],
      tipo: 'Skill e plugin do Claude Code', licenca: 'MIT',
      resumo: 'Faz o agente criar sites com direção de arte de verdade (fotos reais, composição pensada e uma checagem no navegador), em vez de landing pages genéricas.',
      uso: 'Elevar o visual dos sites dos clientes e conferir a consistência antes da entrega.',
      faz: ['design-taste-frontend: a skill principal de direção de arte', 'scripts/photos.mjs e icons.mjs: buscam fotos e ícones de marcas', 'scripts/consistency.mjs: confere a página num navegador', 'scripts/gate.mjs: checagem final antes de encerrar'],
      precisa: 'Node.js 22+ e Chrome, Edge ou Chromium. ffmpeg é opcional. Não pede chave de API.',
      instalar: '/plugin marketplace add Leonxlnx/taste-skill\n/plugin install taste-skill@taste-skill',
      atencao: 'Instala uma checagem final que roda como hook quando o agente termina (até três rodadas). Os scripts abrem um Chrome sem janela e baixam fotos e fontes da internet. O projeto avisa que não tem moeda nem token oficial: ignore quem oferecer um.'
    },
    {
      id: 'magic-mcp', nome: '21st MCP (Magic)', repo: '21st-dev/magic-mcp',
      andar: 'estudo', sala: 'Criação de Sites', chaves: ['magic mcp', '21st'],
      tipo: 'Servidor MCP hospedado e plugin do Claude Code', licenca: 'ISC',
      resumo: 'Antigo Magic MCP: dá ao agente uma busca em mais de 10 mil componentes de React e Tailwind e, com o acesso liberado, gera interfaces com IA.',
      uso: 'Achar componentes prontos, como menus, cartões e formulários, para montar os sites mais rápido.',
      faz: ['search: procura componentes, temas e modelos', 'get_component: traz o código de um componente', 'generate e iterate_generation: geram interfaces com IA, se o acesso estiver liberado', 'search_logo: procura logotipos de marcas'],
      precisa: 'Uma chave gratuita em 21st.dev/mcp. A geração com IA e parte dos componentes exigem plano pago.',
      instalar: 'claude plugin marketplace add 21st-dev/magic-mcp\n/plugin install 21st',
      atencao: 'Tudo passa pelo servidor da 21st.dev: os pedidos do agente saem do seu computador. A chave fica salva no arquivo de configuração do MCP. As chaves antigas do Magic foram anuladas.'
    },
    {
      id: 'shadcn-ui-mcp', nome: 'shadcn/ui MCP', repo: 'Jpisnice/shadcn-ui-mcp-server',
      andar: 'estudo', sala: 'Criação de Sites', chaves: ['shadcn'],
      tipo: 'Servidor MCP (Node)', licenca: 'MIT',
      resumo: 'Dá ao agente acesso aos componentes, blocos e exemplos do shadcn/ui v4 para React, Svelte, Vue e React Native.',
      uso: 'Montar interfaces com componentes padronizados e acessíveis, sem o agente inventar código.',
      faz: ['Código dos componentes do shadcn/ui v4', 'Exemplos de uso de cada componente', 'Blocos prontos: painéis, calendários e formulários', 'Dependências e configuração de cada componente'],
      precisa: 'Node.js (npx ou bunx). Um token do GitHub sem permissões é opcional, mas sobe o limite de 60 para 5.000 consultas por hora.',
      instalar: 'claude mcp add shadcn -- npx -y @jpisnice/shadcn-ui-mcp-server',
      atencao: 'Consulta a API do GitHub. Se você passar o token na linha de comando, ele pode ficar no histórico do terminal. No modo HTTP, o servidor escuta em todas as interfaces de rede e não tem senha: fique no modo padrão.'
    }
  ];

  /* Projetos que você mandou mas que a torre não cataloga, e o porquê. */
  T.SKILLS_IGNORADAS = [
    { repo: 'PryxIntel/free-llm-api', motivo: 'Faz o mesmo que o FreeLLMAPI, que já está na torre, e parece uma cópia dele (o banco de dados se chama freellmapi.sqlite). Tem poucos usuários e uma auditoria de segurança feita por ele mesmo.' }
  ];

  /* texto em minúsculas, sem acentos e com só letras e números separados por um espaço */
  function plano(s) { return (T.normalizar ? T.normalizar(s) : String(s || '').toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim(); }

  T.skillExterna = function (id) {
    for (var i = 0; i < T.SKILLS_EXTERNAS.length; i++) if (T.SKILLS_EXTERNAS[i].id === id) return T.SKILLS_EXTERNAS[i];
    return null;
  };
  /* Onde a skill fica na torre: { andar, k } (k = índice da sala, ou -1 se a sala não existir mais). */
  T.lugarDaSkill = function (s) {
    var a = T.andarPorId ? T.andarPorId(s.andar) : null;
    if (!a) return null;
    var k = -1;
    a.squads.forEach(function (q, i) { if (q.nome === s.sala) k = i; });
    return { andar: a, k: k };
  };
  /* Skills externas de um andar (n) ou de uma sala (n, k). */
  T.skillsExternasDe = function (n, k) {
    return T.SKILLS_EXTERNAS.filter(function (s) {
      var l = T.lugarDaSkill(s);
      return l && l.andar.n === n && (k == null || l.k === k);
    });
  };
  /* Procura pelo nome, pelo id ou por uma das chaves ("o que é o ponytail?").
     Compara palavras inteiras: "lemos" (de ler) não aciona o "Lemo Opuscar". Vence a chave mais longa. */
  T.buscarSkillExterna = function (texto) {
    var t = ' ' + plano(texto) + ' ', melhor = null, tam = 0;
    T.SKILLS_EXTERNAS.forEach(function (s) {
      [s.nome, s.id].concat(s.chaves || []).forEach(function (c) {
        var p = plano(c);
        if (p.length >= 4 && p.length > tam && t.indexOf(' ' + p + ' ') >= 0) { melhor = s; tam = p.length; }
      });
    });
    return melhor;
  };
})(typeof window !== 'undefined' ? window : globalThis);
