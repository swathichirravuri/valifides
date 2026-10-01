import { Fragment, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { actionLabel, LINE_LABEL, money, PageHeader, RuleResultList, Stat, VerdictBadge } from "@/components/valifides/shared";
import { MARKETS } from "@/components/valifides/markets";
import { useValifides } from "@/context/ValifidesContext";
import { AS_OF } from "@/engine/synthetic";
import type { Verdict } from "@/engine/types";

export function useReplayStats() {
  const { replay, pack } = useValifides();
  return useMemo(() => {
    const verdicts: Record<Verdict, number> = { APPROVE: 0, ESCALATE: 0, BLOCK: 0 };
    const byRule: Record<string, number> = {};
    let penal = 0;
    for (const { result } of replay) {
      verdicts[result.verdict]++;
      for (const r of result.results) {
        if (r.outcome === "BLOCK" || r.outcome === "ESCALATE") byRule[r.ruleId] = (byRule[r.ruleId] ?? 0) + 1;
        penal += r.penalInterest ?? 0;
      }
    }
    const ruleRows = pack.rules.map((r) => ({ id: r.id, title: r.title, count: byRule[r.id] ?? 0 }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
    return { total: replay.length, verdicts, ruleRows, penal };
  }, [replay, pack]);
}

export default function ReplayPage() {
  const { replay, pack, jurisdiction } = useValifides();
  const stats = useReplayStats();
  const [verdict, setVerdict] = useState<"ALL" | Verdict>("ALL");
  const [rule, setRule] = useState("ALL");
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(40);

  const rows = replay.filter(
    ({ result }) =>
      (verdict === "ALL" || result.verdict === verdict) &&
      (rule === "ALL" || result.results.some((r) => r.ruleId === rule && (r.outcome === "BLOCK" || r.outcome === "ESCALATE"))),
  );

  const sel = "rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] text-foreground";

  return (
    <AppLayout>
      <div className="section-gap-sm max-w-[1400px]">
        <PageHeader
          title="Shadow Replay"
          subtitle={`What Valifides would have done with ${stats.total} past claim decisions, run in shadow mode. Nothing was blocked; this is the report an insurer sees before switching on enforcement. Synthetic data, as of ${new Date(AS_OF).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Decisions replayed" value={stats.total} note={MARKETS[jurisdiction].replayNote} />
          <Stat label="Would escalate" value={stats.verdicts.ESCALATE} tone="warning" note={`${Math.round((stats.verdicts.ESCALATE / stats.total) * 100)}% need a human or are near a deadline`} />
          <Stat label="Would block" value={stats.verdicts.BLOCK} tone="critical" note={`${Math.round((stats.verdicts.BLOCK / stats.total) * 100)}% conflict with a draft rule`} />
          <Stat label="Penalty interest accrued" value={money(stats.penal, pack.currency)} note={MARKETS[jurisdiction].penaltyNote} />
        </div>

        <div className="prod-card-padded">
          <h2>Findings by rule</h2>
          <p className="text-meta mb-4">Number of replayed decisions where each rule would have escalated or blocked.</p>
          <div style={{ height: Math.max(220, stats.ruleRows.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.ruleRows} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fill: "hsl(220 10% 58%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="title" width={330} tick={{ fill: "hsl(220 10% 78%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "hsl(220 15% 13%)" }}
                  contentStyle={{ background: "hsl(220 18% 7%)", border: "1px solid hsl(220 14% 14%)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [v, "decisions"]}
                />
                <Bar dataKey="count" fill="hsl(24 90% 53%)" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="prod-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <h2 className="mr-auto">Replayed decisions</h2>
            <select className={sel} value={verdict} onChange={(e) => setVerdict(e.target.value as "ALL" | Verdict)}>
              <option value="ALL">All verdicts</option>
              <option value="BLOCK">Block</option>
              <option value="ESCALATE">Escalate</option>
              <option value="APPROVE">Approve</option>
            </select>
            <select className={sel} value={rule} onChange={(e) => setRule(e.target.value)}>
              <option value="ALL">All rules</option>
              {pack.rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} · {r.title}
                </option>
              ))}
            </select>
            <span className="text-meta">{rows.length} decisions</span>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                {["Decision", "Claim", "Line", "Proposed action", "AI", "Amount", "Verdict", "Rules fired"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map(({ input, result }) => {
                const fired = result.results.filter((r) => r.outcome === "BLOCK" || r.outcome === "ESCALATE");
                const isOpen = open === input.decisionId;
                return (
                  <Fragment key={input.decisionId}>
                    <tr onClick={() => setOpen(isOpen ? null : input.decisionId)} className="cursor-pointer border-t border-border hover:bg-accent/50">
                      <td className="px-4 py-2.5 font-mono">{input.decisionId}</td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">{input.claimId}</td>
                      <td className="px-4 py-2.5">{input.state ? `${input.state} · ` : ""}{LINE_LABEL[input.line]}</td>
                      <td className="px-4 py-2.5">{actionLabel(input.proposedAction, jurisdiction)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{input.aiInvolvement === "NONE" ? "—" : input.aiInvolvement === "ASSISTED" ? "assisted" : "recommended"}</td>
                      <td className="px-4 py-2.5 font-mono">{money(input.claimAmount, pack.currency)}</td>
                      <td className="px-4 py-2.5"><VerdictBadge verdict={result.verdict} /></td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">{fired.map((r) => r.ruleId).join(", ") || "—"}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-border bg-surface-elevated/50">
                        <td colSpan={8} className="px-6 pb-2">
                          <RuleResultList results={result.results} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {rows.length > limit && (
            <button onClick={() => setLimit(limit + 40)} className="w-full border-t border-border py-3 text-[12px] text-primary hover:bg-accent/50">
              Show more ({rows.length - limit} remaining)
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
