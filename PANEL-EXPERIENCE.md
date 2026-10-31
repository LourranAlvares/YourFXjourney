# Painel e experiência do assistente

## Estrutura e fontes

O projeto existente permanece em HTML/JavaScript e no workspace privado por usuário. `public/panel-engine.js` projeta os dados existentes, recebendo `st`, `realizedTradeR` e a avaliação do plano como adaptadores. `public/panel.js` apresenta quatro seções internas: Visão Geral, Performance, Risco & Capital e Insights. Não há outra navegação lateral nem outro armazenamento de trades.

Os filtros compartilham período, conta registrada, ativo, estratégia, sessão, direção, setup e status. As comparações usam um período anterior de mesma duração; o histórico completo não inventa um período anterior. As sessões respeitam a convenção original dos horários de entrada, sem presumir fuso de corretora.

A Visão Geral tem seis indicadores, resumo complementar e um único gráfico principal com modos P&L acumulado, saldo, P&L diário, drawdown e R. O gráfico acompanha a largura disponível, com proporção aproximada de 1,8:1, e resumos ao lado no desktop. Performance expande os detalhes; capital e insights ficam nas respectivas seções. O calendário principal mantém o detalhamento das operações. O diário passa a priorizar uma galeria de seis registros por página, sem calendário duplicado, com prints, anotações, edição e destaque para revisão.

## Métricas e capital

- P&L usa o líquido armazenado. Metadados de custos de novos imports MT5 são informativos e nunca subtraídos novamente. Registros antigos não recebem custos fictícios.
- Win rate inclui breakevens no denominador. Profit factor sem perdas é infinito; apenas breakevens não produz uma razão válida.
- R usa a função existente e mostra cobertura. Ausência de R não vira zero; R por preço indica ausência de ajuste de custos.
- Capital exige base inicial confirmada. `S.capitalMovements` armazena UUID, tipo, data/hora, valor positivo, moeda, conta e nota. Depósitos/saques não contam como P&L ou operações. O drawdown de capital ajusta seu pico pelos fluxos.
- Retorno sem fluxos usa capital de abertura; com fluxos usa Modified Dietz, ponderando o tempo dos movimentos. Base negativa ou denominador não positivo não gera retorno percentual. Base zero só é utilizável com aporte registrado e denominador positivo.
- Sem câmbio automático. Dados de moedas incompatíveis não produzem totais monetários ou razões de lucro/perda. Capital de múltiplas contas exige seleção de uma conta. A avaliação de limites é feita por conta; sequências entre contas não são interpretadas como uma sessão.
- Risco efetivo, equity ao vivo e posições abertas só aparecem quando registrados. Risco inicial não é exposição simultânea e perda não é risco efetivo.
- `S.missedSetups` guarda somente oportunidades documentadas, sem lucro hipotético. Decisões e check-ins reutilizam `S.growth`. Filtros sem associação disponível não recebem contagens atribuídas artificialmente.

## Assistente e mercado

`public/experience-engine.js` seleciona uma mensagem pessoal por regras e evidências explícitas: desvios registrados, FOMO informado, sequências de resultado, aderência com amostra suficiente e conquistas recalculadas. Não diagnostica, não infere emoção de perdas e não atribui causalidade. O briefing mantém uma única prioridade operacional. A apresentação da conta usa o texto solicitado e preserva o formulário.

As preferências ficam em `S.assistantExperience.preferences`. A memória de apresentação fica no navegador, em chave por conta, separada do histórico; não há promessa de sincronização dessa memória entre dispositivos. A consulta de IA permanece uma ação explícita pela integração existente; abrir a Home não chama IA. A imagem original do personagem recebe somente um realce discreto na interação, sem simular animação de cabeça ou rastreamento de olhos.

Os ativos selecionados ficam à direita, entre briefing e próximos eventos. A API de mercado reutiliza as mesmas velas horárias e o mesmo cache: variação entre o último fechamento horário disponível e o último fechamento anterior ao dia UTC daquele dado. Exibe data/horário e identifica o último dia quando não é o atual. Não é ATR nem cotação em tempo real ou retorno oficial da bolsa. Sem dado anterior, a variação fica indisponível. Exige o provedor já previsto em `TRADE_MARKET_KEY`; nenhuma chave é exposta no frontend.

## Persistência, aparência e validação

Todos os novos registros pessoais usam `persistState`, com rollback em erro e sincronização do workspace existente quando configurada. Nenhum acesso administrativo a desempenho ou emoções foi acrescentado. Os cards equivalentes usam a mesma borda e luz dourada em hover/foco, sem mudar cores semânticas, dimensões ou causar sobreposição. Respeita movimento reduzido.

Verificação automatizada: `npm test`, `npm run test:panel`, testes de diário, crescimento, revisões, conquistas, cloud, MT5, dashboard e layouts responsivos. O teste de integração cobre 320–1920px, paginação, botões separados, privacidade, quatro seções, proporção do gráfico, capital após recarga e preferências. Os testes financeiros cobrem breakeven, R parcial, Modified Dietz, fluxos separados de resultado, bases ausentes/zero/negativas e moedas incompatíveis. Validação de navegador usa Chromium; Safari físico não foi verificado neste ambiente.
