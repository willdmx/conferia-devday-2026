import { configuredModel } from "@/lib/openai";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ configured: Boolean(process.env.OPENAI_API_KEY?.trim()), model: configuredModel() }, { headers: { "Cache-Control": "no-store" } });
}
