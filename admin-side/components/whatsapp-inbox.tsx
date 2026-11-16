"use client";

import { useEffect, useRef, useState } from "react";
import { io as socketIO, Socket } from "socket.io-client";
import { API_ENDPOINTS, apiFetch, readApiError, SOCKET_SERVER_URL } from "@/lib/api-config";

// --- Types ---
export type ConversationFilter = "all" | "unread" | "open" | "closed";

export type DeliveryStatus = "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
export type MessageDirection = "INBOUND" | "OUTBOUND";
export type SenderType = "CUSTOMER" | "ADMIN" | "SYSTEM";
export type MessageType = "TEXT" | "IMAGE" | "DOCUMENT" | "TEMPLATE" | "OTHER";

export interface ConversationWindow {
  isOpen: boolean;
  lastInboundAt: string | null;
  expiresAt: string | null;
  remainingSeconds: number;
  reason?: string;
}

export interface ConversationItem {
  _id: string;
  contactId: string;
  phoneNumber: string;
  customerName: string;
  status: "OPEN" | "CLOSED";
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: string;
  lastInboundMessageAt?: string | null;
  lastMessageDirection?: MessageDirection;
  lastMessageStatus?: DeliveryStatus;
  window?: ConversationWindow;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  contactId?: string;
  whatsappMessageId?: string | null;
  direction: MessageDirection;
  senderType: SenderType;
  messageType: MessageType;
  messageContent: string;
  templateName?: string | null;
  templateLanguage?: string | null;
  templateParameters?: string[] | any;
  mediaId?: string | null;
  mediaUrl?: string | null;
  deliveryStatus: DeliveryStatus;
  sentAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  errorDetails?: string | null;
  adminId?: string | null;
  createdAt: string;
}

export interface TemplateVariable {
  index: number;
  name: string;
  description: string;
  placeholder: string;
  sample: string;
}

export interface TemplateItem {
  id: string;
  name: string;
  event: string;
  title: string;
  category: string;
  language: string;
  description: string;
  variables: TemplateVariable[];
  samplePreview: string;
}

export interface CustomerContext {
  contact: any;
  guest: any;
  bookings: any[];
  latestBooking: any;
  cabBookings: any[];
  latestTrip: any;
  homestay: any;
  isExistingGuest: boolean;
}

// Format date helper
function formatTime(isoString?: string | number): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(isoString?: string | number): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return `+${digits}`;
}

