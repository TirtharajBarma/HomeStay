"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { siteConfig } from "@/lib/site-config";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Client Error:", error);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${siteConfig.appUrl}/api/v1`;
      fetch(`${apiUrl}/telemetry/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error?.message || "Guest Web Client Error",
          screen: "GuestPortal",
          platform: "web-guest",
          stack: error?.stack,
          extra: { digest: error?.digest },
        }),
      }).catch(() => {});
    } catch {
      // Ignored
    }
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 text-on-surface">
      <div className="max-w-md w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-8 sm:p-10 text-center space-y-5 shadow-ambient">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary-container/40 text-secondary">
          <Icon name="error_outline" className="text-3xl" />
        </div>
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-medium text-primary">
            Something interrupted this trail
          </h2>
          <p className="mt-2 text-body-sm text-on-surface-variant leading-relaxed">
            {error?.message || "An unexpected issue occurred while loading this page. Please try again or return to accommodations."}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:flex-1 rounded-lg bg-primary py-2.5 px-4 text-label-md font-medium text-on-primary hover:bg-primary-container transition-colors cursor-pointer"
          >
            Try again
          </button>
          <Link
            href="/"
            className="w-full sm:flex-1 rounded-lg border border-outline-variant/60 bg-surface-container-low py-2.5 px-4 text-label-md font-medium text-on-surface hover:border-primary/40 transition-colors"
          >
            Accommodations
          </Link>
        </div>
      </div>
    </div>
  );
}
