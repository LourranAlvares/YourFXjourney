# SMC Elite: revisão, rotina emocional e reconhecimento

## Arquitetura e acesso

Implementação incremental sobre o aplicativo existente, sem framework novo e sem substituir o diário. `public/growth-engine.js` contém as regras e os modelos de leitura; `public/growth.js` integra persistência, telas e sessões; `public/growth-export.js` desenha as imagens/vídeos/certificados e gera PDF; `public/growth.css` contém estilos responsivos. Os arquivos são incorporados também pelo build standalone.

No Painel e no Diário: **Weekly Review**, **Monthly Review** e acesso a **Achievements**. No Diário, o painel expansível **Emotional Insights** reúne registros, indicadores e decisões. Em Configurações, **Rotina e Live Emotional Monitor** reutiliza a sessão existente. Uma única área nova de navegação: Achievements.

## Dados e persistência

Todos os novos dados vivem em `S.growth`, no mesmo workspace pessoal que operações e configurações. O aplicativo usa o `persistState` existente: armazenamento local no modo local, fila/versionamento da nuvem no modo autenticado. Não é necessário executar SQL adicional para estes módulos. Nenhum endpoint administrativo de leitura de diário, desempenho ou emoções foi criado.

Modelo v1:

- `monitor`: opt-in, modo manual/automático, frequência e orientações personalizadas.
- `activeRun` e `prompts`: confirmação da atividade e controle de convites, adiamento/dispensa. Um pequeno bloqueio local por conta evita convites simultâneos entre abas.
- `checkins`: UUID, instante UTC, data e fuso registrados, sessão, emoção, intensidade/observação/vínculo opcionais, decisão explícita de respeito ao plano.
- `decisions`: decisões documentadas de não operar, motivo e identificação/versão do plano quando existente.
- `reflections`: respostas e resultado opcional de IA por chave de semana/mês. Ignorar não cria uma conclusão.
- `rules`: critérios configuráveis de reconhecimento.
- `certificates`: emissão, fonte, período, nome opcional, regras/fuso usados e validade recalculável.
- `announced`: deduplicação de reconhecimento por regra/período.

Cada operação pode conter `growthFeatured` para destaque voluntário. Exclusões dos registros estão disponíveis no histórico. Os limites de tamanho, backup, isolamento entre usuários e conflitos continuam sendo os do workspace existente; falhas de gravação não são apresentadas como sincronização bem-sucedida.

## Métricas e datas

O adaptador reutiliza `insUniverse`, `st`, `realizedTradeR`, `insProcess` e `insPercent`. Não há outro cálculo concorrente de P&L, win rate, profit factor, drawdown, R ou aderência. R ausente permanece desconhecido; somas parciais informam a cobertura. R derivado de preço mantém o aviso sobre custos. Retorno percentual exige saldo inicial confirmado e base positiva, usando o histórico anterior ao período.

Datas operacionais das operações seguem a data de fechamento já registrada pelo aplicativo, sem reinterpretar histórico na troca de fuso. Sessões exibidas nas revisões são as mesmas faixas de horário da entrada usadas pelo Painel, identificadas como classificação, não prova de atividade. O monitor usa o `SessionEngine` existente, dias configurados, fuso IANA, DST e sessões que atravessam a meia-noite. Check-ins guardam sua data/fuso original. Semanas começam segunda-feira; meses são calendários; períodos atuais são identificados como parciais. Certificados financeiros exigem meses já encerrados.

## Monitor emocional

Desativado inicialmente. No modo manual, apenas estar no horário não gera perguntas: é necessário confirmar o início da atividade. O modo automático é uma escolha explícita. Os convites são discretos e não abrem modal automaticamente. Podem ser adiados 10 minutos, ignorados na sessão ou desativados. O clique na emoção salva imediatamente; editar o contexto atualiza o mesmo UUID.

O monitor funciona somente com o aplicativo aberto e visível. Não roda com o site fechado, não vigia outras abas e não envia notificações do sistema. Presets London/New York ajustam o nome/fuso; o usuário define seus horários. Uma emoção não é erro nem diagnóstico. Vínculos a operações são selecionados pelo usuário entre horários compatíveis. Frustração após perda indica apenas proximidade temporal, nunca causa. Comparações de aderência exigem pelo menos cinco operações associadas avaliadas; frequências semanais/mensais mostram cobertura e comparação com o período anterior.

