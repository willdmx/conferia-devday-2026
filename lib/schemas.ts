import { z } from "zod";

export const MAX_ITEMS = 10;
export const MAX_CONTRACT_LENGTH = 24_000;

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

const isoDateSchema = z.string().refine(isIsoDate, "Informe uma data real no formato AAAA-MM-DD.");
const quantitySchema = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
const centsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

// Nullable fields let the model report missing information without inventing it.
// Semantic checks (including real calendar dates) happen in compareContract.
export const expectedItemSchema = z.object({
  id: z.string().nullable(),
  description: z.string().nullable(),
  quantity: quantitySchema.nullable(),
  deadline: z.string().nullable(),
  totalCents: centsSchema.nullable(),
  evidence: z.string().nullable(),
  ambiguities: z.array(z.string()),
}).strict();

export const extractionSchema = z.object({
  items: z.array(expectedItemSchema).max(MAX_ITEMS),
  warnings: z.array(z.string()),
}).strict();

export const deliverySchema = z.object({
  id: z.string().trim().min(1, "Informe o ID do item.").max(60),
  description: z.string().trim().min(1, "Informe a descrição da entrega.").max(500),
  quantity: quantitySchema,
  deliveredAt: isoDateSchema,
  totalCents: centsSchema,
}).strict();

export const deliveriesSchema = z.array(deliverySchema)
  .min(1, "Adicione pelo menos uma entrega.")
  .max(MAX_ITEMS, "O exemplo deve ter no máximo 10 entregas.")
  .superRefine((deliveries, ctx) => {
    const seen = new Set<string>();
    deliveries.forEach((delivery, index) => {
      if (seen.has(delivery.id)) {
        ctx.addIssue({ code: "custom", path: [index, "id"], message: `O ID ${delivery.id} está duplicado.` });
      }
      seen.add(delivery.id);
    });
  });

export const analysisRequestSchema = z.object({
  contract: z.string().min(1, "Cole o contrato antes de conferir.")
    .max(MAX_CONTRACT_LENGTH, "O contrato deve ter até 24.000 caracteres.")
    .refine((value) => value.trim().length > 0, "Cole o contrato antes de conferir."),
  deliveries: deliveriesSchema,
}).strict();

export const issueSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  description: z.string(),
  type: z.enum(["quantity", "deadline", "value", "review", "missing", "unexpected"]),
  title: z.string(),
  expected: z.string(),
  delivered: z.string(),
  detail: z.string(),
  contractEvidence: z.string().nullable(),
  deliveryEvidence: z.string().nullable(),
}).strict();

export const analysisSchema = z.object({
  items: z.array(expectedItemSchema).max(MAX_ITEMS),
  deliveries: deliveriesSchema,
  issues: z.array(issueSchema),
  matchedItemIds: z.array(z.string()),
  warnings: z.array(z.string()),
  meta: z.object({
    provider: z.literal("openai"),
    model: z.string().min(1),
    responseId: z.string().min(1),
    analyzedAt: z.string().datetime({ offset: true }),
  }).strict(),
}).strict();

export type ExpectedItem = z.infer<typeof expectedItemSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type Delivery = z.infer<typeof deliverySchema>;
export type Issue = z.infer<typeof issueSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
