import { cn } from "@/lib/cn";

import { Icon } from "./icon";

type StarsProps = {
  rating: number;
  count?: number;
  className?: string;
  size?: "sm" | "md";
};

export function Stars({ rating, count, className, size = "sm" }: StarsProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="flex text-secondary">
        {Array.from({ length: 5 }, (_, index) => (
          <Icon
            key={index}
            name="star"
            filled
            className={size === "sm" ? "text-xs" : "text-sm"}
          />
        ))}
      </span>
      <span className="text-title-md font-semibold text-primary">{rating.toFixed(2)}</span>
      {count !== undefined ? (
        <span className="text-body-sm text-on-surface-variant">({count})</span>
      ) : null}
    </span>
  );
}
