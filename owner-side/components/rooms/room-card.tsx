"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { RoomUnit } from "@/lib/rooms-data";

type ActionKind = "rates" | "photos" | "block" | "hold";

function StatusPill({ status }: { status: RoomUnit["status"] }) {
  return (
    <span
      className={
        status === "Active"
          ? "flex items-center gap-1.5 rounded-full bg-primary-tint px-2.5 py-1 text-label-sm text-label-sm font-semibold text-on-primary-container"
          : "flex items-center gap-1.5 rounded-full bg-hold-surface px-2.5 py-1 text-label-sm text-label-sm font-semibold text-hold-ink"
      }
    >
      <Icon
        name={status === "Active" ? "check_circle" : "handyman"}
        className="text-[14px]"
      />
      {status}
    </span>
  );
}

const actions: { label: string; icon: string; kind: ActionKind }[] = [
  { label: "Edit Rates", icon: "price_change", kind: "rates" },
  { label: "Manage Photos", icon: "photo_library", kind: "photos" },
  { label: "Block Dates", icon: "event_busy", kind: "block" },
];

export function RoomCard({ room }: { room: RoomUnit }) {
  const [dialog, setDialog] = useState<ActionKind | null>(null);
  const [holdResolved, setHoldResolved] = useState(false);
  const [blocked, setBlocked] = useState<string[]>([]);
  const { notify } = useToast();
  const onHold = Boolean(room.hold) && !holdResolved;

  return (
    <article className="clay-card group flex flex-col overflow-hidden rounded-xl">
      <div className="relative h-40 w-full overflow-hidden sm:h-44">
        <Image
          src={room.image}
          alt={`${room.name} interior`}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-on-surface/55 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="rounded-md bg-on-surface/75 px-2 py-0.5 text-label-sm text-label-sm font-bold text-white backdrop-blur-sm">
            {room.code}
          </span>
          <StatusPill status={room.status} />
        </div>
        {room.badge ? (
          <span className="absolute top-3 right-3 flex items-center gap-1.5 rounded-md bg-white/92 px-2.5 py-1 text-label-sm text-label-sm font-semibold text-on-surface backdrop-blur-sm">
            <Icon name="handyman" className="text-[14px] text-hold-ink" />
            {room.badge}
          </span>
        ) : null}
        <div className="absolute bottom-3 left-3 flex flex-col">
          <h3 className="text-headline-sm text-headline-sm font-semibold text-white drop-shadow">
            {room.name}
          </h3>
          <span className="text-label-sm text-label-sm text-white/85">
            {room.location}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-md bg-surface-container px-2.5 py-1 text-label-md text-label-md text-on-surface-variant">
            <Icon name="group" className="text-[15px] text-outline" />
            Max {room.maxGuests}
          </span>
          <span className="flex items-center gap-1.5 rounded-md bg-surface-container px-2.5 py-1 text-label-md text-label-md text-on-surface-variant">
            <Icon name="bed" className="text-[15px] text-outline" />
            {room.bedLabel}
          </span>
        </div>

        <div className="flex items-end justify-between border-y border-outline-variant/25 py-2.5">
          <div className="flex flex-col">
            <span className="text-label-sm text-label-sm text-outline uppercase">
              Base Nightly
            </span>
            <span className="text-headline-md text-headline-md font-semibold text-primary">
              ${room.nightly}
              <span className="text-body-sm text-body-sm font-normal text-outline">
                /night
              </span>
            </span>
          </div>
          {room.weekend ? (
            <div className="flex flex-col text-right">
              <span className="text-label-sm text-label-sm text-outline uppercase">
                Weekend
              </span>
              <span className="text-title-md text-title-md font-semibold text-secondary-ink">
                ${room.weekend}
              </span>
            </div>
          ) : null}
        </div>

        <ul className="grid grid-cols-1 gap-x-3 gap-y-2 min-[380px]:grid-cols-2">
          {room.features.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-1.5 text-label-md text-label-md text-on-surface-variant"
            >
              <Icon name="check" className="text-[15px] text-primary" />
              <span className="truncate">{feature}</span>
            </li>
          ))}
        </ul>

        {room.hold && onHold ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-hold-ink/20 bg-hold-surface px-3 py-2.5">
            <span className="flex items-center gap-2 text-label-md text-label-md font-semibold text-hold-ink">
              <Icon name="handyman" className="text-[16px]" />
              {room.hold.label}
              <span className="font-normal opacity-80">({room.hold.range})</span>
            </span>
            <button
              onClick={() => {
                setHoldResolved(true);
                notify(`${room.name} is bookable again.`, {
                  icon: "handyman",
                  tone: "success",
                });
              }}
              className="rounded-md bg-hold-ink px-2.5 py-1 text-label-sm text-label-sm font-semibold text-white transition-colors hover:bg-hold-ink/90"
            >
              Resolve Hold
            </button>
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-outline-variant/25 pt-3">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => setDialog(action.kind)}
              className="flex min-w-[92px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2 py-2 text-label-sm text-label-sm font-medium text-on-surface transition-colors hover:border-primary-container/40 hover:bg-primary-tint hover:text-primary"
            >
              <Icon name={action.icon} className="text-[15px]" />
              <span className="truncate">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <RoomActionDialog
        kind={dialog}
        room={room}
        blocked={blocked}
        onToggleBlock={(date) =>
          setBlocked((current) =>
            current.includes(date)
              ? current.filter((entry) => entry !== date)
              : [...current, date],
          )
        }
        onClose={() => setDialog(null)}
      />
    </article>
  );
}

