import path from "node:path";

const KINDS = { drugs: "Medication", labtests: "Lab test", topics: "Condition", herbs: "Herb & supplement" };

export function extractAliases(body) {
  const values = [];
  for (const match of body.matchAll(/^(?:Brand names|Also called|Common Names):\s*(.+)$/gim)) {
    values.push(...match[1].split(/[,;]+/).map((s) => s.trim()).filter(Boolean));
  }
  return [...new Set(values)];
}

function plainText(markdown) {
  return markdown.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, " ").replace(/^[#>*\-\s]+/gm, "")
    .replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim();
}

function chunks(text, max = 900) {
  const result = [];
  let remaining = plainText(text);
  while (remaining.length > max) {
    let end = remaining.lastIndexOf(" ", max);
    if (end < max / 2) end = max;
    result.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) result.push(remaining);
  return result;
}

export function parseKnowledgeFile(filePath, markdown) {
  const folder = path.basename(path.dirname(filePath));
  const kind = KINDS[folder];
  if (!kind) throw new Error(`Unknown knowledge kind: ${folder}`);
  const separator = markdown.match(/^---\s*$/m);
  if (!separator) throw new Error(`Missing front matter separator: ${filePath}`);
  const header = markdown.slice(0, separator.index);
  const body = markdown.slice(separator.index + separator[0].length).trim();
  const title = header.match(/^#\s+(.+)$/m)?.[1]?.replace(/\s+\((?:drug label|lab test|herb\/supplement)\)$/i, "").trim();
  if (!title) throw new Error(`Missing title: ${filePath}`);
  const source = header.match(/^Source:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const url = header.match(/^URL:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const id = `${folder}-${path.basename(filePath, ".md")}`;
  const aliases = extractAliases(body);
  const library = { id, title, kind, aliases, summary: plainText(body).slice(0, 400), body: body.slice(0, 15000), url, source };
  const sections = body.split(/^##\s+(.+)$/m);
  const passages = [];
  for (let i = 0; i < sections.length; i += 2) {
    const section = i === 0 ? "Overview" : sections[i - 1].trim();
    for (const [part, text] of chunks(sections[i]).entries()) {
      passages.push({ id: `${id}-${passages.length}`, doc_id: id, title, kind, section: part ? `${section} (${part + 1})` : section, text, url, source });
    }
  }
  return { library, passages };
}
