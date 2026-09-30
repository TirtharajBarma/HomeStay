import { Icon } from "@/components/icon";
import { unitEarnings } from "@/lib/earnings-data";

export function UnitEarningsGrid() {
  return (
    <section className="clay-card rounded-xl p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule-warm pb-4">
        <div>
          <h2 className="text-headline-sm text-headline-sm text-primary">
            Earnings by Room &amp; Accommodation Unit
          </h2>
          <p className="text-body-sm text-body-sm text-outline">
            Revenue performance across all 6 Meadowfall units
          </p>
        </div>
        <span className="text-label-sm text-label-sm text-outline">
          6 Total Units
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {unitEarnings.map((unit) => (
          <div
            key={unit.name}
            className={
              unit.maintenance
                ? "rounded-xl border border-outline-variant/40 bg-surface-container-lowest opacity-80"
                : "rounded-xl border border-outline-variant/40 bg-surface-container-lowest transition-colors hover:border-primary/40"
            }
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3
                    className={`font-headline-sm text-[17px] font-semibold ${
                      unit.maintenance ? "text-on-surface" : "text-primary"
                    }`}
                  >
                    {unit.name}
                  </h3>
                  <span className="text-label-sm text-label-sm text-outline">
                    {unit.meta}
                  </span>
                </div>
                {unit.maintenance ? (
                  <span className="flex items-center gap-1 rounded-full bg-hold-surface px-2.5 py-0.5 text-label-sm text-label-sm font-semibold text-hold-ink">
                    <Icon name="construction" className="text-[13px]" />
                    Maintenance
                  </span>
                ) : (
                  <span className="rounded-full bg-primary-tint px-2.5 py-0.5 text-label-sm text-label-sm font-semibold text-primary">
                    {unit.occupancy} Occupancy
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-baseline justify-between border-t border-outline-variant/20 pt-2">
                <span className="text-body-sm text-body-sm text-outline">
                  Total Net Generated
                </span>
                <span
                  className={`text-title-md text-title-md font-bold ${
                    unit.maintenance ? "text-on-surface" : "text-primary"
                  }`}
                >
                  {unit.net}
                </span>
              </div>

              {unit.maintenance ? (
                <p className="mt-2 text-label-sm text-label-sm italic text-outline">
                  {unit.note}
                </p>
              ) : (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: unit.occupancy }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
