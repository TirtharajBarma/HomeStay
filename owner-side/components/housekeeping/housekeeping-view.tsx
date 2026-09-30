"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";

const tasks = [
  {
    id: "oak",
    unit: "Oak Hearth Suite",
    code: "Room 101",
    due: "Today · 11:00 AM",
    status: "Ready for arrival",
    tone: "bg-primary/10 text-primary",
    icon: "done_all",
    items: ["Strip & remake king bed", "Refresh fireplace log basket", "Restock ensuite towels"],
  },
  {
    id: "maple",
    unit: "Maple Corner Studio",
    code: "Room 102",
    due: "Today · 1:30 PM",
    status: "Turnover in progress",
    tone: "bg-secondary/15 text-secondary",
    icon: "progress_activity",
    items: ["Vacuum and dust surfaces", "Restock coffee supplies", "Reset thermostat to 68°F"],
  },
  {
    id: "barn",
    unit: "Loft Barn",
    code: "Room 201",
    due: "Today · 4:00 PM",
    status: "Awaiting linen delivery",
    tone: "bg-surface-container text-outline",
    icon: "local_shipping",
    items: ["Change both queen sets", "Wipe kitchen counters", "Check stair lighting"],
  },
  {
    id: "willow",
    unit: "Willow Brook Cabin",
    code: "Cabin 1",
    due: "Tomorrow · 10:00 AM",
    status: "Maintenance hold",
    tone: "bg-surface-container text-outline",
    icon: "handyman",
    items: ["Wait on chimney service", "Deep clean after repair", "Restock firewood rack"],
  },
];

export function HousekeepingView() {
  const [done, setDone] = useState<Record<string, string[]>>({});
  const { notify } = useToast();

  const toggle = (taskId: string, item: string, unit: string) => {
    const added = !(done[taskId] ?? []).includes(item);
    setDone((current) => ({
      ...current,
      [taskId]: added
        ? [...(current[taskId] ?? []), item]
        : (current[taskId] ?? []).filter((entry) => entry !== item),
    }));
    notify(`${added ? "Completed" : "Reopened"}: ${item} — ${unit}.`, {
      icon: added ? "task_alt" : "undo",
      tone: added ? "success" : "default",
    });
  };

  return (
    <main className="mt-14 min-h-screen lg:mt-16 lg:ml-[var(--rail-w)]">
      <div className="mx-auto max-w-[1360px] p-4 pb-space-xl md:p-space-lg">
        <div className="mb-6 flex flex-col gap-1.5 border-b border-outline-variant/30 pb-6">
          <nav className="flex items-center gap-2 text-label-sm text-label-sm text-outline">
            <span>Homestay Operations</span>
            <Icon name="chevron_right" className="text-[14px]" />
            <span className="font-medium text-primary">Turnover &amp; Readiness</span>
          </nav>
          <h1 className="text-headline-lg-mobile text-headline-lg-mobile font-semibold tracking-tight text-primary md:text-headline-lg">
            Housekeeping
          </h1>
          <p className="max-w-2xl text-body-md text-body-md text-on-surface-variant">
            Turnover checklists, room readiness, and linen logistics for every unit.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
          {tasks.map((task) => {
            const completed = done[task.id] ?? [];
            return (
              <section
                key={task.id}
                className="clay-card rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-title-md text-title-md font-semibold text-on-surface">
                      {task.unit}
                    </h2>
                    <p className="text-label-sm text-label-sm text-outline">{task.code}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-label-sm text-label-sm ${task.tone}`}>
                    {completed.length}/{task.items.length}
                  </span>
                </div>

                <p className="mt-2 flex items-center gap-1.5 text-label-sm text-label-sm text-on-surface-variant">
                  <Icon name={task.icon} className="text-[15px] text-outline" />
                  {task.status}
                </p>
                <p className="mt-1 text-label-sm text-label-sm text-outline">{task.due}</p>

                <ul className="mt-4 space-y-1.5 border-t border-outline-variant/25 pt-3">
                  {task.items.map((item) => {
                    const checked = completed.includes(item);
                    return (
                      <li key={item}>
                        <button
                          onClick={() => toggle(task.id, item, task.unit)}
                          aria-pressed={checked}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-body-sm text-body-sm transition-colors hover:bg-surface-container"
                        >
                          <span
                            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                              checked
                                ? "border-primary bg-primary text-on-primary"
                                : "border-outline-variant/60 bg-surface-container-lowest"
                            }`}
                          >
                            {checked ? <Icon name="check" className="text-[12px]" /> : null}
                          </span>
                          <span
                            className={
                              checked
                                ? "text-outline line-through"
                                : "text-on-surface-variant"
                            }
                          >
                            {item}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
