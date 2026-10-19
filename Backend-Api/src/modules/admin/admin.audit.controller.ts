import { IAuthRequest } from "@/config/interfaces/request.interface";
import AdminAuditService from "@/modules/admin/admin.audit.service";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { isAdmin, requireAuth } from "@/shared/middleware/auth.middleware";
import { Response, Router } from "express";
import { AdminActivity } from "@/modules/admin/admin.activity.model";

class AdminAuditController {
  public path = "/admin/audit-logs";
  private service = new AdminAuditService();
  public route = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.get(this.path, requireAuth, isAdmin, this.listLogs);

    this.route.get(
      "/admin/activity",
      requireAuth,
      isAdmin,
      this.getRecentActivity,
    );
  }

  private listLogs = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const {
      search,
      action,
      status,
      severity,
      userId,
      dateFrom,
      dateTo,
      page,
      limit,
    } = req.query;

    const result = await this.service.listLogs({
      search: search as string,
      action: action as string,
      status: status as string,
      severity: severity as string,
      userId: userId as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      page: page as string,
      limit: limit as string,
    });

    res.status(200).json({ ok: true, ...result });
  });

  private getRecentActivity = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const limit = Math.min(20, Number(req.query.limit) || 5);
      const activities = await AdminActivity.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      res.status(200).json({ ok: true, data: activities });
    },
  );
}

export default AdminAuditController;
