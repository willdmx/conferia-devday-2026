import assert from "node:assert/strict";
import test from "node:test";
import { parseDeliveriesCsv } from "../lib/csv";
import { DEMO_CSV, DEMO_DELIVERIES } from "../lib/demo";

const HEADER = "id;descricao;quantidade;data_entrega;valor_total";

test("CSV da demonstração preserva cinco itens, IDs com zeros e centavos", () => {
  assert.deepEqual(parseDeliveriesCsv(DEMO_CSV), DEMO_DELIVERIES);
});

test("CSV pt-BR aceita CRLF, separadores e aspas escapadas dentro de descrição", () => {
  const csv = `${HEADER}\r\n001;"Caderno; modelo ""Aurora""";2;2026-10-22;1.980,01\r\n`;
  assert.deepEqual(parseDeliveriesCsv(csv), [{
    id: "001", description: 'Caderno; modelo "Aurora"', quantity: 2,
    deliveredAt: "2026-10-22", totalCents: 198_001,
  }]);
});

test("CSV com vírgulas aceita reais entre aspas", () => {
  const csv = 'id,descricao,quantidade,data_entrega,valor_total\n001,Cadernos,2,2026-10-22,"29,90"';
  assert.equal(parseDeliveriesCsv(csv)[0].totalCents, 2990);
});

test("CSV aceita BOM UTF-8 e quebra de linha dentro de campo entre aspas", () => {
  const csv = `\uFEFF${HEADER}\n001;"Caderno\nAzul";2;2026-10-22;29,90`;
  assert.equal(parseDeliveriesCsv(csv)[0].description, "Caderno\nAzul");
});

test("CSV inválido é rejeitado com erro: cabeçalho, data, valor, duplicata e aspas", () => {
  for (const csv of [
    "",
    "id;descricao\n001;Cadernos",
    `${HEADER}\n001;Cadernos;2;2026-02-30;29,90`,
    `${HEADER}\n001;Cadernos;2;2026-10-22;1.980`,
    `${HEADER}\n001;Cadernos;2;2026-10-22;29,90\n001;Cadernos;2;2026-10-22;29,90`,
    `${HEADER}\n001;"Cadernos;2;2026-10-22;29,90`,
  ]) assert.throws(() => parseDeliveriesCsv(csv), Error);
});
