# Trade Assistant · YourFXjourney

Upgrade do projeto existente para um espaço pessoal de preparação, análise e revisão de trading. Vanilla HTML/CSS/JavaScript no navegador, com backend opcional Node.js sem dependências de produção. As operações, imports, screenshots, cálculos e a chave `yfx1` do localStorage foram preservados.

## Começar no Windows — IA e eventos

1. Baixe o ZIP no GitHub e **extraia toda a pasta**. Não execute de dentro do ZIP.
2. Se já usa uma versão anterior, exporte antes seu backup em **Trades → Exportar backup**.
3. Dê dois cliques em **INICIAR-TRADE-ASSISTANT.bat**. Se faltar Node.js, o iniciador oferece abrir o site oficial; instale o **Node.js LTS 22.17+** e abra o iniciador novamente.
4. Na janela guiada, crie sua senha pessoal (12 caracteres ou mais). Informe as chaves dos serviços desejados; Enter permite pular os serviços opcionais. A digitação das credenciais fica oculta.
5. O navegador abre o aplicativo. Em **Configurações**, entre com a senha criada. Restaure o backup antigo, pois o HTML e o aplicativo conectado têm armazenamentos separados.
6. Mantenha a janela do iniciador aberta. Para trocar ou adicionar chaves depois, feche o iniciador e abra **CONFIGURAR-TRADE-ASSISTANT.bat**.

O servidor roda **no próprio computador**; não exige contratar hospedagem. A chave **OpenAI API** é separada da assinatura do ChatGPT. Eventos usam **Financial Modeling Prep** e condições de mercado usam **Twelve Data**, com acesso às respectivas APIs. Esses serviços podem exigir contratação própria. Chave configurada não significa consulta validada: erros de credencial, cota ou acesso aparecem na consulta.

No macOS, use **INICIAR-TRADE-ASSISTANT.command** (se necessário, permita execução pelo Terminal com `chmod +x INICIAR-TRADE-ASSISTANT.command`). Pelo terminal, `node scripts/setup-local.cjs --configure` configura novamente.

Para usar somente diário, plano e análises locais, abra **YourFXjourney-standalone.html** no Chrome ou Edge. Esse arquivo sozinho não conecta IA nem notícias. Salvar o Trading Plan alimenta o foco e a revisão dos setups, mas não ativa os provedores.

**Antes de mudar de arquivo, origem ou navegador:** exporte e restaure um backup. O navegador pode manter armazenamentos separados para caminhos diferentes. O projeto não envia seu histórico ao GitHub.

## O que funciona offline

- Home com saudação no seu fuso, sessão configurável, contagem regressiva, recomendações locais apoiadas nos registros e resumo semanal com cobertura de R.
- Sessões de Londres, Nova York, Ásia ou personalizadas, dias selecionáveis, horários noturnos e ajustes de horário de verão por fuso IANA.
- Trading Plan com textos próprios, instrumentos, timeframes, limites, notícias e critérios explícitos ponderados. Cada salvamento cria uma versão; análises anteriores mantêm a cópia exata do plano utilizado.
- Trade Analyst com screenshot, contexto e **revisão manual claramente identificada**, score determinístico, evidências e correções auditáveis. O modo manual não interpreta a imagem por IA.
- Todos os recursos anteriores: Dashboard estatístico, trades, CSV, prints, notas, análises, risco, estratégias, padrões, revisões, Trading Insights e calendário compartilhável.

Dados de mercado, calendário econômico e análise por IA exibem estados de indisponibilidade quando não há servidor/configuração. Nenhum evento, volatilidade, preço ou padrão visual é inventado para preencher a interface.

## Servidor autenticado e IA

Requer Node.js **22.17+** ou **24+**. Na pasta extraída:

1. Copie `.env.example` para `.env`.
2. Defina `TRADE_ASSISTANT_PASSWORD` com ao menos 12 caracteres.
3. Configure somente os provedores que deseja usar:
   - `TRADE_AI_KEY`: OpenAI Responses API multimodal. Modelo padrão `gpt-4.1-mini`.
   - `TRADE_ECONOMIC_KEY`: Financial Modeling Prep, acesso a `stable/economic-calendar`.
   - `TRADE_MARKET_KEY`: Twelve Data, acesso a `time_series`.
4. Execute `npm start` ou `node --env-file-if-exists=.env server/index.cjs`.
5. Abra a aplicação pela origem do servidor e entre em **Configurações → Conectar ao servidor**.

