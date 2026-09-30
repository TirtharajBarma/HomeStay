"use client";

import { useRouter } from "next/navigation";

import { homeHref, type Booking, type Filters } from "@/lib/booking";
import { countByKind, countPetFriendly, kindFilters, stays } from "@/lib/stays";

import { Icon } from "./icon";

const baseChip =
  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full px-4 text-label-md transition-colors duration-150 md:min-h-0 md:py-2";

const counts = {
  all: stays.length,
  estate: countByKind("estate"),
  heritage: countByKind("heritage"),
  homestay: countByKind("homestay"),
};

export function StayFilters({
  booking,
  filters,
  matching,
}: {
  booking: Booking;
  filters: Filters;
  matching: number;
}) {
  const router = useRouter();

  function apply(next: Filters) {
    router.replace(homeHref(booking, next), { scroll: false });
  }

  return (
    <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
      <div className="-mx-1 flex flex-wrap items-center gap-2 px-1">
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
                  ? `${baseChip} bg-primary text-on-primary shadow-sm`
                  : `${baseChip} border border-outline-variant/40 bg-surface-container text-on-surface-variant hover:bg-surface-container-high`
              }
            >
              {filter.label} ({counts[filter.kind]})
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => apply({ ...filters, petFriendly: !filters.petFriendly })}
          aria-pressed={filters.petFriendly}
          className={
            filters.petFriendly
              ? `${baseChip} items-center gap-1.5 bg-secondary-fixed text-on-secondary-fixed`
              : `${baseChip} items-center gap-1.5 border border-outline-variant/40 bg-surface-container text-on-surface-variant hover:bg-surface-container-high`
          }
        >
          <Icon name="pets" className="text-[14px]" />
          <span>Pet Friendly</span>
          <span className="opacity-70">({countPetFriendly()})</span>
        </button>
      </div>

      <p aria-live="polite" className="px-1 text-label-sm text-outline md:text-right">
        {matching} of {stays.length} sanctuaries shown
      </p>
    </div>
  );
}
