# Tutorial de primeiro acesso

Contas novas e ainda sem configuração/histórico recebem um convite discreto no conteúdo da página, sem bloquear navegação: “Começar passo a passo” ou “Pular e descobrir sozinho”. Contas já configuradas ou com registros/planos não recebem esse convite automaticamente.

O guia tem sete etapas: perfil/horário, moeda/capital, plano, Diário, preparação/check-ins, Painel e conclusão. Os botões abrem os formulários e rotas existentes; não criam operações, saldo fictício ou outro armazenamento financeiro. Ao abrir uma configuração, o guia se recolhe para permitir preencher e salvar normalmente. “Continuar tutorial” retoma o passo.

O usuário pode avançar sem preencher campos, voltar, pular ou concluir. Progresso e escolha de pular/concluir são persistidos em `S.onboarding`, no mesmo workspace privado da conta. Um guia iniciado e não concluído retoma na próxima visita. Pular/concluir encerra a exibição automática. Em Configurações → Ajuda para começar → Rever tutorial é possível iniciar novamente.

A configuração básica é reconhecida por nome/fuso, moeda e capital confirmado. A detecção não atribui valores e não altera dados. No modo local a preferência fica neste navegador; no modo cloud acompanha a conta pelo mecanismo de sincronização existente. Antes de o usuário cloud carregar, nenhum tour é renderizado. Troca de identidade remove a orientação anterior.

`npm run test:onboarding` verifica convite inicial, ações reais, navegação, retomar após reload, pular/concluir/rever, isolamento por conta, conta já configurada, erro de armazenamento e larguras de 320 a 1440. Na entrega inicial, as suítes do Diário opcional e World também foram executadas. Com a pausa do World, a etapa correspondente passou a apresentar o Painel; `test:world:disabled` verifica essa alteração. O build standalone inclui o guia e seus estilos.
