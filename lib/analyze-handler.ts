import { analysisRequestSchema, analysisSchema, type Extraction, type Analysis } from "./schemas";
import { compareContract } from "./compare";
import { AnalysisError } from "./api-error";

type Extractor = (contract: string) => Promise<{ extraction: Extraction; meta: Analysis["meta"] }>;
const MAX_BODY_BYTES = 128_000;

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBody(request: Request) {
  if (!request.body) throw new AnalysisError("INVALID_REQUEST", "Envie o contrato e a tabela de entregas.", 400);
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new AnalysisError("REQUEST_TOO_LARGE", "O conteúdo excede o limite do MVP. Use um contrato curto com até 10 itens.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  try { return JSON.parse(text) as unknown; }
  catch { throw new AnalysisError("INVALID_JSON", "O conteúdo enviado não é um JSON válido.", 400); }
}

export async function handleAnalyze(request: Request, extract: Extractor) {
  const origin = request.headers.get("origin");
  if (origin) {
    // Next can normalize request.url to localhost even when the browser uses 127.0.0.1.
    // The browser's Host and Origin remain the authoritative pair for this check.
    const expectedOrigin = new URL(request.url);
    const host = request.headers.get("host");
    if (host) {
      expectedOrigin.port = "";
      expectedOrigin.host = host;
    }
    const protocol = request.headers.get("x-forwarded-proto");
    if (protocol === "https" || protocol === "http") expectedOrigin.protocol = `${protocol}:`;
    let allowed = false;
    try { allowed = new URL(origin).origin === expectedOrigin.origin; } catch { /* Invalid or opaque origins are rejected. */ }
    if (!allowed) return errorResponse("INVALID_ORIGIN", "Faça a conferência a partir desta aplicação.", 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return errorResponse("INVALID_CONTENT_TYPE", "Envie os dados em formato JSON.", 415);
  try {
    const parsed = analysisRequestSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse("INVALID_INPUT", parsed.error.issues[0]?.message || "Revise o contrato e os campos da tabela de entregas.", 400);
    const { contract, deliveries } = parsed.data;
    const { extraction, meta } = await extract(contract);
    const analysis = analysisSchema.parse({ ...compareContract(contract, extraction, deliveries), meta });
    return Response.json(analysis, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AnalysisError) return errorResponse(error.code, error.message, error.status);
    return errorResponse("ANALYSIS_FAILED", "Não foi possível concluir a conferência com segurança. Seus dados foram mantidos; tente novamente.", 500);
  }
}
