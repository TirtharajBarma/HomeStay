"use client";

import { useRouter } from "next/navigation";

import { homeHref, type Booking, type Filters } from "@/lib/booking";
import { kindFilters, type Stay } from "@/lib/stays";

import { Icon } from "./icon";

const baseChip =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-label-sm font-medium transition-colors cursor-pointer";

export function StayFilters({
  booking,
  filters,
  matching,
  stays,
}: {
  booking: Booking;
  filters: Filters;
  matching: number;
  stays: Stay[];
}) {
  const router = useRouter();
  const byKind = (kind: Stay["kind"]) => stays.filter((stay) => stay.kind === kind).length;
  const counts = { all: stays.length, cottage: byKind("cottage"), loft: byKind("loft"), cabin: byKind("cabin") };

  function apply(next: Filters) {
    router.replace(homeHref(booking, next), { scroll: false });
  }

  return (
    <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
      {/* Horizontal Filter Bar */}
      <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0 flex flex-nowrap md:flex-wrap items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1">
        {kindFilters.map((filter) => {
          const active = filters.kind === filter.kind;

          return (
            <button
              key={filter.kind}
              type="button"
              onClick={() => apply({ ...filters, kind: filter.kind })}
              aria-pressed={active}
              className={
                active
                  ? `${baseChip} bg-primary text-on-primary`
                  : `${baseChip} border border-outline-variant/70 bg-surface-container-lowest text-on-surface-variant hover:border-outline`
              }
            >
              <span>{filter.label}</span>
              <span className="ml-1.5 opacity-70 tabular-nums">{counts[filter.kind]}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => apply({ ...filters, petFriendly: !filters.petFriendly })}
          aria-pressed={filters.petFriendly}
          className={
            filters.petFriendly
              ? `${baseChip} items-center gap-1.5 bg-primary text-on-primary`
              : `${baseChip} items-center gap-1.5 border border-outline-variant/70 bg-surface-container-lowest text-on-surface-variant hover:border-outline`
          }
        >
          <Icon name="pets" className="text-[12px]" />
          <span>Pet-friendly</span>
          <span className="opacity-70 tabular-nums">
            {stays.filter((stay) => stay.petFriendly).length}
          </span>
        </button>
      </div>

      <p aria-live="polite" className="px-1 text-label-sm text-outline md:text-right tabular-nums">
        {matching} of {stays.length} stays shown
      </p>
    </div>
  );
}
