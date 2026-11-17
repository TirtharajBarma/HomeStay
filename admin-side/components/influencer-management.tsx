"use client";

import { useState, useEffect, useRef } from "react";
import { API_ENDPOINTS, apiFetch, readApiError } from "@/lib/api-config";

export interface InfluencerPackage {
  _id?: string;
  name: string;
  price: number;
  deliverables: string;
  turnaroundDays?: number;
}

export interface Influencer {
  _id: string;
  name: string;
  tagline: string;
  bio: string;
  profilePhoto: string;
  instagramHandle: string;
  instagramUrl: string;
  followersCount: number;
  averageViews: number;
  destinations: string[];
  categories: string[];
  startingPrice: number;
  packages: InfluencerPackage[];
  sampleReels: Array<{ title: string; url: string }>;
  isVerified: boolean;
  isFeatured: boolean;
  isActive: boolean;
  contactPhone?: string;
  contactEmail?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

const DESTINATION_OPTIONS = [
  "Darjeeling",
  "Kalimpong",
  "Kurseong",
  "Gangtok",
  "Sikkim",
  "Pelling",
  "Mirik",
  "Lava & Rishop",
];

const SAMPLE_CREATOR_AVATARS = [
  {
    label: "Mountain Creator (M)",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
  },
  {
    label: "Travel Creator (F)",
    url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80",
  },
  {
    label: "Filmmaker Couple",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
  },
  {
    label: "Hiker / Trekker",
    url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80",
  },
];

export function InfluencerManagement({ demo }: { demo?: boolean }) {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, featured: 0 });
  const [search, setSearch] = useState("");
  const [selectedDestination, setSelectedDestination] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInfluencer, setEditingInfluencer] = useState<Influencer | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: "",
    tagline: "",
    bio: "",
    profilePhoto: "",
    instagramHandle: "",
    instagramUrl: "",
    followersCount: 0,
    averageViews: 0,
    destinations: ["Darjeeling"] as string[],
    categories: ["Travel", "Homestay Reviews"],
    startingPrice: 5000,
    isVerified: true,
    isFeatured: false,
    isActive: true,
    contactPhone: "",
    contactEmail: "",
    adminNotes: "",
    packages: [
      {
        name: "Standard Reel + Stories",
        price: 5000,
        deliverables: "1 4K Instagram Reel + 3 Stories with direct booking link",
        turnaroundDays: 5,
      },
    ] as InfluencerPackage[],
    sampleReels: [{ title: "Featured Reel", url: "" }],
  });

  function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (JPEG, PNG, WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        setFormData((prev) => ({ ...prev, profilePhoto: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function fetchInfluencers() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (selectedDestination !== "All") q.set("destination", selectedDestination);
      if (search.trim()) q.set("search", search.trim());
      if (statusFilter === "active") q.set("active", "true");
      if (statusFilter === "inactive") q.set("active", "false");
      if (demo) q.set("demo", "true");

      const res = await apiFetch(API_ENDPOINTS.influencersAdmin(q.toString()));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setInfluencers(json.data);
          if (json.stats) setStats(json.stats);
        }
      }
    } catch (err: any) {
      console.error("Error fetching influencers:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInfluencers();
  }, [selectedDestination, statusFilter, demo]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      fetchInfluencers();
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  function openCreateModal() {
    setEditingInfluencer(null);
    setFormData({
      name: "",
      tagline: "",
      bio: "",
      profilePhoto: "",
      instagramHandle: "",
      instagramUrl: "",
      followersCount: 50000,
      averageViews: 80000,
      destinations: ["Darjeeling"],
      categories: ["Travel", "Homestays"],
      startingPrice: 5000,
      isVerified: true,
      isFeatured: false,
      isActive: true,
      contactPhone: "",
      contactEmail: "",
      adminNotes: "",
      packages: [
        {
          name: "Standard Reel + Stories",
          price: 5000,
          deliverables: "1 4K Instagram Reel (60-90s) + 3 Stories with homestay booking link",
          turnaroundDays: 5,
        },
      ],
      sampleReels: [{ title: "Featured Reel", url: "" }],
    });
    setIsModalOpen(true);
  }

  function openEditModal(item: Influencer) {
    setEditingInfluencer(item);
    setFormData({
      name: item.name,
      tagline: item.tagline || "",
      bio: item.bio || "",
      profilePhoto: item.profilePhoto || "",
      instagramHandle: item.instagramHandle,
      instagramUrl: item.instagramUrl || "",
      followersCount: item.followersCount || 0,
      averageViews: item.averageViews || 0,
      destinations: item.destinations || ["Darjeeling"],
      categories: item.categories || ["Travel"],
      startingPrice: item.startingPrice || 0,
      isVerified: item.isVerified,
      isFeatured: item.isFeatured,
      isActive: item.isActive,
      contactPhone: item.contactPhone || "",
      contactEmail: item.contactEmail || "",
      adminNotes: item.adminNotes || "",
      packages: item.packages?.length
        ? item.packages
        : [
            {
              name: "Standard Reel",
              price: item.startingPrice || 5000,
              deliverables: "1 Instagram Reel + 3 Stories",
              turnaroundDays: 5,
            },
          ],
      sampleReels: item.sampleReels?.length ? item.sampleReels : [{ title: "Featured Reel", url: "" }],
    });
    setIsModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.instagramHandle.trim()) {
      alert("Name and Instagram handle are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        destinations: formData.destinations.length ? formData.destinations : ["Darjeeling"],
      };

      const url = editingInfluencer
        ? API_ENDPOINTS.influencerUpdate(editingInfluencer._id)
        : API_ENDPOINTS.influencerCreate();

      const method = editingInfluencer ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchInfluencers();
      } else {
        const err = await readApiError(res, "Failed to save influencer");
        alert(err);
      }
    } catch (err: any) {
      alert(err.message || "Failed to save influencer");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(id: string) {
    try {
      const res = await apiFetch(API_ENDPOINTS.influencerToggleStatus(id), { method: "PATCH" });
      if (res.ok) {
        setInfluencers((prev) =>
          prev.map((inf) => (inf._id === id ? { ...inf, isActive: !inf.isActive } : inf))
        );
      }
    } catch (err) {
      console.error("Toggle status error:", err);
    }
  }

  async function deleteInfluencer(id: string, name: string) {
    if (!confirm(`Are you sure you want to remove "${name}" from influencers?`)) return;
    try {
      const res = await apiFetch(API_ENDPOINTS.influencerDelete(id), { method: "DELETE" });
      if (res.ok) {
        setInfluencers((prev) => prev.filter((inf) => inf._id !== id));
      } else {
        alert("Failed to delete influencer");
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete influencer");
    }
  }

  function toggleDestination(dest: string) {
    setFormData((prev) => {
      const exists = prev.destinations.includes(dest);
      if (exists) {
        return { ...prev, destinations: prev.destinations.filter((d) => d !== dest) };
      } else {
        return { ...prev, destinations: [...prev.destinations, dest] };
      }
    });
  }

  function addPackage() {
    setFormData((prev) => ({
      ...prev,
      packages: [
        ...prev.packages,
        {
          name: "New Package",
          price: prev.startingPrice || 6000,
          deliverables: "Deliverables description here",
          turnaroundDays: 7,
        },
      ],
    }));
  }

  function removePackage(index: number) {
    setFormData((prev) => ({
      ...prev,
      packages: prev.packages.filter((_, i) => i !== index),
    }));
  }

  function updatePackage(index: number, field: keyof InfluencerPackage, value: any) {
    setFormData((prev) => {
      const updated = [...prev.packages];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, packages: updated };
    });
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & KPI Counter Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-400 text-2xl">stars</span>
            <h1 className="text-xl font-bold text-white tracking-tight">Influencer Management</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Curate top Himalayan travel creators for homestay promotions across Darjeeling, Kalimpong, Sikkim & Gangtok.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs shadow-lg shadow-purple-900/30 transition cursor-pointer self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span>Add Influencer</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-800 bg-[#121820] p-4">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Creators</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.total || influencers.length}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#121820] p-4">
          <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Active in App</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.active || influencers.filter(i => i.isActive).length}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#121820] p-4">
          <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Featured Creators</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{stats.featured || influencers.filter(i => i.isFeatured).length}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#121820] p-4">
          <div className="text-[11px] font-medium text-purple-400 uppercase tracking-wider">Total Reach</div>
          <div className="text-2xl font-bold text-purple-300 mt-1 font-mono">
            {Math.round(influencers.reduce((acc, i) => acc + (i.followersCount || 0), 0) / 1000)}K+
          </div>
        </div>
      </div>

      {/* 2. Controls: Destination Filter & Search */}
      <div className="rounded-xl border border-slate-800 bg-[#121820] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search by creator name, @handle, tagline, destination..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-700/80 bg-[#161F2C] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          {/* Active/Inactive Filter */}
          <div className="flex items-center gap-1.5 self-start">
            {(["all", "active", "inactive"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
                  statusFilter === s
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-slate-800/80 text-slate-400 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Destination Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <span className="text-[11px] text-slate-400 font-medium shrink-0 mr-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-purple-400">location_on</span>
            Destinations:
          </span>
          {["All", ...DESTINATION_OPTIONS].map((dest) => (
            <button
              key={dest}
              onClick={() => setSelectedDestination(dest)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer shrink-0 ${
                selectedDestination === dest
                  ? "bg-purple-600/90 text-white shadow-xs border border-purple-500"
                  : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60"
              }`}
            >
              {dest}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Influencers Grid / Cards */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 text-xs">
          <span className="material-symbols-outlined text-3xl animate-spin text-purple-500 block mb-2">
            progress_activity
          </span>
          Loading influencers...
        </div>
      ) : influencers.length === 0 ? (
        <div className="p-16 text-center rounded-xl border border-dashed border-slate-800 bg-[#121820]/40 space-y-3">
          <span className="material-symbols-outlined text-4xl text-slate-600 block">
            stars
          </span>
          <p className="text-sm font-semibold text-slate-300">No influencers found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add travel influencers covering Darjeeling, Kalimpong, Gangtok & Sikkim to showcase them in the Homestay Owner App.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-xs">add</span>
            Add First Influencer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {influencers.map((inf) => (
            <div
              key={inf._id}
              className={`rounded-xl border transition flex flex-col justify-between overflow-hidden ${
                inf.isActive
                  ? "border-slate-800 bg-[#121820] hover:border-slate-700"
                  : "border-slate-800/50 bg-[#0E131A] opacity-75"
              }`}
            >
              <div className="p-4 space-y-3">
                {/* Top Row: Avatar + Handle + Badges */}
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    {inf.profilePhoto ? (
                      <img
                        src={inf.profilePhoto}
                        alt={inf.name}
                        className="h-14 w-14 rounded-full object-cover border-2 border-purple-500/40"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-700 to-indigo-800 flex items-center justify-center text-white font-bold text-sm">
                        {inf.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {inf.isVerified && (
                      <span
                        className="absolute -bottom-1 -right-1 bg-sky-500 text-white rounded-full p-0.5 shadow-sm"
                        title="Verified Creator"
                      >
                        <span className="material-symbols-outlined text-[13px] block">check</span>
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-sm text-white truncate">{inf.name}</h3>
                      {inf.isFeatured && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-semibold px-1.5 py-0.2 rounded-full">
                          Featured
                        </span>
                      )}
                      {!inf.isActive && (
                        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-semibold px-1.5 py-0.2 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>

                    <a
                      href={inf.instagramUrl || `https://instagram.com/${inf.instagramHandle.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-400 hover:text-purple-300 transition truncate flex items-center gap-0.5 mt-0.5"
                    >
                      <span>{inf.instagramHandle}</span>
                      <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                    </a>

                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">
                      {inf.tagline || "Himalayan Travel Creator"}
                    </p>
                  </div>
                </div>

                {/* Follower Stats Bar */}
                <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-[#161F2C] border border-slate-800/80 text-center">
                  <div>
                    <div className="text-[10px] text-slate-400">Followers</div>
                    <div className="text-xs font-bold text-white font-mono">
                      {inf.followersCount >= 1000
                        ? `${(inf.followersCount / 1000).toFixed(inf.followersCount >= 100000 ? 0 : 1)}K`
                        : inf.followersCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Avg Views</div>
                    <div className="text-xs font-bold text-emerald-400 font-mono">
                      {inf.averageViews >= 1000
                        ? `${(inf.averageViews / 1000).toFixed(inf.averageViews >= 100000 ? 0 : 1)}K`
                        : inf.averageViews || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Starting at</div>
                    <div className="text-xs font-bold text-amber-300 font-mono">
                      ₹{inf.startingPrice?.toLocaleString() || "5,000"}
                    </div>
                  </div>
                </div>

                {/* Destinations tags */}
                <div className="flex items-center gap-1 flex-wrap">
                  {inf.destinations?.map((d) => (
                    <span
                      key={d}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium"
                    >
                      {d}
                    </span>
                  ))}
                </div>

                {/* Packages snippet */}
                {inf.packages?.length > 0 && (
                  <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                    <span className="text-slate-500 font-medium">{inf.packages.length} Packages:</span>{" "}
                    <span className="text-slate-300 font-medium">{inf.packages[0].name}</span>{" "}
                    <span className="text-slate-500">(₹{inf.packages[0].price.toLocaleString()})</span>
                  </div>
                )}
              </div>

              {/* Bottom Actions Bar */}
              <div className="flex items-center justify-between border-t border-slate-800 bg-[#0E131A] px-4 py-2.5 text-xs">
                <button
                  onClick={() => toggleStatus(inf._id)}
                  className={`text-[11px] font-semibold cursor-pointer transition ${
                    inf.isActive ? "text-slate-400 hover:text-amber-400" : "text-emerald-400 hover:text-emerald-300"
                  }`}
                >
                  {inf.isActive ? "Deactivate" : "Activate"}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(inf)}
                    className="flex items-center gap-1 text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition cursor-pointer text-xs"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => deleteInfluencer(inf._id, inf.name)}
                    className="flex items-center text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 transition cursor-pointer"
                    title="Delete Influencer"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Add / Edit Influencer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-xl border border-slate-800 bg-[#121820] shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-[#161F2C]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">
                  {editingInfluencer ? "edit" : "add_circle"}
                </span>
                <h3 className="font-semibold text-white text-sm">
                  {editingInfluencer ? "Edit Influencer Details" : "Add New Travel Influencer"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Creator Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Creator / Channel Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rohan & Priyadarshini"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Instagram Handle <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. @hillsandhomestays"
                    value={formData.instagramHandle}
                    onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Tagline & Profile Image */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tagline / Short Hook</label>
                  <input
                    type="text"
                    placeholder="e.g. Himalayan Storyteller • Offbeat Homestays"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-300 font-medium">Profile Photo</label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 cursor-pointer bg-purple-500/10 hover:bg-purple-500/20 px-2 py-0.5 rounded transition"
                    >
                      <span className="material-symbols-outlined text-xs">upload</span>
                      <span>Upload from Device</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFile}
                      className="hidden"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Live Avatar Preview */}
                    <div className="relative shrink-0">
                      {formData.profilePhoto ? (
                        <img
                          src={formData.profilePhoto}
                          alt="Preview"
                          className="h-10 w-10 rounded-full object-cover border-2 border-purple-500/60"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                          <span className="material-symbols-outlined text-base">person</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Paste image URL (Unsplash, Instagram, Imgur, CDN...)"
                        value={formData.profilePhoto.startsWith("data:") ? "[Image uploaded from computer]" : formData.profilePhoto}
                        onChange={(e) => setFormData({ ...formData, profilePhoto: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white text-xs focus:outline-none focus:border-purple-500"
                      />
                      {formData.profilePhoto && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, profilePhoto: "" })}
                          className="absolute right-2 top-2 text-slate-500 hover:text-rose-400 p-0.5"
                          title="Clear photo"
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Sample Avatars */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-slate-500">Or pick sample:</span>
                    {SAMPLE_CREATOR_AVATARS.map((s, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setFormData({ ...formData, profilePhoto: s.url })}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Instagram URL */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Instagram Profile URL</label>
                <input
                  type="url"
                  placeholder="https://instagram.com/yourhandle"
                  value={formData.instagramUrl}
                  onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Numbers: Followers, Views, Starting Price */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Followers Count</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 85000"
                    value={formData.followersCount || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, followersCount: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Avg Reel Views</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 120000"
                    value={formData.averageViews || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, averageViews: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Starting Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 5000"
                    value={formData.startingPrice || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, startingPrice: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Destinations covered */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Destinations Covered (select one or multiple):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DESTINATION_OPTIONS.map((dest) => {
                    const selected = formData.destinations.includes(dest);
                    return (
                      <button
                        type="button"
                        key={dest}
                        onClick={() => toggleDestination(dest)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer border ${
                          selected
                            ? "bg-purple-600 text-white border-purple-500"
                            : "bg-[#161F2C] text-slate-400 border-slate-700 hover:text-white"
                        }`}
                      >
                        {selected ? "✓ " : "+ "}
                        {dest}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bio / Description */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Creator Bio / Description</label>
                <textarea
                  rows={2}
                  placeholder="Tell owners about this creator's style, audience demographics, and what makes their homestay features high-impact..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Promotion Packages Builder */}
              <div className="border border-slate-800 rounded-lg p-3 bg-[#0E131A] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Promotion Packages for Homestays</span>
                  <button
                    type="button"
                    onClick={addPackage}
                    className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 cursor-pointer font-medium"
                  >
                    <span className="material-symbols-outlined text-xs">add</span>
                    Add Package
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formData.packages.map((pkg, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-slate-700/80 bg-[#161F2C] space-y-2 relative"
                    >
                      {formData.packages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePackage(idx)}
                          className="absolute right-2 top-2 text-slate-500 hover:text-rose-400 p-1"
                          title="Remove Package"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Package Title</label>
                          <input
                            type="text"
                            value={pkg.name}
                            onChange={(e) => updatePackage(idx, "name", e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-700 bg-[#121820] text-white text-xs"
                            placeholder="e.g. 1 4K Reel + 3 Stories"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Price (₹)</label>
                          <input
                            type="number"
                            value={pkg.price || ""}
                            onChange={(e) =>
                              updatePackage(idx, "price", parseInt(e.target.value, 10) || 0)
                            }
                            className="w-full px-2.5 py-1.5 rounded border border-slate-700 bg-[#121820] text-white text-xs font-mono"
                            placeholder="5000"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Deliverables</label>
                        <input
                          type="text"
                          value={pkg.deliverables}
                          onChange={(e) => updatePackage(idx, "deliverables", e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded border border-slate-700 bg-[#121820] text-white text-xs"
                          placeholder="e.g. 1 4K cinematic Reel, 3 Stories with booking link, collaboration tag"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Internal Admin Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    Influencer Phone (Admin only)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-[#161F2C] text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    Influencer Email (Admin only)
                  </label>
                  <input
                    type="email"
                    placeholder="creator@gmail.com"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-[#161F2C] text-white text-xs"
                  />
                </div>
              </div>

              {/* Toggles: Verified, Featured, Active */}
              <div className="flex items-center gap-6 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.isVerified}
                    onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                    className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-slate-300 font-medium">Verified Creator</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                    className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-slate-300 font-medium">Featured in App</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-slate-300 font-medium">Active (Visible in Owner App)</span>
                </label>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition cursor-pointer disabled:opacity-50"
                >
                  {saving && (
                    <span className="material-symbols-outlined text-sm animate-spin">
                      progress_activity
                    </span>
                  )}
                  <span>{editingInfluencer ? "Update Influencer" : "Add Influencer"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
