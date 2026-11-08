"use client";

// StayRide platform admin desks. Every value shown comes from the server; missing money is "—",
// never a made-up default. Every server error is surfaced (adminApi throws its message).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
const parseDateObj = (v: unknown): Date | null => {
  if (!v) return null;
  const num = typeof v === "number" ? v : /^\d+$/.test(String(v).trim()) ? Number(v) : NaN;
  const d = !isNaN(num) ? new Date(num) : new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
};
export const formatStrictDDMMYYYY = (v: unknown): string => {
  if (!v) return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  const d = parseDateObj(v);
  return d ? d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }) : String(v || "—");
};

export const formatStrictDateTime = (v: unknown): string => {
  const d = parseDateObj(v);
  return d ? d.toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
};

export const formatDisplayDate = (v: unknown): string => {
  const d = parseDateObj(v);
  if (!d) return String(v || "—");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${dd}/${mm}/${yyyy} (${d.getDate()} ${months[d.getMonth()]} ${yyyy})`;
};

const dt = (v: unknown) => formatStrictDateTime(v);
const formatDate = (v: unknown) => formatStrictDDMMYYYY(v);
const formatDDMMYYYY = (v: unknown) => formatStrictDDMMYYYY(v);

/**
 * Controlled date input that strictly renders and edits dates in DD/MM/YYYY format.
 * Bypasses OS/browser locale quirks (e.g. US Chrome forcing MM/DD/YYYY) while
 * offering both typed entry and a native calendar popup.
 */
function DatePickerDDMMYYYY({
  value,
  onChange,
  min,
  placeholder = "DD/MM/YYYY",
  required = false,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  min?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);

  const toDisplay = (v: string): string => {
    if (!v) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split("-");
      return `${d}/${m}/${y}`;
    }
    return v;
  };

  const [text, setText] = useState(() => toDisplay(value));

  useEffect(() => {
    setText(toDisplay(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) {
      const d = m[1].padStart(2, "0");
      const mo = m[2].padStart(2, "0");
      const y = m[3];
      const ymd = `${y}-${mo}-${d}`;
      const parsed = new Date(Number(y), Number(mo) - 1, Number(d));
      if (!isNaN(parsed.getTime()) && parsed.getDate() === Number(d)) {
        onChange(ymd);
      }
    }
  };

  const handleBlur = () => {
    setText(toDisplay(value));
  };

  const triggerPicker = () => {
    if (pickerRef.current) {
      try {
        if (typeof pickerRef.current.showPicker === "function") {
          pickerRef.current.showPicker();
        } else {
          pickerRef.current.focus();
        }
      } catch {
        pickerRef.current.focus();
      }
    }
  };

  return (
    <div className="relative flex items-center w-full">
      <input
        type="text"
        required={required}
        placeholder={placeholder}
        value={text}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className={
          className ||
          "w-full h-9 rounded-lg border border-slate-800 bg-[#0D1117] px-3 pr-9 text-xs text-white font-mono placeholder:text-slate-500 focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043]/30 transition-colors"
        }
      />
      <button
        type="button"
        onClick={triggerPicker}
        title="Open calendar (DD/MM/YYYY)"
        className="absolute right-2.5 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        value={value}
        min={min}
        onChange={(e) => {
          if (e.target.value) {
            onChange(e.target.value);
            setText(toDisplay(e.target.value));
          }
        }}
        className="sr-only"
        aria-hidden="true"
      />
    </div>
  );
}

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
  primary: "rounded-lg bg-[#1E7E4B] hover:bg-[#259A5C] px-3.5 py-1.5 text-xs font-medium text-white transition disabled:opacity-50 shadow-xs cursor-pointer",
  ok: "rounded-lg bg-[#1E7E4B] hover:bg-[#259A5C] px-3.5 py-1.5 text-xs font-medium text-white transition disabled:opacity-50 shadow-xs cursor-pointer",
  danger: "rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3.5 py-1.5 text-xs font-medium text-red-300 transition disabled:opacity-50 cursor-pointer",
  ghost: "rounded-lg border border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition disabled:opacity-50 cursor-pointer",
};
const input = "rounded-lg border border-slate-800 bg-[#0D1117] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043] transition";
const chip = (on: boolean) =>
  `rounded-md border px-2.5 py-1 text-xs font-medium transition ${on ? "border-[#2EA043]/40 bg-[#2EA043]/15 text-[#3FB950]" : "border-slate-800 bg-[#0D1117] text-slate-400 hover:text-slate-200"}`;

function Ago({ t }: { t: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!t) return null;
  return <span className="text-[11px] text-slate-500">updated {Math.max(0, Math.round((Date.now() - t) / 1000))}s ago</span>;
}

function Panel({ title, subtitle, onRefresh, error, loading, children, right, updatedAt }: {
  title: ReactNode; subtitle?: string; onRefresh?: () => void; error?: string; loading?: boolean; children: ReactNode; right?: ReactNode; updatedAt?: number | null;
}) {
  return (
    <section className="rounded-2xl border border-slate-800/80 bg-[#121820] p-6 shadow-xs space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          <span>{error}</span>
          {onRefresh && (
            <button onClick={onRefresh} disabled={loading} className="shrink-0 rounded-md border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/20 transition disabled:opacity-50">
              {loading ? "Retrying..." : "Retry"}
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue" | "cyan" | "purple" }) {
  const tones = {
    slate: "bg-slate-800/60 text-slate-300 border-slate-700/60",
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    red: "bg-red-500/10 text-red-300 border-red-500/20",
    blue: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    cyan: "bg-teal-500/10 text-teal-300 border-teal-500/20",
    purple: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  };
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-none ${tones[tone]}`}>{children}</span>;
}

