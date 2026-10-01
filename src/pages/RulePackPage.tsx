import { AppLayout } from "@/components/AppLayout";
import { LINE_LABEL, PageHeader } from "@/components/valifides/shared";
import { MARKETS } from "@/components/valifides/markets";
import { useValifides } from "@/context/ValifidesContext";

export default function RulePackPage() {
  const { pack, jurisdiction } = useValifides();
  return (
    <AppLayout>
      <div className="section-gap-sm max-w-[1400px]">
        <PageHeader
          title={`Rule Pack · ${pack.id} v${pack.version}`}
          subtitle={`The fixed rules Valifides applies to ${pack.name} decisions. Each rule names its source and how settled that source is. Every rule is a draft compiled from public sources and must be reviewed by insurance counsel before use with a real insurer.`}
        />

        <div className={`grid gap-3 ${MARKETS[jurisdiction].categories.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
          {MARKETS[jurisdiction].categories.map(([t, d]) => (
            <div key={t} className="prod-card-padded">
              <h3>{t}</h3>
              <p className="mt-1.5 text-[12px] text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>

        <div className="prod-card overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                {["Rule", "What it checks", "Applies to", "On breach", "Source", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pack.rules.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <p className="font-mono text-[11px] text-muted-foreground">{r.id}</p>
                    <p className="mt-0.5 text-[13px] font-medium text-foreground">{r.title}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-sm">{r.description}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {r.appliesTo.length === pack.lines.length ? "All lines" : r.appliesTo.map((l) => LINE_LABEL[l]).join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={r.onBreach === "BLOCK" ? "text-critical font-semibold" : "text-warning font-semibold"}>{r.onBreach}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs">{r.source}</td>
                  <td className="px-4 py-3 text-muted-foreground italic max-w-[200px]">{r.sourceStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
