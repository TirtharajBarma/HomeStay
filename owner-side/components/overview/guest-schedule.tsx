"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";

type Tag = {
  icon?: string;
  iconTone?: string;
  text: string;
  className: string;
};

type ScheduleItem = {
  icon: string;
  iconWrap: string;
  cardTone: string;
  room: string;
  roomTone: string;
  badge: string;
  badgeTone: string;
  partyLabel: string;
  party: string;
  partySuffix: string;
  tags: Tag[];
  sideLabel: string;
  sideTone: string;
  action: string;
  actionTone: string;
  actionIcon?: string;
};

const items: ScheduleItem[] = [
  {
    icon: "door_front",
    iconWrap: "bg-surface-container-high text-on-surface-variant",
    cardTone: "bg-surface-container-low/60 border border-outline-variant/30",
    room: "Room 101 • Pine Cottage",
    roomTone: "text-on-surface",
    badge: "Turnover Due",
    badgeTone: "bg-secondary-tint text-secondary",
    partyLabel: "Departed:",
    party: "Marcus Vance",
    partySuffix: "(solo) • 10:15 AM",
    tags: [
      {
        icon: "favorite",
        iconTone: "text-primary",
        text: "Note: “Loved the homemade lavender scones.”",
        className: "bg-surface-container text-tertiary",
      },
    ],
    sideLabel: "Checked Out",
    sideTone: "text-outline font-medium",
    action: "Assign Cleaner",
    actionTone:
      "bg-surface-container-lowest border border-outline-variant/40 text-on-surface hover:bg-surface-container",
  },
  {
    icon: "hotel",
    iconWrap: "bg-primary-tint text-primary",
    cardTone:
      "bg-surface-container-lowest border-2 border-primary/25 shadow-xs",
    room: "Room 102 • Garden Stone Suite",
    roomTone: "text-primary",
    badge: "Arriving 3:30 PM",
    badgeTone: "bg-primary-tint text-primary font-bold",
    partyLabel: "Guest:",
    party: "Sarah Jenkins",
    partySuffix: "(2 adults, 1 child) • 3 Nights",
    tags: [
      {
        icon: "crib",
        iconTone: "text-primary",
        text: "Needs baby cot (In room)",
        className: "bg-surface-container text-on-surface",
      },
      {
        icon: "eco",
        iconTone: "text-secondary",
        text: "Vegetarian breakfast",
        className: "bg-surface-container text-on-surface",
      },
    ],
    sideLabel: "Pre-arrival sent",
    sideTone: "text-primary font-semibold",
    action: "Message Guest",
    actionTone: "bg-primary text-on-primary hover:bg-primary-container",
    actionIcon: "chat",
  },
  {
    icon: "nest_eco_leaf",
    iconWrap: "bg-surface-container-high text-on-surface-variant",
    cardTone: "bg-surface-container-low/60 border border-outline-variant/30",
    room: "Room 201 • The Loft Barn",
    roomTone: "text-on-surface",
    badge: "Arriving 6:00 PM",
    badgeTone: "bg-surface-container-high text-on-surface-variant",
    partyLabel: "Guests:",
    party: "Liam & Chloe Dupont",
    partySuffix: "(2 adults) • Weekend Retreat",
    tags: [
      {
        icon: "wine_bar",
        text: "Anniversary wine requested (Estate Pinot ready)",
        className: "bg-secondary-tint text-secondary-ink",
      },
    ],
    sideLabel: "Self check-in enabled",
    sideTone: "text-outline font-medium",
    action: "View Booking",
    actionTone:
      "bg-surface-container-lowest border border-outline-variant/40 text-on-surface hover:bg-surface-container",
  },
];

export function GuestSchedule() {
  const { notify } = useToast();
  const [done, setDone] = useState<Record<string, boolean>>({});

  return (
    <section className="clay-card rounded-xl p-5">
      <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
        <div>
          <h3 className="font-headline-sm text-lg font-semibold text-primary">
            Today&apos;s Guest Schedule
          </h3>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Check-ins, check-outs, and hospitality requirements
          </p>
        </div>
        <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant">
          {items.length} Operations
        </span>
      </div>

      <div className="mt-4 space-y-3.5">
        {items.map((item) => (
          <div
            key={item.room}
            className={`flex flex-col justify-between gap-3 rounded-xl p-3.5 sm:flex-row sm:items-start ${item.cardTone}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${item.iconWrap}`}
              >
                <Icon name={item.icon} className="text-[18px]" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className={`text-sm font-semibold ${item.roomTone}`}>
                    {item.room}
                  </h4>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.badgeTone}`}
                  >
                    {item.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {item.partyLabel}{" "}
                  <strong className="font-medium text-on-surface">
                    {item.party}
                  </strong>{" "}
                  • {item.partySuffix}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {item.tags.map((tag) => (
                    <span
                      key={tag.text}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium ${tag.className}`}
                    >
                      {tag.icon ? (
                        <Icon
                          name={tag.icon}
                          className={`text-[14px] ${tag.iconTone ?? ""}`}
                        />
                      ) : null}
                      {tag.text}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 sm:flex-col sm:items-end sm:pt-0">
              <span className={`text-[11px] ${item.sideTone}`}>
                {item.sideLabel}
              </span>
              <button
                onClick={() => {
                  setDone((current) => ({ ...current, [item.room]: true }));
                  notify(`${item.action} — ${item.room}.`, {
                    icon: item.actionIcon ?? "check_circle",
                    tone: "success",
                  });
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] ${
                  done[item.room]
                    ? "bg-surface-container text-outline"
                    : item.actionTone
                }`}
              >
                {done[item.room] ? (
                  <Icon name="check_circle" className="text-[15px]" />
                ) : item.actionIcon ? (
                  <Icon name={item.actionIcon} className="text-[15px]" />
                ) : null}
                {done[item.room] ? "Done" : item.action}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
