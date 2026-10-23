import "server-only";
import { handleAnalyze } from "@/lib/analyze-handler";
import { extractContract } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleAnalyze(request, extractContract);
}
