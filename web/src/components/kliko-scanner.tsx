"use client";

// Camera-scanner voor kliko-QR-labels (html5-qrcode via getUserMedia).
// Dynamische import in useEffect: de library raakt browser-API's aan en mag
// dus nooit tijdens SSR/build laden. Camera werkt alleen op HTTPS of
// localhost; zonder camera(-toestemming) tonen we een nette melding en
// blijft de pagina gewoon werken.
import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { useI18n } from "@/lib/i18n";

const SCANNER_ELEMENT_ID = "kliko-qr-scanner";

export function KlikoScanner({
  onGescand,
  onSluit,
}: {
  /** Ruwe QR-tekst (label-URL of kale id). Wordt 1x aangeroepen per sessie. */
  onGescand: (tekst: string) => void;
  onSluit: () => void;
}) {
  const { t } = useI18n();
  const [cameraFout, setCameraFout] = useState(false);
  // Dubbel-vuren voorkomen: html5-qrcode blijft callbacks sturen tot stop().
  const klaarRef = useRef(false);

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;
    let gestopt = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (gestopt) return;
        scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          (tekst) => {
            if (klaarRef.current) return;
            klaarRef.current = true;
            onGescand(tekst);
          },
          // Per-frame "geen QR gevonden" meldingen: negeren.
          undefined
        );
      } catch {
        // Geen camera, geen toestemming, of geen HTTPS.
        if (!gestopt) setCameraFout(true);
      }
    })();

    return () => {
      gestopt = true;
      if (scanner) {
        // stop() gooit als de camera nooit gestart is; dat is hier prima.
        scanner
          .stop()
          .catch(() => {})
          .finally(() => scanner?.clear());
      }
    };
    // onGescand bewust niet in deps: de scanner-sessie hoort 1x te starten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-kliko-navy">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-bold text-white">{t("kliko.scan.title")}</p>
        <button
          type="button"
          onClick={onSluit}
          className="rounded-full border border-white/30 px-4 py-1.5 text-sm font-bold text-white"
        >
          {t("kliko.scan.stop")}
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8">
        {cameraFout ? (
          <p className="rounded-xl bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white">
            {t("kliko.scan.camera.err")}
          </p>
        ) : (
          <div
            id={SCANNER_ELEMENT_ID}
            className="w-full max-w-sm overflow-hidden rounded-2xl"
          />
        )}
      </div>
    </div>
  );
}
