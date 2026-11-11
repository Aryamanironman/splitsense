import { NextResponse } from "next/server";
import { parseDealBrief } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const brief = typeof (body as { brief?: string })?.brief === "string" ? (body as { brief: string }).brief : "";
  if (brief.trim().length < 8) {
    return NextResponse.json({ error: "Describe the deal in a sentence or two" }, { status: 400 });
  }
  const parsed = await parseDealBrief(brief.slice(0, 4000));
  if (!parsed) {
    return NextResponse.json(
      { error: "Could not read the split. Fill it in manually below." },
      { status: 422 },
    );
  }
  return NextResponse.json({
    parsed: {
      title: parsed.title,
      payer: parsed.payer,
      amountCents: parsed.amountCents,
      taxPercent: parsed.taxPercent,
      collaborators: parsed.collaborators,
    },
    source: parsed.source,
  });
}
