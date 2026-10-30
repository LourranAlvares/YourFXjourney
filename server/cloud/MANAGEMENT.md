# SMC Elite — gestão de usuários

## Ativar no site existente

1. No Supabase, abra **SQL Editor → New query**.
2. Cole todo o conteúdo de [management.sql](management.sql) e clique **Run**. O SQL é transacional e pode ser executado novamente; não apaga contas ou históricos.
3. Depois do deploy do Render, entre com a conta administradora e abra **Administração** no menu lateral.

Não altere as variáveis já configuradas no Render. `schema.sql` também inclui a gestão para instalações novas. Antes de aplicar a migração, login e salvamento atuais continuam funcionando, e a administração informa que os novos controles precisam ser ativados. Erros de rede não são tratados como banco sem migração.

## Controles por conta

- Nome e e-mail de cadastro, data de criação, status, plano e vencimento.
- Aprovar, aguardar aprovação ou bloquear, sem apagar dados.
- Manter prazo atual, trial de 7/14 dias, mensal, trimestral, anual, data personalizada ou sem vencimento.
- Novos prazos começam no momento da alteração. Meses usam calendário, com ajuste ao último dia do mês; não são cobrados pagamentos automaticamente. Data personalizada termina às 23:59:59.999 UTC do dia escolhido.
- Observações administrativas (até 2.000 caracteres), invisíveis aos outros usuários.
- Encerrar sessões atuais, exigindo novo login. A conta administradora é protegida.
- Auditoria das alterações de acesso; últimos 50 eventos por conta na interface.
- Busca de nome/e-mail e paginação de 100 contas por página.

Vencimento é conferido no servidor a cada sessão e também no PostgreSQL/RLS para impedir leitura/gravação direta do workspace por usuário expirado. Renovar restitui o acesso sem apagar histórico. Cadastros, logins e aprovações mantêm seus fluxos habituais.

## Privacidade e escopo

Esta versão gerencia apenas cadastro e acesso. Não acompanha resultados, operações, diário, prints ou comportamento financeiro de outros usuários e não contém botões de autorização/compartilhamento. A relação de mentor poderá ser projetada separadamente no futuro.

A migração remove a tabela e as duas funções da funcionalidade de acompanhamento retirada; não apaga contas, workspaces, histórico de trading, prints ou versões de backup. Os eventos administrativos antigos permanecem no banco, mas a interface consulta somente alterações de acesso. As funções de alteração exigem `service_role` e verificação administrativa no servidor; mutações HTTP exigem origem válida e CSRF.

## Cadastro e envio de e-mails

A administração inclui um diagnóstico técnico de envio de confirmações, sem e-mails ou dados pessoais dos usuários. Ele mostra somente erros observados nesta instância e solicitações aceitas pelo provedor; não comprova entrega na caixa de entrada. Veja [REGISTRATION.md](REGISTRATION.md).

## Verificação

`npm test`, `node tests/management-database.cjs`, `node tests/cloud-database.cjs`, `node tests/cloud-workspace.cjs`, `node tests/management-ui.cjs` e `node tests/registration-ui.cjs`. Os testes de banco usam PostgreSQL/WASM; testes de HTTP/UI usam contas e provedores simulados. O Supabase real exige executar o SQL e configurar o SMTP.
