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

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": data.clientMessageId,
      },
      body: JSON.stringify({
        from,
        to: [CONTACT_INBOX],
        reply_to: data.email,
        subject: `[Contact site] ${data.subject}`,
        text,
        html: `<h2>New message from the JERRY GROUP contact form</h2>
          <p><strong>Name:</strong> ${escapeHtml(data.fullName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
          <p><strong>Company:</strong> ${escapeHtml(data.companyName || "—")}</p>
          <p><strong>Language:</strong> ${escapeHtml(data.language)}</p>
          <hr /><p>${escapeHtml(data.message).replace(/\r?\n/g, "<br />")}</p>`,
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

async function checkContactRateLimit(data: ContactEmail): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: already, error: lookupError } = await supabaseAdmin
      .from("contact_messages")
      .select("id")
      .eq("client_message_id", data.clientMessageId)
      .maybeSingle();
    if (lookupError) {
      console.error("[contact] duplicate lookup failed; continuing without database rate limit", lookupError.message);
      return false;
    }
    if (already) return false;

    const ipHash = await hashIp();
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    let ipCount = 0;
    if (ipHash) {
      const { count, error } = await supabaseAdmin
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", hourAgo);
      if (error) console.error("[contact] IP rate-limit lookup failed", error.message);
      else ipCount = count ?? 0;
    }
    const { count: emailCount, error: emailCountError } = await supabaseAdmin
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .ilike("email", data.email)
      .gte("created_at", dayAgo);
    if (emailCountError) console.error("[contact] email rate-limit lookup failed", emailCountError.message);
    return isContactRateLimited(ipCount, emailCount ?? 0);
  } catch (error) {
    console.error("[contact] database unavailable; continuing with email delivery", error instanceof Error ? error.message : "unknown error");
    return false;
  }
}

async function storeContactMessage(data: ContactEmail): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ipHash = await hashIp();
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
      console.error("[contact] message delivered by email but database insert failed", error.message);
    }
  } catch (error) {
    console.error("[contact] message delivered by email but database is unavailable", error instanceof Error ? error.message : "unknown error");
  }
}

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactMessageSchema.parse(input))
  .handler(async ({ data }): Promise<ContactResult> => {
    if (data.website) return { ok: true };

    const contactEmail: ContactEmail = {
      fullName: data.fullName,
      email: data.email,
      companyName: data.companyName,
      subject: data.subject,
      message: data.message,
      language: data.language,
      clientMessageId: data.clientMessageId,
    };

    if (await checkContactRateLimit(contactEmail)) return { ok: false, error: "rateLimited" };
    if (!(await sendContactEmail(contactEmail))) return { ok: false, error: "emailFailed" };

    // Storage is optional; successful email delivery remains successful even if Lovable Supabase is unavailable.
    await storeContactMessage(contactEmail);
    return { ok: true };
  });
