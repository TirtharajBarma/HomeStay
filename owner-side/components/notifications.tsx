"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { Popover } from "@/components/ui/popover";

type Notice = {
  id: string;
  icon: string;
  tone: string;
  title: string;
  body: string;
  time: string;
};

const initialNotices: Notice[] = [
  {
    id: "n1",
    icon: "cleaning_services",
    tone: "bg-primary-tint text-primary",
    title: "Turnover due in 40 minutes",
    body: "Ging Lodge · Silver Oak Suite",
    time: "8 min ago",
  },
  {
    id: "n2",
    icon: "mail",
    tone: "bg-secondary-tint text-secondary-ink",
    title: "New direct inquiry",
    body: "Rohan Bhattacharya asked about the Chiyabari Panorama Loft.",
    time: "26 min ago",
  },
  {
    id: "n3",
    icon: "sync",
    tone: "bg-tertiary-container text-tertiary-fixed",
    title: "Booking.com channel synced",
    body: "14 reservations updated with no conflicts.",
    time: "1 hr ago",
  },
];

type NotificationsProps = {
  /** Forces the unread dot on (used by pages that pass `notifyDot`). */
  forceDot?: boolean;
  className?: string;
  iconClassName?: string;
  dotClassName?: string;
  label?: string;
};

export function NotificationsBell({
  forceDot = false,
  className = "rounded-lg p-2 transition-colors hover:bg-surface-container",
  iconClassName = "text-[20px]",
  dotClassName = "absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-secondary",
  label = "Notifications",
}: NotificationsProps) {
  const [unread, setUnread] = useState(initialNotices.length);

  return (
    <Popover
      label="Notifications"
      panelClassName="w-[min(20rem,calc(100vw-2rem))]"
      trigger={({ toggle, open, ...aria }) => (
        <button
          {...aria}
          onClick={toggle}
          aria-label={`${label}${unread ? `, ${unread} unread` : ""}`}
          className={`relative ${className} ${
            open ? "bg-surface-container text-on-surface" : "text-on-surface-variant"
          }`}
        >
          <Icon name="notifications" className={iconClassName} />
          {unread > 0 || forceDot ? <span className={dotClassName} /> : null}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-outline-variant/30 px-4 py-3">
            <h3 className="text-body-md text-body-md font-semibold text-primary">
              Notifications
            </h3>
            <button
              onClick={() => setUnread(0)}
              className="rounded-md px-2 py-1 text-label-sm text-label-sm font-medium text-primary transition-colors hover:bg-primary-tint disabled:opacity-50"
              disabled={unread === 0}
            >
              Mark all read
            </button>
          </div>
          <ul className="custom-scrollbar max-h-72 overflow-y-auto">
            {initialNotices.map((notice) => (
              <li key={notice.id}>
                <button
                  onClick={() => {
                    setUnread((value) => Math.max(0, value - 1));
                    close();
                  }}
                  className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container"
                >
                  <span
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${notice.tone}`}
                  >
                    <Icon name={notice.icon} className="text-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-md text-body-md font-medium text-on-surface">
                      {notice.title}
                    </span>
                    <span className="block text-label-sm text-label-sm text-on-surface-variant">
                      {notice.body}
                    </span>
                    <span className="block text-label-sm text-label-sm text-outline">
                      {notice.time}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={close}
            className="w-full border-t border-outline-variant/30 py-2.5 text-label-md text-label-md font-medium text-primary transition-colors hover:bg-surface-container"
          >
            View activity log
          </button>
        </div>
      )}
    </Popover>
  );
}
