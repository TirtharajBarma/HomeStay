"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { expenses } from "@/lib/earnings-data";

export function PayoutCard() {
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const { notify } = useToast();

  return (
    <section className="clay-card rounded-xl border-t-4 border-t-primary p-4 md:p-6">
      <div className="flex items-center justify-between border-b border-rule-warm pb-3">
        <span className="text-label-md text-label-md font-medium text-outline">
          Next Payout Summary
        </span>
        <span className="flex items-center rounded bg-primary-tint p-1 text-primary">
          <Icon name="account_balance" className="text-[16px]" />
        </span>
      </div>

      <div className="my-4">
        <span className="text-label-sm text-label-sm tracking-wider text-outline uppercase">
          Available for Payout
        </span>
        <div className="mt-0.5 font-display-mobile text-headline-lg font-bold text-primary xl:text-display-mobile">
          $3,420.00
        </div>
        <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-surface-container-low p-3 text-body-sm text-body-sm text-on-surface-variant">
          <Icon name="schedule" className="text-[18px] text-primary" />
          <div>
            Scheduled for{" "}
            <strong className="text-on-surface">Oct 28, 2024</strong>
            <br />
            <span className="text-label-sm text-label-sm text-outline">
              Direct Deposit (Bank of New England ••4819)
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <button
          onClick={() => setPayoutOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-label-md text-label-md font-medium text-on-primary shadow-sm transition-all hover:bg-primary-container active:scale-[0.99]"
        >
          <Icon name="bolt" className="text-[18px]" />
          <span>Initiate Instant Payout</span>
        </button>
        <button
          onClick={() => setLogOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-surface-container px-4 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
        >
          <Icon name="receipt_long" className="text-[18px]" />
          <span>View Transfer Log</span>
        </button>

        <Modal
          open={payoutOpen}
          onClose={() => setPayoutOpen(false)}
          title="Initiate instant payout"
          description="Transfers the available balance to Bank of New England ••4819."
          icon="bolt"
          size="sm"
          footer={
            <>
              <button
                onClick={() => setPayoutOpen(false)}
                className="rounded-lg border border-outline-variant/40 px-4 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setPayoutOpen(false);
                  notify("$3,420.00 queued for instant transfer.", {
                    icon: "check_circle",
                    tone: "success",
                  });
                }}
                className="rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
              >
                Confirm transfer
              </button>
            </>
          }
        >
          <dl className="space-y-2 text-body-md text-body-md">
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Available balance</dt>
              <dd className="font-semibold text-primary">$3,420.00</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Transfer fee</dt>
              <dd className="text-on-surface">$0.00</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-outline-variant/30 pt-2">
              <dt className="font-semibold text-on-surface">You receive</dt>
              <dd className="font-semibold text-on-surface">$3,420.00</dd>
            </div>
          </dl>
        </Modal>

        <Modal
          open={logOpen}
          onClose={() => setLogOpen(false)}
          title="Transfer log"
          description="Recent payouts to your connected bank account."
          icon="receipt_long"
          size="sm"
          footer={
            <button
              onClick={() => setLogOpen(false)}
              className="rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
            >
              Close
            </button>
          }
        >
          <ul className="space-y-2.5">
            {[
              ["Oct 12, 2024", "$2,980.40", "Scheduled"],
              ["Sep 28, 2024", "$3,412.15", "Scheduled"],
              ["Sep 14, 2024", "$2,744.90", "Instant"],
            ].map(([date, amount, kind]) => (
              <li
                key={date}
                className="flex items-center justify-between gap-3 border-b border-outline-variant/20 pb-2.5 last:border-b-0"
              >
                <span className="flex flex-col">
                  <span className="text-body-md text-body-md text-on-surface">{date}</span>
                  <span className="text-label-sm text-label-sm text-outline">{kind}</span>
                </span>
                <span className="text-title-md text-title-md font-semibold text-primary">
                  {amount}
                </span>
              </li>
            ))}
          </ul>
        </Modal>
      </div>
    </section>
  );
}

export function OperatingCosts() {
  return (
    <section className="clay-card rounded-xl p-4 md:p-6">
      <div className="flex items-center justify-between border-b border-rule-warm pb-3">
        <div>
          <h2 className="font-headline-sm text-[19px] text-primary">
            Turnover &amp; Operating Costs
          </h2>
          <span className="text-body-sm text-body-sm text-outline">
            October recorded expenses
          </span>
        </div>
        <span className="text-label-md text-label-md font-bold text-on-surface">
          $2,540 total
        </span>
      </div>

      <div className="mt-3 flex flex-col divide-y divide-outline-variant/20 text-body-sm text-body-sm">
        {expenses.map((expense) => (
          <div
            key={expense.label}
            className="flex items-center justify-between gap-3 py-2.5"
          >
            <div className="flex items-center gap-2.5">
              <Icon name={expense.icon} className="text-[18px] text-outline" />
              <span>
                {expense.label}
                {expense.detail ? (
                  <>
                    <br />
                    <span className="text-label-sm text-label-sm text-outline">
                      {expense.detail}
                    </span>
                  </>
                ) : null}
              </span>
            </div>
            <span className="flex-shrink-0 font-semibold text-on-surface">
              {expense.value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-outline-variant/30 pt-3 text-label-sm text-label-sm text-primary">
        <span className="font-medium">Net Homestay Profit Margin:</span>
        <span className="text-label-md text-label-md font-bold">77.7%</span>
      </div>
    </section>
  );
}

export function HostInsights() {
  return (
    <section className="clay-card rounded-xl bg-gradient-to-br from-surface-container-lowest to-[#f4f7f4] p-4 md:p-6">
      <div className="flex items-center gap-2 border-b border-[#E8E1D7] pb-3">
        <Icon name="tips_and_updates" className="text-[20px] text-primary" />
        <h2 className="font-headline-sm text-[18px] text-primary">
          Host Insights &amp; Opportunities
        </h2>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3.5">
          <div className="mb-1 flex items-center gap-1.5 text-label-sm text-label-sm font-semibold text-secondary">
            <Icon name="arrow_back_ios_new" className="text-[15px]" />
            Revenue Optimization
          </div>
          <p className="text-body-sm text-body-sm text-on-surface">
            Autumn foliage weekend occupancy reached <strong>100%</strong>.
            Consider extending the <strong>2-night minimum</strong> through
            mid-November to capture extended scenic travelers.
          </p>
        </div>

        <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-label-sm text-label-sm font-semibold text-primary">
              Repeat Guest Retention
            </span>
            <span className="text-label-md text-label-md font-bold text-primary">
              28%
            </span>
          </div>
          <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
            <div className="h-full w-[28%] rounded-full bg-primary" />
          </div>
          <p className="text-body-sm text-body-sm text-outline">
            28% of guests this quarter are returning visitors. Guests who
            received the handwritten welcome basket were 3x more likely to book
            directly.
          </p>
        </div>
      </div>
    </section>
  );
}
