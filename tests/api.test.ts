import assert from "node:assert/strict";
import test from "node:test";
import { handleAnalyze } from "../lib/analyze-handler";
import { AnalysisError } from "../lib/api-error";
import { DEMO_CONTRACT, DEMO_DELIVERIES, DEMO_EXTRACTION } from "../lib/demo";
import { analysisSchema } from "../lib/schemas";

const PAYLOAD = { contract: DEMO_CONTRACT, deliveries: DEMO_DELIVERIES };
const META = {
  provider: "openai" as const,
  model: "unit-test-fixture",
  responseId: "test-response-only",
  analyzedAt: "2026-10-23T12:00:00.000Z",
};

function request(body = JSON.stringify(PAYLOAD), headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/analyze", {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body,
  });
}

async function mustNotExtract(): Promise<never> {
  assert.fail("Entrada inválida não pode chamar a OpenAI.");
}

test("HTTP: fluxo completo valida a extração injetada e publica três divergências", async () => {
  let calls = 0;
  const response = await handleAnalyze(request(), async (contract) => {
    calls += 1;
    assert.equal(contract, DEMO_CONTRACT);
    return { extraction: DEMO_EXTRACTION, meta: META };
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const analysis = analysisSchema.parse(await response.json());
  assert.equal(calls, 1);
  assert.equal(analysis.issues.length, 3);
  assert.deepEqual(analysis.matchedItemIds, ["001", "005"]);
  assert.equal(analysis.meta.responseId, "test-response-only");
});

test("HTTP: JSON malformado e schema inválido retornam 400 antes da extração", async () => {
  for (const body of ["{", JSON.stringify({ ...PAYLOAD, contract: " " }), JSON.stringify({ ...PAYLOAD, deliveries: [] })]) {
    const response = await handleAnalyze(request(body), mustNotExtract);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.ok((await response.json()).error.message);
  }
});

test("HTTP: limite de corpo conta bytes UTF-8 mesmo sem Content-Length", async () => {
  const input = request("á".repeat(65_000));
  assert.equal(input.headers.get("content-length"), null);
  const response = await handleAnalyze(input, mustNotExtract);
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, "REQUEST_TOO_LARGE");
});

test("HTTP: bloqueia tipo de conteúdo incorreto e origem externa", async () => {
  for (const [headers, status] of [
    [{ "content-type": "text/plain" }, 415],
    [{ origin: "https://outra-origem.example" }, 403],
  ] as const) {
    const response = await handleAnalyze(request(undefined, headers), mustNotExtract);
    assert.equal(response.status, status);
  }
});

test("HTTP: aceita o Host do navegador quando Next normaliza a URL para localhost", async () => {
  const input = request(undefined, { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" });
  assert.equal(new URL(input.url).hostname, "localhost");
  const response = await handleAnalyze(input, async () => ({ extraction: DEMO_EXTRACTION, meta: META }));
  assert.equal(response.status, 200);
  assert.equal(analysisSchema.parse(await response.json()).issues.length, 3);
});

test("HTTP: Host presente não autoriza uma origem diferente", async () => {
  for (const origin of ["http://outra-origem.example:3000", "http://127.0.0.1:3001", "https://127.0.0.1:3000"]) {
    const response = await handleAnalyze(request(undefined, { host: "127.0.0.1:3000", origin }), mustNotExtract);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "INVALID_ORIGIN");
  }
});

test("HTTP: origens malformadas e opacas são rejeitadas", async () => {
  for (const origin of ["null", "origem-invalida", "https://", "file:///contrato.txt"]) {
    const response = await handleAnalyze(request(undefined, { host: "127.0.0.1:3000", origin }), mustNotExtract);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "INVALID_ORIGIN");
  }
});

test("HTTP: aceita mesma origem HTTPS atrás de proxy com porta interna diferente", async () => {
  const response = await handleAnalyze(request(undefined, {
    host: "conferia.example", origin: "https://conferia.example", "x-forwarded-proto": "https",
  }), async () => ({ extraction: DEMO_EXTRACTION, meta: META }));
  assert.equal(response.status, 200);
  assert.equal(analysisSchema.parse(await response.json()).issues.length, 3);
});

test("HTTP: erros conhecidos da API preservam mensagem útil e status", async () => {
  const response = await handleAnalyze(request(), async () => {
    throw new AnalysisError("API_LIMIT", "Limite de uso da API atingido.", 429);
  });
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), {
    error: { code: "API_LIMIT", message: "Limite de uso da API atingido." },
  });
});

test("HTTP: falha interna não vaza detalhes técnicos ou segredos", async () => {
  const response = await handleAnalyze(request(), async () => {
    throw new Error("token=SECRET_UNIT_TEST_ONLY; database connection stack trace");
  });
  assert.equal(response.status, 500);
  const body = await response.text();
  assert.ok(body.includes("ANALYSIS_FAILED"));
  assert.ok(!body.includes("SECRET_UNIT_TEST_ONLY"));
  assert.ok(!body.includes("stack trace"));
});
