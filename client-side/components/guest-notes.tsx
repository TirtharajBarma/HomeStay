"use client";

import { useRef, useState } from "react";
import { mountainStandards, type MountainStandard } from "@/lib/content";

export function GuestNotes() {
  const [isPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Duplicate items for a seamless, glitch-free infinite loop
  const loopList: MountainStandard[] = [...mountainStandards, ...mountainStandards];

  return (
    <section
      aria-label="The StayCabs Mountain Standard and travel commitments"
      className="border-b border-outline-variant/50 bg-surface py-14 sm:py-18 md:py-24 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Section Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:mb-12 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="mb-2 inline-flex items-center gap-2 text-label-sm font-medium text-outline">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
              <span>Valley standards · Our commitments</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl md:text-headline-lg font-medium text-primary tracking-tight">
              The StayCabs Mountain Standard
            </h2>
            <p className="mt-2 text-body-sm sm:text-body-md text-on-surface-variant leading-relaxed">
              Six uncompromised commitments built specifically for safe, transparent travel across the Darjeeling and Sikkim Himalayas.
            </p>
          </div>

          {/* Network Trust Pill */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-md border border-outline-variant/60 bg-surface-container-low px-3 py-1.5 text-label-sm text-on-surface">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="font-medium text-primary">Verified local network</span>
              <span className="text-outline">·</span>
              <span className="text-outline">Direct valley tariffs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Marquee Scroller with Luxury Soft-Fade Edge Masks */}
      <div
        ref={scrollRef}
        className="relative w-full overflow-hidden marquee-mask group"
      >
        <div
          className={`flex w-max gap-5 sm:gap-6 py-2 animate-marquee-ltr ${
            isPaused ? "marquee-paused" : ""
          } group-hover:[animation-play-state:paused]`}
          style={{ willChange: "transform" }}
        >
          {loopList.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="flex w-[330px] sm:w-[390px] md:w-[420px] shrink-0 flex-col justify-between rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5 sm:p-6 shadow-ambient transition-all duration-200 hover:border-primary/40 hover:shadow-elevated"
            >
              <div>
                {/* Card Top: Editorial Number Index and Tag */}
                <div className="mb-4 flex items-baseline justify-between gap-2 border-b border-outline-variant/30 pb-3">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-display text-title-md font-medium text-primary/70 tabular-nums">
                      {item.num}
                    </span>
                    <span className="text-label-sm font-medium tracking-wide text-primary">
                      {item.category}
                    </span>
                  </div>

                  <span className="shrink-0 rounded-md border border-outline-variant/40 bg-surface-container-low px-2 py-0.5 text-label-sm text-outline tabular-nums">
                    {item.tag}
                  </span>
                </div>

                {/* Title */}
                <h3 className="mb-2 font-display text-body-md font-medium text-primary">
                  {item.title}
                </h3>

                {/* Description */}
                <p className="text-body-sm leading-relaxed text-on-surface-variant">
                  {item.description}
                </p>
              </div>

              {/* Card Footer: Quiet Editorial Footnote */}
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-outline-variant/30 pt-3 text-label-sm text-outline">
                <span className="font-medium text-on-surface-variant">
                  {item.footnote}
                </span>

                <span className="rounded bg-surface-container-low px-2 py-0.5 text-[11px] font-medium text-primary">
                  Standard
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
