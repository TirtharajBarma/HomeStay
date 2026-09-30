"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import type { Stay } from "@/lib/stays";

import { Icon } from "./icon";

export function StayGallery({ stay }: { stay: Stay }) {
  const [active, setActive] = useState<number | null>(null);
  const shots = stay.gallery;

  const move = useCallback(
    (delta: number) => {
      setActive((current) =>
        current === null ? null : (current + delta + shots.length) % shots.length,
      );
    },
    [shots.length],
  );

  useEffect(() => {
    if (active === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    };
    const previousOverflow = document.body.style.overflow;

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [active, move]);

  const [hero, ...tiles] = shots;
  const current = active === null ? null : shots[active];
  const index = active ?? 0;

  return (
    <section aria-label={`${stay.name} photo gallery`} className="mb-12">
      <div className="grid grid-cols-1 gap-3.5 md:h-[500px] md:grid-cols-4 lg:grid-cols-12">
        <button
          type="button"
          onClick={() => setActive(0)}
          className="group relative col-span-1 h-64 overflow-hidden rounded-xl text-left sunlit-card-shadow sm:h-80 md:col-span-2 md:h-full lg:col-span-7"
        >
          <Image
            src={hero.src}
            alt={hero.alt}
            fill
            priority
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
          <span className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface/85 text-primary opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
            <Icon name="zoom_out_map" className="text-xl" />
          </span>
          <span className="absolute bottom-4 left-4 block text-white">
            <span className="mb-1 inline-block rounded-full bg-primary-container/80 px-2.5 py-1 text-label-sm text-on-primary backdrop-blur-md">
              {stay.eyebrow}
            </span>
            <span className="block font-display text-headline-sm drop-shadow-sm">
              {hero.caption}
            </span>
          </span>
        </button>

        <div className="grid h-72 grid-cols-2 gap-3.5 md:col-span-2 md:h-full lg:col-span-5">
          {tiles.map((tile, index) => (
            <button
              key={tile.src}
              type="button"
              onClick={() => setActive(index + 1)}
              className="group relative overflow-hidden rounded-xl text-left sunlit-card-shadow"
            >
              <Image
                src={tile.src}
                alt={tile.alt}
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, 50vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              <span className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface/85 text-primary opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
                <Icon name="zoom_out_map" className="text-lg" />
              </span>
              <span className="absolute bottom-2.5 left-2.5 right-2.5 rounded bg-surface-container-lowest/90 px-2 py-1 text-left text-label-sm font-medium text-primary backdrop-blur-sm">
                {tile.caption}
              </span>
            </button>
          ))}
        </div>
      </div>

      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${stay.name} photo ${index + 1} of ${shots.length}`}
          onClick={() => setActive(null)}
          className="fixed inset-0 z-100 flex flex-col bg-inverse-surface/95 p-4 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-3 text-inverse-on-surface">
            <span className="text-label-md">
              {stay.name} • {index + 1} / {shots.length}
            </span>
            <button
              type="button"
              onClick={() => setActive(null)}
              aria-label="Close gallery"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-inverse-on-surface/10 transition-colors hover:bg-inverse-on-surface/20"
            >
              <Icon name="close" className="text-2xl" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center py-4">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                move(-1);
              }}
              aria-label="Previous photo"
              className="absolute left-0 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-inverse-on-surface/10 text-inverse-on-surface transition-colors hover:bg-inverse-on-surface/20"
            >
              <Icon name="chevron_left" className="text-3xl" />
            </button>

            <figure className="relative h-full w-full" onClick={(event) => event.stopPropagation()}>
              <Image
                src={current.src}
                alt={current.alt}
                fill
                sizes="100vw"
                priority
                className="object-contain"
              />
            </figure>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                move(1);
              }}
              aria-label="Next photo"
              className="absolute right-0 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-inverse-on-surface/10 text-inverse-on-surface transition-colors hover:bg-inverse-on-surface/20"
            >
              <Icon name="chevron_right" className="text-3xl" />
            </button>
          </div>

          <p
            onClick={(event) => event.stopPropagation()}
            className="pb-2 text-center text-label-md text-inverse-on-surface"
          >
            {current.caption}
          </p>

          <div
            onClick={(event) => event.stopPropagation()}
            className="flex justify-center gap-2 pb-2"
          >
            {shots.map((shot, index) => (
              <button
                key={shot.src}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Show photo ${index + 1}: ${shot.caption}`}
                aria-current={index === active}
                className={
                  index === active
                    ? "h-2 w-8 rounded-full bg-primary-fixed-dim"
                    : "h-2 w-2 rounded-full bg-inverse-on-surface/40 transition-colors hover:bg-inverse-on-surface/70"
                }
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
