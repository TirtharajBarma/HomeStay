"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";

type Room = {
  name: string;
  detail: string;
  detailTone: string;
  cardTone: string;
  status: string;
  statusTone: string;
  actionIcon: string;
  actionTitle: string;
  actionTone: string;
};

const quietButton =
  "border border-outline-variant/40 text-outline hover:bg-surface-container";

const rooms: Room[] = [
  {
    name: "Oak Suite",
    detail: "Ground Floor • King Bed",
    detailTone: "text-outline",
    cardTone: "bg-surface-container-low/50 border border-outline-variant/25",
    status: "Occupied",
    statusTone: "bg-primary-tint text-primary",
    actionIcon: "check_circle",
    actionTitle: "Mark checked",
    actionTone: quietButton,
  },
  {
    name: "Pine Cottage",
    detail: "Linen change underway (40m left)",
    detailTone: "text-secondary font-medium",
    cardTone: "bg-warm-surface border border-secondary/30",
    status: "Needs Linens",
    statusTone: "bg-secondary-tint text-secondary-ink",
    actionIcon: "done",
    actionTitle: "Mark clean",
    actionTone:
      "bg-secondary text-on-secondary shadow-xs hover:bg-on-secondary-fixed-variant border border-transparent",
  },
  {
    name: "Garden Stone Suite",
    detail: "Terrace Access • Inspected by Eleanor",
    detailTone: "text-outline",
    cardTone: "bg-surface-container-low/50 border border-outline-variant/25",
    status: "Ready for Check-in",
    statusTone: "bg-primary-tint text-primary",
    actionIcon: "verified",
    actionTitle: "Inspect",
    actionTone: "border border-outline-variant/40 text-primary hover:bg-surface-container",
  },
  {
    name: "The Loft Barn",
    detail: "Upper Mezzanine • Fireplace prepped",
    detailTone: "text-outline",
    cardTone: "bg-surface-container-low/50 border border-outline-variant/25",
    status: "Ready for Check-in",
    statusTone: "bg-primary-tint text-primary",
    actionIcon: "verified",
    actionTitle: "Inspect",
    actionTone: "border border-outline-variant/40 text-primary hover:bg-surface-container",
  },
  {
    name: "Orchard View",
    detail: "West Wing • Extended stay guest",
    detailTone: "text-outline",
    cardTone: "bg-surface-container-low/50 border border-outline-variant/25",
    status: "Occupied",
    statusTone: "bg-primary-tint text-primary",
    actionIcon: "check_circle",
    actionTitle: "Mark checked",
    actionTone: quietButton,
  },
  {
    name: "Willow Studio",
    detail: "Garden Annex • Spotless & aired",
    detailTone: "text-outline",
    cardTone: "bg-surface-container-low/50 border border-outline-variant/25",
    status: "Vacant & Ready",
    statusTone: "bg-surface-container text-on-surface-variant",
    actionIcon: "verified",
    actionTitle: "Inspect",
    actionTone: "border border-outline-variant/40 text-primary hover:bg-surface-container",
  },
];

export function RoomReadiness() {
  const { notify } = useToast();
  const [cleared, setCleared] = useState<Record<string, boolean>>({});

  return (
    <section className="clay-card rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between border-b border-outline-variant/20 pb-3">
        <div>
          <h3 className="font-headline-sm text-lg font-semibold text-primary">
            Room Readiness
          </h3>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Live estate housekeeping statuses
          </p>
        </div>
        <span className="text-xs font-semibold text-primary">
          {rooms.length} Total
        </span>
      </div>

      <div className="space-y-2.5">
        {rooms.map((room) => (
          <div
            key={room.name}
            className={`flex items-center justify-between rounded-lg border p-2.5 ${room.cardTone}`}
          >
            <div>
              <p className="text-sm font-semibold text-on-surface">{room.name}</p>
              <p className={`text-[11px] ${room.detailTone}`}>{room.detail}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  cleared[room.name] ? "bg-primary/10 text-primary" : room.statusTone
                }`}
              >
                {cleared[room.name] ? "Ready" : room.status}
              </span>
              <button
                title={cleared[room.name] ? "Marked ready" : room.actionTitle}
                aria-label={`${room.actionTitle}: ${room.name}`}
                onClick={() => {
                  setCleared((current) => ({ ...current, [room.name]: true }));
                  notify(`${room.name} marked ready for arrival.`, {
                    icon: "task_alt",
                    tone: "success",
                  });
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  cleared[room.name] ? "bg-surface-container text-outline" : room.actionTone
                }`}
              >
                <Icon name={room.actionIcon} className="text-[16px]" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
