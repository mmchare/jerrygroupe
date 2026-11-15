import { APICallError, convertToModelMessages, safeValidateUIMessages, type UIMessage } from "ai";

import { isLang, type Lang } from "@/i18n";
import {
  createRateLimiter,
  isAcceptableQuestion,
  RELAY_SECRET_HEADER,
  RELAY_VISITOR_HEADER,
  resolveVisitorKey,
  trimHistory,
} from "./chat-rules";
import { getSiteKnowledge } from "./knowledge.server";
import { createResponsesCall } from "./responses.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";
// Lovable-hosted copy of the site that holds the AI key; other deployments (e.g. Vercel) relay to it.
const DEFAULT_UPSTREAM = "https://jerry-six-division-portal.lovable.app";
const RELAYED_HEADER = "x-jg-relayed";

// Per-instance guard; complements the per-message and history caps.
const allowVisitor = createRateLimiter();

const ERRORS = {
  en: {
    invalid: "Your message could not be sent. Please keep it under 1,500 characters.",
    rate: "You have asked many questions in a short time. Please try again in a few minutes.",
    busy: "The assistant is very busy right now. Please try again in a moment.",
    unavailable: "The assistant is temporarily unavailable. Please use the Contact page or try again later.",
  },
  fr: {
    invalid: "Votre message n’a pas pu être envoyé. Merci de ne pas dépasser 1 500 caractères.",
    rate: "Vous avez posé beaucoup de questions en peu de temps. Merci de réessayer dans quelques minutes.",
    busy: "L’assistant est très sollicité. Merci de réessayer dans un instant.",
    unavailable: "L’assistant est momentanément indisponible. Utilisez la page Contact ou réessayez plus tard.",
  },
} as const;

function instructions(lang: Lang, knowledge: string) {
  return `You are the official virtual assistant of the JERRY GROUP website. You answer visitors' questions about JERRY GROUP, its divisions, leadership, global presence, legal entity and how to submit or track a business proposal.

Rules:
- Reply in the visitor's language (English or French). The site is currently displayed in ${lang === "fr" ? "French" : "English"}; use it when unsure.
- Use only the reference information below. If the answer is not there, say so politely and suggest the Contact page (/contact). Never invent facts, figures, people, prices, email addresses, phone numbers, partnerships or commitments.
- You cannot see, look up or change any proposal or its status. For a specific proposal, direct the visitor to Track Your Proposal (/track-proposal) with their reference and the email or WhatsApp number used at submission. Never ask for or accept personal details, documents or payment information in this chat.
- You never make commitments, approvals, valuations or purchase decisions: all proposals are reviewed by people at JERRY GROUP.
- Politely decline topics unrelated to JERRY GROUP.
- Keep a courteous, institutional tone. Be concise: two to five short sentences or a short list. When useful, link to site pages with Markdown links such as [Submit a proposal](/submit-proposal).

Reference information:
${knowledge}`;
}

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function clientAddress(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    ""
  );
}

/**
 * Deployments without LOVABLE_API_KEY (such as Vercel) forward the visitor's question, server to
 * server, to the Lovable-hosted site, which answers with Lovable AI. The key never leaves Lovable.
 */
export async function relayChat(request: Request, rawBody: string, lang: Lang): Promise<Response> {
  const copy = ERRORS[lang];
  if (request.headers.get(RELAYED_HEADER)) {
    console.error("[chat] relayed request reached a deployment without LOVABLE_API_KEY");
    return json(500, copy.unavailable);
  }
  const upstreamBase = (process.env["ASSISTANT_UPSTREAM_URL"] || DEFAULT_UPSTREAM).replace(/\/+$/, "");
  if (upstreamBase === new URL(request.url).origin) return json(500, copy.unavailable);

  const headers = new Headers({ "content-type": "application/json", [RELAYED_HEADER]: "1" });
  const secret = process.env["ASSISTANT_RELAY_SECRET"];
  const visitor = clientAddress(request);
  if (secret && visitor) {
    headers.set(RELAY_SECRET_HEADER, secret);
    headers.set(RELAY_VISITOR_HEADER, visitor);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${upstreamBase}/api/chat`, {
      method: "POST",
      headers,
      body: rawBody,
      signal: request.signal,
    });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    console.error("[chat] relay failed", error);
    return json(502, copy.unavailable);
  }

  const out = new Headers({ "cache-control": "no-cache" });
  for (const [name, value] of upstream.headers) {
    const lower = name.toLowerCase();
    if (lower === "content-type" || lower === "x-vercel-ai-ui-message-stream" || lower.startsWith("x-lovable-aig-")) {
      out.set(name, value);
    }
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export async function handleChat(request: Request): Promise<Response> {
  let body: { messages?: unknown; lang?: unknown };
  let rawBody: string;
  try {
    rawBody = await request.text();
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return json(400, ERRORS.en.invalid);
  }
  const lang: Lang = isLang(body.lang) ? body.lang : "en";
  const copy = ERRORS[lang];

  const validated = await safeValidateUIMessages<UIMessage>({ messages: body.messages });
  if (!validated.success || !isAcceptableQuestion(validated.data)) return json(400, copy.invalid);

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return relayChat(request, rawBody, lang);

  if (!allowVisitor(resolveVisitorKey(request.headers, process.env["ASSISTANT_RELAY_SECRET"]))) {
    return json(429, copy.rate);
  }

  let knowledge: string;
  try {
    knowledge = await getSiteKnowledge(lang);
  } catch (error) {
    console.error("[chat] site knowledge failed", error);
    return json(503, copy.unavailable);
  }

  const history = trimHistory(validated.data);
  const messages = await convertToModelMessages(history.map(({ id: _id, ...rest }) => rest));

  return createResponsesCall(
    request,
    { baseURL: GATEWAY_URL, apiKey, model: MODEL },
    messages,
    instructions(lang, knowledge),
    (error) => {
      console.error("[chat] gateway error", error);
      if (APICallError.isInstance(error) && error.statusCode === 429) return copy.busy;
      return copy.unavailable;
    },
  );
}
