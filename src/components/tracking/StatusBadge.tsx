import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import type { ProposalStatus } from "@/lib/tracking-rules";

const tone: Record<ProposalStatus, string> = {
  received: "border-navy/20 bg-secondary text-navy",
  under_review: "border-navy/20 bg-secondary text-navy",
  additional_info_required: "border-gold bg-gold-soft text-navy",
  under_negotiation: "border-gold/60 bg-gold-soft text-navy",
  approved_in_principle: "border-gold/60 bg-gold-soft text-navy",
  approved: "border-navy bg-navy text-ivory",
  rejected: "border-destructive/40 bg-destructive/10 text-destructive",
  purchase_order_issued: "border-navy bg-navy text-ivory",
  completed: "border-navy bg-navy text-ivory",
  archived: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: ProposalStatus; className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
        tone[status],
        className,
      )}
    >
      {t.statuses[status]}
    </span>
  );
}
