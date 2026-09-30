import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

type IconProps = {
  name: string;
  filled?: boolean;
  className?: string;
} & Omit<ComponentProps<"span">, "name" | "className">;

/**
 * Renders a Material Symbols ligature. The name is the text content, so the
 * glyph only appears once the icon font has loaded.
 */
export function Icon({ name, filled = false, className, style, ...props }: IconProps) {
  return (
    <span
      aria-hidden
      className={cn("material-symbols-outlined select-none", className)}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
        ...style,
      }}
      {...props}
    >
      {name}
    </span>
  );
}
