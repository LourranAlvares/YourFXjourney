# SMC Elite World — navegação alternativa

> Evolução: o lobby servido agora oferece WebGL real, com o mapa vetorial preservado como fallback e no standalone. Veja [arquitetura e limites da cena 3D](SMC-ELITE-WORLD-3D.md).

## Auditoria e recuperação

Base: `850e222` em `main`, árvore de trabalho limpa antes da implementação. Branch: `feature/smc-elite-world`. O World não substitui o clássico nem entra automaticamente após login. A versão comercial de apresentação e todos os módulos existentes permanecem no repositório.

Auditoria: README, package.json, HTML principal/standalone, render `R()`, `taGo()`, terminal, mobile, assistant, daily workspace, growth, panel e respectivos motores, servidor, autenticação/workspaces e testes. Stack: JavaScript/HTML/CSS, Node, APIs existentes e Supabase opcional. As 11 imagens conceituais e 3 referências do ZIP foram examinadas; eram WebP, apesar da descrição mencionar PNG. Foram extraídas somente em `/tmp/smc-world-reference`, não entregues como telas funcionais.

Baseline antes da feature: `npm test` passou, incluindo as suítes de motores e 45 testes de servidor. Não foi encontrada falha nessa execução inicial. As suítes UI/cloud pertinentes foram executadas também como regressão com a flag desligada.

O Git preserva código, não localStorage nem o banco dos usuários. Não havia sessão real de usuário para exportar/validar backup neste ambiente. Antes de atualizar uma instalação com dados reais, exporte pelo Diário → Exportar backup ou Configurações → Baixar meu backup e confirme que o JSON contém o workspace esperado. Não houve migração, limpeza ou regravação de trades para ativar o World.

## Arquitetura

| Arquivo | Responsabilidade |
| --- | --- |
| `public/world/world-bootstrap.js` | Ponte pequena, flag, botão único na Home e carregamento sob demanda. |
| `public/world/world.js` | Lifecycle, alternância, montagem da view original, rascunhos em memória e limpeza por identidade. |
| `public/world/world-rooms.js` | Registro estável de salas, destinos e permissão de administração. |
| `public/world/world-map.js` | Construção vetorial SVG, projeção isométrica, grade, colisão, BFS, movimento e interação. |
| `public/world/world-ui.js` | HUD, placas, lista acessível de salas e molduras operacionais. |
| `public/world/world.css` | Aparência sob namespace World; correções de isolamento dos seletores globais de header/nav. |
| `YourFXjourney.html` | Uma inclusão da ponte antes do boot existente. |
| `scripts/build_standalone.py` | Incorporação do World, leve e sem imagens conceituais, no standalone. |
| `server/index.cjs` | Flag inserida no documento; não altera APIs, autenticação ou whitelist de arquivos. |

O World ocupa uma raiz separada. Em uma sala, move o mesmo `#main` para a área de trabalho; o módulo continua usando `R()`, `S`, `persistState`, filtros, cálculos, listeners e diálogos existentes. Não há iframe, importador duplicado, IA separada, endpoint adicional de dados ou segundo diário.

No lobby não há renderizações periódicas do app: a ponte suspende `R()` até montar uma sala. O movimento altera apenas posição do avatar e proximidade das portas. Ao entrar em uma sala, a view é novamente lida do estado atual, com restauração de rascunhos de formulário quando apropriado. Campos do filtro global ficam fora dessa restauração para que a interface continue refletindo o filtro compartilhado real.

## Dados e rascunhos

- `S`, a chave local `yfx1` e a chave cloud `elitex-workspace:<id>` permanecem intactos.
- A preferência `smc-elite-world-ui-v1:<chave-do-workspace>` contém apenas coordenadas do avatar, redução de movimento e dispensa da ajuda. Sem trades, dinheiro, nomes, prints, emoções ou e-mail.
- Rascunhos de campos, checkboxes, seleções, critérios adicionados/removidos e detalhes expansíveis ficam em memória por rota, não em outro banco. O rascunho do plano não é reaplicado sobre uma versão salva diferente.
- Trocar de modo preserva os rascunhos, mas **recarregar a página não salva formulários não enviados**. Use Salvar para persistir. Diálogos/editores abertos bloqueiam a alternância; não são fechados silenciosamente.
- A troca de identidade ou perda da sessão desmonta o World e descarta os rascunhos da identidade anterior. Logout continua pelo fluxo original, com a proteção existente contra alterações não sincronizadas.

