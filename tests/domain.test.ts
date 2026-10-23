import assert from "node:assert/strict";
import test from "node:test";
import { zodTextFormat } from "openai/helpers/zod";
import { compareContract } from "../lib/compare";
import { DEMO_CONTRACT, DEMO_DELIVERIES, DEMO_EXTRACTION } from "../lib/demo";
import { parseMoneyToCents } from "../lib/format";
import {
  analysisRequestSchema,
  deliverySchema,
  extractionSchema,
  type Delivery,
  type ExpectedItem,
  type Extraction,
} from "../lib/schemas";

const CONTRACT = "Item 001 — Cadernos | quantidade: 10 | prazo: 2026-10-22 | valor total: R$ 1.299,00.";
const ITEM: ExpectedItem = {
  id: "001", description: "Cadernos", quantity: 10,
  deadline: "2026-10-22", totalCents: 129_900,
  evidence: CONTRACT, ambiguities: [],
};
const DELIVERY: Delivery = {
  id: "001", description: "Cadernos", quantity: 10,
  deliveredAt: "2026-10-22", totalCents: 129_900,
};

test("schema de extração é convertível para Structured Outputs pelo SDK oficial", () => {
  const format = zodTextFormat(extractionSchema, "contract_extraction");
  assert.equal(format.type, "json_schema");
  assert.equal(format.strict, true);
  const schema = format.schema as { type: string; required: string[]; additionalProperties: boolean };
  assert.equal(schema.type, "object");
  assert.deepEqual([...schema.required].sort(), ["items", "warnings"]);
  assert.equal(schema.additionalProperties, false);
});

function analyze(item: Partial<ExpectedItem> = {}, delivered: Partial<Delivery> = {}) {
  return compareContract(CONTRACT, { items: [{ ...ITEM, ...item }], warnings: [] }, [{ ...DELIVERY, ...delivered }]);
}

function assertReview(result: ReturnType<typeof analyze>) {
  assert.ok(result.issues.some((issue) => issue.type === "review"));
  assert.deepEqual(result.matchedItemIds, []);
  assert.ok(result.issues.every((issue) => !["quantity", "deadline", "value"].includes(issue.type)));
}

test("demo: cinco itens geram somente as três divergências previstas e evidências exatas", () => {
  assert.equal(extractionSchema.parse(DEMO_EXTRACTION).items.length, 5);
  analysisRequestSchema.parse({ contract: DEMO_CONTRACT, deliveries: DEMO_DELIVERIES });
  const result = compareContract(DEMO_CONTRACT, DEMO_EXTRACTION, DEMO_DELIVERIES);
  assert.deepEqual(result.issues.map(({ itemId, type }) => [itemId, type]), [
    ["002", "quantity"], ["003", "deadline"], ["004", "value"],
  ]);
  assert.deepEqual([...result.matchedItemIds].sort(), ["001", "005"]);
  for (const issue of result.issues) {
    assert.ok(issue.contractEvidence && DEMO_CONTRACT.includes(issue.contractEvidence));
    assert.ok(issue.deliveryEvidence);
  }
});

test("quantidade, data e valor iguais não geram ocorrência", () => {
  const result = analyze();
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.matchedItemIds, ["001"]);
});

test("entrega antecipada é aceita como conforme", () => {
  const result = analyze({}, { deliveredAt: "2026-10-01" });
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.matchedItemIds, ["001"]);
});

test("quantidade menor e maior que a contratada são divergências", () => {
  for (const quantity of [9, 11]) {
    assert.deepEqual(analyze({}, { quantity }).issues.map((issue) => issue.type), ["quantity"]);
  }
});

test("diferença de um centavo é detectada sem arredondamento", () => {
  for (const totalCents of [129_899, 129_901]) {
    assert.deepEqual(analyze({}, { totalCents }).issues.map((issue) => issue.type), ["value"]);
  }
});

test("atraso de um dia gera exclusivamente ocorrência de prazo", () => {
  const result = analyze({}, { deliveredAt: "2026-10-23" });
  assert.deepEqual(result.issues.map((issue) => issue.type), ["deadline"]);
  assert.deepEqual(result.matchedItemIds, []);
});

test("identificador da ocorrência é estável e muda quando os dados da entrega mudam", () => {
  const first = analyze({}, { quantity: 9 }).issues[0].id;
  assert.equal(analyze({}, { quantity: 9 }).issues[0].id, first);
  assert.notEqual(analyze({}, { quantity: 8 }).issues[0].id, first);
  assert.notEqual(analyze({}, { quantity: 9, totalCents: 129_901 }).issues[0].id, first);
});

test("campos contratuais ausentes exigem revisão sem inventar comparação", () => {
  for (const field of ["id", "description", "quantity", "deadline", "totalCents", "evidence"] as const) {
    const item = { ...ITEM, [field]: null };
    assert.equal(extractionSchema.safeParse({ items: [item], warnings: [] }).success, true);
    assertReview(analyze(item));
  }
});