Nenhuma instalação npm é necessária para executar o servidor. As chaves ficam **somente no servidor**. O `.env` é ignorado pelo Git e não pode ser servido pela aplicação. Não cole chaves em chat, screenshots, HTML ou localStorage. Veja [server/SETUP.md](server/SETUP.md) para endpoints, produção HTTPS, provedores e método de volatilidade.

O servidor é **pessoal, de proprietário único por instância**. Não implementa contas SaaS multiusuário, banco compartilhado ou sincronização de histórico. Cada navegador mantém seus próprios dados. A senha protege os serviços online; cookies HttpOnly/SameSite, CSRF, validação de origem, limites e HTTPS para origens públicas protegem as chamadas. A conexão é lembrada neste navegador por até 30 dias com cookie assinado HttpOnly, inclusive após reinícios. A senha não é salva no navegador. Trocar a senha, a origem ou `TRADE_SESSION_SECRET` invalida os cookies anteriores. “Sair do servidor” apaga o cookie e bloqueia sua reutilização na instância atual; a lista de revogações é local à instância e não sobrevive a reinícios. O prazo do cookie é absoluto, sem renovação silenciosa.

**Estado de validação:** não havia chaves reais configuradas no ambiente de desenvolvimento. O servidor, autenticação, fluxo da interface e chamadas estruturadas foram verificados com provedores simulados e indisponibilidade real; as APIs faturadas e seus direitos de acesso ainda precisam ser verificados com credenciais válidas. A funcionalidade não é anunciada como IA ou mercado ao vivo operacional antes dessa configuração.

## Home e calendário econômico

Configure nome, fuso, instrumentos e sessão em **Configurações**. Não existe nome ou sessão pessoal presumida na primeira abertura. A Home prioriza rotina, contexto, eventos, um foco e ações rápidas; estatísticas completas continuam em **Painel**.

Notícias trazem horário convertido, moeda, impacto, anterior, previsão e realizado quando disponíveis. Eventos relevantes dentro da sessão e sua janela de cautela são destacados. Datas locais consultam também os dias UTC adjacentes, evitando perder eventos próximos da meia-noite. A fonte e a hora da consulta são informadas; caches não são exibidos como atualização em tempo real contínua.

Volatilidade usa dados reais quando conectada e cálculo ATR documentado: média de 14 true ranges horários / último fechamento. Limiares gerais não constituem previsão nem substituem critérios específicos do plano. Respostas inválidas ou atrasadas são identificadas.

O insight local da Home é determinístico e identificado como registro observado ou sugestão baseada no plano. Padrões exigem amostra/cobertura; sem dados suficientes, a orientação é neutra. Isso não é apresentado como texto gerado por IA. Com conexão autenticada e chave, **Gerar insight com IA** envia somente o plano/perfil e fatos agregados calculados por código. O modelo escolhe IDs desses fatos e uma ação curta; o servidor reconstrói os textos estatísticos originais e rejeita IDs desconhecidos e números/percentuais inventados na ação. Essa chamada não contém histórico bruto nem evidências de mercado ao vivo; a IA é instruída a não inferir condições atuais a partir dela. A consulta é iniciada pelo usuário, com cache e deduplicação.

## Trading Plan e Trade Analyst

Registre as definições da sua estratégia, sem depender de conceitos genéricos de ICT/SMC. Critérios possuem definição, peso, obrigatoriedade, criticidade, tipo e função (confirmação ou invalidação).

- **Score:** peso satisfeito / peso total ×100; o denominador inclui critérios não verificáveis e sua cobertura fica visível.
- Critério obrigatório/crítico ausente ou falho impede conformidade completa. Invalidação presente bloqueia independentemente da nota.
- R:R mínimo, risco máximo por trade, sessão e notícias usam regras determinísticas/contexto estruturado. A IA não escolhe a porcentagem. Limites diário/semanal ficam documentados no plano; o sistema não presume que correspondam a soma de risco, drawdown ou perda líquida e não executa bloqueio de ordens.
- Screenshots e definições são enviados ao provedor apenas ao clicar **Analisar com IA**. Sem credenciais, é possível usar **Revisar manualmente**. Dados e critérios sem evidência são “Não verificável”.
- Critérios numéricos exigem dados na unidade do plano. Sugestões visuais não substituem o R:R explicitamente informado; divergências ficam para revisão.
- Cada análise conserva plano, contexto, perfil e imagem exatos enviados, inclusive se a pessoa mudar o plano durante a requisição.
- Correções de avaliações visuais guardam status anterior, evidência e data, sem apagar a resposta original e sem alegar retreinamento automático. Critérios automáticos exigem corrigir os dados estruturados e reavaliar.
- Sessão e janela de notícias da análise online são verificadas pelo servidor; calendário inválido ou indisponível mantém a restrição “Não verificável”. Não há execução de trades.

