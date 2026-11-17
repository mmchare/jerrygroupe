import { useState } from "react";
import { Link, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Loader2, LogOut, ShieldAlert } from "lucide-react";

import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { adminSessionQuery } from "@/lib/admin-queries";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data, isPending, error } = useQuery(adminSessionQuery);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/admin-auth", replace: true });
  }

  if (isPending) {
    return <div className="flex min-h-[70vh] items-center justify-center gap-3 bg-background text-navy"><Loader2 className="animate-spin text-gold" /> Vérification de l’accès…</div>;
  }

  if (error || !data?.isAdmin) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-background px-5 py-16">
        <section className="w-full max-w-lg border-t-2 border-gold bg-card p-8 text-center shadow-card">
          <ShieldAlert className="mx-auto size-9 text-gold" aria-hidden />
          <h1 className="mt-5 text-3xl text-navy">Accès administrateur requis</h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {data?.email ? `Le compte ${data.email} n’a pas reçu de droits d’administration.` : "Votre session n’a pas pu être vérifiée."}
            {" "}Contactez le responsable du site pour demander l’accès.
          </p>
          <Button type="button" variant="outline-navy" className="mt-6" disabled={signingOut} onClick={() => void signOut()}>
            {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />} Se déconnecter
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-ivory/10 bg-navy text-ivory">
        <div className="container-page flex min-h-20 flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <Link to="/admin" aria-label="Administration JERRY GROUP"><Logo tone="light" /></Link>
            <span className="hidden border-l border-ivory/20 pl-5 text-xs uppercase tracking-[0.2em] text-gold sm:block">Administration</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/admin" className="flex items-center gap-2 text-sm text-ivory/85 hover:text-gold"><LayoutDashboard className="size-4" /> Propositions</Link>
            <span className="max-w-56 truncate text-xs text-ivory/60">{data.email}</span>
            <Button type="button" size="sm" variant="outline-light" disabled={signingOut} onClick={() => void signOut()}>
              {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />} Déconnexion
            </Button>
          </div>
        </div>
      </header>
      <div className="container-page py-10 md:py-12"><Outlet /></div>
    </div>
  );
}
