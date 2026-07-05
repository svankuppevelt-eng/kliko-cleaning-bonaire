"use client";

// QR-code als <img> voor een kliko-label. Genereert client-side een data-URL
// met de `qrcode` library; geen netwerk nodig, werkt dus ook op de printpagina.
// Krijgt een pad ("/kliko/<id>") en plakt daar zelf window.location.origin
// voor: zo staat in de QR een volledige URL die ook met een gewone
// telefooncamera werkt, zonder dat de aanroepende pagina `window` nodig heeft.
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function KlikoQr({
  pad,
  size,
  className,
}: {
  /** App-pad dat in de QR komt, bv. "/kliko/<containerId>". */
  pad: string;
  /** Renderbreedte in px (de QR wordt scherp gegenereerd op 2x). */
  size: number;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let actief = true;
    QRCode.toDataURL(`${window.location.origin}${pad}`, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0d2b6a", light: "#ffffff" },
    })
      .then((d) => {
        if (actief) setDataUrl(d);
      })
      .catch(() => {
        // QR genereren faalt vrijwel nooit; laat dan het grijze vlak staan.
      });
    return () => {
      actief = false;
    };
  }, [pad, size]);

  if (!dataUrl) {
    return (
      <div
        aria-hidden="true"
        className={`rounded bg-kliko-navy/5 ${className ?? ""}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="QR"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
