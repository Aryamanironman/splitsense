import { NextResponse } from "next/server";
import { getDeal, insertDeal } from "@/lib/db";
import { seedDeals } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  if (process.env.SEED_DISABLED === "true") {
    return NextResponse.json({ error: "Seeding is disabled" }, { status: 403 });
  }
  const created: string[] = [];
  for (const deal of seedDeals()) {
    if (await getDeal(deal.id)) continue;
    await insertDeal(deal);
    created.push(deal.id);
  }
  return NextResponse.json({ ok: true, created });
}
