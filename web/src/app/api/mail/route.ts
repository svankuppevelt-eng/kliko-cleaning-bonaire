// Server Route Handler voor het versturen van e-mail via Resend (REST-API,
// geen npm-dependency). Dit MOET server-side: de RESEND_API_KEY mag nooit in
// de browser belanden, daarom staan de env-vars bewust NIET als NEXT_PUBLIC_.
//
// Gedrag zonder env-vars (zelfde patroon als de Firebase-config-fallback):
// zolang RESEND_API_KEY of MAIL_FROM ontbreekt geeft dit endpoint
// { ok: false, configured: false } terug (HTTP 200), zodat de UI netjes
// "mail nog niet actief" kan tonen in plaats van een harde fout.
//
// TODO beveiliging: dit endpoint is nu open (nodig voor de publieke
// aanmeld-bevestiging). Later harden: voor office-triggers (factuur,
// herinnering) een Firebase-auth-ID-token meesturen en hier verifieren,
// plus rate-limiting op de publieke aanmeld-mail.

interface MailBijlage {
  filename: string;
  /** Base64-gecodeerde bestandsinhoud (zonder data:-prefix). */
  base64: string;
}

interface MailVerzoek {
  to: string;
  subject: string;
  html: string;
  attachment?: MailBijlage;
}

/** Valideer de body-vorm; null = ongeldig verzoek. */
function parseVerzoek(data: unknown): MailVerzoek | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.to !== "string" || !/^\S+@\S+\.\S+$/.test(d.to.trim())) return null;
  if (typeof d.subject !== "string" || d.subject.trim() === "") return null;
  if (typeof d.html !== "string" || d.html.trim() === "") return null;

  let attachment: MailBijlage | undefined;
  if (d.attachment !== undefined) {
    if (!d.attachment || typeof d.attachment !== "object") return null;
    const a = d.attachment as Record<string, unknown>;
    if (typeof a.filename !== "string" || a.filename.trim() === "") return null;
    if (typeof a.base64 !== "string" || a.base64 === "") return null;
    attachment = { filename: a.filename, base64: a.base64 };
  }

  return {
    to: d.to.trim(),
    subject: d.subject,
    html: d.html,
    ...(attachment ? { attachment } : {}),
  };
}

export async function POST(req: Request): Promise<Response> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    return Response.json(
      { ok: false, configured: true, error: "Ongeldige JSON-body" },
      { status: 400 }
    );
  }

  const verzoek = parseVerzoek(data);
  if (!verzoek) {
    return Response.json(
      { ok: false, configured: true, error: "Ongeldig mail-verzoek" },
      { status: 400 }
    );
  }

  // Server-only env-vars; zie .env.local.example.
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) {
    // Mail is nog niet geconfigureerd: geen fout, maar een duidelijke status
    // zodat de UI "mail nog niet actief" kan tonen (zelfde idee als
    // isFirebaseConfigured() elders in de app).
    return Response.json({ ok: false, configured: false });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [verzoek.to],
        subject: verzoek.subject,
        html: verzoek.html,
        ...(verzoek.attachment
          ? {
              attachments: [
                {
                  filename: verzoek.attachment.filename,
                  content: verzoek.attachment.base64,
                },
              ],
            }
          : {}),
      }),
    });

    if (!res.ok) {
      // Resend geeft een JSON-foutmelding; kort doorgeven voor debugging,
      // de UI toont zelf een nette vertaalde melding.
      const tekst = await res.text().catch(() => "");
      return Response.json({
        ok: false,
        configured: true,
        error: `Resend ${res.status}: ${tekst.slice(0, 300)}`,
      });
    }

    return Response.json({ ok: true, configured: true });
  } catch {
    return Response.json({
      ok: false,
      configured: true,
      error: "Mailprovider onbereikbaar",
    });
  }
}
