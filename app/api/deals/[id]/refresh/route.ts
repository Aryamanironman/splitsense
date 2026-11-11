import { NextResponse } from "next/server";
import { refreshPayouts } from "@/lib/pipeline";
import { PayPalError } from "@/lib/paypal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const deal = await refreshPayouts(id);
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    return NextResponse.json({ deal, ok: true });
  } catch (error) {
    if (error instanceof PayPalError) {
      return NextResponse.json({ error: error.message, debugId: error.debugId }, { status: 502 });
    }
    return NextResponse.json({ error: "Could not refresh payouts" }, { status: 500 });
  }
}
