# Diário opcional e capital editável

Todos os campos do Diário são opcionais, inclusive ativo, direção, data e resultado. É possível salvar um registro vazio, só notas, só prints ou uma captura sem concluir o OCR. O salvamento aguarda a leitura dos anexos e informa sucesso ou erro no topo e dentro do editor. Falhas de armazenamento preservam os campos e os prints no editor.

Registros sem fechamento e resultado conhecidos usam a coleção existente `tradeDrafts`, aparecem no Diário e podem ser reabertos e completados com o mesmo ID. Não recebem datas de execução, resultados zero ou ativos inventados; ficam fora das estatísticas financeiras. Resultados extraídos por OCR precisam de revisão para entrar nas estatísticas, mas isso não impede salvar o print.

O botão **Capital** na barra superior e **Editar capital inicial** no painel abrem o editor mesmo depois de o saldo ter sido confirmado. O usuário informa o valor exato; não foi atribuído nenhum valor presumido à conta do proprietário. A edição respeita a conta selecionada e verifica a identidade antes de salvar.

A importação MT5 reconhece apenas evidência explícita de saldo/depósito/capital inicial. Saldo atual, P&L e valores conflitantes não são usados para inferir o inicial. Um valor confirmado manualmente é preservado; a evidência importada fica disponível no editor para revisão. Nenhuma migração ou exclusão de dados é necessária.

## Verificação

- `test:journal:optional`: registros vazios, notas, prints, OCR sem revisão, recarga, completar/reabrir o mesmo ID, falha de quota, salvamento no World, capital confirmado editável, contas isoladas e evidência de importação.
- `test:diary`: editor, persistência, R baseado em evidência, gráficos e larguras 320–1920.
- `tests/currency-risk.cjs`: moedas, persistência, risco e ausência de overflow em 320–1920.
- `test:mt5`: relatórios e deduplicação.
- `test:ocr`: oito capturas reais com OCR local, sem enviar dados de clientes.

Os testes de navegador usam Chromium local e fixtures, não contas reais. A disponibilidade de Render/Supabase em produção não é demonstrada por esses testes.
