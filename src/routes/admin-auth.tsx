import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { Loader2, LockKeyhole } from "lucide-react";

import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-auth")({
  head: () => ({
    meta: [
      { title: "Connexion | Administration JERRY GROUP" },
      { name: "description", content: "Connexion sécurisée à l’espace d’administration JERRY GROUP." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { property: "og:title", content: "Connexion | Administration JERRY GROUP" },
      { property: "og:description", content: "Accès privé à l’administration JERRY GROUP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminAuthPage,
});

function AdminAuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "google" | "lovable" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  async function passwordSignIn(event: FormEvent) {
    event.preventDefault();
    setBusy("password");
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("E-mail ou mot de passe incorrect.");
      setBusy(null);
      return;
    }
    await navigate({ to: "/admin", replace: true });
  }

  async function socialSignIn(provider: "google" | "lovable") {
    setBusy(provider);
    setError("");
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: `${window.location.origin}/admin-auth`,
      extraParams: provider === "google" ? { prompt: "select_account" } : undefined,
    });
    if (result.error) {
      setError("La connexion n’a pas abouti. Veuillez réessayer.");
      setBusy(null);
      return;
    }
    if (result.redirected) return;
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
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Connexion réservée aux administrateurs autorisés de JERRY GROUP.</p>

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
            <Button type="submit" variant="gold" className="h-11 w-full" disabled={!!busy}>
              {busy === "password" && <Loader2 className="animate-spin" />} Se connecter
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-3">
            <Button type="button" variant="outline" className="h-11 w-full border-google-border bg-google font-medium text-google-foreground hover:bg-google-hover" disabled={!!busy} onClick={() => void socialSignIn("google")}>
              {busy === "google" ? <Loader2 className="animate-spin" /> : <GoogleLogo />} Continuer avec Google
            </Button>
            <Button type="button" variant="outline" className="h-11 w-full font-medium" disabled={!!busy} onClick={() => void socialSignIn("lovable")}>
              {busy === "lovable" ? <Loader2 className="animate-spin" /> : <LovableMark className="size-[18px]" />} Continuer avec Lovable
            </Button>
          </div>
        </section>
        <p className="mt-6 text-center text-xs leading-relaxed text-ivory/60">Toutes les actions d’administration sont vérifiées côté serveur.</p>
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="size-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}
