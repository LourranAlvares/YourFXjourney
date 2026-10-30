# EliteX — ativar contas e nuvem no Render

Esta implementação usa Supabase Auth para senhas, confirmação de e-mail e recuperação de acesso; PostgreSQL para perfis, permissões, histórico e planos. Render continua executando o site. A nuvem não fica ativa apenas com o deploy: crie o projeto e configure os itens abaixo.

## 1. Criar o projeto

1. Entre em https://supabase.com/dashboard (pode usar o GitHub).
2. Crie uma organização no plano Free e um projeto chamado `elitex`.
3. Escolha a região mais próxima dos usuários (London é uma opção para Europa).
4. Gere e guarde a senha do banco. Ela não é colada no site nem enviada ao chat.
5. Aguarde o projeto ficar pronto.

## 2. Aplicar as tabelas e permissões

1. Abra **SQL Editor → New query** no projeto.
2. Copie todo o conteúdo de [`schema.sql`](schema.sql), cole e clique **Run**.
3. A execução cria três tabelas: `elitex_profiles`, `elitex_workspaces` e `elitex_workspace_history`.
4. RLS precisa continuar habilitada. As políticas limitam cada usuário ao próprio espaço; a conta administradora não ganha leitura dos diários alheios.

O SQL pode ser executado novamente sem excluir históricos. Ele também inclui contas que já existem em Authentication. Não promova usuários alterando metadados do cadastro: a única conta administradora automática é o e-mail configurado no servidor, depois de confirmado.

## 3. Configurar autenticação e envio de e-mails

Em **Authentication**:

- Habilite o provedor **Email** e mantenha **Confirm email** ativado.
- Em **URL Configuration**, configure **Site URL** como `https://yourfxjourney.onrender.com` e adicione `https://yourfxjourney.onrender.com/account` às URLs de redirecionamento. Se usar domínio próprio, substitua as duas URLs pela origem final.
- Configure **SMTP próprio** para enviar confirmações e recuperação a usuários reais. O envio padrão do Supabase é restrito e não deve ser usado como envio público de cadastros. Use um provedor que você controla; pode ser Gmail com senha de app e verificação em duas etapas ou um serviço transacional.
- Teste o recebimento dos e-mails de confirmação e recuperação antes de liberar cadastros para clientes.

Os modelos podem manter o link padrão `{{ .ConfirmationURL }}`. Para usar somente token de uso único no servidor, prefira:

Confirmação: `{{ .SiteURL }}/account?token_hash={{ .TokenHash }}&type=email`

Recuperação: `{{ .SiteURL }}/account?token_hash={{ .TokenHash }}&type=recovery`

O frontend limpa tokens da barra de endereços antes de continuar. Senhas e tokens de acesso/renovação não são gravados no localStorage.

## 4. Configurar o Render

No Supabase, localize **Project Settings → API / API Keys**. Para uma configuração previsível, use as chaves legadas **anon** e **service_role**. Nunca copie a chave service_role para GitHub, HTML, prints ou chat.

No Render, abra seu serviço → **Environment** e adicione **todas** as variáveis antes de salvar:

| Variável | Valor |
|---|---|
| `ELITEX_CLOUD_ENABLED` | `true` |
| `SUPABASE_URL` | URL HTTPS do projeto, sem barra no final |
| `SUPABASE_ANON_KEY` | chave anon do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role do projeto, somente no servidor |
| `ELITEX_ADMIN_EMAIL` | o e-mail escolhido para a conta administradora |
| `ELITEX_SESSION_SECRET` | segredo aleatório estável, com pelo menos 32 caracteres; use Generate do Render |
| `TRADE_ALLOWED_ORIGIN` | `https://yourfxjourney.onrender.com`, sem barra final |

Mantenha as chaves de IA/mercado e o provedor de Notícias já configurados. No modo nuvem, a senha única `TRADE_ASSISTANT_PASSWORD` deixa de dar acesso aos serviços: cada usuário entra com sua própria conta.

Use:

- Build: `npm install --omit=dev`
- Start: `HOST=0.0.0.0 npm start`
- Node: 24

Salve em **Save, rebuild, and deploy** e aguarde **Live**. Não publique com apenas parte das variáveis: o servidor recusa iniciar uma nuvem incompleta, em vez de liberar acesso por outro modo.

## 5. Criar a conta administradora e trazer o histórico

