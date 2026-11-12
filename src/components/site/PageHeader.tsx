import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  lead,
  image,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  image?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-navy text-ivory">
      {image && (
        <>
          <img src={image} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-hero-overlay" />
        </>
      )}
      <div className="container-page py-20 md:py-28">
        <div className="max-w-3xl animate-fade-up">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-5 text-4xl font-medium leading-[1.1] text-ivory md:text-5xl lg:text-6xl">{title}</h1>
          {lead && <p className="mt-6 max-w-2xl text-base leading-relaxed text-ivory/75 md:text-lg">{lead}</p>}
          {children}
        </div>
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "left",
  tone = "dark",
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "left" | "center";
  tone?: "dark" | "light";
}) {
  const center = align === "center";
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="eyebrow">{eyebrow}</p>
      <h2
        className={`mt-4 text-3xl font-medium leading-tight md:text-4xl ${tone === "light" ? "text-ivory" : "text-navy"}`}
      >
        {title}
      </h2>
      <span className={`gold-rule mt-6 ${center ? "mx-auto" : ""}`} />
      {body && (
        <p className={`mt-6 leading-relaxed ${tone === "light" ? "text-ivory/75" : "text-muted-foreground"}`}>{body}</p>
      )}
    </div>
  );
}
