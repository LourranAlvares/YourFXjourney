# Administração de plano e vencimento

A administração gerencia somente cadastro, status, plano, vencimento, observações administrativas e auditoria. Os dados de trading e emoções continuam privados.

## Usar

1. Em Administração, clique **Liberar acesso** em uma conta pendente/bloqueada ou **Renovar acesso** em uma conta vencida.
2. Escolha o plano de acesso e o prazo: trial de 7/14 dias, 1/2/3/6 meses, 1/2 anos, data personalizada ou sem vencimento.
3. Salve. O botão mostra o andamento, impede envios duplicados na mesma tela e só mostra a confirmação depois de resposta positiva do backend/banco. A confirmação identifica a conta, plano e vencimento. Erros ficam no formulário e não criam sucesso falso.
4. **Configurar acesso** também permite alterar apenas o plano, preservando a data atual, bloquear, colocar em pendência e encerrar sessões.

Os planos são os identificadores de acesso existentes (Padrão, Trial, Mensal, Trimestral, Anual, Personalizado), não novos pacotes de funcionalidades ou cobrança. Selecionar um prazo sugere um plano; a administração pode mudar essa classificação antes de salvar. Novos períodos de dois/seis meses e dois anos usam a classificação `custom` quando não houver plano explicitamente escolhido, compatível com a estrutura SQL existente.

Meses/anos usam o calendário em UTC, preservando o horário e ajustando o último dia para meses menores/anos bissextos. Um novo prazo começa no momento de salvar e substitui o anterior. Data personalizada expira ao final do dia UTC indicado. O backend rejeita liberar uma conta mantendo um vencimento já passado. Bloqueio/vencimento restringem acesso sem excluir histórico; a conta administradora permanece protegida.

## Ativação do banco, quando pendente

É necessário executar uma vez `server/cloud/management.sql` no SQL Editor do projeto Supabase, após `schema.sql`. A migração é transacional, aditiva para as contas e pode ser reaplicada. As tabelas de acesso e auditoria possuem RLS; atualizações passam pelo RPC administrativo com identidade de administrador verificada no servidor e no banco. Não há leitura administrativa de workspaces.

Se a tabela ainda não existir, o aplicativo mostra que a gestão de prazos não está ativada. **Liberar acesso** abre a explicação; uma aprovação simples continua disponível apenas pelo botão explicitamente chamado **Liberar sem vencimento**. Ela confirma exatamente essa condição e nunca finge ter aplicado um prazo. Depois de executar o SQL, use **Verificar configuração** para habilitar o formulário completo.

Não é necessário alterar o SQL para os novos períodos de 2 meses, 6 meses e 2 anos se a migração de gestão já estiver instalada. Credenciais não devem ser coladas em chats ou no frontend.

## Verificação

- `server/tests/management.test.cjs`: períodos, fim de mês, ano bissexto, plano permitido, conta administradora protegida e recusa de reativação com prazo expirado.
- `tests/management-ui.cjs`: aprovação com dois meses, dois anos, troca de plano mantendo vencimento, confirmação, falha sem falsa aprovação, auditoria e layout responsivo.
- `tests/cloud-workspace.cjs`: modo sem migração, aprovação explicitamente sem prazo, confirmação e bloqueio, preservando isolamento e dados pessoais.
- `tests/management-database.cjs`: migração e restrições reais de banco em instância de teste isolada.

Os testes não alteram usuários reais. A instalação da migração no projeto de produção não foi executada neste ambiente.
