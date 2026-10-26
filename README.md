# YourFXjourney — Dashboard e Trading Insights

## Baixar e abrir no computador

1. No GitHub, clique em **Code → Download ZIP**.
2. Extraia o ZIP para uma pasta no computador.
3. Abra **YourFXjourney-standalone.html** no Chrome ou Edge. Não abra o HTML dentro do visualizador de ZIP.

Essa é a versão completa, com leitor de prints embutido. Não precisa instalar dependências, iniciar servidor nem manter conexão com a internet. O arquivo `YourFXjourney.html` é a versão modular para desenvolvimento/hospedagem e depende de `vendor/ocr` para ler prints.

Antes de trocar de arquivo ou navegador, exporte seu backup em **Trades → Exportar backup** e restaure-o na nova versão. Os dados de trading ficam no navegador; não são enviados ao GitHub.


Aplicação independente, sem framework, dependências de produção ou etapa de build. O arquivo enviado foi usado como base; importadores, editor de trades, prints, revisões, estratégias, risco e análises foram preservados.

## Abrir

Abra `YourFXjourney.html` no navegador ou sirva esta pasta com:

```sh
python3 -m http.server 8080
```

Os dados continuam na chave `yfx1` do localStorage. **Exporte um backup na versão anterior antes de mudar de endereço, navegador ou caminho do arquivo.** O armazenamento depende da origem; se necessário, use Trades → Restaurar backup na nova localização. Não há banco remoto nem sincronização entre dispositivos.

## Dashboard

- Identidade escura com dourado, navegação consistente e sete métricas principais, incluindo risco/retorno médio (payoff realizado: ganho médio ÷ perda média, sem depender do preenchimento de risco).
- Filtros por período, datas personalizadas, ativo e estratégia compartilhados pelo gráfico, calendário e estatísticas.
- Gráficos SVG de P&L acumulado, P&L diário, R acumulado, drawdown e saldo calculado, com pontos acessíveis por teclado, toque e cursor.
- Calendário mensal com P&L, quantidade e cobertura de R por dia. O detalhe do dia mostra operações, notas, aprendizados e prints, com acesso ao editor original.
- No celular, o gráfico adapta sua escala à tela e o calendário permite rolagem horizontal interna para manter os valores legíveis, sem transbordar a página.
- As métricas secundárias ficam abaixo do calendário. Não são inseridos dados de demonstração na aplicação.

## Convenções e limites dos dados

- Datas agrupadas pelo fechamento (`close.slice(0,10)`), preservando a convenção existente e sem nova conversão de fuso.
- P&L, win rate, profit factor, drawdown, sequências e R reutilizam `st()`; agregações usam `grp()` e filtros usam `ft()`.
- R só inclui trades com risco monetário positivo. A interface informa a cobertura; risco ausente não vira R=0.
- O saldo inicial legado de 10.000 exige confirmação em **Configurar saldo inicial e moeda**. O saldo registrado calculado usa todo o histórico; o gráfico de saldo respeita o período e inclui os resultados anteriores à data inicial. Esse gráfico fica indisponível com filtros de ativo/estratégia.
- Saldo calculado não é equity em tempo real: faltam posições abertas, depósitos e retiradas. Moeda é uma escolha explícita de formatação, sem conversão cambial.
- Drawdown monetário e percentual conservam a fórmula existente. O percentual é calculado sobre saldo inicial configurado + pico de P&L do recorte, como explicado na interface.
- Comissões separadas e R:R planejado não existem no modelo original: aparecem como indisponíveis. O payoff realizado é identificado separadamente. Os importadores podem já incluir taxas no P&L líquido; elas não são descontadas outra vez.
- Média diária considera somente dias com trades. O calendário e seus detalhes respeitam todos os filtros ativos; navegar para outro mês não altera o período selecionado.

## Verificação

Teste de regressão com Playwright, sem dependências adicionadas à aplicação:

```sh
# Com Playwright e Chromium disponíveis no ambiente de desenvolvimento:
node tests/dashboard.cjs
# Para usar outro executável Chromium:
BROWSER_EXECUTABLE_PATH=/caminho/para/chromium node tests/dashboard.cjs
```

