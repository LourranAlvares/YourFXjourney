# Leitura local de prints — revisão

O relato mostrava a leitura encerrando com zero campos. Sem o print original, não é possível reproduzir exatamente aquela imagem. A revisão identificou duas limitações verificáveis do código: reconhecimento dependente de rótulos muito específicos e busca de preços limitada aos últimos 110 pixels, que falha quando uma barra lateral desloca a escala do gráfico.

## Mudanças

- `public/shot-reader.js` amplia o parser com separadores opcionais, pares com espaços/barras/letras minúsculas, identificação explícita fora do cabeçalho, nomes de ouro/prata e rótulos unidos pelo OCR. Valores conflitantes continuam sem preenchimento.
- O OCR local usa segmentação de texto esparso, uma leitura ampliada do cabeçalho quando falta o ativo e uma tentativa com contraste/ampliação quando os preços não foram identificados. As passagens são sequenciais e limitadas; os modelos locais existentes são reutilizados.
- O detector procura rótulos coloridos em regiões adicionais da imagem e ajusta o recorte quando há uma barra lateral à direita. Exige uma configuração de posição consistente e não usa a cotação atual como entrada.
- Campos de operação reconhecidos ficam visíveis no editor. Zero campos produz uma mensagem de identificação insuficiente, em vez de anunciar sucesso.
- A imagem continua anexada e pode ser salva sem campos. Dados digitados não são substituídos. Fechamento e P&L não são inferidos a partir do alvo ou de lucro aberto.
- Imagens decodificadas são limitadas a 6 milhões de pixels; a passagem de contraste a 5 milhões, evitando ampliação sem limite. Timeouts e cancelamento por registro impedem preenchimento tardio em outro editor.

## Verificação

- `npm run test:ocr:charts`: parser flexível e ouro, OCR Tesseract real em gráficos de teste claros/escuros com escala deslocada, entrada/stop/alvo/direção, cotação atual ignorada, campos visíveis, salvamento só do print, resposta clara quando nada é reconhecido e nenhum envio externo.
- `npm run test:ocr`: oito verificações de extração, ambiguidade, registro opcional e uso no celular.
- `npm run test:ocr:recovery`: arquivo inválido, OCR indisponível, nova tentativa, salvar durante leitura, resposta atrasada e timeout.
- `npm run test:diary`: persistência e regressão do Diário.
- `npm test`: motores e 45 testes do servidor passaram.

Os gráficos utilizados são fixtures geradas em canvas, processadas pelo OCR real local. Não medem uma taxa de acerto em prints reais diversos, e não substituem a validação da imagem original do usuário. O leitor exige texto e níveis visíveis; números sem rótulos inequívocos continuam exigindo revisão. O World continua pausado e nenhuma dependência externa foi adicionada. O build standalone inclui a mesma melhoria.
