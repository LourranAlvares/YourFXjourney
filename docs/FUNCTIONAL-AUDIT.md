# Revisão funcional: sessão, prints e regressão

## Correções

O lembrete emocional usava uma âncora que não existe em todas as telas do World e registrava a exibição mesmo sem inserir o aviso. Também desaparecia ao renderizar outra rota. Agora o aviso é independente da rota, com limpeza por identidade/sessão, perguntas em português e verificação imediata após renderizar. A Home informa o estado do monitor e oferece ativação automática no horário configurado. Iniciar manualmente a atividade também ativa o monitor. Preferências explicitamente desativadas continuam respeitadas até uma ação do usuário. A página precisa estar aberta e visível; não são notificações push do sistema.

O fluxo de prints distingue imagem inválida de OCR indisponível. Leitura com tempo excedido apresenta erro recuperável após 60 segundos por etapa; o print já aberto continua salvável. Uma resposta atrasada não preenche outro editor. A captura é salva independentemente de o OCR reconhecer dados; os campos continuam opcionais.

## Testes executados

- `npm test`: motores e 45 testes de servidor passaram.
- Varredura de 52 arquivos de testes HTTP/motores: 41 passaram inicialmente. Ativos, reconexão e privacidade passaram novamente após ajustar seletores/navegação dos próprios testes à UI atual: total de 44.
- Dois novos testes passaram: `test:session:prompts` (horário, repetição, adiamento, resposta, World, troca de rota/identidade e fim de sessão) e `test:ocr:recovery` (arquivo inválido, falha e nova tentativa, salvar durante leitura, resposta atrasada e timeout).
- OCR real local: oito verificações passaram, incluindo extração, campos ambíguos, ausência de resultado inventado, print salvo sem revisão e ausência de envio externo.
- `test:growth` e `test:world` foram repetidos após as correções e passaram. A varredura incluiu plano, importação MT5, Diário, capital/moedas/risco, painéis, administração, autenticação/cloud simulada, SQL local, conquistas, análises, gráficos, responsividade e fallback WebGL.
- Standalone regenerado e verificação de whitespace executada.

## Pendências dos testes antigos

A varredura não ficou completamente verde. Oito testes HTTP ainda têm expectativas incompatíveis com a Home atual ou precisam de investigação: `home-preparation`, `office-ui`, `home-momentum`, `unified-workspace`, `reference-layout`, `assistant-functions`, `smc-design` e `mobile-upcoming`. Exemplos: esperam `.ta-preparation`, botão “SMC Elite Analyst”, contagem antiga de eventos ou texto antigo do briefing. Isso não é uma aprovação desses fluxos; os testes atuais de análises, preparação, layout e eventos oferecem cobertura complementar.

Outros dez testes antigos usam `file://`, bloqueado pela política do Chromium deste ambiente; todos foram tentados e falharam antes de exercitar a funcionalidade. O teste atual `world-offline` verifica o build isolado por HTTP com serviços externos desativados. A operação por arquivo local em um navegador fora deste ambiente não foi comprovada nesta revisão.

O resultado por arquivo está em `functional-audit-results.json`. Código zero significa aprovado; os demais indicam falha ou bloqueio, sem ocultar esses resultados. Não foram testados serviços reais pagos de IA nem contas de clientes, disponibilidade do Render ou iPhone/Safari físico. Nenhum dado de produção foi modificado pelos testes.
