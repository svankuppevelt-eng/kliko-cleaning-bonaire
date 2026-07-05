// Client-helper voor het versturen van e-mail via de eigen server-route
// /api/mail (die Resend aanroept; de API-key blijft server-side).
//
// verstuurMail() gooit bewust NOOIT: het resultaat vertelt of het gelukt is
// en of mail uberhaupt al geconfigureerd is, zodat aanroepers (aanmeldflow,
// factuur-knop) zelf kiezen hoe ze een mislukking tonen of stil negeren.

export interface MailBijlage {
  filename: string;
  /** Base64-gecodeerde bestandsinhoud (zonder data:-prefix). */
  base64: string;
}

export interface VerstuurResultaat {
  ok: boolean;
  /** false = RESEND_API_KEY/MAIL_FROM nog niet gezet ("mail nog niet actief"). */
  configured: boolean;
  error?: string;
}

export async function verstuurMail(input: {
  to: string;
  subject: string;
  html: string;
  attachment?: MailBijlage;
}): Promise<VerstuurResultaat> {
  try {
    const res = await fetch("/api/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as Partial<VerstuurResultaat>;
    return {
      ok: data.ok === true,
      configured: data.configured !== false,
      ...(data.error ? { error: data.error } : {}),
    };
  } catch {
    return { ok: false, configured: true, error: "Netwerkfout" };
  }
}

function escapeHtml(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Verpak een platte template-body (uit de office-editor, met regeleindes)
 * in een simpele HTML-mail in de Kliko-huisstijl. Alle styling inline,
 * want mailclients slikken geen stylesheets.
 */
export function mailHtml(bodyTekst: string): string {
  const inhoud = escapeHtml(bodyTekst).replace(/\n/g, "<br />");
  return `<!doctype html>
<html lang="nl">
  <body style="margin:0;padding:0;background-color:#f2f4f9;">
    <div style="padding:24px 12px;">
      <div style="max-width:560px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #d8dce6;">
        <div style="background-color:#0d2b6a;padding:18px 24px;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#ffffff;">Kliko Cleaning <span style="color:#ffc20e;">Bonaire</span></span>
        </div>
        <div style="padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2a44;">
          ${inhoud}
        </div>
        <div style="padding:14px 24px;border-top:1px solid #e4e7ef;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;">
          Kliko Cleaning Bonaire &bull; Kralendijk, Bonaire
        </div>
      </div>
    </div>
  </body>
</html>`;
}
