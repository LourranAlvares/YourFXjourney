# Diário prático e resultados monetários

A tela relatada tinha resultado digitado e fechamento vazio. Esses registros permaneciam parciais e o cartão não exibia o resultado informado. Além disso, o leitor de valores numéricos usava `Number`, que não aceita vírgula/símbolos em texto. A correção diferencia resultado informado de operação concluída e deixa essa situação visível.

## Preenchimento

- Aceita `-5,20`, `-5.20`, `-5,20$`, `-$5.20`, unidades monetárias e agrupamentos com vírgula/ponto. Valor não vazio inválido produz erro e mantém o editor, sem virar zero/null silenciosamente.
- Botões Compra/Venda/Não sei e Ganho/Perda. Perda aplica o sinal negativo sem exigir digitar o menos no teclado do celular.
- Ativos, estratégias e setups vêm das escolhas do próprio perfil, plano e histórico. São sugestões selecionáveis; direção, resultado, preços e datas não são copiados automaticamente de outro trade.
- Encerrada agora preenche explicitamente o fechamento no fuso do perfil. Não usa a data de exportação da imagem. O registro também pode continuar salvo sem fechamento, fora das estatísticas, mostrando o resultado informado no cartão.
- Entrada, stop e alvo podem calcular direção e R:R quando os três preços formam uma posição consistente. Escolhas manuais existentes não são substituídas. Quantidade aceita sufixo de lotes; R:R/alavancagem aceitam `x`.
- Print, preços e notas ficam em seções próprias. A imagem recolhe depois de ler, a confirmação fica fora da área recolhida e o status permanece visível. Os IDs dos campos, armazenamento e fluxo atômico de salvamento são preservados.

## Prints e IA opcional

A identificação da interface passa a TV-3. O OCR local continua disponível; um resultado que contém somente ativo é anunciado como leitura parcial. Relê o print já salvo sem duplicar anexos.

Preencher com IA usa um novo endpoint autenticado, com CSRF, limite de chamadas e validação de imagem. Funciona independentemente de um Trading Plan válido. Somente ao clicar, o último print e a moeda são enviados à OpenAI, usando a conexão de IA existente; não envia histórico, plano ou emoções. O pedido usa `store:false` e resposta estruturada. Sem conexão/configuração de IA, o editor explica a indisponibilidade e mantém o fluxo local/manual.

A extração pede as etiquetas e a ferramenta de posição visível, separando entrada e cotação com cronômetro. R:R é recalculado por código quando há três preços consistentes. Quantidade, alavancagem, risco monetário e P&L exigem evidência explícita; dados ausentes ficam vazios. Números preenchidos manualmente são preservados. A confirmação do print e um fechamento conhecido continuam necessários para incluir resultado extraído no histórico financeiro. Um alvo não vira lucro realizado.

## Testes e limites

- `test:journal:practical`: perda de 5,20 com moeda/sinal, botão Perda, salvar parcial, exibir resultado, concluir com mesmo ID, recarga, erro numérico, sugestões pessoais, IA somente após clique, preservação manual e larguras 320–1440.
- Testes de backend: extração sem plano/histórico, esquema, R:R, falta de IA, resposta inválida, imagem externa recusada, autenticação, CSRF e P&L negativo explícito.
- Suítes do Diário, durabilidade, OCR local, recuperação e formato TradingView verificam os fluxos existentes. O build standalone inclui os novos controles; a IA requer servidor/conexão.

As chamadas de IA foram testadas com respostas simuladas, não com uma chave de produção. O OCR usa o Tesseract real em fixtures. Isso verifica os fluxos e a preservação, mas não mede precisão de visão em todos os prints reais. A publicação no Render precisa ser confirmada depois do push. Nenhum registro de cliente foi alterado por esses testes.
