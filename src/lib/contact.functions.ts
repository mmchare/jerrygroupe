import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";

import { CONTACT_INBOX, contactMessageSchema, isContactRateLimited } from "./contact-rules";

export type ContactResult = { ok: true } | { ok: false; error: "invalid" | "rateLimited" | "submitFailed" };

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

    // Same message sent twice (double click, retry): already stored.
    const { data: already } = await supabaseAdmin
      .from("contact_messages")
      .select("id")
      .eq("client_message_id", data.clientMessageId)
      .maybeSingle();
    if (already) return { ok: true };

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
    if (error) {
      if (error.code === "23505") return { ok: true };
      console.error("[contact] insert failed", error.message);
      return { ok: false, error: "submitFailed" };
    }
    return { ok: true };
  });
