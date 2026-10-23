import assert from "node:assert/strict";
import { DEMO_CONTRACT, DEMO_DELIVERIES } from "../lib/demo";
import { analysisSchema } from "../lib/schemas";

async function main() {
  const baseUrl = process.env.CONFERIA_BASE_URL || "http://127.0.0.1:3000";
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contract: DEMO_CONTRACT, deliveries: DEMO_DELIVERIES }),
    signal: AbortSignal.timeout(70_000),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = body as { error?: { code?: string; message?: string } };
    throw new Error(`HTTP ${response.status}: ${error.error?.code || "UNKNOWN"} — ${error.error?.message || "Análise indisponível"}`);
  }
  const result = analysisSchema.parse(body);
  assert.equal(result.meta.provider, "openai");
  assert.ok(result.meta.responseId.startsWith("resp_"));
  assert.equal(result.items.length, 5, "Devem existir exatamente cinco itens extraídos");
  assert.equal(result.issues.length, 3, "A semente deve produzir exatamente três divergências");
  assert.deepEqual(result.issues.map(issue => `${issue.itemId}:${issue.type}`).sort(), ["002:quantity", "003:deadline", "004:value"]);
  assert.deepEqual([...result.matchedItemIds].sort(), ["001", "005"]);
  for (const issue of result.issues) {
    assert.ok(issue.contractEvidence && DEMO_CONTRACT.includes(issue.contractEvidence), "Evidência precisa existir literalmente no contrato");
    assert.ok(issue.deliveryEvidence, "A linha entregue deve acompanhar a evidência contratual");
  }
  console.log(JSON.stringify({
    verification: "REAL_OPENAI_API_PASSED",
    model: result.meta.model,
    responseId: result.meta.responseId,
    analyzedAt: result.meta.analyzedAt,
    items: result.items.length,
    issues: result.issues.map(({ itemId, type, expected, delivered }) => ({ itemId, type, expected, delivered })),
    matchedItemIds: result.matchedItemIds,
    exactEvidenceVerified: true,
  }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Falha na verificação real."); process.exitCode = 1; });
