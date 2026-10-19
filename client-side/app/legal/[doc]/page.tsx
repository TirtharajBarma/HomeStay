"use client";

// Public legal pages (privacy, terms, refunds) for the app store listings. The text comes from the
// server, the same source the app's in-app Legal screen reads, so both always match.
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { API_ENDPOINTS, apiFetch } from "@/lib/api-config";

type LegalPage = { title: string; version: string; sections: { heading: string; body: string }[] };

const DOCS = [
  ["privacy", "Privacy"],
  ["terms", "Terms"],
  ["refunds", "Refunds"],
] as const;

export default function LegalDocPage() {
  const doc = String(useParams().doc || "");
  const [page, setPage] = useState<LegalPage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiFetch<LegalPage>(API_ENDPOINTS.legal(doc))
      .then((p) => !cancelled && setPage(p))
      .catch((e) => !cancelled && setError(e?.message || "This page could not be loaded."));
    return () => {
      cancelled = true;
    };
  }, [doc]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-on-surface">
      <nav className="mb-6 flex gap-2 text-body-sm" aria-label="Legal pages">
        {DOCS.map(([d, label]) => (
          <Link
            key={d}
            href={`/legal/${d}`}
            className={`rounded-full px-3 py-1.5 ${d === doc ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"}`}
          >
            {label}
          </Link>
        ))}
        <Link href="/delete-account" className="rounded-full bg-surface-container-low px-3 py-1.5 text-on-surface-variant">
          Delete account
        </Link>
      </nav>
      {error ? (
        <p className="rounded-xl bg-surface-container-low p-4 text-body-md">{error}</p>
      ) : !page ? (
        <p className="text-center text-primary">Loading…</p>
      ) : (
        <article>
          <h1 className="text-headline-md font-bold">{page.title}</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">Version {page.version}</p>
          {page.sections.map((s) => (
            <section key={s.heading} className="mt-6">
              <h2 className="text-title-md font-semibold">{s.heading}</h2>
              <p className="mt-2 whitespace-pre-line text-body-md leading-relaxed text-on-surface-variant">{s.body}</p>
            </section>
          ))}
        </article>
      )}
    </main>
  );
}
