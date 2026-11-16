import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { WhatsappInboxService } from "../src/services/whatsapp-inbox.service.js";
import { sendWhatsApp, recordWhatsAppWebhook } from "../src/services/whatsapp.service.js";
import { getWhatsappContactModel } from "../src/models/whatsapp-contact.model.js";
import { getWhatsappConversationModel } from "../src/models/whatsapp-conversation.model.js";
import { getWhatsappMessageModel } from "../src/models/whatsapp-message.model.js";
import { Guest } from "../src/models/guest.model.js";
import { Booking } from "../src/models/booking.model.js";
import { getCabRequestModel } from "../src/models/cab-request.model.js";

async function runTests() {
  console.log("=================================================");
  console.log("🚀 Starting WhatsApp Inbox End-to-End Test Suite");
  console.log("=================================================\n");

  let mongod: MongoMemoryServer | null = null;
  const isDemo = true;

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log("✓ Connected to in-memory test database");

    const ContactModel = getWhatsappContactModel(isDemo);
    const ConvModel = getWhatsappConversationModel(isDemo);
    const MessageModel = getWhatsappMessageModel(isDemo);
    const CabModel = getCabRequestModel(isDemo);

    // -------------------------------------------------------------------------
    // TEST 1: Seed StayCabs Guest, Booking & Cab Request
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Seeding Guest, Booking and Cab Request for phone: 9876543210...");
    const GuestModel = WhatsappInboxService.getGuestModel(isDemo);
    const BookingModel = WhatsappInboxService.getBookingModel(isDemo);

    const guestDoc = await GuestModel.create({
      name: "Tenzing Norbu",
      code: "GST-101",
      room: "Kanchenjunga Suite",
      location: "Darjeeling",
      checkIn: new Date(),
      checkOut: new Date(Date.now() + 3 * 86400000),
      nights: 3,
      email: "tenzing@staycabs.test",
      phone: "+91 98765 43210",
      vip: true,
      stays: 2,
    });

    const bookingDoc = await BookingModel.create({
      reference: "BK-DARJ-2026",
      pin: "4321",
      roomCode: "RM-KANCH-01",
      roomName: "Kanchenjunga Suite",
      staySlug: "pine-ridge-retreat",
      homestayName: "Pine Ridge Retreat",
      guestName: "Tenzing Norbu",
      email: "tenzing@staycabs.test",
      phone: "+91 98765 43210",
      checkIn: new Date().toISOString(),
      checkOut: new Date(Date.now() + 3 * 86400000).toISOString(),
      nights: 3,
      status: "confirmed",
      nightlyRate: 4500,
      roomTotal: 13500,
      totalAmount: 13500,
      dueToday: 13500,
      balanceDue: 0,
    });

    const cabDoc = await CabModel.create({
      reference: "REQ-TEST-7788",
      propertyId: "test-property-id",
      homestayName: "Pine Ridge Retreat",
      guestName: "Tenzing Norbu",
      guestPhone: "9876543210",
      pickupLocation: { address: "Bagdogra Airport (IXB)" },
      destinations: [{ address: "Pine Ridge Retreat, Darjeeling", order: 1 }],
      isRoundTrip: false,
      date: Date.now() + 86400000,
      time: "10:30 AM",
      passengers: 2,
      vehicleType: "SUV",
      requestSource: "GUEST_WEB_LINK",
      status: "CONFIRMED",
      assignedDriverName: "Dorjee Lepcha",
      assignedDriverPhone: "9832011223",
      agreedFare: 3200,
      advanceAmount: 600,
      advancePaid: true,
      remainingCashAmount: 2600,
    });
    console.log("✓ Seeded Guest, Booking, and Cab Request records.");

    // -------------------------------------------------------------------------
    // TEST 2: Automated Outbound Booking Confirmation through existing Cloud API
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Sending automated booking confirmation via Cloud API...");
    const sendRes = await sendWhatsApp(isDemo, {
      event: "ADVANCE_PAID_GUEST",
      to: "919876543210",
      params: [
        "Tenzing Norbu",
        "Dorjee Lepcha",
        "9832011223",
        "Mahindra Scorpio",
        "Bagdogra Airport → Pine Ridge Retreat",
        "Tomorrow at 10:30 AM",
        "₹2,600",
        "https://staycabs.in/cab-request?ref=REQ-TEST-7788",
      ],
      text:
        "Namaste Tenzing Norbu, your cab booking is confirmed.\n" +
        "Driver: Dorjee Lepcha, phone 9832011223\n" +
        "Vehicle: Mahindra Scorpio\n" +
        "Route: Bagdogra Airport → Pine Ridge Retreat\n" +
        "Pickup: Tomorrow at 10:30 AM\n\n" +
        "The remaining fare of ₹2,600 is paid in cash to your driver at drop-off.\n" +
        "Track your cab and view your trip pass here: https://staycabs.in/cab-request?ref=REQ-TEST-7788\n" +
        "Have a safe journey.",
    });

    console.log(`✓ Automated dispatch result: ${sendRes}`);

    // Verify conversation was created and linked to guest
    const conv = await ConvModel.findOne({ phoneNumber: "919876543210" });
    if (!conv) throw new Error("Conversation was not automatically created!");
    console.log(`✓ Conversation automatically created with ID: ${conv._id}`);
    console.log(`✓ Conversation linked customerName: ${conv.customerName}`);

    // Verify message saved
    const messages = await MessageModel.find({ conversationId: conv._id });
    if (messages.length !== 1) throw new Error(`Expected 1 message, found ${messages.length}`);
    const firstMsg = messages[0];
    if (firstMsg.direction !== "OUTBOUND" || firstMsg.senderType !== "SYSTEM") {
      throw new Error("Message direction or senderType incorrect!");
    }
    console.log(`✓ Automated message saved: direction=${firstMsg.direction}, senderType=${firstMsg.senderType}, type=${firstMsg.messageType}`);

    // -------------------------------------------------------------------------
    // TEST 3: Incoming Customer Message via Meta Webhook
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Simulating incoming customer WhatsApp reply via Meta Webhook...");
    const incomingWamid = "wamid.HBgMOTE5ODc2NTQzMjEwFQIAEhgUM0VCMDkzN0QwM0M2N0NBODU5RjgA";
    await recordWhatsAppWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "919876543210",
                    id: incomingWamid,
                    timestamp: Math.floor(Date.now() / 1000),
                    type: "text",
                    text: { body: "Namaste! Will the driver meet us inside the arrival terminal?" },
                  },
                ],
                contacts: [{ wa_id: "919876543210", profile: { name: "Tenzing Norbu" } }],
              },
            },
          ],
        },
      ],
    }, isDemo);

    // Verify incoming message in database
    const updatedConv = await ConvModel.findById(conv._id);
    if (!updatedConv) throw new Error("Conversation not found!");
    if (updatedConv.unreadCount !== 1) throw new Error(`Expected unreadCount=1, got ${updatedConv.unreadCount}`);
    if (!updatedConv.lastInboundMessageAt) throw new Error("lastInboundMessageAt not updated!");
    console.log(`✓ Inbound message processed! Unread count=${updatedConv.unreadCount}, lastInboundMessageAt=${updatedConv.lastInboundMessageAt}`);

    const inboundMsg = await MessageModel.findOne({ whatsappMessageId: incomingWamid });
    if (!inboundMsg) throw new Error("Inbound message not found in DB!");
    if (inboundMsg.direction !== "INBOUND" || inboundMsg.senderType !== "CUSTOMER") {
      throw new Error("Inbound message fields invalid!");
    }
    console.log(`✓ Inbound message content: "${inboundMsg.messageContent}"`);

    // -------------------------------------------------------------------------
    // TEST 4: 24-Hour Customer Messaging Window Verification
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Testing 24-hour customer messaging window...");
    const windowStatusActive = WhatsappInboxService.check24HourWindow(updatedConv);
    if (!windowStatusActive.isOpen) throw new Error("Expected 24-hour window to be OPEN after inbound message!");
    console.log(`✓ 24-Hour Window is OPEN! Remaining seconds: ${windowStatusActive.remainingSeconds}`);

    // -------------------------------------------------------------------------
    // TEST 5: Manual Message Sending from Admin Panel
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Sending manual admin message while 24h window is open...");
    const adminReply = await WhatsappInboxService.sendManualMessage({
      conversationId: String(conv._id),
      text: "Yes Tenzing, Dorjee will be waiting with a StayCabs name board right outside Gate 2.",
      adminId: "admin-user-001",
      isDemo,
    });

    if (adminReply.senderType !== "ADMIN" || adminReply.direction !== "OUTBOUND") {
      throw new Error("Manual reply senderType/direction mismatch!");
    }
    console.log(`✓ Manual reply sent: senderType=${adminReply.senderType}, deliveryStatus=${adminReply.deliveryStatus}`);

    // -------------------------------------------------------------------------
    // TEST 6: Automated Driver Assignment Notification
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Sending automated driver assignment notification in same conversation...");
    await sendWhatsApp(isDemo, {
      event: "TRIP_ASSIGNED_DRIVER",
      to: "919876543210",
      params: [
        "Dorjee Lepcha",
        "Pine Ridge Retreat",
        "Tenzing Norbu",
        "+91 98765 43210",
        "Bagdogra Airport → Pine Ridge Retreat",
        "Tomorrow at 10:30 AM",
      ],
      text:
        "Hi Dorjee Lepcha, Pine Ridge Retreat has assigned you a trip.\n" +
        "Guest: Tenzing Norbu (+91 98765 43210)\n" +
        "Route: Bagdogra Airport → Pine Ridge Retreat\n" +
        "When: Tomorrow at 10:30 AM",
    });

    const allMsgs = await MessageModel.find({ conversationId: conv._id }).sort({ createdAt: 1 });
    console.log(`✓ Total chronological messages in conversation: ${allMsgs.length}`);
    if (allMsgs.length !== 4) throw new Error(`Expected 4 messages in chat history, got ${allMsgs.length}`);

    // -------------------------------------------------------------------------
    // TEST 7: Delivery and Read Status Updates from Meta Webhook
    // -------------------------------------------------------------------------
    console.log("\n[Test 7] Testing delivery & read status webhook progression...");
    const manualWamid = adminReply.whatsappMessageId!;

    // 1. Delivered webhook
    await recordWhatsAppWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: manualWamid,
                    status: "delivered",
                    timestamp: Math.floor(Date.now() / 1000),
                    recipient_id: "919876543210",
                  },
                ],
              },
            },
          ],
        },
      ],
    }, isDemo);

    let refreshedMsg = await MessageModel.findOne({ whatsappMessageId: manualWamid });
    if (refreshedMsg?.deliveryStatus !== "DELIVERED") {
      throw new Error(`Expected DELIVERED status, got ${refreshedMsg?.deliveryStatus}`);
    }
    console.log("✓ Message status progressed to DELIVERED");

    // 2. Read webhook
    await recordWhatsAppWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: manualWamid,
                    status: "read",
                    timestamp: Math.floor(Date.now() / 1000),
                    recipient_id: "919876543210",
                  },
                ],
              },
            },
          ],
        },
      ],
    }, isDemo);

    refreshedMsg = await MessageModel.findOne({ whatsappMessageId: manualWamid });
    if (refreshedMsg?.deliveryStatus !== "READ" || !refreshedMsg.readAt) {
      throw new Error(`Expected READ status, got ${refreshedMsg?.deliveryStatus}`);
    }
    console.log("✓ Message status progressed to READ with readAt timestamp");

    // -------------------------------------------------------------------------
    // TEST 8: 24-Hour Messaging Window Enforcement & Expiry
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Testing 24-hour messaging window expiry enforcement...");
    // Simulate window expired (set last inbound to 25 hours ago)
    await ConvModel.updateOne(
      { _id: conv._id },
      { $set: { lastInboundMessageAt: new Date(Date.now() - 25 * 3600 * 1000) } }
    );

    const expiredConv = await ConvModel.findById(conv._id);
    const windowExpired = WhatsappInboxService.check24HourWindow(expiredConv);
    if (windowExpired.isOpen) throw new Error("Expected window to be EXPIRED!");
    console.log(`✓ 24-hour window is EXPIRED as expected: "${windowExpired.reason}"`);

    // Verify manual free-form sending is rejected on backend
    let freeformRejected = false;
    try {
      await WhatsappInboxService.sendManualMessage({
        conversationId: String(conv._id),
        text: "This should fail because 24h window is closed",
        isDemo,
      });
    } catch (err: any) {
      if (err.code === "WINDOW_EXPIRED" || err.message.includes("24-hour")) {
        freeformRejected = true;
      }
    }
    if (!freeformRejected) throw new Error("Backend failed to reject free-form message outside 24h window!");
    console.log("✓ Backend successfully blocked free-form message outside 24h window");

    // Verify template message is allowed even when 24h window is expired!
    const templateMsg = await WhatsappInboxService.sendTemplateMessage({
      conversationId: String(conv._id),
      templateId: "ask_cab",
      params: ["Tenzing Norbu", "Pine Ridge Retreat", "https://staycabs.in/cab-request"],
      isDemo,
    });
    if (templateMsg.messageType !== "TEMPLATE") throw new Error("Template message not created!");
    console.log(`✓ Template message succeeded outside 24h window: ${templateMsg.templateName}`);

    // -------------------------------------------------------------------------
    // TEST 9: Duplicate Webhook Events (Idempotency)
    // -------------------------------------------------------------------------
    console.log("\n[Test 9] Testing duplicate webhook event idempotency...");
    const dupCountBefore = await MessageModel.countDocuments({ whatsappMessageId: incomingWamid });
    await recordWhatsAppWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "919876543210",
                    id: incomingWamid,
                    timestamp: Math.floor(Date.now() / 1000),
                    type: "text",
                    text: { body: "Duplicate webhook payload from Meta retry" },
                  },
                ],
              },
            },
          ],
        },
      ],
    }, isDemo);
    const dupCountAfter = await MessageModel.countDocuments({ whatsappMessageId: incomingWamid });
    if (dupCountBefore !== dupCountAfter) throw new Error("Duplicate webhook created duplicate DB message!");
    console.log("✓ Duplicate webhook safely ignored (idempotent)");

    // -------------------------------------------------------------------------
    // TEST 10: Multiple Customers Messaging Simultaneously
    // -------------------------------------------------------------------------
    console.log("\n[Test 10] Testing multiple customers messaging simultaneously...");
    const customerPhones = ["919811122233", "919822233344", "919833344455"];
    await Promise.all(
      customerPhones.map((ph, idx) =>
        recordWhatsAppWebhook({
          entry: [
            {
              changes: [
                {
                  value: {
                    messages: [
                      {
                        from: ph,
                        id: `wamid.concurrent.${idx}`,
                        timestamp: Math.floor(Date.now() / 1000),
                        type: "text",
                        text: { body: `Hello from customer ${idx + 1}` },
                      },
                    ],
                    contacts: [{ wa_id: ph, profile: { name: `Customer ${idx + 1}` } }],
                  },
                },
              ],
            },
          ],
        }, isDemo)
      )
    );

    const totalConvs = await ConvModel.countDocuments();
    console.log(`✓ Successfully created separate conversations for each customer. Total conversations: ${totalConvs}`);
    if (totalConvs < 4) throw new Error(`Expected at least 4 conversations, found ${totalConvs}`);

    // -------------------------------------------------------------------------
    // TEST 11: Customer Context & Guest / Booking / Cab Linking
    // -------------------------------------------------------------------------
    console.log("\n[Test 11] Testing customer context resolution (Right Sidebar data)...");
    const context = await WhatsappInboxService.getCustomerContext("919876543210", isDemo);
    if (!context.isExistingGuest) throw new Error("Expected customer to be recognized as existing guest!");
    if (context.guest?.name !== "Tenzing Norbu") throw new Error(`Guest name mismatch: ${context.guest?.name}`);
    if (context.latestBooking?.reference !== "BK-DARJ-2026") throw new Error("Booking link mismatch!");
    if (context.latestTrip?.reference !== "REQ-TEST-7788") throw new Error("Cab booking link mismatch!");
    console.log(`✓ Customer context verified! Guest: ${context.guest?.name}, Booking: ${context.latestBooking?.reference}, Cab: ${context.latestTrip?.reference}`);

    console.log("\n=================================================");
    console.log("🎉 ALL 11 TEST SUITES PASSED PERFECTLY!");
    console.log("=================================================");
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runTests();
