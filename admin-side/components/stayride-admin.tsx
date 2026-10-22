"use client";

// StayRide platform admin desks. Every value shown comes from the server; missing money is "—",
// never a made-up default. Every server error is surfaced (adminApi throws its message).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { adminApi } from "@/lib/api-config";

type Any = Record<string, any>;
type TabProps = { demo: boolean };

export const FEATURE_KEYS = ["campaigns", "guestCabLinks", "platformDispatch", "payouts", "driverQuotes"] as const;
// Driver quotes is a drivers' feature: one global switch, no per-homestay override
const HOMESTAY_FEATURE_KEYS = FEATURE_KEYS.filter((k) => k !== "driverQuotes");
const FEATURE_LABELS: Record<string, string> = {
  campaigns: "Campaigns",
  guestCabLinks: "Guest cab links",
  platformDispatch: "Platform dispatch",
  payouts: "Payouts",
  driverQuotes: "Driver quotes",
};
const OPEN_STATUSES = ["PENDING_REVIEW", "FINDING_DRIVER", "QUOTE_RECEIVED"];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
export const inr = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : "—");
const dt = (v: unknown) => (v ? new Date(String(v)).toLocaleString("en-IN") : "—");
/** Id of a server record: new API objects use `id`, older ones `_id`. */
const rid = (r: Any | null | undefined) => String(r?.id ?? r?._id ?? "");

// Auto-refresh is paused while any form/dialog holds an edit lock or an input has focus.
let editLocks = 0;
function useEditLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    editLocks++;
    return () => {
      editLocks--;
    };
  }, [active]);
}
function isEditing() {
  if (editLocks > 0) return true;
  const el = typeof document !== "undefined" ? document.activeElement : null;
  return !!el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

const AUTO_REFRESH_MS = 30_000;

/** Load data; with `auto`, silently refetch every 30s while the tab is visible and nothing is being edited. */
function useLoad<T>(fn: () => Promise<T>, deps: unknown[], auto = false) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async (silent: boolean) => {
    const mine = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const d = await fn();
      if (mine !== seq.current) return;
      setData(d);
      setError("");
      setUpdatedAt(Date.now());
    } catch (e: any) {
      if (mine !== seq.current) return;
      if (!silent) setData(null);
      setError(e?.message || "Request failed.");
    } finally {
      if (mine === seq.current && !silent) setLoading(false);
    }
  }, deps);
  useEffect(() => {
    run(false);
  }, [run]);
  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && !isEditing()) run(true);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [auto, run]);
  const reload = useCallback(() => {
    run(false);
  }, [run]);
  return { data, error, loading, reload, updatedAt };
}

// Paginated admin lists: `?page=1&limit=50` -> { items, total, page, limit }.
const LIMIT = 50;
type PageData = { items: Any[]; total: number | null };
const pq = (page: number) => ({ page: page + 1, limit: LIMIT });
/** Accepts `{items,total}` at the top level or under `data`, and older bare-array / `{data:[]}` replies. */
function toPage(r: any): PageData {
  const body = r && typeof r === "object" && !Array.isArray(r) && r.data && !Array.isArray(r.data) ? r.data : r;
  const items = Array.isArray(body)
    ? body
    : Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.users)
        ? body.users
        : Array.isArray(r?.data)
          ? r.data
          : [];
  const total = typeof body?.total === "number" ? body.total : typeof r?.total === "number" ? r.total : null;
  return { items, total };
}

/** Run an admin action, show the server's message (success or error), then refresh. */
async function act(fn: () => Promise<any>, after: () => void) {
  try {
    const r = await fn();
    alert(r?.message || "Done.");
    after();
  } catch (e: any) {
    alert(e?.message || "Action failed.");
  }
}

/** Prompt for a required value; null when cancelled or left empty. */
function ask(label: string): string | null {
  const v = window.prompt(label);
  if (v === null) return null;
  if (!v.trim()) {
    alert("This field is required.");
    return null;
  }
  return v.trim();
}

const btn = {
  primary: "rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-500 disabled:opacity-50",
  ok: "rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50",
  danger: "rounded-lg border border-red-500/40 bg-red-950/40 px-2.5 py-1 text-[11px] font-bold text-red-400 hover:bg-red-900/60 disabled:opacity-50",
  ghost: "rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50",
};
const input = "rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none";
const chip = (on: boolean) =>
  `rounded-full border px-3 py-1 text-[11px] font-bold ${on ? "border-blue-500 bg-blue-950 text-blue-300" : "border-slate-700 text-slate-400 hover:text-slate-200"}`;

function Ago({ t }: { t: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!t) return null;
  return <span className="text-[10px] text-slate-500">updated {Math.max(0, Math.round((Date.now() - t) / 1000))}s ago</span>;
}

