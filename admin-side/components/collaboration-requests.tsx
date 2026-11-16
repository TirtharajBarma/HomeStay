"use client";

import { useState, useEffect } from "react";
import { API_ENDPOINTS, apiFetch, readApiError } from "@/lib/api-config";

export type CollaborationStatus =
  | "PENDING"
  | "CONTACTED"
  | "IN_NEGOTIATION"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED";

export interface CollaborationRequestItem {
  _id: string;
  influencerId: any;
  influencerName: string;
  influencerHandle: string;
  influencerPhoto?: string;
  homestayName: string;
  homestayLocation?: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  selectedPackage?: {
    name: string;
    price: number;
    deliverables?: string;
  };
  customRequirements?: string;
  proposedDates?: string;
  status: CollaborationStatus;
  negotiatedPrice?: number;
  confirmedShootingDate?: string;
  deliveredPostUrl?: string;
  adminNotes?: string;
  statusHistory?: Array<{
    status: CollaborationStatus;
    updatedAt: string;
    note?: string;
    updatedBy?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const STATUS_BADGES: Record<
  CollaborationStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  PENDING: {
    label: "Pending Review",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  CONTACTED: {
    label: "Contacted",
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/30",
  },
  IN_NEGOTIATION: {
    label: "In Negotiation",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/30",
  },
  CONFIRMED: {
    label: "Shoot Confirmed",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  COMPLETED: {
    label: "Campaign Completed",
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    border: "border-indigo-500/30",
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/30",
  },
};

export function CollaborationRequests({ demo }: { demo?: boolean }) {
  const [requests, setRequests] = useState<CollaborationRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    contacted: 0,
    inNegotiation: 0,
    confirmed: 0,
    completed: 0,
  });
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Edit / Status Modal
  const [selectedRequest, setSelectedRequest] = useState<CollaborationRequestItem | null>(null);
  const [newStatus, setNewStatus] = useState<CollaborationStatus>("PENDING");
  const [adminNotes, setAdminNotes] = useState("");
  const [negotiatedPrice, setNegotiatedPrice] = useState("");
  const [confirmedShootingDate, setConfirmedShootingDate] = useState("");
  const [deliveredPostUrl, setDeliveredPostUrl] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [updating, setUpdating] = useState(false);

  async function fetchRequests() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter !== "ALL") q.set("status", statusFilter);
      if (search.trim()) q.set("search", search.trim());
      if (demo) q.set("demo", "true");

