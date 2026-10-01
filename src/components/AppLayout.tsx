import { AppSidebar } from "@/components/AppSidebar";
import { useValifides } from "@/context/ValifidesContext";
import type { EnforcementMode, Jurisdiction } from "@/engine/types";
import { FlaskConical } from "lucide-react";
import { JURISDICTIONS, MARKETS } from "@/components/valifides/markets";

const MODES: { value: EnforcementMode; label: string; hint: string }[] = [
  { value: "SHADOW", label: "Shadow", hint: "Observe and log only; never changes the decision" },
  { value: "ADVISORY", label: "Advisory", hint: "Returns a verdict; the insurer's system decides" },
  { value: "ENFORCE", label: "Enforce", hint: "Blocks or escalates before the decision executes" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { mode, setMode, jurisdiction, setJurisdiction, pack } = useValifides();
  const JURS: { value: Jurisdiction; label: string }[] = JURISDICTIONS.map((j) => ({ value: j, label: MARKETS[j].label }));

  return (
    <div className="flex min-h-screen w-full bg-background flex-col">
      <header className="border-b border-border/50 bg-background/95 backdrop-blur-md px-8 py-2.5 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-foreground tracking-tight">Valifides</span>
          <span className="text-[10px] text-muted-foreground/50">·</span>
          <span className="text-[11px] text-muted-foreground">Decision-level governance for AI in insurance claims</span>
          <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-px text-[10px] font-medium text-primary/80">
            {pack.id} v{pack.version}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Market</span>
          <div className="flex rounded-lg border border-border p-0.5 mr-4">
            {JURS.map((j) => (
              <button
                key={j.value}
                onClick={() => setJurisdiction(j.value)}
                className={`rounded-md px-3 py-1 text-[11px] font-medium transition-colors ${
                  jurisdiction === j.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {j.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">Mode</span>
          <div className="flex rounded-lg border border-border p-0.5">
            {MODES.map((m) => (
              <button
                key={m.value}
                title={m.hint}
                onClick={() => setMode(m.value)}
                className={`rounded-md px-3 py-1 text-[11px] font-medium transition-colors ${
                  mode === m.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="border-b border-warning/20 bg-warning/[0.06] px-8 py-1.5 flex items-center gap-2">
        <FlaskConical className="h-3.5 w-3.5 text-warning shrink-0" />
        <span className="text-[11px] text-warning/90">
          Demo environment · synthetic data only · rules are drafts from public summaries, pending review by insurance counsel · not legal advice
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-auto p-8 lg:p-10">{children}</main>
          <footer className="border-t border-border/50 px-8 py-3 flex items-center justify-between shrink-0">
            <span className="text-[10px] text-muted-foreground">
              Verdicts come from fixed rules, not an AI model. The same input always gets the same verdict.
            </span>
            <span className="text-[10px] text-muted-foreground">Valifides · prototype · built by Swathi Chirravuri</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