const blockDates = ["Oct 26 – Oct 27", "Nov 2 – Nov 4", "Nov 9 – Nov 9"];

function RoomActionDialog({
  kind,
  room,
  blocked,
  onToggleBlock,
  onClose,
}: {
  kind: ActionKind | null;
  room: RoomUnit;
  blocked: string[];
  onToggleBlock: (date: string) => void;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const [nightly, setNightly] = useState(room.nightly);
  const [weekend, setWeekend] = useState(room.weekend ?? room.nightly);
  const [gallery, setGallery] = useState(4);

  const title =
    kind === "rates"
      ? "Edit nightly rates"
      : kind === "photos"
        ? "Manage photos"
        : kind === "block"
          ? "Block dates"
          : "";

  return (
    <Modal
      open={kind !== null}
      onClose={onClose}
      title={title}
      description={room.name}
      icon={kind === "rates" ? "price_change" : kind === "photos" ? "photo_library" : "event_busy"}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-outline-variant/40 px-4 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
          >
            {kind === "block" ? "Done" : "Cancel"}
          </button>
          <button
            onClick={() => {
              onClose();
              notify(
                kind === "rates"
                  ? `${room.name} rates updated to $${nightly} / $${weekend}.`
                  : kind === "photos"
                    ? `${room.name} gallery saved with ${gallery} photos.`
                    : `${blocked.length} date range${blocked.length === 1 ? "" : "s"} blocked for ${room.name}.`,
                { icon: "check_circle", tone: "success" },
              );
            }}
            className="rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
          >
            {kind === "block" ? "Clear all" : "Save"}
          </button>
        </>
      }
    >
      {kind === "rates" ? (
        <div className="space-y-4">
          <div>
            <label
              className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
              htmlFor={`nightly-${room.code}`}
            >
              Nightly rate (USD)
            </label>
            <input
              id={`nightly-${room.code}`}
              data-autofocus
              type="number"
              min={0}
              value={nightly}
              onChange={(event) => setNightly(Number(event.target.value) || 0)}
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
              htmlFor={`weekend-${room.code}`}
            >
              Weekend rate (Fri–Sun)
            </label>
            <input
              id={`weekend-${room.code}`}
              type="number"
              min={0}
              value={weekend}
              onChange={(event) => setWeekend(Number(event.target.value) || 0)}
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
            />
          </div>
        </div>
      ) : null}

      {kind === "photos" ? (
        <div className="space-y-3">
          <p className="text-body-sm text-body-sm text-on-surface-variant">
            {gallery} photos published. Drag to reorder, or set a cover image.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGallery((value) => value + 1)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
            >
              <Icon name="add_photo_alternate" className="text-[18px]" />
              Upload
            </button>
            <button
              onClick={() => setGallery((value) => Math.max(1, value - 1))}
              disabled={gallery <= 1}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-outline-variant/40 px-3 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
            >
              <Icon name="delete" className="text-[18px]" />
              Remove
            </button>
          </div>
        </div>
      ) : null}

      {kind === "block" ? (
        <ul className="space-y-2">
          {blockDates.map((date) => {
            const active = blocked.includes(date);
            return (
              <li key={date}>
                <button
                  onClick={() => onToggleBlock(date)}
                  aria-pressed={active}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                    active
                      ? "border-hold-ink/30 bg-hold-surface"
                      : "border-outline-variant/30 hover:bg-surface-container"
                  }`}
                >
                  <span className="text-body-md text-body-md text-on-surface">
                    {date}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-label-sm text-label-sm font-semibold ${
                      active
                        ? "bg-hold-ink text-white"
                        : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {active ? "Blocked" : "Open"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Modal>
  );
}