test("ambiguidade explícita exige revisão e impede falso conforme", () => {
  assertReview(analyze({ ambiguities: ["O prazo depende de uma data não informada."] }));
});

test("evidência fabricada ou alterada não é aceita como prova do contrato", () => {
  for (const evidence of ["O fornecedor entregará dez cadernos.", CONTRACT.replace("Cadernos", "CADERNOS")]) {
    const result = analyze({ evidence });
    assertReview(result);
    assert.ok(result.issues.every((issue) => !issue.contractEvidence || CONTRACT.includes(issue.contractEvidence)));
  }
});

test("data contratual impossível exige revisão", () => {
  for (const deadline of ["2026-02-30", "2026-13-01", "22/10/2026", "2025-02-29"]) {
    assertReview(analyze({ deadline }));
  }
});

test("IDs contratuais duplicados exigem revisão sem item conforme", () => {
  const extraction: Extraction = { items: [ITEM, { ...ITEM }], warnings: [] };
  assertReview(compareContract(CONTRACT, extraction, [DELIVERY]));
});

test("IDs duplicados nas entregas são rejeitados na entrada", () => {
  const result = analysisRequestSchema.safeParse({ contract: CONTRACT, deliveries: [DELIVERY, { ...DELIVERY }] });
  assert.equal(result.success, false);
});

test("item contratado sem entrega gera ocorrência missing", () => {
  const result = compareContract(DEMO_CONTRACT, DEMO_EXTRACTION, DEMO_DELIVERIES.filter((item) => item.id !== "001"));
  assert.ok(result.issues.some((issue) => issue.itemId === "001" && issue.type === "missing"));
  assert.ok(!result.matchedItemIds.includes("001"));
});

test("entrega de ID não contratado gera ocorrência unexpected", () => {
  const result = compareContract(CONTRACT, { items: [ITEM], warnings: [] }, [DELIVERY, { ...DELIVERY, id: "999" }]);
  assert.deepEqual(result.issues.map(({ itemId, type }) => [itemId, type]), [["999", "unexpected"]]);
  assert.deepEqual(result.matchedItemIds, ["001"]);
});

test("extração vazia é válida e produz revisão, nunca sucesso sem ressalvas", () => {
  const extraction = extractionSchema.parse({ items: [], warnings: ["Nenhum item identificável."] });
  const result = compareContract(CONTRACT, extraction, [DELIVERY]);
  assertReview(result);
  assert.ok(result.warnings.includes("Nenhum item identificável."));
});

test("entrada rejeita contrato vazio, datas impossíveis, negativos e centavos fracionários", () => {
  assert.equal(analysisRequestSchema.safeParse({ contract: " \n ", deliveries: [DELIVERY] }).success, false);
  for (const deliveredAt of ["2026-02-30", "2026-00-01", "2025-02-29", "2026-10-22T00:00:00Z"]) {
    assert.equal(deliverySchema.safeParse({ ...DELIVERY, deliveredAt }).success, false);
  }
  assert.equal(deliverySchema.safeParse({ ...DELIVERY, deliveredAt: "2024-02-29" }).success, true);
  for (const patch of [{ quantity: -1 }, { quantity: Infinity }, { totalCents: -1 }, { totalCents: 100.5 }]) {
    assert.equal(deliverySchema.safeParse({ ...DELIVERY, ...patch }).success, false);
  }
});

test("contrato e entregas respeitam o limite de dez itens", () => {
  const deliveries = Array.from({ length: 10 }, (_, index) => ({ ...DELIVERY, id: String(index).padStart(3, "0") }));
  const items = deliveries.map(({ id }) => ({ ...ITEM, id }));
  assert.equal(analysisRequestSchema.safeParse({ contract: CONTRACT, deliveries }).success, true);
  assert.equal(extractionSchema.safeParse({ items, warnings: [] }).success, true);
  assert.equal(analysisRequestSchema.safeParse({ contract: CONTRACT, deliveries: [...deliveries, { ...DELIVERY, id: "999" }] }).success, false);
  assert.equal(extractionSchema.safeParse({ items: [...items, { ...ITEM, id: "999" }], warnings: [] }).success, false);
});

test("valores em reais são convertidos exatamente para centavos", () => {
  for (const [input, expected] of [["1.980,00", 198_000], ["R$ 1980,01", 198_001], ["1980.01", 198_001], ["0,29", 29], ["12,5", 1250], ["0", 0]] as const) {
    assert.equal(parseMoneyToCents(input), expected);
  }
});

test("valores monetários ambíguos ou inválidos não são arredondados silenciosamente", () => {
  for (const input of ["1.980", "1,980", "1.23,45", "-2,00", "NaN", "", "9007199254740992,00"]) {
    assert.throws(() => parseMoneyToCents(input), Error);
  }
});
