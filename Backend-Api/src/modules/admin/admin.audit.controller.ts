import { IAuthRequest } from "@/config/interfaces/request.interface";
import AdminAuditService from "@/modules/admin/admin.audit.service";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { isAdmin, requireAuth } from "@/shared/middleware/auth.middleware";
import { Response, Router } from "express";

class AdminAuditController {
  public path = "/admin/audit-logs";
  private service = new AdminAuditService();
  public route = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.get(this.path, requireAuth, isAdmin, this.listLogs);
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
}

export default AdminAuditController;