## Salas e rotas reais

| Sala | Funções existentes |
| --- | --- |
| Painel | `dash`, `ana`, `ins`, `cal`: quatro áreas de performance, análises e calendário. |
| Diário | `trades`, `rev`: operações, edição, prints, importações, emocional e revisões. |
| Trading Plan | `plan`, `str`, `pat`: plano versionado, estratégias e padrões. |
| Análises | `analyst`: screenshot, IA configurada, revisão manual, score e cobertura originais. |
| Risco | `risk`: calculadoras e registros existentes. |
| Notícias | `economic`, `home`: calendário e o briefing original, sem outro gerador. |
| Ferramentas | `share`, `trades`, `risk`, `cal`, `pat`, `str`: calendário compartilhável, importação/OCR no diário e utilidades reais. |
| Conquistas | `achievements`, `rev`: critérios, certificados e revisões existentes. |
| Serviços | `settings`, `admin`: configurações e administração **somente** para a conta cloud ativa com role admin. |
| Comunidade | Porta fechada com “Em desenvolvimento”; nenhuma rota, live, feed, contador ou ação fictícia. |

Os oito estados emocionais e as regras realmente implementadas em `docs/SMART-GROWTH.md` continuam sendo usados. Não foram substituídos por uma escala nova nem inferidos da imagem conceitual. Todas as métricas são as do workspace. Não foram criados XP, níveis, simulações financeiras nem probabilidades de vitória.

## Como usar

1. Com a flag habilitada, abra a Home clássica e clique no único botão **Entrar no SMC Elite World**.
2. Clique/toque na placa de uma sala: o avatar calcula um caminho e entra ao chegar à porta. Também pode clicar no piso.
3. WASD/setas: deslocamento; E/Enter próximo à porta: entrada. O movimento não captura teclas de formulários, botões ou diálogos.
4. **Salas e ferramentas** ou a lista abaixo do mapa permitem entrar diretamente em um ou dois cliques, sem caminhar.
5. **Voltar ao World** retorna ao átrio. Escape faz o mesmo apenas sem diálogo/editor/formulário em foco.
6. **Voltar ao modo clássico** mantém a view e os dados da plataforma e retorna à rota clássica de origem. O retorno também existe na tela de falha da cena.
7. Comunidade permanece fechada. O acesso administrativo é herdado do módulo original e também verificado na seleção de destinos.

Em Ajuda existe também uma opção própria de redução de movimento, sem contrariar a preferência do dispositivo. Movimento reduzido é respeitado: a escolha de destino reposiciona o avatar sem animação; todas as ferramentas continuam acessíveis. Não é necessário criar um personagem. A câmera enquadra o prédio, sem obrigar seguir corredores longos. Não há joystick adicional obrigatório no celular.

## Desempenho e assets

A base compatível é SVG/CSS 2.5D; o enhancement servido usa Three.js/WebGL. A arquitetura, paredes, estações, portas e avatar são construídos por código e a grade determina colisões e caminhos. Nenhuma imagem de referência é carregada pela Home ou usada como tela interativa.

A ponte é pequena e só carrega estilos e módulos da cena após o clique. Não há dependência nova de produção. O núcleo compatível fica abaixo de 100 KB de fonte; o enhancement 3D acrescenta cerca de 700 KB (vendor minificado e renderer), carregado somente na entrada, e aumenta marginalmente o standalone já existente (~27 MB). Não há loop JS no repouso: `requestAnimationFrame` roda somente durante o trajeto; é cancelado ao sair ou ocultar a aba. As portas são atualizadas apenas quando a proximidade muda.

