"use client";

// Account deletion instructions: Google Play and the App Store require a public page that explains
// how to delete an account and what is kept. The contact email is the admin's business setting.
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { API_ENDPOINTS, apiFetch } from "@/lib/api-config";
import { siteConfig } from "@/lib/site-config";

type Business = { name?: string; email?: string; grievanceEmail?: string };

export default function DeleteAccountPage() {
  const [business, setBusiness] = useState<Business>({});

  useEffect(() => {
    apiFetch<{ business?: Business }>(API_ENDPOINTS.legal("privacy"))
      .then((p) => setBusiness(p.business || {}))
      .catch(() => {});
  }, []);

  const email = business.grievanceEmail || business.email || siteConfig.supportEmail;
  const name = business.name || siteConfig.appName;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-on-surface">
      <h1 className="text-headline-md font-bold">Delete your {name} account</h1>

      <section className="mt-6">
        <h2 className="text-title-md font-semibold">In the app (fastest)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-body-md text-on-surface-variant">
          <li>Open the {name} app and sign in.</li>
          <li>Homestay owners: go to More → Account &amp; privacy. Drivers: go to Profile → Account &amp; privacy.</li>
          <li>Tap Delete my account, type DELETE and confirm.</li>
        </ol>
      </section>

      <section className="mt-6">
        <h2 className="text-title-md font-semibold">Without the app</h2>
        <p className="mt-2 text-body-md text-on-surface-variant">
          {email ? (
            <>
              Email <a className="text-primary underline" href={`mailto:${email}?subject=Delete%20my%20account`}>{email}</a> from
              the email address you sign in with, or include the phone number on your account.
            </>
          ) : (
            `Contact ${siteConfig.appName} support from the email address you sign in with.`
          )}{" "}
          We confirm and delete it within 30 days.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-title-md font-semibold">What is deleted and what is kept</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-body-md text-on-surface-variant">
          <li>Deleted at once: your sign-in, name, phone number, photo, location and notification tokens.</li>
          <li>Kept only as tax and accounting law requires: trip, payment and payout records, without your contact details.</li>
          <li>Withdraw any commission you are owed before you delete your account.</li>
        </ul>
      </section>

      <p className="mt-8 text-body-sm text-on-surface-variant">
        See also the <Link className="text-primary underline" href="/legal/privacy">Privacy Policy</Link>.
      </p>
    </main>
  );
}
