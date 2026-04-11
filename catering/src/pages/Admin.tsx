import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AdminSidebar, { type AdminSection } from "@/components/admin/AdminSidebar";
import OrdersView from "@/components/admin/OrdersView";
import ClientsView from "@/components/admin/ClientsView";
import ReportsView from "@/components/admin/ReportsView";
import SettingsCompanyView from "@/components/admin/settings/SettingsCompanyView";
import SettingsOrdersView from "@/components/admin/settings/SettingsOrdersView";
import SettingsEventsView from "@/components/admin/settings/SettingsEventsView";
import SettingsCalendarView from "@/components/admin/settings/SettingsCalendarView";
import SettingsDishesView from "@/components/admin/settings/SettingsDishesView";
import SettingsFormView from "@/components/admin/settings/SettingsFormView";
import SettingsDeliveryView from "@/components/admin/settings/SettingsDeliveryView";
import SettingsUsersView from "@/components/admin/settings/SettingsUsersView";

const Admin = () => {
  const [activeSection, setActiveSection] = useState<AdminSection>("orders");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isAuthenticated, loading, logout } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Ładowanie…</div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onLogout={logout}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
      />
      <main className="flex-1 p-8 overflow-auto">
        {activeSection === "orders" && <OrdersView />}
        {activeSection === "clients" && <ClientsView />}
        {activeSection === "reports" && <ReportsView />}
        {activeSection === "settings-company" && <SettingsCompanyView />}
        {activeSection === "settings-orders" && <SettingsOrdersView />}
        {activeSection === "settings-events" && <SettingsEventsView />}
        {activeSection === "settings-calendar" && <SettingsCalendarView />}
        {activeSection === "settings-dishes" && <SettingsDishesView />}
        {activeSection === "settings-form" && <SettingsFormView />}
        {activeSection === "settings-delivery" && <SettingsDeliveryView />}
        {activeSection === "settings-users" && <SettingsUsersView />}
      </main>
    </div>
  );
};

export default Admin;
