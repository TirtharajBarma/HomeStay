"use client";

import { useEffect, useRef, useState, useMemo } from "react";
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

// Helpers
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
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function formatPhoneDisplay(raw?: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return `+${digits}`;
}

// Extract any valid URL from message text
function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

// Quick canned responses for instant dispatcher replies
const CANNED_RESPONSES = [
  { label: "Driver 5m away", text: "Namaste! Your assigned driver is approximately 5 minutes away from your pickup point." },
  { label: "Share location", text: "Please share your current live GPS WhatsApp location so our driver can reach your exact spot." },
  { label: "Homestay Welcome", text: "Welcome to your homestay! If you need local sightseeing, Tiger Hill sunrise, or an airport drop, let us know." },
  { label: "Booking Confirmed", text: "Your cab booking is confirmed. Verified driver details and vehicle registration have been assigned." },
  { label: "Cash on Drop", text: "The remaining trip balance is to be paid directly in cash to the driver at your drop-off destination." },
  { label: "24/7 Desk", text: "Our StayCabs operations desk is available 24/7. Feel free to call us at any time during your trip." },
];

// Dynamic template text formatters that use active customer values
const TEMPLATE_FORMATTERS: Record<string, (p: Record<number, string>) => string> = {
  ask_cab: (p) =>
    `Namaste ${p[1] || "Guest"}.\nIf you need an airport transfer, sightseeing, or a local hill cab during your stay at ${p[2] || "StayCabs Homestay"}, please share your itinerary and we will arrange a verified driver for you:\n${p[3] || "https://staycabs.in/cab-request"}`,
  new_trip_request: (p) =>
    `New trip request from ${p[1] || "StayCabs Partner"}.\nRoute: ${p[2] || "Route"}\nPickup: ${p[3] || "Pickup"}\nVehicle: ${p[4] || "Cab"}\n\nSubmit your total trip fare quotation here: ${p[5] || ""}`,
  quote_accepted_guest: (p) =>
    `Namaste ${p[1] || "Guest"},\nA verified driver is reserved for your trip.\nDriver: ${p[2] || "Driver"}\nVehicle: ${p[3] || "Vehicle"}\nTotal fare: ${p[4] || "₹0"}\n\nPlease pay the advance booking fee of ${p[5] || "₹0"} here: ${p[6] || ""}\nPlease pay ${p[7] || "soon"} to confirm your cab. The rest is paid in cash to your driver at drop-off.`,
  advance_paid_guest: (p) =>
    `Namaste ${p[1] || "Guest"},\nYour cab booking is confirmed.\nDriver: ${p[2] || "Driver"}, phone ${p[3] || "Phone"}\nVehicle: ${p[4] || "Vehicle"}\nRoute: ${p[5] || "Route"}\nPickup: ${p[6] || "Pickup"}\n\nThe remaining fare of ${p[7] || "Cash"} is paid in cash to your driver at drop-off.\nTrack your cab and view your trip pass here: ${p[8] || ""}\nHave a safe journey.`,
  boarding_pin_guest: (p) =>
    `${p[1] || "XXXX"} is your boarding PIN. Share it with your driver at pickup.`,
  advance_paid_driver: (p) =>
    `Hello ${p[1] || "Driver"},\nThe online booking fee is received and trip ${p[2] || "Ref"} is confirmed.\nPassenger: ${p[3] || "Passenger"}, phone ${p[4] || "Phone"}\nRoute: ${p[5] || "Route"}\nPickup: ${p[6] || "Pickup"}\n\nCollect your cash fare of ${p[7] || "Cash"} directly from the passenger at drop-off.\nOpen trip details here: ${p[8] || ""}\nThank you.`,
  trip_assigned_driver: (p) =>
    `Hi ${p[1] || "Driver"},\n${p[2] || "Homestay"} has assigned you a trip.\nGuest: ${p[3] || "Guest"} (${p[4] || "Phone"})\nRoute: ${p[5] || "Route"}\nWhen: ${p[6] || "When"}`,
  quote_counter: (p) =>
    `Hello ${p[1] || "Driver"},\nThe homestay has made a counter-offer of ${p[3] || "Counter Fare"} for trip ${p[2] || "Ref"}.\nYou can accept this offer or keep your original fare here:\n${p[4] || ""}`,
  trip_cancelled_guest: (p) =>
    `Hello ${p[1] || "Guest"},\nYour cab request ${p[2] || "Ref"} for ${p[3] || "When"} has been cancelled. ${p[4] || ""}`,
  refund_guest: (p) =>
    `Hi ${p[1] || "Guest"},\nStayCabs has refunded your advance of ${p[2] || "Amount"} for trip ${p[3] || "Ref"} (reference ${p[4] || "UTR"}). Your bank may take a few days to show it.`,
  completion_reminder_driver: (p) =>
    `Hello ${p[1] || "Driver"},\nHave you completed the trip for ${p[2] || "Guest"} (${p[4] || "Ref"})?\nPlease confirm cash collection of ${p[3] || "Cash"} and tap to complete the ride:\n${p[5] || ""}`,
  driver_welcome: (p) =>
    `Namaste ${p[1] || "Driver"}!\nYour driver registration (${p[2] || "Plate"}) has been submitted to StayCabs.\nOur operations team will review your vehicle details shortly. Once approved, you will receive trip booking alerts directly on this WhatsApp number.\nHappy driving with StayCabs!`,
  driver_payout_settled: (p) =>
    `StayCabs Payout: ₹${p[1] || "Amount"} has been sent to your UPI account (Bank UTR: ${p[2] || "UTR"}).`,
  quote_accepted_driver: (p) =>
    `Hello ${p[1] || "Driver"},\nYour quotation for trip ${p[2] || "Ref"} has been accepted by the guest.\nWe are waiting for the online advance payment hold to confirm your ride.\nStay prepared.`,
  advance_expired_guest: (p) =>
    `Namaste ${p[1] || "Guest"}.\nThe advance booking hold for cab request ${p[2] || "Ref"} has expired.\nYou can submit a fresh request at https://staycabs.in/cab-request whenever you are ready.`,
  vehicle_updated_guest: (p) =>
    `Namaste ${p[1] || "Guest"},\nYour assigned cab for trip ${p[2] || "Ref"} has been updated.\nDriver: ${p[4] || "Verified Driver"}\nVehicle Plate: ${p[3] || "Plate"}\nBoarding PIN: ${p[5] || "----"}\nPlease verify this registration at pickup.`,
  driver_payout_rejected: (p) =>
    `StayCabs Payout: Your payout request of ₹${p[1] || "Amount"} could not be settled.\nReason: ${p[2] || "Reason"}.\nPlease update your bank/UPI details in the StayRide Driver App.`,
  bidding_timeout_owner: (p) =>
    `Alert for ${p[1] || "Homestay"}:\nNo hill driver has quoted for guest ${p[2] || "Guest"}'s trip from ${p[3] || "Pickup"} yet.\nPlease review the request or assign an in-house fleet vehicle:\n${p[4] || "https://staycabs.in/owner"}`,
};

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
  const [showCannedReplies, setShowCannedReplies] = useState(false);

  // State: Templates Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<number, string>>({});
  const [templateCategoryTab, setTemplateCategoryTab] = useState<"recommended" | "guest" | "ride" | "driver" | "all">("recommended");
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // State: UI Utilities
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [mobileViewChat, setMobileViewChat] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [pollingConnected, setPollingConnected] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Toast feedback helper
  function triggerToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

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

          if (!activeConversationId && json.data.conversations?.length > 0 && typeof window !== "undefined" && window.innerWidth >= 1024) {
            selectConversation(json.data.conversations[0]);
          }
        }
        return true;
      }
      return false;
    } catch (err: any) {
      // Backend server might be offline or starting up
      if (process.env.NODE_ENV === "development") {
        console.debug("Backend offline or unreachable on port 5050:", err?.message || err);
      }
      return false;
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
      const detailRes = await apiFetch(API_ENDPOINTS.whatsappConversation(conv._id, demo));
      if (detailRes.ok) {
        const detailJson = await detailRes.json();
        if (detailJson.success && detailJson.data) {
          setActiveConversation(detailJson.data.conversation);
          setChatWindowInfo(detailJson.data.window);
          setCustomerContext(detailJson.data.customerContext);
        }
      }

      const msgRes = await apiFetch(API_ENDPOINTS.whatsappMessages(conv._id, demo ? "demo=true" : ""));
      if (msgRes.ok) {
        const msgJson = await msgRes.json();
        if (msgJson.success && Array.isArray(msgJson.data)) {
          setMessages(msgJson.data);
        }
      }

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

  // 3. Scroll to bottom
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

  // 5. Real-time Live Synchronisation: Smart Polling + Socket.IO Fallback
  useEffect(() => {
    let isMounted = true;
    const isLocalhost =
      typeof window !== "undefined" &&
      (/localhost|127\.0\.0\.1/.test(window.location.hostname) ||
        /localhost|127\.0\.0\.1/.test(SOCKET_SERVER_URL));

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

        socket.on("whatsapp:message", (data: { conversation: ConversationItem; message: ChatMessage }) => {
          if (!data?.message || !isMounted) return;

          if (data.message.conversationId === activeConversationId || data.conversation?._id === activeConversationId) {
            setMessages((prev) => {
              if (prev.some((m) => m._id === data.message._id || (m.whatsappMessageId && m.whatsappMessageId === data.message.whatsappMessageId))) {
                return prev.map((m) =>
                  m._id === data.message._id || m.whatsappMessageId === data.message.whatsappMessageId ? data.message : m
                );
              }
              return [...prev, data.message];
            });

            if (data.message.direction === "INBOUND") {
              setChatWindowInfo({
                isOpen: true,
                lastInboundAt: data.message.sentAt,
                expiresAt: new Date(new Date(data.message.sentAt).getTime() + 24 * 3600 * 1000).toISOString(),
                remainingSeconds: 24 * 3600,
              });
            }
          }

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
              updated.splice(index, 1);
              return [item, ...updated];
            } else if (data.conversation) {
              return [data.conversation, ...prev];
            }
            return prev;
          });
        });

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

    // Polling worker for Vercel/production
    async function pollActiveMessages() {
      if (!activeConversationId || !isMounted) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

      try {
        const res = await apiFetch(API_ENDPOINTS.whatsappMessages(activeConversationId, demo ? "demo=true" : ""));
        if (!isMounted) return;
        if (!res.ok) {
          setPollingConnected(false);
          return;
        }
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setPollingConnected(true);
          setMessages((prev) => {
            if (json.data.length !== prev.length) return json.data;
            const hasDiff = json.data.some((m: ChatMessage, idx: number) => {
              const existing = prev[idx];
              return !existing || existing._id !== m._id || existing.deliveryStatus !== m.deliveryStatus;
            });
            return hasDiff ? json.data : prev;
          });
        }
      } catch {
        if (isMounted) setPollingConnected(false);
      }
    }

    async function pollConversationsList() {
      if (!isMounted) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const ok = await fetchConversations(false);
        if (isMounted) setPollingConnected(ok);
      } catch {
        if (isMounted) setPollingConnected(false);
      }
    }

    const messageInterval = setInterval(pollActiveMessages, 3500);
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
  async function handleSendManualMessage(customText?: string) {
    const textToSend = (customText !== undefined ? customText : messageText).trim();
    if (!activeConversationId || (!textToSend && !attachmentUrl.trim()) || sendingMessage) return;

    const media = attachmentUrl.trim() || undefined;

    setSendingMessage(true);
    try {
      const res = await apiFetch(API_ENDPOINTS.whatsappSendMessage(activeConversationId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSend,
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
          setShowCannedReplies(false);
        }
      } else {
        const errMsg = await readApiError(res, "Failed to send message.");
        triggerToast(errMsg);
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to send message.");
    } finally {
      setSendingMessage(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendManualMessage();
    }
  }

  // 7. Auto-populate Template Variables for THIS SPECIFIC CUSTOMER
  function getAutoPopulatedVariables(tpl: TemplateItem): Record<number, string> {
    const values: Record<number, string> = {};

    const isPhone = (s?: string) => !s || /^\+?\d+$/.test(s.trim());

    // Clean resolution for Guest Name (never use a phone number as a person's name)
    const rawGuest =
      customerContext?.guest?.name ||
      customerContext?.latestBooking?.guestName ||
      (!isPhone(activeConversation?.customerName) ? activeConversation?.customerName : "");
    const guestName = rawGuest && rawGuest.trim() ? rawGuest.trim() : "Guest";

    // Clean resolution for Driver Name (never use a phone number as driver name)
    const rawDriver =
      (customerContext as any)?.driver?.name ||
      customerContext?.latestTrip?.assignedDriverName ||
      (!isPhone(activeConversation?.customerName) ? activeConversation?.customerName : "");
    const driverName = rawDriver && rawDriver.trim() ? rawDriver.trim() : "Driver Partner";

    const homestayName =
      customerContext?.homestay?.name ||
      customerContext?.latestBooking?.homestayName ||
      "StayCabs Homestay";

    const customerPhone = activeConversation?.phoneNumber ? formatPhoneDisplay(activeConversation.phoneNumber) : "+91 98320 12345";
    const tripRef = customerContext?.latestTrip?.reference || customerContext?.latestBooking?.reference || `REQ-${(activeConversation?._id || "9F2A61").slice(-6).toUpperCase()}`;

    const pickupAddr = customerContext?.latestTrip?.pickupLocation?.address || "Bagdogra Airport";
    const dropAddr = (customerContext?.latestTrip?.destinations || [])[0]?.address || (homestayName ? `${homestayName}` : "Darjeeling Mall Road");
    const route = `${pickupAddr} → ${dropAddr}`;

    const tripWhen = customerContext?.latestTrip?.date
      ? `${formatDate(customerContext.latestTrip.date)}${customerContext.latestTrip.time ? ` at ${customerContext.latestTrip.time}` : ""}`
      : "Tomorrow at 09:30 AM";

    const vehicleType = customerContext?.latestTrip?.vehicleType || "SUV";
    const driverPhone = customerContext?.latestTrip?.assignedDriverPhone || "+91 98320 44556";
    const totalFare = customerContext?.latestTrip?.agreedFare ? `₹${Number(customerContext.latestTrip.agreedFare).toLocaleString("en-IN")}` : "₹2,800";
    const advanceAmount = customerContext?.latestTrip?.advanceAmount ? `₹${Number(customerContext.latestTrip.advanceAmount).toLocaleString("en-IN")}` : "₹700";
    const remainingCash = customerContext?.latestTrip?.remainingCashAmount ? `₹${Number(customerContext.latestTrip.remainingCashAmount).toLocaleString("en-IN")}` : "₹2,100";
    const pin = String(customerContext?.latestTrip?.pickupOtp || "4821");

    tpl.variables.forEach((v) => {
      if (tpl.id === "ask_cab") {
        if (v.index === 1) values[1] = guestName;
        if (v.index === 2) values[2] = homestayName;
        if (v.index === 3) values[3] = `https://staycabs.in/cab-request?ref=${tripRef}&phone=${activeConversation?.phoneNumber || ""}`;
      } else if (tpl.id === "new_trip_request") {
        if (v.index === 1) values[1] = homestayName;
        if (v.index === 2) values[2] = route;
        if (v.index === 3) values[3] = tripWhen;
        if (v.index === 4) values[4] = vehicleType;
        if (v.index === 5) values[5] = `https://staycabs.in/driver-quote?t=${tripRef}`;
      } else if (tpl.id === "quote_accepted_guest") {
        if (v.index === 1) values[1] = guestName;
        if (v.index === 2) values[2] = driverName;
        if (v.index === 3) values[3] = vehicleType;
        if (v.index === 4) values[4] = totalFare;
        if (v.index === 5) values[5] = advanceAmount;
        if (v.index === 6) values[6] = `https://staycabs.in/pay/${tripRef}`;
        if (v.index === 7) values[7] = "within 30 minutes";
      } else if (tpl.id === "advance_paid_guest") {
        if (v.index === 1) values[1] = guestName;
        if (v.index === 2) values[2] = driverName;
        if (v.index === 3) values[3] = driverPhone;
        if (v.index === 4) values[4] = `${vehicleType} (${customerContext?.latestTrip?.vehicleDetails?.plate || "Verified Cab"})`;
        if (v.index === 5) values[5] = route;
        if (v.index === 6) values[6] = tripWhen;
        if (v.index === 7) values[7] = remainingCash;
        if (v.index === 8) values[8] = `https://staycabs.in/cab-request?ref=${tripRef}`;
      } else if (tpl.id === "boarding_pin_guest") {
        if (v.index === 1) values[1] = pin;
      } else if (tpl.id === "advance_paid_driver") {
        if (v.index === 1) values[1] = driverName;
        if (v.index === 2) values[2] = tripRef;
        if (v.index === 3) values[3] = guestName;
        if (v.index === 4) values[4] = customerPhone;
        if (v.index === 5) values[5] = route;
        if (v.index === 6) values[6] = tripWhen;
        if (v.index === 7) values[7] = remainingCash;
        if (v.index === 8) values[8] = `https://staycabs.in/driver-quote?t=${tripRef}`;
      } else if (tpl.id === "trip_assigned_driver") {
        if (v.index === 1) values[1] = driverName;
        if (v.index === 2) values[2] = homestayName;
        if (v.index === 3) values[3] = guestName;
        if (v.index === 4) values[4] = customerPhone;
        if (v.index === 5) values[5] = route;
        if (v.index === 6) values[6] = tripWhen;
      } else if (tpl.id === "quote_counter") {
        if (v.index === 1) values[1] = driverName;
        if (v.index === 2) values[2] = tripRef;
        if (v.index === 3) values[3] = totalFare;
        if (v.index === 4) values[4] = `https://staycabs.in/quote/${tripRef}`;
      } else if (tpl.id === "trip_cancelled_guest") {
        if (v.index === 1) values[1] = guestName;
        if (v.index === 2) values[2] = tripRef;
        if (v.index === 3) values[3] = tripWhen;
        if (v.index === 4) values[4] = "Due to mountain route advisory. Any advance paid will be automatically refunded.";
      } else if (tpl.id === "refund_guest") {
        if (v.index === 1) values[1] = guestName;
        if (v.index === 2) values[2] = advanceAmount;
        if (v.index === 3) values[3] = tripRef;
        if (v.index === 4) values[4] = `RFND-${Date.now().toString().slice(-6)}`;
      } else if (tpl.id === "completion_reminder_driver") {
        if (v.index === 1) values[1] = driverName;
        if (v.index === 2) values[2] = guestName;
        if (v.index === 3) values[3] = remainingCash;
        if (v.index === 4) values[4] = tripRef;
        if (v.index === 5) values[5] = `https://staycabs.in/trip/complete?ref=${tripRef}`;
      } else if (tpl.id === "driver_welcome") {
        if (v.index === 1) values[1] = activeConversation?.customerName || "Driver Partner";
        if (v.index === 2) values[2] = customerContext?.latestTrip?.vehicleDetails?.plate || "SK-01-A-4567";
      } else if (tpl.id === "driver_payout_settled") {
        if (v.index === 1) values[1] = "₹4,500";
        if (v.index === 2) values[2] = `UPI-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
      } else if (tpl.id === "quote_accepted_driver") {
        if (v.index === 1) values[1] = driverName;
        if (v.index === 2) values[2] = tripRef;
      } else if (tpl.id === "advance_expired_guest") {
        if (v.index === 1) values[1] = guestName;
        if (v.index === 2) values[2] = tripRef;
      } else if (tpl.id === "vehicle_updated_guest") {
        if (v.index === 1) values[1] = guestName;
        if (v.index === 2) values[2] = tripRef;
        if (v.index === 3) values[3] = customerContext?.latestTrip?.vehicleDetails?.plate || "WB-74-A-9999";
        if (v.index === 4) values[4] = driverName;
        if (v.index === 5) values[5] = pin;
      } else if (tpl.id === "driver_payout_rejected") {
        if (v.index === 1) values[1] = "₹3,000";
        if (v.index === 2) values[2] = "Incorrect UPI virtual payment address";
      } else if (tpl.id === "bidding_timeout_owner") {
        if (v.index === 1) values[1] = homestayName;
        if (v.index === 2) values[2] = guestName;
        if (v.index === 3) values[3] = pickupAddr;
        if (v.index === 4) values[4] = `https://staycabs.in/owner?t=${tripRef}`;
      } else {
        values[v.index] = v.sample || "";
      }
    });

    return values;
  }

  function handleOpenTemplates() {
    if (templates.length > 0) {
      // Intelligently detect if this contact is a Driver or Guest
      const isDriverContact =
        Boolean((customerContext as any)?.driver) ||
        Boolean((customerContext as any)?.isDriver) ||
        messages.some(
          (m) =>
            m.templateName === "new_trip_request" ||
            m.templateName === "advance_paid_driver" ||
            m.messageContent.includes("Submit your total trip fare quotation")
        );

      if (isDriverContact) {
        setTemplateCategoryTab("driver");
        const defaultDriverTpl =
          templates.find((t) => t.id === "new_trip_request" || t.id === "advance_paid_driver") ||
          templates[0];
        selectTemplateForComposer(defaultDriverTpl);
      } else {
        const hasCabs = (customerContext?.cabBookings?.length || 0) > 0;
        setTemplateCategoryTab(hasCabs ? "ride" : "guest");
        const defaultGuestTpl =
          templates.find((t) => (hasCabs ? t.id === "advance_paid_guest" : t.id === "ask_cab")) ||
          templates[0];
        selectTemplateForComposer(defaultGuestTpl);
      }
    }
    setShowTemplateModal(true);
  }

  function selectTemplateForComposer(tpl: TemplateItem) {
    setSelectedTemplate(tpl);
    const populated = getAutoPopulatedVariables(tpl);
    setTemplateValues(populated);
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
          triggerToast(`Template "${selectedTemplate.title}" sent successfully!`);
        }
      } else {
        const errMsg = await readApiError(res, "Failed to send template message.");
        triggerToast(errMsg);
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to send template message.");
    } finally {
      setSendingTemplate(false);
    }
  }

  // 9. Toggle Conversation Status
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
        triggerToast(`Conversation marked as ${nextStatus}`);
      }
    } catch {
      triggerToast("Failed to update status");
    }
  }

  // Copy phone helper
  function handleCopyPhone(phone: string) {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    triggerToast(`Phone ${phone} copied to clipboard`);
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  // Render preview of template body with active customer values
  function renderTemplatePreview(): string {
    if (!selectedTemplate) return "";
    const formatter = TEMPLATE_FORMATTERS[selectedTemplate.id];
    if (formatter) {
      return formatter(templateValues);
    }
    // Fallback: replace any variable placeholders or samples
    let text = selectedTemplate.samplePreview;
    selectedTemplate.variables.forEach((v) => {
      const val = templateValues[v.index];
      if (val && v.sample) {
        text = text.replace(v.sample, val);
      }
    });
    return text;
  }

  // Categorized templates for the modal
  const filteredTemplates = useMemo(() => {
    if (templateCategoryTab === "all") return templates;
    if (templateCategoryTab === "recommended") {
      const hasCabs = (customerContext?.cabBookings?.length || 0) > 0;
      return templates.filter((t) =>
        hasCabs
          ? ["quote_accepted_guest", "advance_paid_guest", "boarding_pin_guest", "trip_cancelled_guest"].includes(t.id)
          : ["ask_cab", "new_trip_request", "quote_accepted_guest"].includes(t.id)
      );
    }
    if (templateCategoryTab === "guest") {
      return templates.filter((t) => ["ask_cab", "quote_accepted_guest", "advance_paid_guest", "boarding_pin_guest", "trip_cancelled_guest", "refund_guest", "advance_expired_guest", "vehicle_updated_guest"].includes(t.id));
    }
    if (templateCategoryTab === "ride") {
      return templates.filter((t) => ["new_trip_request", "quote_accepted_guest", "advance_paid_guest", "quote_counter", "completion_reminder_driver", "quote_accepted_driver", "vehicle_updated_guest"].includes(t.id));
    }
    if (templateCategoryTab === "driver") {
      return templates.filter((t) => ["new_trip_request", "advance_paid_driver", "trip_assigned_driver", "completion_reminder_driver", "driver_welcome", "driver_payout_settled", "driver_payout_rejected", "quote_accepted_driver", "bidding_timeout_owner"].includes(t.id));
    }
    return templates;
  }, [templates, templateCategoryTab, customerContext]);

  const syncConnected = socketConnected || pollingConnected;

  // Render message text with auto-link clickable anchors
  function renderClickableText(content: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] min-h-[580px] bg-[#0B1015] text-[#E9EDEF] rounded-xl border border-slate-800 shadow-2xl overflow-hidden font-sans">
      {/* 1. TOP HEADER / STATUS BAR */}
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-[#111B21] px-4 py-2.5 text-xs select-none">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                syncConnected ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                syncConnected ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </span>
          <span className="font-medium text-slate-300">
            {socketConnected ? "Cloud API Live Sync" : pollingConnected ? "Cloud API Polling Sync" : "Connecting..."}
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400 font-mono text-[11px]">
            {totalCount} Total Conversations ({unreadTotal} Unread)
          </span>
        </div>

        <div className="flex items-center gap-3">
          {toastMessage && (
            <div className="text-[11px] text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-0.5 rounded-md animate-fade-in">
              {toastMessage}
            </div>
          )}
          <button
            onClick={() => fetchConversations(true)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition cursor-pointer text-xs font-medium px-2 py-1 rounded hover:bg-slate-800/60"
            title="Refresh conversations list"
          >
            <span className={`material-symbols-outlined text-sm ${loadingConversations ? "animate-spin text-emerald-400" : ""}`}>
              refresh
            </span>
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
          className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-slate-800/80 bg-[#111B21] shrink-0 transition-all ${
            mobileViewChat ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Search Bar */}
          <div className="p-3 border-b border-slate-800/80 bg-[#111B21] space-y-2.5">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-500 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Search name, phone, message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-800 bg-[#202C33] text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500/60 transition"
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
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-[#202C33] text-slate-300 hover:text-white hover:bg-slate-700/60"
                  }`}
                >
                  <span>{f}</span>
                  {f === "unread" && unreadTotal > 0 && (
                    <span className="bg-emerald-400 text-black text-[9px] px-1.5 py-0.2 rounded-full font-bold">
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
                <span className="material-symbols-outlined text-2xl animate-spin mb-2 text-emerald-400 block">
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
                  When guests or drivers message your WhatsApp Cloud API number, chats will appear here instantly.
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
                    className={`flex items-start gap-3 p-3 transition cursor-pointer select-none border-l-3 ${
                      isSelected
                        ? "bg-[#202C33] border-emerald-500"
                        : conv.unreadCount > 0
                        ? "bg-[#182229] border-emerald-400 hover:bg-[#202C33]/60"
                        : "border-transparent hover:bg-[#202C33]/40"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-full bg-slate-700/80 border border-slate-600/40 flex items-center justify-center text-slate-200 font-semibold text-xs uppercase shadow-sm">
                        {conv.customerName ? conv.customerName.slice(0, 2) : "WA"}
                      </div>
                      {conv.status === "CLOSED" ? (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-slate-600 border-2 border-[#111B21]"
                          title="Closed conversation"
                        />
                      ) : (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[#111B21]"
                          title="Open conversation"
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
                          <span className="shrink-0 bg-emerald-500 text-black font-bold text-[10px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center">
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
          className={`flex-1 flex flex-col bg-[#0B1015] min-w-0 relative ${
            !mobileViewChat ? "hidden md:flex" : "flex"
          }`}
        >
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-slate-800 bg-[#111B21] flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setMobileViewChat(false)}
                    className="md:hidden text-slate-400 hover:text-white p-1"
                  >
                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                  </button>

                  <div className="h-9 w-9 rounded-full bg-slate-700/80 border border-slate-600/50 flex items-center justify-center text-slate-200 font-semibold text-xs uppercase shrink-0">
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
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        }`}
                        title="Click to toggle status"
                      >
                        {activeConversation.status}
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 truncate flex items-center gap-2">
                      <span>{formatPhoneDisplay(activeConversation.phoneNumber)}</span>
                      <span className="text-slate-600">•</span>
                      {chatWindowInfo?.isOpen ? (
                        <span className="text-emerald-400 flex items-center gap-1 text-[10px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          24h Window Active ({Math.floor((chatWindowInfo.remainingSeconds || 0) / 3600)}h left)
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1 text-[10px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Window Closed (Templates Only)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleOpenTemplates}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-xs font-medium hover:bg-emerald-900/40 transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">bookmark</span>
                    <span className="hidden sm:inline">Templates</span>
                  </button>

                  <button
                    onClick={() => setShowRightSidebar(!showRightSidebar)}
                    className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                      showRightSidebar
                        ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
                        : "border-slate-800 bg-[#202C33] text-slate-400 hover:text-white"
                    }`}
                    title="Toggle customer details sidebar"
                  >
                    <span className="material-symbols-outlined text-base">person</span>
                  </button>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0B1015]">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                    <span className="material-symbols-outlined text-2xl animate-spin mr-2 text-emerald-400">
                      progress_activity
                    </span>
                    Loading conversation history...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs space-y-2 max-w-sm mx-auto text-center">
                    <div className="h-12 w-12 rounded-full bg-[#182229] border border-slate-700/60 flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined text-2xl text-emerald-400">chat</span>
                    </div>
                    <p className="font-medium text-slate-300">No messages in this chat yet</p>
                    <p className="text-[11px] text-slate-400">
                      Use the message composer below or dispatch a pre-approved template for this recipient.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isOutbound = msg.direction === "OUTBOUND";
                    const showDateSeparator =
                      idx === 0 || formatDate(msg.sentAt) !== formatDate(messages[idx - 1].sentAt);
                    const linkInText = extractFirstUrl(msg.messageContent);

                    return (
                      <div key={msg._id || idx} className="space-y-3">
                        {showDateSeparator && (
                          <div className="flex justify-center my-3">
                            <span className="bg-[#182229] border border-slate-800 text-slate-400 text-[10px] font-medium px-3 py-1 rounded-full shadow-xs">
                              {formatDate(msg.sentAt)}
                            </span>
                          </div>
                        )}

                        <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-md text-xs relative group ${
                              isOutbound
                                ? "bg-[#005C4B] text-white rounded-br-xs border border-emerald-600/30"
                                : "bg-[#202C33] text-slate-100 rounded-bl-xs border border-slate-700/60"
                            }`}
                          >
                            {/* Template or Automated Badge */}
                            {msg.messageType === "TEMPLATE" ? (
                              <div className="mb-1.5 flex items-center gap-1.5">
                                <span className="bg-black/25 text-emerald-200 text-[10px] font-medium px-2 py-0.5 rounded flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[11px]">bookmark</span>
                                  Template: {msg.templateName || "Approved Utility"}
                                </span>
                              </div>
                            ) : msg.senderType === "SYSTEM" ? (
                              <div className="mb-1.5 flex items-center gap-1.5">
                                <span className="bg-black/20 text-slate-300 text-[9px] font-medium px-1.5 py-0.2 rounded flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[10px]">smart_toy</span>
                                  System Alert
                                </span>
                              </div>
                            ) : null}

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
                                className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-slate-700/50 mb-2 hover:bg-black/50 transition text-emerald-300 text-[11px]"
                              >
                                <span className="material-symbols-outlined text-lg">description</span>
                                <span className="truncate">View attached document</span>
                              </a>
                            )}

                            {/* Rendered Message Content with Clickable URLs */}
                            <p className="whitespace-pre-wrap leading-relaxed select-text font-normal text-[12.5px]">
                              {renderClickableText(msg.messageContent)}
                            </p>

                            {/* Interactive Link Card Button (WhatsApp Style CTA) */}
                            {linkInText && (
                              <a
                                href={linkInText}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`mt-2.5 flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition text-xs font-medium border ${
                                  isOutbound
                                    ? "bg-black/20 hover:bg-black/30 border-white/20 text-white"
                                    : "bg-slate-900/60 hover:bg-slate-900 border-slate-700 text-emerald-400"
                                }`}
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                                  <span className="truncate">
                                    {linkInText.includes("cab-request")
                                      ? "Request Cab Online"
                                      : linkInText.includes("pay")
                                      ? "Pay Booking Advance"
                                      : linkInText.includes("driver-quote")
                                      ? "Submit Driver Quote"
                                      : "Open Link"}
                                  </span>
                                </span>
                                <span className="material-symbols-outlined text-xs">arrow_forward</span>
                              </a>
                            )}

                            {/* Footer: Timestamp and Delivery Status */}
                            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-300/80 select-none">
                              <span>{formatTime(msg.sentAt)}</span>
                              {isOutbound && (
                                <span
                                  className={`material-symbols-outlined text-[13px] ${
                                    msg.deliveryStatus === "READ"
                                      ? "text-sky-300"
                                      : msg.deliveryStatus === "DELIVERED"
                                      ? "text-slate-300"
                                      : msg.deliveryStatus === "FAILED"
                                      ? "text-rose-400"
                                      : "text-slate-300"
                                  }`}
                                  title={
                                    msg.deliveryStatus === "FAILED"
                                      ? `Delivery Failed: ${msg.errorDetails || "Meta error"}`
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
                <div className="bg-amber-500/10 border-t border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-amber-300 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-base text-amber-400 shrink-0">
                      lock_clock
                    </span>
                    <span className="truncate text-[11px]">
                      24-hour customer window is closed. Custom free-form messages disabled per Meta policy.
                    </span>
                  </div>
                  <button
                    onClick={handleOpenTemplates}
                    className="px-3 py-1 rounded bg-amber-400 text-black font-semibold text-[11px] shrink-0 hover:bg-amber-300 transition cursor-pointer"
                  >
                    Send Template
                  </button>
                </div>
              )}

              {/* Quick Canned Responses Strip */}
              {showCannedReplies && (
                <div className="border-t border-slate-800 bg-[#141E26] px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                  <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0 tracking-wider">
                    Quick:
                  </span>
                  {CANNED_RESPONSES.map((chip, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setMessageText(chip.text);
                        setShowCannedReplies(false);
                      }}
                      className="px-2.5 py-1 rounded-full bg-[#202C33] hover:bg-emerald-950 hover:border-emerald-500/40 border border-slate-700/60 text-[11px] text-slate-200 hover:text-emerald-300 transition shrink-0 cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowCannedReplies(false)}
                    className="text-slate-400 hover:text-white ml-auto p-1"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              )}

              {/* Message Composer */}
              <div className="p-3 border-t border-slate-800 bg-[#111B21] shrink-0">
                {showAttachInput && (
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="Paste image / document URL (https://...)"
                      value={attachmentUrl}
                      onChange={(e) => setAttachmentUrl(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-[#202C33] text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
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
                  {/* Attach Button */}
                  <button
                    type="button"
                    onClick={() => setShowAttachInput(!showAttachInput)}
                    className="p-2 rounded-lg border border-slate-700/70 bg-[#202C33] text-slate-300 hover:text-white transition cursor-pointer"
                    title="Attach image or file link"
                  >
                    <span className="material-symbols-outlined text-base">attach_file</span>
                  </button>

                  {/* Templates Quick Button */}
                  <button
                    type="button"
                    onClick={handleOpenTemplates}
                    className="p-2 rounded-lg border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40 transition cursor-pointer"
                    title="Select and send approved WhatsApp template"
                  >
                    <span className="material-symbols-outlined text-base">bookmark</span>
                  </button>

                  {/* Canned Responses Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowCannedReplies(!showCannedReplies)}
                    className={`p-2 rounded-lg border transition cursor-pointer ${
                      showCannedReplies
                        ? "border-emerald-500 bg-emerald-600 text-white"
                        : "border-slate-700/70 bg-[#202C33] text-slate-300 hover:text-white"
                    }`}
                    title="Quick dispatch canned replies"
                  >
                    <span className="material-symbols-outlined text-base">bolt</span>
                  </button>

                  {/* Clean Non-breaking Textarea */}
                  <div className="flex-1 relative">
                    <textarea
                      rows={1}
                      disabled={chatWindowInfo ? !chatWindowInfo.isOpen : false}
                      placeholder={
                        chatWindowInfo && !chatWindowInfo.isOpen
                          ? "24-hr window closed · Send template to re-engage..."
                          : "Type a message..."
                      }
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full px-3 py-2 rounded-lg border border-slate-700/80 bg-[#202C33] text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 resize-none max-h-32 disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
                    />
                  </div>

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={() => handleSendManualMessage()}
                    disabled={
                      (chatWindowInfo && !chatWindowInfo.isOpen) ||
                      (!messageText.trim() && !attachmentUrl.trim()) ||
                      sendingMessage
                    }
                    className="p-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md flex items-center justify-center shrink-0"
                    title="Send message (Enter)"
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

                {/* Subtext Keyboard Hint (Never breaks inside placeholder!) */}
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 px-1">
                  <span>↵ to send · Shift+↵ for new line</span>
                  {activeConversation?.phoneNumber && (
                    <span>Recipient: {formatPhoneDisplay(activeConversation.phoneNumber)}</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs space-y-3 p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-[#182229] border border-slate-700/60 flex items-center justify-center text-emerald-400">
                <span className="material-symbols-outlined text-3xl">chat</span>
              </div>
              <h3 className="text-base font-semibold text-white">StayCabs WhatsApp Desk</h3>
              <p className="max-w-md text-slate-400 leading-relaxed text-[11px]">
                Select a conversation from the sidebar to view chat history, customer homestay context, and reply directly.
              </p>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* PANE C: RIGHT SIDEBAR - CUSTOMER INFORMATION & ACTIONS                    */}
        {/* ========================================================================= */}
        {activeConversation && showRightSidebar && (
          <div className="w-80 border-l border-slate-800/80 bg-[#111B21] overflow-y-auto shrink-0 p-4 space-y-4 hidden lg:block">
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
              <div className="h-16 w-16 rounded-full bg-slate-700/80 border-2 border-emerald-500/40 flex items-center justify-center text-white font-bold text-lg mx-auto shadow-md">
                {activeConversation.customerName ? activeConversation.customerName.slice(0, 2) : "WA"}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">
                  {activeConversation.customerName || formatPhoneDisplay(activeConversation.phoneNumber)}
                </h4>
                <p className="text-xs text-emerald-400 font-mono">
                  {formatPhoneDisplay(activeConversation.phoneNumber)}
                </p>
              </div>

              {(customerContext as any)?.isDriver || messages.some((m) => m.templateName === "new_trip_request" || m.messageContent.includes("Submit your total trip fare")) ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="material-symbols-outlined text-xs">local_taxi</span>
                  StayRide Driver Partner
                </span>
              ) : customerContext?.isExistingGuest ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <span className="material-symbols-outlined text-xs">verified</span>
                  StayCabs Guest
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#202C33] text-slate-300 border border-slate-700">
                  WhatsApp Contact
                </span>
              )}
            </div>

            {/* Quick Actions (Create Cab Request & Copy Phone) */}
            <div className="space-y-2">
              {onNavigateToCabRequests && (
                <button
                  onClick={() => {
                    onNavigateToCabRequests(customerContext?.latestTrip?.propertyId || customerContext?.homestay?.tenantKey);
                    triggerToast("Opening Cab Requests Desk...");
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">local_taxi</span>
                  <span>+ Book Cab for this Guest</span>
                </button>
              )}

              <button
                onClick={() => handleCopyPhone(activeConversation.phoneNumber)}
                className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs transition cursor-pointer ${
                  copiedPhone
                    ? "border-emerald-500 bg-emerald-950/60 text-emerald-300"
                    : "border-slate-700 bg-[#202C33] text-slate-300 hover:bg-slate-700"
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  {copiedPhone ? "check" : "content_copy"}
                </span>
                <span>{copiedPhone ? "Copied to clipboard!" : "Copy Phone Number"}</span>
              </button>
            </div>

            {/* Guest Record Section */}
            {customerContext?.guest && (
              <div className="rounded-xl border border-slate-800 bg-[#182229] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-emerald-400 text-sm">badge</span>
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
                    <span className="text-slate-400">Name:</span>
                    <span className="font-medium text-white">{customerContext.guest.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="truncate max-w-[150px]">{customerContext.guest.email || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Stays:</span>
                    <span className="font-semibold text-white">{customerContext.guest.stays || 1}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Homestay & Booking Details */}
            {customerContext?.latestBooking && (
              <div className="rounded-xl border border-slate-800 bg-[#182229] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-emerald-400 text-sm">villa</span>
                    Homestay Booking
                  </span>
                  <span className="text-[10px] font-mono text-emerald-300">
                    {customerContext.latestBooking.reference}
                  </span>
                </div>
                <div className="text-[11px] space-y-1 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Homestay:</span>
                    <span className="font-medium text-white truncate max-w-[140px]">
                      {customerContext.latestBooking.homestayName || customerContext.homestay?.name || "StayCabs Estate"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Room:</span>
                    <span className="truncate max-w-[140px]">{customerContext.latestBooking.roomName || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Check-In:</span>
                    <span className="font-mono">{formatDate(customerContext.latestBooking.checkIn)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Check-Out:</span>
                    <span className="font-mono">{formatDate(customerContext.latestBooking.checkOut)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Associated Cab Bookings */}
            <div className="rounded-xl border border-slate-800 bg-[#182229] p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-400 text-sm">local_taxi</span>
                  Cab Bookings ({customerContext?.cabBookings?.length || 0})
                </span>
                {customerContext?.latestTrip?.propertyId && onNavigateToCabRequests && (
                  <button
                    onClick={() => onNavigateToCabRequests(String(customerContext.latestTrip.propertyId))}
                    className="text-[10px] text-emerald-400 hover:underline"
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
                      className="p-2.5 rounded-lg bg-[#111B21] border border-slate-800 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-emerald-300">{trip.reference}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-[#202C33] text-slate-300">
                          {trip.status}
                        </span>
                      </div>
                      <p className="text-slate-400 truncate">
                        {trip.pickupLocation?.address} → {(trip.destinations || [])[0]?.address || "Local"}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{trip.date ? formatDate(trip.date) : "—"}</span>
                        <span className="text-emerald-400 font-mono font-semibold">
                          ₹{trip.agreedFare ? Number(trip.agreedFare).toLocaleString("en-IN") : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No cab requests found for this customer.</p>
              )}
            </div>

            {/* Extra Desk Shortcut */}
            {onNavigateToGuests && customerContext?.guest?.name && (
              <button
                onClick={() => onNavigateToGuests(customerContext.guest.name)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-700 bg-[#202C33] text-xs text-slate-300 hover:text-white transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                <span>Open in Guests Desk</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL: WHATSAPP TEMPLATE SELECTOR & PHONE PREVIEW (SCOPED TO CUSTOMER) */}
      {/* ========================================================================= */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl bg-[#111B21] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-[#111B21]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">bookmark</span>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Send WhatsApp Template
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Auto-personalized for <strong className="text-emerald-400">{activeConversation?.customerName || formatPhoneDisplay(activeConversation?.phoneNumber)}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Category Tabs */}
            <div className="px-5 py-2 border-b border-slate-800 bg-[#141E26] flex items-center gap-2 overflow-x-auto no-scrollbar">
              {[
                { id: "recommended", label: "Recommended" },
                { id: "guest", label: "Guest Welcoming" },
                { id: "ride", label: "Ride Confirmations" },
                { id: "driver", label: "Driver Alerts" },
                { id: "all", label: `All (${templates.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setTemplateCategoryTab(tab.id as any);
                    const firstMatch = templates.find((t) => {
                      if (tab.id === "all") return true;
                      if (tab.id === "guest") return ["ask_cab", "quote_accepted_guest", "advance_paid_guest", "boarding_pin_guest"].includes(t.id);
                      if (tab.id === "driver") return ["new_trip_request", "advance_paid_driver", "trip_assigned_driver"].includes(t.id);
                      return true;
                    });
                    if (firstMatch) selectTemplateForComposer(firstMatch);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer shrink-0 ${
                    templateCategoryTab === tab.id
                      ? "bg-emerald-600 text-white font-semibold"
                      : "bg-[#202C33] text-slate-300 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body: Two-Column Editor & WhatsApp Phone Screen Preview */}
            <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 bg-[#0B1015]">
              {/* LEFT COLUMN: Template Selection & Variable Inputs (7 Cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Select Approved Template
                  </label>
                  <select
                    value={selectedTemplate?.id || ""}
                    onChange={(e) => {
                      const tpl = templates.find((t) => t.id === e.target.value);
                      if (tpl) selectTemplateForComposer(tpl);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#202C33] text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {filteredTemplates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.title} ({tpl.name}) • {tpl.language.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  {selectedTemplate && (
                    <p className="text-[11px] text-slate-400 mt-1">{selectedTemplate.description}</p>
                  )}
                </div>

                {/* Auto-populated Parameters Form */}
                {selectedTemplate && selectedTemplate.variables.length > 0 && (
                  <div className="space-y-3 p-3.5 rounded-xl border border-slate-800 bg-[#182229]">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-emerald-400">
                        Template Variables ({selectedTemplate.variables.length})
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Auto-filled from customer record
                      </span>
                    </div>

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
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700 bg-[#111B21] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Realistic WhatsApp Phone Preview (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Live WhatsApp Message Preview
                </label>

                <div className="flex-1 rounded-2xl border border-slate-800 bg-[#0B141A] p-4 flex flex-col shadow-inner">
                  {/* WhatsApp Header Simulation */}
                  <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-800/80">
                    <div className="h-7 w-7 rounded-full bg-emerald-700 flex items-center justify-center text-white text-[11px] font-bold">
                      SR
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-white">StayRide Cabs</span>
                        <span className="material-symbols-outlined text-emerald-400 text-xs">verified</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Official WhatsApp Business</span>
                    </div>
                  </div>

                  {/* WhatsApp Chat Bubble */}
                  <div className="bg-[#005C4B] rounded-2xl rounded-tl-xs p-3.5 text-white shadow-md space-y-2">
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">
                      {renderTemplatePreview()}
                    </p>

                    {/* WhatsApp CTA Action Button Card Simulation */}
                    {extractFirstUrl(renderTemplatePreview()) && (
                      <div className="mt-2 pt-2 border-t border-emerald-700/60 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-200 bg-black/20 py-1.5 rounded">
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        <span>
                          {selectedTemplate?.id === "ask_cab"
                            ? "Request Cab Online"
                            : selectedTemplate?.id === "advance_paid_guest"
                            ? "View Trip Pass"
                            : "Open Action Link"}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-end text-[10px] text-slate-300/80 gap-1 pt-1">
                      <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="material-symbols-outlined text-[13px] text-sky-300">done_all</span>
                    </div>
                  </div>

                  <p className="mt-auto pt-3 text-[10px] text-slate-500 text-center font-mono">
                    Will be sent to {formatPhoneDisplay(activeConversation?.phoneNumber || "")}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-[#111B21] flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Sending as official business template via Meta Cloud API
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
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
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
                      <span>Send to {activeConversation?.customerName || "Customer"}</span>
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
