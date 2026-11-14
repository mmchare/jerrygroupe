import { APICallError, convertToModelMessages, safeValidateUIMessages, type UIMessage } from "ai";

import { isLang, type Lang } from "@/i18n";
import { createRateLimiter, isAcceptableQuestion, trimHistory } from "./chat-rules";
import { getSiteKnowledge } from "./knowledge.server";
import { createResponsesCall } from "./responses.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

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

function visitorKey(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function handleChat(request: Request): Promise<Response> {
  let body: { messages?: unknown; lang?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, ERRORS.en.invalid);
  }
  const lang: Lang = isLang(body.lang) ? body.lang : "en";
  const copy = ERRORS[lang];

  const validated = await safeValidateUIMessages<UIMessage>({ messages: body.messages });
  if (!validated.success || !isAcceptableQuestion(validated.data)) return json(400, copy.invalid);
  if (!allowVisitor(visitorKey(request))) return json(429, copy.rate);

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    console.error("[chat] LOVABLE_API_KEY is not configured");
    return json(500, copy.unavailable);
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
