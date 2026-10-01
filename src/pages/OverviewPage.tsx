import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { money, PageHeader, Stat } from "@/components/valifides/shared";
import { useValifides } from "@/context/ValifidesContext";
import { useReplayStats } from "@/pages/ReplayPage";
import { ArrowRight } from "lucide-react";

const STEPS = [
  { mode: "SHADOW", title: "1 · Shadow", text: "Valifides sees a copy of each claim decision and logs what it would have done. No change to the insurer's flow, no added delay." },
  { mode: "ADVISORY", title: "2 · Advisory", text: "Valifides returns a verdict with reasons. The insurer's system chooses whether to hold, route to a human, or proceed." },
  { mode: "ENFORCE", title: "3 · Enforce", text: "Blocked decisions do not execute; escalated ones wait for an authorised reviewer. Every step is in the evidence log." },
];

const WATCH = {
  IN: [
    { what: "IRDAI AI working group", when: "Formed June 2026; recommendations due about September 2026", why: "First formal AI governance framework for insurers; claims and fraud detection named as priorities." },
    { what: "DPDP Act core obligations", when: "13 May 2027", why: "Notice, purpose limitation, security safeguards and breach reporting for personal data, including claim files." },
    { what: "IRDAI claim timelines", when: "In force (2024 regulations and health master circular)", why: "Cashless 1 hour / discharge 3 hours, survey 15 days, decision 7 days, payment 15 days. Draft rules, to be verified with counsel." },
  ],
  US: [
    { what: "NAIC AI Model Bulletin", when: "Adopted in 24+ states and D.C.", why: "Insurers must govern AI used in claims: oversight, documentation, testing for unfair discrimination, third-party vendor oversight." },
    { what: "State claims-handling laws", when: "In force", why: "CA 10 CCR 2695 (acknowledge 15 days, decide 40 days, pay 30 days); TX Ins. Code ch. 542 (18% penalty interest); FL 627.70131 (60 days). Draft rules, to be verified with counsel." },
    { what: "AI-only denial bills", when: "Watch: Florida HB 527 passed the House 108–0 and died in the Senate (March 2026)", why: "Similar bills could return; seven states already restrict AI-only denials in health insurance." },
  ],
};

export default function OverviewPage() {
  const { mode, log, resolvedSeqs, jurisdiction, pack } = useValifides();
  const stats = useReplayStats();
  const open = log.filter((e) => e.result.verdict === "ESCALATE" && e.source !== "REVIEW" && !resolvedSeqs.has(e.seq)).length;

  return (
    <AppLayout>
      <div className="section-gap max-w-[1400px]">
        <PageHeader
          title="Proof that no claim was denied by AI alone"
          subtitle={`Valifides sits between an insurer's AI and the claim decision. ${jurisdiction === "US" ? "It checks each AI-influenced decision against state claim rules and the NAIC AI bulletin before it takes effect, routes risky ones to a licensed adjuster, and keeps a tamper-evident record for examiners, auditors and courts." : "It checks each AI-influenced decision against Indian claim rules before it takes effect, routes risky ones to an authorised human, and keeps a tamper-evident record for IRDAI, auditors and courts."}`}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Shadow replay" value={stats.total} note="Past decisions checked (synthetic)" />
          <Stat label="Would escalate" value={stats.verdicts.ESCALATE} tone="warning" note="Missing human review or near a deadline" />
          <Stat label="Would block" value={stats.verdicts.BLOCK} tone="critical" note="Conflict with a draft rule" />
          <Stat label="Penalty interest found" value={money(stats.penal, pack.currency)} note="Accrued on late payments" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="prod-card-padded">
            <div className="flex items-center justify-between">
              <h2>Top findings in the replay</h2>
              <Link to="/replay" className="flex items-center gap-1 text-[12px] text-primary">Open replay <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <ul className="mt-4 space-y-3">
              {stats.ruleRows.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4">
                  <span className="text-[13px] text-foreground"><span className="font-mono text-[11px] text-muted-foreground mr-2">{r.id}</span>{r.title}</span>
                  <span className="font-mono text-[13px] text-warning">{r.count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="prod-card-padded">
            <h2>This session</h2>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div><p className="text-label">Mode</p><p className="mt-1 text-lg font-semibold text-primary">{mode.charAt(0) + mode.slice(1).toLowerCase()}</p></div>
              <div><p className="text-label">Evaluations</p><p className="mt-1 text-lg font-semibold font-mono">{log.length}</p></div>
              <div><p className="text-label">Open escalations</p><p className="mt-1 text-lg font-semibold font-mono text-warning">{open}</p></div>
            </div>
            <Link to="/gateway" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90">
              Try the Decision Gateway <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div>
          <h2 className="mb-3">How an insurer adopts it</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.mode} className={`prod-card-padded ${mode === s.mode ? "border-primary/50" : ""}`}>
                <h3 className={mode === s.mode ? "text-primary" : ""}>{s.title}{mode === s.mode ? " · current" : ""}</h3>
                <p className="mt-2 text-[13px] text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="prod-card">
          <div className="p-5 pb-2"><h2>Regulatory watch ({jurisdiction === "US" ? "United States" : "India"})</h2></div>
          <table className="w-full text-[13px]">
            <tbody>
              {WATCH[jurisdiction].map((w) => (
                <tr key={w.what} className="border-t border-border align-top">
                  <td className="px-5 py-3 font-medium text-foreground w-56">{w.what}</td>
                  <td className="px-5 py-3 text-muted-foreground w-72">{w.when}</td>
                  <td className="px-5 py-3 text-muted-foreground">{w.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