O provedor só avalia evidência visível; OHLC não é usado para comprovar BOS, liquidez ou Order Blocks nesta versão. Os módulos separados permitem um adaptador OHLC posterior sem substituir o histórico ou a fórmula do score.

## Diário, importação e cálculos preservados

O histórico usa P&L monetário registrado, não recalculado pela IA. Strategy Tester e histórico pareado Tickmill reutilizam o importador existente; histórico de ordens Paper/Broker continua identificado como estimado. MT5 aceita relatório HTML (.htm/.html, inclusive UTF-16) e CSV da tabela de posições fechadas: horários de abertura/fechamento, ticket, ativo, lado e lucro. Usa o lucro mais comissão/swap/taxas separados, ou o resultado explicitamente líquido, sem recalcular dinheiro por tamanho de lote. Ordens, negócios isolados e posições abertas não são inferidos como operações completas. Duplicatas preservam notas e prints. O S/L importado exige confirmação de stop inicial antes de entrar no cálculo de R. XLSX deve ser convertido para CSV. Datas de trades preservam a convenção de fechamento armazenada, sem nova conversão automática de fuso. Os fusos configurados aplicam-se às sessões, notícias e saudação.

- Campos opcionais de risco/stop/R realizado são aproveitados quando explicitamente disponíveis. Reimportar completa metadados ausentes sem duplicar trades nem alterar notas, IDs ou P&L.
- **Limpar histórico** exige confirmação e permite backup; mantém planejamentos, estratégias, revisões e configurações. Falhas de gravação preservam dados.
- **Ocultar valores** no Painel mascara dinheiro, eixos e tooltips e persiste a preferência, sem alterar cálculos.
- Saldo inicial legado de 10.000 exige confirmação; saldo calculado não é equity com posições abertas nem considera depósitos/saques não registrados.
- Payoff = ganho médio / perda média. R realizado, R:R planejado e payoff não são intercambiáveis.
- Breakeven financeiro conserva zero exato; a faixa operacional de Insights é mostrada separadamente e não reescreve P&L.

### Prints e planejamento

Novo trade aceita upload, arrastar ou colar PNG/JPEG/WebP. O print aparece antes do OCR, inclusive se o leitor falhar. A versão standalone contém Tesseract.js/WASM/idiomas locais. Rótulos claros e a ferramenta de posição colorida podem sugerir ativo, entrada, stop, alvo, lado e R:R planejado; o preço atual não é tratado como entrada. Leituras ambíguas exigem revisão. Testes de OCR usam fixtures sintéticas, não garantem acerto em qualquer layout do TradingView.

Salvar planejamento mantém o registro em `S.tradeDrafts`, fora das estatísticas. A conclusão requer fechamento e P&L realizado; o print de um alvo não comprova que ele foi atingido. Estado emocional e critérios comportamentais são opcionais.

### Trading Insights

Abas diária/semanal/mensal usam registros reais. Disciplina não depende de lucro, win rate ou resultado: considera critérios explícitos com pesos iguais nos trades avaliáveis, exigindo cobertura mínima de 60%. Comparações exigem amostras equivalentes; ausência de registro não vira resposta positiva. Campos opcionais distinguem nenhum erro de não avaliado. Regras são configuráveis e ficam em `S.insightRules`.

### Calendário compartilhável

Mês próprio, grade ampla, detalhes R por trade, PNG quadrado/Story de 1080 ou 2160 px, temas e elementos opcionais. Exportação Canvas usa somente uma projeção de métricas/contagens/período, sem dinheiro, saldo, notas, IDs ou screenshots. O nome/@ digitado é público.

R usa P&L líquido / risco inicial, R líquido explicitamente informado ou, quando disponível, entrada/stop/saída real. O último caso é **R por preço sem ajuste de custos**, identificado também na imagem. Não se usa alvo como resultado.

