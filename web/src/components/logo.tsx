// Kliko Cleaning Bonaire — echte merk-logo's (transparante PNG in /public).
import Image from "next/image";

// Horizontaal primair logo incl. woordmerk. Bron: public/primary.png (1640x924).
export function LogoPrimary({
  height = 48,
  className = "",
  priority = false,
}: {
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/primary.png"
      alt="Kliko Cleaning Bonaire"
      width={1640}
      height={924}
      priority={priority}
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}

// Vierkant embleem / icoon. Bron: public/icon.png (2000x2000).
export function LogoMark({
  size = 40,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/icon.png"
      alt="Kliko Cleaning Bonaire"
      width={2000}
      height={2000}
      priority={priority}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
