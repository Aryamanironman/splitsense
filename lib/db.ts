import { constants, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedDeals } from "./seed";
import type { Deal } from "./types";

interface DB {
  deals: Deal[];
}

let cache: DB | null = null;
let dirPromise: Promise<string> | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function resolveDataDir(): Promise<string> {
  const preferred = process.env.DATA_DIR || path.join(process.cwd(), ".data");
  try {
    await fs.mkdir(preferred, { recursive: true });
    await fs.access(preferred, constants.W_OK);
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), "splitsense-data");
    await fs.mkdir(fallback, { recursive: true });
    return fallback;
  }
}

async function dataDir(): Promise<string> {
  if (!dirPromise) dirPromise = resolveDataDir();
  return dirPromise;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

async function load(): Promise<DB> {
  if (cache) return cache;
  const dir = await dataDir();
  try {
    const raw = await fs.readFile(path.join(dir, "db.json"), "utf8");
    const parsed = JSON.parse(raw) as DB;
    cache = { deals: Array.isArray(parsed.deals) ? parsed.deals : [] };
  } catch {
    cache = { deals: [] };
  }
  return cache;
}

async function persist(): Promise<void> {
  if (!cache) return;
  const dir = await dataDir();
  const target = path.join(dir, "db.json");
  const temp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(cache, null, 2), "utf8");
  await fs.rename(temp, target);
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function seedIfEmpty(db: DB): Promise<void> {
  if (process.env.AUTO_SEED === "false" || db.deals.length > 0) return;
  for (const deal of seedDeals()) {
    if (!db.deals.some((d) => d.id === deal.id)) db.deals.push(deal);
  }
  try {
    await persist();
  } catch {
    // Read-only host: keep the seeded set in memory for this instance.
  }
}

export async function listDeals(): Promise<Deal[]> {
  await load();
  await seedIfEmpty(cache!);
  return clone(cache!.deals).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDeal(id: string): Promise<Deal | null> {
  await load();
  await seedIfEmpty(cache!);
  const found = cache!.deals.find((d) => d.id === id);
  return found ? clone(found) : null;
}

export async function insertDeal(deal: Deal): Promise<Deal> {
  return withLock(async () => {
    const db = await load();
    db.deals.push(deal);
    await persist();
    return clone(deal);
  });
}

export async function updateDeal(
  id: string,
  mutate: (deal: Deal) => void,
): Promise<Deal | null> {
  return withLock(async () => {
    const db = await load();
    const found = db.deals.find((d) => d.id === id);
    if (!found) return null;
    mutate(found);
    found.updatedAt = new Date().toISOString();
    await persist();
    return clone(found);
  });
}
