import { NextResponse } from "next/server";
import { listDeals } from "@/lib/db";
import { createDeal, PipelineError } from "@/lib/pipeline";
import { PayPalError } from "@/lib/paypal";
import { parseCreateDeal } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ deals: await listDeals() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parseCreateDeal(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const deal = await createDeal(parsed.value);
    return NextResponse.json({ deal }, { status: 201 });
  } catch (error) {
    if (error instanceof PayPalError) {
      return NextResponse.json({ error: error.message, debugId: error.debugId }, { status: 502 });
    }
    if (error instanceof PipelineError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("create deal failed", error);
    return NextResponse.json({ error: "Could not create deal" }, { status: 500 });
  }
}
