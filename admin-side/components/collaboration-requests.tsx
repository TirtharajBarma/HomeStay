"use client";

import { useState, useEffect } from "react";
import { API_ENDPOINTS, apiFetch, readApiError } from "@/lib/api-config";

export type CollaborationStatus =
  | "NEW"
  | "PENDING"
  | "CONTACTED"
  | "FINDING INFLUENCERS"
  | "IN_NEGOTIATION"
  | "PROPOSAL SENT"
  | "CONFIRMED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type CollaborationCategory =
  | "ALL"
  | "BUDGET_BASED_PROMOTION"
  | "INFLUENCER_COLLABORATION";

export interface CollaborationRequestItem {
  _id: string;
  requestId?: string;
  requestType?: "INFLUENCER_COLLABORATION" | "BUDGET_BASED_PROMOTION";
  budget?: number;
  preferredDestination?: string;
  promotionRequirements?: string;
  additionalMessage?: string;
  assignedInfluencerId?: any;
  assignedInfluencerName?: string;
  agreedPrice?: number;
  influencerId?: any;
  influencerName?: string;
  influencerHandle?: string;
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
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  NEW: {
    label: "New Request",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
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
  "FINDING INFLUENCERS": {
    label: "Finding Influencers",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/30",
  },
  IN_NEGOTIATION: {
    label: "In Negotiation",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/30",
  },
  "PROPOSAL SENT": {
    label: "Proposal Sent",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    border: "border-violet-500/30",
  },
  CONFIRMED: {
    label: "Confirmed",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  COMPLETED: {
    label: "Completed",
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    border: "border-indigo-500/30",
  },
  REJECTED: {
    label: "Rejected",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/30",
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
    new: 0,
    contacted: 0,
    inNegotiation: 0,
    confirmed: 0,
    completed: 0,
    budgetRequests: 0,
  });
  const [categoryFilter, setCategoryFilter] = useState<CollaborationCategory>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Edit / Status Modal
  const [selectedRequest, setSelectedRequest] = useState<CollaborationRequestItem | null>(null);
  const [newStatus, setNewStatus] = useState<CollaborationStatus>("NEW");
  const [assignedInfluencerName, setAssignedInfluencerName] = useState("");
  const [agreedPrice, setAgreedPrice] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [confirmedShootingDate, setConfirmedShootingDate] = useState("");
  const [deliveredPostUrl, setDeliveredPostUrl] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [updating, setUpdating] = useState(false);

  async function fetchRequests() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter !== "ALL") q.set("status", statusFilter);
      if (categoryFilter !== "ALL") q.set("requestType", categoryFilter);
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
          if (json.stats) {
            setStats((prev) => ({ ...prev, ...json.stats }));
          }
        }
      }

      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson.success && statsJson.data) {
          setStats((prev) => ({ ...prev, ...statsJson.data }));
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
  }, [categoryFilter, statusFilter, demo]);

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
    setAssignedInfluencerName(req.assignedInfluencerName || req.influencerName || "");
    setAgreedPrice(
      req.agreedPrice
        ? String(req.agreedPrice)
        : req.negotiatedPrice
        ? String(req.negotiatedPrice)
        : ""
    );
    setAdminNotes(req.adminNotes || "");
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
            assignedInfluencerName: assignedInfluencerName.trim() || undefined,
            agreedPrice: agreedPrice ? parseFloat(agreedPrice) : undefined,
            negotiatedPrice: agreedPrice ? parseFloat(agreedPrice) : undefined,
            adminNotes: adminNotes.trim(),
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
            <span className="material-symbols-outlined text-purple-400 text-2xl">campaign</span>
            <h1 className="text-xl font-bold text-white tracking-tight">Collaboration & Promotion Requests</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage homestay promotion budget requests and creator collaboration invites submitted from the StayCabs app.
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

      {/* Primary Category Selector: Requests for Promotion vs Direct Creator Invites */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setCategoryFilter("ALL")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
            categoryFilter === "ALL"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "bg-[#121820] text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-sm">view_list</span>
          <span>All Requests ({stats.total || requests.length})</span>
        </button>

        <button
          onClick={() => setCategoryFilter("BUDGET_BASED_PROMOTION")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
            categoryFilter === "BUDGET_BASED_PROMOTION"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "bg-[#121820] text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-sm">price_change</span>
          <span>Requests for Promotion (Budget-Based)</span>
          {stats.budgetRequests ? (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-purple-400/20 text-purple-300">
              {stats.budgetRequests}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setCategoryFilter("INFLUENCER_COLLABORATION")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
            categoryFilter === "INFLUENCER_COLLABORATION"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "bg-[#121820] text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-sm">stars</span>
          <span>Direct Influencer Invites</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-slate-800 bg-[#121820] p-3.5">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Requests</div>
          <div className="text-xl font-bold text-white mt-1">{stats.total || requests.length}</div>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
          <div className="text-[10px] font-medium text-blue-400 uppercase tracking-wider">New Requests</div>
          <div className="text-xl font-bold text-blue-300 mt-1">{stats.new || 0}</div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
          <div className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">Pending / Review</div>
          <div className="text-xl font-bold text-amber-300 mt-1">{stats.pending || 0}</div>
        </div>

        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5">
          <div className="text-[10px] font-medium text-purple-400 uppercase tracking-wider">Finding / Negot.</div>
          <div className="text-xl font-bold text-purple-300 mt-1">{stats.inNegotiation || 0}</div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
          <div className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">Confirmed</div>
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
            { key: "ALL", label: "All Status" },
            { key: "NEW", label: "New" },
            { key: "CONTACTED", label: "Contacted" },
            { key: "FINDING INFLUENCERS", label: "Finding" },
            { key: "PROPOSAL SENT", label: "Proposal Sent" },
            { key: "CONFIRMED", label: "Confirmed" },
            { key: "COMPLETED", label: "Completed" },
            { key: "REJECTED", label: "Rejected" },
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
            placeholder="Search req ID, homestay, owner, phone..."
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
          Loading requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="p-16 text-center rounded-xl border border-dashed border-slate-800 bg-[#121820]/40 space-y-2">
          <span className="material-symbols-outlined text-4xl text-slate-600 block">
            inbox
          </span>
          <p className="text-sm font-semibold text-slate-300">No requests found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            When homestay owners submit budget promotion requests or invite creators in the mobile app, their requests will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((item) => {
            const badge = STATUS_BADGES[item.status] || STATUS_BADGES.NEW;
            const isBudgetPromotion = item.requestType === "BUDGET_BASED_PROMOTION";
            const reqIdDisplay = item.requestId || `REQ-${item._id.slice(-6).toUpperCase()}`;

            const waOwnerUrl = `https://wa.me/91${item.ownerPhone}?text=${encodeURIComponent(
              `Hi ${item.ownerName}, regarding your ${
                isBudgetPromotion ? `StayCabs budget promotion request (${reqIdDisplay})` : `collaboration request for ${item.homestayName}`
              }...`
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
                      <span className="material-symbols-outlined text-lg">
                        {isBudgetPromotion ? "price_change" : "villa"}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-purple-400 font-bold bg-purple-950/40 border border-purple-800/50 px-2 py-0.5 rounded">
                          {reqIdDisplay}
                        </span>
                        <h3 className="font-bold text-white text-sm">{item.homestayName}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {badge.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isBudgetPromotion
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                              : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                          }`}
                        >
                          {isBudgetPromotion ? "Requests for Promotion" : "Direct Invite"}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
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
                      <span>Contact Owner</span>
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

                {/* Details Section */}
                {isBudgetPromotion ? (
                  /* Budget Based Promotion Grid */
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-[#161F2C] p-3 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-medium">Quoted Budget</span>
                      <div className="text-base font-bold text-amber-300 font-mono mt-0.5">
                        ₹{item.budget?.toLocaleString() || "0"}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-medium">Preferred Region</span>
                      <div className="font-semibold text-slate-200 mt-0.5">
                        {item.preferredDestination || item.homestayLocation || "All Mountain Regions"}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-medium">Requirements</span>
                      <div className="font-medium text-purple-300 mt-0.5">
                        {item.promotionRequirements || "Reel / Travel Content"}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-medium">Request Date</span>
                      <div className="text-slate-300 mt-0.5">
                        {new Date(item.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Influencer Invite Grid */
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-[#161F2C] p-3 rounded-lg border border-slate-800">
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

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-medium">Requested Package</span>
                      <div className="font-semibold text-slate-200 mt-0.5">
                        {item.selectedPackage?.name || "Standard Promotion"}
                      </div>
                      <div className="text-[11px] text-amber-300 font-mono">
                        ₹{item.selectedPackage?.price?.toLocaleString() || "5,000"}
                      </div>
                    </div>

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

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-medium">Submitted On</span>
                      <div className="text-slate-300 mt-0.5">
                        {new Date(item.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Assigned Influencer & Agreed Price Row (if recorded by admin) */}
                {(item.assignedInfluencerName || item.agreedPrice) && (
                  <div className="text-xs bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/40 text-emerald-200 flex items-center gap-4 flex-wrap">
                    {item.assignedInfluencerName && (
                      <div>
                        <span className="text-emerald-400 font-semibold">Assigned Influencer: </span>
                        <strong className="text-white">{item.assignedInfluencerName}</strong>
                      </div>
                    )}
                    {item.agreedPrice && (
                      <div>
                        <span className="text-emerald-400 font-semibold">Agreed Price: </span>
                        <strong className="text-amber-300 font-mono">₹{item.agreedPrice.toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Additional Message or Custom Requirements */}
                {(item.additionalMessage || item.customRequirements) && (
                  <div className="text-xs bg-[#0E131A] p-2.5 rounded-lg border border-slate-800/80 text-slate-300">
                    <span className="text-slate-500 font-semibold mr-1">Owner&apos;s Message:</span>
                    {item.additionalMessage || item.customRequirements}
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

      {/* 4. Update Status & Influencer Assignment Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-800 bg-[#121820] shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-[#161F2C]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">edit_note</span>
                <h3 className="font-semibold text-white text-sm">
                  Manage Promotion Request ({selectedRequest.requestId || selectedRequest._id.slice(-6).toUpperCase()})
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
                <span className="text-[11px] text-slate-400">Homestay & Owner</span>
                <div className="text-white font-semibold text-sm">
                  {selectedRequest.homestayName} ({selectedRequest.ownerName} • +91 {selectedRequest.ownerPhone})
                </div>
                {selectedRequest.budget ? (
                  <div className="text-amber-300 font-mono font-bold mt-0.5">
                    Quoted Budget: ₹{selectedRequest.budget.toLocaleString()}
                  </div>
                ) : null}
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Request Status <span className="text-rose-400">*</span>
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as CollaborationStatus)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white focus:outline-none focus:border-purple-500 font-medium cursor-pointer"
                >
                  <option value="NEW">NEW (Request Received)</option>
                  <option value="CONTACTED">CONTACTED (Spoke with Owner / Host)</option>
                  <option value="FINDING INFLUENCERS">FINDING INFLUENCERS (Finding Suitable Creators)</option>
                  <option value="PROPOSAL SENT">PROPOSAL SENT (Proposal Sent to Owner)</option>
                  <option value="CONFIRMED">CONFIRMED (Creator & Schedule Locked)</option>
                  <option value="COMPLETED">COMPLETED (Promotion Reel Finished)</option>
                  <option value="REJECTED">REJECTED (Declined)</option>
                  <option value="CANCELLED">CANCELLED (Cancelled by Host)</option>
                  <option value="IN_NEGOTIATION">IN NEGOTIATION (Discussion in Progress)</option>
                </select>
              </div>

              {/* Influencer Assignment & Final Agreed Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Assigned Influencer / Creator
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. @hillsandhomestays"
                    value={assignedInfluencerName}
                    onChange={(e) => setAssignedInfluencerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Final Agreed Price (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 6500"
                    value={agreedPrice}
                    onChange={(e) => setAgreedPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Confirmed Shooting Date */}
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
                  Admin Internal Notes / Discussion Log
                </label>
                <textarea
                  rows={3}
                  placeholder="Internal notes on discussions with creator and host, selected packages, travel arrangements..."
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
                  placeholder="e.g. Host approved proposal for 1 reel + 3 stories."
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
