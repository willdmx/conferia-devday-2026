import type { Delivery, Extraction } from "./schemas";

const lines = [
  "Item 001 — Credenciais personalizadas | quantidade: 120 | prazo: 2026-10-22 | valor total: R$ 600,00.",
  "Item 002 — Kits de boas-vindas | quantidade: 50 | prazo: 2026-10-22 | valor total: R$ 2.500,00.",
  "Item 003 — Banners de sinalização | quantidade: 4 | prazo: 2026-10-21 | valor total: R$ 1.200,00.",
  "Item 004 — Camisetas da equipe | quantidade: 30 | prazo: 2026-10-22 | valor total: R$ 1.800,00.",
  "Item 005 — Placas de identificação | quantidade: 10 | prazo: 2026-10-22 | valor total: R$ 400,00.",
];

export const DEMO_CONTRACT = `CONTRATO FICTÍCIO — MATERIAIS PARA EVENTO\n\nA organização fictícia Aurora Eventos contrata a fornecedora fictícia Oficina Horizonte para entregar os cinco itens abaixo. Cada valor corresponde ao total do item, em reais. As datas indicam o prazo máximo de entrega.\n\n${lines.join("\n")}\n\nValor total contratado: R$ 6.500,00.\nDocumento criado exclusivamente para demonstração, sem dados pessoais reais.`;

export const DEMO_DELIVERIES: Delivery[] = [
  { id: "001", description: "Credenciais personalizadas", quantity: 120, deliveredAt: "2026-10-22", totalCents: 60_000 },
  { id: "002", description: "Kits de boas-vindas", quantity: 45, deliveredAt: "2026-10-22", totalCents: 250_000 },
  { id: "003", description: "Banners de sinalização", quantity: 4, deliveredAt: "2026-10-23", totalCents: 120_000 },
  { id: "004", description: "Camisetas da equipe", quantity: 30, deliveredAt: "2026-10-22", totalCents: 198_000 },
  { id: "005", description: "Placas de identificação", quantity: 10, deliveredAt: "2026-10-22", totalCents: 40_000 },
];

// Deterministic test fixture. Never used as a substitute for an API response.
export const DEMO_EXTRACTION: Extraction = {
  items: DEMO_DELIVERIES.map((delivery, index) => ({
    id: delivery.id,
    description: delivery.description,
    quantity: delivery.id === "002" ? 50 : delivery.quantity,
    deadline: delivery.id === "003" ? "2026-10-21" : "2026-10-22",
    totalCents: delivery.id === "004" ? 180_000 : delivery.totalCents,
    evidence: lines[index],
    ambiguities: [],
  })),
  warnings: [],
};

export const DEMO_CSV = `id;descricao;quantidade;data_entrega;valor_total\n001;Credenciais personalizadas;120;2026-10-22;600,00\n002;Kits de boas-vindas;45;2026-10-22;2500,00\n003;Banners de sinalização;4;2026-10-23;1200,00\n004;Camisetas da equipe;30;2026-10-22;1980,00\n005;Placas de identificação;10;2026-10-22;400,00`;
