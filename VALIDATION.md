# Validação do Conferia — 23/10/2026

Validação local em Windows, Node.js 24.16.0. Horário de referência: Brasília.

| Verificação executada | Resultado |
| --- | --- |
| `npm.cmd test` | 36 testes aprovados, zero falhas, zero ignorados |
| `npm.cmd run typecheck` | Aprovado |
| `npm.cmd run build` | Aprovado; página estática e rotas dinâmicas `/api/analyze` e `/api/health` |
| `npm.cmd run test:live` | Chamada real à Responses API aprovada |
| Navegador desktop | Exemplo, extração real, três ocorrências e evidências conferidos |
| `npm.cmd run start` | Servidor de produção iniciado; extração real repetida pela interface às 11:55 BRT, com cinco itens, três ocorrências e dois conformes |
| Revisão manual | Marcação e observação mantidas após recarregar a página |
| Edição de entrega | Resultado e revisões anteriores invalidados |
| Importação CSV | Cinco linhas importadas; IDs com zeros preservados |
| Tela móvel de 390 px | Layout verificado; conteúdo sem overflow da página; tabela com rolagem interna |
| Segredo no frontend | 12 arquivos públicos do build examinados; chave local não encontrada |
| Dependências | 13 versões diretas fixadas, consistentes entre manifesto, lockfile e instalação |

## Evidência da chamada real

- Modelo solicitado: `gpt-4.1-mini`.
- Horário: 23/10/2026, 11:46:37 BRT.
- ID de resposta: `resp_00f105e3c7b23d79016adb7349c51887d1a975818628fd9544`.
- Cinco itens extraídos; IDs 001 e 005 sem divergências.
- Item 002: 50 contratados e 45 entregues.
- Item 003: prazo 21/10/2026 e entrega 23/10/2026.
- Item 004: R$ 1.800,00 contratados e R$ 1.980,00 entregues.
- Todas as citações encontradas literalmente no contrato original.

Os testes automatizados de domínio e HTTP usam fixtures/dependência injetada. A chamada identificada acima foi real, executada pelo endpoint da aplicação com o SDK oficial. A interface também foi exercitada com extração real; não existe fallback de IA simulado.

## Correções verificadas

- Revisão armazenada sem duplicação de campos TypeScript.
- Validação de origem aceita Host local normalizado pelo Next.js e domínio HTTPS atrás de proxy; rejeita origens externas, inválidas e opacas.
- Elemento acessível oculto da tabela permanece dentro de sua área de rolagem, sem alargar a página no celular.

## Publicação e validação pública

- Aplicação: https://conferia-devday-2026.vercel.app
- Repositório público: https://github.com/willdmx/conferia-devday-2026
- Vercel: projeto `solucaotodeolho/conferia-devday-2026`, vinculado ao GitHub; Node.js 24.x, preset Next.js, instalação `npm ci`, build `npm run build`.
- Deploy validado: `dpl_2BwFFBqvFHMshYQVAz6rGDkMJehR`, produção, estado **Ready**; build em infraestrutura Vercel aprovado.
- `OPENAI_API_KEY` confirmada na listagem da Vercel como **Secret / Production**, sem leitura ou exibição do valor. A configuração inicial retornou `API_AUTH`; foi corrigida pelo responsável no painel, seguida de novo deploy e validação real bem-sucedida.
- Repositório, README e árvore Git acessíveis por HTTPS sem autenticação (HTTP 200). O commit inicial `6498715fa0addaf32e525da9c1481662fd71e412` contém 30 arquivos; nenhum `.env.local`, diretório `.vercel` ou `artifacts`. `.env.example` tem chave vazia.
- Auditoria dos arquivos preparados para o commit: chave local ausente, nenhum token reconhecível ou URL com credencial. `.gitignore` e `.vercelignore` excluem arquivos sensíveis.

### Chamada real pública sem autenticação

Comando executado sem carregar `.env.local`, sem Authorization e sem cookies:

```powershell
$env:CONFERIA_BASE_URL='https://conferia-devday-2026.vercel.app'
node --import tsx scripts/verify-live.ts
```

- Resultado: `REAL_OPENAI_API_PASSED`, código de saída 0.
- Horário: **23/10/2026, 12:46:43 BRT**.
- Modelo: `gpt-4.1-mini`.
- ID real: `resp_0ed2e2c962ec1782016adb8160333487d28bd4ceb367472d70`.
- Cinco itens, exatamente três divergências: 002/quantidade, 003/prazo e 004/valor.
- Dois itens conformes: 001 e 005.
- Todas as evidências de contrato verificadas literalmente e acompanhadas pela evidência da entrega.

### Navegador na URL pública

- Página carregada sem tela de login.
- Botão de exemplo carregou o contrato e cinco entregas fictícias.
- CSV importou cinco linhas, preservando IDs com zeros.
- Nova chamada real pela interface, às **12:47 BRT**, concluiu com 5 itens, 3 ocorrências e 2 conformes; carregamento e resultado observados.
- As três ocorrências exibiram contratado, entregue, evidência literal e linha de entrega.
- Item 002 marcado como revisado, com observação “Conferido: 45 de 50 kits recebidos.”.
- Após recarregar, revisão e observação permaneceram; contador 1/3 e itens 001/005 conformes.
- Evidência visual local: `artifacts/conferia-publico.png` (arquivo de validação, ignorado pelo Git).

## Limites da validação

A persistência é local a cada navegador; o MVP trabalha somente com dados fictícios e não faz interpretação jurídica. A varredura adicional dos arquivos JS/CSS hospedados em busca do segredo não foi executada porque sua autorização foi recusada; a varredura anterior dos 12 arquivos públicos do build local e a auditoria dos arquivos Git foram concluídas. Não se afirma uma auditoria de segurança completa.

### Pendência de dependência

O `npm ci` da Vercel sinalizou **1 vulnerabilidade crítica**. `npm audit --json` nesta máquina falhou com `ECONNRESET`, portanto o alerta específico do npm não foi identificado integralmente. Separadamente, o [comunicado oficial do Next.js de 14/10/2026](https://nextjs.org/blog/nextjs-security-update-october-14-2026) inclui a versão instalada `16.4.0` e indica `16.4.1` como correção.

A tentativa de consultar o patch pelo npm falhou na rede e usou metadados antigos; a consulta direta ao registro oficial com curl também expirou (`HTTP_STATUS=000`). Nenhuma atualização foi aplicada ou afirmada como validada. O código atual não usa `use cache`, Server Actions, `next/image` ou `next/og`, e o lockfile já contém `sharp@0.35.5`; essas observações não substituem a atualização recomendada. Ação pendente: obter o patch oficial, repetir testes/typecheck/build e republicar quando o registro estiver acessível.
