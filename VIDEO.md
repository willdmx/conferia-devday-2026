# Roteiro de vídeo — Conferia

Duração prevista: **2 minutos e 40 segundos**. Participação individual no desafio 8 do DevDay Exchange Community Hackathon São Paulo, em 23/10/2026.

Repositório: [willdmx/conferia-devday-2026](https://github.com/willdmx/conferia-devday-2026).

## Preparação da gravação

- Grave na aplicação pública [conferia-devday-2026.vercel.app](https://conferia-devday-2026.vercel.app). O fluxo foi verificado na versão publicada em 23/10/2026, às 12h46–12h47 BRT, incluindo chamada real, evidências e revisão após recarregar.
- Comece com a interface aberta, sem resultados. Deixe a janela do navegador e o texto legíveis.
- Grave o clique em **Conferir entregas** e a resposta da chamada real à OpenAI. Carregar o exemplo apenas preenche os campos; não executa nem simula a análise.
- Se a chamada levar mais tempo que o previsto, corte somente a espera e exiba a indicação **“Espera da API abreviada na edição”**. Preserve o clique, o carregamento e o resultado real.
- Grave apenas a interface do produto; não mostre arquivos de configuração ou a chave da API.

## Roteiro de 2min40s

| Tempo | Ação na tela | Narração |
| --- | --- | --- |
| **0:00–0:18** | Mostrar a tela inicial e o nome Conferia. | “Contrato numa aba, planilha em outra: descobrir o que foi entregue diferente do combinado ainda exige uma conferência manual. Para o desafio oito, desenvolvi o Conferia: o combinado, conferido.” |
| **0:18–0:40** | Clicar em **Carregar exemplo fictício**. Mostrar o contrato e as cinco linhas da tabela. | “Preparei um exemplo com um contrato fictício de cinco itens. De um lado está o que foi contratado; do outro, o que realmente chegou. Posso editar a tabela diretamente ou importar um CSV. Carregar o exemplo só preenche os dados: a análise ainda não aconteceu.” |
| **0:40–1:00** | Clicar em **Conferir entregas** e mostrar o carregamento. | “Agora executo uma chamada real à OpenAI. A IA extrai os itens do contrato em uma estrutura validada. Depois, código compara quantidade, prazo e valor. A diferença não depende da opinião do modelo.” |
| **1:00–1:35** | Mostrar o resumo: **5 itens, 3 ocorrências e 2 conformes**. Percorrer as três ocorrências. | “Encontrei exatamente três diferenças. No item 002, foram contratados cinquenta kits e entregues quarenta e cinco: faltam cinco. No item 003, o prazo era vinte e um de outubro e a entrega ocorreu no dia vinte e três: dois dias de atraso. No item 004, o valor passou de mil e oitocentos para mil novecentos e oitenta reais: cento e oitenta reais a mais. Os itens 001 e 005 estão conformes.” |
| **1:35–1:55** | Mostrar a evidência do item 002, os valores contratado e entregue e a referência à tabela. | “Aqui posso ver o contratado, o entregue e o trecho original que sustenta a comparação. O sistema verifica se essa citação existe literalmente no contrato. Assim, consigo conferir a origem da informação antes de registrar minha revisão.” |
| **1:55–2:20** | Marcar o item 002 como revisado. Adicionar a observação **“Conferido: 45 de 50 kits recebidos.”** Recarregar a página e mostrar a revisão e a nota preservadas. | “A decisão continua comigo. Posso registrar uma observação e marcar esta ocorrência como revisada. Vou atualizar a página. A revisão e a observação continuam aqui, salvas neste navegador.” |
| **2:20–2:40** | Encerrar com os resultados, o contador de revisão e os dois itens conformes visíveis. | “Com o Conferia, transformei uma comparação dispersa numa lista clara de pendências com evidências. Limitei este MVP a um contrato fictício de até dez itens, sem interpretação jurídica. A IA lê o combinado. O código confere os números. Eu reviso com a evidência na mão.” |

## CSV opcional

Nos primeiros 40 segundos, mostre rapidamente os botões **Modelo CSV** e **Importar CSV**, se houver tempo. O fluxo de importação de cinco linhas e a preservação dos IDs com zeros foram verificados também na versão pública.

Não importe uma nova tabela ao final da gravação: alterar as entradas invalida corretamente os resultados e as revisões anteriores. Termine mostrando a conferência real e a revisão preservada.

## Critério de conclusão

O vídeo deve mostrar o contrato e as cinco entregas, o clique que inicia a análise real, as três diferenças com evidências, os dois itens conformes e uma revisão mantida após recarregar a página. Mantenha o vídeo final abaixo de três minutos e não atribua ao ambiente publicado uma validação que só tenha sido executada localmente.
