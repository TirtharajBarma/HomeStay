"use client";

import { useState } from "react";
import { AddDriverDialog } from "@/components/drivers/add-driver-dialog";
import { useEstate } from "@/components/estate-provider";
import { Icon } from "@/components/icon";
import {
  PageHeader,
  PageShell,
  Panel,
  StatCard,
  fieldClass,
  solidButton,
} from "@/components/owner/primitives";
import { useToast } from "@/components/ui/toast";
import {
  driverStatusTone,
  driverStatuses,
  invitationLink,
  rosterLink,
  type DriverStatus,
} from "@/lib/drivers-data";
import { shortDate } from "@/lib/timeline";
import { useMoney } from "@/components/currency-provider";

const stars = (rating: number) => Math.round(rating);

export function DriversView() {
  const { money } = useMoney();

  const { drivers, updateDriver, removeDriver } = useEstate();
  const { notify } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");

  const rank = (driver: { status: string }) =>
    ["Active", "On a trip", "Invited", "Paused"].indexOf(driver.status);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? drivers.filter((driver) =>
        `${driver.name} ${driver.phone} ${driver.vehicle} ${driver.coverage}`
          .toLowerCase()
          .includes(needle),
      )
    : [...drivers].sort((a, b) => rank(a) - rank(b));

  const totals = {
    active: drivers.filter((driver) => driver.status === "Active").length,
    onRoad: drivers.filter((driver) => driver.status === "On a trip").length,
    invited: drivers.filter((driver) => driver.status === "Invited").length,
    trips: drivers.reduce((sum, driver) => sum + driver.trips, 0),
    rating:
      Math.round(
        (drivers.reduce((sum, driver) => sum + driver.rating, 0) / Math.max(1, drivers.length)) * 10,
      ) / 10,
    commission: drivers.reduce((sum, driver) => sum + driver.commission, 0),
  };

  const sendInvite = (id: string, name: string) => {
    notify(`Invite email opened for ${name}.`, { icon: "outgoing_mail", tone: "success" });
  };

  return (
    <PageShell>
      <PageHeader
        breadcrumb="Homestay Operations"
        title="Add Drivers"
        description="The cab roster behind every airport and valley transfer. Add a driver, keep their number current, and send the app invite from here."
        actions={
          <button onClick={() => setAddOpen(true)} className={solidButton}>
            <Icon name="person_add" className="flex-shrink-0 text-[18px]" />
            Add driver
          </button>
        }
        meta={
          <>
            <span className="flex items-center gap-1.5 rounded-md bg-surface-container px-2.5 py-1 text-label-sm text-label-sm text-on-surface-variant">
              <Icon name="directions_car" className="text-[15px] text-outline" />
              {drivers.length} on the roster
            </span>
            <span className="flex items-center gap-1.5 rounded-md bg-surface-container px-2.5 py-1 text-label-sm text-label-sm text-on-surface-variant">
              <Icon name="local_taxi" className="text-[15px] text-outline" />
              {totals.onRoad} on a trip right now
            </span>
            <span className="flex items-center gap-1.5 rounded-md bg-surface-container px-2.5 py-1 text-label-sm text-label-sm text-on-surface-variant">
              <Icon name="star" className="text-[15px] text-outline" />
              {totals.rating} average rating
            </span>
          </>
        }
      />

      {/* Prominent add-driver band — the page is called "Add Drivers". */}
      <section className="my-space-md flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary-tint p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm">
            <Icon name="person_add" className="text-[20px]" />
          </span>
          <div>
            <h2 className="text-title-sm text-title-sm font-semibold text-primary">
              Add a driver to the roster
            </h2>
            <p className="mt-0.5 text-label-sm text-label-sm text-on-surface-variant">
              Name and number is all we need — send the app invite from their card afterwards.
            </p>
          </div>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          data-testid="add-driver-cta"
          className={`${solidButton} w-full justify-center shrink-0 sm:w-auto`}
        >
          <Icon name="add" className="flex-shrink-0 text-[18px]" />
          Add driver
        </button>
      </section>

      <div className="my-space-lg grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard
          label="Drivers on roster"
          value={String(drivers.length)}
          icon="directions_car"
          footnote={`${drivers.filter((d) => d.status === "Active").length} active and available`}
        />
        <StatCard
          label="On a trip"
          value={String(totals.onRoad)}
          icon="moving"
          iconTone="bg-secondary-tint text-secondary-ink"
          footnote="Mid-run right now"
        />
        <StatCard
          label="Trips completed"
          value={totals.trips.toLocaleString("en-IN")}
          icon="route"
          footnote="Lifetime across the roster"
        />
        <StatCard
          label="Average rating"
          value={String(totals.rating)}
          icon="star_rate"
          iconTone="bg-tertiary-fixed text-on-tertiary-fixed"
          footnote="From guest feedback"
        />
        <StatCard
          label="Awaiting invite"
          value={String(totals.invited)}
          icon="outgoing_mail"
          footnote={
            totals.invited
              ? "Send the app link to start them off"
              : "Everyone has confirmed"
          }
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
        <div className="flex flex-col gap-space-lg lg:col-span-8">
          <Panel
            title="Driver roster"
            icon="badge"
            caption={`${shown.length} of ${drivers.length} drivers · ${totals.active} active now`}
          >
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Icon
                  name="search"
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[16px] text-outline"
                />
                <label htmlFor="driver-search" className="sr-only">
                  Search drivers
                </label>
                <input
                  id="driver-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, phone, vehicle or area…"
                  className={`${fieldClass} ps-9`}
                />
              </div>
              <a
                href={rosterLink("roster@gumtreevalley.in")}
                onClick={() => notify("Roster email drafted.", { icon: "outgoing_mail" })}
                className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/60 bg-surface-container px-3.5 py-2 text-label-md text-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container-high"
              >
                <Icon name="campaign" className="flex-shrink-0 text-[18px]" />
                Message the roster
              </a>
            </div>

            <ul className="flex flex-col gap-3">
              {shown.map((driver) => (
                <li
                  key={driver.id}
                  className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary-tint text-title-sm text-title-sm font-semibold text-primary">
                        {driver.name.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-body-md text-body-md font-semibold text-on-surface">
                          {driver.name}
                        </p>
                        <p className="line-clamp-2 text-label-sm text-label-sm text-outline sm:truncate">
                          {driver.vehicle} · {driver.plate} · {driver.coverage}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-label-sm text-label-sm font-semibold whitespace-nowrap ${driverStatusTone(driver.status)}`}
                    >
                      {driver.status}
                    </span>
                  </div>

                  <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <span className="block text-label-sm text-label-sm uppercase text-outline">
                        Mobile
                      </span>
                      <a
                        href={`tel:${driver.phone.replace(/[^\d+]/g, "")}`}
                        className="flex min-h-[2.25rem] items-center text-body-md text-body-md text-on-surface underline decoration-outline-variant underline-offset-2 transition-colors hover:text-primary"
                      >
                        {driver.phone}
                      </a>
                    </div>
                    <div>
                      <span className="block text-label-sm text-label-sm uppercase text-outline">
                        Trips
                      </span>
                      <p className="text-body-md text-body-md text-on-surface">{driver.trips}</p>
                    </div>
                    <div>
                      <span className="block text-label-sm text-label-sm uppercase text-outline">
                        Rating
                      </span>
                      <p className="flex items-center gap-1 text-body-md text-body-md text-on-surface">
                        {driver.rating}
                        <span className="text-label-sm text-label-sm text-secondary-ink">
                          {"★".repeat(stars(driver.rating))}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="block text-label-sm text-label-sm uppercase text-outline">
                        Paid out
                      </span>
                      <p className="text-body-md text-body-md font-semibold text-primary">
                        {money(driver.commission)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-outline-variant/20 pt-3">
                    <a
                      href={invitationLink(driver)}
                      onClick={() => sendInvite(driver.id, driver.name)}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container"
                    >
                      <Icon name="outgoing_mail" className="text-[16px]" />
                      {driver.status === "Invited" ? "Send invite" : "Resend invite"}
                    </a>

                    <label className="sr-only" htmlFor={`status-${driver.id}`}>
                      Status for {driver.name}
                    </label>
                    <select
                      id={`status-${driver.id}`}
                      value={driver.status}
                      onChange={(event) => {
                        const status = event.target.value as DriverStatus;
                        updateDriver(driver.id, { status });
                        notify(`${driver.name} is now ${status.toLowerCase()}.`, {
                          icon: "swap_horiz",
                        });
                      }}
                      className="rounded-lg border border-outline-variant/40 bg-surface-container px-2.5 py-2 text-label-md text-label-md text-on-surface"
                    >
                      {driverStatuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        removeDriver(driver.id);
                        notify(`${driver.name} removed from the roster.`, { tone: "warning" });
                      }}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-label-md text-label-md text-outline transition-colors hover:bg-surface-container hover:text-error"
                    >
                      <Icon name="person_remove" className="text-[16px]" />
                      Remove
                    </button>

                    <span className="ms-auto text-label-sm text-label-sm text-outline">
                      Joined {shortDate(driver.joined)} {driver.joined.getFullYear()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {shown.length === 0 ? (
              <p className="py-8 text-center text-body-md text-body-md text-outline">
                No drivers match “{query}”.
              </p>
            ) : null}
          </Panel>
        </div>

        <div className="flex flex-col gap-space-lg lg:col-span-4">
                    <Panel
            title="Add a driver"
            icon="person_add"
            caption="Name and number is all that is required"
            action={
              <button
                onClick={() => setAddOpen(true)}
                className="flex min-h-[2.25rem] items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-label-sm text-label-sm font-semibold text-on-primary transition-colors hover:bg-primary-container"
              >
                <Icon name="add" className="text-[15px]" />
                Add
              </button>
            }
          >
            <p className="text-body-sm text-body-sm text-on-surface-variant">
              New drivers start as <strong className="font-semibold text-primary">Invited</strong> so
              nothing is dispatched to them before they accept. Their commission starts at zero and
              builds as trips complete.
            </p>
            <ul className="mt-3.5 flex flex-col gap-2">
              {["Full name and mobile number", "Vehicle and plate for the log", "Usual coverage area"].map(
                (step) => (
                  <li
                    key={step}
                    className="flex items-center gap-2 text-label-md text-label-md text-on-surface-variant"
                  >
                    <Icon name="check" className="text-[15px] text-primary" />
                    {step}
                  </li>
                ),
              )}
            </ul>
          </Panel>
        </div>
      </div>

      <AddDriverDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </PageShell>
  );
}
