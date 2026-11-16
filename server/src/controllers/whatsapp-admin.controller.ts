import { Request, Response } from "express";
import { WhatsappInboxService } from "../services/whatsapp-inbox.service.js";
import { registerSSEClient } from "../services/socket.service.js";
import { logger } from "../utils/logger.js";

export class WhatsappAdminController {
  static async listConversations(req: Request, res: Response) {
    try {
      const isDemo = req.query.demo === "true";
      const { status, filter, search, page, limit } = req.query;

      const result = await WhatsappInboxService.listConversations({
        status: status as any,
        filter: filter as any,
        search: typeof search === "string" ? search : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 30,
        isDemo,
      });

      res.json({ success: true, data: result });
    } catch (err: any) {
      logger.error("[WhatsApp Admin] Failed to list conversations", err);
      res.status(err.status || 500).json({
        success: false,
        error: { message: err.message || "Failed to list conversations", code: err.code || "SERVER_ERROR" },
      });
    }
  }

  static async getConversation(req: Request, res: Response) {
    try {
      const isDemo = req.query.demo === "true";
      const id = String(req.params.id);

      const result = await WhatsappInboxService.getConversation(id, isDemo);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { message: err.message || "Failed to load conversation", code: err.code || "SERVER_ERROR" },
      });
    }
  }

  static async listMessages(req: Request, res: Response) {
    try {
      const isDemo = req.query.demo === "true";
      const id = String(req.params.id);
      const { limit, before } = req.query;

      const messages = await WhatsappInboxService.listMessages(id, {
        limit: limit ? Number(limit) : 100,
        before: typeof before === "string" ? before : undefined,
        isDemo,
      });

      res.json({ success: true, data: messages });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { message: err.message || "Failed to load messages", code: err.code || "SERVER_ERROR" },
      });
    }
  }

  static async sendManualMessage(req: Request, res: Response) {
    try {
      const isDemo = req.query.demo === "true" || req.body.demo === true;
      const id = String(req.params.id);
      const { text, mediaUrl, mediaType } = req.body;
      const adminId = (req as any).user?._id || (req as any).user?.id || "admin";

      const message = await WhatsappInboxService.sendManualMessage({
        conversationId: id,
        text: String(text ?? ""),
        mediaUrl: mediaUrl ? String(mediaUrl) : undefined,
        mediaType: mediaType as any,
        adminId,
        isDemo,
      });

      res.json({ success: true, data: message });
    } catch (err: any) {
      res.status(err.status || 400).json({
        success: false,
        error: { message: err.message || "Failed to send message", code: err.code || "SEND_FAILED" },
      });
    }
  }

  static async sendTemplateMessage(req: Request, res: Response) {
    try {
      const isDemo = req.query.demo === "true" || req.body.demo === true;
      const id = String(req.params.id);
      const { templateId, params, language } = req.body;
      const adminId = (req as any).user?._id || (req as any).user?.id || "admin";

      if (!templateId) {
        return res.status(400).json({
          success: false,
          error: { message: "Template ID is required", code: "INVALID_INPUT" },
        });
      }

      const message = await WhatsappInboxService.sendTemplateMessage({
        conversationId: id,
        templateId,
        params: Array.isArray(params) ? params : [],
        language: typeof language === "string" ? language : undefined,
        adminId,
        isDemo,
      });

      res.json({ success: true, data: message });
    } catch (err: any) {
      res.status(err.status || 400).json({
        success: false,
        error: { message: err.message || "Failed to send template", code: err.code || "SEND_TEMPLATE_FAILED" },
      });
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const isDemo = req.query.demo === "true" || req.body.demo === true;
      const id = String(req.params.id);
      const { status } = req.body;

      if (status !== "OPEN" && status !== "CLOSED") {
        return res.status(400).json({
          success: false,
          error: { message: "Status must be OPEN or CLOSED", code: "INVALID_INPUT" },
        });
      }

      const conversation = await WhatsappInboxService.updateConversationStatus(id, status, isDemo);
      res.json({ success: true, data: conversation });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { message: err.message || "Failed to update status", code: err.code || "SERVER_ERROR" },
      });
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const isDemo = req.query.demo === "true" || req.body.demo === true;
      const id = String(req.params.id);

      const conversation = await WhatsappInboxService.markConversationRead(id, isDemo);
      res.json({ success: true, data: conversation });
    } catch (err: any) {
      res.status(err.status || 500).json({
        success: false,
        error: { message: err.message || "Failed to mark as read", code: err.code || "SERVER_ERROR" },
      });
    }
  }

  static async getTemplates(_req: Request, res: Response) {
    try {
      const templates = WhatsappInboxService.getApprovedTemplates();
      res.json({ success: true, data: templates });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { message: err.message || "Failed to fetch templates", code: "SERVER_ERROR" },
      });
    }
  }

  static async getCustomerInfo(req: Request, res: Response) {
    try {
      const isDemo = req.query.demo === "true";
      const phone = String(req.query.phone || "");
      if (!phone) {
        return res.status(400).json({
          success: false,
          error: { message: "Phone query parameter required", code: "INVALID_INPUT" },
        });
      }

      const context = await WhatsappInboxService.getCustomerContext(phone, isDemo);
      res.json({ success: true, data: context });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { message: err.message || "Failed to fetch customer context", code: "SERVER_ERROR" },
      });
    }
  }

  static async liveStream(req: Request, res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // Heartbeat ping every 15 seconds
    const interval = setInterval(() => {
      res.write(": ping\n\n");
    }, 15000);

    const cleanup = registerSSEClient(res);

    req.on("close", () => {
      clearInterval(interval);
      cleanup();
    });
  }
}