export function WhatsAppInbox({
  demo,
  onNavigateToCabRequests,
  onNavigateToGuests,
}: {
  demo?: boolean;
  onNavigateToCabRequests?: (tenantKey?: string) => void;
  onNavigateToGuests?: (guestSearch?: string) => void;
}) {
  // State: Conversation list
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // State: Active Chat
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatWindowInfo, setChatWindowInfo] = useState<ConversationWindow | null>(null);
  const [customerContext, setCustomerContext] = useState<CustomerContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  // State: Sending
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [showAttachInput, setShowAttachInput] = useState(false);

  // State: Templates Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<number, string>>({});
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // State: Layout / Right Panel
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [mobileViewChat, setMobileViewChat] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // 1. Fetch Conversations List
  async function fetchConversations(refresh = false) {
    try {
      if (refresh) setLoadingConversations(true);
      const queryParams = new URLSearchParams();
      if (filter !== "all") queryParams.set("filter", filter);
      if (search.trim()) queryParams.set("search", search.trim());
      queryParams.set("page", String(page));
      queryParams.set("limit", "40");
      if (demo) queryParams.set("demo", "true");

      const res = await apiFetch(API_ENDPOINTS.whatsappConversations(queryParams.toString()));
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setConversations(json.data.conversations || []);
          setTotalCount(json.data.stats?.totalConversations ?? json.data.pagination?.total ?? 0);
          setUnreadTotal(json.data.stats?.unreadConversations ?? 0);

          // If no conversation is active and we have items, select the first on desktop
          if (!activeConversationId && json.data.conversations?.length > 0 && typeof window !== "undefined" && window.innerWidth >= 1024) {
            selectConversation(json.data.conversations[0]);
          }
        }
      }
    } catch (err: any) {
      console.warn("Error fetching WhatsApp conversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  }

  useEffect(() => {
    fetchConversations(true);
  }, [filter, demo]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConversations(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 2. Select conversation and load messages + context
  async function selectConversation(conv: ConversationItem) {
    setActiveConversationId(conv._id);
    setActiveConversation(conv);
    setMobileViewChat(true);
    setLoadingMessages(true);
    setLoadingContext(true);

    try {
      // Load details & 24h window
      const detailRes = await apiFetch(API_ENDPOINTS.whatsappConversation(conv._id, demo));
      if (detailRes.ok) {
        const detailJson = await detailRes.json();
        if (detailJson.success && detailJson.data) {
          setActiveConversation(detailJson.data.conversation);
          setChatWindowInfo(detailJson.data.window);
          setCustomerContext(detailJson.data.customerContext);
        }
      }

      // Load messages
      const msgRes = await apiFetch(API_ENDPOINTS.whatsappMessages(conv._id, demo ? "demo=true" : ""));
      if (msgRes.ok) {
        const msgJson = await msgRes.json();
        if (msgJson.success && Array.isArray(msgJson.data)) {
          setMessages(msgJson.data);
        }
      }

      // Mark conversation as read if unreadCount > 0
      if (conv.unreadCount > 0) {
        apiFetch(API_ENDPOINTS.whatsappMarkRead(conv._id), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ demo }),
        }).then(() => {
          setConversations((prev) =>
            prev.map((c) => (c._id === conv._id ? { ...c, unreadCount: 0 } : c))
          );
          setUnreadTotal((prev) => Math.max(0, prev - 1));
        });
      }

      // Join socket room
      if (socketRef.current) {
        socketRef.current.emit("join_conversation", conv._id);
      }
    } catch (err: any) {
      console.error("Error loading conversation:", err);
    } finally {
      setLoadingMessages(false);
      setLoadingContext(false);
    }
  }

  // 3. Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingMessages]);

  // 4. Load available WhatsApp templates
  async function loadTemplates() {
    try {
      const res = await apiFetch(API_ENDPOINTS.whatsappTemplates());
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTemplates(json.data);
        }
      }
    } catch (err: any) {
      console.warn("Failed to load WhatsApp templates:", err);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  // 5. Real-time Live Synchronisation: Smart Polling (Vercel-native) + Local Socket.IO Fallback
  useEffect(() => {
    let isMounted = true;
    const isLocalhost =
      typeof window !== "undefined" &&
      (/localhost|127\.0\.0\.1/.test(window.location.hostname) ||
        /localhost|127\.0\.0\.1/.test(SOCKET_SERVER_URL));

    // Only attempt Socket.IO on local Node development server (where server.ts runs persistently)
    if (isLocalhost) {
      try {
        const socket = socketIO(SOCKET_SERVER_URL, {
          transports: ["websocket", "polling"],
          reconnectionAttempts: 3,
          reconnectionDelay: 5000,
          timeout: 5000,
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          if (!isMounted) return;
          setSocketConnected(true);
          if (activeConversationId) {
            socket.emit("join_conversation", activeConversationId);
          }
        });

        socket.on("disconnect", () => {
          if (!isMounted) return;
          setSocketConnected(false);
        });

        socket.on("connect_error", () => {
          // Gracefully fallback to polling without console noise
          socket.disconnect();
        });

        // Inbound or outbound message event
        socket.on("whatsapp:message", (data: { conversation: ConversationItem; message: ChatMessage }) => {
          if (!data?.message || !isMounted) return;

          // Update messages if this belongs to active conversation
          if (data.message.conversationId === activeConversationId || data.conversation?._id === activeConversationId) {
            setMessages((prev) => {
              if (prev.some((m) => m._id === data.message._id || (m.whatsappMessageId && m.whatsappMessageId === data.message.whatsappMessageId))) {
                return prev.map((m) =>
                  m._id === data.message._id || m.whatsappMessageId === data.message.whatsappMessageId ? data.message : m
                );
              }
              return [...prev, data.message];
            });

            // Refresh window info if inbound message
            if (data.message.direction === "INBOUND") {
              setChatWindowInfo({
                isOpen: true,
                lastInboundAt: data.message.sentAt,
                expiresAt: new Date(new Date(data.message.sentAt).getTime() + 24 * 3600 * 1000).toISOString(),
                remainingSeconds: 24 * 3600,
              });
            }
          }

          // Update conversation list preview
          setConversations((prev) => {
            const index = prev.findIndex((c) => c._id === data.conversation?._id || c._id === data.message.conversationId);
            if (index !== -1) {
              const updated = [...prev];
              const item = { ...updated[index] };
              item.lastMessage = data.message.messageContent;
              item.lastMessageAt = data.message.sentAt || new Date().toISOString();
              item.lastMessageDirection = data.message.direction;
              item.lastMessageStatus = data.message.deliveryStatus;
              if (data.message.direction === "INBOUND" && data.conversation?._id !== activeConversationId) {
                item.unreadCount = (item.unreadCount || 0) + 1;
              }
              // Move to top
              updated.splice(index, 1);
              return [item, ...updated];
            } else if (data.conversation) {
              return [data.conversation, ...prev];
            }
            return prev;
          });
        });

        // Conversation update event
        socket.on("whatsapp:conversation", (updatedConv: ConversationItem) => {
          if (!updatedConv?._id || !isMounted) return;
          setConversations((prev) => {
            const exists = prev.some((c) => c._id === updatedConv._id);
            if (exists) {
              return prev.map((c) => (c._id === updatedConv._id ? { ...c, ...updatedConv } : c));
            }
            return [updatedConv, ...prev];
          });
          if (activeConversationId === updatedConv._id) {
            setActiveConversation((prev) => (prev ? { ...prev, ...updatedConv } : updatedConv));
          }
        });

        // Delivery status update event
        socket.on("whatsapp:status", (statusData: { messageId: string; status: DeliveryStatus; timestamp: string }) => {
          if (!statusData?.messageId || !isMounted) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.whatsappMessageId === statusData.messageId || m._id === statusData.messageId
                ? { ...m, deliveryStatus: statusData.status }
                : m
            )
          );
        });
      } catch {
        // Fallback to polling
      }
    }

    // On Vercel / Cloud production, enable live sync status via smart polling
    if (!isLocalhost) {
      setSocketConnected(true);
    }

    // --- Smart Polling Worker for Active Chat & Inbox (Production Vercel-Ready) ---
    async function pollActiveMessages() {
      if (!activeConversationId || !isMounted) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

      try {
        const res = await apiFetch(API_ENDPOINTS.whatsappMessages(activeConversationId, demo ? "demo=true" : ""));
        if (res.ok && isMounted) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setMessages((prev) => {
              if (json.data.length !== prev.length) return json.data;
              const hasDiff = json.data.some((m: ChatMessage, idx: number) => {
                const existing = prev[idx];
                return !existing || existing._id !== m._id || existing.deliveryStatus !== m.deliveryStatus;
              });
              return hasDiff ? json.data : prev;
            });
          }
        }
      } catch {
        // Quiet network catch
      }
    }

    async function pollConversationsList() {
      if (!isMounted) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        await fetchConversations(false);
      } catch {}
    }

    // Active conversation polls every 3.5 seconds
    const messageInterval = setInterval(pollActiveMessages, 3500);
    // Overall conversation list summary polls every 12 seconds
    const convInterval = setInterval(pollConversationsList, 12000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        pollActiveMessages();
        pollConversationsList();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      isMounted = false;
      clearInterval(messageInterval);
      clearInterval(convInterval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      socketRef.current?.disconnect();
    };
  }, [activeConversationId, demo]);

  // 6. Send Manual Text Message
  async function handleSendManualMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!activeConversationId || (!messageText.trim() && !attachmentUrl.trim()) || sendingMessage) return;

    const outgoingContent = messageText.trim();
    const media = attachmentUrl.trim() || undefined;

    setSendingMessage(true);
    try {
      const res = await apiFetch(API_ENDPOINTS.whatsappSendMessage(activeConversationId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: outgoingContent,
          mediaUrl: media,
          mediaType: media ? "IMAGE" : "TEXT",
          demo,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setMessages((prev) => [...prev, json.data]);
          setMessageText("");
          setAttachmentUrl("");
          setShowAttachInput(false);
        }
      } else {
        const errMsg = await readApiError(res, "Failed to send message.");
        alert(errMsg);
      }
    } catch (err: any) {
      alert(err.message || "Failed to send message.");
    } finally {
      setSendingMessage(false);
    }
  }

  // Enter to send, Shift+Enter for new line
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendManualMessage();
    }
  }

  // 7. Open Template Selector
  function handleOpenTemplates() {
    // Auto-populate variables from active customer context
    if (templates.length > 0) {
      selectTemplateForComposer(templates[0]);
    }
    setShowTemplateModal(true);
  }

  function selectTemplateForComposer(tpl: TemplateItem) {
    setSelectedTemplate(tpl);
    const initial: Record<number, string> = {};

    tpl.variables.forEach((v) => {
      // Smart variable auto-population based on template index & customer info
      if (tpl.id === "ask_cab") {
        if (v.index === 1) initial[1] = customerContext?.guest?.name || customerContext?.latestBooking?.guestName || activeConversation?.customerName || "";
        if (v.index === 2) initial[2] = customerContext?.homestay?.name || "StayCabs Homestay";
        if (v.index === 3) initial[3] = "https://staycabs.in/cab-request";
      } else if (tpl.id === "new_trip_request") {
        if (v.index === 1) initial[1] = customerContext?.homestay?.name || "StayCabs Partner";
        if (v.index === 2) initial[2] = customerContext?.latestTrip?.pickupLocation?.address ? `${customerContext.latestTrip.pickupLocation.address} → Drop` : "Bagdogra Airport → Darjeeling Mall Road";
        if (v.index === 3) initial[3] = customerContext?.latestTrip?.time ? `${customerContext.latestTrip.time}` : "Tomorrow at 10:00 AM";
        if (v.index === 4) initial[4] = customerContext?.latestTrip?.vehicleType || "SUV";
        if (v.index === 5) initial[5] = "https://staycabs.in/driver-quote";
      } else if (tpl.id === "quote_accepted_guest" || tpl.id === "advance_paid_guest") {
        if (v.index === 1) initial[1] = customerContext?.guest?.name || activeConversation?.customerName || "";
        if (v.index === 2) initial[2] = customerContext?.latestTrip?.assignedDriverName || "Tenzing Sherpa";
        if (v.index === 3) initial[3] = customerContext?.latestTrip?.assignedDriverPhone || "+91 98320 12345";
        if (v.index === 4) initial[4] = "Mahindra Scorpio";
        if (v.index === 5) initial[5] = "Local Hill Excursion";
        if (v.index === 6) initial[6] = "Tomorrow 09:00 AM";
        if (v.index === 7) initial[7] = "₹2,500";
        if (v.index === 8) initial[8] = "https://staycabs.in/cab-request";
      } else {
        initial[v.index] = v.sample || "";
      }
    });

    setTemplateValues(initial);
  }

  // 8. Send Selected Template
  async function handleSendTemplate() {
    if (!activeConversationId || !selectedTemplate || sendingTemplate) return;

    const orderedParams = selectedTemplate.variables.map((v) => templateValues[v.index] || "-");

    setSendingTemplate(true);
    try {
      const res = await apiFetch(API_ENDPOINTS.whatsappSendTemplate(activeConversationId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          params: orderedParams,
          language: selectedTemplate.language || "en",
          demo,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setMessages((prev) => [...prev, json.data]);
          setShowTemplateModal(false);
        }
      } else {
        const errMsg = await readApiError(res, "Failed to send template message.");
        alert(errMsg);
      }
    } catch (err: any) {
      alert(err.message || "Failed to send template message.");
    } finally {
      setSendingTemplate(false);
    }
  }

  // 9. Toggle Conversation Status (Open / Closed)
  async function handleToggleStatus() {
    if (!activeConversation) return;
    const nextStatus = activeConversation.status === "OPEN" ? "CLOSED" : "OPEN";
    try {
      const res = await apiFetch(API_ENDPOINTS.whatsappUpdateStatus(activeConversation._id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, demo }),
      });
      if (res.ok) {
        setActiveConversation((prev) => (prev ? { ...prev, status: nextStatus } : null));
        setConversations((prev) =>
          prev.map((c) => (c._id === activeConversation._id ? { ...c, status: nextStatus } : c))
        );
      }
    } catch (err: any) {
      alert("Failed to update conversation status.");
    }
  }

  // Render preview of template
  function renderTemplatePreview(): string {
    if (!selectedTemplate) return "";
    let text = selectedTemplate.samplePreview;
    selectedTemplate.variables.forEach((v) => {
      const val = templateValues[v.index] || `{{${v.index}}}`;
      text = text.replace(new RegExp(`\\{\\{${v.index}\\}\\}`, "g"), val);
    });
    return text;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] min-h-[580px] bg-[#0B0F14] text-[#E6EDF3] rounded-xl border border-slate-800 shadow-2xl overflow-hidden font-sans">
      {/* 1. TOP STATUS BAR */}
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-[#121820] px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                socketConnected ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                socketConnected ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </span>
          <span className="font-medium text-slate-300">
            {socketConnected ? "Cloud API Live Sync" : "Connecting..."}
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 font-mono">
            {totalCount} Total Conversations ({unreadTotal} Unread)
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchConversations(true)}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition cursor-pointer"
            title="Refresh conversations"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 2. THREE-PANE CONTAINER */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ========================================================================= */}
        {/* PANE A: LEFT SIDEBAR - CONVERSATION LIST                                  */}
        {/* ========================================================================= */}
        <div
          className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-slate-800/80 bg-[#0E131A] shrink-0 transition-all ${
            mobileViewChat ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Search Bar */}
          <div className="p-3 border-b border-slate-800/80 bg-[#121820]/60 space-y-2.5">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-slate-400 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Search name, phone, message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-700/80 bg-[#161F2C] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-2 text-slate-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(["all", "unread", "open", "closed"] as ConversationFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer capitalize flex items-center gap-1 shrink-0 ${
                    filter === f
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span>{f}</span>
                  {f === "unread" && unreadTotal > 0 && (
                    <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                      {unreadTotal}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations List Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {loadingConversations && conversations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <span className="material-symbols-outlined text-2xl animate-spin mb-2 text-purple-400 block">
                  progress_activity
                </span>
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                <span className="material-symbols-outlined text-3xl text-slate-600 block">
                  chat_bubble_outline
                </span>
                <p className="font-medium text-slate-400">No conversations found</p>
                <p className="text-[11px]">
                  When customers message our WhatsApp Cloud API number, chats will appear here instantly.
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv._id === activeConversationId;
                const lastTime = formatTime(conv.lastMessageAt) || formatDate(conv.lastMessageAt);

                return (
                  <div
                    key={conv._id}
                    onClick={() => selectConversation(conv)}
                    className={`flex items-start gap-3 p-3 transition cursor-pointer select-none border-l-4 ${
                      isSelected
                        ? "bg-[#182230] border-purple-500"
                        : conv.unreadCount > 0
                        ? "bg-[#151D28] border-emerald-500 hover:bg-[#182230]"
                        : "border-transparent hover:bg-slate-800/40"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-700 to-indigo-800 flex items-center justify-center text-white font-semibold text-xs uppercase shadow-sm">
                        {conv.customerName ? conv.customerName.slice(0, 2) : "WA"}
                      </div>
                      {conv.status === "CLOSED" && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-slate-600 border-2 border-[#0E131A]"
                          title="Closed conversation"
                        />
                      )}
                    </div>

                    {/* Content Preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="text-xs font-semibold text-white truncate">
                          {conv.customerName || formatPhoneDisplay(conv.phoneNumber)}
                        </h4>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                          {lastTime}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 truncate mb-1">
                        {formatPhoneDisplay(conv.phoneNumber)}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 min-w-0">
                          {conv.lastMessageDirection === "OUTBOUND" && (
                            <span
                              className={`material-symbols-outlined text-[13px] shrink-0 ${
                                conv.lastMessageStatus === "READ"
                                  ? "text-sky-400"
                                  : conv.lastMessageStatus === "FAILED"
                                  ? "text-rose-400"
                                  : "text-slate-400"
                              }`}
                            >
                              {conv.lastMessageStatus === "READ"
                                ? "done_all"
                                : conv.lastMessageStatus === "DELIVERED"
                                ? "done_all"
                                : conv.lastMessageStatus === "FAILED"
                                ? "error_outline"
                                : "done"}
                            </span>
                          )}
                          <span className="truncate">{conv.lastMessage || "Conversation created"}</span>
                        </p>

                        {conv.unreadCount > 0 && (
                          <span className="shrink-0 bg-emerald-500 text-white font-bold text-[10px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PANE B: MIDDLE SECTION - CHAT WINDOW                                      */}
        {/* ========================================================================= */}
        <div
          className={`flex-1 flex flex-col bg-[#0B0F14] min-w-0 relative ${
            !mobileViewChat ? "hidden md:flex" : "flex"
          }`}
        >
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-3 border-b border-slate-800 bg-[#121820] flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setMobileViewChat(false)}
                    className="md:hidden text-slate-400 hover:text-white p-1"
                  >
                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                  </button>

                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-700 to-indigo-800 flex items-center justify-center text-white font-semibold text-xs uppercase shrink-0">
                    {activeConversation.customerName ? activeConversation.customerName.slice(0, 2) : "WA"}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-semibold text-white truncate">
                        {activeConversation.customerName || formatPhoneDisplay(activeConversation.phoneNumber)}
                      </h3>
                      <button
                        onClick={handleToggleStatus}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition ${
                          activeConversation.status === "OPEN"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        }`}
                        title="Click to toggle status"
                      >
                        {activeConversation.status}
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 truncate flex items-center gap-2">
                      <span>{formatPhoneDisplay(activeConversation.phoneNumber)}</span>
                      {chatWindowInfo?.isOpen ? (
                        <span className="text-emerald-400 flex items-center gap-0.5 text-[10px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          24h Window Active ({Math.floor((chatWindowInfo.remainingSeconds || 0) / 3600)}h left)
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-0.5 text-[10px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Window Closed (Templates Only)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium hover:bg-purple-500/20 transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    <span className="hidden sm:inline">Templates</span>
                  </button>

                  <button
                    onClick={() => setShowRightSidebar(!showRightSidebar)}
                    className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                      showRightSidebar
                        ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                        : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                    title="Toggle customer details sidebar"
                  >
                    <span className="material-symbols-outlined text-base">person</span>
                  </button>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-3"
                style={{
                  backgroundImage: "radial-gradient(#1f2937 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                  backgroundColor: "#0A0E13",
                }}
              >
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                    <span className="material-symbols-outlined text-2xl animate-spin mr-2 text-purple-400">
                      progress_activity
                    </span>
                    Loading conversation history...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs space-y-2 max-w-sm mx-auto text-center">
                    <div className="h-12 w-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined text-2xl">chat</span>
                    </div>
                    <p className="font-medium text-slate-300">No messages in this chat yet</p>
                    <p className="text-[11px] text-slate-500">
                      Use the composer below or select an approved template to start communicating with this customer.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isOutbound = msg.direction === "OUTBOUND";
                    const showDateSeparator =
                      idx === 0 || formatDate(msg.sentAt) !== formatDate(messages[idx - 1].sentAt);

                    return (
                      <div key={msg._id || idx} className="space-y-3">
                        {showDateSeparator && (
                          <div className="flex justify-center my-3">
                            <span className="bg-[#161F2C] border border-slate-800 text-slate-400 text-[10px] font-medium px-2.5 py-1 rounded-full shadow-xs">
                              {formatDate(msg.sentAt)}
                            </span>
                          </div>
                        )}

                        <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 shadow-md text-xs relative group ${
                              isOutbound
                                ? "bg-[#1E293B] border border-purple-900/30 text-slate-100 rounded-br-xs"
                                : "bg-[#161F2C] border border-slate-700/60 text-slate-200 rounded-bl-xs"
                            }`}
                          >
                            {/* Message Type Label Badge */}
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              {msg.messageType === "TEMPLATE" ? (
                                <span className="bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[9px] font-semibold px-1.5 py-0.2 rounded flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[10px]">auto_awesome</span>
                                  API Template {msg.templateName ? `: ${msg.templateName}` : ""}
                                </span>
                              ) : msg.senderType === "SYSTEM" ? (
                                <span className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[9px] font-semibold px-1.5 py-0.2 rounded flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[10px]">smart_toy</span>
                                  Automated Message
                                </span>
                              ) : msg.senderType === "ADMIN" ? (
                                <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[9px] font-semibold px-1.5 py-0.2 rounded flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[10px]">support_agent</span>
                                  Manual Reply
                                </span>
                              ) : (
                                <span className="bg-slate-700/60 text-slate-300 text-[9px] font-medium px-1.5 py-0.2 rounded">
                                  Customer Message
                                </span>
                              )}
                            </div>

                            {/* Image Attachment */}
                            {msg.mediaUrl && msg.messageType === "IMAGE" && (
                              <div className="mb-2 rounded-lg overflow-hidden border border-slate-700">
                                <img
                                  src={msg.mediaUrl}
                                  alt="WhatsApp attachment"
                                  className="max-h-60 w-full object-cover"
                                  onError={(e) => {
                                    (e.target as any).style.display = "none";
                                  }}
                                />
                              </div>
                            )}

                            {/* Document Attachment */}
                            {msg.mediaUrl && msg.messageType === "DOCUMENT" && (
                              <a
                                href={msg.mediaUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-700 mb-2 hover:bg-slate-900 transition text-purple-300 text-[11px]"
                              >
                                <span className="material-symbols-outlined text-lg">description</span>
                                <span className="truncate">View attached document</span>
                              </a>
                            )}

                            {/* Rendered Message Content */}
                            <p className="whitespace-pre-wrap leading-relaxed select-text font-normal text-slate-100 text-[12px]">
                              {msg.messageContent}
                            </p>

                            {/* Template Parameters Metadata Details */}
                            {msg.templateParameters && Array.isArray(msg.templateParameters) && msg.templateParameters.length > 0 && (
                              <details className="mt-1.5 text-[10px] text-slate-400 border-t border-slate-700/40 pt-1">
                                <summary className="cursor-pointer hover:text-slate-300 select-none">
                                  Template variables ({msg.templateParameters.length})
                                </summary>
                                <ul className="mt-1 space-y-0.5 font-mono text-[9px] text-slate-400 bg-black/30 p-1.5 rounded">
                                  {msg.templateParameters.map((p, pIdx) => (
                                    <li key={pIdx}>
                                      <span className="text-purple-400">{`{{${pIdx + 1}}}`}:</span> {String(p)}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}

                            {/* Message Footer: Timestamp and Status Indicators */}
                            <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[10px] text-slate-400 select-none">
                              <span>{formatTime(msg.sentAt)}</span>
                              {isOutbound && (
                                <span
                                  className={`material-symbols-outlined text-[13px] ${
                                    msg.deliveryStatus === "READ"
                                      ? "text-sky-400"
                                      : msg.deliveryStatus === "DELIVERED"
                                      ? "text-slate-300"
                                      : msg.deliveryStatus === "FAILED"
                                      ? "text-rose-400"
                                      : "text-slate-400"
                                  }`}
                                  title={
                                    msg.deliveryStatus === "FAILED"
                                      ? `Delivery Failed: ${msg.errorDetails || "Network / Meta error"}`
                                      : `Status: ${msg.deliveryStatus}`
                                  }
                                >
                                  {msg.deliveryStatus === "READ"
                                    ? "done_all"
                                    : msg.deliveryStatus === "DELIVERED"
                                    ? "done_all"
                                    : msg.deliveryStatus === "SENT"
                                    ? "done"
                                    : msg.deliveryStatus === "FAILED"
                                    ? "error_outline"
                                    : "schedule"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* 24-Hour Policy Warning Banner */}
              {chatWindowInfo && !chatWindowInfo.isOpen && (
                <div className="bg-amber-500/10 border-t border-amber-500/30 px-3 py-2 flex items-center justify-between text-xs text-amber-300 shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-symbols-outlined text-sm text-amber-400 shrink-0">
                      lock_clock
                    </span>
                    <span className="truncate text-[11px]">
                      24-hour customer window is closed. Custom free-form messages disabled per Meta policy.
                    </span>
                  </div>
                  <button
                    onClick={handleOpenTemplates}
                    className="px-2.5 py-1 rounded bg-amber-500 text-black font-semibold text-[11px] shrink-0 hover:bg-amber-400 transition cursor-pointer"
                  >
                    Send Template
                  </button>
                </div>
              )}

              {/* Message Composer */}
              <div className="p-3 border-t border-slate-800 bg-[#121820] shrink-0">
                {showAttachInput && (
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="Paste image / document URL (https://...)"
                      value={attachmentUrl}
                      onChange={(e) => setAttachmentUrl(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-[#161F2C] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() => {
                        setAttachmentUrl("");
                        setShowAttachInput(false);
                      }}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAttachInput(!showAttachInput)}
                    className="p-2 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-400 hover:text-white transition cursor-pointer"
                    title="Attach image or file link"
                  >
                    <span className="material-symbols-outlined text-base">attach_file</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenTemplates}
                    className="p-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition cursor-pointer"
                    title="Select and send approved WhatsApp template"
                  >
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                  </button>

                  <div className="flex-1 relative">
                    <textarea
                      rows={1}
                      disabled={chatWindowInfo ? !chatWindowInfo.isOpen : false}
                      placeholder={
                        chatWindowInfo && !chatWindowInfo.isOpen
                          ? "24-hr window expired. Use 'Templates' to send message..."
                          : "Type a WhatsApp message... (Enter to send, Shift+Enter for newline)"
                      }
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full px-3 py-2 rounded-lg border border-slate-700/80 bg-[#161F2C] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none max-h-32 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendManualMessage()}
                    disabled={
                      (chatWindowInfo && !chatWindowInfo.isOpen) ||
                      (!messageText.trim() && !attachmentUrl.trim()) ||
                      sendingMessage
                    }
                    className="p-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md flex items-center justify-center shrink-0"
                    title="Send message"
                  >
                    {sendingMessage ? (
                      <span className="material-symbols-outlined text-base animate-spin">
                        progress_activity
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-base">send</span>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs space-y-3 p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-purple-900/20 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <span className="material-symbols-outlined text-3xl">chat</span>
              </div>
              <h3 className="text-base font-semibold text-white">StayCabs WhatsApp Inbox</h3>
              <p className="max-w-md text-slate-400 leading-relaxed text-[11px]">
                Select a conversation from the sidebar to view complete chat history, automated Cloud API messages, and reply to customers directly.
              </p>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* PANE C: RIGHT SIDEBAR - CUSTOMER INFORMATION                              */}
        {/* ========================================================================= */}
        {activeConversation && showRightSidebar && (
          <div className="w-80 border-l border-slate-800 bg-[#0E131A] overflow-y-auto shrink-0 p-4 space-y-4 hidden lg:block">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Customer Details
              </h3>
              <button
                onClick={() => setShowRightSidebar(false)}
                className="text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Profile Card */}
            <div className="text-center py-2 space-y-2">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-700 to-indigo-800 flex items-center justify-center text-white font-bold text-lg mx-auto shadow-md">
                {activeConversation.customerName ? activeConversation.customerName.slice(0, 2) : "WA"}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">
                  {activeConversation.customerName || formatPhoneDisplay(activeConversation.phoneNumber)}
                </h4>
                <p className="text-xs text-purple-400 font-mono">
                  {formatPhoneDisplay(activeConversation.phoneNumber)}
                </p>
              </div>

              {customerContext?.isExistingGuest ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="material-symbols-outlined text-xs">verified</span>
                  StayCabs Guest
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                  New WhatsApp Customer
                </span>
              )}
            </div>

            {/* Guest Record Section */}
            {customerContext?.guest && (
              <div className="rounded-xl border border-slate-800 bg-[#121820] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-purple-400 text-sm">badge</span>
                    Guest Profile
                  </span>
                  {customerContext.guest.vip && (
                    <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded font-bold">
                      VIP
                    </span>
                  )}
                </div>
                <div className="text-[11px] space-y-1 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Name:</span>
                    <span className="font-medium text-white">{customerContext.guest.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="truncate max-w-[150px]">{customerContext.guest.email || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Stays:</span>
                    <span className="font-semibold text-white">{customerContext.guest.stays || 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="text-emerald-400">{customerContext.guest.status || "Upcoming"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Homestay & Booking Details */}
            {customerContext?.latestBooking && (
              <div className="rounded-xl border border-slate-800 bg-[#121820] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-purple-400 text-sm">villa</span>
                    Homestay Booking
                  </span>
                  <span className="text-[10px] font-mono text-purple-300">
                    {customerContext.latestBooking.reference}
                  </span>
                </div>
                <div className="text-[11px] space-y-1 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Homestay:</span>
                    <span className="font-medium text-white truncate max-w-[140px]">
                      {customerContext.latestBooking.homestayName || customerContext.homestay?.name || "StayCabs Estate"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Room:</span>
                    <span className="truncate max-w-[140px]">{customerContext.latestBooking.roomName || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Check-In:</span>
                    <span className="font-mono">{formatDate(customerContext.latestBooking.checkIn)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Check-Out:</span>
                    <span className="font-mono">{formatDate(customerContext.latestBooking.checkOut)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="capitalize text-emerald-400">{customerContext.latestBooking.status}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Associated Cab Bookings */}
            <div className="rounded-xl border border-slate-800 bg-[#121820] p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-purple-400 text-sm">local_taxi</span>
                  Cab Bookings ({customerContext?.cabBookings?.length || 0})
                </span>
                {customerContext?.latestTrip?.propertyId && onNavigateToCabRequests && (
                  <button
                    onClick={() => onNavigateToCabRequests(String(customerContext.latestTrip.propertyId))}
                    className="text-[10px] text-purple-400 hover:underline"
                  >
                    View Desk
                  </button>
                )}
              </div>

              {customerContext?.cabBookings && customerContext.cabBookings.length > 0 ? (
                <div className="space-y-2">
                  {customerContext.cabBookings.slice(0, 3).map((trip) => (
                    <div
                      key={trip._id || trip.reference}
                      className="p-2 rounded-lg bg-black/30 border border-slate-800 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-purple-300">{trip.reference}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-slate-800 text-slate-300">
                          {trip.status}
                        </span>
                      </div>
                      <p className="text-slate-400 truncate">
                        {trip.pickupLocation?.address} → {(trip.destinations || [])[0]?.address || "Local"}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{trip.date ? formatDate(trip.date) : "—"}</span>
                        <span className="text-emerald-400 font-mono font-semibold">
                          ₹{trip.agreedFare ? Number(trip.agreedFare).toLocaleString("en-IN") : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">No cab requests found for this customer.</p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeConversation.phoneNumber);
                  alert(`Copied ${activeConversation.phoneNumber} to clipboard!`);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                Copy Phone Number
              </button>

              {onNavigateToGuests && customerContext?.guest?.name && (
                <button
                  onClick={() => onNavigateToGuests(customerContext.guest.name)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-xs text-purple-300 hover:bg-purple-500/20 transition cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  Open in Guests Desk
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL: WHATSAPP TEMPLATE SELECTOR & DISPATCH                           */}
      {/* ========================================================================= */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-[#121820] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">auto_awesome</span>
                <h3 className="text-sm font-semibold text-white">Select WhatsApp Template</h3>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Template Picker */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Approved Template
                </label>
                <select
                  value={selectedTemplate?.id || ""}
                  onChange={(e) => {
                    const tpl = templates.find((t) => t.id === e.target.value);
                    if (tpl) selectTemplateForComposer(tpl);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#161F2C] text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.title} ({tpl.name}) • {tpl.language.toUpperCase()}
                    </option>
                  ))}
                </select>
                {selectedTemplate && (
                  <p className="text-[11px] text-slate-400 mt-1">{selectedTemplate.description}</p>
                )}
              </div>

              {/* Template Variables Inputs */}
              {selectedTemplate && selectedTemplate.variables.length > 0 && (
                <div className="space-y-3 p-3.5 rounded-xl border border-slate-800 bg-[#161F2C]">
                  <h4 className="text-xs font-semibold text-purple-300">
                    Template Variables ({selectedTemplate.variables.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedTemplate.variables.map((v) => (
                      <div key={v.index}>
                        <label className="block text-[11px] font-medium text-slate-300 mb-1">
                          {`{{${v.index}}}`} {v.name}
                        </label>
                        <input
                          type="text"
                          placeholder={v.placeholder}
                          value={templateValues[v.index] || ""}
                          onChange={(e) =>
                            setTemplateValues((prev) => ({ ...prev, [v.index]: e.target.value }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rendered Live Preview */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Rendered Preview
                </label>
                <div className="p-3.5 rounded-xl border border-purple-500/30 bg-[#182230] text-slate-100 text-xs whitespace-pre-wrap font-sans leading-relaxed shadow-inner">
                  {renderTemplatePreview()}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-[#161F2C] flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Recipient: <strong className="text-white">{formatPhoneDisplay(activeConversation?.phoneNumber || "")}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendTemplate}
                  disabled={sendingTemplate}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {sendingTemplate ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">
                        progress_activity
                      </span>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">send</span>
                      <span>Send Template</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
