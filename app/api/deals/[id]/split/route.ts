import { NextResponse } from "next/server";
import { PipelineError, splitDeal } from "@/lib/pipeline";
import { PayPalError } from "@/lib/paypal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const confirm = Boolean((body as { confirm?: boolean })?.confirm);
  try {
    const deal = await splitDeal(id, confirm);
    return NextResponse.json({ deal, ok: true });
  } catch (error) {
    if (error instanceof PayPalError) {
      return NextResponse.json({ error: error.message, debugId: error.debugId }, { status: 502 });
    }
    if (error instanceof PipelineError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("split failed", error);
    return NextResponse.json({ error: "Could not split the payment" }, { status: 500 });
  }
}
