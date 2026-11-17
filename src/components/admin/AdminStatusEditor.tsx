import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/I18nProvider";
import { updateAdminProposalStatus } from "@/lib/admin.functions";
import { PROPOSAL_STATUSES, type ProposalStatus } from "@/lib/tracking-rules";

export function AdminStatusEditor({ proposalId, currentStatus }: { proposalId: string; currentStatus: ProposalStatus }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const updateStatus = useServerFn(updateAdminProposalStatus);
  const [status, setStatus] = useState<ProposalStatus>(currentStatus);
  const [supplierMessage, setSupplierMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (status === currentStatus) {
      setError("Choisissez un nouveau statut avant d’enregistrer.");
      return;
    }
    if (status === "additional_info_required" && supplierMessage.trim().length < 2) {
      setError("Ajoutez un message expliquant les informations attendues du fournisseur.");
      return;
    }
    setBusy(true);
    try {
      await updateStatus({ data: { proposalId, status, supplierMessage, internalNote } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "proposal", proposalId] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "proposals"] }),
      ]);
      setSupplierMessage("");
      setInternalNote("");
      toast.success("Le statut a été mis à jour.");
    } catch {
      setError("Le statut n’a pas pu être modifié. Veuillez réessayer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-border bg-card p-6 shadow-card" aria-labelledby="status-editor-title">
      <h2 id="status-editor-title" className="text-xl text-navy">Changer le statut</h2>
      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="proposal-status">Nouveau statut</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as ProposalStatus)}>
            <SelectTrigger id="proposal-status" className="h-11 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROPOSAL_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>{t.statuses[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-status-message">Message au fournisseur {status === "additional_info_required" ? "(obligatoire)" : "(facultatif)"}</Label>
          <Textarea
            id="supplier-status-message"
            value={supplierMessage}
            onChange={(event) => setSupplierMessage(event.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Ce message sera visible dans son espace de suivi."
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="internal-status-note">Note interne (facultative)</Label>
          <Textarea
            id="internal-status-note"
            value={internalNote}
            onChange={(event) => setInternalNote(event.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Visible uniquement par les administrateurs."
            className="bg-background"
          />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="button" variant="gold" className="w-full" disabled={busy} onClick={() => void submit()}>
          {busy && <Loader2 className="animate-spin" />} Enregistrer le statut
        </Button>
      </div>
    </section>
  );
}
