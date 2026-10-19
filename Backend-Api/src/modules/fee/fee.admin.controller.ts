import { Router, Response } from "express";
import Controller from "@/config/interfaces/controller.interfaces";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import { isAdmin, requireAuth } from "@/shared/middleware/auth.middleware";
import FeeAdminService from "./fee.admin.service";
import BadRequestError from "@/shared/errors/badRequest";
import { getRequestContext } from "@/shared/middleware/request.context";

class FeeAdminController implements Controller {
  public path = "/admin/fees";
  public route = Router();
  private feeAdminService = new FeeAdminService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.get(`${this.path}/stats`, requireAuth, isAdmin, this.getStats);
    this.route.get(
      `${this.path}/accruals`,
      requireAuth,
      isAdmin,
      this.listAccruals,
    );
    this.route.post(
      `${this.path}/accruals/:accrualId/waive`,
      requireAuth,
      isAdmin,
      this.waiveFee,
    );
    this.route.post(
      `${this.path}/sweep`,
      requireAuth,
      isAdmin,
      this.sweepAccruals,
    );
    this.route.get(
      `${this.path}/sweeps`,
      requireAuth,
      isAdmin,
      this.listSweeps,
    );
    this.route.get(
      `${this.path}/schedules`,
      requireAuth,
      isAdmin,
      this.listSchedules,
    );
    this.route.put(
      `${this.path}/schedules/:id`,
      requireAuth,
      isAdmin,
      this.updateSchedule,
    );
    this.route.post(
      `${this.path}/accruals/:accrualId/waive-and-refund`,
      requireAuth,
      isAdmin,
      this.waiveAndRefund,
    );
  }

  private getStats = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const { currency } = req.query;
    const result = await this.feeAdminService.getStats(currency as string);
    res.status(200).json({ ok: true, data: result });
  });

  private listAccruals = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const { search, status, category, page, limit } = req.query;
      const result = await this.feeAdminService.listAccruals({
        search: search as string,
        status: status as string,
        category: category as string,
        page: page as string,
        limit: limit as string,
      });
      res.status(200).json({ ok: true, ...result });
    },
  );

  private waiveFee = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const { accrualId } = req.params;
    const { reason } = req.body;
    const adminUserId = req.user?.userId;
    const adminEmail = req.user?.email;

    if (!reason || reason.trim().length < 5) {
      throw new BadRequestError("Reason must be at least 5 characters");
    }

    const result = await this.feeAdminService.waiveFee(
      accrualId,
      adminUserId!,
      adminEmail!,
      reason,
    );
    res.status(200).json({ ok: true, data: result });
  });

  private sweepAccruals = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const adminUserId = req.user?.userId;
      const adminEmail = req.user?.email;
      const { currency } = req.body;
      const result = await this.feeAdminService.sweepAccruals(
        adminUserId!,
        currency ?? "NGN",
        adminEmail!,
      );
      res.status(200).json({ ok: true, data: result });
    },
  );

  private listSweeps = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const { page, limit } = req.query;
      const result = await this.feeAdminService.listSweeps({
        page: page as string,
        limit: limit as string,
      });
      res.status(200).json({ ok: true, ...result });
    },
  );

  private listSchedules = asyncWrapper(
    async (_req: IAuthRequest, res: Response) => {
      const result = await this.feeAdminService.listSchedules();
      res.status(200).json({ ok: true, ...result });
    },
  );

  private updateSchedule = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const adminEmail = req.user?.email;
      const adminUserId = req.user?.userId;
      const { id } = req.params;
      const { tiers, isActive } = req.body;
      const result = await this.feeAdminService.updateSchedule(
        id,
        {
          tiers,
          isActive,
        },
        adminEmail!,
        adminUserId!,
      );
      res.status(200).json({ ok: true, data: result });
    },
  );

  private waiveAndRefund = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const { accrualId } = req.params;
      const { reason } = req.body;
      const adminUserId = req.user?.userId;
      const context = getRequestContext(req);

      if (!reason || reason.trim().length < 5) {
        throw new BadRequestError("Reason must be at least 5 characters");
      }

      const result = await this.feeAdminService.waiveAndRefund(
        accrualId,
        adminUserId!,
        reason,
        context,
      );
      res.status(200).json({ ok: true, data: result });
    },
  );
}

export default FeeAdminController;
