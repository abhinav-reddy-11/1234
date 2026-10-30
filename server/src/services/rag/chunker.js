// Splits a policy document into small, self-contained chunks for retrieval.
// Strategy: split by headings (sections), then split long sections by sentences.
// Each chunk keeps its section heading, so retrieval and citations stay meaningful.

const MAX_CHARS = 700;
const OVERLAP_SENTENCES = 1; // repeat the last sentence in the next chunk for context

function splitLongText(text) {
  const sentences = text.match(/[^.!?\n]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  const chunks = [];
  let current = [];
  for (const sentence of sentences) {
    if (current.join(" ").length + sentence.length > MAX_CHARS && current.length) {
      chunks.push(current.join(" "));
      current = current.slice(-OVERLAP_SENTENCES);
    }
    current.push(sentence);
  }
  if (current.length) chunks.push(current.join(" "));
  return chunks;
}

// Markdown / plain text -> [{ section, text }]
function sectionsFromText(raw, fallbackTitle) {
  const sections = [];
  let heading = fallbackTitle;
  let buffer = [];
  const flush = () => {
    const body = buffer.join("\n").trim();
    if (body) sections.push({ section: heading, body });
    buffer = [];
  };
  for (const line of raw.split(/\r?\n/)) {
    const h = line.match(/^#{1,6}\s+(.*)/);
    if (h) {
      flush();
      heading = h[1].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

// JSON -> sections. Supports [{ title|section, content|text }] or { "Section": "text" }.
function sectionsFromJson(raw, fallbackTitle) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON file");
  }
  if (Array.isArray(data)) {
    return data.map((d, i) => ({
      section: d.title || d.section || `${fallbackTitle} #${i + 1}`,
      body: String(d.content ?? d.text ?? JSON.stringify(d)),
    }));
  }
  return Object.entries(data).map(([k, v]) => ({
    section: k,
    body: typeof v === "string" ? v : JSON.stringify(v),
  }));
}

export function chunkDocument(raw, { title, fileName }) {
  const isJson = fileName?.toLowerCase().endsWith(".json");
  const sections = isJson ? sectionsFromJson(raw, title) : sectionsFromText(raw, title);

  const chunks = [];
  for (const { section, body } of sections) {
    const clean = body.replace(/\s+/g, " ").trim();
    if (clean.length < 20) continue; // skip empty / trivial sections
    for (const piece of splitLongText(clean)) {
      // Prefix the heading so a chunk like "within 30 days" still says what it's about.
      chunks.push({ section, text: `${section}: ${piece}` });
    }
  }
  return chunks.map((c, chunkIndex) => ({ ...c, chunkIndex }));
}