O teste usa um contexto isolado com operações sintéticas apenas no navegador de teste. Verifica cálculos conhecidos, filtros, calendário e detalhes, prints/notas, gráficos e tooltips por teclado, saldo com histórico anterior, lançamento manual, persistência, importação CSV/deduplicação, oito páginas, exportação de backup e ausência de overflow da página em 320, 390, 768, 1024 e 1440px.

## Trading Insights

A nova navegação **Trading Insights** contém abas Diário, Semanal e Mensal, seletores de data, navegação entre períodos e atalho para o último trade. Usa os mesmos trades, `st()`, agrupamentos, convenções de fechamento, filtros por ativo/estratégia e P&L líquido da aplicação. Não requer serviço externo de IA, credencial ou dependência nova.

O relatório cruza o período escolhido com os filtros globais de data. O período anterior usa as mesmas posições de calendário, ativos e estratégias; para a semana ou mês atual, considera somente os dias decorridos. Dias inexistentes no mês anterior são limitados ao último dia disponível. Os intervalos usados aparecem no relatório. Comparações são descritivas, com denominadores visíveis, sem alegação de causalidade ou significância estatística.

### Registro opcional e disciplina

No editor de trade, expanda **Execução e disciplina** para registrar:

- Cumprimento das regras de entrada, risco, saída/gerenciamento, limites e plano: Sim, Não ou Não avaliado.
- Classificação declarada do setup: A, B, C ou Não avaliado.
- Erros por seleção rápida, distinguindo “Nenhum erro” de “Não avaliado”.

Setup, emoção, notas e prints continuam usando os campos existentes. Os novos dados ficam em `trade.behavior`; trades legados e importados não recebem respostas presumidas. Campos comportamentais são preservados pelo backup JSON e pela edição. As emoções Impulsivo e Hesitante foram acrescentadas sem remover opções existentes.

Em **Minhas regras operacionais**, o trader pode ativar critérios, descrever regras e configurar limites opcionais de operações por dia e risco informado por trade. Regras ficam em `S.insightRules`. A avaliação do teto diário considera todos os trades da conta, incluindo ativos ocultos por filtros. O teto monetário usa o risco planejado informado, não uma medida de risco efetivamente executado que a aplicação não possui. Sem limite ou sem informação, não se presume cumprimento.

A disciplina é a proporção de critérios cumpridos, com pesos iguais, nos trades que têm **todos os critérios ativos avaliados**. Exige pelo menos um trade avaliável e **60% de cobertura** no recorte. Qualidade de execução usa entrada, risco e saída; taxa de cumprimento do plano usa o campo explícito de plano, com a mesma cobertura mínima. Nenhum desses índices usa lucro, perdas ou win rate. A comparação da disciplina requer pelo menos cinco trades avaliáveis em cada janela.

Alterar regras recalcula relatórios históricos, sem reescrever trades. O sistema oferece no máximo três observações principais (uma por categoria), uma prioridade diária, até duas semanais e até três mensais. Erros e emoções só são descritos quando registrados. Frequências comparadas requerem cinco registros de erros em cada período e pelo menos 60% de cobertura. Grupos de ativo/setup/sessão exigem a amostra mínima configurada (padrão: 10); abaixo de 30 são tratados como exploratórios. A ausência de abertura impede agrupamento por sessão/horário de entrada.

A faixa configurável de breakeven é **operacional**, mostrada na análise detalhada. Não muda a classificação financeira existente nem recalcula P&L: as fórmulas financeiras continuam usando zero exato. Custos separados permanecem indisponíveis no modelo atual; custos já incluídos no P&L não são descontados novamente. Retorno percentual exige saldo inicial confirmado e usa o saldo de abertura calculado da conta; R exige risco monetário originalmente informado e mostra sua cobertura.

### Testes de Trading Insights

```sh
node tests/insights.cjs
# Alternativa com Chromium fornecido pelo ambiente:
BROWSER_EXECUTABLE_PATH=/caminho/para/chromium node tests/insights.cjs
```

