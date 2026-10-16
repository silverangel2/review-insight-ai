import { DashboardShell } from "@/components/DashboardShell";
import { OwnerFeedIngestForm } from "./OwnerFeedIngestForm";

export default function AdminOwnerFeedPage() {
  return (
    <DashboardShell
      title="Owner Feed Ingestion"
      subtitle="Load a hand-fed review batch (.md from the review-library inbox) into the product library. Re-ingesting the same batch adds nothing."
      experience="admin"
    >
      <OwnerFeedIngestForm />
    </DashboardShell>
  );
}