**Configurar cálculo de R** permite completar risco inicial comum somente após confirmação explícita do valor real, ou registrar vários R individuais. Não há risco padrão presumido. Win rate e direção dos dias podem usar P&L conhecido mesmo quando falta risco. Totais/PF em R exigem cobertura completa, e dias incompletos não viram breakeven.

## Arquitetura e construção

- `YourFXjourney.html`: store/rotas/recursos originais, com chave `yfx1` preservada.
- `public/assistant.js`, `assistant.css`: workspace, perfil, planos, analista e conexão.
- `public/daily-workspace.js`: briefing local, Home e calendário econômico.
- `public/plan-engine.js`: validação, score e correções, compartilhado com servidor.
- `public/session-engine.js`: sessões e horário de verão via Intl/IANA.
- `server/`: autenticação, provedores, esquema multimodal, cache e endpoints.
- `scripts/build_standalone.py`: embute OCR, CSS e módulos no HTML offline.

```sh
python3 scripts/build_standalone.py
```

Mudanças no código modular devem ser seguidas desse build antes de distribuir `YourFXjourney-standalone.html`. O backend não é embutido nem recebe segredos do build. O OCR tem suas licenças e checksums em `vendor/ocr`.

## Verificação

```sh
npm test
# Testes de navegador requerem Playwright e Chromium no ambiente de desenvolvimento:
BROWSER_EXECUTABLE_PATH=/caminho/para/chromium node tests/assistant-ui.cjs
BROWSER_EXECUTABLE_PATH=/caminho/para/chromium node tests/assistant-server.cjs
BROWSER_EXECUTABLE_PATH=/caminho/para/chromium node tests/dashboard.cjs
BROWSER_EXECUTABLE_PATH=/caminho/para/chromium node tests/insights.cjs
BROWSER_EXECUTABLE_PATH=/caminho/para/chromium node tests/sharing.cjs
# OCR modular requer servidor estático em 127.0.0.1:8088:
BROWSER_EXECUTABLE_PATH=/caminho/para/chromium node tests/screenshot.cjs
# OCR standalone:
BROWSER_EXECUTABLE_PATH=/caminho/para/chromium node tests/shot-opening.cjs
```

Não há dependências de produção para instalar. Playwright é somente uma ferramenta de desenvolvimento e não faz parte do HTML entregue. As suítes usam contextos isolados; dados sintéticos e eventos simulados não entram na conta real. Os testes cobrem score, invalidações, correções, DST, overnight/weekend, autenticação/CSRF/HTTPS, schemas, cache, indisponibilidade, integração da interface, preservação de dados legados e layout de 320 a 1440px. Veja `tests/` para regressões de risco, importação e limpeza.

## Calendário semanal sem chave (Forex Factory)

Para ativar, adicione ao `.env` a linha `TRADE_ECONOMIC_PROVIDER=forexfactory`.
Ela seleciona o feed mesmo se houver uma chave FMP antiga. Pare o servidor com
Ctrl+C, execute `npm start` novamente, abra uma nova aba e **digite**
`http://127.0.0.1:8080` na barra de endereço. Entre em Configurações e atualize
 o briefing. Não abra pelo HTML nem por link de outro site.

Fonte: https://nfs.faireconomy.media/ff_calendar_thisweek.json . O servidor
consulta o feed com cache compartilhado de 30 minutos, inclusive entre filtros,
para reduzir requisições. Apenas a semana publicada está disponível; consultas
fora dos dias cobertos não significam ausência de notícias. O campo realizado
fica indisponível. Esse feed limitado nunca libera automaticamente uma restrição
de notícias do Trading Plan. A disponibilidade externa e as condições de
reutilização não são garantidas; confira a fonte antes de redistribuir dados.
Para retornar à FMP, use `TRADE_ECONOMIC_PROVIDER=fmp` e uma chave com acesso.

## ShowMyTrades (calendário público)

No Render → Environment, altere `TRADE_ECONOMIC_PROVIDER` para `showmytrades`
e salve com deploy. Não exige chave nesta integração. Endpoint fixo:
https://showmytrades.com/api/public/calendar/v1 . O adaptador foi construído
contra o exemplo de resposta fornecido pelo usuário; a disponibilidade externa
no Render precisa ser confirmada depois do deploy. Documentação indicada na
resposta: https://showmytrades.com/docs/api/economic-calendar . Não há garantia
contratual de gratuidade ou disponibilidade nesta integração.

