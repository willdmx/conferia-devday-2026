import { parseMoneyToCents } from "./format";
import { deliveriesSchema, type Delivery } from "./schemas";

const HEADERS = ["id", "descricao", "quantidade", "data_entrega", "valor_total"];

function delimiterFor(text: string): ";" | "," {
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted) {
      if (character === ",") commas += 1;
      if (character === ";") semicolons += 1;
      if ((character === "\n" || character === "\r") && (commas || semicolons)) break;
    }
  }
  return semicolons > commas ? ";" : ",";
}

function readRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;
  const endField = () => { row.push(field); field = ""; afterQuote = false; };
  const endRow = () => {
    endField();
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; }
        else { quoted = false; afterQuote = true; }
      } else field += character;
      continue;
    }
    if (character === delimiter) { endField(); continue; }
    if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      endRow();
      continue;
    }
    if (afterQuote) {
      if (!/\s/.test(character)) throw new Error("CSV inválido: texto inesperado após o fechamento das aspas.");
      continue;
    }
    if (character === '"') {
      if (field.trim() !== "") throw new Error("CSV inválido: aspas no meio de um campo. Envolva o campo inteiro em aspas.");
      field = "";
      quoted = true;
    } else field += character;
  }
  if (quoted) throw new Error("CSV inválido: um campo entre aspas não foi fechado.");
  if (field.length > 0 || row.length > 0 || afterQuote) endRow();
  return rows;
}

export function parseDeliveriesCsv(text: string): Delivery[] {
  if (text.length > 100_000) throw new Error("O CSV é grande demais. Use um arquivo com até 10 entregas.");
  const input = text.replace(/^\uFEFF/, "");
  const rows = readRows(input, delimiterFor(input));
  if (rows.length < 2) throw new Error("O CSV precisa conter um cabeçalho e pelo menos uma entrega.");
  const headers = rows[0].map((header) => header.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_"));
  if (headers.length !== HEADERS.length || new Set(headers).size !== HEADERS.length || HEADERS.some((header) => !headers.includes(header))) {
    throw new Error(`Use os cabeçalhos: ${HEADERS.join(";")}.`);
  }
  if (rows.length - 1 > 10) throw new Error("O CSV deve conter no máximo 10 entregas.");
  const deliveries = rows.slice(1).map((row, index) => {
    const line = index + 2;
    if (row.length !== headers.length) throw new Error(`Linha ${line}: quantidade de colunas incorreta. Valores com vírgula devem ficar entre aspas em um CSV separado por vírgulas.`);
    const get = (header: string) => row[headers.indexOf(header)].trim();
    const quantityText = get("quantidade");
    if (!/^\d+(?:[.,]\d+)?$/.test(quantityText)) throw new Error(`Linha ${line}: informe uma quantidade numérica não negativa.`);
    let totalCents: number;
    try { totalCents = parseMoneyToCents(get("valor_total")); }
    catch (error) { throw new Error(`Linha ${line}: ${error instanceof Error ? error.message : "valor inválido."}`); }
    return {
      id: get("id"), description: get("descricao"),
      quantity: Number(quantityText.replace(",", ".")),
      deliveredAt: get("data_entrega"), totalCents,
    };
  });
  const parsed = deliveriesSchema.safeParse(deliveries);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const index = typeof issue.path[0] === "number" ? issue.path[0] : null;
    throw new Error(`${index === null ? "CSV" : `Linha ${index + 2}`}: ${issue.message}`);
  }
  return parsed.data;
}
