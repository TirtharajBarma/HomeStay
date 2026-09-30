"use client";

import { useState } from "react";
import { useEstate } from "@/components/estate-provider";
import { fieldClass, labelClass } from "@/components/owner/primitives";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { coverageAreas, driverStatuses, vehicles } from "@/lib/drivers-data";

type Draft = {
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  plate: string;
  coverage: string;
  status: string;
};

const blank: Draft = {
  name: "",
  phone: "",
  email: "",
  vehicle: vehicles[0],
  plate: "",
  coverage: coverageAreas[0],
  status: "Invited",
};

type AddDriverDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function AddDriverDialog({ open, onClose }: AddDriverDialogProps) {
  const { addDriver } = useEstate();
  const { notify } = useToast();
  const [draft, setDraft] = useState<Draft>(blank);
  const [touched, setTouched] = useState(false);
  const [openSeed, setOpenSeed] = useState(open);

  // A fresh form every time the dialog opens, without an effect.
  if (open !== openSeed) {
    setOpenSeed(open);
    if (open) {
      setDraft(blank);
      setTouched(false);
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const nameError = draft.name.trim().length < 2;
  const phoneError = draft.phone.replace(/\D/g, "").length < 7;
  const emailError = draft.email.length > 0 && !/^\S+@\S+\.\S+$/.test(draft.email);
  const invalid = nameError || phoneError || emailError;

  const save = () => {
    setTouched(true);
    if (invalid) {
      notify("A driver needs a name and a reachable phone number.", { tone: "warning" });
      return;
    }

    addDriver({
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim() || `${draft.name.trim().toLowerCase().replace(/\s+/g, ".")}@gumtreevalley.in`,
      vehicle: draft.vehicle,
      plate: draft.plate.trim() || "Pending",
      coverage: draft.coverage,
      status: draft.status as "Active" | "On a trip" | "Invited" | "Paused",
    });

    notify(`${draft.name.trim()} added to the driver roster.`, {
      icon: "person_add",
      tone: "success",
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon="person_add"
      title="Add a driver"
      description="Name and mobile number are all you need — the rest can be filled in later."
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
            Add to roster
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
        <div>
          <label className={labelClass} htmlFor="driver-name">
            Full name
          </label>
          <input
            id="driver-name"
            data-autofocus
            value={draft.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="e.g. Ruben Castillo"
            aria-invalid={touched && nameError}
            className={`${fieldClass} ${touched && nameError ? "border-error" : ""}`}
          />
          {touched && nameError ? (
            <p className="mt-1 text-label-sm text-label-sm text-error">
              Enter the driver&apos;s name.
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="driver-phone">
            Mobile number
          </label>
          <input
            id="driver-phone"
            type="tel"
            value={draft.phone}
            onChange={(event) => set("phone", event.target.value)}
            placeholder="+1 (802) 555 0100"
            aria-invalid={touched && phoneError}
            className={`${fieldClass} ${touched && phoneError ? "border-error" : ""}`}
          />
          {touched && phoneError ? (
            <p className="mt-1 text-label-sm text-label-sm text-error">
              That number looks too short to dispatch.
            </p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="driver-email">
            Email for the invite
          </label>
          <input
            id="driver-email"
            type="email"
            value={draft.email}
            onChange={(event) => set("email", event.target.value)}
            placeholder="name@example.com"
            aria-invalid={touched && emailError}
            className={`${fieldClass} ${touched && emailError ? "border-error" : ""}`}
          />
          <p className="mt-1 text-label-sm text-label-sm text-outline">
            Left blank, we generate a roster address so the invite still sends.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="driver-vehicle">
            Vehicle
          </label>
          <select
            id="driver-vehicle"
            value={draft.vehicle}
            onChange={(event) => set("vehicle", event.target.value)}
            className={fieldClass}
          >
            {vehicles.map((vehicle) => (
              <option key={vehicle}>{vehicle}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="driver-plate">
            Plate
          </label>
          <input
            id="driver-plate"
            value={draft.plate}
            onChange={(event) => set("plate", event.target.value)}
            placeholder="VT 1234"
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="driver-coverage">
            Usual coverage
          </label>
          <select
            id="driver-coverage"
            value={draft.coverage}
            onChange={(event) => set("coverage", event.target.value)}
            className={fieldClass}
          >
            {coverageAreas.map((area) => (
              <option key={area}>{area}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="driver-status">
            Start as
          </label>
          <select
            id="driver-status"
            value={draft.status}
            onChange={(event) => set("status", event.target.value)}
            className={fieldClass}
          >
            {driverStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 rounded-lg bg-primary-tint p-3 text-label-sm text-label-sm text-on-primary-container">
          <p className="flex items-center gap-1.5 font-semibold">
            <span className="ms-outlined text-[16px]">mail</span>
            Save, then hit “Send invite” on their roster card to open a pre-filled email.
          </p>
        </div>

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
