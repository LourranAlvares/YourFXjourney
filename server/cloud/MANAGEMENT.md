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
- Auditoria das alterações de acesso e das autorizações/revogações de compartilhamento; últimos 50 eventos por conta na interface.
- Busca de nome/e-mail e paginação de 100 contas por página.

Vencimento é conferido no servidor a cada sessão e também no PostgreSQL/RLS para impedir leitura/gravação direta do workspace por usuário expirado. Renovar restitui o acesso sem apagar histórico. Cadastro, login, aprovação e controle de acesso não dependem de autorização de coaching.

## Acompanhamento autorizado

Desativado por padrão. Em **Configurações → Acompanhamento pela administração**, o próprio usuário autoriza um resumo de desempenho. A administração não pode habilitar essa preferência por outra pessoa. Contas bloqueadas/expiradas também podem revogar pelo painel de acesso na página de login.

O servidor calcula, a partir do workspace salvo, total de operações fechadas, P&L, taxa de acerto, profit factor, drawdown, sequência atual de perdas, semana, mês e retorno sobre saldo inicial confirmado. Não compartilha prints, diário, anotações ou plano completo. Moeda é a unidade declarada, sem conversão de câmbio. Dados são registrados pelo próprio usuário e não são um extrato verificado da corretora. Sem saldo confirmado não se inventa percentual; zero operações não vira taxa de acerto zero.

Datas usam o fechamento registrado; semana começa segunda-feira UTC. O resumo é atualizado ao autorizar e ao salvar o workspace. Falha de relatório não descarta um diário já salvo; a data do último resumo fica visível. O número de revisão impede um salvamento atrasado de substituir um resumo mais novo. Revogar limpa o resumo e impede novas consultas; isso não remove informações já vistas anteriormente pela administração.

A rota administrativa consulta somente os resumos autorizados, não os workspaces privados. Não há exportação oculta de dados, impersonação de usuários, exposição de senhas ou acompanhamento escondido. As funções de gestão exigem administrador no servidor; as funções PostgreSQL de alteração e publicação exigem `service_role`. Somente a função de consentimento é executável pelo próprio usuário autenticado. Todas as mutações HTTP exigem origem válida e CSRF.

## Verificação

`npm test`, `node tests/management-database.cjs`, `node tests/cloud-database.cjs`, `node tests/cloud-workspace.cjs` e `node tests/management-ui.cjs`. Os testes de banco usam PostgreSQL/WASM; testes de HTTP/UI usam contas e provedores simulados. As configurações do Supabase real ainda exigem execução do SQL acima.
