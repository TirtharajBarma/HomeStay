"use client";

import { useState } from "react";
import { useEstate, type EstateRoom } from "@/components/estate-provider";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { fieldClass, labelClass } from "@/components/owner/primitives";
import { roomUnits, type RoomUnit } from "@/lib/rooms-data";

/** Preset exteriors, so new rooms never depend on a new remote image host. */
const photos = roomUnits.map((room) => ({ url: room.image, label: room.name }));

const categories: RoomUnit["category"][] = ["Ging Lodge", "Chiyabari Lofts", "Garden Cottages"];
const statuses: RoomUnit["status"][] = ["Active", "Maintenance"];

type Draft = {
  name: string;
  location: string;
  category: RoomUnit["category"];
  status: RoomUnit["status"];
  maxGuests: number;
  nightly: number;
  weekend: number;
  bedLabel: string;
  features: string;
  image: string;
};

const blank: Draft = {
  name: "",
  location: "",
  category: "Ging Lodge",
  status: "Active",
  maxGuests: 2,
  nightly: 200,
  weekend: 240,
  bedLabel: "Queen Bed",
  features: "",
  image: photos[0].url,
};

const toDraft = (room: EstateRoom): Draft => ({
  name: room.name,
  location: room.location,
  category: room.category,
  status: room.status,
  maxGuests: room.maxGuests,
  nightly: room.nightly,
  weekend: room.weekend ?? room.nightly,
  bedLabel: room.bedLabel,
  features: room.features.join(", "),
  image: room.image,
});

type RoomFormDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Present when editing an existing unit. */
  room?: EstateRoom;
};

export function RoomFormDialog({ open, onClose, room }: RoomFormDialogProps) {
  const { addRoom, updateRoom } = useEstate();
  const { notify } = useToast();
  const [draft, setDraft] = useState<Draft>(blank);
  const [touched, setTouched] = useState(false);

  // Re-seed during render rather than in an effect: the form should reflect the
  // room it is editing the moment it opens, without a cascading re-render.
  const seed = open ? (room?.code ?? "new") : "closed";
  const [seeded, setSeeded] = useState(seed);
  if (seed !== seeded) {
    setSeeded(seed);
    if (open) {
      setDraft(room ? toDraft(room) : blank);
      setTouched(false);
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const nameError = draft.name.trim().length < 2;
  const rateError = draft.nightly <= 0;
  const invalid = nameError || rateError;

  const save = () => {
    setTouched(true);
    if (invalid) {
      notify("Give the room a name and a nightly rate first.", { tone: "warning" });
      return;
    }

    const features = draft.features
      .split(",")
      .map((feature) => feature.trim())
      .filter(Boolean);

    const payload = {
      name: draft.name.trim(),
      location: draft.location.trim() || `${draft.category} · Gumtree Valley`,
      category: draft.category,
      status: draft.status,
      maxGuests: Math.max(1, draft.maxGuests),
      nightly: draft.nightly,
      weekend: draft.weekend || draft.nightly,
      bedLabel: draft.bedLabel.trim() || "Queen Bed",
      features: features.length ? features : ["Garden View"],
      image: draft.image,
    };

    if (room) {
      updateRoom(room.code, payload);
      notify(`${payload.name} updated.`, { icon: "check_circle", tone: "success" });
    } else {
      addRoom(payload);
      notify(`${payload.name} added to the estate.`, { icon: "add_home", tone: "success" });
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={room ? "edit_home" : "add_home"}
      title={room ? `Edit ${room.name}` : "Add a room"}
      description={
        room
          ? "Rates, capacity and status — changes apply to availability straight away."
          : "New units become bookable on the availability grid as soon as you save."
      }
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-outline-variant/40 px-4 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container active:scale-[0.98]"
          >
            <span className="ms-outlined text-[18px]">check</span>
            {room ? "Save changes" : "Add room"}
          </button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="room-name">
            Room name
          </label>
          <input
            id="room-name"
            data-autofocus
            value={draft.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="e.g. Fern Hollow Cabin"
            aria-invalid={touched && nameError}
            className={`${fieldClass} ${touched && nameError ? "border-error" : ""}`}
          />
          {touched && nameError ? (
            <p className="mt-1 text-label-sm text-label-sm text-error">
              Give the room a name.
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="room-location">
            Where it sits
          </label>
          <input
            id="room-location"
            value={draft.location}
            onChange={(event) => set("location", event.target.value)}
            placeholder="Secluded • Garden Outposts"
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="room-category">
            Group
          </label>
          <select
            id="room-category"
            value={draft.category}
            onChange={(event) => set("category", event.target.value as Draft["category"])}
            className={fieldClass}
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="room-status">
            Status
          </label>
          <select
            id="room-status"
            value={draft.status}
            onChange={(event) => set("status", event.target.value as Draft["status"])}
            className={fieldClass}
          >
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="room-guests">
            Sleeps
          </label>
          <input
            id="room-guests"
            type="number"
            min={1}
            max={12}
            value={draft.maxGuests}
            onChange={(event) => set("maxGuests", Math.max(1, Number(event.target.value) || 1))}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="room-nightly">
            Nightly rate
          </label>
          <input
            id="room-nightly"
            type="number"
            min={0}
            value={draft.nightly}
            onChange={(event) => set("nightly", Number(event.target.value) || 0)}
            aria-invalid={touched && rateError}
            className={`${fieldClass} ${touched && rateError ? "border-error" : ""}`}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="room-weekend">
            Weekend rate
          </label>
          <input
            id="room-weekend"
            type="number"
            min={0}
            value={draft.weekend}
            onChange={(event) => set("weekend", Number(event.target.value) || 0)}
            className={fieldClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="room-bed">
            Beds
          </label>
          <input
            id="room-bed"
            value={draft.bedLabel}
            onChange={(event) => set("bedLabel", event.target.value)}
            placeholder="King Bed • Creek View"
            className={fieldClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="room-features">
            Features
          </label>
          <input
            id="room-features"
            value={draft.features}
            onChange={(event) => set("features", event.target.value)}
            placeholder="Fireplace, Soaking Tub, Kitchenette"
            className={fieldClass}
          />
          <p className="mt-1 text-label-sm text-label-sm text-outline">
            Separate with commas — these show on the room card.
          </p>
        </div>

        <div className="sm:col-span-2">
          <span className={labelClass}>Cover photo</span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {photos.map((photo) => (
              <button
                key={photo.url}
                type="button"
                onClick={() => set("image", photo.url)}
                aria-label={photo.label}
                aria-pressed={draft.image === photo.url}
                className={`h-16 overflow-hidden rounded-lg border-2 transition-colors ${
                  draft.image === photo.url
                    ? "border-primary"
                    : "border-outline-variant/30 hover:border-primary/50"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