O servidor compartilha cache de 5 minutos entre filtros e respeita Retry-After
em respostas 429. Usa `time` ISO com fuso (não `ts`), preserva campos de valores
quando presentes, converte campos vazios em indisponível, remove duplicatas e
informa o intervalo `from`/`to` e a geração da fonte. Não assume histórico completo
nem ausência de notícias fora da cobertura; não libera automaticamente regras
operacionais de notícias. A classificação de impacto é a informada pela fonte.

## Interface terminal

A identidade visual usa preto e superfícies em camadas, valores financeiros
verdes/vermelhos, navegação compacta recolhível, barra superior contextual e
ícones SVG originais. A apresentação foi atualizada nas 15 rotas, formulários,
modais, tooltips e calendários, incluindo o PNG de compartilhamento em tema escuro.
Não há dependência de TradingView nem de Massive: são referências visuais,
não novos provedores de dados, logos ou bibliotecas proprietárias.

Os tokens ficam em `public/terminal.css`; componentes e interações em
`public/terminal.js`. Os componentes são carregados após os módulos existentes e
antes do primeiro render. A arquitetura HTML/JS e o armazenamento `yfx1` foram
mantidos. A preferência da navegação usa sua própria chave, sem migrar trades.

O Dashboard inclui gráfico de performance, drawdown, distribuição por ativo e
sessão, tabela de operações recentes e calendário. Séries existentes continuam
vindo de `chartData`, `st` e `grp`; zoom e navegação alteram somente a janela do
gráfico. Controles de período continuam filtrando as métricas e calendários.
O cursor/teclado/toque mostra os valores registrados. Escalas ficam à direita;
zoom, navegação e reset são locais a cada gráfico. Arrastar permite navegar
quando o gráfico está ampliado. Rótulos de séries sem datas usam o número do
trade, nunca uma data inventada. O histórico possui ordenação por coluna sem
alterar a ordem armazenada. Ocultar dinheiro também protege os painéis novos.

Verificação: `npm test` para cálculos e backend; `npm run test:ui` para o terminal
com Playwright disponível no ambiente de desenvolvimento. Opcionalmente defina
`BROWSER_EXECUTABLE_PATH` para seu Chromium. O teste usa servidor local temporário,
browser isolado e dados de teste que nunca são gravados no site de produção.
`python3 scripts/build_standalone.py` mantém os novos módulos no HTML independente.

### Preparação pessoal na Home

A sessão inclui perfil e autenticação do servidor (não login de corretora),
fechamentos registrados na data atual, cobertura das avaliações dentro do plano,
critérios obrigatórios do plano e foco determinístico com base nos registros.
Eventos são resumidos somente quando a consulta está disponível. Não há inferência
de emoções, saldo ou posições abertas. O briefing com IA continua separado,
rotulado e acionado pelo usuário. Volatilidade baixa é vermelha, moderada âmbar e
alta verde; as cores descrevem intensidade, sem indicar direção ou entrada.

O gráfico ambiente é SVG abstrato, sem preços, rótulos nem conexão de mercado.
É decorativo, ignorado por leitores de tela e sem captura de cliques. A animação
respeita movimento reduzido. `node tests/home-preparation.cjs` verifica resumo,
cores, dados ausentes, segurança de texto e responsividade com dados isolados.

### Identidade EliteX

A marca visível usa EliteX, com esmeralda, vermelho rosado e grafite metálico
inspirados no logo fornecido pelo usuário. O símbolo em `public/elitex-mark.png`
é uma adaptação com fundo transparente preparada a partir da referência; o
arquivo original gerado foi preservado no ambiente. O símbolo aparece na
navegação e na exportação compartilhável quando a marca está ativada. A versão
standalone incorpora o PNG. Os candles decorativos distinguem alta e baixa
por cor com opacidade reduzida. A marca não altera a chave `yfx1`, backups,
nomes de variáveis de integração ou histórico de trades.

### Escolha rápida de ativos e radar diário

O catálogo pesquisável de Forex, metais e cripto permite selecionar até cinco
instrumentos sem digitar símbolos. A seleção está em Configurações e no botão
Editar ativos do Radar na Home. Esse limite corresponde à consulta de mercado
existente. Também há entrada opcional de símbolo personalizado; disponibilidade
e cotas dependem do provedor, não do catálogo. A seleção só persiste ao salvar;
cancelar preserva a lista anterior e os trades. Valores equivalentes como
EUR/USD são normalizados para EURUSD ao salvar, sem modificar operações.

