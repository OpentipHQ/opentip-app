import { getViewSession } from "@/lib/admin/act-as";
import { requestMoreAction } from "@/app/(product)/dashboard/credit-actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { loadCreditView } from "@/lib/credits/view";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const session = await getViewSession();
  if (!session) return null;
  const usage = await loadCreditView(session.userId);
  const peak = Math.max(1, ...usage.days.map((day) => day.credits));
  const workspacePeak = Math.max(1, ...usage.workspaces.map((row) => row.credits));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Usage</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-control border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Credits left</p>
            <span className="rounded-control border border-meter px-2 py-0.5 text-xs text-link">Beta</span>
          </div>
          <p className="text-5xl tracking-tight">
            {Math.max(0, usage.balance)}
            <span className="ml-2 text-base text-muted-foreground">credits</span>
          </p>
          <p className="text-sm text-muted-foreground">{usage.refill}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={usage.low ? "h-full bg-warning" : "h-full bg-meter"}
              style={{ width: `${usage.granted === 0 ? 0 : Math.min(100, (usage.used / usage.granted) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{usage.used} used</span>
            <span>{usage.granted} granted this period</span>
          </div>
          <form action={requestMoreAction}>
            <SubmitButton>Request more</SubmitButton>
          </form>
        </section>
        <section className="rounded-control border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm">Credits spent per day</p>
            <p className="text-xs text-muted-foreground">{usage.days[0]?.label ?? ""} to today</p>
          </div>
          <div className="flex h-36 items-end gap-1">
            {usage.days.map((day) => (
              <div key={day.day} className="flex h-full flex-1 items-end" title={`${day.label} ${day.credits}`}>
                <div
                  className="w-full rounded-t-sm bg-meter"
                  style={{ height: `${Math.max(day.credits > 0 ? 6 : 0, (day.credits / peak) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{usage.days[0]?.label ?? ""}</span>
            <span>Today</span>
          </div>
        </section>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-5 rounded-control border border-border bg-card p-5">
          <div>
            <p className="mb-3 text-sm">By workspace</p>
            <div className="flex flex-col gap-3">
              {usage.workspaces.length === 0 ? <p className="text-sm text-muted-foreground">0</p> : null}
              {usage.workspaces.map((row) => (
                <div key={row.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{row.name}</span>
                    <span>{row.credits}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-meter" style={{ width: `${(row.credits / workspacePeak) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm">By action</p>
            <div className="flex flex-col gap-2 text-sm">
              {usage.actions.length === 0 ? <p className="text-muted-foreground">0</p> : null}
              {usage.actions.map((row) => (
                <div key={row.name} className="flex justify-between">
                  <span>{row.name}</span>
                  <span>{row.credits}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="rounded-control border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm">Credit history</p>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border pb-2 text-xs tracking-wide text-muted-foreground uppercase">
            <span>What</span>
            <span>Credits</span>
            <span>When</span>
          </div>
          <div className="divide-y divide-border">
            {usage.history.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_auto_auto] gap-3 py-3 text-sm">
                <span>{row.label}</span>
                <span className={row.amount > 0 ? "text-emerald-500" : ""}>
                  {row.amount > 0 ? `+${row.amount}` : row.amount}
                </span>
                <span className="text-muted-foreground">{row.when}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