1. Abra o site e escolha **Criar conta**.
2. Cadastre o mesmo e-mail de `ELITEX_ADMIN_EMAIL`, primeiro nome, sobrenome e uma senha de pelo menos 12 caracteres, com confirmação.
3. Confirme o e-mail recebido e entre.
4. A conta verificada recebe automaticamente o papel de administradora.
5. Se o navegador contém o histórico antigo `yfx1`, aparece **Revisar e importar meu histórico** no início e em Configurações. Confira se os dados são seus e confirme a importação. O histórico antigo não é apagado automaticamente.
6. Aguarde **Salvo na nuvem** antes de fechar. Entre em outro navegador para conferir o mesmo histórico.
7. Em **Mais ferramentas → Administração**, aprove ou bloqueie as demais contas. Cadastros novos aguardam aprovação por padrão.

## 6. Verificação antes de liberar acesso

- Cadastre dois e-mails diferentes e confirme ambos.
- Aprove somente um: o outro deve continuar em “Cadastro recebido”.
- Salve um trade na conta aprovada e entre em outro navegador: o trade deve reaparecer.
- Verifique que a segunda conta não recebe dados da primeira.
- Bloqueie a conta aprovada: o próximo pedido protegido deve ser recusado.
- Teste recuperação de senha e nova entrada.
- Confira a importação do histórico anterior na conta administradora.

## Operação e limites

- Os dados de aplicação são um documento JSON por usuário, com revisão numérica. Até 25 MiB por envio; prints entram no documento. Para grande volume de imagens, evolua para armazenamento privado de objetos antes de aumentar a escala. Monitore o espaço do projeto e os limites do plano contratado.
- As três versões anteriores ficam no mesmo PostgreSQL e podem ser restauradas em Configurações. Isso não substitui um backup externo do banco; o usuário também pode baixar o próprio JSON.
- O salvamento é automático após uma pausa de um segundo. Falhas de rede mantêm alterações pendentes no cache da conta ou, se o navegador estiver cheio, na aba atual com aviso. Não feche uma aba com alterações não enviadas sem exportar uma cópia.
- Duas abas/dispositivos usam revisão otimista. Uma versão antiga recebe HTTP 409, preserva o rascunho e solicita revisão; não sobrescreve dados da outra sessão.
- Sessões usam cookies HttpOnly/SameSite=Strict, Secure em produção e tokens cifrados com AES-GCM. A versão de sessão fica no banco para invalidar sessões também após logout/troca de senha e reinícios do Render. Mudar `ELITEX_SESSION_SECRET` exige novo login, sem apagar históricos.
- A service_role é usada apenas no servidor para perfis/aprovações. Leitura e gravação dos espaços usam o JWT do usuário; RLS e a função transacional verificam propriedade e status ativo.
- O administrador gerencia metadados e acesso de até 500 contas na lista atual; não consulta os históricos privados.

## Testes do desenvolvimento

`npm install` inclui somente a dependência de desenvolvimento PGlite, usada para testar o SQL em PostgreSQL real compilado para WASM. Produção não precisa dessa dependência.

- `npm test`: regressão e endpoints, incluindo contas.
- `npm run test:cloud:db`: schema, RLS, escrita transacional, conflitos, repetição idempotente e versões.
- `npm run test:cloud:ui`: cadastro/acesso, isolamento, salvamento, outro dispositivo, queda de rede, conflito, administração e telas pequenas (requer Playwright e Chromium no ambiente de testes).

Os testes de API/UI simulam o limite externo Supabase Auth/REST; o SQL é testado no motor PostgreSQL. O projeto Supabase, o SMTP e o deploy real ainda precisam ser configurados e verificados com as credenciais do proprietário.

O cadastro mantém primeiro nome e sobrenome separados nos metadados de autenticação e o nome completo no perfil. A saudação usa somente o primeiro nome, inclusive para contas antigas. Campos de senha/confirmacão têm botões SVG de mostrar/ocultar; a confirmação é validada no formulário e no servidor, sem ser repassada ao Supabase. Não exige alteração nas tabelas existentes.


## Cadastro com limite de e-mail ou destinatário não autorizado

Consulte [REGISTRATION.md](REGISTRATION.md) para configurar SMTP próprio e validar os envios reais. O aplicativo distingue falhas de envio e de autenticação, evita duplicatas e oferece reenvio de confirmação, sem remover a verificação de e-mail.
