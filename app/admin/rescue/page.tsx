import { DashboardShell } from "@/components/DashboardShell";
import { listRescueQueue } from "@/lib/rescueQueue";
import { RescueQueueRow } from "./RescueQueueRow";

/**
 * Scan Rescue — the owner's human-research inbox. Failed scans land here as
 * queue items; the owner pastes the reviews they researched into the
 * library, rescans the corpus for a verdict, and emails the customer.
 */
export default async function AdminRescuePage() {
  const [pending, rescued, emailed] = await Promise.all([
    listRescueQueue("pending", 50),
    listRescueQueue("rescued", 20),
    listRescueQueue("emailed", 20),
  ]);

  return (
    <DashboardShell
      title="Scan Rescue"
      subtitle="Scans that couldn't be scored. Research the product yourself, paste what you found, and send the customer their verdict."
      experience="admin"
    >
      <section className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <p className="text-sm text-ink/70">
          <strong>{pending.length}</strong> waiting for research. Paste reviews into
          the library, then <strong>Rescore &amp; email</strong> — the verdict is
          computed from the library evidence and the customer gets one service
          email. Guests can&apos;t be emailed; their research still helps the
          next shopper.
        </p>
      </section>

      <div className="mt-4 grid gap-4">
        {pending.length === 0 && rescued.length === 0 ? (
          <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <p className="text-sm font-bold text-ink">The rescue queue is empty.</p>
            <p className="mt-2 text-sm text-ink/70">
              Failed scans will appear here automatically as you shop.
            </p>
          </section>
        ) : null}
        {pending.map((row) => (
          <RescueQueueRow key={row.id} row={row} />
        ))}
      </div>

      {rescued.length > 0 ? (
        <>
          <h2 className="mt-8 text-lg font-black text-ink">Rescued</h2>
          <div className="mt-4 grid gap-4">
            {rescued.map((row) => (
              <RescueQueueRow key={row.id} row={row} />
            ))}
          </div>
        </>
      ) : null}

      {emailed.length > 0 ? (
        <>
          <h2 className="mt-8 text-lg font-black text-ink">Verdict emailed</h2>
          <div className="mt-4 grid gap-4">
            {emailed.map((row) => (
              <RescueQueueRow key={row.id} row={row} readonly />
            ))}
          </div>
        </>
      ) : null}
    </DashboardShell>
  );
}
