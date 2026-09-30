"use client";

import { useMoney } from "@/components/currency-provider";
import { Icon } from "@/components/icon";
import { MenuRow, Popover } from "@/components/ui/popover";
import { currencyFor } from "@/lib/currency";

/**
 * Header currency switch. Defaults to the rupee — the estate books in INR and
 * every amount in the demo data is stored that way.
 */
export function CurrencySelect() {
  const { key, setKey, options } = useMoney();
  const active = currencyFor(key);

  return (
    <Popover
      label="Currency"
      align="end"
      panelClassName="w-[min(17rem,calc(100vw-2rem))]"
      trigger={({ toggle, open, ...aria }) => (
        <button
          {...aria}
          onClick={toggle}
          data-testid="currency-select"
          aria-label={`Currency: ${active.label}. Change currency`}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-label-md text-label-md shadow-sm transition-colors sm:px-3 ${
            open
              ? "border-primary/40 bg-primary-tint text-primary"
              : "border-outline-variant/60 bg-surface-container-lowest text-on-surface hover:bg-surface-container-high"
          }`}
        >
          <Icon name={active.icon} className="flex-shrink-0 text-[18px] text-outline" />
          <span className="font-semibold">{active.symbol}</span>
          <span className="hidden sm:inline">{key}</span>
          <Icon name="keyboard_arrow_down" className="flex-shrink-0 text-[16px] text-outline" />
        </button>
      )}
    >
      {(close) => (
        <div className="py-1">
          <p className="px-3 py-2 text-label-sm text-label-sm font-semibold uppercase text-outline">
            Show amounts in
          </p>
          {options.map((option) => (
            <MenuRow
              key={option.key}
              icon="payments"
              label={`${option.symbol}  ${option.label}`}
              hint={option.key}
              selected={option.key === key}
              onSelect={() => {
                setKey(option.key);
                close();
              }}
            />
          ))}
          <p className="border-t border-outline-variant/20 px-3 py-2 text-label-sm text-label-sm text-outline">
            Rates are fixed demo values for the pitch.
          </p>
        </div>
      )}
    </Popover>
  );
}
