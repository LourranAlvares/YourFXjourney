# SMC Elite World — teste visual com cenários

## O que mudou

A apresentação preferencial do aplicativo servido passa a ser o lobby por clique, com interiores cenográficos para **Painel, Diário e Trading Plan**. Esta decisão segue a revisão do proprietário: priorizar o visual das referências e reduzir a jogabilidade. O personagem faz parte da arte e permanece parado; a interação usa realce das portas e uma transição breve de entrada. Não apresentar essa versão como personagem livre em 3D.

Os quatro fundos foram preparados a partir das quatro imagens do pacote fornecido pelo proprietário, usando edição de imagem para remover navegação duplicada, formulários ilustrativos, datas, preços, resultados e barras de XP. Foram preservadas a direção visual, arquitetura, decoração e iluminação; houve reconstrução das áreas antes cobertas pela UI, portanto não são cópias pixel a pixel dos PNGs. As telas decorativas usam apenas traços abstratos sem números. Assets WebP: cerca de 1,4 MB no conjunto, aproximadamente 412 KB para o lobby. Nenhum cenário é baixado na Home clássica; cada interior é solicitado somente ao abrir a sala.

## Integração

- `public/world/world-scenes.js`: manifesto fechado de assets e coordenadas percentuais das portas, preparação do lobby, navegação por clique/toque/teclado e composição das três salas.
- `world-bootstrap.js`: carrega a apresentação por imagens ao entrar. Se ela falhar, mantém a cena WebGL e o SVG já existentes como fallbacks.
- O callback de resize em `YourFXjourney.html` chama `refreshLayout()` somente no World ativo, capturando/restaurando os campos antes de renderizar; no clássico continua chamando `R()` como antes. Isso evita que o resize atrasado apague um rascunho aberto logo depois.
- `world.js`: seleciona o controlador visual, mantém o roteador original e move o mesmo `#main` para a sala. Estado financeiro, autenticação, cálculos e critérios não são duplicados.
- `world.css`: aparência isolada em `.smc-world-cinematic` / `.smc-cinema-*`. Sidebar real no desktop. No celular, cena proporcional e ferramenta abaixo, sem comprimir os formulários sobre a imagem.
- `server/index.cjs`: permite WebP apenas na whitelist pública existente, com `image/webp`; bloqueios de caminhos, arquivos privados e symlinks continuam vigentes.

Os controles reais ficam numa área de trabalho sobre o cenário. **Ampliar área de trabalho** permite editar com mais espaço; **Ver só o ambiente** oculta o painel sem desmontar os campos ou perder rascunhos. As outras salas continuam acessíveis com as ferramentas atuais e a apresentação anterior, aguardando a próxima etapa de arte. Comunidade permanece fechada como recurso futuro. Administração continua usando a permissão existente.

## Como testar

Home → **Entrar no SMC Elite World** → clique numa placa ou use a lista de salas. Tab/setas escolhem uma porta; Enter ou E entram. Dentro da sala, use as ferramentas originais, amplie o painel se necessário e retorne com **Voltar ao World**. **Voltar ao modo clássico** permanece no topo. Ajuda permite reduzir movimento; `prefers-reduced-motion` também é respeitado. Não há caminhada dentro das salas.

`npm run test:world:scenes` verifica carregamento sob demanda, ausência de download do motor 3D, três views reais, rascunhos/dados preservados, teclado, imagens ausentes, fallback e larguras 320/390/768/1280/1440/1920. `npm run test:world` continua cobrindo o fallback original, integrações, isolamento cloud e standalone. `npm run test:world:3d` cobre o renderer alternativo, não a apresentação preferencial. Testes de engine isolados bloqueiam o script de cenários para exercitar seus próprios caminhos.

Capturas de navegador desta versão ficam em `docs/world-evidence/scenes-*.webp`. São evidências da implementação em workspace vazio, sem dados de clientes. Os fundos preparados não são evidência de funcionamento; as capturas incluem a aplicação real.

## Limites, publicação e rollback

O teste usa cenários com aparência 3D, sem câmera livre nem avatar andando. As três ferramentas são as views existentes, não reproduções exatas dos formulários ilustrados. Não houve teste físico em iPhone/Safari ou validação do deploy externo neste ambiente. O standalone conserva o mapa SVG embutido; os novos cenários dependem dos arquivos públicos e não são inseridos no HTML offline.

Publicar `main` com `public/world/assets/`, controller e CSS. O controle `SMC_WORLD_ENABLED=false` continua desativando todo o World. Para retornar à apresentação WebGL anterior, usar o commit `1dbac1e`; rollback por Git sem tocar em `yfx1`, contas ou banco. Nenhuma migração ou limpeza de dados é necessária.

## Resultado registrado nesta entrega

- `npm test`: passou; 45 testes de servidor passaram, além das verificações dos motores incluídas no comando.
- `npm run test:world`: passaram mapa, UI, integrações, isolamento cloud e standalone/flag.
- `npm run test:world:scenes`: passou; capturas reais de lobby, três interiores e celular salvas.
- `npm run test:world:3d`: passou; alternativa WebGL e recuperação de contexto continuam funcionais.
- `python3 scripts/build_standalone.py`: gerou o HTML offline (27,3 MB); `git diff --check` sem erros.
- Os testes cloud usam os cenários locais de autenticação/contas; não atestam uma configuração externa real do Supabase. O navegador gerenciado bloqueia URLs `file://`, então o standalone foi validado pelo harness HTTP com serviços externos indisponíveis, conforme a suíte existente.
