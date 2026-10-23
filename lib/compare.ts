import { formatCurrency, formatDate } from "./format";
import { isIsoDate, type Analysis, type Delivery, type ExpectedItem, type Extraction, type Issue } from "./schemas";

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 20 });
const number = (value: number) => numberFormatter.format(value);
const normalizedId = (id: string | null) => id?.trim() || null;
const verifiedEvidence = (contract: string, item: ExpectedItem) =>
  item.evidence?.trim() && contract.includes(item.evidence) ? item.evidence : null;

function stableHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let i = 0; i < value.length; i += 1) {
    first = Math.imul(first ^ value.charCodeAt(i), 0x01000193);
    second = Math.imul(second ^ value.charCodeAt(i), 0x85ebca6b);
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}

function deliveryEvidence(delivery: Delivery): string {
  return `Entrega ${delivery.id} | ${delivery.description} | quantidade: ${number(delivery.quantity)} | data: ${delivery.deliveredAt} | valor total: ${formatCurrency(delivery.totalCents)}`;
}

function expectedSummary(item: ExpectedItem): string {
  return `${number(item.quantity!)} unidades · até ${formatDate(item.deadline!)} · ${formatCurrency(item.totalCents!)}`;
}

function deliverySummary(delivery: Delivery): string {
  return `${number(delivery.quantity)} unidades · ${formatDate(delivery.deliveredAt)} · ${formatCurrency(delivery.totalCents)}`;
}

