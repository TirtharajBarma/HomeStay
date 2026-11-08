"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { API_ENDPOINTS, apiFetch } from "@/lib/api-config";
import { siteConfig } from "@/lib/site-config";
import { Icon } from "@/components/icon";

type Business = { name?: string; email?: string; grievanceEmail?: string };

const DOCS = [
  ["privacy", "Privacy policy"],
  ["terms", "Terms of service"],
  ["refunds", "Refund & cancellation policy"],
] as const;

export default function DeleteAccountPage() {
  const [business, setBusiness] = useState<Business>({});

  useEffect(() => {
    apiFetch<{ business?: Business }>(API_ENDPOINTS.legal("privacy"))
      .then((p) => setBusiness(p.business || {}))
      .catch(() => {});
  }, []);

  const email = business.grievanceEmail || business.email || siteConfig.supportEmail || "support@staycabs.in";
  const name = business.name || siteConfig.appName;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 text-on-surface">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-label-sm text-outline">
        <Link href="/" className="hover:text-primary transition-colors">
          Accommodations
        </Link>
        <span>/</span>
        <Link href="/legal/privacy" className="hover:text-primary transition-colors">
          Legal
        </Link>
        <span>/</span>
        <span aria-current="page" className="font-medium text-primary">
          Account deletion
        </span>
      </nav>

      {/* Policy Navigation Tabs */}
      <nav className="mb-8 flex flex-wrap items-center gap-2" aria-label="Legal policy documents">
        {DOCS.map(([d, label]) => (
          <Link
            key={d}
            href={`/legal/${d}`}
            className="rounded-lg border border-outline-variant/60 bg-surface-container-low px-3.5 py-1.5 text-label-sm font-medium text-on-surface-variant hover:border-primary/40 hover:text-primary transition-colors"
          >
            {label}
          </Link>
        ))}
        <span className="rounded-lg border border-primary bg-primary px-3.5 py-1.5 text-label-sm font-medium text-on-primary">
          Account deletion
        </span>
      </nav>

      <article className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 sm:p-10 shadow-ambient">
        <header className="border-b border-outline-variant/40 pb-6 mb-8">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-outline-variant/60 bg-surface-container-low px-2.5 py-0.5 text-label-sm text-outline">
            <Icon name="person_remove" className="text-sm text-primary" />
            <span>Account governance &amp; privacy</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-headline-lg font-medium tracking-tight text-primary">
            Delete your {name} account
          </h1>
          <p className="mt-2 text-body-sm text-on-surface-variant leading-relaxed">
            Google Play and Apple App Store compliance guidelines regarding account closure, data deletion timelines, and statutory retention rules.
          </p>
        </header>

        <div className="space-y-8">
          <section className="space-y-2.5">
            <h2 className="font-display text-base sm:text-headline-sm font-medium text-primary border-b border-outline-variant/20 pb-1.5">
              1. In the app (fastest)
            </h2>
            <ol className="list-decimal space-y-1.5 pl-5 text-body-sm sm:text-body-md text-on-surface-variant leading-relaxed">
              <li>Open the {name} mobile app and sign in with your credentials.</li>
              <li>
                <strong className="font-medium text-primary">Homestay owners:</strong> navigate to More → Account &amp; privacy. <strong className="font-medium text-primary">Drivers:</strong> navigate to Profile → Account &amp; privacy.
              </li>
              <li>Tap <strong className="font-medium text-primary">Delete my account</strong>, type <code className="bg-surface-container px-1.5 py-0.5 rounded text-primary text-xs">DELETE</code> in capital letters, and confirm.</li>
            </ol>
          </section>

          <section className="space-y-2.5">
            <h2 className="font-display text-base sm:text-headline-sm font-medium text-primary border-b border-outline-variant/20 pb-1.5">
              2. Without the app (manual request)
            </h2>
            <p className="text-body-sm sm:text-body-md leading-relaxed text-on-surface-variant">
              Write directly to our data privacy desk at{" "}
              <a
                href={`mailto:${email}?subject=Delete%20my%20account`}
                className="font-medium text-primary underline underline-offset-2 hover:text-primary-container"
              >
                {email}
              </a>{" "}
              from the email address or phone number linked with your account. We will authenticate your request and permanently delete your profile within 30 days.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="font-display text-base sm:text-headline-sm font-medium text-primary border-b border-outline-variant/20 pb-1.5">
              3. What is deleted immediately vs. what is retained
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-body-sm sm:text-body-md leading-relaxed text-on-surface-variant">
              <li>
                <strong className="font-medium text-primary">Deleted immediately:</strong> Your profile credentials, authentication tokens, legal name, telephone number, vehicle documents, profile photo, and push notification tokens.
              </li>
              <li>
                <strong className="font-medium text-primary">Retained strictly for tax and fiscal compliance:</strong> Completed booking vouchers, tax invoices, and payment/payout logs required by Indian GST and accounting laws, stored in anonymized format without marketing contact information.
              </li>
              <li>
                <strong className="font-medium text-primary">Wallet balance:</strong> Please withdraw any pending driver earnings or host payouts before requesting account termination.
              </li>
            </ul>
          </section>
        </div>

        <footer className="mt-10 border-t border-outline-variant/40 pt-6 flex flex-wrap items-center justify-between gap-4 text-label-sm text-outline">
          <div className="inline-flex items-center gap-1.5">
            <Icon name="security" className="text-sm text-primary" />
            <span>
              See also our{" "}
              <Link href="/legal/privacy" className="font-medium text-primary hover:underline">
                Privacy policy
              </Link>
            </span>
          </div>
          <span className="tabular-nums">© {new Date().getFullYear()} {siteConfig.appName} Network</span>
        </footer>
      </article>
    </main>
  );
}
