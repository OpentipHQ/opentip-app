import Image from "next/image";
import Link from "next/link";

export function OpentipLockup({
  href = "/dashboard",
  mark = 20,
  word = true,
}: {
  href?: string;
  mark?: number;
  word?: boolean;
}) {
  return (
    <Link href={href} className="inline-flex items-center gap-2">
      <Image src="/brand/mark-blue.png" alt="" width={mark} height={mark} />
      {word ? <span className="text-sm tracking-tight">Opentip</span> : null}
    </Link>
  );
}

export function OpentipMark({ size = 40 }: { size?: number }) {
  return <Image src="/brand/mark-blue.png" alt="Opentip" width={size} height={size} priority />;
}