function Panel({ title, subtitle, onRefresh, error, loading, children, right, updatedAt }: {
  title: ReactNode; subtitle?: string; onRefresh?: () => void; error?: string; loading?: boolean; children: ReactNode; right?: ReactNode; updatedAt?: number | null;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {right}
          {updatedAt !== undefined && <Ago t={updatedAt} />}
          {onRefresh && (
            <button onClick={onRefresh} className={btn.ghost} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-800/40 bg-red-950/40 px-4 py-3 text-xs font-semibold text-red-300">
          <span>{error}</span>
          {onRefresh && (
            <button onClick={onRefresh} disabled={loading} className="shrink-0 rounded-lg border border-red-500/40 px-2.5 py-1 text-[11px] font-bold text-red-300 hover:bg-red-900/60 disabled:opacity-50">
              {loading ? "Retrying..." : "Retry"}
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue" }) {
  const tones = {
    slate: "bg-slate-800 text-slate-300 border-slate-700",
    green: "bg-emerald-950 text-emerald-400 border-emerald-800/40",
    amber: "bg-amber-950 text-amber-400 border-amber-800/40",
    red: "bg-red-950 text-red-400 border-red-800/40",
    blue: "bg-blue-950 text-blue-300 border-blue-800/40",
  };
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${tones[tone]}`}>{children}</span>;
}

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <p className="mt-1 font-mono text-xl font-black text-white">{value}</p>
      {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
    </div>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="p-6 text-center text-xs text-slate-500">{children}</p>;

/** Modal confirm dialog with optional reason; shows the server's error (e.g. 409) inline. */
function Dialog({ title, message, confirmLabel, danger, reasonLabel, reasonRequired, children, onConfirm, onClose }: {
  title: string; message: ReactNode; confirmLabel: string; danger?: boolean; reasonLabel?: string; reasonRequired?: boolean; children?: ReactNode;
  onConfirm: (reason: string) => Promise<any>; onClose: (changed: boolean) => void;
}) {
  useEditLock(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reasonRequired && !reason.trim()) return setErr("A reason is required.");
    setBusy(true);
    setErr("");
    try {
      const r = await onConfirm(reason.trim());
      alert(r?.message || "Done.");
      onClose(true);
    } catch (e: any) {
      setErr(e?.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-2xl border border-slate-800 bg-slate-950 p-6 text-xs shadow-2xl">
        <h3 className="text-base font-bold text-white">{title}</h3>
        <div className="text-slate-300">{message}</div>
        {children}
        {reasonLabel && (
          <label className="block text-slate-300">
            {reasonLabel}{reasonRequired ? " *" : ""}
            <textarea className={`${input} mt-1 w-full`} rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        )}
        {err && <p className="rounded-xl border border-red-800/40 bg-red-950/40 px-3 py-2 font-semibold text-red-300">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.ghost} onClick={() => onClose(false)} disabled={busy}>Cancel</button>
          <button className={danger ? btn.danger : btn.primary} disabled={busy}>{busy ? "Working..." : confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}

// Global commission rates for the dashboard hints. Fetched per mount (no module cache), so they
// reflect the latest saved settings of the selected dataset.
function useCommissionRates(demo: boolean) {
  const { data } = useLoad(
    () =>
      adminApi("/commission/settings", { demo })
        .then((r) => {
          const pf = Number(r?.data?.globalPlatformFeePercent);
          const hc = Number(r?.data?.globalHomestayCommissionPercent);
          return Number.isFinite(pf) && Number.isFinite(hc) && pf + hc <= 100 ? { pf, hc } : null;
        })
        .catch(() => null),
    [demo]
  );
  return data;
}

const roundPct = (n: number) => Math.round(n * 10) / 10;
/** " (x%)" from an explicit percent, else derived from amount / fare of the same request; "" when unknown. */
function pct(explicit: unknown, amount: unknown, fare: unknown) {
  const p =
    typeof explicit === "number" && Number.isFinite(explicit)
      ? explicit
      : typeof amount === "number" && typeof fare === "number" && fare > 0
        ? (amount / fare) * 100
        : null;
  return p === null ? "" : ` (${roundPct(p)}%)`;
}

function Pager({ page, setPage, total, count }: { page: number; setPage: (p: number) => void; total: number | null; count: number }) {
  const pages = total !== null ? Math.max(1, Math.ceil(total / LIMIT)) : null;
  const hasNext = pages !== null ? page + 1 < pages : count >= LIMIT;
  return (
    <div className="flex items-center justify-end gap-2 text-xs text-slate-400">
      <button className={btn.ghost} disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
      <span>
        Page {page + 1}
        {pages !== null && ` of ${pages}`}
        {total !== null && ` • ${total} total`}
      </span>
      <button className={btn.ghost} disabled={!hasNext} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Dashboard
// ---------------------------------------------------------------------------
export function DashboardTab({ demo }: TabProps) {
  const { data, error, loading, reload, updatedAt } = useLoad(() => adminApi("/stayride/summary", { demo }).then((r) => r.data as Any), [demo], true);
  const rates = useCommissionRates(demo);
  const cab: Any = data?.cab || {};
  const payouts: Any[] = Array.isArray(data?.payouts) ? data!.payouts : [];
  const rateHint = (p: number | undefined) => `Completed + advance paid${typeof p === "number" ? ` • current global rate ${roundPct(p)}%` : ""}`;
  return (
    <Panel title="StayRide money dashboard" subtitle="Live totals from cab requests and homestay payouts." onRefresh={reload} error={error} loading={loading} updatedAt={updatedAt}>
      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Kpi label="Open requests" value={cab.open ?? "—"} />
            <Kpi label="Awaiting payment" value={cab.awaitingPayment ?? "—"} />
            <Kpi label="Completed trips" value={cab.completed ?? "—"} />
            <Kpi label="GMV (completed)" value={inr(cab.gmv)} />
            <Kpi label="Advance collected" value={inr(cab.advanceCollected)} />
            <Kpi label="Platform fee earned" value={inr(cab.platformFee)} hint={rateHint(rates?.pf)} />
            <Kpi label="Homestay commission (owed to homestays)" value={inr(cab.homestayCommission)} hint={rateHint(rates?.hc)} />
            <Kpi label="Refunds pending" value={inr(cab.refundsPending)} />
            <Kpi label="Driver share dues pending" value={inr(cab.driverDuesPending)} />
            {typeof cab.unmatchedPending === "number" && cab.unmatchedPending > 0 && (
              <Kpi label="Unmatched money to refund" value={inr(cab.unmatchedPending)} hint={`${cab.unmatchedCount ?? 0} payment(s)`} />
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Homestay payouts by status</h3>
            {payouts.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {payouts.map((p) => (
                  <Kpi key={String(p._id)} label={String(p._id)} value={inr(p.amount)} hint={`${p.count} payout(s)`} />
                ))}
              </div>
            ) : (
              <Empty>No payout requests yet.</Empty>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 2. Users
// ---------------------------------------------------------------------------
const ROLES = ["owner", "driver", "admin", "guest"];
const statusBadge = (s: string) => <Badge tone={s === "ACTIVE" ? "green" : s === "BLOCKED" ? "red" : "amber"}>{s || "—"}</Badge>;
const ratingText = (r: Any) => (typeof r.rating === "number" ? `★ ${r.rating} (${r.ratingCount ?? 0})` : "No ratings");

type UserAction = "block" | "unblock" | "approve" | "pending" | "role" | "revoke" | "delete";

export function UsersTab({ demo }: TabProps) {
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState<{ u: Any; kind: UserAction } | null>(null);
  const { data, error, loading, reload, updatedAt } = useLoad(
    () => adminApi("/stayride/users", { demo, query: { role, status, q, search: q, ...pq(page) } }).then(toPage),
    [demo, role, status, q, page],
    true
  );
  const items = data?.items || [];

  return (
    <Panel
      title="Users"
      subtitle="Every owner, driver and admin account. Block, approve, change role, sign out everywhere or delete."
      onRefresh={reload}
      error={error}
      loading={loading}
      updatedAt={updatedAt}
      right={
        <>
          <select className={input} value={role} onChange={(e) => { setRole(e.target.value); setPage(0); }}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className={input} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING_APPROVAL">Pending approval</option>
            <option value="BLOCKED">Blocked</option>
          </select>
          <form onSubmit={(e) => { e.preventDefault(); setPage(0); setQ(search.trim()); }} className="flex gap-2">
            <input className={input} placeholder="Name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className={btn.primary}>Search</button>
          </form>
        </>
      }
    >
      {data &&
        (items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Rating / vehicle</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((u) => (
                  <tr key={rid(u)} className="align-top hover:bg-slate-900/40">
                    <td className="p-3">
                      <p className="font-semibold text-white">
                        {u.name || "—"} {u.isDemo && <Badge tone="amber">demo</Badge>} {u.deletedAt && <Badge tone="red">deleted</Badge>}
                      </p>
                      <p className="text-slate-500">{u.email || "—"} • {u.phone || "—"}</p>
                      {u.tenantKey && <p className="font-mono text-[10px] text-slate-500">{u.tenantKey}</p>}
                    </td>
                    <td className="p-3"><Badge tone={u.role === "admin" ? "blue" : "slate"}>{u.role}</Badge></td>
                    <td className="p-3">
                      {statusBadge(u.accountStatus)}
                      {u.statusReason && <p className="mt-1 text-[10px] text-slate-500">{u.statusReason}</p>}
                    </td>
                    <td className="p-3 text-slate-300">
                      {u.role === "driver" ? ratingText(u) : "—"}
                      {u.vehicle && <p className="text-[10px] text-slate-500">{u.vehicle.model || u.vehicle.type || ""} • {u.vehicle.plate || "—"}</p>}
                    </td>
                    <td className="p-3 text-slate-400">{dt(u.createdAt)}</td>
                    <td className="p-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {u.accountStatus === "PENDING_APPROVAL" && !u.deletedAt && <button className={btn.ok} onClick={() => setDialog({ u, kind: "approve" })}>Approve</button>}
                        {u.accountStatus === "BLOCKED" && !u.deletedAt && <button className={btn.ok} onClick={() => setDialog({ u, kind: "unblock" })}>Unblock</button>}
                        {u.accountStatus !== "BLOCKED" && <button className={btn.danger} onClick={() => setDialog({ u, kind: "block" })}>Block</button>}
                        {u.accountStatus === "ACTIVE" && u.role === "driver" && <button className={btn.ghost} onClick={() => setDialog({ u, kind: "pending" })}>Set pending</button>}
                        {!u.deletedAt && <button className={btn.ghost} onClick={() => setDialog({ u, kind: "role" })}>Role</button>}
                        <button className={btn.ghost} onClick={() => setDialog({ u, kind: "revoke" })}>Revoke sessions</button>
                        {!u.deletedAt && <button className={btn.danger} onClick={() => setDialog({ u, kind: "delete" })}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No users for this filter.</Empty>
        ))}
      <Pager page={page} setPage={setPage} total={data?.total ?? null} count={items.length} />
      {dialog && <UserDialog {...dialog} demo={demo} onClose={(changed) => { setDialog(null); if (changed) reload(); }} />}
    </Panel>
  );
}

function UserDialog({ u, kind, demo, onClose }: { u: Any; kind: UserAction; demo: boolean; onClose: (changed: boolean) => void }) {
  const [role, setRole] = useState<string>(u.role || "owner");
  const base = `/stayride/users/${encodeURIComponent(rid(u))}`;
  const who = `${u.name || u.email || "this user"} (${u.role})`;
  const setStatus = (status: string) => (reason: string) => adminApi(`${base}/status`, { method: "PATCH", body: { status, reason }, demo });
  const cfg: Record<UserAction, { title: string; message: string; label: string; danger?: boolean; reason: "required" | "optional"; run: (reason: string) => Promise<any> }> = {
    block: { title: "Block user", message: `Block ${who}? They are signed out and cannot use the app until unblocked. A blocked driver's upcoming platform trips are released.`, label: "Block", danger: true, reason: "required", run: setStatus("BLOCKED") },
    unblock: { title: "Unblock user", message: `Unblock ${who}? Their account becomes ACTIVE.`, label: "Unblock", reason: "required", run: setStatus("ACTIVE") },
    approve: { title: "Approve user", message: `Approve ${who}? Their account becomes ACTIVE.`, label: "Approve", reason: "required", run: setStatus("ACTIVE") },
    pending: { title: "Set pending", message: `Set ${who} back to PENDING_APPROVAL?`, label: "Set pending", reason: "required", run: setStatus("PENDING_APPROVAL") },
    role: { title: "Change role", message: `Change the role of ${who}.`, label: "Change role", reason: "optional", run: (reason) => adminApi(`${base}/role`, { method: "PATCH", body: { role, reason }, demo }) },
    revoke: { title: "Revoke sessions", message: `Sign ${who} out on every device? They must log in again.`, label: "Revoke sessions", danger: true, reason: "optional", run: (reason) => adminApi(`${base}/revoke-sessions`, { method: "POST", body: { reason }, demo }) },
    delete: { title: "Delete user", message: `Soft-delete ${who}? The account is blocked and signed out; money history is kept.`, label: "Delete", danger: true, reason: "required", run: (reason) => adminApi(base, { method: "DELETE", body: { reason }, demo }) },
  };
  const c = cfg[kind];
  return (
    <Dialog title={c.title} message={c.message} confirmLabel={c.label} danger={c.danger} reasonLabel="Reason" reasonRequired={c.reason === "required"} onConfirm={c.run} onClose={onClose}>
      {kind === "role" && (
        <select className={`${input} w-full`} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 3. Homestays
// ---------------------------------------------------------------------------
type HomestaysProps = TabProps & { onOpenCabRequests?: (tenantKey: string) => void };

export function HomestaysTab({ demo, onOpenCabRequests }: HomestaysProps) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [viewing, setViewing] = useState<Any | null>(null);
  const { data, error, loading, reload, updatedAt } = useLoad(
    () => adminApi("/stayride/tenants", { demo, query: { q: query, search: query, ...pq(page) } }).then(toPage),
    [demo, query, page],
    true
  );
  const items = data?.items || [];
  return (
    <Panel
      title="Homestays"
      subtitle="Block access, override features per homestay, set commission overrides and open a homestay's data."
      onRefresh={reload}
      error={error}
      loading={loading}
      updatedAt={updatedAt}
      right={
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setQuery(search.trim()); }} className="flex gap-2">
          <input className={input} placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className={btn.primary}>Search</button>
        </form>
      }
    >
      {data && (items.length ? items.map((t) => <HomestayRow key={t.tenantKey} t={t} demo={demo} onChanged={reload} onOpen={() => setViewing(t)} />) : <Empty>No homestays found.</Empty>)}
      <Pager page={page} setPage={setPage} total={data?.total ?? null} count={items.length} />
      {viewing && (
        <TenantDataViewer
          t={viewing}
          demo={demo}
          onClose={() => { setViewing(null); reload(); }}
          onOpenCabRequests={onOpenCabRequests ? (k) => { setViewing(null); onOpenCabRequests(k); } : undefined}
        />
      )}
    </Panel>
  );
}

function HomestayRow({ t, demo, onChanged, onOpen }: { t: Any; demo: boolean; onChanged: () => void; onOpen: () => void }) {
  const o = t.commissionOverride;
  const [pf, setPf] = useState("");
  const [hc, setHc] = useState("");
  const [adv, setAdv] = useState("");
  const [busy, setBusy] = useState(false);
  // Re-sync the inputs whenever the saved override changes (after save / clear / refresh).
  const oPf = o?.pfPercent, oHc = o?.hcPercent, oAdv = o?.advancePercent, hasO = !!o;
  useEffect(() => {
    setPf(hasO && oPf != null ? String(oPf) : "");
    setHc(hasO && oHc != null ? String(oHc) : "");
    setAdv(hasO && oAdv != null ? String(oAdv) : "");
  }, [hasO, oPf, oHc, oAdv]);

  async function save(body: Any, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    await act(() => adminApi(`/stayride/tenants/${encodeURIComponent(t.tenantKey)}/controls`, { method: "PUT", body, demo }), onChanged);
    setBusy(false);
  }

  function toggleBlock() {
    if (t.blocked) return save({ blocked: false }, `Unblock ${t.homestayName}?`);
    const reason = ask(`Reason for blocking ${t.homestayName}:`);
    if (reason) save({ blocked: true, blockReason: reason });
  }

  function saveOverride() {
    if (pf === "" || hc === "" || adv === "") return alert("Platform fee, homestay commission and advance % are all required.");
    save(
      { commissionOverride: { pfPercent: Number(pf), hcPercent: Number(hc), advancePercent: Number(adv) } },
      `Set commission override for ${t.homestayName}: platform fee ${pf}%, homestay commission ${hc}%, advance ${adv}%?`
    );
  }

  const overrides: Any = t.featureOverrides || {};
  const effective: Any = t.effectiveFeatures || {};
  const stats: Any = t.stats || {};

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">
            {t.homestayName || t.tenantKey} {t.blocked ? <Badge tone="red">Blocked</Badge> : <Badge tone="green">Active</Badge>}
          </p>
          <p className="text-xs text-slate-400">
            {t.ownerName || "—"} • {t.email || t.tenantKey} • {t.phone || "—"} • {t.location || "—"}
          </p>
          <p className="text-[11px] text-slate-500">
            Joined {dt(t.createdAt)} • Last active {dt(t.lastActiveAt)} • {stats.requests ?? "—"} requests • {stats.completed ?? "—"} completed • GMV {inr(stats.gmv)}
          </p>
          {t.blocked && t.blockReason && <p className="text-[11px] text-red-400">Reason: {t.blockReason}</p>}
        </div>
        <div className="flex gap-2">
          <button className={btn.primary} onClick={onOpen}>Open data</button>
          <button disabled={busy} onClick={toggleBlock} className={t.blocked ? btn.ok : btn.danger}>
            {t.blocked ? "Unblock" : "Block"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        {HOMESTAY_FEATURE_KEYS.map((k) => {
          const ov = overrides[k];
          const value = ov === true ? "on" : ov === false ? "off" : "default";
          return (
            <label key={k} className="text-[11px] text-slate-400">
              <span className="block font-semibold text-slate-300">
                {FEATURE_LABELS[k]} {effective[k] ? <Badge tone="green">ON</Badge> : <Badge>OFF</Badge>}
              </span>
              <select
                disabled={busy}
                value={value}
                onChange={(e) => {
                  const v = e.target.value;
                  save({ features: { [k]: v === "on" ? true : v === "off" ? false : null } });
                }}
                className={`${input} mt-1 w-full`}
              >
                <option value="default">Default</option>
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <span className="text-[11px] font-semibold text-slate-300">
          Commission override {o ? <Badge tone="blue">Active</Badge> : <Badge>Using global</Badge>}
        </span>
        <input className={`${input} w-28`} type="number" min="0" step="0.5" placeholder="Platform fee %" value={pf} onChange={(e) => setPf(e.target.value)} />
        <input className={`${input} w-28`} type="number" min="0" step="0.5" placeholder="Homestay %" value={hc} onChange={(e) => setHc(e.target.value)} />
        <input className={`${input} w-28`} type="number" min="0" step="0.5" placeholder="Advance %" value={adv} onChange={(e) => setAdv(e.target.value)} />
        <button disabled={busy} className={btn.primary} onClick={saveOverride}>Save override</button>
        {o && (
          <button disabled={busy} className={btn.ghost} onClick={() => save({ commissionOverride: null }, `Clear commission override for ${t.homestayName}?`)}>
            Clear override
          </button>
        )}
      </div>
    </div>
  );
}

// --- Homestay data viewer / editor (A3) ------------------------------------
const COLLECTIONS = ["rooms", "guests", "bookings", "drivers", "trips", "campaigns"] as const;
const COLLECTION_LABELS: Record<string, string> = {
  profile: "Profile", rooms: "Rooms", guests: "Guests", bookings: "Bookings", drivers: "Own drivers", trips: "Trips", campaigns: "Campaigns",
};
const READONLY_FIELDS = new Set(["id", "_id", "createdAt", "updatedAt", "tenantKey", "dispatchMode"]);

function TenantDataViewer({ t, demo, onClose, onOpenCabRequests }: { t: Any; demo: boolean; onClose: () => void; onOpenCabRequests?: (tenantKey: string) => void }) {
  useEditLock(true);
  const key = encodeURIComponent(t.tenantKey);
  const [tab, setTab] = useState<string>("profile");
  const { data, error, loading, reload } = useLoad(() => adminApi(`/stayride/tenants/${key}/data`, { demo }).then((r) => (r?.data ?? r) as Any), [key, demo]);
  const list: Any[] = tab !== "profile" && Array.isArray(data?.[tab]) ? data![tab] : [];

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/80 p-4">
      <div className="mx-auto max-w-6xl">
        <Panel
          title={<>{t.homestayName || t.tenantKey} — data {demo && <Badge tone="amber">DEMO dataset</Badge>}</>}
          subtitle={`${t.tenantKey}${data?.version != null ? ` • version ${data.version}` : ""} • every change is audited`}
          onRefresh={reload}
          error={error}
          loading={loading}
          right={<button className={btn.ghost} onClick={onClose}>Close</button>}
        >
          <div className="flex flex-wrap gap-2">
            {["profile", ...COLLECTIONS].map((k) => (
              <button key={k} className={chip(tab === k)} onClick={() => setTab(k)}>
                {COLLECTION_LABELS[k]}{k !== "profile" && Array.isArray(data?.[k]) ? ` (${data![k].length})` : ""}
              </button>
            ))}
          </div>
          {data && tab === "profile" &&
            (data.homestay ? (
              <RecordEditor
                rec={data.homestay}
                title="Homestay profile"
                startOpen
                onSave={(changes) => adminApi(`/stayride/tenants/${key}/homestay`, { method: "PATCH", body: changes, demo })}
                onChanged={reload}
              />
            ) : (
              <Empty>No homestay profile.</Empty>
            ))}
          {data && tab !== "profile" &&
            (list.length ? (
              list.map((r, i) => {
                const id = rid(r);
                const platform = tab === "trips" && Boolean(r.platform || r.reference || r.dispatchMode === "PLATFORM");
                const path = `/stayride/tenants/${key}/${tab}/${encodeURIComponent(id)}`;
                return (
                  <RecordEditor
                    key={id || i}
                    rec={r}
                    title={String(r.name || r.guestName || r.title || r.reference || r.roomNumber || id || `#${i + 1}`)}
                    readOnly={platform || !id}
                    note={
                      platform ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge tone="blue">Platform trip — read-only</Badge>
                          {onOpenCabRequests && <button className={btn.ghost} onClick={() => onOpenCabRequests(t.tenantKey)}>Manage in Cab requests</button>}
                        </span>
                      ) : undefined
                    }
                    onSave={(changes) => adminApi(path, { method: "PATCH", body: changes, demo })}
                    onDelete={() => adminApi(path, { method: "DELETE", demo })}
                    onChanged={reload}
                  />
                );
              })
            ) : (
              <Empty>No {COLLECTION_LABELS[tab].toLowerCase()}.</Empty>
            ))}
        </Panel>
      </div>
    </div>
  );
}

const shortVal = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
};
const draftOf = (v: unknown): string | boolean =>
  typeof v === "boolean" ? v : v !== null && typeof v === "object" ? JSON.stringify(v, null, 1) : v == null ? "" : String(v);

/** Generic field editor: strings/numbers/booleans inline, objects/arrays as JSON. Sends only changed fields. */
function RecordEditor({ rec, title, readOnly, note, startOpen, onSave, onDelete, onChanged }: {
  rec: Any; title: string; readOnly?: boolean; note?: ReactNode; startOpen?: boolean;
  onSave: (changes: Any) => Promise<any>; onDelete?: () => Promise<any>; onChanged: () => void;
}) {
  const [open, setOpen] = useState(!!startOpen);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEditLock(editing);
  const fields = Object.keys(rec);

  function start() {
    setDraft(Object.fromEntries(fields.map((k) => [k, draftOf(rec[k])])));
    setErr("");
    setEditing(true);
    setOpen(true);
  }

  async function save() {
    const changes: Any = {};
    for (const k of fields) {
      if (READONLY_FIELDS.has(k)) continue;
      const v = rec[k];
      const d = draft[k];
      let next: any;
      if (typeof v === "boolean") next = d;
      else if (typeof v === "number") {
        next = Number(d);
        if (d === "" || !Number.isFinite(next)) return setErr(`${k} must be a number.`);
      } else if (v !== null && typeof v === "object") {
        try {
          next = JSON.parse(String(d));
        } catch {
          return setErr(`${k} is not valid JSON.`);
        }
      } else {
        if (v == null && d === "") continue;
        next = d;
      }
      if (JSON.stringify(next) !== JSON.stringify(v)) changes[k] = next;
    }
    if (!Object.keys(changes).length) return setErr("Nothing changed.");
    if (!window.confirm(`Save changes to ${Object.keys(changes).join(", ")}?`)) return;
    setBusy(true);
    setErr("");
    try {
      await onSave(changes);
      setEditing(false);
      onChanged();
    } catch (e: any) {
      setErr(e?.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!onDelete || !window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusy(true);
    setErr("");
    try {
      await onDelete();
      onChanged();
    } catch (e: any) {
      setErr(e?.message || "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className="text-left text-sm font-bold text-white hover:text-blue-300" onClick={() => setOpen(!open)}>
          {open ? "▾" : "▸"} {title}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {note}
          {!readOnly && !editing && <button className={btn.ghost} disabled={busy} onClick={start}>Edit</button>}
          {editing && <button className={btn.primary} disabled={busy} onClick={save}>{busy ? "Saving..." : "Save"}</button>}
          {editing && <button className={btn.ghost} disabled={busy} onClick={() => { setEditing(false); setErr(""); }}>Cancel</button>}
          {!readOnly && onDelete && !editing && <button className={btn.danger} disabled={busy} onClick={remove}>Delete</button>}
        </div>
      </div>
      {err && <p className="rounded-xl border border-red-800/40 bg-red-950/40 px-3 py-2 font-semibold text-red-300">{err}</p>}
      {open && (
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 md:grid-cols-2">
          {fields.map((k) => {
            const v = rec[k];
            const d = draft[k];
            if (!editing || READONLY_FIELDS.has(k))
              return (
                <div key={k} className="flex gap-2 break-all">
                  <span className="shrink-0 text-slate-500">{k}</span>
                  <span className="font-mono text-slate-200">{shortVal(v)}</span>
                </div>
              );
            const set = (val: string | boolean) => setDraft((p) => ({ ...p, [k]: val }));
            return (
              <label key={k} className="block text-slate-400">
                {k}
                {typeof v === "boolean" ? (
                  <input className="ml-2" type="checkbox" checked={!!d} onChange={(e) => set(e.target.checked)} />
                ) : (v !== null && typeof v === "object") || String(d).length > 80 ? (
                  <textarea className={`${input} mt-1 w-full font-mono`} rows={4} value={String(d)} onChange={(e) => set(e.target.value)} />
                ) : (
                  <input className={`${input} mt-1 w-full`} type={typeof v === "number" ? "number" : "text"} value={String(d)} onChange={(e) => set(e.target.value)} />
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Drivers
// ---------------------------------------------------------------------------
export function DriversTab({ demo }: TabProps) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const { data, error, loading, reload, updatedAt } = useLoad(
    () => adminApi("/stayride/drivers", { demo, query: { status, q, search: q, ...pq(page) } }).then(toPage),
    [demo, status, q, page],
    true
  );
  const items = data?.items || [];

  function setDriverStatus(d: Any, next: "ACTIVE" | "PENDING_APPROVAL" | "BLOCKED") {
    let reason = "";
    if (next === "BLOCKED") {
      const r = ask(`Reason for blocking ${d.name}:`);
      if (!r) return;
      reason = r;
    } else if (!window.confirm(`${next === "ACTIVE" ? "Approve" : "Set to pending"} ${d.name}?`)) return;
    act(() => adminApi(`/stayride/drivers/${rid(d)}/status`, { method: "PATCH", body: { status: next, reason }, demo }), reload);
  }

  return (
    <Panel
      title="Drivers"
      subtitle="Approve platform drivers, block them or set them back to pending."
      onRefresh={reload}
      error={error}
      loading={loading}
      updatedAt={updatedAt}
      right={
        <>
          <select className={input} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">All statuses</option>
            <option value="PENDING_APPROVAL">Pending approval</option>
            <option value="ACTIVE">Approved</option>
            <option value="BLOCKED">Blocked</option>
          </select>
          <form onSubmit={(e) => { e.preventDefault(); setPage(0); setQ(search.trim()); }} className="flex gap-2">
            <input className={input} placeholder="Name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className={btn.primary}>Search</button>
          </form>
        </>
      }
    >
      {data &&
        (items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Driver</th>
                  <th className="p-3">Vehicle</th>
                  <th className="p-3">Rating</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((d) => (
                  <tr key={rid(d)} className="hover:bg-slate-900/40">
                    <td className="p-3">
                      <p className="font-semibold text-white">{d.name} {d.deletedAt && <Badge tone="red">deleted</Badge>}</p>
                      <p className="text-slate-500">{d.email} • {d.phone || "—"}</p>
                    </td>
                    <td className="p-3 text-slate-300">
                      {d.vehicle ? `${d.vehicle.type || ""} ${d.vehicle.model || ""} • ${d.vehicle.plate || "—"} • ${d.vehicle.seats ?? "—"} seats • ${d.vehicle.area || "—"}` : "—"}
                    </td>
                    <td className="p-3 text-slate-300">{ratingText(d)}</td>
                    <td className="p-3">
                      {statusBadge(d.accountStatus)}
                      {d.statusReason && <p className="mt-1 text-[10px] text-slate-500">{d.statusReason}</p>}
                    </td>
                    <td className="p-3 text-slate-400">{dt(d.createdAt)}</td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      {d.deletedAt ? (
                        <span className="text-[11px] text-slate-500">Deleted account</span>
                      ) : (
                        <>
                          {d.accountStatus !== "ACTIVE" && <button className={btn.ok} onClick={() => setDriverStatus(d, "ACTIVE")}>Approve</button>}
                          {d.accountStatus !== "BLOCKED" && <button className={btn.danger} onClick={() => setDriverStatus(d, "BLOCKED")}>Block</button>}
                          {d.accountStatus !== "PENDING_APPROVAL" && <button className={btn.ghost} onClick={() => setDriverStatus(d, "PENDING_APPROVAL")}>Set pending</button>}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No drivers for this filter.</Empty>
        ))}
      <Pager page={page} setPage={setPage} total={data?.total ?? null} count={items.length} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 5. Cab requests
// ---------------------------------------------------------------------------
const CAB_FILTERS: Record<string, { label: string; query?: Any; pending?: boolean; keep?: (c: Any) => boolean }> = {
  open: { label: "Pending (open + awaiting payment)", pending: true },
  needs: { label: "Needs driver", query: { needsReassignment: "true" }, keep: (c) => !!c.needsReassignment },
  awaiting: { label: "Awaiting payment", query: { status: "AWAITING_ADVANCE_PAYMENT" } },
  confirmed: { label: "Confirmed", query: { status: "CONFIRMED" } },
  started: { label: "In progress", query: { status: "TRIP_STARTED" } },
  completed: { label: "Completed", query: { status: "COMPLETED" } },
  cancelled: { label: "Cancelled", query: { status: "CANCELLED" } },
  expired: { label: "Expired", query: { status: "EXPIRED" } },
  refunds: { label: "Refunds pending", query: { refundStatus: "PENDING" } },
  dues: { label: "Driver dues pending", query: { driverSettlementStatus: "PENDING" } },
  unmatched: { label: "Unmatched to refund", query: { unmatched: "true" } },
  all: { label: "All" },
};

const statusTone = (s: string) =>
  s === "COMPLETED" || s === "CONFIRMED" ? "green" : s === "CANCELLED" ? "red" : s === "TRIP_STARTED" ? "blue" : s === "EXPIRED" ? "slate" : "amber";

export function CabRequestsTab({ demo, initialTenantKey }: TabProps & { initialTenantKey?: string }) {
  const [filter, setFilter] = useState(initialTenantKey ? "all" : "open");
  const [tenantKey, setTenantKey] = useState(initialTenantKey || "");
  const [tenantQuery, setTenantQuery] = useState(initialTenantKey || "");
  const [page, setPage] = useState(0);
  const f = CAB_FILTERS[filter];
  const { data, error, loading, reload, updatedAt } = useLoad(async () => {
    const r = toPage(await adminApi(f.pending ? "/cab-requests/pending" : "/cab-requests", { demo, query: { ...f.query, tenantKey: tenantQuery, ...pq(page) } }));
    return f.keep ? { ...r, items: r.items.filter(f.keep) } : r;
  }, [demo, filter, tenantQuery, page], true);
  const items = data?.items || [];

  return (
    <Panel
      title="Cab requests"
      subtitle="Full request lifecycle: assign, payment, trip, refunds and driver settlement."
      onRefresh={reload}
      error={error}
      loading={loading}
      updatedAt={updatedAt}
      right={
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setTenantQuery(tenantKey.trim().toLowerCase()); }} className="flex gap-2">
          <input className={input} placeholder="Homestay key (email)" value={tenantKey} onChange={(e) => setTenantKey(e.target.value)} />
          <button className={btn.primary}>Filter</button>
        </form>
      }
    >
      <div className="flex flex-wrap gap-2">
        {Object.entries(CAB_FILTERS).map(([key, v]) => (
          <button key={key} onClick={() => { setFilter(key); setPage(0); }} className={chip(filter === key)}>
            {v.label}
          </button>
        ))}
      </div>
      {tenantQuery && <p className="text-[11px] text-slate-400">Homestay: <span className="font-mono">{tenantQuery}</span></p>}
      {data && (items.length ? items.map((c) => <CabRequestCard key={rid(c)} c={c} demo={demo} onChanged={reload} />) : <Empty>No requests for this filter.</Empty>)}
      <Pager page={page} setPage={setPage} total={data?.total ?? null} count={items.length} />
    </Panel>
  );
}

function Money({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono font-semibold text-slate-100">{value}</span>
    </div>
  );
}

/** Platform fee / homestay commission / driver share rows, with % taken from the same split (never the global rates). */
function SplitRows({ s, fare }: { s: Any; fare: unknown }) {
  return (
    <>
      <Money label={`Platform fee${pct(s.platformFeePercent ?? s.pfPercent, s.platformFeeAmount, fare)}`} value={inr(s.platformFeeAmount)} />
      <Money label={`Homestay commission${pct(s.homestayCommissionPercent ?? s.hcPercent, s.homestayCommissionAmount, fare)}`} value={inr(s.homestayCommissionAmount)} />
      <Money label={`Driver share${pct(s.driverPayoutPercent, s.driverPayoutAmount, fare)}`} value={inr(s.driverPayoutAmount)} />
    </>
  );
}

function CabRequestCard({ c, demo, onChanged }: { c: Any; demo: boolean; onChanged: () => void }) {
  const [panel, setPanel] = useState<"" | "assign" | "payment">("");
  const s: Any = c.financialSnapshot || {};
  const path = (a: string) => `/cab-requests/${rid(c)}/${a}`;
  const post = (a: string, body: Any = {}) => act(() => adminApi(path(a), { method: "POST", body, demo }), onChanged);

  const open = OPEN_STATUSES.includes(c.status);
  const canAssign = ((open || c.status === "AWAITING_ADVANCE_PAYMENT") && !c.advancePaid) || !!c.needsReassignment;
  const canPay = c.status === "AWAITING_ADVANCE_PAYMENT" && !c.advancePaid;
  const canVoid = c.status === "CONFIRMED" && c.advancePaid && !c.hostPayoutId;
  const canCancel = !["TRIP_STARTED", "COMPLETED", "CANCELLED"].includes(c.status) && !c.hostPayoutId;
  const canRefund = c.status === "CANCELLED" && c.refundStatus === "PENDING";
  const canStart = c.status === "CONFIRMED" && c.advancePaid && !c.needsReassignment;
  const canComplete = c.status === "TRIP_STARTED";
  const canSettleDriver = c.status === "COMPLETED" && c.driverSettlementStatus === "PENDING";

  function voidPayment() {
    const reason = ask(`Reason for voiding payment ${c.advancePaymentId} (${inr(c.advanceAmount)}) on #${c.reference}:`);
    if (reason && window.confirm(`Void the recorded payment of ${inr(c.advanceAmount)}? The request goes back to awaiting payment.`)) post("void-payment", { reason });
  }
  function cancel() {
    const reason = ask(`Reason for cancelling #${c.reference}:`);
    const refundNote = c.advancePaid ? ` The paid advance ${inr(c.advanceAmount)} becomes a pending refund.` : "";
    if (reason && window.confirm(`Cancel request #${c.reference}?${refundNote}`)) post("cancel", { reason });
  }
  function refund() {
    const reference = ask(`Refund reference (UTR) for ${inr(c.advanceAmount)} to ${c.guestName}:`);
    if (reference && window.confirm(`Mark ${inr(c.advanceAmount)} refunded with reference ${reference}?`)) post("refund", { reference });
  }
  function refundUnmatched(paymentId: string, amount: number) {
    const reference = ask(`Refund reference (UTR) for unmatched payment ${paymentId} (${inr(amount)}) to ${c.guestName}:`);
    if (reference && window.confirm(`Mark unmatched payment ${paymentId} (${inr(amount)}) refunded with reference ${reference}?`)) {
      post("unmatched-refunded", { paymentId, reference });
    }
  }
  function settleDriver() {
    const due = typeof s.driverShareOfAdvance === "number" ? s.driverShareOfAdvance : undefined;
    const reference = ask(`Transfer reference (UTR) for driver ${c.assignedDriverName} (due ${inr(due)}):`);
    if (reference && window.confirm(`Record driver settlement of ${inr(due)} with reference ${reference}?`)) post("driver-settled", { reference });
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">
            #{c.reference} <Badge tone={statusTone(c.status)}>{c.status}</Badge>{" "}
            {c.needsReassignment && <Badge tone="red">Needs driver</Badge>}{" "}
            {c.ownFleet && <Badge tone="blue">Own fleet</Badge>}{" "}
            {c.dispatched === false && ["PENDING_REVIEW", "FINDING_DRIVER", "QUOTE_RECEIVED"].includes(c.status) && <Badge tone="slate">Held for owner</Badge>}{" "}
            {c.refundStatus && c.refundStatus !== "NONE" && <Badge tone={c.refundStatus === "PENDING" ? "amber" : "green"}>Refund {c.refundStatus}</Badge>}{" "}
            {c.driverSettlementStatus && c.driverSettlementStatus !== "NONE" && (
              <Badge tone={c.driverSettlementStatus === "PENDING" ? "amber" : "green"}>Driver {c.driverSettlementStatus}</Badge>
            )}
          </p>
          <p className="text-slate-400">
            {c.homestayName || "—"} ({c.propertyId}) • {c.requestSource || "—"} • created {dt(c.createdAt)}
          </p>
          <p className="text-slate-300">
            {c.guestName} • {c.guestPhone} • {c.passengers ?? "—"} pax • {c.vehicleType || "—"} • {c.date || "—"} {c.time || ""}
          </p>
          <p className="text-slate-400">
            {c.pickupLocation?.address || "—"} ➔ {(c.destinations || []).map((d: Any) => d.address).join(" ➔ ") || "—"}
            {c.isRoundTrip ? " (round trip)" : ""}
          </p>
          {c.assignedDriverName && <p className="text-slate-300">Driver: {c.assignedDriverName} • {c.assignedDriverPhone || "—"}{c.assignedDriverUserId ? " (platform)" : " (manual)"}</p>}
          {c.cancellationReason && <p className="text-red-400">Cancelled: {c.cancellationReason}</p>}
          {c.advanceDueAt && !c.advancePaid && <p className="text-amber-300">Advance due by {dt(c.advanceDueAt)}</p>}
          {c.paymentLinkUrl && <p className="text-slate-400">Payment link: <a className="text-blue-400 underline" href={c.paymentLinkUrl} target="_blank" rel="noreferrer">{c.paymentLinkUrl}</a></p>}
          {Array.isArray(c.unmatchedPayments) && c.unmatchedPayments.length > 0 && (
            <div className="mt-2 rounded-xl border border-red-800/60 bg-red-950/40 p-2.5 space-y-1.5">
              <p className="font-bold text-red-300">Unmatched / Out-of-Sequence Payments (Refunds Needed):</p>
              {c.unmatchedPayments.map((u: Any, idx: number) => (
                <div key={idx} className="flex flex-wrap items-center justify-between gap-2 text-slate-300">
                  <span>
                    <span className="font-mono text-white">{u.paymentId}</span> • {inr(u.amount)} • state was {u.status} • {dt(u.at)}
                    {u.refundedAt ? (
                      <span className="ml-2 font-semibold text-emerald-400">✓ Refunded (UTR: {u.refundReference || "—"})</span>
                    ) : (
                      <span className="ml-2 font-semibold text-amber-400">⚠ Needs Refund</span>
                    )}
                  </span>
                  {!u.refundedAt && (
                    <button
                      type="button"
                      className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-red-500"
                      onClick={() => refundUnmatched(u.paymentId, u.amount)}
                    >
                      Mark Refunded (UTR)
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-[250px] rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1">
          <Money label="Agreed fare" value={inr(c.agreedFare)} />
          <Money label="Advance" value={<>{inr(c.advanceAmount)} {c.advancePaid ? <Badge tone="green">PAID</Badge> : <Badge tone="amber">UNPAID</Badge>}</>} />
          <Money label="Cash to driver" value={inr(c.remainingCashAmount)} />
          <SplitRows s={s} fare={s.agreedFare ?? c.agreedFare} />
          {c.advancePaymentId && <Money label="Txn" value={`${c.advancePaymentId} (${c.paymentRecordedBy || "—"})`} />}
          {c.hostPayoutId && <Money label="Host payout" value={String(c.hostPayoutId)} />}
          {Array.isArray(c.voidedPayments) && c.voidedPayments.length > 0 && <Money label="Voided payments" value={c.voidedPayments.length} />}
        </div>
      </div>

      {Array.isArray(c.quotes) && c.quotes.length > 0 && (
        <div className="rounded-xl border border-slate-800 p-2">
          <p className="mb-1 font-semibold text-slate-300">Quotes</p>
          {c.quotes.map((q: Any, i: number) => (
            <p key={i} className="text-slate-400">
              {q.driverName} • {q.driverPhone || "—"} • <span className="font-mono text-slate-200">{inr(q.quotedFare)}</span> • {q.status}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canAssign && <button className={btn.primary} onClick={() => setPanel(panel === "assign" ? "" : "assign")}>{c.needsReassignment ? "Assign new driver" : c.assignedDriverName ? "Re-assign / re-price" : "Assign driver"}</button>}
        {canPay && <button className={btn.ok} onClick={() => setPanel(panel === "payment" ? "" : "payment")}>Record payment</button>}
        {canVoid && <button className={btn.danger} onClick={voidPayment}>Void payment</button>}
        {canStart && <button className={btn.primary} onClick={() => window.confirm(`Start trip #${c.reference}?`) && post("start")}>Start trip</button>}
        {canComplete && <button className={btn.ok} onClick={() => window.confirm(`Complete trip #${c.reference}? Driver collects ${inr(c.remainingCashAmount)} in cash.`) && post("complete")}>Complete trip</button>}
        {canRefund && <button className={btn.ok} onClick={refund}>Mark refunded</button>}
        {canSettleDriver && <button className={btn.ok} onClick={settleDriver}>Driver settled</button>}
        {canCancel && <button className={btn.danger} onClick={cancel}>Cancel</button>}
      </div>

      {panel === "assign" && <AssignForm c={c} demo={demo} onDone={() => { setPanel(""); onChanged(); }} />}
      {panel === "payment" && <PaymentForm c={c} demo={demo} onDone={() => { setPanel(""); onChanged(); }} />}
    </div>
  );
}

function AssignForm({ c, demo, onDone }: { c: Any; demo: boolean; onDone: () => void }) {
  useEditLock(true);
  // A request that lost its driver after the advance was paid keeps its locked fare.
  const locked = !!c.needsReassignment && typeof c.agreedFare === "number";
  const [driverUserId, setDriverUserId] = useState("");
  const [picked, setPicked] = useState<Any | null>(null);
  const [driverSearch, setDriverSearch] = useState("");
  const [driverQ, setDriverQ] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [fare, setFare] = useState(locked ? String(c.agreedFare) : "");
  const [preview, setPreview] = useState<Any | null>(null);
  const [previewFor, setPreviewFor] = useState("");
  const [busy, setBusy] = useState(false);
  const drivers = useLoad(
    () => adminApi("/stayride/drivers", { demo, query: { status: "ACTIVE", q: driverQ, search: driverQ, page: 1, limit: LIMIT } }).then((r) => toPage(r).items),
    [demo, driverQ]
  );
  const options = [...(picked && !(drivers.data || []).some((d) => rid(d) === rid(picked)) ? [picked] : []), ...(drivers.data || [])];

  async function loadPreview() {
    if (!(Number(fare) > 0)) return alert("Enter a fare first.");
    try {
      const r = await adminApi("/commission/preview", { method: "POST", body: { fare: Number(fare), tenantKey: c.propertyId }, demo });
      setPreview(r.data);
      setPreviewFor(fare);
    } catch (e: any) {
      alert(e?.message || "Preview failed.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!driverUserId && (!name.trim() || !phone.trim())) return alert("Pick an approved driver or enter driver name and phone.");
    if (!locked && (!preview || previewFor !== fare)) return alert("Load the money preview for this fare first.");
    const who = driverUserId ? picked?.name || driverUserId : name;
    const msg = locked
      ? `Assign ${who} to #${c.reference} at the locked fare ${inr(c.agreedFare)}?`
      : `Assign ${who} at ${inr(preview!.agreedFare)}? Guest advance ${inr(preview!.advanceAmount)}, platform fee ${inr(preview!.platformFeeAmount)}, homestay commission ${inr(preview!.homestayCommissionAmount)}.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    const body: Any = { agreedFare: Number(fare), vehicleModel: model || undefined, vehiclePlate: plate || undefined };
    if (driverUserId) body.driverUserId = driverUserId;
    else Object.assign(body, { assignedDriverName: name.trim(), assignedDriverPhone: phone.trim() });
    await act(() => adminApi(`/cab-requests/${rid(c)}/assign-driver`, { method: "POST", body, demo }), onDone);
    setBusy(false);
  }

  const searchDrivers = () => setDriverQ(driverSearch.trim());

  return (
    <form onSubmit={submit} className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          className={`${input} flex-1`}
          placeholder="Search all approved drivers (name, phone, email)"
          value={driverSearch}
          onChange={(e) => setDriverSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchDrivers(); } }}
        />
        <button type="button" className={btn.ghost} onClick={searchDrivers}>{drivers.loading ? "Searching..." : "Search drivers"}</button>
        {drivers.error && <span className="text-red-400">Approved drivers: {drivers.error}</span>}
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <select
          className={input}
          value={driverUserId}
          onChange={(e) => { setDriverUserId(e.target.value); setPicked(options.find((d) => rid(d) === e.target.value) || null); }}
        >
          <option value="">Manual driver (enter below)</option>
          {options.map((d) => (
            <option key={rid(d)} value={rid(d)}>{d.name} • {d.phone || "—"} • {d.vehicle?.plate || "—"}{typeof d.rating === "number" ? ` • ★${d.rating}` : ""}</option>
          ))}
        </select>
        {!driverUserId && <input className={input} placeholder="Driver name *" value={name} onChange={(e) => setName(e.target.value)} />}
        {!driverUserId && <input className={input} placeholder="Driver phone *" value={phone} onChange={(e) => setPhone(e.target.value)} />}
        <input className={input} placeholder="Vehicle model" value={model} onChange={(e) => setModel(e.target.value)} />
        <input className={input} placeholder="Vehicle plate" value={plate} onChange={(e) => setPlate(e.target.value)} />
        <input className={input} type="number" min="1" placeholder="Agreed fare ₹ *" required readOnly={locked} title={locked ? "Fare is locked (advance already paid)" : undefined} value={fare} onChange={(e) => setFare(e.target.value)} />
      </div>
      {!locked && c.quotes?.some((q: Any) => q.driverId) && (
        <div className="flex flex-wrap gap-1">
          {c.quotes.filter((q: Any) => q.driverId).map((q: Any, i: number) => (
            <button
              type="button"
              key={i}
              className={btn.ghost}
              onClick={() => { setDriverUserId(String(q.driverId)); setPicked({ _id: String(q.driverId), name: q.driverName, phone: q.driverPhone }); setFare(String(q.quotedFare)); }}
            >
              Use quote: {q.driverName} {inr(q.quotedFare)}
            </button>
          ))}
        </div>
      )}
      {preview && previewFor === fare && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-slate-800 bg-slate-950 p-2 md:grid-cols-3">
          <Money label="Fare" value={inr(preview.agreedFare)} />
          <Money label="Advance" value={inr(preview.advanceAmount)} />
          <Money label="Cash to driver" value={inr(preview.remainingCashToDriver)} />
          <SplitRows s={preview} fare={preview.agreedFare} />
          <Money label="Driver share of advance" value={inr(preview.driverShareOfAdvance)} />
        </div>
      )}
      <div className="flex gap-2">
        {!locked && <button type="button" className={btn.ghost} onClick={loadPreview}>Preview split</button>}
        <button className={btn.primary} disabled={busy || (!locked && (!preview || previewFor !== fare))}>{busy ? "Assigning..." : "Confirm assignment"}</button>
      </div>
    </form>
  );
}

function PaymentForm({ c, demo, onDone }: { c: Any; demo: boolean; onDone: () => void }) {
  useEditLock(true);
  const [txn, setTxn] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("UPI");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!txn.trim() || !Number.isFinite(amt)) return alert("Transaction ID and amount are required.");
    if (amt !== c.advanceAmount) return alert(`Record exactly the advance ${inr(c.advanceAmount)}. The balance is paid to the driver in cash.`);
    if (!window.confirm(`Record ${inr(amt)} via ${method} (txn ${txn.trim()}) for #${c.reference}?`)) return;
    setBusy(true);
    await act(
      () => adminApi(`/cab-requests/${rid(c)}/record-payment`, { method: "POST", body: { transactionId: txn.trim(), amount: amt, method, note: note || undefined }, demo }),
      onDone
    );
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3 space-y-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <input className={input} placeholder="Transaction ID *" required value={txn} onChange={(e) => setTxn(e.target.value)} />
        <input className={input} type="number" placeholder={`Advance ${inr(c.advanceAmount)}`} required value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select className={input} value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="UPI">UPI</option>
          <option value="BANK_TRANSFER">Bank transfer</option>
          <option value="CASH">Cash</option>
          <option value="GATEWAY">Gateway</option>
        </select>
        <input className={input} placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button className={btn.ok} disabled={busy}>{busy ? "Recording..." : "Record payment"}</button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// 6. Homestay payouts
// ---------------------------------------------------------------------------
/** Where to send the money: UPI id or full bank details (admin sees the full account number). */
function payoutDest(p: Any) {
  const method = p.method || p.payoutMethod;
  const bank: Any | null = p.bank || p.bankDetails || null;
  if (method === "BANK_TRANSFER" || (!p.upiId && bank)) {
    return {
      method: "BANK_TRANSFER",
      text: bank ? `${bank.accountName || "—"} • A/c ${bank.accountNumber || "—"} • IFSC ${bank.ifsc || "—"} • ${bank.bankName || "bank —"}` : "Bank details missing",
    };
  }
  return { method: method || "UPI", text: p.upiId ? `UPI ${p.upiId}` : "UPI id missing" };
}

export function PayoutsTab({ demo }: TabProps) {
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(0);
  const { data, error, loading, reload, updatedAt } = useLoad(
    () => adminApi("/host-payouts", { demo, query: { status, ...pq(page) } }).then(toPage),
    [demo, status, page],
    true
  );
  const items = data?.items || [];

  function settle(p: Any) {
    const dest = payoutDest(p);
    const utrNumber = ask(`UTR for ${inr(p.amount)} to ${p.ownerName} (${dest.text}):`);
    if (!utrNumber) return;
    const notes = window.prompt("Notes (optional):") || "";
    if (window.confirm(`Mark ${inr(p.amount)} to ${p.homestayName} as settled with UTR ${utrNumber}?`))
      act(() => adminApi(`/host-payouts/${rid(p)}/settle`, { method: "POST", body: { utrNumber, notes }, demo }), reload);
  }
  function reject(p: Any) {
    const reason = ask(`Reason for rejecting ${inr(p.amount)} payout to ${p.homestayName}:`);
    if (reason && window.confirm(`Reject this payout? Its trips can be requested again.`))
      act(() => adminApi(`/host-payouts/${rid(p)}/reject`, { method: "POST", body: { reason }, demo }), reload);
  }

  return (
    <Panel
      title="Homestay commission payouts"
      onRefresh={reload}
      error={error}
      loading={loading}
      updatedAt={updatedAt}
      right={
        <select className={input} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="SETTLED">Settled</option>
          <option value="REJECTED">Rejected</option>
        </select>
      }
    >
      {data &&
        (items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Homestay</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Trips</th>
                  <th className="p-3">Pay to</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Requested</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((p) => {
                  const dest = payoutDest(p);
                  return (
                    <tr key={rid(p)} className="hover:bg-slate-900/40">
                      <td className="p-3">
                        <p className="font-semibold text-white">{p.homestayName}</p>
                        <p className="text-slate-500">{p.ownerName} • {p.ownerPhone || "—"} • {p.tenantId}</p>
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-400">{inr(p.amount)}</td>
                      <td className="p-3 text-slate-300">{Array.isArray(p.cabRequestIds) ? p.cabRequestIds.length : "—"}</td>
                      <td className="p-3 text-slate-300">
                        <Badge tone="blue">{dest.method === "BANK_TRANSFER" ? "Bank transfer" : dest.method}</Badge>
                        <p className="mt-1 select-all font-mono text-[11px]">{dest.text}</p>
                      </td>
                      <td className="p-3">
                        <Badge tone={p.status === "SETTLED" ? "green" : p.status === "REJECTED" ? "red" : "amber"}>{p.status}</Badge>
                        {p.utrNumber && <p className="mt-1 font-mono text-[10px] text-slate-500">UTR {p.utrNumber} • {dt(p.settledAt)}</p>}
                        {p.rejectedReason && <p className="mt-1 text-[10px] text-red-400">{p.rejectedReason}</p>}
                      </td>
                      <td className="p-3 text-slate-400">{dt(p.requestedAt)}</td>
                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        {p.status === "PENDING" && (
                          <>
                            <button className={btn.ok} onClick={() => settle(p)}>Settle</button>
                            <button className={btn.danger} onClick={() => reject(p)}>Reject</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No payouts for this filter.</Empty>
        ))}
      <Pager page={page} setPage={setPage} total={data?.total ?? null} count={items.length} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 7. Platform settings
// ---------------------------------------------------------------------------
/** Mirrors the server's CommissionService.split so unsaved values can be previewed. */
function localSplit(fare: number, pf: number, hc: number, adv: number, min: number) {
  const f = Math.round(fare);
  const pfA = Math.round((f * pf) / 100);
  const hcA = Math.round((f * hc) / 100);
  const advance = Math.min(f, Math.max(min, Math.round((f * adv) / 100), pfA + hcA));
  return { f, pfA, hcA, driver: f - pfA - hcA, advance, cash: f - advance, driverShare: advance - pfA - hcA };
}

export function SettingsTab({ demo }: TabProps) {
  // The demo toggle selects which database's settings are read and written.
  const { data, error, loading, reload, updatedAt } = useLoad(() => adminApi("/commission/settings", { demo }).then((r) => r.data as Any), [demo], true);
  const [pf, setPf] = useState("");
  const [hc, setHc] = useState("");
  const [adv, setAdv] = useState("");
  const [min, setMin] = useState("");
  const [features, setFeatures] = useState<Any>({});
  const [reason, setReason] = useState("");
  const [fare, setFare] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPf(String(data.globalPlatformFeePercent ?? ""));
    setHc(String(data.globalHomestayCommissionPercent ?? ""));
    setAdv(String(data.defaultAdvancePercent ?? ""));
    setMin(String(data.minAdvanceAmount ?? ""));
    setFeatures(data.features || {});
  }, [data]);

  const dirty =
    !!data &&
    (reason !== "" ||
      pf !== String(data.globalPlatformFeePercent ?? "") ||
      hc !== String(data.globalHomestayCommissionPercent ?? "") ||
      adv !== String(data.defaultAdvancePercent ?? "") ||
      min !== String(data.minAdvanceAmount ?? "") ||
      JSON.stringify(features) !== JSON.stringify(data.features || {}));
  useEditLock(dirty);

  const which = demo ? "DEMO (test) dataset" : "PRODUCTION dataset";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return alert("A change reason is required.");
    if ([pf, hc, adv, min].some((v) => v === "")) return alert("All rates are required.");
    if (!window.confirm(`Apply to the ${which}: platform fee ${pf}%, homestay commission ${hc}%, advance ${adv}%, min advance ₹${min} and the feature switches, for all new requests?`)) return;
    setSaving(true);
    await act(
      () => adminApi("/commission/settings", {
        method: "PUT",
        demo,
        body: {
          globalPlatformFeePercent: Number(pf),
          globalHomestayCommissionPercent: Number(hc),
          defaultAdvancePercent: Number(adv),
          minAdvanceAmount: Number(min),
          features,
          changeReason: reason.trim(),
        },
      }),
      () => { setReason(""); reload(); }
    );
    setSaving(false);
  }

  const setFeature = (k: string, field: "enabled" | "defaultOn", v: boolean) => setFeatures((f: Any) => ({ ...f, [k]: { ...f[k], [field]: v } }));
  const sample = Number(fare) > 0 && [pf, hc, adv, min].every((v) => v !== "") ? localSplit(Number(fare), Number(pf), Number(hc), Number(adv), Number(min)) : null;

  return (
    <>
    <Panel
      title={<>Platform settings {demo ? <Badge tone="amber">DEMO DATASET</Badge> : <Badge tone="green">PRODUCTION</Badge>}</>}
      subtitle="Global commission rates, minimum advance and feature switches."
      onRefresh={reload}
      error={error}
      loading={loading}
      updatedAt={updatedAt}
    >
      <div className={`rounded-xl border px-4 py-3 text-xs font-bold ${demo ? "border-amber-600/50 bg-amber-950/50 text-amber-300" : "border-emerald-700/50 bg-emerald-950/40 text-emerald-300"}`}>
        {demo
          ? "You are editing the DEMO (test) dataset settings. Production homestays are not affected. Untick “Demo dataset” to edit production."
          : "You are editing PRODUCTION settings. Changes apply to all real homestays' new requests."}
      </div>
      {data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form onSubmit={save} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-slate-300">Platform fee %<input className={`${input} mt-1 w-full`} type="number" step="0.5" min="0" required value={pf} onChange={(e) => setPf(e.target.value)} /></label>
              <label className="text-slate-300">Homestay commission %<input className={`${input} mt-1 w-full`} type="number" step="0.5" min="0" required value={hc} onChange={(e) => setHc(e.target.value)} /></label>
              <label className="text-slate-300">Advance %<input className={`${input} mt-1 w-full`} type="number" step="0.5" min="0" required value={adv} onChange={(e) => setAdv(e.target.value)} /></label>
              <label className="text-slate-300">Minimum advance ₹<input className={`${input} mt-1 w-full`} type="number" min="0" required value={min} onChange={(e) => setMin(e.target.value)} /></label>
            </div>
            <table className="w-full text-left">
              <thead className="text-slate-400">
                <tr><th className="p-1">Feature</th><th className="p-1">Enabled globally</th><th className="p-1">On by default for homestays</th></tr>
              </thead>
              <tbody>
                {FEATURE_KEYS.map((k) => (
                  <tr key={k} className="text-slate-300">
                    <td className="p-1">{FEATURE_LABELS[k]}</td>
                    <td className="p-1"><input type="checkbox" checked={!!features[k]?.enabled} onChange={(e) => setFeature(k, "enabled", e.target.checked)} /></td>
                    <td className="p-1">
                      {k === "driverQuotes" ? (
                        <span className="text-[10px] text-slate-500">all drivers (no per-homestay setting)</span>
                      ) : (
                        <input type="checkbox" checked={!!features[k]?.defaultOn} onChange={(e) => setFeature(k, "defaultOn", e.target.checked)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <label className="block text-slate-300">
              Change reason *
              <input className={`${input} mt-1 w-full`} required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are these settings changing?" />
            </label>
            <button className={demo ? "rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-500 disabled:opacity-50" : btn.primary} disabled={saving}>
              {saving ? "Saving..." : `Save ${demo ? "DEMO" : "PRODUCTION"} settings`}
            </button>
            <p className="text-[11px] text-slate-500">
              Last change by {data.updatedBy || "—"} • {data.changeReason || "—"} • effective {dt(data.effectiveFrom)}
            </p>
          </form>
          <div className="space-y-3 text-xs">
            <label className="block text-slate-300">
              Sample fare ₹
              <input className={`${input} mt-1 w-full`} type="number" min="1" value={fare} onChange={(e) => setFare(e.target.value)} placeholder="Enter a fare to preview" />
            </label>
            {sample ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-1">
                <p className="text-[11px] text-slate-500">Preview with the values on the left (unsaved until you save).</p>
                <Money label="Fare" value={inr(sample.f)} />
                <Money label={`Platform fee (${pf}%)`} value={inr(sample.pfA)} />
                <Money label={`Homestay commission (${hc}%)`} value={inr(sample.hcA)} />
                <Money label="Driver share" value={inr(sample.driver)} />
                <Money label="Guest advance" value={inr(sample.advance)} />
                <Money label="Cash to driver" value={inr(sample.cash)} />
                <Money label="Driver share of advance" value={inr(sample.driverShare)} />
              </div>
            ) : (
              <Empty>Enter a sample fare to preview the split.</Empty>
            )}
          </div>
        </div>
      )}
    </Panel>
    <OperationsSettings demo={demo} />
    </>
  );
}

// Operational settings (server: services/platform-config.ts). The server validates and clamps every
// value, and the apps and the guest page read them from the server, so nothing here is hard-coded there.
const VEHICLE_KEYS = ["Sedan", "SUV", "7-seater", "9-seater"] as const;
const NUM_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "advanceWindowMin", label: "Advance payment window (minutes)", hint: "0 = no deadline. Keep 0 while payments are recorded by hand; set e.g. 30 once Razorpay is on." },
  { key: "ownFleetFeePercent", label: "Own-fleet fee %", hint: "StayRide's fee when the owner uses their own driver (paid by the guest as the advance)." },
  { key: "ownFleetMinFee", label: "Own-fleet minimum fee ₹", hint: "Floor, so an under-reported fare still pays." },
  { key: "nearbyRadiusKm", label: "Nearby radius (km)", hint: "Drivers further than this from the homestay are not notified. 0 = everyone." },
  { key: "driverBroadcastMax", label: "WhatsApp drivers per request", hint: "Each message costs money; push goes to all matching drivers." },
  { key: "askCabCooldownHours", label: "Ask-for-Cab cooldown (hours)", hint: "Minimum gap between two messages to the same guest." },
  { key: "pickupStepMin", label: "Pickup time step (minutes)", hint: "" },
  { key: "bookingHorizonDays", label: "Booking window (days ahead)", hint: "" },
  { key: "requestExpiryHours", label: "Request expiry (hours after pickup)", hint: "" },
  { key: "guestLinkDays", label: "Guest link validity (days)", hint: "" },
  { key: "maxOpenRequestsPerPhone", label: "Open requests per guest phone", hint: "Abuse limit on the public guest page." },
  { key: "maxFare", label: "Maximum fare ₹", hint: "Sanity cap on any quote or assignment." },
  { key: "quoteValidityHours", label: "Driver quote valid for (hours)", hint: "After this a quote expires and the driver can quote again. 0 = never." },
];

// Business details shown in the app's Privacy Policy, Terms and Refund pages (required before publishing)
const BUSINESS_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "Brand name" },
  { key: "legalName", label: "Registered business name" },
  { key: "address", label: "Registered address (city, state)" },
  { key: "email", label: "Support email" },
  { key: "phone", label: "Support phone" },
  { key: "grievanceOfficer", label: "Grievance Officer name" },
  { key: "grievanceEmail", label: "Grievance email" },
  { key: "website", label: "Website" },
];

// Message types StayRide sends on WhatsApp; each needs a Meta-approved template (wording is set in Meta)
const WHATSAPP_EVENTS: { key: string; label: string }[] = [
  { key: "ASK_CAB", label: "Ask guest for a cab (link)" },
  { key: "NEW_REQUEST", label: "New trip request to drivers (quote link)" },
  { key: "QUOTE_COUNTER", label: "Owner's counter-offer to a driver" },
  { key: "QUOTE_ACCEPTED_DRIVER", label: "Driver: your quote was accepted" },
  { key: "QUOTE_ACCEPTED_GUEST", label: "Guest: pay the advance" },
  { key: "ADVANCE_PAID_GUEST", label: "Guest: trip confirmed + driver details" },
  { key: "ADVANCE_PAID_DRIVER", label: "Driver: trip confirmed + guest details" },
  { key: "ADVANCE_EXPIRED_GUEST", label: "Guest: hold expired (advance not paid)" },
  { key: "TRIP_ASSIGNED_DRIVER", label: "Own driver: trip assigned" },
];

function OperationsSettings({ demo }: TabProps) {
  const { data, error, loading, reload, updatedAt } = useLoad(() => adminApi("/commission/settings", { demo }).then((r) => r.data as Any), [demo], true);
  const [cfg, setCfg] = useState<Any | null>(null);
  const [presets, setPresets] = useState("");
  const [icalHosts, setIcalHosts] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.platform) return;
    setCfg(JSON.parse(JSON.stringify(data.platform)));
    setPresets((data.platform.sightseeingPresets || []).join("\n"));
    setIcalHosts((data.platform.icalAllowedHosts || []).join("\n"));
  }, [data]);

  const dirty = !!data?.platform && !!cfg && (reason !== "" || JSON.stringify({ ...cfg, sightseeingPresets: presetList(presets), icalAllowedHosts: presetList(icalHosts) }) !== JSON.stringify(data.platform));
  useEditLock(dirty);

  function presetList(text: string) {
    return text.split("\n").map((p) => p.trim()).filter(Boolean);
  }
  const set = (key: string, value: unknown) => setCfg((c: Any) => ({ ...c, [key]: value }));
  const setVehicle = (k: string, field: string, value: unknown) =>
    setCfg((c: Any) => ({ ...c, vehicles: { ...c.vehicles, [k]: { ...c.vehicles[k], [field]: value } } }));

  const updateRouteField = (index: number, field: string, val: unknown) => {
    setCfg((c: Any) => {
      const routes = [...(c.routePresets || [])];
      if (!routes[index]) return c;
      routes[index] = { ...routes[index], [field]: val };
      return { ...c, routePresets: routes };
    });
  };

  const updateRouteFare = (index: number, vKey: string, val: number) => {
    setCfg((c: Any) => {
      const routes = [...(c.routePresets || [])];
      if (!routes[index]) return c;
      routes[index] = {
        ...routes[index],
        fares: {
          ...(routes[index].fares || {}),
          [vKey]: val,
        },
      };
      return { ...c, routePresets: routes };
    });
  };

  const addRoutePreset = () => {
    setCfg((c: Any) => {
      const routes = [...(c.routePresets || [])];
      routes.push({
        id: `route-${Date.now().toString(36)}`,
        name: "New Hill Route",
        category: "SIGHTSEEING",
        duration: "approx 2 hrs",
        description: "Scenic hill route",
        fares: { Sedan: 2200, SUV: 2800, "7-seater": 3200, "9-seater": 4200 },
      });
      return { ...c, routePresets: routes };
    });
  };

  const removeRoutePreset = (index: number) => {
    if (!window.confirm("Remove this route preset?")) return;
    setCfg((c: Any) => {
      const routes = [...(c.routePresets || [])];
      routes.splice(index, 1);
      return { ...c, routePresets: routes };
    });
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg || !data) return;
    if (!reason.trim()) return alert("A change reason is required.");
    if (!window.confirm(`Apply these operations settings to the ${demo ? "DEMO" : "PRODUCTION"} dataset?`)) return;
    setSaving(true);
    await act(
      () =>
        adminApi("/commission/settings", {
          method: "PUT",
          demo,
          body: {
            // only the operations config: the server keeps the saved rates and feature switches
            platform: { ...cfg, sightseeingPresets: presetList(presets), icalAllowedHosts: presetList(icalHosts) },
            changeReason: reason.trim(),
          },
        }),
      () => { setReason(""); reload(); }
    );
    setSaving(false);
  }

  return (
    <Panel
      title={<>Operations settings {demo ? <Badge tone="amber">DEMO DATASET</Badge> : <Badge tone="green">PRODUCTION</Badge>}</>}
      subtitle="Payment window, own-fleet fee, nearby radius, WhatsApp, booking times, presets and vehicle classes. The server clamps invalid values."
      onRefresh={reload}
      error={error}
      loading={loading}
      updatedAt={updatedAt}
    >
      {cfg && (
        <form onSubmit={save} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NUM_FIELDS.map((f) => (
              <label key={f.key} className="text-slate-300">
                {f.label}
                <input className={`${input} mt-1 w-full`} type="number" min="0" value={cfg[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value === "" ? "" : Number(e.target.value))} />
                {f.hint && <span className="mt-1 block text-[10px] text-slate-500">{f.hint}</span>}
              </label>
            ))}
            <label className="text-slate-300">
              Earliest pickup time
              <input className={`${input} mt-1 w-full`} value={cfg.pickupStart ?? ""} onChange={(e) => set("pickupStart", e.target.value)} placeholder="03:30 AM" />
            </label>
            <label className="text-slate-300">
              Latest pickup time
              <input className={`${input} mt-1 w-full`} value={cfg.pickupEnd ?? ""} onChange={(e) => set("pickupEnd", e.target.value)} placeholder="10:00 PM" />
            </label>
            <label className="text-slate-300">
              WhatsApp template language
              <input className={`${input} mt-1 w-full`} value={cfg.whatsappLanguage ?? ""} onChange={(e) => set("whatsappLanguage", e.target.value)} placeholder="en, hi, ne, bn…" />
              <span className="mt-1 block text-[10px] text-slate-500">Templates must be approved in Meta in this language.</span>
            </label>
          </div>

          <table className="w-full text-left">
            <thead className="text-slate-400">
              <tr><th className="p-1">Vehicle class</th><th className="p-1">Label shown</th><th className="p-1">Seats</th><th className="p-1">Estimate ₹</th><th className="p-1">Bookable</th></tr>
            </thead>
            <tbody>
              {VEHICLE_KEYS.map((k) => (
                <tr key={k} className="text-slate-300">
                  <td className="p-1 font-mono">{k}</td>
                  <td className="p-1"><input className={`${input} w-full`} value={cfg.vehicles?.[k]?.label ?? ""} onChange={(e) => setVehicle(k, "label", e.target.value)} /></td>
                  <td className="p-1"><input className={`${input} w-20`} type="number" min="1" value={cfg.vehicles?.[k]?.seats ?? ""} onChange={(e) => setVehicle(k, "seats", Number(e.target.value))} /></td>
                  <td className="p-1"><input className={`${input} w-24`} type="number" min="0" value={cfg.vehicles?.[k]?.estFare ?? ""} onChange={(e) => setVehicle(k, "estFare", Number(e.target.value))} /></td>
                  <td className="p-1"><input type="checkbox" checked={!!cfg.vehicles?.[k]?.enabled} onChange={(e) => setVehicle(k, "enabled", e.target.checked)} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Route-Specific Benchmark Pricing */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Route-Specific Benchmark Pricing</h4>
                <p className="text-[11px] text-slate-400">
                  Calibrate fixed benchmark fares across vehicle tiers for popular Darjeeling and Sikkim hill routes. Displayed in the guest booking wizard and used as baseline estimates for driver bidding.
                </p>
              </div>
              <button
                type="button"
                onClick={addRoutePreset}
                className="self-start sm:self-auto rounded-lg bg-emerald-700/80 hover:bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors"
              >
                + Add Route Preset
              </button>
            </div>

            <div className="space-y-3">
              {(cfg.routePresets || []).map((route: Any, idx: number) => (
                <div key={route.id || idx} className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                      <div>
                        <span className="text-[10px] text-slate-400">Route Name</span>
                        <input
                          className={`${input} w-full mt-0.5 font-medium`}
                          value={route.name || ""}
                          onChange={(e) => updateRouteField(idx, "name", e.target.value)}
                          placeholder="e.g. Bagdogra Airport Transfer"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Category</span>
                        <select
                          className={`${input} w-full mt-0.5`}
                          value={route.category || "SIGHTSEEING"}
                          onChange={(e) => updateRouteField(idx, "category", e.target.value)}
                        >
                          <option value="AIRPORT_STATION">Airport / Station</option>
                          <option value="SIGHTSEEING">Sightseeing</option>
                          <option value="DAY_EXCURSION">Day Excursion</option>
                          <option value="LOCAL_DROP">Local Drop</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Duration / Distance</span>
                        <input
                          className={`${input} w-full mt-0.5`}
                          value={route.duration || ""}
                          onChange={(e) => updateRouteField(idx, "duration", e.target.value)}
                          placeholder="e.g. approx 3 hrs (70 km)"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRoutePreset(idx)}
                      className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 transition-colors self-end sm:self-center"
                      title="Delete route preset"
                    >
                      Delete
                    </button>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400">Description / Subtext</span>
                    <input
                      className={`${input} w-full mt-0.5 text-xs text-slate-300`}
                      value={route.description || ""}
                      onChange={(e) => updateRouteField(idx, "description", e.target.value)}
                      placeholder="e.g. One-way hill descent / climb transfer via Rohini route"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Fares per Vehicle Tier (₹)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {VEHICLE_KEYS.map((vKey) => (
                        <div key={vKey} className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1.5 rounded-md border border-slate-800">
                          <span className="text-[11px] font-mono text-slate-400 min-w-[50px]">{vKey}:</span>
                          <span className="text-xs text-slate-500">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            className="w-full bg-transparent text-xs font-semibold text-white focus:outline-none"
                            value={route.fares?.[vKey] ?? ""}
                            onChange={(e) => updateRouteFare(idx, vKey, Number(e.target.value))}
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {(!cfg.routePresets || cfg.routePresets.length === 0) && (
                <div className="text-center py-4 text-xs text-slate-500">
                  No route presets configured yet. Defaults from server will apply until customized.
                </div>
              )}
            </div>
          </div>

          <label className="block text-slate-300">
            Sightseeing presets (one per line)
            <textarea className={`${input} mt-1 h-40 w-full font-mono`} value={presets} onChange={(e) => setPresets(e.target.value)} />
          </label>

          <div className="rounded-xl border border-slate-800 p-3">
            <p className="mb-2 font-semibold text-slate-300">Business details (legal pages)</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BUSINESS_FIELDS.map((f) => (
                <label key={f.key} className="text-slate-400">
                  {f.label}
                  <input
                    className={`${input} mt-1 w-full`}
                    value={cfg.business?.[f.key] ?? ""}
                    onChange={(e) => set("business", { ...(cfg.business || {}), [f.key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Empty fields show a visible “to be added” placeholder in the app&apos;s legal pages.</p>
          </div>

          <table className="w-full text-left">
            <thead className="text-slate-400">
              <tr><th className="p-1">WhatsApp message</th><th className="p-1">Approved template name (empty = plain text, test number only)</th></tr>
            </thead>
            <tbody>
              {WHATSAPP_EVENTS.map((e) => (
                <tr key={e.key} className="text-slate-300">
                  <td className="p-1">{e.label}</td>
                  <td className="p-1">
                    <input
                      className={`${input} w-full font-mono`}
                      value={cfg.whatsappTemplates?.[e.key] ?? ""}
                      placeholder="e.g. stayride_ask_cab"
                      onChange={(ev) => set("whatsappTemplates", { ...(cfg.whatsappTemplates || {}), [e.key]: ev.target.value.trim().toLowerCase() })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <label className="block text-slate-300">
            Calendar sync: allowed sites (one domain per line)
            <textarea className={`${input} mt-1 h-28 w-full font-mono`} value={icalHosts} onChange={(e) => setIcalHosts(e.target.value)} />
            <span className="mt-1 block text-[10px] text-slate-500">Owners can only import iCal links from these domains and their subdomains (e.g. airbnb.com covers www.airbnb.com).</span>
          </label>

          <label className="block text-slate-300">
            Change reason *
            <input className={`${input} mt-1 w-full`} required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are these settings changing?" />
          </label>
          <button className={demo ? "rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-500 disabled:opacity-50" : btn.primary} disabled={saving}>
            {saving ? "Saving..." : `Save ${demo ? "DEMO" : "PRODUCTION"} operations settings`}
          </button>
        </form>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 8. Appeals
// ---------------------------------------------------------------------------
export function AppealsTab({ demo }: TabProps) {
  const [page, setPage] = useState(0);
  const { data, error, loading, reload, updatedAt } = useLoad(() => adminApi("/appeals", { demo, query: pq(page) }).then(toPage), [demo, page], true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const items = data?.items || [];

  function decide(a: Any, status: "APPROVED" | "REJECTED") {
    const decisionNote = (notes[rid(a)] || "").trim();
    if (status === "REJECTED" && !decisionNote) return alert("A note is required to reject.");
    const what = status === "APPROVED" ? `Approve and turn ON ${FEATURE_LABELS[a.featureKey] || a.featureKey} for ${a.homestayName}?` : `Reject this appeal from ${a.homestayName}?`;
    if (window.confirm(what)) act(() => adminApi(`/appeals/${rid(a)}/decide`, { method: "POST", body: { status, decisionNote }, demo }), reload);
  }

  return (
    <Panel title="Feature appeals" subtitle="Approving grants the feature to that homestay." onRefresh={reload} error={error} loading={loading} updatedAt={updatedAt}>
      {data &&
        (items.length ? (
          items.map((a) => (
            <div key={rid(a)} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2 text-xs">
              <p className="text-sm font-bold text-white">
                {a.homestayName} • {FEATURE_LABELS[a.featureKey] || a.featureKey}{" "}
                <Badge tone={a.status === "APPROVED" ? "green" : a.status === "REJECTED" ? "red" : "amber"}>{a.status}</Badge>
              </p>
              <p className="text-slate-400">{a.ownerEmail} • {dt(a.createdAt)}</p>
              <p className="text-slate-300">“{a.reason}”</p>
              {a.status === "PENDING" ? (
                <div className="flex flex-wrap gap-2">
                  <input className={`${input} flex-1`} placeholder="Decision note" value={notes[rid(a)] || ""} onChange={(e) => setNotes({ ...notes, [rid(a)]: e.target.value })} />
                  <button className={btn.ok} onClick={() => decide(a, "APPROVED")}>Approve</button>
                  <button className={btn.danger} onClick={() => decide(a, "REJECTED")}>Reject</button>
                </div>
              ) : (
                <p className="text-slate-500">Decided by {a.decidedBy || "—"} on {dt(a.decidedAt)}{a.decisionNote ? ` • ${a.decisionNote}` : ""}</p>
              )}
            </div>
          ))
        ) : (
          <Empty>No appeals.</Empty>
        ))}
      <Pager page={page} setPage={setPage} total={data?.total ?? null} count={items.length} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 9. Audit log
// ---------------------------------------------------------------------------
export function AuditTab({ demo }: TabProps) {
  const [action, setAction] = useState("");
  const [targetId, setTargetId] = useState("");
  const [q, setQ] = useState({ action: "", targetId: "" });
  const [page, setPage] = useState(0);
  const { data, error, loading, reload, updatedAt } = useLoad(
    () => adminApi("/audit-log", { demo, query: { ...q, ...pq(page) } }).then(toPage),
    [demo, q, page],
    true
  );
  const items = data?.items || [];
  return (
    <Panel
      title="Audit log"
      subtitle="Every admin and money action, newest first."
      onRefresh={reload}
      error={error}
      loading={loading}
      updatedAt={updatedAt}
      right={
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setQ({ action: action.trim(), targetId: targetId.trim() }); }} className="flex gap-2">
          <input className={input} placeholder="Action (e.g. payment.record)" value={action} onChange={(e) => setAction(e.target.value)} />
          <input className={input} placeholder="Target ID" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
          <button className={btn.primary}>Filter</button>
        </form>
      }
    >
      {data &&
        (items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider">
                <tr><th className="p-3">When</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Details</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((l, i) => (
                  <tr key={rid(l) || i} className="align-top">
                    <td className="p-3 whitespace-nowrap text-slate-400">{dt(l.createdAt)}</td>
                    <td className="p-3 text-slate-200">{l.actor}</td>
                    <td className="p-3 font-mono text-blue-300">{l.action}</td>
                    <td className="p-3 text-slate-300">{l.targetType} <span className="font-mono text-slate-500">{l.targetId}</span></td>
                    <td className="p-3"><pre className="max-w-md whitespace-pre-wrap break-all text-[10px] text-slate-400">{JSON.stringify(l.details ?? {}, null, 1)}</pre></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No audit entries.</Empty>
        ))}
      <Pager page={page} setPage={setPage} total={data?.total ?? null} count={items.length} />
    </Panel>
  );
}
