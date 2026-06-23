import LayoutModeSettings from "@/components/LayoutModeSettings";
import { AdminDailyCheckCenter } from "@/components/AdminDailyCheckCenter";
import { AdminSpeedTest } from "@/components/AdminSpeedTest";
import { DeveloperQACenter } from "@/components/DeveloperQACenter";
import { DashboardShell } from "@/components/DashboardShell";

export default function AdminSystemPage() {
  return (
    <DashboardShell
      title="System Checks"
      subtitle="Run health checks, diagnostics, route checks, and speed checks without crowding the main admin dashboard."
      experience="admin"
    >
      <div className="space-y-6">
        <AdminDailyCheckCenter />
        <DeveloperQACenter />
        <AdminSpeedTest />
      </div>
    </DashboardShell>
  );
}

<LayoutModeSettings />
