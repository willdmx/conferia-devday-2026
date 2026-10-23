# Conferia

**O combinado, conferido.** MVP do desafio 8 — DevDay Exchange Community Hackathon São Paulo, 23/10/2026.

Recebe um contrato fictício curto e uma tabela de entregas; usa a OpenAI para extrair o contratado, compara quantidade, prazo e valor em código e apresenta cada diferença com evidências para revisão humana. Escopo: um contrato com até dez itens. Não faz interpretação jurídica.

**Aplicação pública:** [conferia-devday-2026.vercel.app](https://conferia-devday-2026.vercel.app)  
**Código:** [willdmx/conferia-devday-2026](https://github.com/willdmx/conferia-devday-2026)  
**Entrega:** [validação executada](VALIDATION.md) · [roteiro de vídeo de 2min40s](VIDEO.md).

Fluxo público verificado em 23/10/2026, às 12h46–12h47 BRT: chamada real à OpenAI, cinco itens, três divergências, dois conformes, evidências literais e revisão preservada após recarregar. A chamada HTTP de validação não usou cookies ou autenticação.

## Executar localmente

Requisitos: Node.js 22 ou 24 e uma chave da OpenAI com acesso a Responses API e Structured Outputs.

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
# Preencha OPENAI_API_KEY em .env.local com seu editor.
npm.cmd run dev
```

Não sobrescreva `.env.local` se ele já contiver sua configuração. Abra http://127.0.0.1:3000. O modelo padrão é `gpt-4.1-mini`; `OPENAI_MODEL` permite alterá-lo. A chave fica apenas no servidor e não é solicitada na interface. `.env*` está ignorado pelo Git, exceto o exemplo vazio.

## Demonstração (60–90 segundos)

1. Clique **Carregar exemplo fictício**. Isso preenche os dados, sem simular uma chamada à IA.
2. Mostre o contrato e a tabela editável. Clique **Conferir entregas**.
3. A chamada real extrai cinco itens e o comparador encontra três diferenças:

| Item | Contratado | Entregue | Resultado |
| --- | --- | --- | --- |
| 001 — Credenciais | 120; R$ 600,00; 22/10 | Igual | Conforme |
| 002 — Kits | 50 unidades | 45 unidades | Quantidade: 5 a menos |
| 003 — Banners | Até 21/10/2026 | 23/10/2026 | Prazo: 2 dias de atraso |
| 004 — Camisetas | R$ 1.800,00 | R$ 1.980,00 | Valor: R$ 180,00 a mais |
| 005 — Placas | 10; R$ 400,00; 22/10 | Igual | Conforme |

4. Abra os trechos de evidência. Marque uma ocorrência como revisada e atualize a página para demonstrar a persistência.
5. Frase de fechamento: **“A IA lê o combinado. O código confere os números. Você revisa com a evidência na mão.”**

## CSV de entregas

Baixe o exemplo pela interface. Cabeçalho: `id;descricao;quantidade;data_entrega;valor_total`. Datas em `AAAA-MM-DD`, valores totais em reais (ex.: `1.980,00`). IDs são texto; preserve `001`. Aceita separadores ponto e vírgula ou vírgula e campos entre aspas. Há validação de datas, valores, IDs duplicados e limite de itens. Também é possível editar a tabela diretamente.

## Arquitetura e limites

- Next.js App Router, TypeScript, Tailwind CSS, Zod e SDK oficial `openai`.
- `POST /api/analyze`: valida a entrada, chama `responses.parse` com `zodTextFormat`, valida a saída e executa o comparador. `store: false`. A OpenAI recebe somente o contrato; as entregas são comparadas no servidor.
- `lib/compare.ts`: pareamento por ID exato; quantidade e valor total em centavos; atraso somente quando a data de entrega excede o prazo. Entrega antecipada é aceita.
- Uma citação só é usada quando existe literalmente no contrato. Campos ausentes, ambiguidades, IDs incertos ou evidências inválidas exigem revisão; não são tratados como conformidade. A presença literal da citação não garante que a IA extraiu tudo corretamente: o usuário pode conferir cada trecho.
- Resultado, entradas e revisões ficam no `localStorage` deste navegador. Não há banco de dados nem sincronização entre dispositivos. Alterar os dados exige nova análise, sem reaproveitar revisão de um resultado diferente. Se o armazenamento não estiver disponível, a interface informa.
- Erros de autenticação, saldo/limite, conexão, timeout e saída inválida têm mensagens explícitas. Não há fallback disfarçado de IA. `DEMO_EXTRACTION` é exclusivamente um fixture dos testes.
- Protótipo público para demonstração com dados fictícios. Não há autenticação multiusuário nem limitador distribuído. Cada análise consome a API configurada no servidor; a persistência das revisões é local ao navegador.

## Validar

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Para testar **uma chamada real** (consome API), deixe o servidor e a chave configurados:

```powershell
npm.cmd run test:live
```

Para conferir a versão pública sem carregar credenciais locais:

```powershell
$env:CONFERIA_BASE_URL='https://conferia-devday-2026.vercel.app'
node --import tsx scripts/verify-live.ts
```

O teste real verifica cinco itens, três diferenças específicas, dois conformes, evidências literais e um ID de resposta da OpenAI. Os testes unitários usam fixtures e dependência injetada, sem consumir API e sem afirmar que executaram uma chamada real.

## Publicar na Vercel

1. Envie o projeto para um repositório Git sem `.env.local`, `node_modules` ou `.next`.
2. Importe o repositório na Vercel; selecione Next.js e Node.js 24.x (ou 22.x).
3. Configure `OPENAI_API_KEY` e, opcionalmente, `OPENAI_MODEL` nas variáveis de ambiente do projeto. Nunca use prefixo `NEXT_PUBLIC_` para a chave.
4. Instalação: `npm ci`. Build: `npm run build`. A saída é a padrão do Next.js.
5. Faça o deploy e execute a demonstração no endereço publicado. A função tem duração máxima de 60 segundos; a chamada OpenAI usa timeout de 45 segundos, sem retries automáticos.

Não é necessário `vercel.json`, banco de dados ou outro serviço. Este projeto está publicado na Vercel e conectado ao repositório GitHub acima. `OPENAI_API_KEY` está configurada como segredo somente no ambiente Production. O domínio público da aplicação é acessível sem login.

Referência da integração: [Structured Outputs — documentação oficial OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
