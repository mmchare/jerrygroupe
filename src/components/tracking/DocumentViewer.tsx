import { Download, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/I18nProvider";

export type ViewerState = { url: string; title: string; mimeType: string; onDownload: () => void } | null;

export function DocumentViewer({ state, onClose }: { state: ViewerState; onClose: () => void }) {
  const { t } = useI18n();
  const isImage = state?.mimeType.startsWith("image/");
  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-4 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="pr-8 text-navy">{state?.title ?? t.portal.viewerTitle}</DialogTitle>
          <DialogDescription className="text-xs">
            {t.portal.linkExpiresNote} <span className="sm:hidden">{t.portal.viewerMobileHint}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto border border-border bg-muted">
          {state &&
            (isImage ? (
              <img src={state.url} alt={state.title} className="mx-auto max-h-full object-contain" />
            ) : (
              <iframe
                src={state.url}
                title={state.title}
                className="size-full min-h-[60vh] bg-card"
                referrerPolicy="no-referrer"
              />
            ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {state && (
            <Button asChild variant="outline-navy">
              <a href={state.url} target="_blank" rel="noreferrer noopener">
                <ExternalLink /> {t.portal.open}
              </a>
            </Button>
          )}
          <Button variant="gold" onClick={() => state?.onDownload()}>
            <Download /> {t.portal.download}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
