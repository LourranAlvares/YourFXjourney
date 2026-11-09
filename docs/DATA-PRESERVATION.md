# Preservação de plano e Diário

## Trading Plan

O formulário tinha validação nativa e não preservava edição incompleta. Agora os campos e critérios são mantidos como `tradingPlanDraft` no workspace existente, separadamente das versões ativas. A captura ocorre durante edição, antes de renderizar/navegar e ao sair/ocultar a página. Reabrir restaura o preenchimento. Rascunhos não participam da avaliação do plano.

Salvar sempre preserva primeiro o rascunho. Se a validação da versão ativa falhar, a mensagem informa que o rascunho foi salvo e indica o que falta. Uma versão válida é adicionada ao histórico junto da remoção do rascunho, na mesma gravação. Não há migração nem exclusão de versões anteriores.

## Diário

Registros manuais mantêm IDs e persistem antes de fechar o editor. Ao salvar operação concluída, o Diário passa ao mês do fechamento e limpa filtros que poderiam ocultá-la. Registros incompletos continuam na coleção existente de registros parciais, fora das estatísticas financeiras.

## Nuvem e navegador

- A gravação precisa preservar a cópia local antes de retornar sucesso. Falha de quota mantém os campos/editor e retorna erro, sem confirmar um salvamento que não pode ser recuperado.
- O topo distingue pendente, salvando e salvo na nuvem. O aviso do formulário diferencia cópia no navegador de confirmação remota.
- Cache compartilhado mais recente ou pendente de outra aba não é sobrescrito por uma aba desatualizada. A API mantém a proteção existente por revisão; conflitos precisam de revisão explícita.
- Confirmação de um envio anterior preserva uma alteração mais nova que ainda está pendente. Respostas pertencem à identidade e geração de carregamento originais.
- No carregamento, cache pendente é retomado. Uma revisão local superior à remota é preservada como conflito em vez de substituída silenciosamente.

## Verificação

`npm run test:data:durability` verifica rascunho incompleto após salvar/recarregar, ativação válida, edição protegida após render/reload, operação manual e filtros, falha de rede com reload/reenvio, quota mantendo editor aberto, resposta atrasada com segunda edição e duas abas compartilhando cache sem sobrescrever o pendente.

Também foram executados `test:cloud:ui`, `tests/plan-layout-ui.cjs`, `test:diary` e `npm test` (motores e 45 testes de servidor). Os testes usam Chromium e backend/contas de teste locais, sem alterar históricos de clientes. O standalone inclui a preservação de rascunhos.

Esta entrega não confirma a recuperação de registros que já estejam ausentes na conta real, nem atesta o deploy do Render. O histórico remoto já disponível em Configurações → Versões anteriores continua acessível. Não é necessário limpar armazenamento do navegador para aplicar esta atualização.
