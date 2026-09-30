type Tone = "occupied" | "turnover" | "vacant";

type Cell = { label: string; tone: Tone };

const toneClass: Record<Tone, string> = {
  occupied: "bg-primary text-on-primary font-medium",
  turnover: "bg-secondary-tint text-secondary-ink font-semibold",
  vacant: "bg-surface-container text-outline",
};

const days: { label: string; today?: boolean }[] = [
  { label: "Thu 24", today: true },
  { label: "Fri 25" },
  { label: "Sat 26" },
  { label: "Sun 27" },
  { label: "Mon 28" },
  { label: "Tue 29" },
  { label: "Wed 30" },
];

const rooms: { name: string; cells: Cell[] }[] = [
  {
    name: "Oak Suite",
    cells: [
      { label: "Stay", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
      { label: "Open", tone: "vacant" },
      { label: "Open", tone: "vacant" },
      { label: "Stay", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
    ],
  },
  {
    name: "Pine Cottage",
    cells: [
      { label: "Clean", tone: "turnover" },
      { label: "Stay", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
      { label: "Open", tone: "vacant" },
      { label: "Open", tone: "vacant" },
      { label: "Open", tone: "vacant" },
    ],
  },
  {
    name: "Garden Stone Suite",
    cells: [
      { label: "In 3:30", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
      { label: "Out", tone: "turnover" },
      { label: "Open", tone: "vacant" },
      { label: "Open", tone: "vacant" },
      { label: "Stay", tone: "occupied" },
    ],
  },
  {
    name: "The Loft Barn",
    cells: [
      { label: "In 6:00", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
      { label: "Out", tone: "turnover" },
      { label: "Open", tone: "vacant" },
      { label: "Open", tone: "vacant" },
    ],
  },
  {
    name: "Orchard View",
    cells: [
      { label: "Stay", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
      { label: "Open", tone: "vacant" },
      { label: "Open", tone: "vacant" },
      { label: "Stay", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
    ],
  },
  {
    name: "Willow Studio",
    cells: [
      { label: "Open", tone: "vacant" },
      { label: "Stay", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
      { label: "Stay", tone: "occupied" },
      { label: "Open", tone: "vacant" },
      { label: "Open", tone: "vacant" },
    ],
  },
];

const legend: { label: string; tone: Tone }[] = [
  { label: "Occupied", tone: "occupied" },
  { label: "Turnover", tone: "turnover" },
  { label: "Vacant", tone: "vacant" },
];

export function AvailabilityGlance() {
  return (
    <section className="clay-card rounded-xl p-5">
      <div className="mb-3.5 flex flex-col justify-between gap-3 border-b border-outline-variant/20 pb-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-headline-sm text-lg font-semibold text-primary">
            Mini 7-Day Availability Glance
          </h3>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Occupancy cadence through next Wednesday
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {legend.map((entry) => (
            <span
              key={entry.label}
              className="flex items-center gap-1.5 font-medium text-on-surface"
            >
              <span className={`h-2.5 w-2.5 rounded ${toneClass[entry.tone]}`} />
              {entry.label}
            </span>
          ))}
        </div>
      </div>

      <div className="custom-scrollbar -mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[480px] border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/30 text-xs text-on-surface-variant">
              <th className="w-36 px-2 py-2.5 font-semibold">Room</th>
              {days.map((day) => (
                <th
                  key={day.label}
                  className={`px-2 py-2.5 text-center font-medium ${day.today ? "font-bold text-primary" : ""}`}
                >
                  {day.label}
                  {day.today ? (
                    <>
                      <br />
                      <span className="text-[10px] font-normal text-outline">
                        Today
                      </span>
                    </>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15 text-xs">
            {rooms.map((room) => (
              <tr key={room.name}>
                <td className="px-2 py-2.5 font-medium text-on-surface">
                  {room.name}
                </td>
                {room.cells.map((cell, index) => (
                  <td key={`${room.name}-${days[index].label}`} className="px-1 py-2.5 text-center">
                    <div
                      className={`mx-auto flex h-7 items-center justify-center rounded-md text-[10px] ${toneClass[cell.tone]}`}
                    >
                      {cell.label}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
