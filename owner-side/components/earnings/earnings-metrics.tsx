import { Icon } from "@/components/icon";
import { metrics } from "@/lib/earnings-data";

export function EarningsMetrics() {
  return (
    <div className="my-space-lg grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={`clay-card clay-lift rounded-xl p-5 transition-all ${metric.rail ?? ""}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-label-md text-label-md font-medium text-outline">
              {metric.label}
            </span>
            <span
              className={`flex items-center justify-center rounded-lg p-1.5 ${metric.iconTone}`}
            >
              <Icon name={metric.icon} className="text-[18px]" />
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-headline-lg text-headline-lg font-semibold text-primary">
              {metric.value}
            </span>
            {metric.trend ? (
              <span
                className={
                  metric.trend.icon
                    ? "flex items-center gap-1 rounded bg-primary-tint px-1.5 py-0.5 text-label-sm text-label-sm font-semibold text-primary"
                    : "text-label-sm text-label-sm font-medium text-primary"
                }
              >
                {metric.trend.icon ? (
                  <Icon name={metric.trend.icon} className="text-[12px]" />
                ) : null}
                {metric.trend.value}
              </span>
            ) : null}
            {metric.suffix ? (
              <span className="text-body-sm text-body-sm text-outline">
                {metric.suffix}
              </span>
            ) : null}
          </div>

          {metric.dotTone ? (
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${metric.dotTone}`}
              />
              <p
                className={`text-body-sm text-body-sm ${metric.footnoteEmphasisTone ?? ""}`}
              >
                {metric.footnote}
              </p>
            </div>
          ) : (
            <p
              className={`mt-2 flex items-center gap-1 text-body-sm text-body-sm ${
                metric.footnoteEmphasis ? "text-on-surface-variant" : "text-outline"
              }`}
            >
              {metric.footnoteIcon ? (
                <Icon
                  name={metric.footnoteIcon}
                  className="text-[14px] text-outline"
                />
              ) : null}
              {metric.footnoteEmphasis ? (
                <>
                  <strong className="font-semibold text-primary">
                    {metric.footnoteEmphasis}
                  </strong>{" "}
                  {metric.footnote}
                </>
              ) : (
                metric.footnote
              )}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
