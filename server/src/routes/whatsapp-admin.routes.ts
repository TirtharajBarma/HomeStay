import { Router } from "express";
import { WhatsappAdminController } from "../controllers/whatsapp-admin.controller.js";

const router = Router();

// 1. WhatsApp Conversations
router.get("/conversations", WhatsappAdminController.listConversations);
router.get("/conversations/:id", WhatsappAdminController.getConversation);
router.get("/conversations/:id/messages", WhatsappAdminController.listMessages);

// 2. Message Dispatch
router.post("/conversations/:id/send-message", WhatsappAdminController.sendManualMessage);
router.post("/conversations/:id/send-template", WhatsappAdminController.sendTemplateMessage);

// 3. Conversation Management
router.patch("/conversations/:id/status", WhatsappAdminController.updateStatus);
router.post("/conversations/:id/read", WhatsappAdminController.markAsRead);

// 4. Template Catalog & Customer Insights
router.get("/templates", WhatsappAdminController.getTemplates);
router.get("/customer-info", WhatsappAdminController.getCustomerInfo);

// 5. Real-time Live SSE Stream (WebSocket fallback)
router.get("/stream", WhatsappAdminController.liveStream);

export default router;