Medição no Chromium deste ambiente: trajeto de ~176 unidades em 1,3 s, 57–59 frames observados e **zero chamadas ao render do aplicativo durante o movimento**. É uma medição de teste, não benchmark universal de hardware. O modo reduzido e a lista de salas oferecem alternativa sem animação.

## Flag, deploy e rollback

Após autorização do proprietário para teste público, o servidor oferece o botão por padrão quando a variável está ausente. `SMC_WORLD_ENABLED=false` **desativa** o botão, sem migração, sem cena carregada e sem alteração visual no clássico. `true` mantém o botão habilitado. A flag não concede permissões de conta ou de API.

Para testar localmente:

```sh
SMC_WORLD_ENABLED=true npm start
# Abra http://localhost:8080 (ou a porta configurada).
```

Para o Render: publique a branch/revisão aprovada no mesmo serviço existente e adicione `SMC_WORLD_ENABLED=true` nas variáveis do serviço. Não altere segredos de IA/Supabase nem banco. Login continua abrindo o clássico; o World só aparece após o clique. Para desligar, use explicitamente `SMC_WORLD_ENABLED=false` e redeploy. Para rollback de código, volte ao commit-base `850e222` ou a uma revisão aprovada anterior da branch, sem restaurar/remover dados de usuários.

O arquivo standalone incorpora módulos e estilos; aberto diretamente em um navegador que permita `file:`, oferece o modo local sem IA/serviços externos. Neste ambiente o Chromium gerenciado bloqueia URLs `file:` (`ERR_BLOCKED_BY_ADMINISTRATOR`). Por isso a validação do artefato embutido foi feita via HTTP local, com APIs externas abortadas e sem scripts World externos. A abertura física por arquivo não é declarada validada.

## Testes e evidências

```sh
npm test
NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules npm run test:world
# NODE_PATH é específico do ambiente de execução; Playwright/Chromium são ferramentas de teste.
```

- `tests/world-map.cjs`: projeção inversa, caminhos até todas as salas, colisões, comunidade fechada e allowlist.
- `tests/world-ui.cjs`: lazy-load, todas as salas, alternâncias, integridade do estado, rascunhos/critério adicional, edição real de trade, teclado, Escape, 320/390/768/1280/1440/1920px, retorno após falha e recarga.
- `tests/world-integration.cjs`: criação de trade real pela interface, mesma matemática/IDs, revisão manual e score original, check-in, reflexão, imagens, elegibilidade, persistência e medição de movimento.
- `tests/world-cloud.cjs`: fixture de Supabase/contas com login real no app de teste; isolamento Alice/Bob, role do proprietário, negação de admin a membro, limpeza de identidade e preferência sem dados pessoais.
- `tests/world-offline.cjs`: flag desligada, MIME/whitelist e standalone embutido com serviços indisponíveis.
- Regressões pertinentes: cloud-workspace, panel-experience-ui, growth-ui, growth-reviews-ui e growth-achievements-ui, além do baseline de `npm test`.

Capturas de navegador estão em `docs/world-evidence/`, com galeria `index.html`. Foram geradas pelo aplicativo executado, usando contas/dados sintéticos de teste identificados; não são mockups nem registros reais de usuários. Há Home clássica antes/depois, lobby desktop/mobile e todas as salas funcionais.

## Limitações e próximos passos

- O lobby servido é uma modelagem procedural WebGL e não uma reprodução fotorrealista exata; o fallback é vetorial. Os interiores continuam priorizando as ferramentas reais em uma moldura cenográfica leve.
- Não há comunidade, rede social, live, XP ou personalização de avatar nesta entrega.
- Não houve teste em Safari/iPhone físico ou hardware de baixo desempenho; o teclado, toque/viewport e movimento reduzido foram exercitados no Chromium.
- Cloud foi validado contra fixture, não contra o Supabase de produção. IA real e calendário externo não foram consultados para demonstrar o World; seus fluxos existentes continuam disponíveis quando configurados.
- Publicação de produção e observação do status Live no Render dependem do ambiente externo. Não anunciar a flag como habilitada em produção sem confirmar o deploy.
