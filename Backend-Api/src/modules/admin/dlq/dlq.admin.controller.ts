import { Router, Response } from "express";
import Controller from "@/config/interfaces/controller.interfaces";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import { isAdmin, requireAuth } from "@/shared/middleware/auth.middleware";
import DLQAdminService from "./dlq.admin.service";
import { recordAdminActivity } from "@/modules/admin/admin.activity.helper";
import { AdminActivityType } from "@/modules/admin/admin.activity.model";
import BadRequestError from "@/shared/errors/badRequest";

class DLQAdminController implements Controller {
  public path = "/admin/dlq";
  public route = Router();
  private dlqService = new DLQAdminService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.get(`${this.path}/stats`, requireAuth, isAdmin, this.getStats);
    this.route.get(`${this.path}`, requireAuth, isAdmin, this.listEvents);
    this.route.get(
      `${this.path}/:eventId`,
      requireAuth,
      isAdmin,
      this.getEvent,
    );
    this.route.post(
      `${this.path}/replay/:eventId`,
      requireAuth,
      isAdmin,
      this.replayEvent,
    );
    this.route.post(
      `${this.path}/replay/topic/:topic`,
      requireAuth,
      isAdmin,
      this.replayTopic,
    );

    this.route.post(
      `${this.path}/:eventId/dismiss`,
      requireAuth,
      isAdmin,
      this.dismissEvent,
    );
    this.route.post(
      `${this.path}/dismiss/bulk`,
      requireAuth,
      isAdmin,
      this.bulkDismiss,
    );
    this.route.post(
      `${this.path}/:eventId/notes`,
      requireAuth,
      isAdmin,
      this.addNote,
    );
  }

  private getStats = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const result = await this.dlqService.getStats();
    res.status(200).json({ ok: true, data: result });
  });

  private listEvents = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const { search, topic, status, errorType, page, limit } = req.query;
      const result = await this.dlqService.listEvents({
        search: search as string,
        topic: topic as string,
        status: status as string,
        errorType: errorType as string,
        page: page as string,
        limit: limit as string,
      });
      res.status(200).json({ ok: true, ...result });
    },
  );

  private getEvent = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const { eventId } = req.params;
    const result = await this.dlqService.getEvent(eventId);
    res.status(200).json({ ok: true, data: result });
  });

  private replayEvent = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const { eventId } = req.params;
      const adminUserId = req.user?.userId ?? "UNKNOWN_ADMIN";

      const result = await this.dlqService.replayEvent(eventId, adminUserId);

      await recordAdminActivity({
        adminUserId,
        adminEmail: req.user?.email ?? "",
        type:
          AdminActivityType.DLQ_EVENT_REPLAYED ?? ("DLQ_EVENT_REPLAYED" as any),
        description: `Replayed DLQ event ${eventId}`,
        metadata: { eventId },
      });

      res.status(200).json({ ok: true, ...result });
    },
  );

  private replayTopic = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const { topic } = req.params;
      const adminUserId = req.user?.userId ?? "UNKNOWN_ADMIN";

      const result = await this.dlqService.replayTopic(topic, adminUserId);

      await recordAdminActivity({
        adminUserId,
        adminEmail: req.user?.email ?? "",
        type:
          AdminActivityType.DLQ_EVENT_REPLAYED ?? ("DLQ_EVENT_REPLAYED" as any),
        description: `Bulk replayed ${result.replayedCount} events for topic ${topic}`,
        metadata: {
          topic,
          replayedCount: result.replayedCount,
          failedCount: result.failedCount,
        },
      });

      res.status(200).json({ ok: true, ...result });
    },
  );

  private dismissEvent = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const { eventId } = req.params;
      const { reason } = req.body;
      const adminUserId = req.user?.userId ?? "UNKNOWN_ADMIN";

      if (!reason || reason.trim().length < 5) {
        throw new BadRequestError("Reason must be at least 5 characters");
      }

      const result = await this.dlqService.dismissEvent(
        eventId,
        adminUserId,
        reason,
      );

      await recordAdminActivity({
        adminUserId,
        adminEmail: req.user?.email ?? "",
        type: "DLQ_EVENT_DISMISSED" as any,
        description: `Dismissed DLQ event ${eventId} — ${reason}`,
        metadata: { eventId, reason },
      });

      res.status(200).json({ ok: true, ...result });
    },
  );

  private bulkDismiss = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const { eventIds, reason } = req.body;
      const adminUserId = req.user?.userId ?? "UNKNOWN_ADMIN";

      if (!Array.isArray(eventIds) || eventIds.length === 0) {
        throw new BadRequestError("eventIds array is required");
      }
      if (!reason || reason.trim().length < 5) {
        throw new BadRequestError("Reason must be at least 5 characters");
      }

      const result = await this.dlqService.bulkDismiss(
        eventIds,
        adminUserId,
        reason,
      );

      await recordAdminActivity({
        adminUserId,
        adminEmail: req.user?.email ?? "",
        type: "DLQ_EVENT_DISMISSED" as any,
        description: `Bulk dismissed ${result.dismissedCount} DLQ events — ${reason}`,
        metadata: { eventIds, reason, dismissedCount: result.dismissedCount },
      });

      res.status(200).json({ ok: true, ...result });
    },
  );

  private addNote = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const { eventId } = req.params;
    const { text } = req.body;
    const adminUserId = req.user?.userId ?? "UNKNOWN_ADMIN";

    if (!text || text.trim().length < 2) {
      throw new BadRequestError("Note text is required");
    }

    const result = await this.dlqService.addNote(
      eventId,
      adminUserId,
      text.trim(),
    );
    res.status(200).json({ ok: true, ...result });
  });
}

export default DLQAdminController;
