import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";
import { Icon } from "@/components/icon";

export const metadata: Metadata = {
  title: `Download ${siteConfig.appName} Android App (APK)`,
  description: `Official direct download of ${siteConfig.appName} Android app for Himalayan homestay hosts and cab drivers across Darjeeling, Kalimpong, Kurseong, and Sikkim.`,
};

export default function DownloadPage() {
  const downloadUrl = "https://downloads.staycabs.in/staycabs.apk";
  const supportPhone = siteConfig.supportPhone || process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || "";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-14 text-on-surface">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-label-sm text-outline">
        <Link href="/" className="hover:text-primary transition-colors">
          Home
        </Link>
        <span>/</span>
        <span aria-current="page" className="font-medium text-primary">
          Download App
        </span>
      </nav>

      {/* Hero Header */}
      <div className="mb-10 text-center sm:text-left sm:flex sm:items-center sm:justify-between sm:gap-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-primary-fixed px-3 py-1 text-xs font-semibold text-primary border border-primary/15 mb-3">
            <Icon name="verified" filled className="text-xs text-primary" />
            <span>Official Android APK · Free Forever</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-primary">
            {siteConfig.appName} Driver & Host App
          </h1>
          <p className="mt-2 text-body-md text-on-surface-variant max-w-xl leading-relaxed">
            Direct console for homestay hosts and mountain cab drivers across Darjeeling, Kalimpong, Kurseong, and Sikkim.
          </p>
        </div>

        <div className="hidden sm:flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-primary text-on-primary shadow-lg shadow-primary/20">
          <Icon name="smartphone" className="text-5xl" />
        </div>
      </div>

      {/* Main Download Card */}
      <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-low p-6 sm:p-8 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-6 border-b border-outline-variant/40">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-sm">
                <Icon name="cottage" className="text-xl" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-primary">StayCabs Console</h2>
                <p className="text-xs text-on-surface-variant">Version 1.0.9 · Build 2 · Universal Android APK</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-outline">
              <span className="rounded-md bg-surface px-2 py-0.5 border border-outline-variant/40">Size: ~96 MB</span>
              <span className="rounded-md bg-surface px-2 py-0.5 border border-outline-variant/40">Android 8.0+</span>
              <span className="rounded-md bg-surface px-2 py-0.5 border border-outline-variant/40">Offline-Ready</span>
              <span className="rounded-md bg-surface px-2 py-0.5 border border-outline-variant/40">Auto-Updating (OTA)</span>
            </div>
          </div>

          <a
            href={downloadUrl}
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-primary px-8 py-4 text-base font-semibold text-on-primary shadow-md shadow-primary/25 hover:bg-primary-container active:scale-95 transition-all cursor-pointer"
          >
            <Icon name="download" className="text-xl" />
            <span>Download APK</span>
          </a>
        </div>

        {/* ── Unknown Sources Guide (Crucial for Drivers!) ── */}
        <div className="pt-6">
          <h3 className="font-display text-sm font-bold text-primary flex items-center gap-2 mb-4">
            <Icon name="verified_user" className="text-base text-primary" />
            <span>First-Time Installation Guide (Android Unknown Sources)</span>
          </h3>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-outline-variant/40 bg-surface p-4 text-left">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs mb-2">
                1
              </div>
              <h4 className="text-xs font-semibold text-primary">Tap &ldquo;Download anyway&rdquo;</h4>
              <p className="mt-1 text-[11px] text-on-surface-variant leading-relaxed">
                When Chrome asks <em>&ldquo;File might be harmful... download staycabs.apk anyway?&rdquo;</em>, tap <strong>Download anyway</strong>.
              </p>
            </div>

            <div className="rounded-2xl border border-outline-variant/40 bg-surface p-4 text-left">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs mb-2">
                2
              </div>
              <h4 className="text-xs font-semibold text-primary">Allow Chrome to Install</h4>
              <p className="mt-1 text-[11px] text-on-surface-variant leading-relaxed">
                When opening the APK, Android may ask permission. Tap <strong>Settings</strong> and toggle <strong>&ldquo;Allow from this source&rdquo;</strong>.
              </p>
            </div>

            <div className="rounded-2xl border border-outline-variant/40 bg-surface p-4 text-left">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs mb-2">
                3
              </div>
              <h4 className="text-xs font-semibold text-primary">Tap Install & Launch</h4>
              <p className="mt-1 text-[11px] text-on-surface-variant leading-relaxed">
                Tap <strong>Install</strong> (or <strong>Update</strong> if already installed). Your login and bookings will remain completely safe.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Updates Guarantee */}
      <div className="grid gap-4 sm:grid-cols-2 mb-8">
        <div className="rounded-2xl border border-outline-variant/40 bg-surface p-5">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-1">
            <Icon name="shield" filled className="text-base text-primary" />
            <span>100% Safe & Direct From StayCabs</span>
          </div>
          <p className="text-[12px] text-on-surface-variant leading-relaxed">
            This APK is signed with the official StayCabs digital certificate and hosted on secure Cloudflare R2 infrastructure. No ads, trackers, or third-party modifications.
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/40 bg-surface p-5">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-1">
            <Icon name="sync" className="text-base text-primary" />
            <span>Automatic Silent Updates (OTA)</span>
          </div>
          <p className="text-[12px] text-on-surface-variant leading-relaxed">
            Once installed, new features, price charts, and bug fixes download automatically in the background. You do not need to download the APK again for day-to-day updates.
          </p>
        </div>
      </div>

      {/* Need Help CTA */}
      <div className="rounded-2xl bg-primary-fixed/60 border border-primary/20 p-5 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
        <div>
          <p className="font-semibold text-xs text-primary">Having trouble installing on your phone?</p>
          <p className="text-[11px] text-on-surface-variant">Our support team in Darjeeling and Kurseong is available on WhatsApp.</p>
        </div>
        {supportPhone && (
          <a
            href={`https://wa.me/${supportPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent("Hello StayCabs, I need help installing the driver/host app on my Android phone.")}`}
            className="mt-3 sm:mt-0 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-on-primary hover:bg-primary-container transition-colors"
          >
            <Icon name="chat" className="text-sm" />
            <span>WhatsApp Support</span>
          </a>
        )}
      </div>
    </main>
  );
}
