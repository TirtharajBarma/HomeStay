import { Icon } from "@/components/icon";

type Metric = {
  label: string;
  icon: string;
  iconWrap: string;
  value: string;
  valueTone: string;
  meta: string;
  metaTone: string;
  dot?: string;
  trend?: { label: string; icon: string };
};

const metrics: Metric[] = [
  {
    label: "Today's Check-ins",
    icon: "login",
    iconWrap: "bg-surface-container text-primary",
    value: "2 Guests",
    valueTone: "text-primary",
    meta: "1 arrived • 1 pending (3:30 PM)",
    metaTone: "text-on-surface-variant",
    dot: "bg-primary",
  },
  {
    label: "Departures",
    icon: "logout",
    iconWrap: "bg-surface-container text-on-surface-variant",
    value: "1 Guest",
    valueTone: "text-on-surface",
    meta: "Checkout complete, turnover in queue",
    metaTone: "text-secondary font-medium",
    dot: "bg-secondary",
  },
  {
    label: "Oct Revenue",
    icon: "payments",
    iconWrap: "bg-primary-tint text-primary",
    value: "$7,840",
    valueTone: "text-primary",
    trend: { label: "+14%", icon: "arrow_upward" },
    meta: "55% direct bookings (0% commissions)",
    metaTone: "text-on-surface-variant",
  },
  {
    label: "Housekeeping Readiness",
    icon: "mop",
    iconWrap: "bg-secondary-tint text-secondary",
    value: "5 / 6 Ready",
    valueTone: "text-primary",
    meta: "Pine Cottage cleaning underway",
    metaTone: "text-secondary font-medium",
    dot: "bg-secondary animate-pulse",
  },
];

export function MetricCards() {
  return (
    <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="clay-card flex flex-col justify-between rounded-xl p-4"
        >
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-on-surface-variant">
              {metric.label}
            </p>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${metric.iconWrap}`}
            >
              <Icon name={metric.icon} className="text-[18px]" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <h3
                className={`font-headline-md text-2xl font-bold ${metric.valueTone}`}
              >
                {metric.value}
              </h3>
              {metric.trend ? (
                <span className="flex items-center text-xs font-semibold text-primary">
                  <Icon name={metric.trend.icon} className="mr-0.5 text-[14px]" />
                  {metric.trend.label}
                </span>
              ) : null}
            </div>
            <p
              className={`mt-1.5 flex items-center gap-1.5 text-xs ${metric.metaTone}`}
            >
              {metric.dot ? (
                <span className={`h-1.5 w-1.5 rounded-full ${metric.dot}`} />
              ) : null}
              {metric.meta}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
