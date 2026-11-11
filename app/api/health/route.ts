import { NextResponse } from "next/server";
import { paypalMode } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "splitsense",
    paypalMode: paypalMode(),
    aiConfigured: Boolean(process.env.AI_API_KEY),
    time: new Date().toISOString(),
  });
}
