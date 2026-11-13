import { useRef, useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Send, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Field, inputClass } from "@/components/proposal/fields";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/i18n/I18nProvider";
import { ALLOWED_FILE_TYPES, DEFAULT_MAX_FILE_MB, checkAttachment } from "@/lib/proposal-rules";
import { createReplyUpload, submitSupplierReply } from "@/lib/tracking.functions";
import { MAX_REPLY_FILES } from "@/lib/tracking-rules";
import { uploadWithProgress } from "@/lib/upload";
import { cn } from "@/lib/utils";

type Item = { id: string; name: string; size: number; progress: number; status: "uploading" | "done" | "error"; error?: string; path?: string };
type ErrorKey = keyof ReturnType<typeof useI18n>["t"]["errors"];

export function ReplyForm({ token }: { token: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const requestUpload = useServerFn(createReplyUpload);
  const sendReply = useServerFn(submitSupplierReply);
  const messageId = useRef<string | null>(null);
  const getMessageId = () => (messageId.current ??= crypto.randomUUID());
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [items, setItems] = useState<Item[]>([]);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  const [sending, setSending] = useState(false);

  const patch = (id: string, p: Partial<Item>) =>
    setItems((l) => (itemsRef.current = l.map((i) => (i.id === id ? { ...i, ...p } : i))));

  async function addFiles(files: FileList) {
    for (const file of Array.from(files)) {
      if (itemsRef.current.filter((i) => i.status !== "error").length >= MAX_REPLY_FILES) {
        toast.error(t.errors.fileCount);
        return;
      }
      const id = crypto.randomUUID();
      const base: Item = { id, name: file.name, size: file.size, progress: 0, status: "uploading" };
      const problem = checkAttachment(file, DEFAULT_MAX_FILE_MB);
      itemsRef.current = [...itemsRef.current, problem ? { ...base, status: "error", error: t.errors[problem] } : base];
      setItems(itemsRef.current);
      if (problem) continue;
      try {
        const slot = await requestUpload({
          data: { token, clientMessageId: getMessageId(), fileName: file.name, size: file.size, mimeType: file.type },
        });
        if (!slot.ok) throw new Error(slot.error === "expired" ? "linkExpired" : slot.error);
        await uploadWithProgress("proposal-attachments", slot.path, slot.token, file, (p) => patch(id, { progress: p }));
        patch(id, { status: "done", progress: 100, path: slot.path });
      } catch (err) {
        const code = err instanceof Error && err.message in t.errors ? (err.message as ErrorKey) : "uploadFailed";
        patch(id, { status: "error", error: t.errors[code] });
      }
    }
  }

  async function submit() {
    if (message.trim().length < 2) {
      setError(t.errors.required);
      return;
    }
    if (items.some((i) => i.status === "uploading")) {
      toast.error(t.proposal.documents.waitUploads);
      return;
    }
    setSending(true);
    try {
      const res = await sendReply({
        data: {
          token,
          clientMessageId: getMessageId(),
          message: message.trim(),
          attachments: items.filter((i) => i.status === "done" && i.path).map((i) => ({ path: i.path!, originalName: i.name })),
        },
      });
      if (res.ok) {
        toast.success(t.portal.replySent);
        messageId.current = null;
        setMessage("");
        setItems((itemsRef.current = []));
        await queryClient.invalidateQueries({ queryKey: ["supplier-portal", token] });
      } else {
        const key: ErrorKey =
          res.error === "expired" ? "linkExpired" : res.error === "replyClosed" ? "replyClosed" : res.error === "rateLimited" ? "rateLimited" : res.error === "attachmentsMissing" ? "attachmentsMissing" : "submitFailed";
        toast.error(t.errors[key]);
      }
    } catch {
      toast.error(t.errors.submitFailed);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="border border-gold/60 bg-card p-6 shadow-card md:p-8" aria-labelledby="reply-title">
      <h2 id="reply-title" className="text-2xl text-navy">{t.portal.replyTitle}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.portal.replyIntro}</p>
      <div className="mt-6 space-y-5">
        <Field id="reply-message" label={t.portal.replyMessage} error={error}>
          <textarea
            id="reply-message"
            rows={5}
            maxLength={5000}
            className={inputClass}
            value={message}
            aria-invalid={!!error}
            aria-describedby={error ? "reply-message-error" : undefined}
            onChange={(e) => {
              setMessage(e.target.value);
              setError(undefined);
            }}
          />
        </Field>
        <div className="space-y-3">
          <p className="text-sm font-medium text-navy">
            {t.portal.replyFiles} <span className="ml-1 text-xs font-normal text-muted-foreground">({t.common.optional})</span>
          </p>
          <label className="flex cursor-pointer items-center justify-center gap-3 border-2 border-dashed border-input px-6 py-6 text-sm transition-colors hover:border-gold/70">
            <Upload className="size-5 text-gold" aria-hidden />
            <span className="font-semibold text-navy">{t.proposal.documents.drop}</span>
            <input
              type="file"
              multiple
              className="sr-only"
              accept={Object.keys(ALLOWED_FILE_TYPES).map((e) => `.${e}`).join(",")}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {items.length > 0 && (
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.id} className="border border-border bg-background p-3">
                  <div className="flex items-center gap-3">
                    <FileText className="size-4 shrink-0 text-navy/60" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-navy">{i.name}</p>
                      <p className={cn("text-xs", i.status === "error" ? "text-destructive" : "text-muted-foreground")}>
                        {i.status === "uploading" ? `${t.proposal.documents.uploading} ${i.progress}%` : i.status === "done" ? t.proposal.documents.uploaded : i.error}
                      </p>
                    </div>
                    {i.status === "uploading" ? (
                      <Loader2 className="size-4 animate-spin text-gold" />
                    ) : (
                      <button type="button" className="cursor-pointer p-1 text-muted-foreground hover:text-destructive" aria-label={`${t.proposal.documents.remove} ${i.name}`} onClick={() => setItems((l) => (itemsRef.current = l.filter((x) => x.id !== i.id)))}>
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                  {i.status === "uploading" && <Progress value={i.progress} className="mt-2 h-1" />}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button variant="gold" size="xl" onClick={() => void submit()} disabled={sending} className="w-full sm:w-auto">
          {sending ? <Loader2 className="animate-spin" /> : <Send />} {sending ? t.portal.replySending : t.portal.replySubmit}
        </Button>
      </div>
    </section>
  );
}
