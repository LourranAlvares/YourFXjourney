# Backend opcional do Trade Assistant

Node.js 22.17+ (ou 24+) e nenhum pacote externo. Na raiz do repositório:

```sh
# Defina as variáveis no ambiente do processo, sem incluí-las no frontend ou Git.
node server/index.cjs
```

O processo lê:

- `TRADE_ASSISTANT_PASSWORD`: senha do proprietário, mínimo de 12 caracteres. Ausente: login/serviços online desativados.
- `TRADE_AI_KEY`: chave da API OpenAI Responses. Opcional; sem ela, a análise por IA fica indisponível.
- `TRADE_AI_MODEL`: padrão `gpt-4.1-mini`, deve suportar imagem e structured outputs.
- `TRADE_ECONOMIC_KEY`: chave Financial Modeling Prep com acesso ao endpoint stable/economic-calendar.
- `TRADE_MARKET_KEY`: chave Twelve Data com acesso a time_series.
- `HOST` e `PORT`: padrão 127.0.0.1 e 8080.
- `TRADE_ALLOWED_ORIGIN`: obrigatório para escutar fora do loopback; origem exata, por exemplo `https://assistente.example.com`, sem caminho. Configure um proxy HTTPS que preserve o cabeçalho Host. Origens públicas HTTP são recusadas.
- `TRADE_COOKIE_SECURE=true`: ativa Secure explicitamente; uma origem HTTPS já o ativa automaticamente, sem possibilidade de desativá-lo para essa origem. Não configure credenciais em páginas públicas, URL da aplicação ou localStorage.

Este backend é para **um proprietário por instância**. Os trades, planos, correções e histórico existentes permanecem no armazenamento do navegador. Não há cadastro multiusuário nem armazenamento compartilhado de contas no servidor. Uma implantação multiusuário exige banco e autenticação adequados antes de compartilhar dados entre pessoas. Sessões expiram em 8h e são invalidadas ao reiniciar. A senha é comparada com scrypt e não é enviada ao navegador; o cookie é HttpOnly/SameSite=Strict, com CSRF nos endpoints de escrita.

## Endpoints

- GET `/api/status`: autenticação, CSRF da sessão atual e disponibilidade de configurações (sem segredos).
- POST `/api/login` com `{password}`: autentica e retorna CSRF. Limite de tentativas por IP.
- POST `/api/logout` com `X-CSRF-Token`.
- POST `/api/briefing` com `X-CSRF-Token` e `{plan:null|plano,profile?,facts:[{id,text}]}`: seleciona até três fatos fornecidos e gera uma ação curta. Aceita de um a doze fatos agregados, sem imagens nem histórico bruto. O texto dos fatos retornados é reconstruído dos originais; IDs inventados, números/porcentagens na ação e respostas inválidas são recusados. Compartilha chave, cache, deduplicação e quota com a análise de setups.
- POST `/api/analyse` com `X-CSRF-Token` e `{plan,image:{dataUrl},context:{asset,timeframe,bias,macroContext,entryRegion,plannedRR?,plannedRisk?},profile?:{timezone,session:{enabled,timezone,start,end,days,label}}}`.
- GET `/api/economic-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&currencies=USD,GBP&timezone=Europe/London`.
- GET `/api/market-conditions?symbols=EUR/USD,GBP/USD&timezone=Europe/London`.

A análise aceita PNG/JPEG/WebP, até 6 MB e 24 megapixels. A OpenAI recebe somente o plano, contexto e imagem que o usuário solicita analisar. A chamada usa `store:false`; políticas de retenção e cobrança do provedor continuam aplicáveis. A resposta é validada por esquema e IDs de critérios; o resultado ponderado é calculado pelo engine compartilhado em `public/plan-engine.js`. A porcentagem mede aderência ao plano, nunca chance de lucro. A sessão é verificada com o relógio do servidor e a configuração válida do perfil, incluindo fuso IANA/horário de verão. Notícias usam eventos reais do calendário e as janelas do plano para as moedas do ativo; sem chave, dados ou impacto inequívoco, o critério permanece não verificável. Booleans de sessão/notícias enviados livremente pelo frontend não são aceitos como prova. Níveis visuais são sugestões extraídas, não execução de ordens. Risco monetário extraído não é convertido automaticamente em percentual de conta.

O cache de análise dura 10 minutos, é limitado e isolado por sessão; armazena só a resposta, nunca a imagem. A chave é um hash de plano/contexto/imagem/modelo. Chamadas iguais simultâneas compartilham a mesma requisição. Há no máximo duas chamadas de IA simultâneas e vinte solicitações de análise por hora por instância/proprietário; abrir outra sessão não contorna esse limite. Caches econômicos duram 5 minutos; séries horárias duram 1 minuto. Ausência de chaves ou falha do provedor resulta em estado indisponível, nunca dados de demonstração.

## Volatilidade

A classificação é uma regra descritiva, não uma previsão: média dos true ranges das últimas 14 velas horárias, dividida pelo último fechamento ×100. Baixa: <0,15%; moderada: 0,15% a <0,5%; alta: ≥0,5%. Dados com mais de quatro horas são explicitamente marcados como atrasados. Instrumentos indisponíveis ou menos de 15 candles válidos ficam sem classificação. Esses limites são gerais e não comparam instrumentos com distribuições diferentes como se fossem equivalentes.

## Verificação

```sh
node --test server/tests/*.test.cjs
```

Os testes usam provedores simulados injetados, sem chaves reais nem chamadas faturadas. Disponibilidade e permissões das APIs reais só podem ser verificadas com credenciais válidas. Nenhuma chave é incluída no repositório.
