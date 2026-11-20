import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";

import { CONTACT_INBOX, contactMessageSchema, isContactRateLimited } from "./contact-rules";

export type ContactResult = { ok: true } | { ok: false; error: "invalid" | "rateLimited" | "submitFailed" | "emailFailed" };

type ContactEmail = {
  fullName: string;
  email: string;
  companyName?: string;
  subject: string;
  message: string;
  language: "en" | "fr";
  clientMessageId: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

/** Deliver through Resend's HTTPS API (SMTP ports are unavailable on Vercel). */
async function sendContactEmail(data: ContactEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error("[contact] email not sent: RESEND_API_KEY or CONTACT_FROM_EMAIL is missing");
    return false;
  }

  const text = [
    `Name: ${data.fullName}`,
    `Email: ${data.email}`,
    `Company: ${data.companyName || "—"}`,
    `Language: ${data.language}`,
    "",
    data.message,
  ].join("\n");
  const html = `
    <h2>New message from the JERRY GROUP contact form</h2>
    <p><strong>Name:</strong> ${escapeHtml(data.fullName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
    <p><strong>Company:</strong> ${escapeHtml(data.companyName || "—")}</p>
    <p><strong>Language:</strong> ${escapeHtml(data.language)}</p>
    <hr />
    <p>${escapeHtml(data.message).replace(/\r?\n/g, "<br />")}</p>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Repeated submissions/retries of the same form use the same provider idempotency key.
        "Idempotency-Key": data.clientMessageId,
      },
      body: JSON.stringify({
        from,
        to: [CONTACT_INBOX],
        reply_to: data.email,
        subject: `[Contact site] ${data.subject}`,
        text,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`[contact] email delivery failed (Resend HTTP ${response.status})`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[contact] email delivery request failed", error instanceof Error ? error.name : "unknown error");
    return false;
  }
}

async function hashIp(): Promise<string | null> {
  const ip = getRequestIP({ xForwardedFor: true });
  if (!ip) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`jg:${ip}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactMessageSchema.parse(input))
  .handler(async ({ data }): Promise<ContactResult> => {
    // Honeypot filled: pretend success, store nothing.
    if (data.website) return { ok: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Keep retries deliverable if the previous email attempt failed. Resend deduplicates
    // requests with this client message ID via the Idempotency-Key header.
    const { data: already, error: lookupError } = await supabaseAdmin
      .from("contact_messages")
      .select("id")
      .eq("client_message_id", data.clientMessageId)
      .maybeSingle();
    if (lookupError) {
      console.error("[contact] duplicate lookup failed", lookupError.message);
      return { ok: false, error: "submitFailed" };
    }

    if (!already) {
      const ipHash = await hashIp();
      const hourAgo = new Date(Date.now() - 3600_000).toISOString();
      const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
      let ipCount = 0;
      if (ipHash) {
        const { count } = await supabaseAdmin
          .from("contact_messages")
          .select("id", { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .gte("created_at", hourAgo);
        ipCount = count ?? 0;
      }
      const { count: emailCount } = await supabaseAdmin
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .ilike("email", data.email)
        .gte("created_at", dayAgo);
      if (isContactRateLimited(ipCount, emailCount ?? 0)) return { ok: false, error: "rateLimited" };

      const { error } = await supabaseAdmin.from("contact_messages").insert({
        client_message_id: data.clientMessageId,
        full_name: data.fullName,
        email: data.email,
        company_name: data.companyName ?? null,
        subject: data.subject,
        message: data.message,
        language: data.language,
        recipient: CONTACT_INBOX,
        ip_hash: ipHash,
      });
      if (error && error.code !== "23505") {
        console.error("[contact] insert failed", error.message);
        return { ok: false, error: "submitFailed" };
      }
    }

    if (!(await sendContactEmail(data))) return { ok: false, error: "emailFailed" };
    return { ok: true };
  });
