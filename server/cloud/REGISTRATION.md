# Cadastro e confirmação de e-mail

## O erro “Aguarde um pouco antes de tentar novamente”

A mensagem antiga era genérica para respostas HTTP 429 do Supabase. Ela podia indicar cota de e-mails ou limite de solicitações. O aplicativo agora diferencia essas situações, preserva o formulário e respeita `Retry-After` quando informado. Também evita envios duplicados, permite reenviar confirmação e mantém o login independente da pausa de envio. Não tenta reenviar automaticamente.

Os limites locais de autenticação foram separados por ação e identidade. Usuários de um mesmo proxy não dividem mais o antigo limite de 40 tentativas. Um limite de rede mais amplo continua existindo contra abuso. Cabeçalhos de IP não confiáveis não são usados para contornar limites.

## Configurar o envio real no Supabase

O envio padrão do Supabase tem restrições de destinatários e de quantidade. Uma plataforma com cadastros de clientes deve usar SMTP próprio. Essa configuração é no Supabase, não nas variáveis do Render.

1. Escolha um serviço de e-mail transacional, como Resend, Brevo ou outro provedor SMTP.
2. Verifique o remetente/domínio conforme o provedor. Quando exigidos, configure os registros DNS (SPF/DKIM) fornecidos por ele.
3. No projeto Supabase, abra **Authentication → Emails → SMTP Settings** (a posição pode variar na versão do painel).
4. Habilite SMTP próprio e preencha host, porta, usuário, senha/chave SMTP, nome e e-mail do remetente usando os valores do provedor. Insira credenciais diretamente no painel; não as publique ou envie em screenshots/chat.
5. Mantenha a confirmação de e-mail ativada e a URL do site/retorno em `https://yourfxjourney.onrender.com` e `/account`.
6. Confira os limites em **Authentication → Rate Limits** e a cota do provedor. Ajustes devem acompanhar a capacidade contratada; não desative a proteção de autenticação.
7. Faça um cadastro de teste com um endereço externo autorizado, abra a confirmação e aprove a conta no aplicativo. Verifique inbox e spam. Se a conta já foi criada mas o e-mail não chegou, use **Reenviar confirmação de e-mail**.

Documentação oficial: https://supabase.com/docs/guides/auth/auth-smtp

## Diagnóstico na administração

- **Envio limitado**: o provedor devolveu limite de e-mails; configurar/ajustar SMTP e aguardar a cota é necessário. Atualizar o código não remove uma cota externa.
- **Configuração necessária**: destinatário não autorizado ou envio não configurado/habilitado.
- **Falha de envio**: revisar credenciais SMTP, remetente verificado e logs do serviço.
- **Tentativas limitadas**: o serviço de autenticação impôs seu limite de solicitações.
- **Último envio aceito**: uma solicitação foi aceita; ainda é necessário conferir o recebimento real.
- **Ainda não verificado**: a instância não observou um envio; não significa que SMTP esteja funcionando ou configurado.

O diagnóstico é técnico, em memória, sem histórico individual, senhas, destinatários ou mensagens brutas do provedor. Reiniciar o servidor limpa o diagnóstico. A entrega real deve ser validada com o Supabase e o serviço SMTP configurados.
