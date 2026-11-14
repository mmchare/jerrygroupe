import { lazy, Suspense, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { MessageCircle, X } from "lucide-react";

import emblem from "@/assets/concierge-emblem.jpg";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

const ChatPanel = lazy(() => import("./ChatPanel"));

/** Floating site assistant: a bubble in the corner that opens the chat window on every page. */
export function ChatWidget() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const toggle = () => {
    setMounted(true);
    setOpen((v) => !v);
  };

  return (
    <ClientOnly fallback={null}>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
        {mounted && (
          <div
            id="jg-assistant"
            role="dialog"
            aria-label={t.chat.title}
            aria-hidden={!open}
            className={cn(
              "flex h-[min(640px,calc(100dvh-7rem))] w-[calc(100vw-2rem)] max-w-[400px] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-card transition-all duration-200",
              open ? "translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-3 opacity-0",
            )}
          >
            <Suspense fallback={<div className="flex-1 animate-pulse bg-muted/40" />}>
              <ChatPanel open={open} onClose={() => setOpen(false)} />
            </Suspense>
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="jg-assistant"
          aria-label={open ? t.chat.close : t.chat.open}
          className="group flex h-14 items-center gap-3 rounded-full border border-gold/60 bg-navy pl-1.5 pr-5 text-ivory shadow-gold transition-colors hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {open ? (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ivory/10">
              <X className="h-5 w-5 text-gold" aria-hidden />
            </span>
          ) : (
            <img src={emblem} alt="" width={44} height={44} className="h-11 w-11 rounded-full" />
          )}
          <span className="hidden text-sm font-medium tracking-wide sm:inline">
            {open ? t.chat.close : t.chat.open}
          </span>
          {!open && <MessageCircle className="h-4 w-4 text-gold sm:hidden" aria-hidden />}
        </button>
      </div>
    </ClientOnly>
  );
}
