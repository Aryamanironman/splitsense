import { statusTone } from "@/lib/format";
import { STATUS_LABEL, type DealStatus } from "@/lib/types";

export function StatusPill({ status }: { status: DealStatus }) {
  return <span className={`pill ${statusTone(status)}`}>{STATUS_LABEL[status]}</span>;
}
