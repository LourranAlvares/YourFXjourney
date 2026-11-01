> Após a revisão visual, este renderer é uma alternativa de recuperação. A experiência preferencial é descrita em [cenários por clique](SMC-ELITE-WORLD-SCENES.md).

# SMC Elite World — cena WebGL

A cena principal passou de SVG isométrico para geometria 3D real. O SVG anterior é mantido como fallback, não apresentado como WebGL.

## Implementado

- `public/world/world-3d.js` estende o controlador de movimento existente. Reutiliza grade, BFS, teclado, toque, permissões e callbacks de entrada nas ferramentas. O palco central tem uma zona própria de colisão.
- Edifício modelado em meshes: recepção, salas envidraçadas, estrutura metálica, mesas, cadeiras, plantas, elementos específicos de diário/plano/conquistas, pedestal, globo e robô.
- Materiais metálicos, vidro, iluminação de cena, sombras e reflexão planar no desktop. Reflexão e sombras são reduzidas/desligadas em telas pequenas. Pixel ratio limitado para controlar custo.
- Câmera em perspectiva com duas posições, placas projetadas a partir das coordenadas 3D, raycasting para selecionar piso/salas e destaque das portas próximas.
- Branding usa a imagem atual do SMC Elite já carregada, sem novos dados financeiros ou indicadores fictícios.
- Rendering somente ao iniciar, mover, redimensionar ou alterar câmera; sem loop WebGL em repouso. Recursos, texturas, render targets e contexto são liberados ao sair.
- Falha/perda de contexto WebGL ativa o mapa compatível sem recriar workspace ou perder acesso ao clássico.
- Three.js 0.160.1 é servido localmente e carregado somente ao entrar no World. `three.min.js`: aproximadamente 670 KB antes de compressão HTTP. `Reflector.js` foi adaptado do mesmo pacote para o loader sem módulos. Licença MIT preservada em `public/world/vendor/THREE-LICENSE.txt`. Não há CDN, engine de física adicional ou dependência nova de servidor.

## Integridade e limites

Os módulos originais, dados e fórmulas não mudam. As salas continuam abrindo `#main` pelo roteador existente. O modo clássico não recebe a aparência 3D; apenas o World ativo recebe as classes de cena. Não há XP, seguidores, notícias fictícias ou score de probabilidade.

O arquivo standalone continua com a versão vetorial embutida, sem acrescentar o vendor WebGL ao HTML grande. A cena 3D está disponível no aplicativo servido com a pasta `public/world/`; o modo local vetorial permanece utilizável.

A cena é uma modelagem procedural real, **não uma cópia fotorrealista da imagem conceitual**. O acabamento exato da referência requer direção de arte, modelos arquitetônicos/mobiliário de maior detalhe e materiais PBR criados para a mesma câmera e iluminação. Não afirmar equivalência visual exata ou qualidade de render offline a partir desta entrega.

## Testes

`npm run test:world:3d` usa Chromium com WebGL por SwiftShader para verificar: contexto real, meshes/triângulos, avatar em coordenadas 3D, mudança de câmera, sala funcional, dados preservados, ausência de renderização contínua, mobile e perda de contexto com fallback.

As suítes `test:world` de mapa, formulários, privacidade e offline continuam válidas; os testes de mapa/desempenho SVG bloqueiam explicitamente o enhancement para exercitar o fallback. Cloud continua testando suas permissões. Não é benchmark de GPU de usuário nem validação física de Safari/iPhone.

A publicação mantém `SMC_WORLD_ENABLED` e o retorno ao clássico. Para rollback integral, retornar ao commit `88a9185`, sem alterar dados de usuários. Para reduzir movimento, usar Ajuda ou a preferência de acessibilidade do dispositivo.