/** Only exact IDs and independently verified, complete contract items can be compared. */
export function compareContract(
  contract: string,
  extraction: Extraction,
  deliveries: Delivery[],
): Omit<Analysis, "meta"> {
  const issues: Issue[] = [];
  const matchedItemIds: string[] = [];
  const expectedCounts = new Map<string, number>();
  const deliveredById = new Map<string, Delivery[]>();
  const consumedIds = new Set<string>();

  for (const item of extraction.items) {
    const id = normalizedId(item.id);
    if (id) expectedCounts.set(id, (expectedCounts.get(id) ?? 0) + 1);
  }
  for (const delivery of deliveries) {
    const id = delivery.id.trim();
    deliveredById.set(id, [...(deliveredById.get(id) ?? []), delivery]);
  }

  function addIssue(issue: Omit<Issue, "id">, context: unknown = null) {
    issues.push({ ...issue, id: `occ-${stableHash(JSON.stringify([issue, context]))}` });
  }

  const hasUnidentifiedItems = extraction.items.length === 0 || extraction.items.some((item) =>
    !normalizedId(item.id) || !verifiedEvidence(contract, item) || item.ambiguities.some((ambiguity) => ambiguity.trim()),
  );

  if (extraction.items.length === 0) {
    addIssue({
      itemId: "Sem ID", description: "Contrato sem itens identificáveis", type: "review",
      title: "Revise o conteúdo do contrato", expected: "Itens identificáveis no contrato",
      delivered: `${deliveries.length} entrega(s) informada(s)`,
      detail: "A extração não identificou itens. Não é possível concluir se as entregas correspondem ao contrato.",
      contractEvidence: null, deliveryEvidence: null,
    }, contract);
  }

  extraction.items.forEach((item, index) => {
    const id = normalizedId(item.id);
    const evidence = verifiedEvidence(contract, item);
    const rows = id ? deliveredById.get(id) ?? [] : [];
    const delivery = rows.length === 1 ? rows[0] : undefined;
    if (id) consumedIds.add(id);
    const reasons: string[] = [];
    if (!id) reasons.push("O ID não foi informado de forma inequívoca.");
    if (!item.description?.trim()) reasons.push("A descrição não está informada.");
    if (item.quantity === null || !Number.isFinite(item.quantity) || item.quantity < 0) reasons.push("A quantidade não está informada de forma válida.");
    if (item.deadline === null || !isIsoDate(item.deadline)) reasons.push("O prazo não está informado como uma data válida.");
    if (item.totalCents === null || !Number.isSafeInteger(item.totalCents) || item.totalCents < 0) reasons.push("O valor total não está informado em centavos válidos.");
    if (!evidence) reasons.push("A evidência está ausente ou não foi encontrada literalmente no contrato original.");
    if (id && (expectedCounts.get(id) ?? 0) > 1) reasons.push("O ID aparece mais de uma vez nos itens do contrato.");
    if (rows.length > 1) reasons.push("Há mais de uma entrega com o mesmo ID.");
    reasons.push(...item.ambiguities.filter((ambiguity) => ambiguity.trim()));

    const base = {
      itemId: id ?? "Sem ID", description: item.description?.trim() || "Item a identificar",
      contractEvidence: evidence,
      deliveryEvidence: delivery ? deliveryEvidence(delivery) : null,
    };

    if (reasons.length > 0) {
      addIssue({
        ...base, type: "review", title: "Informações precisam de revisão",
        expected: "Confirmação manual necessária",
        delivered: delivery ? deliverySummary(delivery) : rows.length > 1 ? "ID duplicado nas entregas" : "Sem correspondência inequívoca",
        detail: reasons.join(" "),
      }, [item, rows, index]);
      return;
    }

    if (!delivery) {
      addIssue({
        ...base, type: "missing", title: "Entrega não registrada",
        expected: expectedSummary(item), delivered: "Nenhuma entrega com este ID",
        detail: `Não há uma linha de entrega com o ID ${id}. A correspondência usa o ID exato de cada item.`,
      }, item);
      return;
    }

    const issueCountBefore = issues.length;
    if (item.quantity !== delivery.quantity) {
      const difference = delivery.quantity - item.quantity!;
      addIssue({
        ...base, type: "quantity", title: "Quantidade divergente",
        expected: `${number(item.quantity!)} unidades`, delivered: `${number(delivery.quantity)} unidades`,
        detail: `${number(Math.abs(difference))} unidade(s) ${difference < 0 ? "a menos" : "a mais"} em relação ao contratado.`,
      }, [item, delivery]);
    }
    if (delivery.deliveredAt > item.deadline!) {
      const days = Math.round((Date.parse(`${delivery.deliveredAt}T00:00:00Z`) - Date.parse(`${item.deadline}T00:00:00Z`)) / 86_400_000);
      addIssue({
        ...base, type: "deadline", title: "Entrega após o prazo",
        expected: `Até ${formatDate(item.deadline!)}`, delivered: formatDate(delivery.deliveredAt),
        detail: `Entrega registrada ${days} dia(s) após o prazo informado no contrato.`,
      }, [item, delivery]);
    }
    if (item.totalCents !== delivery.totalCents) {
      const difference = delivery.totalCents - item.totalCents!;
      addIssue({
        ...base, type: "value", title: "Valor divergente",
        expected: formatCurrency(item.totalCents!), delivered: formatCurrency(delivery.totalCents),
        detail: `O valor registrado é ${formatCurrency(Math.abs(difference))} ${difference > 0 ? "maior" : "menor"} que o total contratado para o item.`,
      }, [item, delivery]);
    }
    if (issues.length === issueCountBefore && id) matchedItemIds.push(id);
  });

  for (const [id, rows] of deliveredById) {
    if (consumedIds.has(id) || extraction.items.length === 0) continue;
    const uncertain = hasUnidentifiedItems || rows.length > 1;
    const delivery = rows[0];
    addIssue({
      itemId: id, description: delivery.description,
      type: uncertain ? "review" : "unexpected",
      title: uncertain ? "Confirme a correspondência do item" : "Item sem correspondência no contrato",
      expected: "ID não localizado entre os itens extraídos",
      delivered: rows.length > 1 ? "ID duplicado nas entregas" : deliverySummary(delivery),
      detail: uncertain
        ? "Há informações ambíguas ou IDs duplicados. Revise a identificação antes de concluir se esta entrega está prevista."
        : `O ID ${id} não aparece entre os itens extraídos. Confira se o ID da tabela foi preenchido corretamente.`,
      contractEvidence: null,
      deliveryEvidence: rows.length === 1 ? deliveryEvidence(delivery) : null,
    }, rows);
  }

  return {
    items: extraction.items.map((item) => ({ ...item, id: normalizedId(item.id), evidence: verifiedEvidence(contract, item) })),
    deliveries, issues, matchedItemIds, warnings: extraction.warnings,
  };
}
