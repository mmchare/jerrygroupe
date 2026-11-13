import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/I18nProvider";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function useNavItems() {
  const { t } = useI18n();
  return [
    { to: "/", label: t.nav.home, exact: true },
    { to: "/about", label: t.nav.about },
    { to: "/leadership", label: t.nav.leadership },
    { to: "/divisions", label: t.nav.divisions },
    { to: "/global-presence", label: t.nav.presence },
    { to: "/contact", label: t.nav.contact },
  ] as const;
}

export function SiteHeader() {
  const { t } = useI18n();
  const items = useNavItems();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-navy focus:px-4 focus:py-2 focus:text-ivory"
      >
        {t.nav.skip}
      </a>
      <div className="container-page flex h-20 items-center justify-between gap-6">
        <Link to="/" aria-label="JERRY GROUP" className="shrink-0">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 xl:flex">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exact" in item }}
              className="relative py-2 text-[0.82rem] font-medium text-navy/80 transition-colors hover:text-navy data-[status=active]:text-navy data-[status=active]:after:absolute data-[status=active]:after:inset-x-0 data-[status=active]:after:-bottom-0.5 data-[status=active]:after:h-px data-[status=active]:after:bg-gold"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <Button asChild variant="outline-navy" className="hidden lg:inline-flex">
            <Link to="/track-proposal">{t.nav.track}</Link>
          </Button>
          <Button asChild variant="gold" className="hidden md:inline-flex">
            <Link to="/submit-proposal">{t.nav.submit}</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline-navy" size="icon" className="xl:hidden" aria-label={t.nav.menu}>
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-sm border-l-0 bg-navy text-ivory">
              <SheetTitle className="sr-only">{t.nav.menu}</SheetTitle>
              <div className="flex h-full flex-col px-2 pt-6">
                <Logo tone="light" />
                <nav aria-label="Mobile" className="mt-10 flex flex-col">
                  {items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{ exact: "exact" in item }}
                      onClick={() => setOpen(false)}
                      className="border-b border-ivory/10 py-4 font-display text-xl text-ivory/85 transition-colors hover:text-gold data-[status=active]:text-gold"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <Button asChild variant="gold" size="xl" className="mt-8">
                  <Link to="/submit-proposal" onClick={() => setOpen(false)}>
                    {t.nav.submit}
                  </Link>
                </Button>
                <Button asChild variant="outline-light" size="xl" className="mt-3">
                  <Link to="/track-proposal" onClick={() => setOpen(false)}>
                    {t.nav.track}
                  </Link>
                </Button>
                <div className="mt-8">
                  <LanguageSwitcher tone="light" />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
