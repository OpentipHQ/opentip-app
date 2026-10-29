import Link from "next/link";
import { lowBalanceSentence } from "@/lib/credits/config";
import { isLowBalance } from "@/lib/credits/math";
import { creditBalanceFor } from "@/lib/credits/apply";

export async function LowBalanceBanner({ userId }: { userId: string }) {
  const balance = await creditBalanceFor(userId);
  if (!isLowBalance(balance)) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-warning/40 bg-warning/10 px-4 py-2 text-sm">
      <span className="flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-warning" />
        {lowBalanceSentence(balance, new Date())}
      </span>
      <Link href="/dashboard/usage" className="text-link">
        Request more
      </Link>
    </div>
  );
}
