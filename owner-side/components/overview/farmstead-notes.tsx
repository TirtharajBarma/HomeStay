"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

const notes = [
  {
    icon: "bakery_dining",
    iconTone: "text-secondary",
    title: "Fresh sourdough delivery tomorrow 7:00 AM",
    detail: "Baker Jacques leaving 4 country loaves in dairy cooler",
  },
  {
    icon: "forest",
    iconTone: "text-primary",
    title: "Firewood restock scheduled for 2:00 PM",
    detail: "Dry seasoned birch stacks for Loft Barn and Main Hearth",
  },
  {
    icon: "local_florist",
    iconTone: "text-outline",
    title: "Pick garden cosmos & mint for dinner guests",
    detail: "Prep welcome vases for Sarah Jenkins' arrival",
  },
];

export function FarmsteadNotes() {
  const [added, setAdded] = useState<{ title: string; detail: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const { notify } = useToast();

  const save = () => {
    const label = title.trim() || "New reminder";
    setAdded((current) => [{ title: label, detail: detail.trim() || "Added from the dashboard" }, ...current]);
    setTitle("");
    setDetail("");
    setOpen(false);
    notify("Reminder added to Farmstead notes.", { icon: "check_circle", tone: "success" });
  };

  return (
    <section className="clay-card rounded-xl bg-warm-surface p-5">
      <div className="mb-3 flex items-center justify-between border-b border-warm-outline pb-3">
        <div className="flex items-center gap-2">
          <Icon name="edit_note" className="text-[20px] text-secondary" />
          <h3 className="font-headline-sm text-base font-semibold text-primary">
            Farmstead Reminders
          </h3>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-primary hover:underline"
        >
          + Add Note
        </button>
      </div>

      <ul className="space-y-2.5">
        {added.map((note) => (
          <li
            key={note.title}
            className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary-tint/50 p-3"
          >
            <Icon name="sticky_note_2" className="mt-0.5 flex-shrink-0 text-[18px] text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary">{note.title}</p>
              <p className="text-[11px] text-on-surface-variant">{note.detail}</p>
            </div>
          </li>
        ))}

        {notes.map((note) => (
          <li
            key={note.title}
            className="flex items-start gap-2.5 rounded-lg border border-outline-variant/20 bg-surface-container-lowest/80 p-2"
          >
            <Icon
              name={note.icon}
              className={`mt-0.5 text-[18px] ${note.iconTone}`}
            />
            <div className="text-xs">
              <p className="font-semibold text-on-surface">{note.title}</p>
              <p className="text-[11px] text-outline">{note.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add reminder"
        description="Saved notes appear for the whole team on this dashboard."
        icon="edit_note"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-outline-variant/40 px-4 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
            >
              Save note
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label
              htmlFor="note-title"
              className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
            >
              Reminder
            </label>
            <input
              id="note-title"
              data-autofocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Restock firewood Friday"
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
            />
          </div>
          <div>
            <label
              htmlFor="note-detail"
              className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
            >
              Detail
            </label>
            <textarea
              id="note-detail"
              rows={3}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="Optional context for the team"
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
            />
          </div>
        </div>
      </Modal>
    </section>
  );
}
