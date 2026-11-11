export interface ParsedDeal {
  title: string;
  payer: string;
  amountCents: number;
  taxPercent: number;
  collaborators: { name: string; role: string; percent: number; email: string }[];
  source: "ai" | "rules";
}

const AI_BASE_URL = (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
const AI_API_KEY = process.env.AI_API_KEY?.trim();
const AI_MODEL = process.env.AI_MODEL || "openai/gpt-oss-120b";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalize(raw: unknown): ParsedDeal | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const amount = Number(obj.amount);
  const taxPercent = Number(obj.taxPercent);
  if (!Number.isFinite(amount) || amount < 1 || amount > 100_000) return null;
  if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 60) return null;
  const rawMembers = Array.isArray(obj.collaborators) ? obj.collaborators : [];
  const collaborators = rawMembers
    .slice(0, 8)
    .map((m) => {
      const member = (m || {}) as Record<string, unknown>;
      return {
        name: String(member.name ?? "").trim().slice(0, 60),
        role: String(member.role ?? "Collaborator").trim().slice(0, 40),
        percent: Number(member.percent),
        email: String(member.email ?? "").trim().toLowerCase().slice(0, 160),
      };
    })
    .filter((m) => m.name.length > 0 && Number.isFinite(m.percent) && m.percent >= 1 && m.percent <= 60);
  if (collaborators.length === 0) return null;
  const total = taxPercent + collaborators.reduce((sum, m) => sum + m.percent, 0);
  if (total > 95) return null;
  return {
    title: String(obj.title ?? "New creator deal").trim().slice(0, 120) || "New creator deal",
    payer: String(obj.payer ?? "").trim().slice(0, 80),
    amountCents: Math.round(amount * 100),
    taxPercent: Math.round(taxPercent * 10) / 10,
    collaborators,
    source: "ai",
  };
}

async function callModel(brief: string): Promise<ParsedDeal | null> {
  if (!AI_API_KEY) return null;
  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content:
              "You extract split rules from a creator's plain-language deal note. You never calculate money. Return ONLY JSON: {\"title\":string,\"payer\":string,\"amount\":number in dollars,\"taxPercent\":number,\"collaborators\":[{\"name\":string,\"role\":string,\"percent\":number,\"email\":string}]}. Only include collaborators explicitly named with a percentage. Tax and collaborator percentages together must not exceed 95. If a field is unknown use an empty string. If no collaborator with a percentage is present, return {\"collaborators\":[]}.",
          },
          { role: "user", content: brief.slice(0, 4000) },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    return normalize(extractJson(content));
  } catch {
    return null;
  }
}

function rulesParse(brief: string): ParsedDeal | null {
  const amountMatch = brief.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount < 1) return null;

  const taxMatch =
    brief.match(/(\d{1,2}(?:\.\d)?)\s*%\s*(?:for\s+|goes\s+to\s+)?tax/i) ||
    brief.match(/tax[^.%]{0,30}(\d{1,2}(?:\.\d)?)\s*%/i);
  const taxPercent = taxMatch ? Number(taxMatch[1]) : 0;

  const collaborators: ParsedDeal["collaborators"] = [];
  const re = /([A-Z][a-zA-Z]+)\s+(?:gets|takes|receives|should get|is owed)\s+(\d{1,2}(?:\.\d)?)\s*%/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(brief))) {
    collaborators.push({
      name: match[1],
      role: "Collaborator",
      percent: Number(match[2]),
      email: "",
    });
  }
  if (collaborators.length === 0) return null;
  const total = taxPercent + collaborators.reduce((sum, c) => sum + c.percent, 0);
  if (total > 95) return null;

  const payerMatch = brief.match(/(?:from|for)\s+([A-Z][\w&.\- ]{1,50}?)(?:[.,]|\s+for\b|$)/);
  return {
    title: "New creator deal",
    payer: payerMatch ? payerMatch[1].trim() : "",
    amountCents: Math.round(amount * 100),
    taxPercent,
    collaborators,
    source: "rules",
  };
}

export async function parseDealBrief(brief: string): Promise<ParsedDeal | null> {
  const model = await callModel(brief);
  if (model) return polish(model, brief);
  const rules = rulesParse(brief);
  return rules ? polish(rules, brief) : null;
}

function polish(parsed: ParsedDeal, brief: string): ParsedDeal {
  const payerMatch = brief.match(
    /(?:with|from)\s+([A-Z][A-Za-z0-9&.\- ]{1,50}?)(?=[.,]|\s+(?:for|and|who)\b|$)/,
  );
  const payer = parsed.payer || (payerMatch ? payerMatch[1].trim() : "");
  const genericTitle = !parsed.title || /^new creator deal$/i.test(parsed.title);
  return {
    ...parsed,
    payer,
    title: genericTitle ? (payer ? `${payer} deal` : "Creator deal") : parsed.title,
    collaborators: parsed.collaborators.map((c) => ({
      ...c,
      role: cleanRole(c.role),
    })),
  };
}

function cleanRole(role: string): string {
  const r = role.toLowerCase();
  if (/edit/.test(r)) return "Editor";
  if (/thumb|artist|art\b/.test(r)) return "Thumbnail artist";
  if (/illustrat/.test(r)) return "Illustrator";
  if (/music|sound|compos/.test(r)) return "Composer";
  if (/design/.test(r)) return "Designer";
  if (r && r !== "collaborator") return role.trim();
  return "Collaborator";
}
