import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, LockKeyhole } from "lucide-react";

import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-auth")({
  head: () => ({
    meta: [
      { title: "Connexion | Administration JERRY GROUP" },
      { name: "description", content: "Connexion sécurisée à l’espace d’administration JERRY GROUP." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: AdminAuthPage,
});

function AdminAuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  async function passwordSignIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.session) {
      setError("E-mail ou mot de passe incorrect.");
      setBusy(false);
      return;
    }

    await navigate({ to: "/admin", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo tone="light" /></div>
        <section className="border-t-2 border-gold bg-card p-7 shadow-card md:p-9">
          <LockKeyhole className="size-8 text-gold" aria-hidden />
          <p className="eyebrow mt-5">Espace privé</p>
          <h1 className="mt-3 text-3xl text-navy">Administration</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Connexion réservée aux administrateurs autorisés de JERRY GROUP.
          </p>

          <form onSubmit={(event) => void passwordSignIn(event)} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Adresse e-mail</Label>
              <Input id="admin-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Mot de passe</Label>
              <Input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-11" />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="gold" className="h-11 w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Se connecter
            </Button>
          </form>
        </section>
        <p className="mt-6 text-center text-xs leading-relaxed text-ivory/60">
          Toutes les actions d’administration sont vérifiées côté serveur.
        </p>
      </div>
    </div>
  );
}