## Smart Review

Sete cenas em canvas 1080 × 1920, navegação por controles nativos acessíveis, autoplay, pausa, replay, progresso, transições/contadores discretos e respeito a movimento reduzido. Períodos usam todo o histórico correspondente, independentemente dos filtros da página. Destaques usam operações/prints reais, quando existentes. Dados insuficientes aparecem explicitamente.

Privacidade inicia ocultando nome e dinheiro. Prints só podem ser incluídos se ambos estiverem visíveis, porque imagens podem conter informações que o sistema não consegue redigir automaticamente. A versão exportada não inclui notas emocionais privadas ou respostas de reflexão.

Exportações: PNG da cena atual/final; vídeo com `canvas.captureStream`/`MediaRecorder` apenas se gravação e reprodução do formato forem anunciadas pelo navegador. Preferência por MP4/H.264 explícito, depois WebM/VP9 ou VP8. Não há conversão de formato em servidor. A gravação é em tempo real, com progresso/cancelamento; ocultar a aba interrompe a gravação. Navegadores sem suporte mantêm PNG funcional, sem botão morto de vídeo. Compartilhamento nativo depende de `navigator.canShare`; download é alternativa.

Narração opcional somente quando o dispositivo disponibiliza uma voz local. O vídeo exportado é **sem narração**: a fala do sistema não é fingida como áudio capturado. Reprodução visual funciona sem voz.

Reflexão: três perguntas curtas, uma por etapa, respostas persistidas por período. A leitura local é identificada como **análise por regras**, com fatos reais e metas declaradas. Com a integração de IA autenticada existente disponível, o usuário pode solicitar explicitamente uma orientação via `/api/briefing`; nenhuma chave vai ao frontend. Há aviso do envio das respostas. Erros mantêm a reflexão local; orientações antigas são sinalizadas quando os dados mudam. Nenhuma análise de IA é simulada.

## Critérios de reconhecimento v1

Cada card expõe fonte, progresso, período e critérios. Alterações afetam o progresso atual; certificados guardam os parâmetros de emissão, incluindo regras de execução e fuso. Valores abaixo são os padrões iniciais configuráveis, salvo os dois critérios financeiros fixos.

| Conquista | Evidência necessária |
| --- | --- |
| Consistent Performer | Dois meses encerrados consecutivos, com operações e P&L líquido positivo, sem P&L estimado. |
| Quarterly Profitability | Três meses sob os mesmos critérios. Meses vazios interrompem a sequência. |
| Risk-Reward Excellence | 20 operações com R:R planejado registrado ≥ meta do plano/configuração, plano e risco explicitamente respeitados. Não depende de vitória. |
| Plan Commitment | 30 dias operados consecutivos em que todas as operações tenham plano explicitamente respeitado. |
| Discipline Master | Três meses encerrados consecutivos, aderência ≥90%, mínimo cinco operações/mês e avaliação do plano em todas. |
| Risk Guardian | 20 dias operados consecutivos com risco e limites explicitamente respeitados, sem violação de risco registrada. |
| Selective Trader | Cinco datas distintas com decisão documentada de descartar entrada fora do plano salvo. Ausência de trade não conta. |
| Journal Consistency | Dez dias operados consecutivos com motivo, estado emocional e aprendizado em todas as operações. Print é opcional. |
| Emotional Awareness | Dez sessões distintas com check-in; vários registros na mesma sessão contam uma vez. |
| Mindset Progress | Melhora de dez pontos percentuais na aderência entre duas semanas encerradas consecutivas, cada uma com cinco operações totalmente avaliadas e três sessões com check-in. Mede registros de execução, não saúde mental. |
| Self-Control Recognition | Três sessões distintas com emoção de atenção e decisão explícita de respeitar o plano. |
| Reflective Trader | Quatro semanas encerradas consecutivas com as três respostas preenchidas. |

