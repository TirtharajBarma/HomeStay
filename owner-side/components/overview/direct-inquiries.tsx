"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";

type Inquiry = {
  guest: string;
  stay: string;
  value: string;
  message: string;
  acceptTone: string;
};

const acceptPrimary =
  "bg-primary text-on-primary hover:bg-primary-container";

const inquiries: Inquiry[] = [
  {
    guest: "Clara & Jeremy Meyer",
    stay: "Oak Suite • Nov 1 – Nov 4 (3 nights)",
    value: "$720",
    message:
      "“Celebrating our 10th anniversary. Looking forward to hiking the ridge trails.”",
    acceptTone: acceptPrimary,
  },
  {
    guest: "David Thorne (Writers Guild)",
    stay: "Willow Studio • Nov 8 – Nov 12 (4 nights)",
    value: "$880",
    message:
      "“Need quiet daytime hours for manuscript editing. Does studio desk get morning light?”",
    acceptTone: acceptPrimary,
  },
  {
    guest: "Dr. Aris Thorne",
    stay: "The Loft Barn • Nov 15 – Nov 17 (2 nights)",
    value: "$540",
    message: "“Traveling with trained golden retriever. Inquiring on estate pet policy.”",
    acceptTone:
      "bg-secondary text-on-secondary hover:bg-on-secondary-fixed-variant",
  },
];

export function DirectInquiries() {
  const [open, setOpen] = useState<Inquiry[]>(inquiries);
  const { notify } = useToast();

  const drop = (guest: string, accepted: boolean) => {
    setOpen((current) => current.filter((entry) => entry.guest !== guest));
    notify(accepted ? `${guest} held — pending confirmation.` : `${guest} declined.`, {
      icon: accepted ? "event_available" : "event_busy",
      tone: accepted ? "success" : "default",
    });
  };

  return (
    <section className="clay-card rounded-xl p-5">
      <div className="mb-3.5 flex items-center justify-between border-b border-outline-variant/20 pb-3">
        <div>
          <h3 className="font-headline-sm text-lg font-semibold text-primary">
            Direct Inquiries
          </h3>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Direct website requests awaiting host confirmation
          </p>
        </div>
        <span className="rounded-full border border-secondary/20 bg-warm-surface px-2 py-0.5 text-[11px] font-semibold text-secondary">
          {inquiries.length} New
        </span>
      </div>

      <div className="space-y-3">
        {open.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-lowest px-3 py-6 text-center text-xs text-outline">
            No open inquiries. New requests appear here in real time.
          </p>
        ) : null}

        {open.map((inquiry) => (
          <div
            key={inquiry.guest}
            className="flex flex-col gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold text-on-surface">
                  {inquiry.guest}
                </h4>
                <p className="text-xs font-medium text-primary">{inquiry.stay}</p>
              </div>
              <span className="text-sm font-bold text-primary">
                {inquiry.value}
              </span>
            </div>
            <p className="text-xs italic text-on-surface-variant">
              {inquiry.message}
            </p>
            <div className="flex items-center justify-end gap-2 border-t border-outline-variant/20 pt-1">
              <button
                onClick={() => drop(inquiry.guest, false)}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-outline transition-colors hover:text-error"
              >
                Decline
              </button>
              <button
                onClick={() => drop(inquiry.guest, true)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${inquiry.acceptTone}`}
              >
                Accept &amp; Hold
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
