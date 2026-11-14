import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { RotateCcw, X } from "lucide-react";

import emblem from "@/assets/concierge-emblem.jpg";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useI18n } from "@/i18n/I18nProvider";
import { CHAT_MAX_MESSAGE_CHARS } from "@/lib/chat/chat-rules";

const STORAGE_KEY = "jg_assistant_v1";

function readStored(): UIMessage[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

function writeStored(messages: UIMessage[]) {
  try {
    if (messages.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
  } catch {
    // Storage full or unavailable: the conversation simply won't survive a reload.
  }
}

/** Server errors arrive as JSON `{ error }`; stream errors as plain text. */
function readableError(error: Error | undefined, fallback: string) {
  if (!error?.message) return fallback;
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
  } catch {
    // Not JSON: already a readable message from the stream.
  }
  return error.message.length < 300 ? error.message : fallback;
}

function textOf(message: UIMessage) {
  return message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

export default function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useI18n();
  const langRef = useRef(lang);
  langRef.current = lang;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const [transport] = useState(
    () => new DefaultChatTransport({ api: "/api/chat", body: () => ({ lang: langRef.current }) }),
  );
  const { messages, sendMessage, setMessages, status, stop, error, clearError } = useChat({
    id: "jerry-site-assistant",
    transport,
  });
  const busy = status === "submitted" || status === "streaming";

  // Restore the visitor's conversation from this browser (idempotent, safe under StrictMode).
  useEffect(() => {
    setMessages(readStored());
    setRestored(true);
  }, [setMessages]);

  useEffect(() => {
    if (restored && !busy) writeStored(messages);
  }, [messages, busy, restored]);

  const focusInput = useCallback(() => {
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  useEffect(() => {
    if (open && !busy) focusInput();
  }, [open, busy, focusInput]);

  const send = (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    if (value.length > CHAT_MAX_MESSAGE_CHARS) {
      setLocalError(t.chat.tooLong);
      return;
    }
    setLocalError(null);
    clearError();
    void sendMessage({ text: value });
    focusInput();
  };

  const handleSubmit = (message: PromptInputMessage) => send(message.text);

  const reset = () => {
    stop();
    setMessages([]);
    writeStored([]);
    setLocalError(null);
    clearError();
    focusInput();
  };

  const last = messages.at(-1);
  const waiting = busy && (last?.role !== "assistant" || textOf(last).length === 0);
  const errorText = localError ?? (error ? readableError(error, t.chat.error) : null);

  return (
    <>
      <header className="flex items-center gap-3 bg-navy px-4 py-3 text-ivory">
        <img src={emblem} alt="" width={40} height={40} className="h-10 w-10 rounded-full ring-1 ring-gold/50" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base leading-tight">{t.chat.title}</p>
          <p className="truncate text-xs text-ivory/65">{t.chat.subtitle}</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={reset}
            title={t.chat.reset}
            aria-label={t.chat.reset}
            className="rounded-md p-2 text-ivory/70 transition-colors hover:bg-ivory/10 hover:text-gold"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t.chat.close}
          className="rounded-md p-2 text-ivory/70 transition-colors hover:bg-ivory/10 hover:text-gold"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <Conversation className="bg-background">
        <ConversationContent className="gap-5 px-4 py-5">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-4 pt-2">
              <div>
                <span className="gold-rule" />
                <p className="mt-4 font-display text-xl text-navy">{t.chat.welcome}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.chat.welcomeBody}</p>
              </div>
              <div className="flex flex-col gap-2">
                {t.chat.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-md border border-border bg-card px-3 py-2.5 text-left text-sm text-navy transition-colors hover:border-gold hover:bg-gold-soft"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground leading-relaxed">
                  {message.parts.map((part, i) =>
                    part.type === "text" ? (
                      message.role === "assistant" ? (
                        <MessageResponse
                          key={i}
                          className="text-sm [&_a]:font-medium [&_a]:text-institutional [&_a]:underline [&_a]:decoration-gold [&_a]:underline-offset-2"
                        >
                          {part.text}
                        </MessageResponse>
                      ) : (
                        <p key={i} className="whitespace-pre-wrap">
                          {part.text}
                        </p>
                      )
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {waiting && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer className="text-sm">{t.chat.thinking}</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-card px-3 pb-3 pt-3">
        {errorText && (
          <p role="alert" className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errorText}
          </p>
        )}
        <PromptInput onSubmit={handleSubmit} className="rounded-md">
          <PromptInputTextarea
            ref={textareaRef}
            placeholder={t.chat.placeholder}
            maxLength={CHAT_MAX_MESSAGE_CHARS}
            className="min-h-12 text-sm"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit
              status={status}
              onStop={stop}
              aria-label={busy ? t.chat.stop : t.chat.send}
              className="bg-navy text-ivory hover:bg-institutional"
            />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-[0.68rem] leading-snug text-muted-foreground">{t.chat.disclaimer}</p>
      </div>
    </>
  );
}