A suíte verifica dados legados/ausentes, score independente do P&L, cobertura, regras, limites com ativos ocultos, R parcial/zero, janelas equivalentes e ano bissexto, limites de observações e ações, evolução de disciplina e erros, conservação das fórmulas financeiras, retorno percentual, edição/persistência, navegação por teclado, regras sem reescrita do histórico, restauração de backup, importação repetida e responsividade em cinco larguras. Usa apenas fixtures isoladas no navegador de teste, sem gravar resultados fictícios na conta do usuário.

## Calendário de Compartilhamento

A nova aba é independente do calendário original e tem seu próprio mês/ano. Mostra o mês completo do histórico, sem herdar filtros globais, e usa a mesma data de fechamento sem conversão adicional de fuso. Não altera operações, saldo, regras ou o estado do calendário original.

Cada operação contribui com `P&L líquido / risco planejado informado`. O resultado diário soma os múltiplos individuais; o profit factor divide a soma dos R positivos pela soma absoluta dos R negativos. Win rate, média e resultado mensal também são calculados em R. Não se utiliza risco fixo nem se deduzem custos novamente.

Se qualquer operação do dia não tiver P&L numérico válido ou risco positivo registrado, o dia mostra **R indisponível**, e as métricas mensais que exigem cobertura completa também ficam indisponíveis. Quantidade de operações e dias classificáveis continuam visíveis; dias incompletos não são classificados como breakeven. Um mês vazio não é apresentado como resultado financeiro zero. Resultados estimados na origem são identificados na imagem.

Escolha tema claro/escuro, formato Post 1:1 ou Story 9:16, visibilidade de win rate, contagem de operações e profit factor, identificação pública opcional e marca da plataforma. As preferências ficam na sessão. O botão **Compartilhar Calendário** oferece PNG de 1080×1080 / 1080×1920, alta resolução de 2160×2160 / 2160×3840 e cópia de imagem quando a API do navegador permitir. Negação de permissão para copiar mantém o download como alternativa. Nada é publicado automaticamente.

A renderização usa Canvas nativo e uma projeção explícita com mês, dias, resultados agregados em R e contagens. Dados brutos dos trades, moedas, saldo, capital, notas, prints, nomes de ativos, IDs de conta/corretora e percentuais de rentabilidade não são enviados ao renderizador nem inseridos no PNG. O nome/@ digitado voluntariamente é público na imagem. O percentual opcional de win rate mede apenas a proporção de trades vencedores.

```sh
BROWSER_EXECUTABLE_PATH=/caminho/para/chromium node tests/sharing.cjs
```

A suíte verifica cálculos, cobertura incompleta, projeção de privacidade, conteúdo desenhado, PNG sem metadados de texto/EXIF, dimensões, downloads reais, personalizações, calendário independente, atualização por histórico, cópia com permissão negada, meses com seis semanas e responsividade em cinco larguras. Os dados sintéticos permanecem isolados no navegador de teste.

## Cadastro por print do TradingView

Em **+ Novo trade → Ler print**, escolha uma imagem PNG/JPEG/WebP de até 20 MB, arraste-a para a área ou cole-a com Ctrl/Cmd+V. A leitura é feita localmente com Tesseract.js 7, WASM e modelos inglês/português fornecidos em `vendor/ocr`. Nenhuma imagem é enviada para serviços externos. O print permanece anexado ao registro, sujeito ao limite de armazenamento do navegador.

**Na versão modular `YourFXjourney.html`, sirva o projeto por HTTP/HTTPS e mantenha `vendor` ao lado do HTML. Na versão `YourFXjourney-standalone.html`, o OCR está embutido e funciona também por arquivo local, sem servidor.** O restante da aplicação mantém o funcionamento anterior. Exemplo:

```sh
python3 -m http.server 8088 --bind 127.0.0.1
# Abra http://127.0.0.1:8088/YourFXjourney.html no seu navegador.
```

O reconhecimento é assistido e conservador: extrai ativo, preços de entrada/stop/alvo, quantidade, risco monetário e horários **quando há rótulos legíveis**. Calcula lado e R:R planejado a partir dos três níveis consistentes. Não interpreta números soltos do eixo de preços como entrada/saída; nem confunde a distância de stop, “Amount”, lucro aberto ou alvo com risco monetário/resultado realizado. Horários aceitos pelo extrator são rotulados e explícitos no formato ISO, sem conversão de fuso. Vários ativos ou valores conflitantes ficam para revisão.

