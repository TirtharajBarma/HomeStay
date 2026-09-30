"use client";

import { useState } from "react";
import { useEstate, locationKinds, type EstateLocation, type EstateRoom } from "@/components/estate-provider";
import { useMoney } from "@/components/currency-provider";
import { Icon } from "@/components/icon";
import { LocationPicker } from "@/components/profile/location-picker";
import {
  PageHeader,
  PageShell,
  Panel,
  StatCard,
  fieldClass,
  ghostButton,
  labelClass,
  solidButton,
} from "@/components/owner/primitives";
import { RoomFormDialog } from "@/components/rooms/room-form-dialog";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { guestStats } from "@/lib/guests-data";

const tabs = [
  { key: "personal", label: "Personal details", icon: "person" },
  { key: "rooms", label: "Rooms", icon: "king_bed" },
  { key: "locations", label: "Locations", icon: "location_on" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function ProfileView() {
  const { money } = useMoney();

  const {
    profile,
    updateProfile,
    rooms,
    removeRoom,
    locations,
    addLocation,
    updateLocation,
    removeLocation,
    bookings,
    reset,
  } = useEstate();
  const { notify } = useToast();

  const [tab, setTab] = useState<TabKey>("personal");
  const [editingRoom, setEditingRoom] = useState<EstateRoom | null>(null);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<EstateLocation | null>(null);
  const [addingLocation, setAddingLocation] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const saveProfile = () => {
    notify("Your details are saved.", { icon: "check_circle", tone: "success" });
  };

  const nightlyTotal = rooms.reduce((sum, room) => sum + room.nightly, 0);

  return (
    <PageShell>
      <PageHeader
        breadcrumb="Homestay Operations"
        title="Edit Profile"
        description="Your details, your rooms and your locations. Everything here saves to this browser and feeds the rest of the dashboard."
        actions={
          <>
            <button
              onClick={() => setConfirmReset(true)}
              className={ghostButton}
            >
              <Icon name="restart_alt" className="flex-shrink-0 text-[18px]" />
              Reset demo data
            </button>
            <button onClick={saveProfile} className={solidButton}>
              <Icon name="save" className="flex-shrink-0 text-[18px]" />
              Save changes
            </button>
          </>
        }
        meta={
          <>
            <span className="flex items-center gap-1.5 rounded-md bg-surface-container px-2.5 py-1 text-label-sm text-label-sm text-on-surface-variant">
              <Icon name="mail" className="text-[15px] text-outline" />
              {profile.email}
            </span>
            <span className="flex items-center gap-1.5 rounded-md bg-surface-container px-2.5 py-1 text-label-sm text-label-sm text-on-surface-variant">
              <Icon name="schedule" className="text-[15px] text-outline" />
              {profile.responseTime}
            </span>
          </>
        }
      />

      <div className="my-space-lg grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Rooms listed"
          value={String(rooms.length)}
          icon="king_bed"
          footnote={`${rooms.filter((room) => room.status === "Active").length} bookable right now`}
        />
        <StatCard
          label="Locations"
          value={String(locations.length)}
          icon="location_on"
          iconTone="bg-secondary-tint text-secondary-ink"
          footnote={`${locations.reduce((sum, entry) => sum + entry.units, 0)} units across the estate`}
        />
        <StatCard
          label="Bookings this session"
          value={String(bookings.length)}
          icon="event_available"
          iconTone="bg-tertiary-fixed text-on-tertiary-fixed"
          footnote={
            bookings.length
              ? `${money(bookings.reduce((sum, booking) => sum + booking.total, 0))} booked from Book Rooms`
              : "Nothing booked from the Book Rooms page yet"
          }
        />
        <StatCard
          label="Guest directory"
          value={String(guestStats.total)}
          icon="group"
          footnote={`${guestStats.returning} returning guests on file`}
        />
      </div>

      <div
        role="tablist"
        aria-label="Profile sections"
        className="custom-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container p-1.5"
      >
        {tabs.map((entry) => (
          <button
            key={entry.key}
            role="tab"
            aria-selected={tab === entry.key}
            onClick={() => setTab(entry.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-label-md text-label-md whitespace-nowrap transition-colors ${
              tab === entry.key
                ? "bg-surface-container-lowest font-semibold text-primary shadow-xs"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            <Icon name={entry.icon} className="text-[17px]" />
            {entry.label}
          </button>
        ))}
      </div>

      <div className="mt-space-md">
        {tab === "personal" ? (
          <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
            <Panel
              title="Personal details"
              icon="badge"
              caption="What guests see on the booking portal"
              className="lg:col-span-7"
            >
              <form
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveProfile();
                }}
              >
                <div>
                  <label className={labelClass} htmlFor="profile-name">
                    Name
                  </label>
                  <input
                    id="profile-name"
                    value={profile.name}
                    onChange={(event) => updateProfile({ name: event.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="profile-role">
                    Role
                  </label>
                  <input
                    id="profile-role"
                    value={profile.role}
                    onChange={(event) => updateProfile({ role: event.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="profile-email">
                    Email
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    value={profile.email}
                    onChange={(event) => updateProfile({ email: event.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="profile-phone">
                    Phone
                  </label>
                  <input
                    id="profile-phone"
                    type="tel"
                    value={profile.phone}
                    onChange={(event) => updateProfile({ phone: event.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="profile-address">
                    Street address
                  </label>
                  <input
                    id="profile-address"
                    value={profile.address}
                    onChange={(event) => updateProfile({ address: event.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="profile-town">
                    Town
                  </label>
                  <input
                    id="profile-town"
                    value={profile.town}
                    onChange={(event) => updateProfile({ town: event.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="profile-region">
                    State
                  </label>
                  <input
                    id="profile-region"
                    value={profile.region}
                    onChange={(event) => updateProfile({ region: event.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="profile-postal">
                    ZIP
                  </label>
                  <input
                    id="profile-postal"
                    value={profile.postal}
                    onChange={(event) => updateProfile({ postal: event.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="profile-in">
                    Check-in time
                  </label>
                  <input
                    id="profile-in"
                    value={profile.checkInTime}
                    onChange={(event) => updateProfile({ checkInTime: event.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="profile-out">
                    Check-out time
                  </label>
                  <input
                    id="profile-out"
                    value={profile.checkOutTime}
                    onChange={(event) => updateProfile({ checkOutTime: event.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="profile-response">
                    Response time
                  </label>
                  <input
                    id="profile-response"
                    value={profile.responseTime}
                    onChange={(event) => updateProfile({ responseTime: event.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="profile-bio">
                    About you
                  </label>
                  <textarea
                    id="profile-bio"
                    rows={4}
                    value={profile.bio}
                    onChange={(event) => updateProfile({ bio: event.target.value })}
                    className={`${fieldClass} resize-y`}
                  />
                  <p className="mt-1 text-label-sm text-label-sm text-outline">
                    This is the paragraph guests read before they enquire.
                  </p>
                </div>

                <div className="sm:col-span-2 flex flex-wrap items-center gap-2 border-t border-outline-variant/20 pt-4">
                  <button type="submit" className={solidButton}>
                    <Icon name="save" className="text-[18px]" />
                    Save details
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateProfile({ name: "Ananya Rai", role: "Estate Owner & Host" });
                      notify("Reverted the visible name fields.", { tone: "warning" });
                    }}
                    className={ghostButton}
                  >
                    <Icon name="undo" className="text-[18px]" />
                    Undo
                  </button>
                </div>
              </form>
            </Panel>

            <div className="flex flex-col gap-space-lg lg:col-span-5">
              <Panel title="Listing preview" icon="visibility" caption="How guests meet you">
                <div className="rounded-xl bg-primary p-5 text-on-primary">
                  <p className="text-label-sm text-label-sm uppercase opacity-80">
                    Hosted by
                  </p>
                  <p className="mt-1 text-headline-sm text-headline-sm font-semibold">
                    {profile.name}
                  </p>
                  <p className="text-body-sm text-body-sm opacity-85">{profile.role}</p>
                  <p className="mt-3 text-body-sm text-body-sm leading-relaxed opacity-90">
                    {profile.bio}
                  </p>
                </div>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {[
                    ["check-in", `Check in from ${profile.checkInTime}`],
                    ["check-out", `Check out by ${profile.checkOutTime}`],
                    ["bolt", profile.responseTime],
                    ["place", `${profile.address}, ${profile.town}, ${profile.region} ${profile.postal}`],
                  ].map(([icon, label]) => (
                    <li
                      key={label}
                      className="flex items-start gap-2 text-body-sm text-body-sm text-on-surface-variant"
                    >
                      <Icon name={icon} className="mt-0.5 flex-shrink-0 text-[16px] text-primary" />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="At a glance" icon="query_stats" caption="Your estate, right now">
                <dl className="flex flex-col gap-2.5">
                  {[
                    ["Rooms listed", String(rooms.length), "king_bed"],
                    ["Bookable now", String(rooms.filter((room) => room.status === "Active").length), "check_circle"],
                    ["On maintenance", String(rooms.filter((room) => room.status === "Maintenance").length), "handyman"],
                    ["Combined nightly rate", money(nightlyTotal), "sell"],
                    ["Locations", String(locations.length), "location_on"],
                  ].map(([label, value, icon]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 border-b border-outline-variant/20 pb-2.5 last:border-0 last:pb-0"
                    >
                      <dt className="flex items-center gap-2 text-body-sm text-body-sm text-on-surface-variant">
                        <Icon name={icon} className="text-[16px] text-outline" />
                        {label}
                      </dt>
                      <dd className="text-body-md text-body-md font-semibold text-primary">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </div>
          </div>
        ) : null}

        {tab === "rooms" ? (
          <Panel
            title="Your rooms"
            icon="king_bed"
            caption="Edit rates, capacity, status and details — or add another unit"
            action={
              <button onClick={() => setAddRoomOpen(true)} className={solidButton}>
                <Icon name="add_home" className="text-[18px]" />
                Add room
              </button>
            }
          >
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {rooms.map((room) => (
                <li
                  key={room.code}
                  className="flex flex-col rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-body-md text-body-md font-semibold text-on-surface">
                        {room.name}
                      </p>
                      <p className="truncate text-label-sm text-label-sm text-outline">
                        {room.code} · {room.location}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-label-sm text-label-sm font-semibold whitespace-nowrap ${
                        room.status === "Active"
                          ? "bg-primary-tint text-on-primary-container"
                          : "bg-hold-surface text-hold-ink"
                      }`}
                    >
                      {room.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {[
                      ["Nightly", money(room.nightly)],
                      ["Weekend", money(room.weekend ?? room.nightly)],
                      ["Sleeps", String(room.maxGuests)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span className="block text-label-sm text-label-sm uppercase text-outline">
                          {label}
                        </span>
                        <span className="text-body-md text-body-md font-semibold text-primary">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-label-sm text-label-sm text-outline">
                    {room.bedLabel} · {room.features.join(" · ")}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-outline-variant/20 pt-3">
                    <button
                      onClick={() => setEditingRoom(room)}
                      className="flex items-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container px-3 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
                    >
                      <Icon name="edit" className="text-[16px]" />
                      Edit details
                    </button>
                    <a
                      href="/book"
                      className="flex items-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container px-3 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
                    >
                      <Icon name="event_available" className="text-[16px]" />
                      See availability
                    </a>
                    <button
                      onClick={() => {
                        removeRoom(room.code);
                        notify(`${room.name} removed from the estate.`, { tone: "warning" });
                      }}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-label-md text-label-md text-outline transition-colors hover:bg-surface-container hover:text-error"
                    >
                      <Icon name="delete" className="text-[16px]" />
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {tab === "locations" ? (
          <Panel
            title="Your locations"
            icon="location_on"
            caption="The properties guests are told about"
            action={
              <button onClick={() => setAddingLocation(true)} className={solidButton}>
                <Icon name="add_location_alt" className="text-[18px]" />
                Add location
              </button>
            }
          >
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {locations.map((location) => (
                <li
                  key={location.id}
                  className="flex flex-col rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-secondary-tint text-secondary-ink">
                        <Icon name="location_on" className="text-[19px]" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-body-md text-body-md font-semibold text-on-surface">
                          {location.name}
                        </p>
                        <p className="line-clamp-2 text-label-sm text-label-sm text-outline sm:truncate">
                          {location.address}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-surface-container px-2.5 py-1 text-label-sm text-label-sm font-semibold whitespace-nowrap text-on-surface-variant">
                      {location.units} unit{location.units === 1 ? "" : "s"}
                    </span>
                  </div>

                  <p className="mt-3 text-label-md text-label-md text-on-surface-variant">
                    {location.note}
                  </p>

                  {location.lat !== null && location.lng !== null ? (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=17/${location.lat}/${location.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 flex min-h-[2.25rem] items-center gap-1.5 text-label-sm text-label-sm text-primary transition-colors hover:underline"
                    >
                      <Icon name="my_location" className="text-[15px]" />
                      {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </a>
                  ) : (
                    <span className="mt-3 flex items-center gap-1.5 text-label-sm text-label-sm text-outline">
                      <Icon name="location_off" className="text-[15px]" />
                      No pin set — edit to drop one
                    </span>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-outline-variant/20 pt-3">
                    <button
                      onClick={() => setEditingLocation(location)}
                      className="flex items-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container px-3 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
                    >
                      <Icon name="edit" className="text-[16px]" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        removeLocation(location.id);
                        notify(`${location.name} removed.`, { tone: "warning" });
                      }}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-label-md text-label-md text-outline transition-colors hover:bg-surface-container hover:text-error"
                    >
                      <Icon name="delete" className="text-[16px]" />
                      Remove
                    </button>
                    <span className="ms-auto text-label-sm text-label-sm text-outline">
                      {location.kind}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>

      <RoomFormDialog
        open={addRoomOpen || editingRoom !== null}
        onClose={() => {
          setAddRoomOpen(false);
          setEditingRoom(null);
        }}
        room={editingRoom ?? undefined}
      />

      <LocationDialog
        key={editingLocation?.id ?? "new"}
        open={addingLocation || editingLocation !== null}
        location={editingLocation}
        onClose={() => {
          setAddingLocation(false);
          setEditingLocation(null);
        }}
        onSave={(draft) => {
          if (editingLocation) {
            updateLocation(editingLocation.id, draft);
            notify(`${draft.name} updated.`, { icon: "check_circle", tone: "success" });
          } else {
            addLocation(draft);
            notify(`${draft.name} added.`, { icon: "add_location_alt", tone: "success" });
          }
          setAddingLocation(false);
          setEditingLocation(null);
        }}
      />

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        size="sm"
        icon="restart_alt"
        title="Reset demo data?"
        description="Rooms, drivers, bookings, profile and locations go back to their starting values."
        footer={
          <>
            <button
              onClick={() => setConfirmReset(false)}
              className="rounded-lg border border-outline-variant/40 px-4 py-2 text-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
            >
              Keep my changes
            </button>
            <button
              onClick={() => {
                reset();
                setConfirmReset(false);
                notify("Everything is back to the starting state.", {
                  icon: "restart_alt",
                  tone: "success",
                });
              }}
              className="rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
            >
              Reset
            </button>
          </>
        }
      >
        <p className="text-body-md text-body-md text-on-surface-variant">
          Bookings and drivers you added in this browser will be discarded.
        </p>
      </Modal>
    </PageShell>
  );
}

type LocationDraft = Omit<EstateLocation, "id">;

/** Mounted with a `key` per location, so the form always starts fresh. */
function LocationDialog({
  open,
  location,
  onClose,
  onSave,
}: {
  open: boolean;
  location: EstateLocation | null;
  onClose: () => void;
  onSave: (draft: LocationDraft) => void;
}) {
  const [draft, setDraft] = useState<LocationDraft>({
    name: location?.name ?? "",
    address: location?.address ?? "",
    kind: location?.kind ?? locationKinds[0],
    units: location?.units ?? 1,
    note: location?.note ?? "",
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
  });

  const set = <K extends keyof LocationDraft>(key: K, value: LocationDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="location_on"
      title={location ? `Edit ${location.name}` : "Add a location"}
      description="A property or building your rooms are spread across."
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
              if (draft.name.trim().length < 2) return;
              onSave({ ...draft, name: draft.name.trim() });
            }}
            className="rounded-lg bg-primary px-4 py-2 text-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
          >
            {location ? "Save changes" : "Add location"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="location-name">
            Name
          </label>
          <input
            id="location-name"
            data-autofocus
            value={draft.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="e.g. North Field Lodge"
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="location-kind">
            Kind
          </label>
          <select
            id="location-kind"
            value={draft.kind}
            onChange={(event) => set("kind", event.target.value)}
            className={fieldClass}
          >
            {locationKinds.map((kind) => (
              <option key={kind}>{kind}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="location-address">
            Address
          </label>
          <input
            id="location-address"
            value={draft.address}
            onChange={(event) => set("address", event.target.value)}
            placeholder="12 Ging Tea Estate Road, Darjeeling"
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="location-units">
            Units here
          </label>
          <input
            id="location-units"
            type="number"
            min={0}
            max={30}
            value={draft.units}
            onChange={(event) => set("units", Math.max(0, Number(event.target.value) || 0))}
            className={fieldClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="location-note">
            Note
          </label>
          <textarea
            id="location-note"
            rows={3}
            value={draft.note}
            onChange={(event) => set("note", event.target.value)}
            placeholder="What guests find when they arrive…"
            className={`${fieldClass} resize-y`}
          />
        </div>
        <div className="sm:col-span-2">
          <p className={labelClass}>Pin on the map</p>
          <LocationPicker
            value={draft.lat === null || draft.lng === null ? null : { lat: draft.lat, lng: draft.lng }}
            label={draft.address.trim() || draft.name.trim() || undefined}
            onChange={(next) =>
              setDraft((current) => ({ ...current, lat: next?.lat ?? null, lng: next?.lng ?? null }))
            }
          />
        </div>
      </div>
    </Modal>
  );
}
