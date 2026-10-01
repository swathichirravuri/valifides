import { NavLink } from "@/components/NavLink";
import { useValifides } from "@/context/ValifidesContext";
import { useLocation } from "react-router-dom";
import { Archive, BookOpenCheck, ChevronLeft, ChevronRight, History, LayoutDashboard, Shield, UserCheck, Zap } from "lucide-react";
import { useState } from "react";

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { log, resolvedSeqs } = useValifides();
  const openEscalations = log.filter((e) => e.result.verdict === "ESCALATE" && e.source !== "REVIEW" && !resolvedSeqs.has(e.seq)).length;

  const navItems = [
    { title: "Overview", url: "/", icon: LayoutDashboard },
    { title: "Decision Gateway", url: "/gateway", icon: Zap },
    { title: "Shadow Replay", url: "/replay", icon: History },
    { title: "Escalation Queue", url: "/escalations", icon: UserCheck, badge: openEscalations },
    { title: "Evidence Log", url: "/evidence", icon: Archive },
    { title: "Rule Pack", url: "/rules", icon: BookOpenCheck },
  ];

  return (
    <aside className={`flex flex-col border-r border-border/50 bg-sidebar transition-all duration-200 ${collapsed ? "w-16" : "w-56"}`}>
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground tracking-tight leading-none">Valifides</span>
              <span className="text-[9px] text-muted-foreground tracking-wider uppercase mt-0.5">Claims governance</span>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-5">
        {navItems.map((item) => {
          const active = location.pathname === item.url;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              end
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${
                active ? "bg-primary/12 text-primary" : "text-sidebar-foreground hover:bg-accent hover:text-foreground"
              }`}
              activeClassName=""
            >
              <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
              {!collapsed && <span className="flex-1">{item.title}</span>}
              {!collapsed && !!item.badge && (
                <span className="rounded-full bg-warning/15 px-1.5 text-[10px] font-semibold text-warning">{item.badge}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-10 items-center justify-center border-t border-border/50 text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
