import Image from "next/image";
import { MARKETING_URL } from "@/lib/brand";

export function BuiltWithOpentip({ placement = "fixed" }: { placement?: "fixed" | "inline" }) {
  return (
    <a
      href={MARKETING_URL}
      className={
        placement === "fixed"
          ? "fixed right-4 bottom-4 z-40 hidden items-center gap-1.5 rounded-control border border-border bg-white px-3 py-1.5 text-xs text-foreground md:inline-flex dark:bg-card"
          : "inline-flex items-center gap-1.5 self-start rounded-control border border-border bg-white px-3 py-1.5 text-xs text-foreground md:hidden dark:bg-card"
      }
    >
      <Image src="/brand/mark-blue.png" alt="" width={14} height={14} />
      Built with Opentip
    </a>
  );
}
