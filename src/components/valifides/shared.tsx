import type { ClaimLine, Currency, Jurisdiction, ProposedAction, RuleResult, Verdict } from "@/engine/types";
import { AlertTriangle, CheckCircle2, MinusCircle, ShieldX } from "lucide-react";

export const LINE_LABEL: Record<ClaimLine, string> = {
  HEALTH_CASHLESS: "Health · cashless",
  HEALTH_REIMBURSEMENT: "Health · reimbursement",
  MOTOR_OWN_DAMAGE: "Motor · own damage",
  US_AUTO_PHYSICAL_DAMAGE: "Auto · physical damage",
  US_HOMEOWNERS: "Homeowners",
};

export const money = (n: number | null | undefined, currency: Currency = "INR") =>
  n === undefined || n === null
    ? "—"
    : currency === "USD"
      ? `$${Math.round(n).toLocaleString("en-US")}`
      : `₹${Math.round(n).toLocaleString("en-IN")}`;

export const actionLabel = (a: ProposedAction, j: Jurisdiction = "IN") =>
  a === "REPUDIATE" ? (j === "US" ? "deny" : "repudiate") : a.replace(/_/g, " ").toLowerCase();

export const fmtTime = (iso: string, j: Jurisdiction = "IN") =>
  new Date(iso).toLocaleString(j === "US" ? "en-US" : "en-IN", {
    timeZone: j === "US" ? "America/New_York" : "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const VERDICT_STYLE: Record<Verdict, string> = {
  APPROVE: "border-success/30 bg-success/10 text-success",
  ESCALATE: "border-warning/30 bg-warning/10 text-warning",
  BLOCK: "border-critical/30 bg-critical/10 text-critical",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${VERDICT_STYLE[verdict]}`}>
      {verdict}
    </span>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <h1>{title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-3xl">{subtitle}</p>
      </div>
      {right}
    </div>
  );
}

const OUTCOME_ICON = {
  PASS: <CheckCircle2 className="h-4 w-4 text-success shrink-0" />,
  ESCALATE: <AlertTriangle className="h-4 w-4 text-warning shrink-0" />,
  BLOCK: <ShieldX className="h-4 w-4 text-critical shrink-0" />,
  NOT_APPLICABLE: <MinusCircle className="h-4 w-4 text-muted-foreground/50 shrink-0" />,
};

export function RuleResultList({ results, showNotApplicable = false }: { results: RuleResult[]; showNotApplicable?: boolean }) {
  const order = { BLOCK: 0, ESCALATE: 1, PASS: 2, NOT_APPLICABLE: 3 };
  const shown = results
    .filter((r) => showNotApplicable || r.outcome !== "NOT_APPLICABLE")
    .sort((a, b) => order[a.outcome] - order[b.outcome]);
  return (
    <ul className="divide-y divide-border">
      {shown.map((r) => (
        <li key={r.ruleId} className="flex gap-3 py-3">
          {OUTCOME_ICON[r.outcome]}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{r.ruleId}</span>
              <span className="text-[13px] font-medium text-foreground">{r.title}</span>
            </div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{r.message}</p>
            {r.remediation && r.outcome !== "PASS" && (
              <p className="mt-1 text-[12px] text-foreground/80">
                <span className="text-muted-foreground">Next step: </span>
                {r.remediation}
              </p>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground/70">
              {r.source} · <span className="italic">{r.sourceStatus}</span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: React.ReactNode; note?: string; tone?: "warning" | "critical" | "success" }) {
  const toneClass = tone === "warning" ? "text-warning" : tone === "critical" ? "text-critical" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className="prod-card-padded">
      <p className="text-label">{label}</p>
      <p className={`mt-2 text-3xl font-semibold font-mono ${toneClass}`}>{value}</p>
      {note && <p className="mt-1 text-meta">{note}</p>}
    </div>
  );
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