Após a leitura, confira o resumo e marque a confirmação. Campos já preenchidos são preservados; os detalhes técnicos permitem corrigir a leitura. O estado emocional fica acessível separadamente. Stop, alvo e `plannedRR` são campos novos e independentes do R efetivamente realizado e do payoff do Dashboard. Os registros antigos continuam compatíveis.

Um print não revela necessariamente preço de entrada, risco em moeda, horário de fechamento ou lucro líquido. Não é possível garantir cadastro completo a partir de qualquer tela do TradingView. **Após o exemplo fornecido pelo usuário, o leitor passou a detectar rótulos coloridos da ferramenta de posição. Os testes usam imagens sintéticas com o mesmo tipo de marcação e os mesmos preços do exemplo; as leituras devem ser conferidas com o print.** Para telas com números sem rótulos ou ferramenta de posição não selecionada, confirme/corrija os campos ausentes; nenhum resultado é inventado.

**Salvar planejamento** grava em `S.tradeDrafts`, mantendo a imagem, níveis, informações comportamentais e dados reconhecidos fora das estatísticas financeiras. Os planejamentos aparecem em **Trades → Planejamentos por print**. Use **Revisar / concluir** para adicionar fechamento e P&L realizado; a conclusão move o registro uma única vez para `S.trades`. No fluxo por print, não se estima lucro automaticamente a partir de preço/quantidade. Backups JSON existentes incluem os planejamentos e campos novos.

```sh
# Com o servidor acima ativo:
BROWSER_EXECUTABLE_PATH=/caminho/para/chromium node tests/screenshot.cjs
```

O teste executa OCR real com os modelos locais, verifica rótulos e ambiguidades, preenchimento, confirmação, separação entre planejado/realizado, preservação do print e emoção, persistência, conclusão sem duplicar, ausência de requisições a terceiros e layout móvel. Os testes anteriores continuam usando seus contextos isolados.

## Calendário ampliado e visibilidade monetária

O Calendário de Compartilhamento agora usa uma grade HTML ampla, com células maiores, fundos/bordas verdes para dias positivos e vermelhos para negativos. Em telas pequenas, a rolagem fica dentro da grade. A prévia da imagem fica em uma área expansível; os PNGs também reservam mais espaço para o calendário e usam os mesmos indicadores de cor.

Clique em um dia com operações para conferir os R individuais, sem exibir valores monetários. Exemplo: +3R e −2R resultam em +1R no dia. Continua sendo resultado realizado / risco monetário inicial de **cada** trade, sem usar payoff médio ou R:R do alvo como substituto. Se falta risco registrado, mantém “R indisponível”; os dados não são inventados.

No Dashboard, **Ocultar valores / Mostrar valores** controla os valores monetários dos cards principais e secundários, calendário, eixos e tooltips do gráfico. O campo de configuração do saldo não é renderizado enquanto os valores estão ocultos. Percentuais, contagens e múltiplos R permanecem disponíveis. A preferência é persistida separadamente no localStorage (`yfx-hide-money`), sem modificar dados financeiros. É uma preferência de exibição do Dashboard; a edição explícita de trades e as outras páginas continuam funcionando normalmente.

```sh
BROWSER_EXECUTABLE_PATH=/caminho/para/chromium node tests/privacy-calendar.cjs
```

Essa verificação cobre mostrar/ocultar, persistência após recarregar, tooltips, preservação dos dados, dimensões da grade, sinais por trade/dia e ausência de overflow na página em telas pequenas.

## Correção: abrir o print no HTML baixado

Para usar diretamente como arquivo, abra **YourFXjourney-standalone.html**. Essa distribuição contém biblioteca, worker, núcleo WASM e idiomas embutidos; não depende de CDN, rede ou pasta `vendor`. Para reconstruí-la após editar o projeto, execute `python scripts/build_standalone.py`.

