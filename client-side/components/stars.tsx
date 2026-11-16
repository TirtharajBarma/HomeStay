import { cn } from "@/lib/cn";

import { Icon } from "./icon";

type StarsProps = {
  /** null or 0 = no real reviews yet; renders a clean 'New' badge. */
  rating: number | null;
  count?: number;
  className?: string;
  size?: "sm" | "md";
  showNewBadge?: boolean;
};

export function Stars({ rating, count, className, size = "sm", showNewBadge = true }: StarsProps) {
  const hasReviews = typeof rating === "number" && rating > 0 && (count === undefined || count > 0);

  if (!hasReviews) {
    if (!showNewBadge) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200/60",
          className
        )}
      >
        <Icon name="star" filled className="text-[11px] text-amber-500" />
        <span>New</span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="flex text-amber-500">
        {Array.from({ length: 5 }, (_, index) => (
          <Icon
            key={index}
            name="star"
            filled
            className={size === "sm" ? "text-xs" : "text-sm"}
          />
        ))}
      </span>
      <span className="text-title-md font-medium text-primary tabular-nums">{rating.toFixed(1)}</span>
      {count !== undefined && count > 0 ? (
        <span className="text-body-sm text-on-surface-variant tabular-nums">({count})</span>
      ) : null}
    </span>
  );
}
