"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { API_ENDPOINTS, apiFetch } from "@/lib/api-config";
import { siteConfig } from "@/lib/site-config";
import { Icon } from "@/components/icon";

type LegalPage = { title: string; version: string; sections: { heading: string; body: string }[] };

const DOCS = [
  ["privacy", "Privacy policy"],
  ["terms", "Terms of service"],
  ["refunds", "Refund & cancellation policy"],
] as const;

export default function LegalDocPage() {
  const doc = String(useParams().doc || "");
  const [page, setPage] = useState<LegalPage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiFetch<LegalPage>(API_ENDPOINTS.legal(doc))
      .then((p) => !cancelled && setPage(p))
      .catch((e) => !cancelled && setError(e?.message || "This policy page could not be loaded."));
    return () => {
      cancelled = true;
    };
  }, [doc]);

  const activeDocName = DOCS.find(([d]) => d === doc)?.[1] || page?.title || "Legal";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 text-on-surface">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-label-sm text-outline">
        <Link href="/" className="hover:text-primary transition-colors">
          Accommodations
        </Link>
        <span>/</span>
        <span>Legal</span>
        <span>/</span>
        <span aria-current="page" className="font-medium text-primary">
          {activeDocName}
        </span>
      </nav>

      {/* Policy Navigation Tabs */}
      <nav className="mb-8 flex flex-wrap items-center gap-2" aria-label="Legal policy documents">
        {DOCS.map(([d, label]) => {
          const isActive = d === doc;
          return (
            <Link
              key={d}
              href={`/legal/${d}`}
              className={`rounded-lg border px-3.5 py-1.5 text-label-sm font-medium transition-colors ${
                isActive
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant/60 bg-surface-container-low text-on-surface-variant hover:border-primary/40 hover:text-primary"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <Link
          href="/delete-account"
          className="rounded-lg border border-outline-variant/60 bg-surface-container-low px-3.5 py-1.5 text-label-sm font-medium text-on-surface-variant hover:border-primary/40 hover:text-primary transition-colors"
        >
          Account deletion
        </Link>
      </nav>

      {error ? (
        <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-8 text-center">
          <Icon name="info" className="mb-3 text-[28px] text-outline" />
          <h2 className="font-display text-headline-sm font-medium text-primary">Policy unavailable</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">{error}</p>
        </div>
      ) : !page ? (
        <div className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-8 sm:p-12 shadow-ambient text-center animate-pulse">
          <div className="h-4 w-32 bg-surface-container-high rounded mx-auto mb-3" />
          <div className="h-8 w-64 bg-surface-container rounded mx-auto mb-6" />
          <div className="space-y-4 max-w-xl mx-auto">
            <div className="h-3 bg-surface-container-low rounded w-full" />
            <div className="h-3 bg-surface-container-low rounded w-5/6" />
            <div className="h-3 bg-surface-container-low rounded w-4/6" />
          </div>
        </div>
      ) : (
        <article className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 sm:p-10 shadow-ambient">
          <header className="border-b border-outline-variant/40 pb-6 mb-8">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-outline-variant/60 bg-surface-container-low px-2.5 py-0.5 text-label-sm text-outline tabular-nums">
              <Icon name="verified_user" className="text-sm text-primary" />
              <span>Official policy · Version {page.version}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl md:text-headline-lg font-medium tracking-tight text-primary">
              {page.title}
            </h1>
            <p className="mt-2 text-body-sm text-on-surface-variant">
              Governing use of {siteConfig.appName} homestay reservations and regional mountain transfers.
            </p>
          </header>

          <div className="space-y-8">
            {page.sections.map((s) => (
              <section key={s.heading} className="space-y-2">
                <h2 className="font-display text-base sm:text-headline-sm font-medium text-primary border-b border-outline-variant/20 pb-1.5">
                  {s.heading}
                </h2>
                <p className="whitespace-pre-line text-body-sm sm:text-body-md leading-relaxed text-on-surface-variant">
                  {s.body}
                </p>
              </section>
            ))}
          </div>

          <footer className="mt-10 border-t border-outline-variant/40 pt-6 flex flex-wrap items-center justify-between gap-4 text-label-sm text-outline">
            <div className="inline-flex items-center gap-1.5">
              <Icon name="mail" className="text-sm text-primary" />
              <span>
                Questions? Write to{" "}
                <a
                  href={`mailto:${siteConfig.supportEmail || "support@staycabs.in"}`}
                  className="font-medium text-primary hover:underline"
                >
                  {siteConfig.supportEmail || "support@staycabs.in"}
                </a>
              </span>
            </div>
            <span className="tabular-nums">© {new Date().getFullYear()} {siteConfig.appName} Network</span>
          </footer>
        </article>
      )}
    </main>
  );
}