function Kpi({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 shadow-xs transition ${accent ? "border-emerald-500/30 bg-emerald-500/5" : "border-slate-800/80 bg-[#0D1117]"}`}>
      <span className={`text-xs font-medium ${accent ? "text-emerald-400" : "text-slate-400"}`}>{label}</span>
      <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-white">{value}</p>
      {hint && <span className="mt-1 block text-[11px] text-slate-500 leading-tight">{hint}</span>}
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
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800/80 bg-[#121820] p-6 text-xs shadow-xl">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <div className="text-slate-300 leading-relaxed">{message}</div>
        {children}
        {reasonLabel && (
          <label className="block text-slate-300 font-medium">
            {reasonLabel}{reasonRequired ? " *" : ""}
            <textarea className={`${input} mt-1.5 w-full`} rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        )}
        {err && <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
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
    <Panel title="Platform revenue dashboard" subtitle="Live totals from cab requests and homestay payouts." onRefresh={reload} error={error} loading={loading} updatedAt={updatedAt}>
      {data && (
        <div className="space-y-6">
          {/* Tier 1: Core Financial Volume */}
          <div>
            <h3 className="mb-2.5 text-xs font-medium text-slate-400">Core Volume &amp; Platform Revenue</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Gross volume (completed)" value={inr(cab.gmv)} hint="Total passenger booking spend" accent />
              <Kpi label="Platform fee earned" value={inr(cab.platformFee)} hint={rateHint(rates?.pf)} accent />
              <Kpi label="Advance collected" value={inr(cab.advanceCollected)} hint="Customer UPI advance on file" />
              <Kpi label="Completed trips" value={cab.completed ?? "—"} hint="Confirmed and executed hill rides" />
            </div>
          </div>

          {/* Tier 2: Partner Commissions & Dues */}
          <div>
            <h3 className="mb-2.5 text-xs font-medium text-slate-400">Partner Commissions &amp; Outstanding Dues</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Homestay commission (lifetime)" value={inr(cab.homestayCommission)} hint={rateHint(rates?.hc)} />
              <Kpi label="Homestay commission owed now" value={inr(cab.homestayCommissionUnpaid)} hint="Payable, not yet in any payout request" />
              <Kpi label="Driver share dues pending" value={inr(cab.driverDuesPending)} hint="Awaiting settlement" />
              <Kpi label="Refunds pending" value={inr(cab.refundsPending)} hint="Passenger cancellations" />
            </div>
          </div>

          {/* Tier 3: Review Queue & Active Pipeline */}
          <div>
            <h3 className="mb-2.5 text-xs font-medium text-slate-400">Active Requests &amp; Review Queue</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Open requests" value={cab.open ?? "—"} hint="Finding driver or pending review" />
              <Kpi label="Awaiting payment" value={cab.awaitingPayment ?? "—"} hint="Quote accepted, held on timer" />
              <Kpi label="Completed without PIN" value={cab.noPinToReview ?? "—"} hint="Held for operator review" />
              {typeof cab.unmatchedPending === "number" && cab.unmatchedPending > 0 && (
                <Kpi label="Unmatched payments" value={inr(cab.unmatchedPending)} hint={`${cab.unmatchedCount ?? 0} payment(s)`} />
              )}
            </div>
          </div>

          {/* Homestay Payouts Ledger */}
          <div>
            <h3 className="mb-2.5 text-xs font-medium text-slate-400">Homestay payouts by status</h3>
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
        </div>
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
              <thead className="border-b border-slate-800 text-slate-400 font-medium text-xs">
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-white">{u.name || "—"}</span>
                        {u.isDemo && <Badge tone="amber">demo</Badge>}
                        {u.deletedAt && <Badge tone="red">deleted</Badge>}
                      </div>
                      <p className="text-slate-400 text-xs">{u.email || "—"}</p>
                      <p className="text-slate-500 text-[11px]">{u.phone || "No phone"}</p>
                      {u.tenantKey && u.tenantKey !== u.email && (
                        <span className="inline-flex items-center gap-1 mt-0.5 rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 border border-slate-700/60">
                          Property: {u.tenantKey}
                        </span>
                      )}
                    </td>
                    <td className="p-3"><Badge tone={u.role === "admin" ? "blue" : "slate"}>{u.role}</Badge></td>
                    <td className="p-3">
                      {statusBadge(u.accountStatus)}
                      {u.statusReason && u.accountStatus !== "ACTIVE" && (
                        <p className="mt-1 text-[10px] text-amber-400/90 font-mono">Reason: {u.statusReason}</p>
                      )}
                    </td>
                    <td className="p-3 text-slate-300">
                      {u.role === "driver" ? ratingText(u) : "—"}
                      {u.vehicle && (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300">{u.vehicle.model || u.vehicle.type || "Vehicle"}</span>
                          <span className="rounded bg-slate-900 px-1.5 py-0.2 font-mono text-[10px] text-amber-400 border border-amber-900/30">{u.vehicle.plate || "—"}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-slate-400 whitespace-nowrap">{dt(u.createdAt)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {u.accountStatus === "PENDING_APPROVAL" && !u.deletedAt && (
                          <button className={btn.ok} onClick={() => setDialog({ u, kind: "approve" })}>Approve</button>
                        )}
                        {u.accountStatus === "BLOCKED" && !u.deletedAt && (
                          <button className={btn.ok} onClick={() => setDialog({ u, kind: "unblock" })}>Unblock</button>
                        )}
                        {u.accountStatus !== "BLOCKED" && !u.deletedAt && (
                          <button className={btn.danger} onClick={() => setDialog({ u, kind: "block" })}>Block</button>
                        )}
                        {!u.deletedAt && (
                          <button className={btn.ghost} title="Change Role" onClick={() => setDialog({ u, kind: "role" })}>Role</button>
                        )}
                        <button className={btn.ghost} title="Revoke all active logins" onClick={() => setDialog({ u, kind: "revoke" })}>Sign out</button>
                        {!u.deletedAt && (
                          <button className="rounded border border-red-900/50 bg-red-950/40 px-2 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-900/60 transition" onClick={() => setDialog({ u, kind: "delete" })}>Delete</button>
                        )}
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
  const [configuring, setConfiguring] = useState<Any | null>(null);
  const [bookingForGuest, setBookingForGuest] = useState<{ tenantKey: string; guestName?: string; guestPhone?: string; pickup?: string } | null>(null);
  const { data, error, loading, reload, updatedAt } = useLoad(
    () => adminApi("/stayride/tenants", { demo, query: { q: query, search: query, ...pq(page) } }).then(toPage),
    [demo, query, page],
    true
  );
  const items = data?.items || [];
  return (
    <Panel
      title="Homestays"
      subtitle="Operational fleet homestays. View booking & trip data, configure custom commission overrides, and manage feature permissions."
      onRefresh={reload}
      error={error}
      loading={loading}
      updatedAt={updatedAt}
      right={
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setQuery(search.trim()); }} className="flex gap-2">
          <input className={input} placeholder="Search name, owner, or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className={btn.primary}>Search</button>
        </form>
      }
    >
      {data && (
        items.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 font-medium text-xs">
                <tr>
                  <th className="p-3">Homestay & Location</th>
                  <th className="p-3">Owner Contact</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Cab Activity & GMV</th>
                  <th className="p-3">Overrides</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((t) => (
                  <HomestayRow
                    key={t.tenantKey}
                    t={t}
                    demo={demo}
                    onChanged={reload}
                    onOpen={() => setViewing(t)}
                    onConfigure={() => setConfiguring(t)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No homestays found.</Empty>
        )
      )}
      <Pager page={page} setPage={setPage} total={data?.total ?? null} count={items.length} />
      {viewing && (
        <TenantDataViewer
          t={viewing}
          demo={demo}
          onClose={() => { setViewing(null); reload(); }}
          onOpenCabRequests={onOpenCabRequests ? (k) => { setViewing(null); onOpenCabRequests(k); } : undefined}
          onBookCabForGuest={(params) => { setViewing(null); setBookingForGuest(params); }}
        />
      )}
      {bookingForGuest && (
        <AdminBookCabModal
          demo={demo}
          initialTenantKey={bookingForGuest.tenantKey}
          initialGuestName={bookingForGuest.guestName}
          initialGuestPhone={bookingForGuest.guestPhone}
          initialPickup={bookingForGuest.pickup}
          onClose={() => setBookingForGuest(null)}
          onSuccess={() => { setBookingForGuest(null); reload(); }}
        />
      )}
      {configuring && (
        <HomestayConfigModal
          t={configuring}
          demo={demo}
          onClose={() => setConfiguring(null)}
          onChanged={() => { setConfiguring(null); reload(); }}
        />
      )}
    </Panel>
  );
}

function HomestayRow({
  t,
  demo,
  onChanged,
  onOpen,
  onConfigure,
}: {
  t: Any;
  demo: boolean;
  onChanged: () => void;
  onOpen: () => void;
  onConfigure: () => void;
}) {
  const o = t.commissionOverride;
  const stats: Any = t.stats || {};
  const overrides: Any = t.featureOverrides || {};
  const activeCustomFlags = Object.values(overrides).filter((v) => v !== null && v !== undefined).length;

  return (
    <tr className="align-top hover:bg-slate-900/40 transition">
      <td className="p-3">
        <p className="font-bold text-white text-sm">{t.homestayName || t.tenantKey}</p>
        <p className="text-slate-400 text-xs">{t.location || "Location not set"}</p>
        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{t.tenantKey}</p>
      </td>
      <td className="p-3">
        <p className="font-semibold text-slate-200">{t.ownerName || "—"}</p>
        <p className="text-slate-400 text-xs">{t.email || "—"}</p>
        <p className="text-slate-500 text-[11px]">{t.phone || "No phone"}</p>
      </td>
      <td className="p-3">
        {t.blocked ? (
          <div>
            <Badge tone="red">Suspended</Badge>
            {t.blockReason && <p className="text-[10px] text-red-400 mt-1 max-w-[140px] truncate" title={t.blockReason}>{t.blockReason}</p>}
          </div>
        ) : (
          <Badge tone="green">Active</Badge>
        )}
      </td>
      <td className="p-3 text-slate-300">
        <div className="font-semibold text-white">{stats.completed ?? 0} <span className="text-slate-400 font-normal">completed ({stats.requests ?? 0} total)</span></div>
        <div className="font-mono text-emerald-400 font-bold text-xs mt-0.5">GMV: {inr(stats.gmv ?? 0)}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">Joined {dt(t.createdAt)}</div>
      </td>
      <td className="p-3">
        <div className="flex flex-col gap-1 items-start">
          {o ? (
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-mono text-emerald-300 border border-emerald-500/20">
              PF {o.pfPercent}% • HC {o.hcPercent}% • Adv {o.advancePercent}%
            </span>
          ) : (
            <span className="rounded-md bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400 border border-slate-700/60">
              Global commission
            </span>
          )}
          {activeCustomFlags > 0 ? (
            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 border border-amber-500/20">
              {activeCustomFlags} custom feature flag(s)
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">Standard features</span>
          )}
        </div>
      </td>
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <button className={btn.primary} onClick={onOpen}>Open Data</button>
          <button className={btn.ghost} onClick={onConfigure} title="Feature flags and custom commission rates">
            Overrides
          </button>
        </div>
      </td>
    </tr>
  );
}

function HomestayConfigModal({
  t,
  demo,
  onClose,
  onChanged,
}: {
  t: Any;
  demo: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const o = t.commissionOverride;
  const [pf, setPf] = useState(o?.pfPercent != null ? String(o.pfPercent) : "");
  const [hc, setHc] = useState(o?.hcPercent != null ? String(o.hcPercent) : "");
  const [adv, setAdv] = useState(o?.advancePercent != null ? String(o.advancePercent) : "");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"features" | "commission" | "account">("features");
  const overrides: Any = t.featureOverrides || {};
  const effective: Any = t.effectiveFeatures || {};

  async function save(body: Any, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await adminApi(`/stayride/tenants/${encodeURIComponent(t.tenantKey)}/controls`, { method: "PUT", body, demo });
      onChanged();
    } catch (e: any) {
      alert(e?.message || "Failed to update homestay controls.");
    } finally {
      setBusy(false);
    }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800/80 bg-[#121820] p-6 shadow-xl text-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>{t.homestayName || t.tenantKey}</span>
              {t.blocked ? <Badge tone="red">Suspended</Badge> : <Badge tone="green">Active</Badge>}
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">Configure granular access, feature permissions, and custom fee schedules.</p>
          </div>
          <button type="button" className="text-slate-400 hover:text-white text-base font-bold" onClick={onClose}>✕</button>
        </div>

        <div className="flex gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setTab("features")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${tab === "features" ? "bg-[#1E7E4B] text-white" : "text-slate-400 hover:text-white"}`}
          >
            Feature Switches
          </button>
          <button
            type="button"
            onClick={() => setTab("commission")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${tab === "commission" ? "bg-[#1E7E4B] text-white" : "text-slate-400 hover:text-white"}`}
          >
            Commission Overrides {o && <span className="ml-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 rounded">Active</span>}
          </button>
          <button
            type="button"
            onClick={() => setTab("account")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${tab === "account" ? "bg-[#1E7E4B] text-white" : "text-slate-400 hover:text-white"}`}
          >
            Account Access
          </button>
        </div>

        {tab === "features" && (
          <div className="space-y-3">
            <p className="text-slate-400">Override specific features for this homestay. Selecting "Default" inherits the platform-wide configuration.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {HOMESTAY_FEATURE_KEYS.map((k) => {
                const ov = overrides[k];
                const value = ov === true ? "on" : ov === false ? "off" : "default";
                return (
                  <div key={k} className="p-3 rounded-xl border border-slate-800 bg-[#0D1117] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-200">{FEATURE_LABELS[k]}</span>
                      {effective[k] ? <Badge tone="green">ON</Badge> : <Badge>OFF</Badge>}
                    </div>
                    <select
                      disabled={busy}
                      value={value}
                      onChange={(e) => {
                        const v = e.target.value;
                        save({ features: { [k]: v === "on" ? true : v === "off" ? false : null } });
                      }}
                      className={`${input} w-full`}
                    >
                      <option value="default">Default (Inherit Global)</option>
                      <option value="on">Force Enable (On)</option>
                      <option value="off">Force Disable (Off)</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "commission" && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-slate-300 space-y-1">
              <span className="font-medium text-emerald-300">Custom Fee Schedule</span>
              <p className="text-[11px] text-slate-400">By default, all homestays use platform global rates. Setting an override here locks custom rates for all rides booked through this property.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Platform Fee %</label>
                <input className={`${input} w-full`} type="number" min="0" step="0.5" placeholder="5" value={pf} onChange={(e) => setPf(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Host Comm %</label>
                <input className={`${input} w-full`} type="number" min="0" step="0.5" placeholder="10" value={hc} onChange={(e) => setHc(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Guest Advance %</label>
                <input className={`${input} w-full`} type="number" min="0" step="0.5" placeholder="15" value={adv} onChange={(e) => setAdv(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              {o ? (
                <button
                  type="button"
                  disabled={busy}
                  className="text-red-400 hover:text-red-300 text-xs font-semibold cursor-pointer"
                  onClick={() => save({ commissionOverride: null }, `Remove custom commission override and revert to platform global rates?`)}
                >
                  Revert to Global Rates
                </button>
              ) : <span className="text-slate-500 text-xs">Currently using global rates</span>}
              <button disabled={busy} className={btn.primary} onClick={saveOverride}>
                {busy ? "Saving..." : "Save Custom Override"}
              </button>
            </div>
          </div>
        )}

        {tab === "account" && (
          <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1117] space-y-3">
            <h4 className="font-semibold text-slate-200">Account access & suspension</h4>
            <p className="text-slate-400 text-xs">
              Suspending a homestay prevents it from dispatching rides or receiving bookings. It does not delete data history.
            </p>
            {t.blocked && t.blockReason && (
              <p className="p-2 rounded bg-red-950/40 border border-red-900/60 text-red-300 font-mono text-xs">
                Current suspension reason: "{t.blockReason}"
              </p>
            )}
            <div>
              <button disabled={busy} onClick={toggleBlock} className={t.blocked ? btn.ok : btn.danger}>
                {t.blocked ? "Unblock Homestay Account" : "Suspend Homestay Account"}
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-slate-800 pt-3 text-right">
          <button type="button" className={btn.ghost} onClick={onClose}>Close</button>
        </div>
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

function TenantDataViewer({
  t,
  demo,
  onClose,
  onOpenCabRequests,
  onBookCabForGuest,
}: {
  t: Any;
  demo: boolean;
  onClose: () => void;
  onOpenCabRequests?: (tenantKey: string) => void;
  onBookCabForGuest?: (params: { tenantKey: string; guestName?: string; guestPhone?: string; pickup?: string }) => void;
}) {
  useEditLock(true);
  const key = encodeURIComponent(t.tenantKey);
  const [tab, setTab] = useState<"drivers" | "guests" | "trips" | "rooms" | "profile" | "raw">("drivers");
  const [rawKey, setRawKey] = useState<string>("rooms");
  const { data, error, loading, reload } = useLoad(() => adminApi(`/stayride/tenants/${key}/data`, { demo }).then((r) => (r?.data ?? r) as Any), [key, demo]);

  const drivers: Any[] = Array.isArray(data?.drivers) ? data.drivers : [];
  const guests: Any[] = Array.isArray(data?.guests) ? data.guests : [];
  const bookings: Any[] = Array.isArray(data?.bookings) ? data.bookings : [];
  const trips: Any[] = Array.isArray(data?.trips) ? data.trips : [];
  const rooms: Any[] = Array.isArray(data?.rooms) ? data.rooms : [];
  const homestay = data?.homestay || {};

  // Combine guests with their bookings for a rich guest sheet
  const activeGuests = (guests.length > 0 ? guests : bookings).map((g: Any) => {
    const booking = bookings.find((b: Any) => b.guestId === g.id || b.phone === g.phone);
    return {
      name: g.name || g.guestName || "Guest",
      phone: g.phone || booking?.phone || "No phone",
      room: g.room || booking?.room || booking?.roomName || "Room",
      checkIn: g.checkIn || booking?.checkIn,
      checkOut: g.checkOut || booking?.checkOut,
      channel: g.channel || booking?.channel || "Direct Booking",
    };
  });

  const rawList: Any[] = rawKey !== "profile" && Array.isArray(data?.[rawKey]) ? data![rawKey] : [];

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/85 p-4 backdrop-blur-xs flex items-center justify-center">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-800/80 bg-[#121820] shadow-xl overflow-hidden">
        {/* Drawer Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800 bg-[#0D1117]/70">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{t.homestayName || t.tenantKey}</h3>
              {demo ? <Badge tone="amber">Demo</Badge> : <Badge tone="green">Production</Badge>}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Account: <span className="font-mono text-slate-300">{t.tenantKey}</span> • Location: {t.location || "Darjeeling"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onBookCabForGuest && (
              <button
                type="button"
                onClick={() => onBookCabForGuest({ tenantKey: t.tenantKey, pickup: t.location || t.homestayName })}
                className="px-3 py-1.5 rounded-lg bg-[#1E7E4B] hover:bg-[#259A5C] text-white font-medium text-xs transition"
              >
                + Book Cab for Host
              </button>
            )}
            <button className={btn.ghost} onClick={reload} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button className={btn.ghost} onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 px-6 py-2.5 border-b border-slate-800/80 bg-[#0D1117]/40 text-xs">
          {[
            { id: "drivers", label: "Own Fleet Drivers", count: drivers.length },
            { id: "guests", label: "In-House Guests", count: activeGuests.length },
            { id: "trips", label: "Cab Requests", count: trips.length },
            { id: "rooms", label: "Rooms & Units", count: rooms.length },
            { id: "profile", label: "Property Profile" },
            { id: "raw", label: "Raw Records" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                tab === item.id
                  ? "bg-[#1E7E4B] text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{item.label}</span>
              {typeof item.count === "number" && (
                <span className={`ml-1.5 px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                  tab === item.id ? "bg-emerald-900 text-white" : "bg-slate-800 text-slate-400"
                }`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {error && <div className="rounded-xl border border-red-800/60 bg-red-950/40 p-3 text-red-300 font-semibold">{error}</div>}

          {/* TAB 1: OWN FLEET DRIVERS */}
          {tab === "drivers" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h4 className="text-sm font-bold text-white">Dedicated Own-Fleet Drivers</h4>
                  <p className="text-[11px] text-slate-400">Drivers attached directly to this homestay. Trips assigned to them incur the 5% own-fleet fee.</p>
                </div>
              </div>

              {drivers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {drivers.map((d: Any) => (
                    <div key={d.id || d.name} className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">{d.name}</span>
                        <Badge tone={d.active !== false ? "green" : "slate"}>
                          {d.active !== false ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="text-slate-300 space-y-0.5">
                        <p className="text-xs font-mono text-slate-200">{d.phone || "No phone"}</p>
                        <p className="text-xs text-slate-400">
                          {d.vehicleType || "SUV"} • Plate: <span className="font-mono text-slate-200">{d.vehicleNumber || d.plate || "Not set"}</span>
                        </p>
                      </div>
                      {d.phone && (
                        <div className="pt-2 border-t border-slate-800 flex justify-end">
                          <a
                            href={`tel:${d.phone}`}
                            className="px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                          >
                            Call driver
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl border border-slate-800 bg-slate-900/30 text-slate-500">
                  No own-fleet drivers registered for this homestay. The owner can add their own drivers in the StayRide mobile app.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: IN-HOUSE GUESTS */}
          {tab === "guests" && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h4 className="text-sm font-semibold text-white">In-House Guests &amp; Calendar Bookings</h4>
                <p className="text-[11px] text-slate-400">Imported from Airbnb, Booking.com, MakeMyTrip, or direct owner bookings. Click "Book Cab" to dispatch immediately.</p>
              </div>

              {activeGuests.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-slate-400 font-medium text-xs">
                      <tr>
                        <th className="p-3">Guest Name &amp; Contact</th>
                        <th className="p-3">Room / Unit</th>
                        <th className="p-3">Stay Dates</th>
                        <th className="p-3">Booking Channel</th>
                        <th className="p-3 text-right">Instant Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {activeGuests.map((g, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition">
                          <td className="p-3">
                            <p className="font-medium text-white">{g.name}</p>
                            <p className="text-slate-400 font-mono text-[11px]">{g.phone}</p>
                          </td>
                          <td className="p-3 font-medium text-slate-300">{g.room}</td>
                          <td className="p-3 text-slate-400">
                            {formatDate(g.checkIn)} ➔ {formatDate(g.checkOut)}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-medium">
                              {g.channel}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {onBookCabForGuest && (
                              <button
                                type="button"
                                onClick={() =>
                                  onBookCabForGuest({
                                    tenantKey: t.tenantKey,
                                    guestName: g.name,
                                    guestPhone: g.phone !== "No phone" ? g.phone : undefined,
                                    pickup: t.location || t.homestayName,
                                  })
                                }
                                className="px-3 py-1.5 rounded-lg bg-[#1E7E4B] hover:bg-[#259A5C] text-white font-medium text-xs transition"
                              >
                                Book Cab for Guest
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl border border-slate-800 bg-slate-900/30 text-slate-500">
                  No guest bookings currently imported for this homestay. Check that their iCal link is configured.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TRIPS / CAB REQUESTS */}
          {tab === "trips" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h4 className="text-sm font-semibold text-white">Homestay Cab Requests History</h4>
                  <p className="text-[11px] text-slate-400">All trips requested by or booked for this homestay.</p>
                </div>
                {onOpenCabRequests && (
                  <button
                    type="button"
                    onClick={() => onOpenCabRequests(t.tenantKey)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs transition"
                  >
                    View in Cab Requests Desk
                  </button>
                )}
              </div>

              {trips.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-slate-400 font-medium text-xs">
                      <tr>
                        <th className="p-3">Reference & Guest</th>
                        <th className="p-3">Route (Pickup ➔ Drop)</th>
                        <th className="p-3">Pickup Date</th>
                        <th className="p-3">Driver</th>
                        <th className="p-3">Agreed Fare</th>
                        <th className="p-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {trips.map((tr: Any, idx: number) => (
                        <tr key={tr.id || tr.reference || idx} className="hover:bg-slate-900/40 transition">
                          <td className="p-3">
                            <span className="font-mono font-bold text-white block">#{tr.reference || tr.id}</span>
                            <span className="text-slate-400 text-[11px]">{tr.guestName}</span>
                          </td>
                          <td className="p-3 font-semibold text-slate-200">
                            {tr.pickup} ➔ {tr.destination}
                          </td>
                          <td className="p-3 text-slate-400">
                            {formatDate(tr.date)} • {tr.time}
                          </td>
                          <td className="p-3 text-slate-300">
                            {tr.assignedDriverName || tr.driverName || <span className="text-slate-500">Unassigned</span>}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-400">
                            {tr.agreedFare ? inr(tr.agreedFare) : "—"}
                          </td>
                          <td className="p-3 text-right">
                            <Badge tone={statusTone(tr.status)}>{tr.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl border border-slate-800 bg-slate-900/30 text-slate-500">
                  No cab requests recorded for this homestay yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ROOMS */}
          {tab === "rooms" && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h4 className="text-sm font-bold text-white">Rooms & Inventory</h4>
                <p className="text-[11px] text-slate-400">Listing rooms configured by the host.</p>
              </div>

              {rooms.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {rooms.map((rm: Any, i: number) => (
                    <div key={rm.id || i} className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 space-y-1.5">
                      <span className="font-bold text-white text-sm block">{rm.name}</span>
                      <p className="text-xs text-slate-400">Type: {rm.type || "Room"} • Capacity: {rm.capacity || 2} Guests</p>
                      <p className="text-xs font-mono font-bold text-emerald-400">₹{rm.price || rm.baseRate || "—"} / night</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl border border-slate-800 bg-slate-900/30 text-slate-500">
                  No rooms configured yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PROFILE */}
          {tab === "profile" && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h4 className="text-sm font-bold text-white">Homestay Property Profile</h4>
                <p className="text-[11px] text-slate-400">Core registration and physical address information.</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1117] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs font-medium text-slate-400">Homestay name</span>
                    <p className="text-sm font-semibold text-white">{homestay.name || t.homestayName}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-400">Owner name</span>
                    <p className="text-sm font-semibold text-white">{homestay.ownerName || t.ownerName || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-400">Phone</span>
                    <p className="text-sm font-mono text-slate-200">{homestay.phone || t.phone || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-400">Address / location</span>
                    <p className="text-sm text-slate-200">{homestay.address || t.location || "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: RAW RECORD EDITOR (FOR EXPERT LOW-LEVEL EDITS) */}
          {tab === "raw" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h4 className="text-sm font-bold text-white">Expert Low-Level Record Editor</h4>
                  <p className="text-[11px] text-slate-400">Directly inspect and mutate raw database entities.</p>
                </div>
                <div className="flex gap-1.5">
                  {COLLECTIONS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setRawKey(k)}
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        rawKey === k ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {COLLECTION_LABELS[k]}
                    </button>
                  ))}
                </div>
              </div>

              {rawList.length ? (
                rawList.map((r, i) => {
                  const id = rid(r);
                  const path = `/stayride/tenants/${key}/${rawKey}/${encodeURIComponent(id)}`;
                  return (
                    <RecordEditor
                      key={id || i}
                      rec={r}
                      title={String(r.name || r.guestName || r.title || r.reference || r.number || id || `#${i + 1}`)}
                      readOnly={!id}
                      onSave={(changes) => adminApi(path, { method: "PATCH", body: changes, demo })}
                      onDelete={() => adminApi(path, { method: "DELETE", demo })}
                      onChanged={reload}
                    />
                  );
                })
              ) : (
                <Empty>No raw records in {rawKey}.</Empty>
              )}
            </div>
          )}
        </div>
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
    <div className="rounded-xl border border-slate-800 bg-[#0D1117] p-3 space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className="text-left text-sm font-semibold text-white hover:text-emerald-300" onClick={() => setOpen(!open)}>
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
function AddDriverModal({ demo, initialDriver, onClose, onAdded }: { demo: boolean; initialDriver?: Any | null; onClose: () => void; onAdded: () => void }) {
  useEditLock(true);
  const isEditing = Boolean(initialDriver);
  const [name, setName] = useState(initialDriver?.name || "");
  const [phone, setPhone] = useState(initialDriver?.phone || "");
  const [email, setEmail] = useState(initialDriver?.email || "");
  const [vehicleType, setVehicleType] = useState(initialDriver?.vehicle?.type || "SUV");
  const [model, setModel] = useState(initialDriver?.vehicle?.model || "");
  const [plate, setPlate] = useState(initialDriver?.vehicle?.plate || "");
  const [seats, setSeats] = useState(String(initialDriver?.vehicle?.seats || "6"));
  const [area, setArea] = useState(initialDriver?.vehicle?.area || "Darjeeling");
  const [driverCategory, setDriverCategory] = useState<"INDIVIDUAL" | "UNION">(
    initialDriver?.driverCategory === "UNION" || initialDriver?.vehicle?.type === "Fleet" || initialDriver?.vehicle?.plate === "UNION-FLEET" || initialDriver?.unionName
      ? "UNION"
      : "INDIVIDUAL"
  );
  const [unionName, setUnionName] = useState(initialDriver?.unionName || (initialDriver?.vehicle?.type === "Fleet" ? initialDriver?.vehicle?.model : "") || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (!name.trim()) return setErr("Driver name is required.");
    if (cleanPhone.length !== 10) return setErr("Valid 10-digit mobile number is required.");
    if (driverCategory === "INDIVIDUAL" && !plate.trim()) return setErr("Vehicle registration plate is required.");
    if (driverCategory === "UNION" && !unionName.trim()) return setErr("Union name is required.");

    setBusy(true);
    try {
      await adminApi("/stayride/drivers", {
        method: "POST",
        body: {
          name: name.trim(),
          phone: cleanPhone,
          email: email.trim() || undefined,
          vehicleType: driverCategory === "UNION" ? "Fleet" : vehicleType,
          model: (driverCategory === "UNION" ? unionName.trim() : model.trim()) || undefined,
          plate: (driverCategory === "UNION" ? "UNION-FLEET" : plate.trim().toUpperCase()) || undefined,
          seats: Number(seats) || undefined,
          area: area.trim(),
          driverCategory,
          unionName: driverCategory === "UNION" ? unionName.trim() : undefined,
        },
        demo,
      });
      onAdded();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Failed to save driver.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">{isEditing ? `Edit Driver: ${initialDriver?.name}` : "Add New Platform Driver"}</h3>
            <p className="text-slate-400">{isEditing ? "Update driver credentials, vehicle fleet, or taxi syndicate affiliation." : "Create an active driver account directly from the admin desk."}</p>
          </div>
          <button type="button" className="text-slate-400 hover:text-white text-lg font-bold" onClick={onClose}>✕</button>
        </div>

        {err && <div className="rounded-lg bg-red-950/80 border border-red-800 p-2 text-red-300 font-semibold">{err}</div>}

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${driverCategory === "INDIVIDUAL" ? "border-[#2EA043] bg-[#1E7E4B]/15 text-emerald-300 font-medium" : "border-slate-800 bg-[#0D1117] text-slate-400 hover:text-slate-200"}`}
              onClick={() => setDriverCategory("INDIVIDUAL")}
            >
              Independent driver
            </button>
            <button
              type="button"
              className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${driverCategory === "UNION" ? "border-[#2EA043] bg-[#1E7E4B]/15 text-emerald-300 font-medium" : "border-slate-800 bg-[#0D1117] text-slate-400 hover:text-slate-200"}`}
              onClick={() => setDriverCategory("UNION")}
            >
              Taxi union fleet
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1 font-semibold">{driverCategory === "UNION" ? "Contact Person / Operator Name *" : "Driver Full Name *"}</label>
              <input className={`${input} w-full`} required placeholder="e.g. Pemba Sherpa" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-semibold">10-Digit WhatsApp Mobile *</label>
              <input className={`${input} w-full`} required placeholder="e.g. 9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isEditing} />
            </div>
          </div>

          {driverCategory === "UNION" ? (
            <div>
              <label className="text-slate-400 block mb-1 font-semibold">Taxi Union / Stand / Syndicate Name *</label>
              <input className={`${input} w-full`} required placeholder="e.g. Guru Fleet Service or Darjeeling Motor Syndicate" value={unionName} onChange={(e) => setUnionName(e.target.value)} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Vehicle Class</label>
                <select className={`${input} w-full`} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                  <option value="SUV">SUV (Standard)</option>
                  <option value="Sedan">Sedan</option>
                  <option value="7-seater">7-Seater Premium</option>
                  <option value="9-seater">9-Seater Maxi</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Vehicle Model</label>
                <input className={`${input} w-full`} placeholder="e.g. Bolero, Innova" value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Plate Number *</label>
                <input className={`${input} w-full`} required placeholder="e.g. WB 74 AB 1234" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1 font-semibold">Operating Base Area</label>
              <select className={`${input} w-full`} value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="Darjeeling">Darjeeling</option>
                <option value="Kalimpong">Kalimpong</option>
                <option value="Kurseong">Kurseong</option>
                <option value="Siliguri">Siliguri</option>
                <option value="Gangtok">Gangtok</option>
                <option value="Mirik">Mirik</option>
                <option value="Pelling">Pelling</option>
                <option value="Ravangla">Ravangla</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-semibold">Email (Optional)</label>
              <input className={`${input} w-full`} type="email" placeholder="driver@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button type="button" className={btn.ghost} onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className={btn.primary} disabled={busy}>{busy ? "Saving..." : isEditing ? "Save Changes" : "Register Driver"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DriversTab({ demo }: TabProps) {
  const [status, setStatus] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "INDIVIDUAL" | "UNION">("ALL");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Any | null>(null);
  const { data, error, loading, reload, updatedAt } = useLoad(
    () => adminApi("/stayride/drivers", { demo, query: { status, q, search: q, ...pq(page) } }).then(toPage),
    [demo, status, q, page],
    true
  );

  const isUnionDriver = (d: Any) =>
    d.driverCategory === "UNION" ||
    d.vehicle?.type === "Fleet" ||
    d.vehicle?.plate === "UNION-FLEET" ||
    Boolean(d.unionName);

  const rawItems = data?.items || [];
  const items = categoryFilter === "ALL"
    ? rawItems
    : rawItems.filter((d) => (categoryFilter === "UNION" ? isUnionDriver(d) : !isUnionDriver(d)));

  function setDriverStatus(d: Any, next: "ACTIVE" | "PENDING_APPROVAL" | "BLOCKED") {
    let reason = "";
    if (next === "BLOCKED") {
      const r = ask(`Reason for blocking driver ${d.name}:`);
      if (!r) return;
      reason = r;
    } else if (!window.confirm(`${next === "ACTIVE" ? "Approve" : "Set to pending"} driver ${d.name}?`)) return;
    act(() => adminApi(`/stayride/drivers/${rid(d)}/status`, { method: "PATCH", body: { status: next, reason }, demo }), reload);
  }

  function deleteDriver(d: Any) {
    if (!window.confirm(`Permanently delete driver "${d.name}" (${d.phone || "No phone"})?\n\nThis will release any unstarted trips, reject pending quotes, and permanently remove the driver account. This cannot be undone.`)) return;
    act(() => adminApi(`/stayride/drivers/${rid(d)}?hard=true`, { method: "DELETE", demo }), reload);
  }

  return (
    <Panel
      title="Drivers"
      subtitle="Fleet & network drivers. Approve verified drivers, categorize taxi syndicates vs independent drivers, and manage credentials."
      onRefresh={reload}
      error={error}
      loading={loading}
      updatedAt={updatedAt}
      right={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 flex items-center gap-1 shadow-sm shrink-0"
            onClick={() => setShowAdd(true)}
          >
            + Add Driver
          </button>
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
        </div>
      }
    >
      {showAdd && <AddDriverModal demo={demo} onClose={() => setShowAdd(false)} onAdded={reload} />}
      {editingDriver && <AddDriverModal demo={demo} initialDriver={editingDriver} onClose={() => setEditingDriver(null)} onAdded={reload} />}

      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <span className="text-xs font-semibold text-slate-400">Category:</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${categoryFilter === "ALL" ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-white"}`}
          >
            All Categories ({rawItems.length})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("INDIVIDUAL")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${categoryFilter === "INDIVIDUAL" ? "bg-emerald-950 border border-emerald-700/60 text-emerald-300 font-bold" : "text-slate-400 hover:text-white"}`}
          >
            Independent Network
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("UNION")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${categoryFilter === "UNION" ? "bg-slate-800 border border-slate-700 text-white font-medium" : "text-slate-400 hover:text-white"}`}
          >
            Taxi Syndicate / Union
          </button>
        </div>
      </div>

      {data &&
        (items.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 font-medium text-xs">
                <tr>
                  <th className="p-3">Driver &amp; Category</th>
                  <th className="p-3">Vehicle Details</th>
                  <th className="p-3">Rating</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((d) => (
                  <tr key={rid(d)} className="hover:bg-slate-900/40 transition">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-white">{d.name}</p>
                        {d.deletedAt && <Badge tone="red">deleted</Badge>}
                        {isUnionDriver(d) ? (
                          <span className="rounded-md bg-slate-800/80 text-slate-200 border border-slate-700/60 px-2 py-0.5 text-[11px] font-medium">
                            Union: {d.unionName || (d.vehicle?.type === "Fleet" ? d.vehicle?.model : "") || "Taxi Syndicate"}
                          </span>
                        ) : (
                          <span className="rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium">
                            Independent Driver
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">{d.email}</p>
                      <p className="text-slate-500 text-[11px] font-mono">{d.phone || "No phone"}</p>
                    </td>
                    <td className="p-3 text-slate-300">
                      {d.vehicle ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-slate-800 px-2 py-0.5 font-medium text-slate-200 border border-slate-700/80">
                            {d.vehicle.type || ""} {d.vehicle.model || ""}
                          </span>
                          <span className="rounded-md bg-[#0D1117] px-1.5 py-0.5 font-mono text-[11px] text-amber-300 border border-amber-900/40">
                            {d.vehicle.plate || "—"}
                          </span>
                          <span className="rounded-md bg-[#0D1117] px-1.5 py-0.5 text-[11px] text-slate-400 border border-slate-800">
                            {d.vehicle.seats ?? "—"} seats
                          </span>
                          {d.vehicle.area && (
                            <span className="rounded-md bg-slate-800/40 px-1.5 py-0.5 text-[11px] text-slate-300 border border-slate-700/40">
                              {d.vehicle.area}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-300">{ratingText(d)}</td>
                    <td className="p-3">
                      {statusBadge(d.accountStatus)}
                      {d.statusReason && <p className="mt-1 text-[10px] text-amber-400/90 font-mono">Reason: {d.statusReason}</p>}
                    </td>
                    <td className="p-3 text-slate-400 whitespace-nowrap">{dt(d.createdAt)}</td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      {d.deletedAt ? (
                        <span className="text-[11px] text-slate-500">Deleted account</span>
                      ) : (
                        <>
                          {d.accountStatus !== "ACTIVE" && <button className={btn.ok} onClick={() => setDriverStatus(d, "ACTIVE")}>Approve</button>}
                          {d.accountStatus !== "BLOCKED" && <button className={btn.danger} onClick={() => setDriverStatus(d, "BLOCKED")}>Block</button>}
                          {d.accountStatus !== "PENDING_APPROVAL" && <button className={btn.ghost} onClick={() => setDriverStatus(d, "PENDING_APPROVAL")}>Set pending</button>}
                          <button
                            type="button"
                            className={btn.ghost}
                            onClick={() => setEditingDriver(d)}
                            title="Edit driver category, taxi union, or vehicle details"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded border border-red-800 bg-red-950/60 px-2 py-1 text-red-300 hover:bg-red-900/80 hover:text-white transition"
                            onClick={() => deleteDriver(d)}
                            title="Permanently delete driver from platform"
                          >
                            Delete
                          </button>
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
  stage_open: { label: "1. Open & Bidding", query: { status: "PENDING_REVIEW,FINDING_DRIVER,QUOTE_RECEIVED" } },
  stage_awaiting: { label: "2. Awaiting Advance", query: { status: "AWAITING_ADVANCE_PAYMENT" } },
  stage_active: { label: "3. Live & In Transit", query: { status: "CONFIRMED,EN_ROUTE_PICKUP,ARRIVED_HOMESTAY,TRIP_STARTED" } },
  stage_completed: { label: "4. Completed", query: { status: "COMPLETED" } },
  needs: { label: "Needs driver", query: { needsReassignment: "true" }, keep: (c) => !!c.needsReassignment },
  claims: { label: "Guest payment claims", query: { claim: "pending" } },
  nopin: { label: "No-PIN review", query: { noPin: "review" } },
  refunds: { label: "Refunds pending", query: { refundStatus: "PENDING" } },
  unmatched: { label: "Unmatched to refund", query: { unmatched: "true" } },
  cancelled: { label: "Cancelled", query: { status: "CANCELLED" } },
  all: { label: "All requests", query: {} },
};

const statusTone = (s: string) =>
  s === "COMPLETED" || s === "CONFIRMED" ? "green" :
  s === "CANCELLED" ? "red" :
  s === "TRIP_STARTED" || s === "EN_ROUTE_PICKUP" || s === "ARRIVED_HOMESTAY" ? "blue" :
  s === "EXPIRED" ? "slate" :
  s === "AWAITING_ADVANCE_PAYMENT" ? "amber" : "cyan";

function getSmartInitialDateTime(): { date: string; time: string } {
  const now = new Date();
  const target = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  const dd = String(target.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  let hours = target.getHours();
  let minutes = target.getMinutes();
  if (minutes > 30) {
    hours += 1;
    minutes = 0;
  } else if (minutes > 0) {
    minutes = 30;
  }
  const period = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  const timeStr = `${String(h12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
  return { date: dateStr, time: timeStr };
}

function AdminBookCabModal({
  demo,
  initialTenantKey,
  initialGuestName,
  initialGuestPhone,
  initialPickup,
  onClose,
  onSuccess,
}: {
  demo: boolean;
  initialTenantKey?: string;
  initialGuestName?: string;
  initialGuestPhone?: string;
  initialPickup?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const initialDt = useMemo(() => getSmartInitialDateTime(), []);
  const [tenantKey, setTenantKey] = useState(initialTenantKey || "");
  const [guestName, setGuestName] = useState(initialGuestName || "");
  const [guestPhone, setGuestPhone] = useState(initialGuestPhone || "");
  const [pickup, setPickup] = useState(initialPickup || "");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(initialDt.date);
  const [time, setTime] = useState(initialDt.time);
  const [tripType, setTripType] = useState<"oneway" | "roundtrip" | "multiday">("oneway");
  const [tourDays, setTourDays] = useState(3);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [returnTime, setReturnTime] = useState("05:00 PM");
  const [passengers, setPassengers] = useState(1);
  const [vehicleType, setVehicleType] = useState("SUV");
  const [notes, setNotes] = useState("");
  const [guestBudget, setGuestBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function calcReturnYmd(startDateYmd: string, days: number): string {
    if (!startDateYmd) return startDateYmd;
    const [y, m, d] = startDateYmd.split("-").map(Number);
    const dtObj = new Date(y, m - 1, d);
    dtObj.setDate(dtObj.getDate() + Math.max(0, days - 1));
    const ry = dtObj.getFullYear();
    const rm = String(dtObj.getMonth() + 1).padStart(2, "0");
    const rd = String(dtObj.getDate()).padStart(2, "0");
    return `${ry}-${rm}-${rd}`;
  }

  // Dynamically load homestays from the database
  const { data: tenantsData } = useLoad(
    () => adminApi("/stayride/tenants", { demo, query: { limit: 100 } }).then(toPage),
    [demo]
  );
  const homestays = tenantsData?.items || [];

  // When a homestay is selected, dynamically load its in-house guests from calendar sync
  const { data: tenantDetails } = useLoad(
    () => {
      if (!tenantKey) return Promise.resolve(null);
      return adminApi(`/stayride/tenants/${encodeURIComponent(tenantKey)}/data`, { demo })
        .then((r) => (r?.data ?? r) as Any)
        .catch(() => null);
    },
    [tenantKey, demo]
  );

  const inHouseGuests: { name: string; phone: string; room?: string }[] = [];
  if (tenantDetails) {
    const rawGuests = Array.isArray(tenantDetails.guests) ? tenantDetails.guests : [];
    const rawBookings = Array.isArray(tenantDetails.bookings) ? tenantDetails.bookings : [];
    const pool = rawGuests.length > 0 ? rawGuests : rawBookings;
    for (const g of pool) {
      const gName = g.name || g.guestName;
      const gPhone = g.phone;
      if (gName) {
        inHouseGuests.push({
          name: gName,
          phone: gPhone || "",
          room: g.room || g.roomName || "",
        });
      }
    }
  }

  // When admin selects a homestay, auto-set pickup to property address
  const handleSelectHomestay = (keyVal: string) => {
    setTenantKey(keyVal);
    if (!keyVal) {
      if (pickup === initialPickup) setPickup("");
      return;
    }
    const chosen = homestays.find((h) => h.tenantKey === keyVal || h.tenantId === keyVal || h.email === keyVal);
    if (chosen) {
      const loc = chosen.location || chosen.homestayName || "";
      if (loc) setPickup(loc);
    }
  };

  const DESTINATION_SUGGESTIONS = [
    "Bagdogra Airport (IXB)",
    "NJP Railway Station",
    "Tiger Hill Sunrise Point",
    "Darjeeling Mall Road",
    "Mirik Lake",
    "Lamahatta Eco Park",
    "Courtyard by Marriott Siliguri",
    "Kalimpong Town",
    "Gangtok (Sikkim)",
  ];

  const QUICK_TIMES = ["03:30 AM", "06:00 AM", "08:30 AM", "10:00 AM", "12:00 PM", "02:00 PM", "04:30 PM", "07:00 PM"];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestPhone.trim()) {
      setErr("Guest name and WhatsApp phone number are required.");
      return;
    }
    if (!pickup.trim() || !destination.trim()) {
      setErr("Pickup and destination locations are required.");
      return;
    }
    // Prevent submitting rides with past pickup times
    try {
      const [y, m, d] = date.split("-").map(Number);
      const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (match) {
        let hh = parseInt(match[1], 10);
        const mm = parseInt(match[2], 10);
        const isPm = match[3].toUpperCase() === "PM";
        if (isPm && hh < 12) hh += 12;
        if (!isPm && hh === 12) hh = 0;
        const pickupDateObj = new Date(y, m - 1, d, hh, mm);
        if (pickupDateObj.getTime() < Date.now() - 5 * 60 * 1000) {
          setErr("Pickup date and time cannot be in the past. Please select a future time.");
          return;
        }
      }
    } catch {}
    setBusy(true);
    setErr("");
    try {
      await adminApi("/cab-requests/create", {
        method: "POST",
        demo,
        body: {
          tenantKey: tenantKey.trim(),
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          pickup: pickup.trim(),
          destination: destination.trim(),
          date,
          time,
          passengers,
          vehicleType,
          isRoundTrip: isRoundTrip || tripType === "multiday",
          returnDate: (isRoundTrip || tripType === "multiday") ? returnDate : undefined,
          returnTime: (isRoundTrip || tripType === "multiday") ? returnTime : undefined,
          notes: (
            (tripType === "multiday" ? `[Multi-Day Tour: ${tourDays} Days Package] ` : "") +
            notes.trim()
          ).trim(),
          guestBudget: guestBudget ? Number(guestBudget) : null,
        },
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Failed to dispatch cab request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-6 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-800/80 bg-[#121820] shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#121820]">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-semibold text-white">Book Cab on Behalf of Guest</h3>
              <Badge tone={demo ? "amber" : "green"}>{demo ? "Demo" : "Production"}</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Direct dispatch from admin desk • Homestay host attribution, mountain route &amp; schedule
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {err && (
            <div className="rounded-lg bg-rose-950/40 border border-rose-800/50 px-3.5 py-2.5 text-rose-300 font-medium">
              {err}
            </div>
          )}

          {/* 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* LEFT COLUMN: Attribution, Guest & Vehicle */}
            <div className="space-y-4">
              <div className="border-b border-slate-800/80 pb-2">
                <h4 className="text-xs font-semibold text-white">1. Attribution &amp; Guest</h4>
                <p className="text-[11px] text-slate-400">Homestay host, guest identity, and vehicle tier.</p>
              </div>

              {/* Homestay Attribution */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300 block">
                  Homestay Host Attribution
                </label>
                <select
                  className="w-full h-9 rounded-lg border border-slate-800 bg-[#0D1117] px-3 text-xs text-white focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043]/30 transition-colors cursor-pointer"
                  value={tenantKey}
                  onChange={(e) => handleSelectHomestay(e.target.value)}
                >
                  <option value="">Platform Direct Booking (No Homestay Host)</option>
                  {homestays.map((h) => (
                    <option key={h.tenantKey || h.tenantId} value={h.tenantKey || h.tenantId}>
                      {h.homestayName || h.tenantKey} ({h.location || "Darjeeling"})
                    </option>
                  ))}
                </select>

                {/* Auto-detected in-house guests */}
                {tenantKey && inHouseGuests.length > 0 && (
                  <div className="p-2.5 rounded-lg border border-emerald-900/30 bg-emerald-950/20 space-y-1">
                    <div className="flex items-center justify-between text-emerald-300 text-[11px]">
                      <span>In-House Guests ({inHouseGuests.length})</span>
                      <span className="text-emerald-400/80">Auto-fill details:</span>
                    </div>
                    <select
                      className="w-full h-8 rounded border border-slate-800 bg-[#0D1117] px-2 text-xs text-white focus:outline-none cursor-pointer"
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        if (idx >= 0 && inHouseGuests[idx]) {
                          setGuestName(inHouseGuests[idx].name);
                          if (inHouseGuests[idx].phone) setGuestPhone(inHouseGuests[idx].phone);
                        }
                      }}
                      defaultValue="-1"
                    >
                      <option value="-1">-- Pick guest from booking calendar --</option>
                      {inHouseGuests.map((g, idx) => (
                        <option key={idx} value={idx}>
                          {g.name} {g.phone ? `(${g.phone})` : ""} {g.room ? `• ${g.room}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Guest Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Guest Full Name *
                  </label>
                  <input
                    className="w-full h-9 rounded-lg border border-slate-800 bg-[#0D1117] px-3 text-xs text-white placeholder:text-slate-500 focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043]/30 transition-colors"
                    required
                    placeholder="e.g. Ananya Sharma"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    WhatsApp Phone *
                  </label>
                  <input
                    className="w-full h-9 rounded-lg border border-slate-800 bg-[#0D1117] px-3 text-xs text-white font-mono placeholder:text-slate-500 focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043]/30 transition-colors"
                    required
                    placeholder="+91 98000 12345"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Vehicle Tier & Passenger Count */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Vehicle Tier
                  </label>
                  <select
                    className="w-full h-9 rounded-lg border border-slate-800 bg-[#0D1117] px-3 text-xs text-white focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043]/30 transition-colors cursor-pointer"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                  >
                    <option value="SUV">SUV (Innova, Bolero, Scorpio)</option>
                    <option value="Sedan">Sedan (Dzire, Etios)</option>
                    <option value="7-seater">7-seater (Innova / Ertiga)</option>
                    <option value="9-seater">9-seater (Cruiser / Maxx)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Passengers
                  </label>
                  <div className="flex items-center h-9 w-full rounded-lg border border-slate-800 bg-[#0D1117] p-1">
                    <button
                      type="button"
                      onClick={() => setPassengers(Math.max(1, passengers - 1))}
                      className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-medium tabular-nums text-white text-xs">
                      {passengers} Pax
                    </span>
                    <button
                      type="button"
                      onClick={() => setPassengers(Math.min(20, passengers + 1))}
                      className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes & Target Budget */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Target Budget (₹ Optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full h-9 rounded-lg border border-slate-800 bg-[#0D1117] px-3 text-xs text-white font-mono placeholder:text-slate-500 focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043]/30 transition-colors"
                    placeholder="e.g. 3500"
                    value={guestBudget}
                    onChange={(e) => setGuestBudget(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Flight / Special Notes
                  </label>
                  <input
                    className="w-full h-9 rounded-lg border border-slate-800 bg-[#0D1117] px-3 text-xs text-white placeholder:text-slate-500 focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043]/30 transition-colors"
                    placeholder="e.g. Arrives 11:30 AM, 4 bags"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Route, Schedule & Tour Logistics */}
            <div className="space-y-4">
              <div className="border-b border-slate-800/80 pb-2">
                <h4 className="text-xs font-semibold text-white">2. Route &amp; Schedule</h4>
                <p className="text-[11px] text-slate-400">Pickup location, hill destinations, and timing.</p>
              </div>

              {/* Pickup & Destination */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Pickup Location *
                  </label>
                  <input
                    className="w-full h-9 rounded-lg border border-slate-800 bg-[#0D1117] px-3 text-xs text-white placeholder:text-slate-500 focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043]/30 transition-colors"
                    required
                    placeholder="e.g. Courtyard by Marriott Siliguri or Homestay"
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300 block">
                      Destination / Tour Stops *
                    </label>
                    <select
                      className="bg-transparent text-[11px] text-emerald-400 hover:text-emerald-300 focus:outline-none cursor-pointer"
                      onChange={(e) => {
                        if (e.target.value) {
                          setDestination(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Popular corridors...</option>
                      {DESTINATION_SUGGESTIONS.map((s) => (
                        <option key={s} value={s} className="bg-[#121820] text-slate-200">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    className="w-full h-9 rounded-lg border border-slate-800 bg-[#0D1117] px-3 text-xs text-white placeholder:text-slate-500 focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043]/30 transition-colors"
                    required
                    placeholder="e.g. Darjeeling Mall Road or Tiger Hill"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </div>

                {/* Compact Corridor Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-slate-500 font-medium mr-0.5">Quick:</span>
                  {DESTINATION_SUGGESTIONS.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDestination(s)}
                      className="px-2 py-0.5 rounded-md bg-[#0D1117] border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] transition-colors cursor-pointer"
                    >
                      {s.split("(")[0].trim()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trip Format Switcher */}
              <div className="pt-2">
                <label className="text-xs font-medium text-slate-300 block mb-1.5">
                  Trip Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTripType("oneway");
                      setIsRoundTrip(false);
                    }}
                    className={`py-2 px-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      tripType === "oneway"
                        ? "border-[#2EA043] bg-[#1E7E4B]/15 text-white"
                        : "border-slate-800/80 bg-[#0D1117] text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <p className="font-medium text-xs">One-Way</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Single drop</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTripType("roundtrip");
                      setIsRoundTrip(true);
                      setReturnDate(date);
                    }}
                    className={`py-2 px-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      tripType === "roundtrip"
                        ? "border-[#2EA043] bg-[#1E7E4B]/15 text-white"
                        : "border-slate-800/80 bg-[#0D1117] text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <p className="font-medium text-xs">Round Trip</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Same-day return</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTripType("multiday");
                      setIsRoundTrip(true);
                      setReturnDate(calcReturnYmd(date, tourDays));
                    }}
                    className={`py-2 px-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      tripType === "multiday"
                        ? "border-[#2EA043] bg-[#1E7E4B]/15 text-white"
                        : "border-slate-800/80 bg-[#0D1117] text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <p className="font-medium text-xs">Multi-Day</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Tour package</p>
                  </button>
                </div>
              </div>

              {/* Schedule (Date & Time) */}
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Departure Date (DD/MM/YYYY) *
                    </label>
                    <DatePickerDDMMYYYY
                      value={date}
                      onChange={(newDate) => {
                        setDate(newDate);
                        if (tripType === "multiday") {
                          setReturnDate(calcReturnYmd(newDate, tourDays));
                        } else if (tripType === "roundtrip") {
                          setReturnDate(newDate);
                        }
                      }}
                    />
                    <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                      {formatDisplayDate(date)}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Departure Time *
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        className="w-24 h-9 rounded-lg border border-slate-800 bg-[#0D1117] px-2.5 text-xs text-white font-mono focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043]/30 transition-colors"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                      <select
                        className="flex-1 h-9 rounded-lg border border-slate-800 bg-[#0D1117] px-2 text-[11px] text-slate-400 focus:border-[#2EA043] focus:outline-none cursor-pointer"
                        onChange={(e) => e.target.value && setTime(e.target.value)}
                        defaultValue=""
                      >
                        <option value="" disabled>Presets...</option>
                        {QUICK_TIMES.map((qt) => (
                          <option key={qt} value={qt} className="bg-[#121820] text-slate-200">{qt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* If Multi-Day: Duration & Schedule Summary */}
                {tripType === "multiday" && (
                  <div className="p-3 rounded-lg border border-slate-800/80 bg-[#0D1117] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300 font-medium">Package Duration:</span>
                      <div className="flex gap-1">
                        {[2, 3, 4, 5, 6, 7].map((dCount) => (
                          <button
                            key={dCount}
                            type="button"
                            onClick={() => {
                              setTourDays(dCount);
                              setReturnDate(calcReturnYmd(date, dCount));
                            }}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                              tourDays === dCount
                                ? "bg-[#1E7E4B] text-white"
                                : "bg-slate-800/60 text-slate-400 hover:text-white"
                            }`}
                          >
                            {dCount}D
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1.5 border-t border-slate-800/60">
                      <span>{formatStrictDDMMYYYY(date)} (Day 1) → {formatStrictDDMMYYYY(returnDate)} (Day {tourDays})</span>
                      <span className="text-slate-500 font-sans">{tourDays - 1} nights</span>
                    </div>
                  </div>
                )}

                {/* If Round Trip: Return date & time */}
                {tripType === "roundtrip" && (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-slate-800/80 bg-[#0D1117]">
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Return Date (DD/MM/YYYY)
                      </label>
                      <DatePickerDDMMYYYY
                        value={returnDate}
                        min={date}
                        onChange={(d) => setReturnDate(d)}
                      />
                      <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                        {formatDisplayDate(returnDate)}
                      </span>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Return Time
                      </label>
                      <input
                        className="w-full h-9 rounded-lg border border-slate-800 bg-[#121820] px-3 text-xs text-white font-mono placeholder:text-slate-500 focus:border-[#2EA043] focus:outline-none focus:ring-1 focus:ring-[#2EA043]/30 transition-colors"
                        value={returnTime}
                        onChange={(e) => setReturnTime(e.target.value)}
                        placeholder="05:00 PM"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800/80">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="font-medium text-slate-300">Advance online: ₹600</span>
              <span className="text-slate-600">•</span>
              <span>Balance cash to driver on drop</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#1E7E4B] hover:bg-[#259A5C] text-white text-xs font-medium transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                disabled={busy}
              >
                {busy ? "Dispatching..." : "Dispatch Request to Drivers"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CabRequestsTab({ demo, initialTenantKey, initialFilter }: TabProps & { initialTenantKey?: string; initialFilter?: string }) {
  const [viewMode, setViewMode] = useState<"board" | "split">("board");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [tenantKey, setTenantKey] = useState(initialTenantKey || "");
  const [tenantQuery, setTenantQuery] = useState(initialTenantKey || "");
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string>("");

  const { data: summaryData, reload: reloadSummary } = useLoad(
    () => adminApi("/stayride/summary", { demo }).then((r) => r.data as Any),
    [demo],
    true
  );
  const cabStats = summaryData?.cab || {};

  // Fetch all active requests so all 4 stages are visible simultaneously on the board!
  const { data, error, loading, reload, updatedAt } = useLoad(async () => {
    const queryParams: Any = {
      tenantKey: tenantQuery || undefined,
      ...pq(page),
    };
    if (stageFilter === "needs") queryParams.needsReassignment = "true";
    if (stageFilter === "claims") queryParams.claim = "pending";
    if (stageFilter === "nopin") queryParams.noPin = "review";
    if (stageFilter === "refunds") queryParams.refundStatus = "PENDING";
    if (stageFilter === "unmatched") queryParams.unmatched = "true";

    const r = toPage(await adminApi("/cab-requests", { demo, query: queryParams }));
    return r;
  }, [demo, stageFilter, tenantQuery, page], true);

  const items = data?.items || [];

  // Categorize requests into 4 lifecycle stages for the multi-stage board
  const stage1Open = items.filter((c) => ["PENDING_REVIEW", "FINDING_DRIVER", "QUOTE_RECEIVED"].includes(c.status));
  const stage2Awaiting = items.filter((c) => c.status === "AWAITING_ADVANCE_PAYMENT" || (c.status === "CONFIRMED" && !c.advancePaid));
  const stage3Active = items.filter((c) => ["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED"].includes(c.status) && c.advancePaid);
  const stage4Completed = items.filter((c) => c.status === "COMPLETED");

  // Auto-select first item when items load if none selected
  useEffect(() => {
    if (items.length > 0 && (!selectedId || !items.some((c) => rid(c) === selectedId))) {
      setSelectedId(rid(items[0]));
    }
  }, [items, selectedId]);

  const selectedRequest = items.find((c) => rid(c) === selectedId) || items[0] || null;

  const handleRefresh = () => {
    reload();
    reloadSummary();
  };

  const openInspector = (c: Any) => {
    setSelectedId(rid(c));
    setViewMode("split");
  };

  return (
    <Panel
      title="Cab Requests"
      subtitle="Pipeline board, driver dispatch desk, transit tracking, and payment verification."
      onRefresh={handleRefresh}
      error={error}
      loading={loading}
      updatedAt={updatedAt}
      right={
        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#0D1117] border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                viewMode === "board"
                  ? "bg-[#1E7E4B] text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Pipeline Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                viewMode === "split"
                  ? "bg-[#1E7E4B] text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Focus Inspector
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E7E4B] hover:bg-[#259A5C] text-white font-medium text-xs transition cursor-pointer"
          >
            <span>+ Book Cab for Guest</span>
          </button>
        </div>
      }
    >
      {createOpen && (
        <AdminBookCabModal
          demo={demo}
          initialTenantKey={tenantKey || tenantQuery}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => handleRefresh()}
        />
      )}

      {/* TOP ACTION REQUIRED DECK */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#0D1117] border border-slate-800">
        <span className="text-xs font-medium text-slate-400 mr-1 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Exceptions:
        </span>
        <button
          type="button"
          onClick={() => { setStageFilter(stageFilter === "needs" ? "all" : "needs"); setPage(0); }}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
            stageFilter === "needs"
              ? "bg-red-500/20 text-red-300 border border-red-500/40"
              : (cabStats?.needsReassignment > 0
                ? "bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20"
                : "bg-slate-800/60 text-slate-400 hover:text-white")
          }`}
        >
          <span>Needs Driver</span>
          <span className="px-1.5 py-0.2 rounded-md bg-red-900/40 text-[10px] font-mono">{cabStats?.needsReassignment ?? 0}</span>
        </button>
        <button
          type="button"
          onClick={() => { setStageFilter(stageFilter === "claims" ? "all" : "claims"); setPage(0); }}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
            stageFilter === "claims"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              : (cabStats?.pendingClaims > 0
                ? "bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20"
                : "bg-slate-800/60 text-slate-400 hover:text-white")
          }`}
        >
          <span>Guest Payment Claims</span>
          <span className="px-1.5 py-0.2 rounded-md bg-amber-900/40 text-[10px] font-mono">{cabStats?.pendingClaims ?? 0}</span>
        </button>
        <button
          type="button"
          onClick={() => { setStageFilter(stageFilter === "nopin" ? "all" : "nopin"); setPage(0); }}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
            stageFilter === "nopin"
              ? "bg-amber-600 text-white shadow-sm ring-1 ring-amber-400"
              : (cabStats?.noPinToReview > 0
                ? "bg-amber-950/80 text-amber-300 border border-amber-800/80 hover:bg-amber-900/60"
                : "bg-slate-800/60 text-slate-400 hover:text-white")
          }`}
        >
          <span>No-PIN Audits</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-900/60 text-[10px] font-mono">{cabStats?.noPinToReview ?? 0}</span>
        </button>
        <button
          type="button"
          onClick={() => { setStageFilter(stageFilter === "refunds" ? "all" : "refunds"); setPage(0); }}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
            stageFilter === "refunds"
              ? "bg-purple-600 text-white shadow-sm ring-1 ring-purple-400"
              : (cabStats?.refundsCount > 0
                ? "bg-purple-950/80 text-purple-300 border border-purple-800/80 hover:bg-purple-900/60"
                : "bg-slate-800/60 text-slate-400 hover:text-white")
          }`}
        >
          <span>Pending Refunds</span>
          <span className="px-1.5 py-0.2 rounded-full bg-purple-900/60 text-[10px] font-mono">{cabStats?.refundsCount ?? 0}</span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          {stageFilter !== "all" && (
            <button
              type="button"
              onClick={() => { setStageFilter("all"); setPage(0); }}
              className="text-xs text-blue-400 hover:underline"
            >
              Clear Filter
            </button>
          )}
          <form onSubmit={(e) => { e.preventDefault(); setPage(0); setTenantQuery(tenantKey.trim().toLowerCase()); }} className="flex gap-2">
            <input className="h-8 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white" placeholder="Filter by host email..." value={tenantKey} onChange={(e) => setTenantKey(e.target.value)} />
            <button className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold">Filter</button>
          </form>
        </div>
      </div>

      {/* ZERO-LAYOUT-SHIFT STABLE CONTAINER (min-h-[550px]) */}
      <div className="min-h-[550px] transition-all">
        {loading && !data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 animate-pulse pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-96 rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-3">
                <div className="h-4 w-28 bg-slate-800 rounded" />
                <div className="h-20 bg-slate-850 rounded-lg" />
                <div className="h-20 bg-slate-850 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* =============================================================== */}
        {/* VIEW 1: LIVE 4-STAGE PIPELINE BOARD (SEE ALL RIDES ACROSS STAGES)*/}
        {/* =============================================================== */}
        {viewMode === "board" && data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 pt-1 items-start">
            {/* COLUMN 1: OPEN & BIDDING */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="font-medium text-white text-xs">1. Open &amp; Bidding</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px] font-bold">
                  {stage1Open.length}
                </span>
              </div>
              <div className="space-y-2 max-h-[720px] overflow-y-auto pr-0.5">
                {stage1Open.map((c) => (
                  <PipelineCard key={rid(c)} c={c} onInspect={() => openInspector(c)} />
                ))}
                {stage1Open.length === 0 && (
                  <p className="p-4 text-center text-xs text-slate-500">No open bidding requests</p>
                )}
              </div>
            </div>

            {/* COLUMN 2: AWAITING ADVANCE */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="font-bold text-white text-xs">2. Awaiting Advance</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono text-[11px] font-bold">
                  {stage2Awaiting.length}
                </span>
              </div>
              <div className="space-y-2 max-h-[720px] overflow-y-auto pr-0.5">
                {stage2Awaiting.map((c) => (
                  <PipelineCard key={rid(c)} c={c} onInspect={() => openInspector(c)} />
                ))}
                {stage2Awaiting.length === 0 && (
                  <p className="p-4 text-center text-xs text-slate-500">No pending advance payments</p>
                )}
              </div>
            </div>

            {/* COLUMN 3: LIVE & IN TRANSIT */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="font-bold text-white text-xs">3. Live in Transit</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-mono text-[11px] font-bold">
                  {stage3Active.length}
                </span>
              </div>
              <div className="space-y-2 max-h-[720px] overflow-y-auto pr-0.5">
                {stage3Active.map((c) => (
                  <PipelineCard key={rid(c)} c={c} onInspect={() => openInspector(c)} />
                ))}
                {stage3Active.length === 0 && (
                  <p className="p-4 text-center text-xs text-slate-500">No active rides on road</p>
                )}
              </div>
            </div>

            {/* COLUMN 4: COMPLETED TRIPS */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="font-bold text-white text-xs">4. Completed Trips</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px] font-bold">
                  {stage4Completed.length}
                </span>
              </div>
              <div className="space-y-2 max-h-[720px] overflow-y-auto pr-0.5">
                {stage4Completed.map((c) => (
                  <PipelineCard key={rid(c)} c={c} onInspect={() => openInspector(c)} />
                ))}
                {stage4Completed.length === 0 && (
                  <p className="p-4 text-center text-xs text-slate-500">No completed trips</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* VIEW 2: SPLIT-PANE FOCUSED INSPECTOR VIEW                       */}
        {/* =============================================================== */}
        {viewMode === "split" && data && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start pt-1">
            {/* Left Queue (5 cols) */}
            <div className="lg:col-span-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 pb-1.5 border-b border-slate-800">
                <span className="font-semibold text-slate-300">Request Queue ({items.length})</span>
                <span className="text-[10px] text-slate-500">Select to inspect</span>
              </div>
              <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
                {items.map((c) => {
                  const isSel = selectedId === rid(c);
                  return (
                    <PipelineCard
                      key={rid(c)}
                      c={c}
                      selected={isSel}
                      onInspect={() => setSelectedId(rid(c))}
                    />
                  );
                })}
              </div>
              <Pager page={page} setPage={setPage} total={data?.total ?? null} count={items.length} />
            </div>

            {/* Right Inspector (7 cols, sticky) */}
            <div className="lg:col-span-7 sticky top-4">
              {selectedRequest ? (
                <CabRequestCard
                  key={rid(selectedRequest)}
                  c={selectedRequest}
                  demo={demo}
                  onChanged={handleRefresh}
                />
              ) : (
                <div className="p-12 text-center rounded-2xl border border-slate-800/80 bg-[#0D1117] text-slate-500">
                  <p className="text-sm font-semibold text-slate-300">No request selected</p>
                  <p className="text-xs text-slate-500 mt-1">Select any cab request from the queue to view full route details and admin actions.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function PipelineCard({
  c,
  selected,
  onInspect,
}: {
  c: Any;
  selected?: boolean;
  onInspect: () => void;
}) {
  const claim = c.paymentClaim?.status === "PENDING";
  return (
    <div
      onClick={onInspect}
      className={`p-3 rounded-xl border cursor-pointer transition-all ${
        selected
          ? "bg-[#0D1117] border-[#2EA043] ring-1 ring-[#2EA043]/30"
          : "bg-[#0D1117] border-slate-800/80 hover:border-slate-700 hover:bg-[#121820]"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-xs font-bold text-white">#{c.reference}</span>
        <Badge tone={statusTone(c.status)}>{c.status}</Badge>
      </div>

      <p className="text-xs font-semibold text-slate-200 line-clamp-2">
        {c.pickupLocation?.address || "Pickup"} ➔ {(c.destinations || []).map((d: Any) => d.address).join(" ➔ ") || "Destination"}
      </p>

      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/60 text-[11px] text-slate-400">
        <span className="truncate max-w-[140px]">{c.guestName} ({c.passengers || 1}p)</span>
        <span className="font-mono font-bold text-emerald-400">
          {c.agreedFare ? inr(c.agreedFare) : <span className="text-amber-400 font-normal">Awaiting quote</span>}
        </span>
      </div>

      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
        <span>{formatDate(c.date)} • {c.time}</span>
        <span className="truncate max-w-[120px]">
          {c.assignedDriverName ? `Driver: ${c.assignedDriverName}` : (Array.isArray(c.quotes) && c.quotes.length > 0 ? `${c.quotes.length} quotes` : "No quotes")}
        </span>
      </div>

      {c.needsReassignment && (
        <div className="mt-1.5 text-[11px] font-medium text-red-300 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20">
          Needs Driver Reassignment
        </div>
      )}
      {claim && (
        <div className="mt-1.5 text-[11px] font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
          Guest Claims Paid (UTR: {c.paymentClaim.utr})
        </div>
      )}
    </div>
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
  const claim = canPay && c.paymentClaim?.status === "PENDING" ? c.paymentClaim : null;
  const [busy, setBusy] = useState(false);
  const canVoid = c.status === "CONFIRMED" && c.advancePaid && !c.hostPayoutId && !c.needsReassignment;
  const canCancel = !["COMPLETED", "CANCELLED"].includes(c.status) && !c.hostPayoutId && !c.driverPayoutId;
  const canRefund = (c.status === "CANCELLED" || (c.status === "COMPLETED" && c.noShow)) && c.refundStatus === "PENDING";
  const toReview = c.status === "COMPLETED" && c.completedWithoutPin && !c.noPinReviewedAt;
  const canStart = ["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY"].includes(c.status) && c.advancePaid && !c.needsReassignment;
  const canComplete = c.status === "TRIP_STARTED";
  const canSettleDriver = c.status === "COMPLETED" && c.driverSettlementStatus === "PENDING" && !(c.completedWithoutPin && !c.noPinReviewedAt) && !c.driverPayoutId;

  function voidPayment() {
    const reason = ask(`Reason for voiding payment ${c.advancePaymentId} (${inr(c.advanceAmount)}) on #${c.reference}:`);
    if (reason && window.confirm(`Void the recorded payment of ${inr(c.advanceAmount)}? The request goes back to awaiting payment.`)) post("void-payment", { reason });
  }
  async function rejectClaim() {
    const reason = window.prompt(`Reject the guest's payment claim (UTR ${claim.utr}) on #${c.reference}? Reason shown to the guest (optional):`);
    if (reason === null) return;
    setBusy(true);
    await act(() => adminApi(path("reject-claim"), { method: "POST", body: { reason: reason.trim() }, demo }), onChanged);
    setBusy(false);
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
  function approveRide() {
    if (window.confirm(`Approve #${c.reference}: the ride happened? Its commission and driver share become payable.`)) post("no-pin-review", { decision: "APPROVE" });
  }
  function markNoShow() {
    const reason = ask(`Why is #${c.reference} a no-show?`);
    const refundNote = c.advancePaid && c.advanceAmount > 0 ? ` The advance ${inr(c.advanceAmount)} becomes a pending refund.` : "";
    if (reason && window.confirm(`Mark #${c.reference} as a no-show? No commission or driver share is paid for it.${refundNote}`)) post("no-pin-review", { decision: "NO_SHOW", reason });
  }
  function settleDriver() {
    const due = typeof s.driverShareOfAdvance === "number" ? s.driverShareOfAdvance : undefined;
    const dest = c.assignedDriverPhone ? `(Phone/UPI: ${c.assignedDriverPhone})` : "";
    const reference = ask(`Transfer reference (UTR) for driver ${c.assignedDriverName} ${dest} (due ${inr(due)}):`);
    if (reference && window.confirm(`Record driver settlement of ${inr(due)} to ${c.assignedDriverName} ${dest} with reference ${reference}?`)) post("driver-settled", { reference });
  }

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#121820] p-4 sm:p-5 space-y-4 text-xs">
      {/* 1. TOP HEADER: Reference, Status Badges, Dispatch Source, and Created Timestamp */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm sm:text-base font-bold text-white font-mono tracking-tight">#{c.reference}</span>
          <Badge tone={statusTone(c.status)}>{c.status}</Badge>
          {c.needsReassignment && <Badge tone="red">Needs driver</Badge>}
          {claim && <Badge tone="blue">Guest says paid</Badge>}
          {toReview && <Badge tone="amber">No PIN — to review</Badge>}
          {c.noShow && <Badge tone="red">No-show</Badge>}
          {c.ownFleet && <Badge tone="blue">Own fleet</Badge>}
          {c.dispatched === false && ["PENDING_REVIEW", "FINDING_DRIVER", "QUOTE_RECEIVED"].includes(c.status) && <Badge tone="slate">Held for owner</Badge>}
          {c.refundStatus && c.refundStatus !== "NONE" && <Badge tone={c.refundStatus === "PENDING" ? "amber" : "green"}>Refund {c.refundStatus}</Badge>}
          {c.driverSettlementStatus && c.driverSettlementStatus !== "NONE" && (
            <Badge tone={c.driverSettlementStatus === "PENDING" ? "amber" : "green"}>Driver {c.driverSettlementStatus}</Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <span className="px-2 py-0.5 rounded-md bg-[#0D1117] border border-slate-800 text-slate-300">
            Source: {c.requestSource || "DIRECT"}
          </span>
          <span>Created: {dt(c.createdAt)}</span>
        </div>
      </div>

      {/* 2. OPERATIONAL GRID: Left = Guest, Host, Route & Transit | Right = Financial Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN (7 cols): Operational Specifications */}
        <div className="lg:col-span-7 space-y-3">
          {/* Guest Identity & Homestay Attribution Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Guest Identity Card */}
            <div className="p-3 rounded-xl bg-[#0D1117] border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Guest Identity</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] font-mono font-medium">
                  {c.passengers || 1} Pax
                </span>
              </div>
              <p className="text-xs font-semibold text-white truncate">{c.guestName || "Guest"}</p>
              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                <span className="font-mono text-slate-300 text-[11px]">{c.guestPhone || "No phone"}</span>
                {c.guestPhone && (
                  <a
                    href={`https://wa.me/${String(c.guestPhone).replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#1E7E4B]/15 text-[#3FB950] border border-[#2EA043]/30 hover:bg-[#1E7E4B]/25 transition-colors cursor-pointer"
                  >
                    WhatsApp ↗
                  </a>
                )}
              </div>
            </div>

            {/* Attribution & Vehicle Tier */}
            <div className="p-3 rounded-xl bg-[#0D1117] border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Attribution</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] font-medium">
                  {c.vehicleType || "SUV"}
                </span>
              </div>
              <p className="text-xs font-semibold text-white truncate" title={c.homestayName || c.propertyId}>
                {c.homestayName || "Platform Direct"}
              </p>
              <p className="text-[11px] text-slate-400 truncate">{c.propertyId || "No property ID"}</p>
            </div>
          </div>

          {/* Departure Schedule & Target Budget Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0D1117] border border-slate-800/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Departure:</span>
              <span className="font-mono font-semibold text-white px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60">
                {formatStrictDDMMYYYY(c.date)}
              </span>
              <span className="font-mono font-semibold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/50">
                {c.time}
              </span>
            </div>
            {c.guestBudget ? (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Target Budget:</span>
                <span className="font-mono font-bold text-[#3FB950] bg-[#1E7E4B]/15 px-2 py-0.5 rounded border border-[#2EA043]/30">
                  {inr(c.guestBudget)}
                </span>
              </div>
            ) : null}
          </div>

          {/* Route Display Box */}
          <div className="p-3.5 rounded-xl bg-[#0D1117] border border-slate-800/80 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <div className="flex flex-col items-center mt-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-500/20" />
                <div className="w-0.5 h-6 bg-slate-800 my-0.5" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-amber-500/20" />
              </div>
              <div className="flex-1 space-y-2 text-xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Pickup Location</span>
                    {c.pickupLocation?.lat && c.pickupLocation?.lng && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${c.pickupLocation.lat},${c.pickupLocation.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-400 hover:underline"
                      >
                        Maps ↗
                      </a>
                    )}
                  </div>
                  <p className="font-medium text-white text-xs mt-0.5">{c.pickupLocation?.address || "Pickup address not set"}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Dropoff Destination</span>
                    {c.isRoundTrip && (
                      <span className="text-[10px] font-medium text-amber-300 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-900/40">
                        Round Trip
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-white text-xs mt-0.5">
                    {(c.destinations || []).map((d: Any) => d.address).join(" ➔ ") || "Destination not set"}
                  </p>
                </div>
              </div>
            </div>

            {c.notes && (
              <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                <span className="font-medium text-slate-300">Special Notes:</span> {c.notes}
              </div>
            )}
          </div>

          {/* Transit Tracker (if trip in progress) */}
          {["CONFIRMED", "EN_ROUTE_PICKUP", "ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(c.status) && (
            <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-[#0D1117] border border-slate-800 text-xs overflow-x-auto">
              <span className="font-medium text-slate-400 text-xs mr-1 shrink-0">Transit tracker:</span>
              <span className={`px-2 py-0.5 rounded font-medium shrink-0 ${c.status === "CONFIRMED" ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "text-slate-500"}`}>
                Advance paid
              </span>
              <span className="text-slate-600 shrink-0">→</span>
              <span className={`px-2 py-0.5 rounded font-medium shrink-0 ${c.status === "EN_ROUTE_PICKUP" ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : ["ARRIVED_HOMESTAY", "TRIP_STARTED", "COMPLETED"].includes(c.status) ? "text-slate-400" : "text-slate-600"}`}>
                En route
              </span>
              <span className="text-slate-600 shrink-0">→</span>
              <span className={`px-2 py-0.5 rounded font-medium shrink-0 ${c.status === "ARRIVED_HOMESTAY" ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : ["TRIP_STARTED", "COMPLETED"].includes(c.status) ? "text-slate-400" : "text-slate-600"}`}>
                Arrived homestay
              </span>
              <span className="text-slate-600 shrink-0">→</span>
              <span className={`px-2 py-0.5 rounded font-medium shrink-0 ${c.status === "TRIP_STARTED" ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : c.status === "COMPLETED" ? "text-slate-400" : "text-slate-600"}`}>
                Trip started
              </span>
              <span className="text-slate-600 shrink-0">→</span>
              <span className={`px-2 py-0.5 rounded font-medium shrink-0 ${c.status === "COMPLETED" ? "bg-[#1E7E4B] text-white" : "text-slate-600"}`}>
                Completed
              </span>
            </div>
          )}

          {/* Assigned Driver Box */}
          {c.assignedDriverName && (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0D1117] border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-400">Assigned Driver:</span>
                <span className="font-semibold text-white">{c.assignedDriverName}</span>
                <span className="font-mono text-slate-400">({c.assignedDriverPhone || "No phone"})</span>
              </div>
              {c.assignedDriverPhone && (
                <a
                  href={`tel:${c.assignedDriverPhone}`}
                  className="rounded-md bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] text-slate-200 font-medium transition-colors cursor-pointer"
                >
                  Call Driver
                </a>
              )}
            </div>
          )}

          {/* Operational Alerts */}
          {c.cancellationReason && (
            <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-800/40 text-red-300 text-xs font-mono">
              Cancelled: {c.cancellationReason}
            </div>
          )}
          {c.advanceDueAt && !c.advancePaid && (
            <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs">
              Advance due by {dt(c.advanceDueAt)}
            </div>
          )}
          {claim && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs space-y-1">
              <span className="font-medium text-white">Guest Payment Claim:</span>
              <p>UTR <span className="font-mono font-medium text-white">{claim.utr}</span> • {inr(claim.amount)} • {dt(claim.submittedAt)}</p>
              <p className="text-[11px] text-amber-300/80">Verify bank deposit and click &quot;Record payment&quot; or &quot;Reject claim&quot;.</p>
            </div>
          )}
          {canPay && c.paymentClaim?.status === "REJECTED" && (
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs">
              Previous claim rejected (UTR {c.paymentClaim.utr}){c.paymentClaim.reason ? `: ${c.paymentClaim.reason}` : ""}
            </div>
          )}
          {c.paymentLinkUrl && (
            <div className="p-2.5 rounded-xl bg-[#0D1117] border border-slate-800 text-xs text-slate-300">
              <span className="text-slate-400">Payment link: </span>
              <a className="text-emerald-400 hover:underline break-all" href={c.paymentLinkUrl} target="_blank" rel="noreferrer">
                {c.paymentLinkUrl}
              </a>
            </div>
          )}
          {Array.isArray(c.unmatchedPayments) && c.unmatchedPayments.length > 0 && (
            <div className="rounded-xl border border-rose-800/40 bg-rose-950/20 p-3 space-y-2">
              <p className="font-semibold text-rose-300">Unmatched / Out-of-Sequence Payments (Refunds Needed):</p>
              {c.unmatchedPayments.map((u: Any, idx: number) => (
                <div key={idx} className="flex flex-wrap items-center justify-between gap-2 text-slate-300 pt-1 border-t border-rose-900/30">
                  <span className="text-xs">
                    <span className="font-mono text-white">{u.paymentId}</span> • {inr(u.amount)} • {u.status === "UNVERIFIED_GUEST_CLAIM" ? "unverified guest UPI claim" : `state was ${u.status}`} • {dt(u.at)}
                    {u.refundedAt ? (
                      <span className="ml-2 font-medium text-emerald-400">Refunded (UTR: {u.refundReference || "—"})</span>
                    ) : (
                      <span className="ml-2 font-medium text-amber-300">Needs refund</span>
                    )}
                  </span>
                  {!u.refundedAt && (
                    <button
                      type="button"
                      className="rounded-md bg-rose-700 hover:bg-rose-600 px-2 py-0.5 text-xs font-medium text-white transition-colors cursor-pointer"
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

        {/* RIGHT COLUMN (5 cols): Financial Breakdown & Commercial Settlement */}
        <div className="lg:col-span-5 space-y-3">
          <div className="rounded-xl border border-slate-800/80 bg-[#0D1117] p-3.5 space-y-2">
            <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider pb-1 border-b border-slate-800/60">
              Financial Breakdown
            </div>
            <Money
              label="Agreed Fare"
              value={
                c.agreedFare && c.agreedFare > 0
                  ? inr(c.agreedFare)
                  : <span className="font-medium text-amber-400">Awaiting quote</span>
              }
            />
            <Money
              label="Advance Online"
              value={
                c.advanceAmount && c.advanceAmount > 0 ? (
                  <>{inr(c.advanceAmount)} {c.advancePaid ? <Badge tone="green">PAID</Badge> : <Badge tone="amber">UNPAID</Badge>}</>
                ) : (
                  <span className="text-slate-400">Pending quote</span>
                )
              }
            />
            <Money
              label="Cash on Drop"
              value={
                typeof c.remainingCashAmount === "number" && c.remainingCashAmount > 0
                  ? inr(c.remainingCashAmount)
                  : <span className="text-slate-400">—</span>
              }
            />
            <div className="pt-1 border-t border-slate-800/60 space-y-1">
              <SplitRows s={s} fare={s.agreedFare ?? c.agreedFare} />
            </div>
            {(c.advancePaymentId || c.hostPayoutId || (Array.isArray(c.voidedPayments) && c.voidedPayments.length > 0)) && (
              <div className="pt-1.5 border-t border-slate-800/60 space-y-1 text-[11px]">
                {c.advancePaymentId && <Money label="Txn ID" value={`${c.advancePaymentId} (${c.paymentRecordedBy || "—"})`} />}
                {c.hostPayoutId && <Money label="Host payout ID" value={String(c.hostPayoutId)} />}
                {Array.isArray(c.voidedPayments) && c.voidedPayments.length > 0 && <Money label="Voided payments" value={c.voidedPayments.length} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. DRIVER QUOTES RECEIVED */}
      {Array.isArray(c.quotes) && c.quotes.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-[#0D1117] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-300">Driver Quotes Received ({c.quotes.length}) • Bidding Window</span>
            {["FINDING_DRIVER", "QUOTE_RECEIVED", "PENDING_REVIEW"].includes(c.status) && (
              <Badge tone="amber">Quotation Active</Badge>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {c.quotes.map((q: Any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#121820] p-2.5 text-xs">
                <div>
                  <p className="font-semibold text-white">{q.driverName}</p>
                  <p className="text-slate-400 font-mono text-[11px]">{q.driverPhone || "—"}</p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-400">{inr(q.quotedFare)}</span>
                  <Badge tone={q.status === "ACCEPTED" ? "green" : q.status === "REJECTED" ? "red" : q.status === "EXPIRED" ? "slate" : "amber"}>
                    {q.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ACTION CONTROLS */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/80">
        {canAssign && (
          <button
            className={btn.primary}
            onClick={() => setPanel(panel === "assign" ? "" : "assign")}
          >
            {c.needsReassignment ? "Assign new driver" : c.assignedDriverName ? "Re-assign / re-price" : "Assign driver"}
          </button>
        )}
        {canPay && (
          <button className={btn.ok} onClick={() => setPanel(panel === "payment" ? "" : "payment")}>
            Record payment
          </button>
        )}
        {claim && (
          <button className={btn.danger} disabled={busy} onClick={rejectClaim}>
            {busy ? "Working..." : "Reject claim"}
          </button>
        )}
        {canVoid && <button className={btn.danger} onClick={voidPayment}>Void payment</button>}
        {canStart && <button className={btn.primary} onClick={() => window.confirm(`Start trip #${c.reference}?`) && post("start")}>Start trip</button>}
        {canComplete && <button className={btn.ok} onClick={() => window.confirm(`Complete trip #${c.reference}? Driver collects ${inr(c.remainingCashAmount)} in cash.`) && post("complete")}>Complete trip</button>}
        {canRefund && <button className={btn.ok} onClick={refund}>Mark refunded</button>}
        {toReview && <button className={btn.ok} onClick={approveRide}>Approve ride happened</button>}
        {toReview && <button className={btn.danger} onClick={markNoShow}>Mark no-show / refund guest</button>}
        {canSettleDriver && <button className={btn.ok} onClick={settleDriver}>Driver settled</button>}
        {canCancel && <button className={btn.ghost} onClick={cancel}>Cancel</button>}
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
    () => adminApi("/stayride/drivers", { demo, query: { status: "ACTIVE", q: driverQ, search: driverQ, page: 1, limit: 100 } }).then((r) => toPage(r).items),
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

  async function selectQuote(q: Any) {
    const qFare = String(q.quotedFare);
    setDriverUserId(String(q.driverId));
    setPicked({ _id: String(q.driverId), name: q.driverName, phone: q.driverPhone });
    setFare(qFare);
    if (!locked && Number(qFare) > 0) {
      try {
        const r = await adminApi("/commission/preview", { method: "POST", body: { fare: Number(qFare), tenantKey: c.propertyId }, demo });
        setPreview(r.data);
        setPreviewFor(qFare);
      } catch {}
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
    <form onSubmit={submit} className="rounded-xl border border-slate-800 bg-[#0D1117] p-3 space-y-2.5">
      <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-xs text-slate-300 flex items-center gap-1.5">
        <span className="font-medium text-white">Assignment Rule:</span> Assigning a driver immediately ends quotation collection, accepts this driver's bid, rejects competing quotes, and locks the fare.
      </div>
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
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-900/80 rounded-lg border border-slate-800">
          <span className="text-[11px] text-slate-400 font-semibold mr-1">Quick-Select Quote:</span>
          {c.quotes.filter((q: Any) => q.driverId).map((q: Any, i: number) => (
            <button
              type="button"
              key={i}
              className="rounded-md border border-emerald-700/60 bg-emerald-950/30 px-2.5 py-1 text-emerald-300 hover:bg-emerald-900/50 font-medium text-xs flex items-center gap-1 transition"
              onClick={() => selectQuote(q)}
            >
              {q.driverName} • {inr(q.quotedFare)}
            </button>
          ))}
        </div>
      )}
      {preview && previewFor === fare && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-slate-800/80 bg-[#0D1117] p-2.5 md:grid-cols-3">
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
  // a guest's pending UPI claim pre-fills the form; recording it confirms the trip and clears the claim
  const claim = c.paymentClaim?.status === "PENDING" ? c.paymentClaim : null;
  const [txn, setTxn] = useState(claim?.utr || "");
  const [amount, setAmount] = useState(claim ? String(claim.amount) : "");
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
  const [target, setTarget] = useState<"HOMESTAY" | "DRIVER">("HOMESTAY");
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(0);

  const endpoint = target === "HOMESTAY" ? "/host-payouts" : "/driver-payouts";

  const { data, error, loading, reload, updatedAt } = useLoad(
    () => adminApi(endpoint, { demo, query: { status, ...pq(page) } }).then(toPage),
    [demo, target, status, page],
    true
  );
  const items = data?.items || [];
  const [busyId, setBusyId] = useState("");
  const run = async (id: string, fn: () => Promise<any>) => {
    setBusyId(id);
    await act(fn, reload);
    setBusyId("");
  };

  function settle(p: Any) {
    const dest = payoutDest(p);
    const recipient = target === "HOMESTAY" ? (p.homestayName || p.ownerName) : (p.driverName || "Driver");
    const utrNumber = ask(`UTR for ${inr(p.amount)} to ${recipient} (${dest.text}):`);
    if (!utrNumber) return;
    const notes = window.prompt("Notes (optional):") || "";
    if (window.confirm(`Mark ${inr(p.amount)} to ${recipient} as settled with UTR ${utrNumber}?`)) {
      const settleEndpoint = target === "HOMESTAY" ? `/host-payouts/${rid(p)}/settle` : `/driver-payouts/${rid(p)}/settle`;
      run(rid(p), () => adminApi(settleEndpoint, { method: "POST", body: { utrNumber, notes }, demo }));
    }
  }

  function reject(p: Any) {
    const recipient = target === "HOMESTAY" ? (p.homestayName || p.ownerName) : (p.driverName || "Driver");
    const reason = ask(`Reason for rejecting ${inr(p.amount)} payout to ${recipient}:`);
    if (reason && window.confirm(`Reject this payout? Its trips can be requested again.`)) {
      const rejectEndpoint = target === "HOMESTAY" ? `/host-payouts/${rid(p)}/reject` : `/driver-payouts/${rid(p)}/reject`;
      run(rid(p), () => adminApi(rejectEndpoint, { method: "POST", body: { reason }, demo }));
    }
  }

  return (
    <Panel
      title={
        <div className="flex flex-wrap items-center gap-3">
          <span>{target === "HOMESTAY" ? "Homestay Commission Payouts" : "Driver Wallet UPI Payouts"}</span>
          <div className="flex items-center gap-1 p-0.5 bg-[#0D1117] rounded-lg border border-slate-800/80">
            <button
              type="button"
              onClick={() => { setTarget("HOMESTAY"); setPage(0); }}
              className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                target === "HOMESTAY" ? "bg-[#1E7E4B] text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              Homestay Payouts
            </button>
            <button
              type="button"
              onClick={() => { setTarget("DRIVER"); setPage(0); }}
              className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                target === "DRIVER" ? "bg-[#1E7E4B] text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              Driver Payouts
            </button>
          </div>
        </div>
      }
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
              <thead className="border-b border-slate-800 text-slate-400 font-medium text-xs">
                <tr>
                  <th className="p-3">{target === "HOMESTAY" ? "Homestay" : "Driver"}</th>
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
                        {target === "HOMESTAY" ? (
                          <>
                            <p className="font-semibold text-white">{p.homestayName}</p>
                            <p className="text-slate-500">{p.ownerName} • {p.ownerPhone || "—"} • {p.tenantId}</p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-white">{p.driverName || "Driver"}</p>
                            <p className="text-slate-500">{p.driverPhone || "—"} • ID: {p.driverId || "—"}</p>
                          </>
                        )}
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
                            <button className={btn.ok} disabled={!!busyId} onClick={() => settle(p)}>{busyId === rid(p) ? "Working…" : "Settle"}</button>
                            <button className={btn.danger} disabled={!!busyId} onClick={() => reject(p)}>Reject</button>
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
// 7. Platform settings (Unified Control Tower Settings Console)
// ---------------------------------------------------------------------------

/** Mirrors the server's CommissionService.split so unsaved values can be previewed. */
function localSplit(fare: number, totalComm: number, adminPct: number, homePct: number, adv: number, min: number) {
  const f = Math.round(fare);
  const platformPct = roundPct((totalComm * adminPct) / 100);
  const pfA = Math.min(f, Math.round((f * platformPct) / 100));
  const hcA = Math.min(f - pfA, Math.round((f * roundPct(totalComm - platformPct)) / 100));
  const totalCommAmt = pfA + hcA;
  const calcAdv = adv === 0 ? (min > 0 ? min : totalCommAmt) : Math.max(min, Math.round((f * adv) / 100), totalCommAmt);
  const advance = Math.min(f, calcAdv);
  const driverExcess = Math.max(0, advance - totalCommAmt);
  const cash = f - advance;
  const driverTotal = cash + driverExcess;
  return { f, totalCommAmt, pfA, hcA, driver: driverTotal, advance, cash, driverShare: driverExcess };
}

const VEHICLE_KEYS = ["Sedan", "SUV", "7-seater", "9-seater"] as const;

const DISPATCH_NUM_FIELDS: { key: string; label: string; hint: string; min?: number; step?: number }[] = [
  { key: "advanceWindowMin", label: "Advance Payment Window (minutes)", hint: "Guest payment hold window (recommended 120m for manual UPI verification)", min: 15 },
  { key: "quoteBiddingWindowMin", label: "Driver Bidding Window (minutes)", hint: "Window before lowest driver bid is auto-accepted (0 = manual host select)", min: 0 },
  { key: "quoteValidityHours", label: "Driver Quote Validity (hours)", hint: "Duration before driver quotes expire (0 = never)", min: 0 },
  { key: "nearbyRadiusKm", label: "Nearby Search Radius (km)", hint: "Drivers beyond this radius from homestay are omitted (0 = platform-wide)", min: 0 },
  { key: "driverBroadcastMax", label: "WhatsApp Driver Broadcast Cap", hint: "Max nearby drivers alerted via WhatsApp per ride request", min: 1 },
  { key: "hillSurchargeMultiplier", label: "Mountain Terrain Surcharge", hint: "Multiplier for steep mountain corridors (e.g. 1.15 = +15%)", min: 1.0, step: 0.05 },
  { key: "hillSurchargeDistanceKm", label: "Mountain Surcharge Threshold (km)", hint: "Corridor distance in km beyond which mountain surcharge applies", min: 0 },
  { key: "maxFare", label: "Maximum Fare Ceiling ₹", hint: "Sanity safeguard cap against fraudulent or corrupted quotes", min: 1000 },
  { key: "askCabCooldownHours", label: "Ask-for-Cab Cooldown (hours)", hint: "Minimum buffer between promotional WhatsApps to the same guest", min: 1 },
  { key: "pickupStepMin", label: "Pickup Time Step (minutes)", hint: "Minute interval quantization for guest pickup time selection", min: 5 },
  { key: "bookingHorizonDays", label: "Booking Window (days ahead)", hint: "Furthest future date guests are permitted to book in advance", min: 1 },
  { key: "guestLinkDays", label: "Guest Link Validity (days)", hint: "Lifetime of the unique public guest booking URL", min: 1 },
  { key: "maxOpenRequestsPerPhone", label: "Max Open Requests per Phone", hint: "Anti-spam threshold for guest public requests", min: 1 },
];

const BUSINESS_FIELDS: { key: string; label: string; placeholder: string; hint?: string }[] = [
  { key: "name", label: "Brand Name", placeholder: "e.g. StayCabs" },
  { key: "legalName", label: "Registered Business Legal Name", placeholder: "e.g. StayRide Mobility Private Limited" },
  { key: "address", label: "Registered Office Address", placeholder: "e.g. Hill Cart Road, Siliguri, West Bengal 734001" },
  { key: "email", label: "Support & Operations Email", placeholder: "support@staycabs.in" },
  { key: "phone", label: "Support Phone / WhatsApp Hotline", placeholder: "+91 98765 43210", hint: "Primary phone shown on passes and guest receipts" },
  { key: "upiId", label: "Platform Collection UPI ID (VPA)", placeholder: "stayride@okhdfcbank", hint: "VPA displayed on QR codes for manual UPI advance payments" },
  { key: "paymentPageUrl", label: "Hosted Payment Page URL", placeholder: "https://rzp.io/rzp/yourlink", hint: "External payment fallback if direct API simulation is active" },
  { key: "grievanceOfficer", label: "Grievance Officer Name", placeholder: "e.g. Tirtharaj Saha", hint: "India IT Rules & DPDP Act compliance requirement" },
  { key: "grievanceEmail", label: "Grievance Officer Email", placeholder: "grievance@staycabs.in" },
  { key: "website", label: "Official Public Website URL", placeholder: "https://staycabs.in" },
];

const WHATSAPP_EVENTS: { key: string; label: string; purpose: string }[] = [
  { key: "ASK_CAB", label: "Ask Guest for Cab", purpose: "Automated invite link sent to arriving homestay guests" },
  { key: "NEW_REQUEST", label: "New Trip Alert to Drivers", purpose: "Broadcast to local drivers with route and vehicle quote link" },
  { key: "QUOTE_COUNTER", label: "Owner Fare Counter-Offer", purpose: "Sent to quoting driver when homestay negotiates" },
  { key: "QUOTE_ACCEPTED_DRIVER", label: "Driver Quote Accepted", purpose: "Notifies winning driver their bid was selected" },
  { key: "QUOTE_ACCEPTED_GUEST", label: "Guest Advance Payment Link", purpose: "Prompts guest to pay advance hold fee to lock ride" },
  { key: "ADVANCE_PAID_GUEST", label: "Booking Confirmed (Guest)", purpose: "Trip confirmed pass with driver details and OTP" },
  { key: "BOARDING_PIN_GUEST", label: "Boarding PIN Pass", purpose: "Authentication security PIN required at boarding" },
  { key: "ADVANCE_PAID_DRIVER", label: "Trip Dispatched (Driver)", purpose: "Driver receipt with pickup coordinates and guest phone" },
  { key: "ADVANCE_EXPIRED_GUEST", label: "Advance Hold Expired", purpose: "Notifies guest payment window closed without confirmation" },
  { key: "TRIP_ASSIGNED_DRIVER", label: "Direct Fleet Assignment", purpose: "Dispatches ride to homestay's dedicated fleet driver" },
  { key: "TRIP_CANCELLED_GUEST", label: "Trip Cancellation Alert", purpose: "Notifies guest when ride is revoked by host or admin" },
  { key: "REFUND_GUEST", label: "Advance Refund Receipt", purpose: "Confirms advance return when ride is cancelled before dispatch" },
  { key: "COMPLETION_REMINDER_DRIVER", label: "Cash Confirmation Reminder", purpose: "Prompts driver to collect remaining cash and submit OTP" },
  { key: "BIDDING_TIMEOUT_OWNER", label: "Bidding Window Closed", purpose: "Alerts homestay when no driver bids arrived in window" },
  { key: "DRIVER_WELCOME", label: "Driver Registration Welcome", purpose: "Sent upon driver onboarding on mobile app" },
  { key: "PAYOUT_SETTLED_DRIVER", label: "Payout Disbursed (Driver)", purpose: "Payment settlement receipt with bank reference" },
  { key: "PAYOUT_REJECTED_DRIVER", label: "Payout Request Declined", purpose: "Notifies driver if bank details or balance check failed" },
  { key: "VEHICLE_UPDATED_GUEST", label: "Vehicle Plate Reassigned", purpose: "Emergency vehicle or driver swap alert to passenger" },
];

type SettingsSection = "financials" | "dispatch" | "pricing" | "sightseeing" | "whatsapp" | "business" | "features";

export function SettingsTab({ demo }: TabProps) {
  const { data, error, loading, reload, updatedAt } = useLoad(() => adminApi("/commission/settings", { demo }).then((r) => r.data as Any), [demo], true);
  
  const [activeSection, setActiveSection] = useState<SettingsSection>("financials");

  // Commission & Splits
  const [totalComm, setTotalComm] = useState("10");
  const [adminShare, setAdminShare] = useState("50");
  const [adv, setAdv] = useState("15");
  const [min, setMin] = useState("500");
  const [ownFleetComm, setOwnFleetComm] = useState("5");
  const [ownFleetMin, setOwnFleetMin] = useState("100");
  const [minThreshold, setMinThreshold] = useState("100");

  // Operational Platform Config
  const [cfg, setCfg] = useState<Any | null>(null);
  const [presets, setPresets] = useState("");
  const [icalHosts, setIcalHosts] = useState("");
  const [features, setFeatures] = useState<Any>({});

  // Calculation & Save
  const [fareSim, setFareSim] = useState("3000");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setTotalComm(String(data.totalCommissionPercent ?? 10));
    setAdminShare(String(data.adminSharePercentOfCommission ?? 50));
    setAdv(String(data.defaultAdvancePercent ?? 15));
    setMin(String(data.minAdvanceAmount ?? 500));
    setOwnFleetComm(String(data.platform?.ownFleetFeePercent ?? 5));
    setOwnFleetMin(String(data.platform?.ownFleetMinFee ?? 100));
    setMinThreshold(String(data.platform?.minDriverPayoutThreshold ?? 100));

    if (data.platform) {
      setCfg(JSON.parse(JSON.stringify(data.platform)));
      setPresets((data.platform.sightseeingPresets || []).join("\n"));
      setIcalHosts((data.platform.icalAllowedHosts || []).join("\n"));
    }
    setFeatures(data.features || {});
  }, [data]);

  // Clean Presets & Domains
  const presetList = (text: string) => text.split("\n").map((p) => p.trim()).filter(Boolean);
  const cleanDomainList = (text: string) =>
    text
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          if (line.includes("://")) {
            return new URL(line).hostname.replace(/^www\./, "");
          }
          return line.split("/")[0].replace(/^www\./, "").trim();
        } catch {
          return line;
        }
      })
      .filter(Boolean);

  // Dirty state tracking
  const isFinancialsDirty =
    !data ||
    totalComm !== String(data.totalCommissionPercent ?? 10) ||
    adminShare !== String(data.adminSharePercentOfCommission ?? 50) ||
    adv !== String(data.defaultAdvancePercent ?? 15) ||
    min !== String(data.minAdvanceAmount ?? 500) ||
    ownFleetComm !== String(data.platform?.ownFleetFeePercent ?? 5) ||
    ownFleetMin !== String(data.platform?.ownFleetMinFee ?? 100) ||
    minThreshold !== String(data.platform?.minDriverPayoutThreshold ?? 100);

  const isOpsDirty =
    !!data?.platform &&
    !!cfg &&
    JSON.stringify({ ...cfg, sightseeingPresets: presetList(presets), icalAllowedHosts: cleanDomainList(icalHosts) }) !==
      JSON.stringify(data.platform);

  const isFeaturesDirty = !!data?.features && JSON.stringify(features) !== JSON.stringify(data.features);

  const dirty = isFinancialsDirty || isOpsDirty || isFeaturesDirty;
  useEditLock(dirty);

  // Field Setters
  const setCfgField = (key: string, value: unknown) => setCfg((c: Any) => ({ ...c, [key]: value }));
  const setVehicleProp = (k: string, field: string, value: unknown) =>
    setCfg((c: Any) => ({ ...c, vehicles: { ...c.vehicles, [k]: { ...c.vehicles?.[k], [field]: value } } }));

  const updateRouteField = (idx: number, field: string, val: unknown) => {
    setCfg((c: Any) => {
      const routes = [...(c.routePresets || [])];
      if (!routes[idx]) return c;
      routes[idx] = { ...routes[idx], [field]: val };
      return { ...c, routePresets: routes };
    });
  };

  const updateRouteFare = (idx: number, vKey: string, val: string) => {
    setCfg((c: Any) => {
      const routes = [...(c.routePresets || [])];
      if (!routes[idx]) return c;
      routes[idx] = {
        ...routes[idx],
        fares: {
          ...(routes[idx].fares || {}),
          [vKey]: val === "" ? "" : isNaN(Number(val)) ? 0 : Number(val),
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
        name: "New Scenic Corridor",
        category: "SIGHTSEEING",
        duration: "approx 2.5 hrs (45 km)",
        description: "Custom hill mountain transfer",
        fares: { Sedan: 2200, SUV: 2800, "7-seater": 3200, "9-seater": 4200 },
      });
      return { ...c, routePresets: routes };
    });
  };

  const removeRoutePreset = (idx: number) => {
    if (!window.confirm("Remove this mountain route benchmark?")) return;
    setCfg((c: Any) => {
      const routes = [...(c.routePresets || [])];
      routes.splice(idx, 1);
      return { ...c, routePresets: routes };
    });
  };

  // Revert / Reset
  const resetAll = () => {
    if (!window.confirm("Discard all unsaved edits and reload current settings from server?")) return;
    reload();
  };

  // Unified Atomic Save
  async function saveAll(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!data) return;
    if (!reason.trim()) {
      alert("A change reason is required for audit logging (e.g. 'Updated peak season rates').");
      return;
    }

    const tc = Number(totalComm) || 0;
    const ap = Number(adminShare) || 0;
    const pf = roundPct(tc * (ap / 100));
    const hc = roundPct(tc - pf);

    // Sanitize Route Fares before sending
    const sanitizedRoutes = (cfg?.routePresets || []).map((r: Any) => {
      const cleanFares: Record<string, number> = {};
      for (const vk of VEHICLE_KEYS) {
        const fv = r.fares?.[vk];
        cleanFares[vk] = fv === "" || isNaN(Number(fv)) ? 0 : Number(fv);
      }
      return { ...r, fares: cleanFares };
    });

    const payload: Any = {
      globalPlatformFeePercent: pf,
      globalHomestayCommissionPercent: hc,
      defaultAdvancePercent: Number(adv) || 0,
      minAdvanceAmount: Number(min) || 0,
      features,
      platform: {
        ...(cfg || {}),
        ownFleetFeePercent: Number(ownFleetComm) || 0,
        ownFleetMinFee: Number(ownFleetMin) || 0,
        minDriverPayoutThreshold: Number(minThreshold) || 0,
        routePresets: sanitizedRoutes,
        sightseeingPresets: presetList(presets),
        icalAllowedHosts: cleanDomainList(icalHosts),
      },
      changeReason: reason.trim(),
    };

    setSaving(true);
    await act(
      () =>
        adminApi("/commission/settings", {
          method: "PUT",
          demo,
          body: payload,
        }),
      () => {
        setReason("");
        reload();
      }
    );
    setSaving(false);
  }

  // Live Split Simulation
  const tcNum = Number(totalComm) || 0;
  const apNum = Number(adminShare) || 0;
  const hpNum = Math.max(0, 100 - apNum);
  const advNum = Number(adv) || 0;
  const minNum = Number(min) || 0;
  const simSplit = localSplit(Number(fareSim) || 3000, tcNum, apNum, hpNum, advNum, minNum);

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Navigation */}
      <Panel
        title={
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-white">Platform Settings Control Tower</span>
            {demo ? <Badge tone="amber">DEMO DATASET</Badge> : <Badge tone="green">PRODUCTION ACTIVE</Badge>}
            {dirty && <Badge tone="red">UNSAVED CHANGES</Badge>}
          </div>
        }
        subtitle="Manage commission splits, mountain route fare benchmarks, dispatch automation, WhatsApp templates, and compliance business profiles."
        onRefresh={reload}
        error={error}
        loading={loading}
        updatedAt={updatedAt}
        right={
          dirty ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={resetAll} className={btn.ghost} disabled={saving}>
                Discard Edits
              </button>
              <button
                type="button"
                onClick={() => saveAll()}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-500 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? "Saving All..." : "Save Platform Settings"}
              </button>
            </div>
          ) : undefined
        }
      >
        {/* Navigation Sub-Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-3">
          {[
            { id: "financials", label: "Commission & Splits", icon: "•", dirty: isFinancialsDirty },
            { id: "dispatch", label: "Mountain & Dispatch", icon: "•", dirty: isOpsDirty },
            { id: "pricing", label: "Fleet & Route Pricing", icon: "•", dirty: isOpsDirty },
            { id: "sightseeing", label: "Sightseeing & Calendar", icon: "•", dirty: isOpsDirty },
            { id: "whatsapp", label: "WhatsApp Templates", icon: "•", dirty: isOpsDirty },
            { id: "business", label: "Business & Compliance", icon: "•", dirty: isOpsDirty },
            { id: "features", label: "Global Feature Switches", icon: "•", dirty: isFeaturesDirty },
          ].map((tab) => {
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id as SettingsSection)}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-[#1E7E4B] text-white"
                    : "bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.dirty && (
                  <span className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-slate-950" title="Modified" />
                )}
              </button>
            );
          })}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Sub-Tab 1: Commission & Financials                                 */}
        {/* ------------------------------------------------------------------ */}
        {activeSection === "financials" && (
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Split Rates Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-white">Platform Commission Structure</h3>
                  <p className="text-[11px] text-slate-400">
                    Defines take-rates calculated on every completed ride fare.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="text-slate-300">
                    <span className="font-semibold">Total Commission %</span>
                    <input
                      className={`${input} mt-1 w-full font-mono text-sm font-bold text-emerald-400`}
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={totalComm}
                      onChange={(e) => setTotalComm(e.target.value)}
                    />
                    <span className="mt-1 block text-[10px] text-slate-500">
                      Standard take-rate on driver quote
                    </span>
                  </label>

                  <label className="text-slate-300">
                    <span className="font-semibold">Platform Fee Split %</span>
                    <input
                      className={`${input} mt-1 w-full font-mono text-sm font-bold text-blue-400`}
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={adminShare}
                      onChange={(e) => setAdminShare(e.target.value)}
                    />
                    <span className="mt-1 block text-[10px] text-slate-500">
                      Homestay share automatically set to {100 - (Number(adminShare) || 0)}%
                    </span>
                  </label>

                  <label className="text-slate-300">
                    <span className="font-semibold">Default Guest Advance %</span>
                    <input
                      className={`${input} mt-1 w-full font-mono`}
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={adv}
                      onChange={(e) => setAdv(e.target.value)}
                    />
                    <span className="mt-1 block text-[10px] text-slate-500">
                      Advance hold paid by passenger to confirm trip
                    </span>
                  </label>

                  <label className="text-slate-300">
                    <span className="font-semibold">Minimum Advance Floor ₹</span>
                    <input
                      className={`${input} mt-1 w-full font-mono`}
                      type="number"
                      step="50"
                      min="0"
                      value={min}
                      onChange={(e) => setMin(e.target.value)}
                    />
                    <span className="mt-1 block text-[10px] text-slate-500">
                      Absolute floor advance on lower-fare local rides
                    </span>
                  </label>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#0D1117] p-3.5 space-y-2">
                  <span className="text-xs font-medium text-slate-300 block">
                    Homestay Host &amp; Own-Fleet Policies
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="text-slate-400 text-xs">
                      Own-Fleet Fee %
                      <input
                        className={`${input} mt-1 w-full font-mono`}
                        type="number"
                        min="0"
                        max="100"
                        value={ownFleetComm}
                        onChange={(e) => setOwnFleetComm(e.target.value)}
                      />
                      <span className="mt-0.5 block text-[10px] text-slate-500">Platform cut when host driver used</span>
                    </label>

                    <label className="text-slate-400 text-xs">
                      Own-Fleet Min Fee ₹
                      <input
                        className={`${input} mt-1 w-full font-mono`}
                        type="number"
                        min="0"
                        value={ownFleetMin}
                        onChange={(e) => setOwnFleetMin(e.target.value)}
                      />
                      <span className="mt-0.5 block text-[10px] text-slate-500">Fee floor on low reported fares</span>
                    </label>

                    <label className="text-slate-400 text-xs">
                      Min Driver Payout ₹
                      <input
                        className={`${input} mt-1 w-full font-mono`}
                        type="number"
                        min="0"
                        value={minThreshold}
                        onChange={(e) => setMinThreshold(e.target.value)}
                      />
                      <span className="mt-0.5 block text-[10px] text-slate-500">Minimum wallet balance to withdraw</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Interactive Split Simulator */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">Interactive Fare Split Simulator</h3>
                    <p className="text-[11px] text-slate-400">
                      Verify net earnings and cash splits before committing platform rates.
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {["1800", "2800", "3600", "5200"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFareSim(s)}
                        className={`rounded-md px-2 py-1 text-[11px] font-mono font-medium transition ${
                          fareSim === s
                            ? "bg-[#1E7E4B] text-white"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        ₹{s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 text-xs">
                    Sample Trip Fare (₹)
                    <input
                      className={`${input} mt-1 w-full font-mono text-base font-bold text-amber-400`}
                      type="number"
                      step="100"
                      min="500"
                      value={fareSim}
                      onChange={(e) => setFareSim(e.target.value)}
                      placeholder="e.g. 3000"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-800/80 bg-[#0D1117] p-3">
                    <span className="text-xs font-medium text-slate-400">Passenger advance</span>
                    <p className="mt-1 font-mono text-base font-semibold tabular-nums text-emerald-400">₹{simSplit.advance.toLocaleString("en-IN")}</p>
                    <span className="text-[11px] text-slate-500">Paid online via UPI</span>
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-[#0D1117] p-3">
                    <span className="text-xs font-medium text-slate-400">Platform take</span>
                    <p className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-200">₹{simSplit.pfA.toLocaleString("en-IN")}</p>
                    <span className="text-[11px] text-slate-500">StayCabs cut</span>
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-[#0D1117] p-3">
                    <span className="text-xs font-medium text-slate-400">Homestay share</span>
                    <p className="mt-1 font-mono text-base font-semibold tabular-nums text-amber-300">₹{simSplit.hcA.toLocaleString("en-IN")}</p>
                    <span className="text-[11px] text-slate-500">Host referral cut</span>
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-[#0D1117] p-3">
                    <span className="text-xs font-medium text-slate-400">Cash to driver</span>
                    <p className="mt-1 font-mono text-base font-semibold tabular-nums text-white">₹{simSplit.cash.toLocaleString("en-IN")}</p>
                    <span className="text-[11px] text-slate-500">Collected at trip end</span>
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-[#0D1117] p-3">
                    <span className="text-xs font-medium text-slate-400">Online excess</span>
                    <p className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-300">₹{simSplit.driverShare.toLocaleString("en-IN")}</p>
                    <span className="text-[11px] text-slate-500">Wallet balance credit</span>
                  </div>

                  <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3">
                    <span className="text-xs font-medium text-emerald-400">Driver net</span>
                    <p className="mt-1 font-mono text-base font-semibold tabular-nums text-emerald-300">₹{simSplit.driver.toLocaleString("en-IN")}</p>
                    <span className="text-[11px] text-emerald-500/80">Cash + wallet credit</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed bg-[#0D1117] p-3 rounded-xl border border-slate-800/80">
                  <strong className="text-slate-200">Rule guarantee:</strong> Advance collections automatically cover the homestay and platform take-rate first. Any remaining advance flows directly to the driver&apos;s settlement balance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Sub-Tab 2: Mountain & Dispatch Rules                               */}
        {/* ------------------------------------------------------------------ */}
        {activeSection === "dispatch" && cfg && (
          <div className="space-y-5 pt-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-white">Mountain Corridor & Automation Dispatch Rules</h3>
                <p className="text-[11px] text-slate-400">
                  Configure dispatch radiuses, mountain surcharges, and anti-abuse thresholds enforced by the server.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {DISPATCH_NUM_FIELDS.map((f) => (
                  <label key={f.key} className="text-slate-300">
                    <span className="font-semibold">{f.label}</span>
                    <input
                      className={`${input} mt-1 w-full font-mono`}
                      type="number"
                      min={f.min ?? 0}
                      step={f.step ?? 1}
                      value={cfg[f.key] ?? ""}
                      onChange={(e) =>
                        setCfgField(f.key, e.target.value === "" ? "" : Number(e.target.value))
                      }
                    />
                    {f.hint && <span className="mt-1 block text-[10px] text-slate-500">{f.hint}</span>}
                  </label>
                ))}

                <label className="text-slate-300">
                  <span className="font-semibold">Earliest Pickup Time</span>
                  <input
                    className={`${input} mt-1 w-full`}
                    value={cfg.pickupStart ?? ""}
                    onChange={(e) => setCfgField("pickupStart", e.target.value)}
                    placeholder="03:30 AM"
                  />
                  <span className="mt-1 block text-[10px] text-slate-500">Accommodates Tiger Hill sunrise departures</span>
                </label>

                <label className="text-slate-300">
                  <span className="font-semibold">Latest Pickup Time</span>
                  <input
                    className={`${input} mt-1 w-full`}
                    value={cfg.pickupEnd ?? ""}
                    onChange={(e) => setCfgField("pickupEnd", e.target.value)}
                    placeholder="10:00 PM"
                  />
                  <span className="mt-1 block text-[10px] text-slate-500">Night curfew limit for mountain driving</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Sub-Tab 3: Fleet & Route Pricing                                  */}
        {/* ------------------------------------------------------------------ */}
        {activeSection === "pricing" && cfg && (
          <div className="space-y-6 pt-2">
            {/* Vehicle Classes */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-white">Vehicle Tier Classes</h3>
                <p className="text-[11px] text-slate-400">
                  Supported passenger vehicle categories in the booking wizard and driver bidding app.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 font-medium text-xs">
                    <tr>
                      <th className="p-2.5">Class Key</th>
                      <th className="p-2.5">Passenger Label</th>
                      <th className="p-2.5">Seats</th>
                      <th className="p-2.5">Baseline Estimate ₹</th>
                      <th className="p-2.5 text-center">Active / Bookable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {VEHICLE_KEYS.map((k) => (
                      <tr key={k} className="hover:bg-slate-900/40">
                        <td className="p-2.5 font-mono font-semibold text-slate-200">{k}</td>
                        <td className="p-2.5">
                          <input
                            className={`${input} w-full max-w-xs`}
                            value={cfg.vehicles?.[k]?.label ?? ""}
                            onChange={(e) => setVehicleProp(k, "label", e.target.value)}
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            className={`${input} w-20 font-mono`}
                            type="number"
                            min="1"
                            value={cfg.vehicles?.[k]?.seats ?? ""}
                            onChange={(e) => setVehicleProp(k, "seats", Number(e.target.value))}
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            className={`${input} w-28 font-mono`}
                            type="number"
                            min="0"
                            value={cfg.vehicles?.[k]?.estFare ?? ""}
                            onChange={(e) => setVehicleProp(k, "estFare", Number(e.target.value))}
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-700 bg-[#0D1117] text-[#1E7E4B] accent-[#1E7E4B] focus:ring-0"
                            checked={!!cfg.vehicles?.[k]?.enabled}
                            onChange={(e) => setVehicleProp(k, "enabled", e.target.checked)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Route-Specific Benchmark Pricing */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Route-Specific Benchmark Pricing</h3>
                  <p className="text-[11px] text-slate-400">
                    Fixed corridor benchmarks for Darjeeling, Siliguri, and Sikkim hill routes. Displayed in public booking wizards and used as driver bid anchors.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addRoutePreset}
                  className="self-start sm:self-auto rounded-lg bg-[#1E7E4B] hover:bg-[#259A5C] px-3.5 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  + Add Corridor Preset
                </button>
              </div>

              <div className="space-y-3.5">
                {(cfg.routePresets || []).map((route: Any, idx: number) => (
                  <div
                    key={route.id || idx}
                    className="rounded-xl border border-slate-800/80 bg-[#0D1117] p-4 space-y-3 transition-colors hover:border-slate-700"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                        <div>
                          <span className="text-xs font-medium text-slate-400">Corridor name</span>
                          <input
                            className={`${input} w-full mt-1 font-semibold text-white`}
                            value={route.name || ""}
                            onChange={(e) => updateRouteField(idx, "name", e.target.value)}
                            placeholder="e.g. Bagdogra Airport Transfer"
                          />
                        </div>

                        <div>
                          <span className="text-xs font-medium text-slate-400">Category</span>
                          <select
                            className={`${input} w-full mt-1`}
                            value={route.category || "SIGHTSEEING"}
                            onChange={(e) => updateRouteField(idx, "category", e.target.value)}
                          >
                            <option value="AIRPORT_STATION">Airport / Railway Station</option>
                            <option value="SIGHTSEEING">Sightseeing Point-to-Point</option>
                            <option value="DAY_EXCURSION">Full Day Excursion</option>
                            <option value="LOCAL_DROP">Local Town Drop</option>
                          </select>
                        </div>

                        <div>
                          <span className="text-xs font-medium text-slate-400">Duration and distance</span>
                          <input
                            className={`${input} w-full mt-1`}
                            value={route.duration || ""}
                            onChange={(e) => updateRouteField(idx, "duration", e.target.value)}
                            placeholder="e.g. approx 3 hrs (70 km)"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRoutePreset(idx)}
                        className="self-end sm:self-center rounded-md border border-rose-800/50 bg-rose-950/20 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>

                    <div>
                      <span className="text-xs font-medium text-slate-400">Corridor description / route notes</span>
                      <input
                        className={`${input} w-full mt-1 text-xs`}
                        value={route.description || ""}
                        onChange={(e) => updateRouteField(idx, "description", e.target.value)}
                        placeholder="e.g. One-way hill descent / climb transfer via Rohini bypass route"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-xs font-medium text-slate-400 block mb-2">
                        Benchmark Fares per Vehicle Tier (₹)
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {VEHICLE_KEYS.map((vKey) => (
                          <div
                            key={vKey}
                            className="flex items-center gap-2 bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-800/80"
                          >
                            <span className="text-[11px] font-mono text-slate-400 min-w-[55px]">{vKey}:</span>
                            <span className="text-xs text-slate-500">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="50"
                              className="w-full bg-transparent text-xs font-semibold tabular-nums text-emerald-400 focus:outline-none"
                              value={route.fares?.[vKey] ?? ""}
                              onChange={(e) => updateRouteFare(idx, vKey, e.target.value)}
                              placeholder="0"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Sub-Tab 4: Sightseeing & Calendar Sync                             */}
        {/* ------------------------------------------------------------------ */}
        {activeSection === "sightseeing" && (
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Sightseeing Presets */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-white">Curated Sightseeing Spots</h3>
                  <p className="text-[11px] text-slate-400">
                    Popular hill tourist destinations offered to guests in quick-booking pills. One per line.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto rounded-xl border border-slate-800/80 bg-[#0D1117] p-2.5">
                  {presetList(presets).map((p, i) => (
                    <span key={i} className="rounded-md bg-slate-800/50 px-2 py-0.5 text-xs text-slate-300 border border-slate-700/60">
                      • {p}
                    </span>
                  ))}
                  {presetList(presets).length === 0 && (
                    <span className="text-xs text-slate-500">No sightseeing presets configured.</span>
                  )}
                </div>

                <label className="block text-slate-300">
                  <span className="font-semibold text-xs">Edit Presets (One per line)</span>
                  <textarea
                    className={`${input} mt-1 h-44 w-full font-mono text-xs leading-relaxed`}
                    value={presets}
                    onChange={(e) => setPresets(e.target.value)}
                    placeholder="Tiger Hill Sunrise
Batasia Loop & War Memorial
Lamahatta Eco Park..."
                  />
                </label>
              </div>

              {/* Calendar Sync */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="border-b border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-white">Calendar Sync (iCal Allowed Hosts)</h3>
                  <p className="text-[11px] text-slate-400">
                    Security whitelist: hosts can only sync booking calendars from these verified domains.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto rounded-xl border border-slate-800/80 bg-[#0D1117] p-2.5">
                  {cleanDomainList(icalHosts).map((h, i) => (
                    <span key={i} className="rounded-md bg-emerald-950/30 px-2 py-0.5 text-xs text-emerald-300 border border-emerald-800/40">
                      • {h}
                    </span>
                  ))}
                </div>

                <label className="block text-slate-300">
                  <span className="font-semibold text-xs">Allowed Domains (One domain per line)</span>
                  <textarea
                    className={`${input} mt-1 h-44 w-full font-mono text-xs leading-relaxed`}
                    value={icalHosts}
                    onChange={(e) => setIcalHosts(e.target.value)}
                    placeholder="airbnb.com
booking.com
makemytrip.com
vrbo.com"
                  />
                  <span className="mt-1 block text-[10px] text-slate-500">
                    URLs are automatically sanitized to domain names (e.g. pasting https://www.airbnb.com/... stores airbnb.com).
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Sub-Tab 5: WhatsApp Meta Templates                                 */}
        {/* ------------------------------------------------------------------ */}
        {activeSection === "whatsapp" && cfg && (
          <div className="space-y-5 pt-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">WhatsApp Business Meta Templates</h3>
                  <p className="text-[11px] text-slate-400">
                    Configure Meta-approved template names for automated WhatsApp notifications. Empty templates fallback to plain-text (sandbox/test mode).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">Language:</span>
                  <input
                    className={`${input} w-24 font-mono text-xs text-center`}
                    value={cfg.whatsappLanguage ?? "en"}
                    onChange={(e) => setCfgField("whatsappLanguage", e.target.value.trim().toLowerCase())}
                    placeholder="en"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 font-medium text-xs">
                    <tr>
                      <th className="p-2.5">Lifecycle Event</th>
                      <th className="p-2.5">Notification Purpose</th>
                      <th className="p-2.5">Meta Approved Template Name</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {WHATSAPP_EVENTS.map((ev) => {
                      const tName = cfg.whatsappTemplates?.[ev.key] || "";
                      const hasTemplate = !!tName.trim();
                      return (
                        <tr key={ev.key} className="hover:bg-slate-900/40">
                          <td className="p-2.5 font-semibold text-slate-200">{ev.label}</td>
                          <td className="p-2.5 text-slate-400">{ev.purpose}</td>
                          <td className="p-2.5">
                            <input
                              className={`${input} w-full max-w-sm font-mono text-xs`}
                              value={tName}
                              placeholder="e.g. stayride_trip_confirmed"
                              onChange={(e) =>
                                setCfg((c: Any) => ({
                                  ...c,
                                  whatsappTemplates: {
                                    ...(c.whatsappTemplates || {}),
                                    [ev.key]: e.target.value.toLowerCase().replace(/[\s-]+/g, "_"),
                                  },
                                }))
                              }
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            {hasTemplate ? (
                              <Badge tone="green">Meta Template</Badge>
                            ) : (
                              <Badge tone="amber">Plain Text</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Sub-Tab 6: Business & Compliance                                  */}
        {/* ------------------------------------------------------------------ */}
        {activeSection === "business" && cfg && (
          <div className="space-y-5 pt-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-white">Business Entity & Compliance Details</h3>
                <p className="text-[11px] text-slate-400">
                  Rendered in Terms of Service, Privacy Policy, Payment Receipts, and Grievance redressal disclosures.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {BUSINESS_FIELDS.map((f) => (
                  <label key={f.key} className="text-slate-300">
                    <span className="font-semibold">{f.label}</span>
                    {f.hint && <p className="text-[10px] text-slate-500 font-normal mt-0.5">{f.hint}</p>}
                    <input
                      className={`${input} mt-1 w-full`}
                      value={cfg.business?.[f.key] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) =>
                        setCfg((c: Any) => ({
                          ...c,
                          business: { ...(c.business || {}), [f.key]: e.target.value },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Sub-Tab 7: Global Feature Switches                                */}
        {/* ------------------------------------------------------------------ */}
        {activeSection === "features" && (
          <div className="space-y-5 pt-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-white">Global Feature Switches</h3>
                <p className="text-[11px] text-slate-400">
                  Enable or suspend high-level platform modules. Disabling a feature suspends it globally regardless of homestay settings.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {FEATURE_KEYS.map((k) => {
                  const feat = features[k] || { enabled: true, defaultOn: true };
                  return (
                    <div
                      key={k}
                      className="rounded-xl border border-slate-800/80 bg-[#0D1117] p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-semibold text-slate-200">{FEATURE_LABELS[k] || k}</h4>
                          <span className="font-mono text-[10px] text-slate-500">feature_key: {k}</span>
                        </div>
                        <Badge tone={feat.enabled ? "green" : "red"}>
                          {feat.enabled ? "ACTIVE" : "SUSPENDED"}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                        <span className="text-slate-400">Platform-wide enablement</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-700 bg-[#0D1117] text-[#1E7E4B] accent-[#1E7E4B] focus:ring-0"
                          checked={feat.enabled !== false}
                          onChange={(e) =>
                            setFeatures((prev: Any) => ({
                              ...prev,
                              [k]: { ...(prev[k] || {}), enabled: e.target.checked },
                            }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Default on for new homestays</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-700 bg-[#0D1117] text-[#1E7E4B] accent-[#1E7E4B] focus:ring-0"
                          checked={feat.defaultOn !== false}
                          onChange={(e) =>
                            setFeatures((prev: Any) => ({
                              ...prev,
                              [k]: { ...(prev[k] || {}), defaultOn: e.target.checked },
                            }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Sticky Bottom Save Action Bar                                      */}
        {/* ------------------------------------------------------------------ */}
        {dirty && (
          <div className="sticky bottom-4 z-40 rounded-xl border border-slate-700/80 bg-[#121820]/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-xs font-semibold text-white">Unsaved configuration changes</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Settings are staged locally. A change reason is required to commit to audit logs.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 flex-1 max-w-lg justify-end">
                <input
                  className={`${input} flex-1 min-w-[200px] text-xs`}
                  required
                  placeholder="Audit Change Reason (e.g. Updated holiday route fares) *"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button
                  type="button"
                  onClick={resetAll}
                  className={btn.ghost}
                  disabled={saving}
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => saveAll()}
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-900/50 disabled:opacity-50"
                >
                  {saving ? "Saving..." : `Save ${demo ? "DEMO" : "PRODUCTION"} Settings`}
                </button>
              </div>
            </div>
          </div>
        )}
      </Panel>
    </div>
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
const AUDIT_FILTERS = { action: "", targetId: "", tenantId: "", driverId: "", actorRole: "", actor: "", from: "", to: "" };

function renderAuditDetails(details: Any, onInspect: (data: Any) => void) {
  if (!details || (typeof details === "object" && Object.keys(details).length === 0)) {
    return <span className="text-slate-600">—</span>;
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {details.amount !== undefined && (
          <Badge tone="green">₹{Number(details.amount).toLocaleString("en-IN")}</Badge>
        )}
        {details.driverShareOfAdvance !== undefined && (
          <Badge tone="blue">Driver Share: ₹{Number(details.driverShareOfAdvance).toLocaleString("en-IN")}</Badge>
        )}
        {(details.utr || details.transactionId || details.reference) && (
          <span className="font-mono text-[10px] text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-900/40">
            Ref: {details.utr || details.transactionId || details.reference}
          </span>
        )}
        {details.status && (
          <Badge tone="slate">{String(details.status)}</Badge>
        )}
        {details.targetName && (
          <span className="font-semibold text-white">{String(details.targetName)}</span>
        )}
        {details.reason && (
          <span className="text-slate-300 italic text-[11px]">"{String(details.reason)}"</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => onInspect(details)}
        className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline font-mono"
      >
        inspect raw payload
      </button>
    </div>
  );
}

export function AuditTab({ demo }: TabProps) {
  const [f, setF] = useState(AUDIT_FILTERS);
  const [q, setQ] = useState(AUDIT_FILTERS);
  const [viewJson, setViewJson] = useState<Any | null>(null);
  const set = (k: keyof typeof AUDIT_FILTERS) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  // Date inputs are IST calendar days: from 00:00 IST to the end of the "to" day in IST.
  const { from, to, ...rest } = q;
  const query = { ...rest, startDate: from ? `${from}T00:00:00+05:30` : "", endDate: to ? `${to}T23:59:59.999+05:30` : "" };
  const [page, setPage] = useState(0);
  const { data, error, loading, reload, updatedAt } = useLoad(
    () => adminApi("/audit-log", { demo, query: { ...query, ...pq(page) } }).then(toPage),
    [demo, q, page],
    true
  );
  const items = data?.items || [];

  const handleReset = () => {
    setF(AUDIT_FILTERS);
    setQ(AUDIT_FILTERS);
    setPage(0);
  };

  return (
    <Panel
      title="Audit Log"
      subtitle="Complete chronological audit trail of all platform operations, money settlements, and administrative actions."
      onRefresh={reload}
      error={error}
      loading={loading}
      updatedAt={updatedAt}
    >
      {/* STRUCTURED TWO-TIER FILTER TOOLBAR */}
      <form onSubmit={(e) => { e.preventDefault(); setPage(0); setQ(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()])) as typeof f); }} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Action</label>
            <input className={`${input} w-full`} placeholder="e.g. payment.record" value={f.action} onChange={set("action")} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Actor filter</label>
            <input className={`${input} w-full`} placeholder="Actor name or email" value={f.actor} onChange={set("actor")} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Actor role</label>
            <select className={`${input} w-full`} value={f.actorRole} onChange={set("actorRole")} aria-label="Actor role">
              <option value="">Any Role</option>
              {["ADMIN", "OWNER", "DRIVER", "CUSTOMER", "SYSTEM"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Date range (DD/MM/YYYY)</label>
            <div className="flex items-center gap-1.5">
              <DatePickerDDMMYYYY value={f.from} onChange={(d) => setF((prev) => ({ ...prev, from: d }))} placeholder="From" />
              <span className="text-slate-500">→</span>
              <DatePickerDDMMYYYY value={f.to} onChange={(d) => setF((prev) => ({ ...prev, to: d }))} placeholder="To" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1 border-t border-slate-800/60">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Target ID</label>
            <input className={`${input} w-full`} placeholder="Target ID" value={f.targetId} onChange={set("targetId")} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Homestay tenant</label>
            <input className={`${input} w-full`} placeholder="Owner email / key" value={f.tenantId} onChange={set("tenantId")} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Driver ID</label>
            <input className={`${input} w-full`} placeholder="Driver ID" value={f.driverId} onChange={set("driverId")} />
          </div>
          <div className="sm:col-span-2 flex items-end justify-end gap-2">
            <button type="button" onClick={handleReset} className={btn.ghost}>Reset all</button>
            <button type="submit" className={btn.primary}>Apply filters</button>
          </div>
        </div>
      </form>

      {viewJson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800/80 bg-[#121820] p-6 shadow-xl text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="font-semibold text-white text-sm">Audit Payload Details</h4>
              <button type="button" onClick={() => setViewJson(null)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>
            <pre className="max-h-[60vh] overflow-y-auto rounded-xl bg-[#0D1117] p-3 font-mono text-[11px] text-emerald-400 whitespace-pre-wrap break-all border border-slate-800">
              {JSON.stringify(viewJson, null, 2)}
            </pre>
            <div className="text-right">
              <button type="button" onClick={() => setViewJson(null)} className={btn.primary}>Close</button>
            </div>
          </div>
        </div>
      )}

      {data &&
        (items.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 font-medium text-xs">
                <tr>
                  <th className="p-3 w-40">When (IST)</th>
                  <th className="p-3 w-48">Actor</th>
                  <th className="p-3 w-48">Action</th>
                  <th className="p-3 w-44">Target</th>
                  <th className="p-3">Event Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((l, i) => (
                  <tr key={rid(l) || i} className="align-top hover:bg-slate-900/40 transition">
                    <td className="p-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">{dt(l.createdAt)}</td>
                    <td className="p-3 text-slate-200">
                      <div className="font-semibold text-slate-100">{l.actorDisplayName || l.actor}</div>
                      {l.actorDisplayName && l.actor !== l.actorDisplayName && (
                        <div className="font-mono text-[10px] text-slate-500">{l.actor}</div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-emerald-400 font-semibold">{l.action}</td>
                    <td className="p-3 text-slate-300">
                      <div className="font-semibold text-slate-200">{l.targetLabel || l.targetType}</div>
                      <span className="font-mono text-[10px] text-slate-500">{l.targetId}</span>
                    </td>
                    <td className="p-3">
                      {renderAuditDetails(l.details, (payload) => setViewJson(payload))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No audit entries for this query.</Empty>
        ))}
      <Pager page={page} setPage={setPage} total={data?.total ?? null} count={items.length} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 10. Guests staying (all homestays): ask for cab, call, last contacted
// ---------------------------------------------------------------------------
const GUEST_FILTERS: Record<string, { label: string; status?: string }> = {
  all: { label: "All" },
  booked: { label: "Booked", status: "CONFIRMED" },
  in: { label: "Checked in", status: "CHECKED_IN" },
};

export function GuestsTab({ demo, initialSearch, initialTenant }: TabProps & { initialSearch?: string; initialTenant?: string }) {
  const [filter, setFilter] = useState("all");
  const [text, setText] = useState(initialSearch || "");
  const [q, setQ] = useState(initialSearch || "");
  const [page, setPage] = useState(0);
  const { data, error, loading, reload, updatedAt } = useLoad(
    () => adminApi("/stayride/guests-staying", { demo, query: { status: GUEST_FILTERS[filter].status, q, tenant: initialTenant || undefined, ...pq(page) } }).then(toPage),
    [demo, filter, q, initialTenant, page],
    true
  );
  const items = data?.items || [];
  return (
    <Panel
      title="Guests staying"
      subtitle="Booked and checked-in guests across every homestay, current stays first. Times in IST."
      onRefresh={reload}
      error={error}
      loading={loading}
      updatedAt={updatedAt}
      right={
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setQ(text.trim()); }} className="flex gap-2">
          <input className={input} placeholder="Name, phone or homestay" value={text} onChange={(e) => setText(e.target.value)} />
          <button className={btn.primary}>Search</button>
        </form>
      }
    >
      <div className="flex flex-wrap gap-2">
        {Object.entries(GUEST_FILTERS).map(([key, v]) => (
          <button key={key} onClick={() => { setFilter(key); setPage(0); }} className={chip(filter === key)}>{v.label}</button>
        ))}
      </div>
      {data &&
        (items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 font-medium text-xs">
                <tr>
                  <th className="p-3 min-w-[140px]">Guest</th>
                  <th className="p-3 min-w-[130px]">Phone</th>
                  <th className="p-3 min-w-[140px]">Homestay</th>
                  <th className="p-3 min-w-[90px]">Status</th>
                  <th className="p-3 min-w-[130px]">Stay Dates</th>
                  <th className="p-3 min-w-[200px]">Last Contacted</th>
                  <th className="p-3 text-right min-w-[160px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((g) => <GuestRow key={`${g.tenantKey}:${g.id}`} g={g} demo={demo} onChanged={reload} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No guests staying for this filter.</Empty>
        ))}
      <Pager page={page} setPage={setPage} total={data?.total ?? null} count={items.length} />
    </Panel>
  );
}

function GuestRow({ g, demo, onChanged }: { g: Any; demo: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const path = `/stayride/tenants/${encodeURIComponent(g.tenantKey)}/bookings/${g.id}`;

  // Once the booking was asked the server answers ALREADY_SENT with its history; the admin confirms to send anyway.
  async function askCab(force = false): Promise<void> {
    setBusy(true);
    try {
      const r = await adminApi(`${path}/ask-cab`, { method: "POST", body: { force }, demo });
      if (r?.data?.status === "ALREADY_SENT") {
        if (window.confirm(r.data.confirm)) await askCab(true);
        return;
      }
      alert(r?.message || "Done.");
      onChanged();
    } catch (e: any) {
      alert(e?.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  // The tel: link opens the phone app; this only records that a call was started.
  const recordCall = () => adminApi(`${path}/call`, { method: "POST", body: {}, demo }).then(onChanged).catch((e) => alert(e?.message || "Call not recorded."));
  const copy = () => navigator.clipboard?.writeText(g.tel || g.phone).then(() => alert("Number copied."), () => alert(g.tel || g.phone));

  return (
    <tr className="align-top hover:bg-slate-900/40 transition">
      <td className="p-3 font-semibold text-slate-100">{g.guestName || "Guest"}<div className="text-[10px] font-normal text-slate-500">Room {g.roomNumber || "—"}</div></td>
      <td className="p-3 whitespace-nowrap font-mono text-slate-200">
        {g.tel || g.phone || "—"}
        {g.phoneMissing && <div className="text-[10px] text-amber-400 font-sans font-medium">No WhatsApp phone</div>}
      </td>
      <td className="p-3 text-slate-300">{g.homestayName || g.tenantKey}</td>
      <td className="p-3"><Badge tone={g.status === "CHECKED_IN" ? "green" : "blue"}>{g.status === "CHECKED_IN" ? "Checked in" : "Booked"}</Badge></td>
      <td className="p-3 whitespace-nowrap text-slate-400">{formatDate(g.checkIn)} → {formatDate(g.checkOut)}</td>
      <td className="p-3 text-[11px] text-slate-400 space-y-1.5 max-w-[240px]">
        {(g.askCab || []).slice(0, 3).map((line: string, i: number) => {
          const parts = line.split(" · ");
          const actor = parts[0] || "Admin";
          const time = parts[1] || "";
          const status = parts[2] || "";
          return (
            <div key={i} className="flex items-center gap-1.5 flex-wrap text-[11px] leading-tight">
              <span className="font-semibold text-slate-300">Cab ask:</span>
              <span className="text-slate-400">{time || actor}</span>
              {status && (
                <Badge tone={status === "read" ? "green" : status === "delivered" ? "blue" : status === "failed" ? "red" : "slate"}>
                  {status}
                </Badge>
              )}
            </div>
          );
        })}
        {g.lastCall && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400">
            <span>Call:</span>
            <span>{dt(g.lastCall.at)}</span>
          </div>
        )}
        {!g.askCab?.length && !g.lastCall && <span className="text-slate-600">—</span>}
      </td>
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <button
            className={g.phoneMissing ? "cursor-not-allowed rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-500" : btn.primary}
            disabled={busy || g.phoneMissing}
            title={g.phoneMissing ? "Guest phone is missing or invalid for WhatsApp" : undefined}
            onClick={() => askCab()}
          >
            {busy ? "Sending..." : "Ask for cab"}
          </button>
          {g.tel && <a className={btn.ok} href={`tel:${g.tel}`} onClick={recordCall}>Call</a>}
          {(g.tel || g.phone) && <button className={btn.ghost} onClick={copy}>Copy</button>}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Notification bell: new bookings, check-ins, cab requests and "guest says paid" claims
// ---------------------------------------------------------------------------
type Seen = { at: number; ids: string[] };
// ponytail: read state is per browser (localStorage), not per admin account; move "last seen" onto the admin user record if it must follow the admin across devices.
const seenKey = (demo: boolean) => `staycabs_admin_seen_${demo ? "demo" : "live"}`;
function readSeen(demo: boolean): Seen {
  try {
    const v = JSON.parse(window.localStorage.getItem(seenKey(demo)) || "null");
    if (typeof v?.at === "number") return { at: v.at, ids: Array.isArray(v.ids) ? v.ids : [] };
  } catch {}
  return { at: Date.now() - 86400000, ids: [] }; // a new browser starts with the last 24h unread
}
let audio: AudioContext | null = null; // created on a bell click: browsers only play sound after a user gesture
function beep() {
  try {
    if (!audio) return;
    const o = audio.createOscillator();
    const gain = audio.createGain();
    o.frequency.value = 880;
    gain.gain.value = 0.08;
    o.connect(gain).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.15);
  } catch {}
}

export function NotificationBell({ demo, onOpen }: TabProps & { onOpen: (n: Any) => void }) {
  const [seen, setSeenState] = useState<Seen>(() => readSeen(demo));
  const [feed, setFeed] = useState<{ unread: number; items: Any[] } | null>(null);
  const [open, setOpen] = useState(false);
  const newest = useRef<number | null>(null);
  const setSeen = (s: Seen) => {
    setSeenState(s);
    try {
      window.localStorage.setItem(seenKey(demo), JSON.stringify(s));
    } catch {}
  };

  // Polls even while the browser tab is in the background, so pop-ups still arrive.
  useEffect(() => {
    let alive = true;
    const load = () => adminApi("/stayride/notifications", { demo, query: { since: seen.at } }).then((r) => alive && setFeed(r.data)).catch(() => {});
    load();
    const id = window.setInterval(load, AUTO_REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [demo, seen.at]);

  // Pop-up and sound only for items that arrived after the first load
  useEffect(() => {
    const items = feed?.items || [];
    if (!items.length) return;
    const top = Math.max(...items.map((i) => i.at));
    if (newest.current !== null) {
      const fresh = items.filter((i) => i.at > newest.current!);
      if (fresh.length) {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          for (const i of fresh.slice(0, 3)) new Notification(i.title, { body: i.sub, tag: i.id });
        }
        beep();
      }
    }
    newest.current = Math.max(newest.current ?? 0, top);
  }, [feed]);

  const items = feed?.items || [];
  const isUnread = (i: Any) => i.at > seen.at && !seen.ids.includes(i.id);
  const unread = Math.max(0, (feed?.unread ?? 0) - items.filter((i) => i.at > seen.at && seen.ids.includes(i.id)).length);

  function toggle() {
    if (!audio && typeof AudioContext !== "undefined") audio = new AudioContext();
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    setOpen(!open);
  }
  function openItem(i: Any) {
    if (isUnread(i)) setSeen({ at: seen.at, ids: [i.id, ...seen.ids].slice(0, 50) });
    setOpen(false);
    onOpen(i);
  }
  // Server time of the newest item, so a skewed browser clock can't hide anything
  const markAll = () => setSeen({ at: Math.max(seen.at, ...items.map((i) => i.at)), ids: [] });

  return (
    <div className="relative">
      <button onClick={toggle} className="relative flex items-center rounded-lg border border-slate-700/80 bg-[#121820] px-2.5 py-1.5 text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer" aria-label={`Notifications, ${unread} unread`}>
        <span className="material-symbols-outlined text-lg">notifications</span>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 rounded-md bg-rose-600 px-1.5 text-[10px] font-semibold text-white tabular-nums">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-slate-800/80 bg-[#121820] p-3 text-xs shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-white">Notifications</span>
            <button className={btn.ghost} onClick={markAll} disabled={!unread}>Mark all read</button>
          </div>
          {items.length ? (
            <ul className="max-h-96 divide-y divide-slate-800/60 overflow-y-auto">
              {items.map((i) => (
                <li key={`${i.kind}:${i.id}`}>
                  <button onClick={() => openItem(i)} className="w-full p-2 text-left hover:bg-slate-900">
                    <div className={isUnread(i) ? "font-bold text-white" : "text-slate-400"}>{i.title}</div>
                    <div className="text-[10px] text-slate-500">{[i.sub, dt(i.at)].filter(Boolean).join(" • ")}</div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing yet.</Empty>
          )}
        </div>
      )}
    </div>
  );
}
