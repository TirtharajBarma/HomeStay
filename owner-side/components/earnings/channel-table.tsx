import { Icon } from "@/components/icon";
import { channelRows } from "@/lib/earnings-data";

export function ChannelTable() {
  return (
    <section className="clay-card rounded-xl p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule-warm pb-4">
        <div>
          <h2 className="text-headline-sm text-headline-sm text-primary">
            Channel Breakdown &amp; Commission Costs
          </h2>
          <p className="text-body-sm text-body-sm text-outline">
            Transparent view of channel fees, volume, and net homestay yield
          </p>
        </div>
        <span className="rounded-full bg-primary-tint px-3 py-1 text-label-sm text-label-sm font-semibold text-primary">
          $4,150 Saved via Direct Website
        </span>
      </div>

      <div className="custom-scrollbar -mx-1 mt-4 overflow-x-auto px-1">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/30 text-label-sm text-label-sm text-outline">
              <th className="py-2.5 font-semibold">Booking Channel</th>
              <th className="py-2.5 font-semibold">Share</th>
              <th className="py-2.5 font-semibold">Gross Volume</th>
              <th className="py-2.5 font-semibold">Host Fee %</th>
              <th className="py-2.5 font-semibold">Fees Deducted</th>
              <th className="py-2.5 text-right font-semibold">Net Host Payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20 text-body-sm text-body-sm text-on-surface">
            {channelRows.map((row) => (
              <tr
                key={row.name}
                className="transition-colors hover:bg-surface-container-low"
              >
                <td className="flex items-center gap-2 py-3 font-medium">
                  <span
                    className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${row.dot}`}
                  />
                  <span
                    className={row.emphasis ? "font-semibold text-primary" : ""}
                  >
                    {row.name}
                  </span>
                </td>
                <td className="py-3">{row.share}</td>
                <td className="py-3 font-semibold">{row.gross}</td>
                <td className={`py-3 ${row.feeTone ?? ""}`}>{row.fee}</td>
                <td className={`py-3 ${row.feesTone ?? ""}`}>{row.fees}</td>
                <td className={`py-3 text-right ${row.netTone}`}>{row.net}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low p-3.5">
        <Icon name="lightbulb" className="mt-0.5 shrink-0 text-[20px] text-primary" />
        <p className="text-body-sm text-body-sm text-on-surface-variant">
          <span className="font-semibold text-primary">
            Tips to shift OTA guests to direct:
          </span>{" "}
          Offer physical welcome cards with a 10% returning guest code for direct
          bookings. 18 guests this season returned directly through
          meadowfall.com after their first Airbnb visit.
        </p>
      </div>
    </section>
  );
}
