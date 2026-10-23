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

## Limites da entrega

O build foi validado localmente. Não houve publicação na Vercel, criação de repositório remoto ou teste em infraestrutura hospedada. O roteiro e as variáveis necessárias para publicar estão no README. A persistência é local a cada navegador; o MVP trabalha somente com dados fictícios e não faz interpretação jurídica.
