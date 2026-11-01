# SMC Elite World — teste visual com cenários

## O que mudou

A apresentação preferencial do aplicativo servido passa a ser o lobby por clique, com interiores cenográficos para **Painel, Diário, Trading Plan, Análises, Risco, Notícias, Ferramentas e Conquistas**, além da **prévia visual da Comunidade em desenvolvimento**. Esta decisão segue a revisão do proprietário: priorizar o visual das referências e reduzir a jogabilidade. O personagem faz parte da arte e permanece parado; a interação usa realce das portas e uma transição breve de entrada. Não apresentar essa versão como personagem livre em 3D.

Os dez fundos foram preparados a partir das dez imagens do pacote fornecido pelo proprietário, usando edição de imagem para remover navegação duplicada, formulários ilustrativos, datas, preços, resultados e barras de XP. Foram preservadas a direção visual, arquitetura, decoração e iluminação; houve reconstrução das áreas antes cobertas pela UI, portanto não são cópias pixel a pixel dos PNGs. As telas decorativas usam apenas traços abstratos sem números. Assets WebP: cerca de 3,4 MB no conjunto, aproximadamente 412 KB para o lobby. Nenhum cenário é baixado na Home clássica; cada interior é solicitado somente ao abrir a sala.

## Integração

- `public/world/world-scenes.js`: manifesto fechado de assets e coordenadas percentuais das portas, preparação do lobby, navegação por clique/toque/teclado e composição das oito salas e da prévia futura.
- `world-bootstrap.js`: carrega a apresentação por imagens ao entrar. Se ela falhar, mantém a cena WebGL e o SVG já existentes como fallbacks.
- O callback de resize em `YourFXjourney.html` chama `refreshLayout()` somente no World ativo, capturando/restaurando os campos antes de renderizar; no clássico continua chamando `R()` como antes. Isso evita que o resize atrasado apague um rascunho aberto logo depois.
- `world.js`: seleciona o controlador visual, mantém o roteador original e move o mesmo `#main` para a sala. Estado financeiro, autenticação, cálculos e critérios não são duplicados.
- `world.css`: aparência isolada em `.smc-world-cinematic` / `.smc-cinema-*`. Sidebar real no desktop. No celular, cena proporcional e ferramenta abaixo, sem comprimir os formulários sobre a imagem.
- `server/index.cjs`: permite WebP apenas na whitelist pública existente, com `image/webp`; bloqueios de caminhos, arquivos privados e symlinks continuam vigentes.

Os controles reais ficam numa área de trabalho sobre o cenário. **Ampliar área de trabalho** permite editar com mais espaço; **Ver só o ambiente** oculta o painel sem desmontar os campos ou perder rascunhos. As oito salas funcionais com referências recebidas agora têm cenários. Serviços/Configurações continuam usando a apresentação funcional anterior, sem cenário adicional inventado. A porta da Comunidade permanece fechada; o acesso “Ver ambiente da Comunidade · Em desenvolvimento” oferece somente a prévia cenográfica, com aviso explícito e sem workspace/feed/perfis/live. Administração continua usando a permissão existente.

## Como testar

Home → **Entrar no SMC Elite World** → clique numa placa ou use a lista de salas. Tab/setas escolhem uma porta; Enter ou E entram. Dentro da sala, use as ferramentas originais, amplie o painel se necessário e retorne com **Voltar ao World**. **Voltar ao modo clássico** permanece no topo. Ajuda permite reduzir movimento; `prefers-reduced-motion` também é respeitado. Não há caminhada dentro das salas.

`npm run test:world:scenes` verifica carregamento sob demanda, ausência de download do motor 3D, oito views reais e uma prévia futura, rascunhos/dados preservados, teclado, imagens ausentes, fallback e larguras 320/390/768/1280/1440/1920. `npm run test:world` continua cobrindo o fallback original, integrações, isolamento cloud e standalone. `npm run test:world:3d` cobre o renderer alternativo, não a apresentação preferencial. Testes de engine isolados bloqueiam o script de cenários para exercitar seus próprios caminhos.

Capturas de navegador desta versão ficam em `docs/world-evidence/scenes-*.webp`. São evidências da implementação em workspace vazio, sem dados de clientes. Os fundos preparados não são evidência de funcionamento; as capturas incluem a aplicação real.

## Limites, publicação e rollback

O teste usa cenários com aparência 3D, sem câmera livre nem avatar andando. As oito ferramentas são as views existentes, não reproduções exatas dos formulários ilustrados. Não houve teste físico em iPhone/Safari ou validação do deploy externo neste ambiente. O standalone conserva o mapa SVG embutido; os novos cenários dependem dos arquivos públicos e não são inseridos no HTML offline.

Publicar `main` com `public/world/assets/`, controller e CSS. O controle `SMC_WORLD_ENABLED=false` continua desativando todo o World. Para rollback visual, usar o commit `44a59d4` para retornar ao primeiro lote de cenários ou `1dbac1e` para retornar à apresentação WebGL; rollback por Git sem tocar em `yfx1`, contas ou banco. Nenhuma migração ou limpeza de dados é necessária.

## Resultado registrado nesta entrega

- `npm test`: passou; 45 testes de servidor passaram, além das verificações dos motores incluídas no comando.
- `npm run test:world`: passaram mapa, UI, integrações, isolamento cloud e standalone/flag.
- `npm run test:world:scenes`: passou; capturas reais de lobby, oito interiores e celular salvas.
- `npm run test:world:3d`: passou; alternativa WebGL e recuperação de contexto continuam funcionais.
- `python3 scripts/build_standalone.py`: gerou o HTML offline (27,4 MB); `git diff --check` sem erros.
- Os testes cloud usam os cenários locais de autenticação/contas; não atestam uma configuração externa real do Supabase. O navegador gerenciado bloqueia URLs `file://`, então o standalone foi validado pelo harness HTTP com serviços externos indisponíveis, conforme a suíte existente.

## Segundo lote de referências

`analyst.webp`, `risk.webp`, `news.webp`, `tools.webp`, `achievements.webp` e `community.webp` foram preparados a partir dos seis interiores do novo lote. Foram removidos também os certificados ilustrados, a promessa de “alta probabilidade”, os cenários recomendados de risco e todos os perfis/contagens da comunidade. O troféu central é decoração arquitetônica, não evidência de conquista. As conquistas e os certificados pessoais permanecem no motor original. A análise mostra cobertura/aderência ao plano e continua podendo ser revisada manualmente quando os serviços estão indisponíveis. Abrir uma sala não envia screenshot ou diário ao provedor de IA.

A prévia da Comunidade usa `previewCommunity()` com as mesmas checagens de sessão. Ela não registra rota funcional, não muda `tab`, não monta `#main` e não permite liberar a porta de navegação. Renderizações de fundo e resize são dispensados nessa prévia; o rascunho anterior permanece na mesma view. `Escape`, voltar às salas e voltar ao clássico continuam funcionais. Nenhum backend social foi criado.

`tests/world-scenes-rooms.cjs` cobre as cinco novas views operacionais, as ferramentas secundárias, o cálculo real de risco, a análise manual com o mesmo score e cobertura zero sem evidência, a elegibilidade original dos certificados, prévia futura sem falsa rota, restrição de admin e larguras de 320 a 1920. Serviços de API são deliberadamente indisponíveis nessa suíte; ela não atesta uma conexão real com provedor externo.
