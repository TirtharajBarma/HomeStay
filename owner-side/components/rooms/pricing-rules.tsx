"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { pricingRules as seedRules } from "@/lib/rooms-data";

const auditLog = [
  { time: "Oct 22, 09:14", who: "Eleanor T.", what: "Updated Oak Hearth Suite base rate" },
  { time: "Oct 19, 16:02", who: "Clara S.", what: "Applied Autumn Foliage Peak rule" },
  { time: "Oct 11, 11:47", who: "Eleanor T.", what: "Blocked Willow Brook (chimney)" },
];

type Rule = (typeof seedRules)[number] & { on?: boolean };

export function PricingRules() {
  const { notify } = useToast();
  const [rules, setRules] = useState<Rule[]>(seedRules.map((rule) => ({ ...rule, on: true })));
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  return (
    <section className="mt-8 grid grid-cols-1 gap-6 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_1px_3px_rgba(45,48,46,0.04)] md:p-space-lg lg:grid-cols-3">
      <div className="lg:col-span-1">
        <div className="flex items-center gap-2">
          <Icon name="discount" className="text-[20px] text-secondary" />
          <h2 className="text-headline-sm text-headline-sm font-semibold text-on-surface">
            Seasonal &amp; Weekend Pricing Rules
          </h2>
        </div>
        <p className="mt-2 text-body-sm text-body-sm text-on-surface-variant">
          Automated nightly rate modifiers applied at booking time across your
          estate.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {auditLog.map((entry) => (
            <div
              key={entry.time}
              className="flex items-start gap-2.5 border-l-2 border-outline-variant/40 pl-3"
            >
              <div className="flex flex-col">
                <span className="text-label-sm text-label-sm text-outline">
                  {entry.time} • {entry.who}
                </span>
                <span className="text-body-sm text-body-sm text-on-surface">
                  {entry.what}
                </span>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setLogOpen(true)}
          className="mt-4 flex items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface px-3.5 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
        >
          <Icon name="receipt_long" className="text-[16px]" />
          <span>View All Changes</span>
        </button>
      </div>

      <div className="flex flex-col gap-3 lg:col-span-2">
        {rules.map((rule) => (
          <div
            key={rule.title}
            className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 transition-shadow hover:shadow-sm ${
              rule.on === false ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${rule.tone}`}
              >
                <Icon name={rule.icon} className="text-[20px]" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-title-md text-title-md font-semibold text-on-surface">
                  {rule.title}
                </span>
                <span className="text-body-sm text-body-sm text-on-surface-variant">
                  {rule.detail}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-surface-container px-2.5 py-1 text-label-sm text-label-sm text-on-surface-variant">
                {rule.scope}
              </span>
              <button
                role="switch"
                aria-checked={rule.on !== false}
                aria-label={`${rule.title} rule active`}
                title={rule.on === false ? "Enable rule" : "Disable rule"}
                onClick={() => {
                  setRules((current) =>
                    current.map((entry) =>
                      entry.title === rule.title
                        ? { ...entry, on: entry.on === false }
                        : entry,
                    ),
                  );
                  notify(
                    `${rule.title} ${rule.on === false ? "enabled" : "paused"}.`,
                    { icon: rule.on === false ? "play_circle" : "pause_circle" },
                  );
                }}
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                  rule.on === false ? "bg-outline-variant/50" : "bg-primary"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    rule.on === false ? "translate-x-0.5" : "translate-x-[22px]"
                  }`}
                />
              </button>
              <button
                title={`Edit ${rule.title}`}
                aria-label={`Edit ${rule.title}`}
                onClick={() => setEditing(rule.title)}
                className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
              >
                <Icon name="edit" className="text-[18px]" />
              </button>
              <button
                title={`Delete ${rule.title}`}
                aria-label={`Delete ${rule.title}`}
                onClick={() => {
                  setRules((current) => current.filter((entry) => entry.title !== rule.title));
                  notify(`${rule.title} removed.`, { icon: "delete", tone: "warning" });
                }}
                className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-hold-surface hover:text-hold-ink"
              >
                <Icon name="delete" className="text-[18px]" />
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={() => setAdding(true)}
          className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-outline-variant/50 bg-surface-container-lowest px-4 py-3.5 text-label-md text-label-md font-semibold text-primary transition-colors hover:border-primary-container/50 hover:bg-primary-tint/50"
        >
          <Icon name="add_circle" className="text-[18px]" />
          <span>Add Dynamic Rule</span>
        </button>
      </div>

      <RuleDialog
        open={adding || editing !== null}
        initial={editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSave={(rule) => {
          if (editing) {
            setRules((current) =>
              current.map((entry) => (entry.title === editing ? { ...entry, ...rule } : entry)),
            );
            notify(`${rule.title} updated.`, { icon: "check_circle", tone: "success" });
          } else {
            setRules((current) => [...current, { ...rule, on: true }]);
            notify(`${rule.title} added.`, { icon: "check_circle", tone: "success" });
          }
          setAdding(false);
          setEditing(null);
        }}
      />

      <Modal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title="Pricing change log"
        description="Every rate and rule adjustment on the estate."
        icon="receipt_long"
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
          {[...auditLog, { time: "Just now", who: "You", what: `${rules.length} rules active` }].map(
            (entry, index) => (
              <li
                key={`${entry.time}-${index}`}
                className="flex items-start gap-2.5 border-l-2 border-outline-variant/40 pl-3"
              >
                <div className="flex flex-col">
                  <span className="text-label-sm text-label-sm text-outline">
                    {entry.time} • {entry.who}
                  </span>
                  <span className="text-body-sm text-body-sm text-on-surface">
                    {entry.what}
                  </span>
                </div>
              </li>
            ),
          )}
        </ul>
      </Modal>
    </section>
  );
}

function RuleDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: string | null;
  onClose: () => void;
  onSave: (rule: { title: string; detail: string; scope: string; icon: string; tone: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [scope, setScope] = useState("All 6 units");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit pricing rule" : "Add dynamic rule"}
      description={initial ?? "Applies a seasonal or length-of-stay adjustment."}
      icon="local_offer"
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-outline-variant/40 px-4 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onSave({
                title: title.trim() || initial || "Untitled rule",
                detail: detail.trim() || "Custom estate adjustment",
                scope,
                icon: "local_offer",
                tone: "bg-primary-tint text-primary",
              })
            }
            className="rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
          >
            {initial ? "Save rule" : "Add rule"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label
            className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
            htmlFor="rule-title"
          >
            Rule name
          </label>
          <input
            id="rule-title"
            data-autofocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={initial ?? "e.g. Winter Long-Stay Discount"}
            className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
            htmlFor="rule-detail"
          >
            Adjustment
          </label>
          <input
            id="rule-detail"
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="e.g. -15% nightly for stays of 5 nights or more"
            className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
            htmlFor="rule-scope"
          >
            Applies to
          </label>
          <select
            id="rule-scope"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
          >
            {["All 6 units", "Main House", "Barn Lofts", "Garden Cabins"].map(
              (option) => (
                <option key={option}>{option}</option>
              ),
            )}
          </select>
        </div>
      </div>
    </Modal>
  );
}
