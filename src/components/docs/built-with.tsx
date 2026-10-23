import Image from "next/image";
import { MARKETING_URL } from "@/lib/brand";

export function BuiltWithOpentip() {
  return (
    <a
      href={MARKETING_URL}
      className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs text-foreground"
    >
      <Image src="/brand/mark-blue.png" alt="" width={14} height={14} />
      Built with Opentip
    </a>
  );
}
