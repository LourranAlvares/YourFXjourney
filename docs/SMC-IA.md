# Analisar um Setup com SMC IA — integração V1

A mesma rota `analyst`, atalho e tema recebem o motor Python especializado. `public/smc-analysis.js` substitui o renderer da análise genérica na rota existente, reutiliza o formulário/estilo e mantém a leitura do histórico legado. Não há outra tela de IA concorrente. O código legado permanece para leitura/revisão manual e compatibilidade de integrações antigas; não é chamado como fallback de solicitações SMC. `server/smc-engine.cjs` é somente gateway, sem regras de classificação.

## Usar

1. Abra **Analisar um Setup com SMC IA** no atalho existente.
2. Selecione os prints Macro/Micro. A lista de ativos oferece sugestões do plano/perfil/diário. Timeframe da imagem e timeframe operacional da OB são distintos; o segundo não é inferido do cabeçalho.
3. Informe a decisão real e o fuso. Marque recorte/máscaras arrastando e confirme as verificações temporais. Alterar contexto, imagem ou recorte exige rever as confirmações. Horários inexistentes/repetidos em transições de horário de verão são recusados, sem escolher um instante automaticamente.
4. Sem revisão completa, salve como pendente **neste dispositivo**. Isso não gasta com a OpenAI e não é sincronizado com outros dispositivos.
5. Ao analisar, o backend valida/reproduz o derivado e registra a solicitação antes da chamada. Acompanhe o estado ou volte ao histórico depois. Timeout não reenvia automaticamente. Não inicie outra análise para contornar uma espera.
6. Consulte classificação final, direção, critérios/limitações e rastreabilidade. Confirmação/correção humana é registrada sem apagar o original.

Sem macro revisado, o motor impede aceitar `valid`. Uma OB operacional M1 confirmada viola o mínimo M2; um print em M1 sozinho não prova que a OB seja M1. Falha de API não é setup inválido. A V1 não oferece probabilidade de lucro, preços inferidos para execução nem ordens automáticas.

## Local

Obtenha o repositório Python `LourranAlvares/SMC_ELITEBOT`, instale `.[dev,openai]` com `constraints-tested.txt` e execute `python -m smc_elite.service`. Configure as variáveis no ambiente do processo:

- Python: `SMC_SERVICE_TOKEN` (segredo aleatório, mínimo 32 caracteres), `SMC_DATA_DIR` (pasta durável), `SMC_BIND=127.0.0.1`, `PORT=8001`.
- Python: `OPENAI_API_KEY`, `SMC_DAILY_BUDGET_USD` e `SMC_USER_DAILY_BUDGET_USD`. Zero bloqueia novas chamadas pagas; não foi escolhido orçamento real por esta entrega. Revise tarifas/modelo antes da ativação.
- Node: `SMC_ENGINE_URL=http://127.0.0.1:8001`, o mesmo `SMC_SERVICE_TOKEN` e `SMC_TENANT_ID=loupply` estável.

Continue iniciando o site por `npm start`. Não envie chave/token por chat nem insira esses valores no frontend. As chaves Node do Diário/briefing continuam independentes.

## Render

O deploy do site por si só não provisiona o serviço Python. Preserve o Web Service Node atual. Crie **Private Service** do repositório Python, branch `main`, runtime Docker, mesma região/rede privada do Node, **uma instância**. Monte disco persistente em `/var/data/smc`, gravável pelo UID/GID 10001, e configure `SMC_DATA_DIR=/var/data/smc`. Health check `/live`. Não use armazenamento efêmero. Serviço privado/disco podem exigir plano pago; nenhum recurso pago foi criado nesta sessão.

Configure as variáveis do Python, depois use seu endereço **interno** como `SMC_ENGINE_URL` no Node e o mesmo token nos dois ambientes. Publique ambos. Teste primeiro com orçamento zero; somente depois configure chave/orçamento para a validação real da Fase 2. Não altere tenant nem remova a pasta de dados durante deploy. Faça backup consistente de banco + imagens e teste uma restauração.

A documentação completa de armazenamento, cotas, backup, contrato e custos está no repositório Python, `docs/INTEGRACAO-WEB.md`. Esta versão usa SQLite/WAL e um worker, sem réplicas. Cancelamentos/falhas mantêm a reserva conservadora; o custo pode ser desconhecido. A fatura do provedor prevalece. Não há exclusão automática de registros.

## Verificação reproduzível

```sh
npm test
npm run test:smc
# Playwright/Chromium instalados + Python com .[dev,openai]:
SMC_REPO=/caminho/SMC_ELITEBOT SMC_PYTHON=/caminho/.venv/bin/python npm run test:smc:integration
```

O teste de integração inicia o serviço HTTP Python real, atravessa o Node autenticado e a tela do navegador e simula **somente o transporte SDK da OpenAI**. Não testa acurácia, não faz chamadas pagas e não deve ser usado para aprovar cronologia histórica. Cobre Macro/Micro, revisão visual, rascunho, histórico após recarga, imagens privadas, correção separada, filtro sem macro e layout responsivo. Testes Python adicionais cobrem idempotência, orçamento persistente, autorização por conta, falhas, cancelamento e restart. Os 68 arquivos originais e o ZIP de referência foram preservados.

Fases seguintes (não ativadas): análise real com exemplos inéditos, ingestão/monitoramento, replay/paper, MT5 demo com risco independente e visualização de serviços. Nenhuma operação real ou reativação do World faz parte desta entrega.
