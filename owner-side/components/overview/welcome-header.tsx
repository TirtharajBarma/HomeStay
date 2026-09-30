"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";

export function WelcomeHeader() {
  const [syncing, setSyncing] = useState(false);
  const { notify } = useToast();

  return (
    <section className="mb-6">
      <div className="flex flex-col justify-between gap-4 border-b border-outline-variant/20 pb-3 lg:flex-row lg:items-end">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-medium text-on-surface-variant">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              West Meadows Estate
            </span>
            <span className="text-xs text-outline" aria-hidden>
              •
            </span>
            <span className="flex items-center gap-1 text-xs text-on-surface-variant">
              <Icon name="foggy" className="text-[15px] text-outline" />
              18°C Misty Autumn Morning
            </span>
          </div>
          <h2 className="font-headline-lg text-2xl font-semibold tracking-tight text-primary lg:text-3xl">
            Welcome back, Eleanor &amp; Thomas
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Gentle autumn mist across the orchard.{" "}
            <span className="font-semibold text-primary">
              4 of 6 rooms occupied tonight
            </span>{" "}
            (83% occupancy).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low px-3.5 py-2 shadow-xs">
            <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-primary" />
            <span className="text-xs font-medium text-on-surface">
              Daily Operations Sync Active
            </span>
          </div>
          <button
            onClick={() => {
              setSyncing(true);
              window.setTimeout(() => {
                setSyncing(false);
                notify("Operations data synced. Last run just now.", {
                  icon: "check_circle",
                  tone: "success",
                });
              }, 600);
            }}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-xs font-medium text-on-surface shadow-xs transition-colors hover:bg-surface-container disabled:opacity-70"
          >
            <Icon
              name={syncing ? "progress_activity" : "refresh"}
              className={`text-[16px] text-outline ${syncing ? "animate-spin" : ""}`}
            />
            <span>{syncing ? "Syncing..." : "Sync"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
