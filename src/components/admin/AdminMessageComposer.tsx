import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendAdminMessage } from "@/lib/admin.functions";

export function AdminMessageComposer({ proposalId }: { proposalId: string }) {
  const queryClient = useQueryClient();
  const sendMessage = useServerFn(sendAdminMessage);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (body.trim().length < 2 || busy) return;
    setBusy(true);
    try {
      await sendMessage({ data: { proposalId, body } });
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "proposal", proposalId] });
      toast.success("Le message est maintenant visible par le fournisseur.");
    } catch {
      toast.error("Le message n’a pas pu être envoyé.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-5">
      <label htmlFor="admin-message" className="text-sm font-semibold text-navy">Écrire au fournisseur</label>
      <Textarea
        id="admin-message"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
        maxLength={5000}
        className="mt-2 bg-background"
        placeholder="Votre message…"
      />
      <Button type="button" variant="outline-navy" className="mt-3" disabled={busy || body.trim().length < 2} onClick={() => void submit()}>
        {busy ? <Loader2 className="animate-spin" /> : <Send />} Envoyer le message
      </Button>
    </div>
  );
}
