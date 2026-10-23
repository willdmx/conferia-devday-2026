const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCurrency(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

/** Accepts 1.980,00 / 1980,00 / 1980.00; rejects ambiguous 1.980. */
export function parseMoneyToCents(text: string): number {
  const value = text.trim().replace(/^R\$\s*/i, "");
  let whole: string;
  let fraction = "";
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(value)) {
    [whole, fraction] = value.replaceAll(".", "").split(",");
  } else if (/^\d+(?:[.,]\d{1,2})?$/.test(value)) {
    [whole, fraction = ""] = value.split(/[.,]/);
  } else {
    throw new Error(`Valor inválido ou ambíguo: "${text}". Use 1980,00 ou 1.980,00.`);
  }
  const cents = Number(whole + fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error("O valor excede o limite permitido.");
  }
  return cents;
}