O Radar reutiliza o plano, a autenticação e o estado do calendário, com atalhos
funcionais e o último fechamento registrado. Sem histórico, oferece restauração
de backup. Não cria saldo, posições abertas ou inferências comportamentais.
Textos secundários foram ampliados e os efeitos de blur do conteúdo removidos.
O teste `node tests/asset-picker.cjs` usa navegador isolado, valida cancelamento,
busca, teclado, limite, persistência, símbolo personalizado e preservação do
histórico, com captura real de 3840×2160 pixels e layouts de 320 a 1920 CSS pixels.

### Refinamento das interações

Os módulos `public/premium.js` e `public/premium.css` aprimoram o terminal sem
modificar a composição ou os cálculos. Ctrl + roda do mouse amplia o gráfico
normal; na visualização ampliada, a roda também funciona sem Ctrl. A rolagem
comum da página é preservada. Arrastar um gráfico com zoom desloca a janela;
Tudo restaura o recorte completo. A ampliação usa os mesmos dados, com janela
independente, fecha com Escape e mantém o foco de teclado. Zoom e pan não
reinicializam a aplicação nem fazem chamadas aos provedores.

As métricas principais abrem uma inspeção sob demanda com os trades filtrados
(até 100 registros exibidos) e atalho ao histórico. Valores ocultos continuam
ocultos na inspeção. Os tooltips do calendário em R usam somente o texto da
projeção pública, sem valores monetários. A seleção do dia recebe feedback e
meses/abas têm transições curtas. O indicador lateral acompanha a navegação.

Iluminação pelo cursor e magnetismo leve são limitados a painéis e ações
selecionados, executados somente por eventos e requestAnimationFrame. Movimentos
reduzidos desativam esses efeitos. Números são sempre os valores finais calculados:
a atualização usa fade, não contagem intermediária de resultados financeiros.
Textos e dados não recebem blur persistente. Carregamento mostra estado real,
sem estatísticas ou gráficos de demonstração.

`node tests/premium-ui.cjs` verifica roda, arraste, tooltips, ampliação, resize,
Escape, inspeção, privacidade e movimento reduzido usando servidor local e
registros de teste isolados. Os testes não dependem de credenciais reais.

### Moeda da conta e risco simplificado

O seletor no topo oferece GBP, EUR, USD e BRL. Usa a moeda global `S.currency`,
incluída no backup existente, para formatar P&L, saldo, risco monetário,
expectancy, tabelas e gráficos. A troca define a denominação dos registros:
**não consulta câmbio, não converte nem modifica os valores dos trades**.
Preços dos instrumentos, percentuais, contagens e R continuam em suas unidades.
O calendário compartilhável permanece exclusivamente em R, sem dinheiro.

A aba Risco agora prioriza um cálculo opcional de saldo × percentual, três
indicadores observados e atalhos para completar riscos ausentes. O saldo só é
preenchido com saldo inicial confirmado + P&L fechado completo; sem essa base,
fica vazio. O usuário pode usar outra referência sem mudar a conta. Percentual
não é presumido; os botões são escolhas explícitas de planejamento. Nenhum
cálculo do planejador salva risco em trades ou modifica limites do plano.
Os indicadores do histórico respeitam os filtros e reutilizam o drawdown atual.

`node tests/currency-risk.cjs` verifica moedas, persistência, falha de armazenamento,
privacidade, cálculo de planejamento, cobertura e preservação dos dados,
responsividade e o módulo incorporado na versão standalone.

### Assistente visual na Home
A evolução usa um personagem SVG 2D original, articulado em cabeça, olhos, tronco e braços. Os estados working/attention/thinking/responding/return são controlados por interação e requisição real. Movimento reduzido desliga animações. Não é um modelo 3D nem um humano fotorealista: para atingir a referência fotográfica, ainda são necessários assets profissionais articulados ou GLB com rig, expressões e clipes de digitação/atenção. Nenhum processamento de mercado ocorre apenas por causa da animação decorativa.

A conversa desta visita fica somente em memória (até vinte mensagens), sem alterar o histórico de operações. Usa a API de briefing existente, agora com pergunta opcional limitada a 1500 caracteres, CSRF e os mesmos limites de IA. O envio inclui pergunta, plano e fatos agregados; não envia prints nem todo o diário. As respostas são orientações curtas e seleção de fatos fornecidos, não um chat geral ou previsão de preço. Análise de prints continua no Trade Analyst. Sem credenciais ou autenticação, a interface informa indisponibilidade.
