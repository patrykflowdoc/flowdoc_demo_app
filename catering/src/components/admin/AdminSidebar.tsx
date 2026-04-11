import { useState, useEffect, type ReactElement } from "react";
import {
  ClipboardList,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  ShoppingCart,
  CalendarDays,
  PartyPopper,
  UtensilsCrossed,
  FileText,
  BarChart3,
  Truck,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCompanySettings } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type AdminSection =
  | "orders"
  | "clients"
  | "reports"
  | "settings-company"
  | "settings-orders"
  | "settings-events"
  | "settings-calendar"
  | "settings-dishes"
  | "settings-form"
  | "settings-delivery"
  | "settings-users";

interface AdminSidebarProps {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  onLogout?: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const mainNavItems: { id: "orders" | "clients" | "reports"; icon: typeof ClipboardList; label: string }[] = [
  { id: "orders", icon: ClipboardList, label: "Zamówienia" },
  { id: "clients", icon: Users, label: "Klienci" },
  { id: "reports", icon: BarChart3, label: "Raporty" },
];

const settingsSubItems: { id: AdminSection; icon: typeof Building2; label: string }[] = [
  { id: "settings-company", icon: Building2, label: "Dane firmy" },
  { id: "settings-orders", icon: ShoppingCart, label: "Zamówienia" },
  { id: "settings-events", icon: PartyPopper, label: "Rodzaje wydarzeń" },
  { id: "settings-calendar", icon: CalendarDays, label: "Kalendarz" },
  { id: "settings-dishes", icon: UtensilsCrossed, label: "Dania" },
  { id: "settings-form", icon: FileText, label: "Formularz" },
  { id: "settings-delivery", icon: Truck, label: "Strefy dostaw" },
  { id: "settings-users", icon: Shield, label: "Użytkownicy" },
];

function NavTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

const AdminSidebar = ({
  activeSection,
  onSectionChange,
  onLogout,
  collapsed,
  onToggleCollapsed,
}: AdminSidebarProps) => {
  const isSettingsActive = activeSection.startsWith("settings-");
  const [settingsOpen, setSettingsOpen] = useState(isSettingsActive);
  const [companyName, setCompanyName] = useState("Panel Admin");
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);

  useEffect(() => {
    getCompanySettings()
      .then((data: Record<string, unknown>) => {
        if (data.companyName) setCompanyName(String(data.companyName));
        if (data.faviconUrl) setFaviconUrl(String(data.faviconUrl));
      })
      .catch(() => {});
  }, []);

  const handleSettingsClick = () => {
    setSettingsOpen((prev) => !prev);
    if (!isSettingsActive) {
      onSectionChange("settings-company");
    }
  };

  const initials = companyName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const logoBlock = faviconUrl ? (
    <img src={faviconUrl} alt="" className={cn("rounded-lg object-contain", collapsed ? "w-8 h-8" : "w-9 h-9")} />
  ) : (
    <div
      className={cn(
        "rounded-lg bg-primary flex items-center justify-center shrink-0",
        collapsed ? "w-8 h-8" : "w-9 h-9"
      )}
    >
      <span className={cn("text-primary-foreground font-bold", collapsed ? "text-xs" : "text-sm")}>
        {initials}
      </span>
    </div>
  );

  return (
    <aside
      className={cn(
        "min-h-screen bg-card border-r border-border flex flex-col shrink-0 transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo + zwijanie */}
      <div className={cn("border-b border-border", collapsed ? "p-2" : "p-5")}>
        <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "gap-3")}>
          {logoBlock}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-foreground text-sm leading-tight truncate">{companyName}</h2>
              <p className="text-muted-foreground text-xs">Panel administracyjny</p>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("shrink-0 text-muted-foreground", collapsed && "h-8 w-8")}
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Rozwiń menu" : "Zwiń menu"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-1 overflow-y-auto", collapsed ? "p-2" : "p-3")}>
        {mainNavItems.map((item) => {
          const btn = (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "rounded-lg text-sm font-medium transition-colors",
                collapsed
                  ? "w-full flex justify-center p-2.5"
                  : "w-full flex items-center gap-3 px-3 py-2.5",
                activeSection === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && item.label}
            </button>
          );
          return collapsed ? (
            <NavTooltip key={item.id} label={item.label}>
              {btn}
            </NavTooltip>
          ) : (
            btn
          );
        })}

        {/* Settings with accordion */}
        {collapsed ? (
          <NavTooltip label="Ustawienia">
            <button
              type="button"
              onClick={handleSettingsClick}
              className={cn(
                "w-full flex justify-center p-2.5 rounded-lg text-sm font-medium transition-colors",
                isSettingsActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Settings className="w-4 h-4" />
            </button>
          </NavTooltip>
        ) : (
          <button
            type="button"
            onClick={handleSettingsClick}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isSettingsActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Settings className="w-4 h-4" />
            Ustawienia
            <ChevronDown className={cn("w-3.5 h-3.5 ml-auto transition-transform", settingsOpen && "rotate-180")} />
          </button>
        )}

        {settingsOpen && (
          <div className={cn(!collapsed && "ml-3 pl-3 border-l border-border space-y-0.5")}>
            {settingsSubItems.map((item) => {
              const subBtn = (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "rounded-md font-medium transition-colors",
                    collapsed
                      ? "w-full flex justify-center p-2.5"
                      : "w-full flex items-center gap-2.5 px-2.5 py-2 text-xs",
                    activeSection === item.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className={cn(collapsed ? "w-4 h-4" : "w-3.5 h-3.5")} />
                  {!collapsed && item.label}
                </button>
              );
              return collapsed ? (
                <NavTooltip key={item.id} label={item.label}>
                  {subBtn}
                </NavTooltip>
              ) : (
                subBtn
              );
            })}
          </div>
        )}
      </nav>

      {/* Bottom */}
      <div className={cn("border-t border-border", collapsed ? "p-2" : "p-3")}>
        {collapsed ? (
          <NavTooltip label="Wyloguj">
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex justify-center p-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </NavTooltip>
        ) : (
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Wyloguj
          </button>
        )}
      </div>
    </aside>
  );
};

export default AdminSidebar;
