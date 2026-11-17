import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getAdminFileLink } from "@/lib/admin.functions";

export function AdminFileButtons({
  proposalId,
  kind,
  id,
  fileName,
}: {
  proposalId: string;
  kind: "document" | "attachment";
  id: string;
  fileName: string;
}) {
  const getLink = useServerFn(getAdminFileLink);
  const [busy, setBusy] = useState<"view" | "download" | null>(null);

  async function openFile(download: boolean) {
    setBusy(download ? "download" : "view");
    try {
      const { url } = await getLink({ data: { proposalId, kind, id, download } });
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      if (download) anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      toast.error("Impossible d’ouvrir ce fichier. Veuillez réessayer.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex shrink-0 gap-2">
      <Button type="button" size="sm" variant="outline-navy" disabled={!!busy} onClick={() => void openFile(false)}>
        {busy === "view" ? <Loader2 className="animate-spin" /> : <Eye />} Ouvrir
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={!!busy}
        onClick={() => void openFile(true)}
        aria-label={`Télécharger ${fileName}`}
      >
        {busy === "download" ? <Loader2 className="animate-spin" /> : <Download />}
      </Button>
    </div>
  );
}