Dias desconhecidos/violações interrompem sequências de dias operados; dias sem operações não criam pontos. A interface recomenda não aumentar atividade ou risco para obter reconhecimento. Os critérios não equiparam autodeclaração a auditoria externa.

## Certificados e integridade

Certificados são pessoais, com logo atual, período, descrição, critério, fonte, emissão e UUID interno. Não representam acreditação externa, auditoria de corretora ou domínio psicológico. Exportação PNG 2400 × 1697 e PDF A4 paisagem gerado localmente com a arte incorporada; PDF raster, sem assinatura digital. Nome oculto por padrão; valores financeiros e diário nunca são incluídos.

A elegibilidade é recalculada ao editar/importar/excluir dados e ao mudar a data. A emissão repetida da mesma conquista/período/configuração retorna o mesmo registro. Correções reavaliam o período exato e os parâmetros usados na emissão. Um certificado invalidado é preservado no histórico e recebe marca explícita na visualização e em novas exportações. Se a evidência for restaurada, o mesmo registro pode voltar a válido. Arquivos anteriormente baixados não podem ser revogados; o código interno não fornece validação pública. Dados são declarados/importados pelo usuário e não são à prova de adulteração.

## Validação

`npm test` inclui regras básicas de datas e monitor. Os testes de navegador precisam de Playwright e Chromium instalados:

```
node tests/growth-ui.cjs
node tests/growth-reviews-ui.cjs
node tests/growth-achievements-ui.cjs
node tests/cloud-workspace.cjs
```

Cobertura: opt-in, sessão desativada, fins de semana, DST/virada de dia, check-in de um clique e deduplicação, persistência, zero/uma/várias operações, R parcial, privacidade, reflexão salva/ignorada, vídeo realmente decodificado, cancelamento, PNG/PDF, todos os critérios e suas ausências de evidência, meses vazios/atuais/estimados, correção/exclusão/restauração de certificado, isolamento na nuvem e telas de 320 a 1280px. Testes usam dados isolados, nunca operações reais de produção. Safari/iPhone físico não foi validado neste ambiente; suporte a codecs, voz e compartilhamento varia por dispositivo.

## Entrega por fase

| Fase | Arquivos principais | Funcionalidade e verificação |
| --- | --- | --- |
| 1 — Arquitetura | `growth-engine.js`, adaptador em `growth.js` | Leitura do journal, motor de sessões e cálculos existentes; nenhuma base paralela ou nova API administrativa. |
| 2 — Monitor | `growth.js`, `growth.css`, `tests/growth-engine.cjs`, `tests/growth-ui.cjs` | Configuração, opt-in/manual, oito estados, contexto/vínculos, decisões, histórico, comparação e persistência; DST, fim de semana e madrugada testados. |
| 3 — Review | `growth-export.js`, `growth.js`, `tests/growth-reviews-ui.cjs` | Sete cenas, controles, reflexão, privacidade, PNG e vídeo realmente decodificado no Chromium; fallback sem MediaRecorder e reflexão ignorada. |
| 4 — Conquistas | `growth-engine.js`, `growth.js`, `growth-export.js`, `tests/growth-achievements-ui.cjs` | Doze critérios, amostras, lacunas, emissão/deduplicação, PNG/PDF e invalidação/restauração após correções. PDF validado como uma página A4 paisagem. |
| 5 — Integração | `YourFXjourney.html`, `public/terminal.js`, `tests/cloud-workspace.cjs` | Mesmo workspace e mesma conta, toolbar no Painel/Diário, uma rota de conquistas; restauração entre sessões e isolamento de emoções/reflexões entre usuários. |
| 6 — Regressão | `package.json`, `scripts/build_standalone.py`, standalone e documentação | `npm test`, `npm run test:growth`, `tests/cloud-workspace.cjs`, `tests/diary-workspace.cjs`, `tests/terminal-ui.cjs`; layout sem rolagem horizontal indevida nos tamanhos testados e módulos incorporados à versão offline. |

Limites das verificações: navegador Chromium em ambiente isolado, backend com fixtures para autenticação/nuvem, sem acesso a dados reais de clientes e sem chamada paga à IA externa. A configuração de e-mail/SMTP existente não foi alterada por este trabalho.
