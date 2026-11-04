# SMC Elite World — estações funcionais e caminhada

Esta entrega responde à revisão do proprietário: a experiência não pode consistir apenas na tela clássica sobre um fundo. O aplicativo servido agora oferece composições operacionais próprias dentro das oito salas, usando os mesmos motores, formulários e fluxos de salvamento. O acabamento segue as referências, mas não é uma reprodução pixel a pixel nem inventa as informações mostradas nos conceitos.

## Salas

| Sala | Interface e ações reais |
| --- | --- |
| Painel | Curva, drawdown, métricas, resumo, ativos, sessões e operações em painéis separados. Usa `panelModel`, `panelChartData`, `panelMoney`, `terminalChart` e os mesmos filtros e seções. Sem histórico, apresenta estados vazios. |
| Diário | Estação de registro com ativo, direção, fechamento, setup, entrada/stop/alvo, P&L, notas, prints, aprendizado e check-in comportamental. “Salvar registro no Diário” salva pelos mesmos `saveT` e armazenamento. Todos os campos são opcionais: sem fechamento e resultado conhecidos, o registro fica incompleto e fora das estatísticas financeiras, com seus prints e notas preservados. Os registros recentes e a navegação mensal são os existentes. |
| Trading Plan | Visão das regras, setup, resumo e critérios obrigatórios. Navegação por seção abre os mesmos campos do formulário versionado. “Verificar um setup” abre o Analista. Não marca evidência automaticamente nem cria outro score. |
| Análises | Print, contexto, critérios do plano e relatório em estações separadas. Upload/contexto/formulário/revisão manual são os nós originais. A IA só recebe dados por solicitação explícita; cobertura e aderência usam o motor original, sem promessa de vitória. |
| Risco | Calculadora existente, capital/drawdown projetados pelo `PanelEngine`, limites do plano e cobertura dos registros. Sem saldos/cenários recomendados inventados e sem mudanças nas fórmulas. |
| Notícias | Calendário real, condições de mercado, sessão, briefing e eventos em painéis separados. Dados indisponíveis mantêm seus avisos; não há feed ou cotações ilustrativas. |
| Ferramentas | Cinco cartões abrem calculadoras, calendário compartilhável, captura/OCR, importadores e estratégias reais. As ferramentas secundárias permanecem no rodapé. Não há botões para conversores não implementados. |
| Conquistas | Galeria/histórico de certificados, elegibilidade real e cartões com os critérios existentes. Sem XP ou sequência fictícia. Emissão/exportação continuam nos fluxos originais. |

Comunidade continua como prévia explicitamente futura. Configurações/administração e destinos secundários permanecem nas views funcionais atuais, com as permissões originais.

## Avatar

O fundo do lobby foi preparado sem o personagem embutido. `avatar-walk.webp` contém quatro quadros transparentes do personagem. O controlador de cena posiciona a camada e anima os passos enquanto ela percorre um grafo de corredores em coordenadas percentuais, contornando o monumento central. Após chegar à entrada, abre a sala real. Não é um rig 3D nem locomoção livre dentro dos interiores.

Clique/toque numa placa para caminhar. Tab/setas escolhem uma placa; Enter/E iniciam a entrada. A lista de salas abre imediatamente. Movimento reduzido dispensa o trajeto animado. O deslocamento usa Web Animations/CSS, sem chamar `R()` a cada passo. Sair, escolher outra porta ou ocultar a aba cancela a caminhada e a entrada pendente. A posição visual é derivada das mesmas preferências de UI por usuário; nenhum trade vai para esse armazenamento.

## Arquitetura e integridade

- `public/world/world-stations.js` compõe os painéis depois do render original e antes da restauração dos rascunhos. Move nós de formulário reais em vez de copiá-los. Controles complementares ficam em detalhes acessíveis. Não há iframe, novo workspace financeiro, endpoint ou importador.
- `world.js` preserva campos por ID/chave estável de critério, inclusive após mudar a ordem visual. Ao voltar ao clássico, renderiza a view original e restaura o rascunho; classes de estações são removidas. Prints selecionados na estação do Diário permanecem apenas na memória do controlador até o salvamento. Logout/identidade mantêm a limpeza existente.
- `world-bootstrap.js` carrega o módulo somente ao entrar no World com os cenários disponíveis. Se ele falhar, a composição funcional anterior permanece utilizável. A feature flag, o WebGL de recuperação e o SVG continuam disponíveis.
- `world.css` usa classes específicas de estações/World. No celular, os painéis viram uma sequência vertical legível. O modo clássico não recebe esses layouts.
- A variante standalone conserva o World SVG embutido, sem exigir os novos assets externos. Não anuncia suporte às estações cinematográficas no arquivo isolado.

## Testes e evidências

`npm run test:world:stations` verifica caminhada real (posição e quadros, sem renders do app durante o trajeto), oito composições, larguras 320/390/768/1280/1440/1920, mesma série de gráfico, versão do plano, preservação de critério/rascunho, registro pelo salvamento original com um print, um único ID, revisão manual sem evidência com cobertura zero, cartões de ferramentas e retorno limpo ao clássico — inclusive à mesma rota.

As suítes `test:world:scenes`, `test:world` e `test:world:3d` continuam aplicáveis. `npm test` cobre os motores/servidor. As evidências `docs/world-evidence/stations-*.webp` são capturas de navegador com fixtures identificadas de teste, não renderizações conceituais nem dados de clientes. APIs externas são indisponíveis nos testes de estações; conexão real a IA/Supabase/Render não é atestada por isso.

## Publicação e rollback

Publicar os arquivos públicos e módulos junto do HTML/build atual. O acesso continua em Home → Entrar no SMC Elite World. `SMC_WORLD_ENABLED=false` desativa o World. O commit `729512e` recupera a etapa anterior de cenários com personagem parado. Nenhuma migração, exclusão, regravação de trades ou alteração de banco é necessária para publicar ou reverter.

## Validação registrada

- `npm test`: passou (incluindo 45 testes de servidor e as verificações dos motores).
- `npm run test:world`: passaram mapa, UI, integrações, isolamento cloud e offline/flag.
- `npm run test:world:scenes`: passaram os dois conjuntos de cenários, com a navegação por seção do plano adaptada à nova apresentação.
- `npm run test:world:stations`: passou, incluindo o cancelamento da entrada ao sair durante uma caminhada e o salvamento de um único registro com um print.
- `npm run test:world:3d`: passou para o renderer de recuperação.
- Build standalone regenerado; verificação de whitespace sem erros. Testes de navegador usaram Chromium local, não um iPhone/Safari físico. O harness offline preserva a limitação de `file://` bloqueado pelo ambiente gerenciado.

O World agora tem barra própria com busca real, data/relógio, retorno ao lobby, edição de capital e ajuda. O cenário ocupa a sala; os controles funcionais são estações sobre o ambiente. Não são exibidos horário, conexão ou saldo ilustrativos.

A correção compartilhada de registros opcionais e capital está descrita em [Diário e capital](DIARY-OPTIONAL-CAPITAL.md).
