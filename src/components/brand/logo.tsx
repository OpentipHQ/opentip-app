import Image from "next/image";
import Link from "next/link";

function LogoMark({
  size,
  alt,
  priority = false,
}: {
  size: number;
  alt: string;
  priority?: boolean;
}) {
  return (
    <>
      <Image
        src="/brand/mark-black.png"
        alt={alt}
        width={size}
        height={size}
        priority={priority}
        className="dark:hidden"
      />
      <Image
        src="/brand/mark-white.png"
        alt={alt}
        width={size}
        height={size}
        priority={priority}
        className="hidden dark:block"
      />
    </>
  );
}

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
      <LogoMark size={mark} alt="" />
      {word ? <span className="text-sm tracking-tight">Opentip</span> : null}
    </Link>
  );
}

export function OpentipMark({ size = 40 }: { size?: number }) {
  return <LogoMark size={size} alt="Opentip" priority />;
}
