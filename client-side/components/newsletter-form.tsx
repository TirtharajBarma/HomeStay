"use client";

import { useState, type FormEvent } from "react";

import { hosts } from "@/lib/content";

import { Icon } from "./icon";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!EMAIL.test(email.trim())) {
      setError("Enter a valid email so we can write to you.");
      setDone(false);
      return;
    }

    setError(null);
    setDone(true);
  }

  if (done) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-fixed/30 px-4 py-3 text-body-sm text-on-primary-fixed">
        <Icon name="check_circle" className="text-lg text-primary" />
        <span>
          Noted — we will write to <span className="font-semibold">{email.trim()}</span> when the
          autumn dates open.
        </span>
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full max-w-sm">
      <label
        htmlFor="newsletter-email"
        className="mb-1.5 block text-label-md text-on-surface-variant"
      >
        Seasonal openings &amp; valley letters
      </label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(null);
          }}
          placeholder="you@meadowfallretreat.com"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "newsletter-error" : undefined}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 text-body-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-label-md text-on-primary transition-colors hover:bg-primary-container"
        >
          <span className="hidden xs:inline">Subscribe</span>
          <span className="xs:hidden">Join</span>
          <Icon name="arrow_forward" className="text-[16px]" />
        </button>
      </div>
      {error ? (
        <p id="newsletter-error" role="alert" className="mt-1.5 text-label-sm text-error">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-label-sm text-outline">
          Or write to{" "}
          <a
            href={`mailto:${hosts.bookingEmail}`}
            className="inline-flex min-h-9 items-center break-all hover:text-primary"
          >
            {hosts.bookingEmail}
          </a>
        </p>
      )}
    </form>
  );
}