      const [res, statsRes] = await Promise.all([
        apiFetch(API_ENDPOINTS.collaborationRequestsAdmin(q.toString())),
        apiFetch(API_ENDPOINTS.collaborationRequestAdminStats()),
      ]);

      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setRequests(json.data);
        }
      }

      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson.success && statsJson.data) {
          setStats(statsJson.data);
        }
      }
    } catch (err) {
      console.error("Error fetching collaboration requests:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, demo]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      fetchRequests();
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  function openStatusModal(req: CollaborationRequestItem) {
    setSelectedRequest(req);
    setNewStatus(req.status);
    setAdminNotes(req.adminNotes || "");
    setNegotiatedPrice(req.negotiatedPrice ? String(req.negotiatedPrice) : "");
    setConfirmedShootingDate(req.confirmedShootingDate || "");
    setDeliveredPostUrl(req.deliveredPostUrl || "");
    setStatusNote("");
  }

  async function handleUpdateStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest) return;

    setUpdating(true);
    try {
      const res = await apiFetch(
        API_ENDPOINTS.collaborationRequestUpdateStatus(selectedRequest._id),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: newStatus,
            adminNotes: adminNotes.trim(),
            negotiatedPrice: negotiatedPrice ? parseFloat(negotiatedPrice) : undefined,
            confirmedShootingDate: confirmedShootingDate.trim(),
            deliveredPostUrl: deliveredPostUrl.trim(),
            statusNote: statusNote.trim() || undefined,
          }),
        }
      );

      if (res.ok) {
        setSelectedRequest(null);
        fetchRequests();
      } else {
        const err = await readApiError(res, "Failed to update collaboration status");
        alert(err);
      }
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & KPI Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-400 text-2xl">handshake</span>
            <h1 className="text-xl font-bold text-white tracking-tight">Collaboration Requests</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Incoming influencer collaboration invites submitted by homestay owners from the mobile app.
          </p>
        </div>

        <button
          onClick={fetchRequests}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer self-start md:self-auto text-xs"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-slate-800 bg-[#121820] p-3.5">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Requests</div>
          <div className="text-xl font-bold text-white mt-1">{stats.total || requests.length}</div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
          <div className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">Pending Review</div>
          <div className="text-xl font-bold text-amber-300 mt-1">{stats.pending || 0}</div>
        </div>

        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5">
          <div className="text-[10px] font-medium text-sky-400 uppercase tracking-wider">Contacted</div>
          <div className="text-xl font-bold text-sky-300 mt-1">{stats.contacted || 0}</div>
        </div>

        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5">
          <div className="text-[10px] font-medium text-purple-400 uppercase tracking-wider">In Negotiation</div>
          <div className="text-xl font-bold text-purple-300 mt-1">{stats.inNegotiation || 0}</div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
          <div className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">Confirmed Shoots</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{stats.confirmed || 0}</div>
        </div>

        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3.5">
          <div className="text-[10px] font-medium text-indigo-400 uppercase tracking-wider">Completed</div>
          <div className="text-xl font-bold text-indigo-300 mt-1">{stats.completed || 0}</div>
        </div>
      </div>

      {/* 2. Filter Bar & Search */}
      <div className="rounded-xl border border-slate-800 bg-[#121820] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { key: "ALL", label: "All Requests" },
            { key: "PENDING", label: "Pending" },
            { key: "CONTACTED", label: "Contacted" },
            { key: "IN_NEGOTIATION", label: "Negotiating" },
            { key: "CONFIRMED", label: "Confirmed" },
            { key: "COMPLETED", label: "Completed" },
            { key: "CANCELLED", label: "Cancelled" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                statusFilter === tab.key
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-slate-800/80 text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-sm">
            search
          </span>
          <input
            type="text"
            placeholder="Search homestay, owner, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-700 bg-[#161F2C] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* 3. Requests Table / Cards */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 text-xs">
          <span className="material-symbols-outlined text-3xl animate-spin text-purple-500 block mb-2">
            progress_activity
          </span>
          Loading collaboration requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="p-16 text-center rounded-xl border border-dashed border-slate-800 bg-[#121820]/40 space-y-2">
          <span className="material-symbols-outlined text-4xl text-slate-600 block">
            inbox
          </span>
          <p className="text-sm font-semibold text-slate-300">No collaboration requests found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            When homestay owners browse influencers and click &quot;Invite to Collaborate&quot; in the mobile app, their requests will appear here instantly.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((item) => {
            const badge = STATUS_BADGES[item.status] || STATUS_BADGES.PENDING;
            const waOwnerUrl = `https://wa.me/91${item.ownerPhone}?text=${encodeURIComponent(
              `Hi ${item.ownerName}, regarding your collaboration request for ${item.homestayName} with ${item.influencerName} on StayCabs Promote...`
            )}`;

            return (
              <div
                key={item._id}
                className="rounded-xl border border-slate-800 bg-[#121820] p-4 hover:border-slate-700 transition space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  {/* Homestay & Owner Info */}
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-700 to-indigo-800 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      <span className="material-symbols-outlined text-lg">villa</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-sm">{item.homestayName}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>Owner: <strong className="text-slate-200">{item.ownerName}</strong></span>
                        <span>•</span>
                        <span className="font-mono text-purple-400">+91 {item.ownerPhone}</span>
                        {item.homestayLocation && (
                          <>
                            <span>•</span>
                            <span>{item.homestayLocation}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Date & Quick Actions */}
                  <div className="flex items-center gap-2 self-start md:self-auto">
                    {/* WhatsApp Direct Action */}
                    <a
                      href={waOwnerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition cursor-pointer"
                      title="Open WhatsApp chat with homestay owner"
                    >
                      <span className="material-symbols-outlined text-sm">chat</span>
                      <span>Chat Owner</span>
                    </a>

                    {/* Manage Status Button */}
                    <button
                      onClick={() => openStatusModal(item)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">edit_note</span>
                      <span>Update Status</span>
                    </button>
                  </div>
                </div>

                {/* Collaboration Details: Influencer & Package */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-[#161F2C] p-3 rounded-lg border border-slate-800">
                  {/* Targeted Influencer */}
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium">Invited Creator</span>
                    <div className="font-semibold text-white mt-0.5 flex items-center gap-1.5">
                      {item.influencerPhoto && (
                        <img
                          src={item.influencerPhoto}
                          alt={item.influencerName}
                          className="h-5 w-5 rounded-full object-cover"
                        />
                      )}
                      <span>{item.influencerName}</span>
                    </div>
                    <div className="text-[11px] text-purple-400">{item.influencerHandle}</div>
                  </div>

                  {/* Selected Package */}
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium">Requested Package</span>
                    <div className="font-semibold text-slate-200 mt-0.5">
                      {item.selectedPackage?.name || "Standard Promotion"}
                    </div>
                    <div className="text-[11px] text-amber-300 font-mono">
                      ₹{item.selectedPackage?.price?.toLocaleString() || "5,000"}
                    </div>
                  </div>

                  {/* Proposed Dates */}
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium">Proposed Dates</span>
                    <div className="font-medium text-slate-200 mt-0.5">
                      {item.proposedDates || "Flexible / host to decide"}
                    </div>
                    {item.confirmedShootingDate && (
                      <div className="text-[11px] text-emerald-400 font-medium">
                        Locked: {item.confirmedShootingDate}
                      </div>
                    )}
                  </div>

                  {/* Request Age */}
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium">Submitted On</span>
                    <div className="text-slate-300 mt-0.5">
                      {new Date(item.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>

                {/* Custom Notes / Requirements from Owner */}
                {item.customRequirements && (
                  <div className="text-xs bg-[#0E131A] p-2.5 rounded-lg border border-slate-800/80 text-slate-300">
                    <span className="text-slate-500 font-semibold mr-1">Owner&apos;s Message:</span>
                    {item.customRequirements}
                  </div>
                )}

                {/* Admin Internal Notes */}
                {item.adminNotes && (
                  <div className="text-xs bg-purple-950/20 p-2.5 rounded-lg border border-purple-900/30 text-purple-200 flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-sm text-purple-400 shrink-0">
                      sticky_note_2
                    </span>
                    <div>
                      <span className="font-semibold text-purple-300">Admin Notes: </span>
                      {item.adminNotes}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Update Status & Negotiation Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-800 bg-[#121820] shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-[#161F2C]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">edit_note</span>
                <h3 className="font-semibold text-white text-sm">
                  Update Collaboration Status
                </h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-[11px] text-slate-400">Homestay & Creator</span>
                <div className="text-white font-semibold text-sm">
                  {selectedRequest.homestayName} ⇄ {selectedRequest.influencerName}
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Collaboration Status <span className="text-rose-400">*</span>
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as CollaborationStatus)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white focus:outline-none focus:border-purple-500 font-medium cursor-pointer"
                >
                  <option value="PENDING">Pending Review</option>
                  <option value="CONTACTED">Contacted (Spoke with Owner / Creator)</option>
                  <option value="IN_NEGOTIATION">In Negotiation (Pricing / Dates Discussion)</option>
                  <option value="CONFIRMED">Shoot Confirmed (Dates & Booking Locked)</option>
                  <option value="COMPLETED">Campaign Completed (Reel Published)</option>
                  <option value="CANCELLED">Cancelled / Declined</option>
                </select>
              </div>

              {/* Negotiated Price & Confirmed Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Final / Negotiated Price (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 6000"
                    value={negotiatedPrice}
                    onChange={(e) => setNegotiatedPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Confirmed Shooting Date
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 15-17 Dec 2026"
                    value={confirmedShootingDate}
                    onChange={(e) => setConfirmedShootingDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Delivered Post URL */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Published Reel / Post URL
                </label>
                <input
                  type="url"
                  placeholder="https://instagram.com/reel/..."
                  value={deliveredPostUrl}
                  onChange={(e) => setDeliveredPostUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Admin Internal Notes */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Admin Internal Notes / Conversation Log
                </label>
                <textarea
                  rows={3}
                  placeholder="Notes on discussions with creator and homestay host, payment terms, travel arrangements..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Status Note */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Reason / Log Note for Status Change (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Creator agreed to 2-night stay for 1 dedicated reel."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={updating}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition cursor-pointer disabled:opacity-50"
                >
                  {updating && (
                    <span className="material-symbols-outlined text-sm animate-spin">
                      progress_activity
                    </span>
                  )}
                  <span>Save Status</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
