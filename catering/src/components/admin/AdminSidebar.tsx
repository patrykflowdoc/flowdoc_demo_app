import { useState, useEffect } from "react";
import {
  ClipboardList,
  Users,
  Settings,
  LogOut,
  ChevronDown,
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

const AdminSidebar = ({ activeSection, onSectionChange, onLogout }: AdminSidebarProps) => {
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

  return (
    <aside className="w-56 min-h-screen bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          {faviconUrl ? (
            <img src={faviconUrl} alt="Favicon" className="w-9 h-9 rounded-lg object-contain" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">{initials}</span>
            </div>
          )}
          <div>
            <h2 className="font-semibold text-foreground text-sm leading-tight">{companyName}</h2>
            <p className="text-muted-foreground text-xs">Panel administracyjny</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {mainNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activeSection === item.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}

        {/* Settings with accordion */}
        <button
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

        {settingsOpen && (
          <div className="ml-3 pl-3 border-l border-border space-y-0.5">
            {settingsSubItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors",
                  activeSection === item.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-border">
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <LogOut className="w-4 h-4" />
          Wyloguj
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
