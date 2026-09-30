"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { PricingRules } from "@/components/rooms/pricing-rules";
import { RoomCard } from "@/components/rooms/room-card";
import { Modal } from "@/components/ui/modal";
import { Popover } from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast";
import { filterTabs, roomUnits } from "@/lib/rooms-data";

export function RoomsView() {
  const [filter, setFilter] = useState("All Units");
  const [bulk, setBulk] = useState(false);
  const [add, setAdd] = useState(false);
  const [extraFilters, setExtraFilters] = useState<string[]>([]);

  const visible = roomUnits.filter((room) => {
    const matchesTab = filter === "All Units" || room.category === filter;
    const matchesExtra =
      extraFilters.length === 0 ||
      (extraFilters.includes("Available tonight")
        ? room.status === "Active"
        : extraFilters.includes("Under maintenance")
          ? room.status === "Maintenance"
          : true);
    return matchesTab && matchesExtra;
  });

  return (
        <div className="mx-auto max-w-[1360px] p-4 pb-space-xl md:p-space-lg">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-label-sm text-label-sm font-medium text-outline uppercase">
                <Icon name="inventory_2" className="text-[16px] text-primary" />
                Live Estate Inventory • Updated 14 mins ago
              </span>
              <h1 className="text-headline-lg-mobile text-headline-lg-mobile font-semibold tracking-tight text-on-surface md:text-headline-lg">
                Rooms &amp; Accommodation Categories
              </h1>
              <p className="text-body-lg text-body-lg text-on-surface-variant">
                Manage your 6 homestay units, seasonal nightly rates, amenities,
                and photos.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button
                onClick={() => setBulk(true)}
                className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/40 bg-surface px-4 py-2.5 text-label-md text-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container"
              >
                <Icon name="edit_note" className="text-[18px] text-tertiary" />
                <span>Bulk Price Update</span>
              </button>
              <button
                onClick={() => setAdd(true)}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-label-md text-label-md text-on-primary shadow-sm transition-all hover:bg-primary-container active:scale-[0.98]"
              >
                <Icon name="add" className="text-[18px]" />
                <span>Add New Room / Unit</span>
              </button>
            </div>
          </header>

          <div className="mt-6 flex flex-col gap-3 border-b border-outline-variant/30 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <nav
              className="custom-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
              aria-label="Unit filters"
            >
              {filterTabs.map((tab) => (
                <button
                  key={tab.label}
                  onClick={() => setFilter(tab.label)}
                  aria-pressed={filter === tab.label}
                  className={
                    filter === tab.label
                      ? "flex flex-shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-label-md text-label-md font-semibold text-on-primary shadow-sm"
                      : "flex flex-shrink-0 items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-4 py-1.5 text-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container"
                  }
                >
                  {tab.label}
                  {tab.count ? (
                    <span
                      className={
                        filter === tab.label
                          ? "rounded-full bg-on-primary/20 px-1.5 text-label-sm text-label-sm"
                          : "rounded-full bg-surface-container px-1.5 text-label-sm text-label-sm"
                      }
                    >
                      {tab.label === filter ? visible.length : tab.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>

            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-1.5 text-label-md text-label-md text-on-surface-variant">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                5 Active
              </span>
              <span className="flex items-center gap-1.5 text-label-md text-label-md text-on-surface-variant">
                <span className="h-2.5 w-2.5 rounded-full bg-hold-ink" />
                1 Maintenance
              </span>
              <Popover
                label="Unit filters"
                panelClassName="w-64"
                trigger={({ toggle, open, ...aria }) => (
                  <button
                    {...aria}
                    onClick={toggle}
                    className={`ml-auto flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-label-md text-label-md text-on-surface transition-colors sm:ml-2 ${
                      open || extraFilters.length
                        ? "border-primary/40 bg-primary-tint text-primary"
                        : "border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container"
                    }`}
                  >
                    <Icon name="filter_list" className="text-[18px]" />
                    <span>Filter</span>
                    {extraFilters.length ? (
                      <span className="rounded-full bg-primary px-1.5 text-label-sm text-label-sm text-on-primary">
                        {extraFilters.length}
                      </span>
                    ) : null}
                  </button>
                )}
              >
                {(close) => (
                  <div className="p-2">
                    {["Available tonight", "Under maintenance"].map((option) => (
                      <label
                        key={option}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-body-md text-body-md text-on-surface transition-colors hover:bg-surface-container"
                      >
                        <input
                          type="checkbox"
                          checked={extraFilters.includes(option)}
                          onChange={(event) =>
                            setExtraFilters((current) =>
                              event.target.checked
                                ? [...current, option]
                                : current.filter((entry) => entry !== option),
                            )
                          }
                          className="h-4 w-4 accent-[var(--color-primary)]"
                        />
                        {option}
                      </label>
                    ))}
                    <button
                      onClick={() => {
                        setExtraFilters([]);
                        close();
                      }}
                      className="mt-1 w-full rounded-lg bg-surface-container px-3 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
                    >
                      Reset filters
                    </button>
                  </div>
                )}
              </Popover>
            </div>
          </div>

          <p className="mt-6 text-label-sm text-label-sm text-outline" aria-live="polite">
            Showing {visible.length} of {roomUnits.length} units
            {filter !== "All Units" ? ` in ${filter}` : ""}
          </p>

          <div className="mt-3 grid grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((room) => (
              <RoomCard key={room.code} room={room} />
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-lowest px-4 py-12 text-center text-body-md text-body-md text-outline">
              No units match the current filters.
            </p>
          ) : null}

          <PricingRules />

          <BulkPriceDialog
            open={bulk}
            count={visible.length}
            onClose={() => setBulk(false)}
          />
          <AddUnitDialog open={add} onClose={() => setAdd(false)} />
        </div>
  );
}

function BulkPriceDialog({
  open,
  count,
  onClose,
}: {
  open: boolean;
  count: number;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const [percent, setPercent] = useState(5);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk price update"
      description={`Applies a percentage change to ${count} unit${count === 1 ? "" : "s"}.`}
      icon="edit_note"
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
            onClick={() => {
              onClose();
              notify(
                `${percent > 0 ? "+" : ""}${percent}% applied to ${count} units.`,
                { icon: "price_change", tone: "success" },
              );
            }}
            className="rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
          >
            Apply to {count} units
          </button>
        </>
      }
    >
      <label
        className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
        htmlFor="bulk-percent"
      >
        Adjustment (%)
      </label>
      <input
        id="bulk-percent"
        data-autofocus
        type="number"
        min={-90}
        max={200}
        value={percent}
        onChange={(event) => setPercent(Number(event.target.value) || 0)}
        className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
      />
    </Modal>
  );
}

function AddUnitDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notify } = useToast();
  const [name, setName] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add new room / unit"
      description="Creates a draft unit ready for rates and photos."
      icon="add_home"
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
            onClick={() => {
              onClose();
              notify(`${name.trim() || "New unit"} created as a draft.`, {
                icon: "add_home",
                tone: "success",
              });
              setName("");
            }}
            className="rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
          >
            Create unit
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label
            className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
            htmlFor="unit-name"
          >
            Unit name
          </label>
          <input
            id="unit-name"
            data-autofocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Willow Brook Cabin"
            className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-label-md text-label-md font-medium text-on-surface-variant"
            htmlFor="unit-category"
          >
            Category
          </label>
          <select
            id="unit-category"
            className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-body-md text-body-md text-on-surface"
            defaultValue="Garden Cabins"
          >
            {["Main House", "Barn Lofts", "Garden Cabins"].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