O print agora é decodificado, exibido e anexado **antes** do carregamento do OCR. Se o leitor falhar, a imagem permanece disponível para salvar o planejamento. O decodificador usa `Image`, com compatibilidade mais ampla que a dependência anterior de `createImageBitmap`.

A leitura da ferramenta de posição procura um rótulo vermelho, um verde e uma entrada cinza entre eles, com regiões de risco/retorno coloridas no gráfico. Faz OCR separado dos preços e verifica geometria, precisão decimal consistente e resultados ambíguos. O preço atual em preto é ignorado. No exemplo CADJPY, os níveis são stop 112.424, entrada 112.315 e alvo 111.978, correspondendo a venda e R:R planejado ~3.09:1. Essa informação não fornece risco em moeda nem comprova fechamento.

`tests/shot-opening.cjs` verifica o HTML embutido aberto por `file://`, exibição imediata, OCR real dos rótulos coloridos em uma fixture baseada nos níveis do exemplo, rejeição do preço atual como entrada e ausência de requisições HTTP. O arquivo de imagem original mostrado na conversa não foi disponibilizado como arquivo de teste local; a validação automatizada desse layout usa uma reprodução sintética, sem dispensar a conferência dos dados reconhecidos.

Antes de mudar o nome/caminho do HTML ou de navegador, exporte o backup na versão anterior e restaure-o na nova. O localStorage de arquivos locais pode depender do caminho.

## R no calendário sem risco monetário preenchido

O calendário compartilhável agora resolve o R de cada operação nesta ordem:

1. P&L líquido / risco monetário planejado, quando ambos estão registrados.
2. Campo **R líquido realizado**, informado explicitamente pelo trader.
3. Movimento entre entrada e **saída real**, dividido pela distância entre entrada e stop inicial, respeitando compra/venda e a posição válida do stop.

O terceiro método é identificado como **R por preço, sem ajuste de custos** na tela e na imagem exportada. Quando houver esse método, o total é rotulado **Resultado em R***, em vez de resultado líquido. Não se presume valor de pip, tamanho de posição, risco fixo, fechamento no alvo ou que uma perda foi de −1R.

O detalhe de cada dia apresenta a fonte ou informa exatamente quais campos estão faltando. Use **Salvar R** para registrar diretamente o R líquido realizado, ou **Preencher dados do trade** para revisar entrada, stop e saída. Esse registro persiste no backup sem alterar o P&L em dinheiro. O campo também está no editor do trade.

Dias incompletos permanecem indisponíveis até existir informação suficiente para todos os trades. Apenas o alvo ou R:R planejado não comprova resultado realizado. Os cálculos monetários e a fórmula original das métricas R do Dashboard/Insights não foram alterados por essa extensão do calendário; essas métricas continuam identificando sua cobertura por risco monetário informado.

```sh
BROWSER_EXECUTABLE_PATH=/caminho/para/chromium node tests/share-r-sources.cjs
```

Verifica compras/vendas, resultados positivos/negativos/zero, prioridade do resultado líquido, R registrado, valores numéricos legados em texto, stop inválido, alvo sem saída, somas diárias/mensais, persistência do novo campo e identificação de R por preços no PNG.

## Limpar histórico

Em **Trades → Limpar histórico**, a confirmação informa o total de operações que serão removidas, incluindo as ocultas pelos filtros. É possível exportar um backup dentro da confirmação antes de escolher **Confirmar limpeza**, ou cancelar sem alterações.

A limpeza remove todos os trades fechados (importados e manuais), com suas notas e prints vinculados. Mantém planejamentos, estratégias, revisões e configurações da conta. Não há desfazer sem backup. O botão fica desativado quando o histórico está vazio. A gravação no localStorage é feita antes de atualizar o estado em memória: se falhar, os registros são preservados e a confirmação mostra o erro. Depois da limpeza, um CSV anterior pode ser importado novamente, pois a deduplicação usa as operações presentes no histórico.

`tests/clear-history.cjs` cobre confirmação com filtros ativos, cancelamento, backup antes da exclusão, falha de armazenamento, persistência após recarregar, preservação dos outros dados e reimportação.
