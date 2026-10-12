import { IAuthRequest } from "@/config/interfaces/request.interface";
import AdminUserService from "@/modules/admin/admin.service";
import BadRequestError from "@/shared/errors/badRequest";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { isAdmin, requireAuth } from "@/shared/middleware/auth.middleware";
import { Response, Router } from "express";

class AdminUserController {
  public path = "/admin/users";
  public transactionsPath = "/admin/transactions";
  private adminUserService = new AdminUserService();
  public route = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Users
    this.route.get(this.path, requireAuth, isAdmin, this.listUsers);
    this.route.get(
      `${this.path}/:userId`,
      requireAuth,
      isAdmin,
      this.getUserDetail,
    );

    this.route.get("/test", (req, res) => res.json({ ok: true }));
    this.route.get("/admin/users/test2", (req, res) =>
      res.json({ ok: true, path: "admin/users/test2" }),
    );

    // Transactions — separate path
    this.route.get(
      this.transactionsPath,
      requireAuth,
      isAdmin,
      this.listTransactions,
    );
    this.route.get(
      `${this.transactionsPath}/:transactionId`,
      requireAuth,
      isAdmin,
      this.getDetail,
    );
    this.route.get("/admin/users/test2", (req, res) =>
      res.json({ ok: true, path: "admin/users/test2" }),
    );
    this.route.get(
      "/admin/dashboard/stats",
      requireAuth,
      isAdmin,
      this.getDashboardStats,
    );
  }

  private listUsers = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const { search, sort, order, page, limit, status, role, kycTier } =
        req.query;

      const result = await this.adminUserService.listUsers({
        search: search as string | undefined,
        sort: sort as string | undefined,
        order: order as string | undefined,
        page: page as string | undefined,
        limit: limit as string | undefined,
        status: status as string | undefined,
        role: role as string | undefined,
        kycTier: kycTier as string | undefined,
      });

      res.status(200).json({ ok: true, ...result });
    },
  );

  private getUserDetail = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const { userId } = req.params;
      if (!userId) throw new BadRequestError("USER_ID_MISSING");

      const result = await this.adminUserService.getUserDetail(userId);
      res.status(200).json({ ok: true, data: result });
    },
  );

  private listTransactions = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const {
        search,
        userId,
        direction,
        walletType,
        status,
        dateFrom,
        dateTo,
        page,
        limit,
        sort,
        order,
        category,
      } = req.query;

      const result = await this.adminUserService.listTransactions({
        search: search as string,
        userId: userId as string,
        direction: direction as "debit" | "credit",
        walletType: walletType as string,
        status: status as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        page: page as string,
        category: category as string,
        limit: limit as string,
        sort: sort as string,
        order: order as string,
      });

      res.status(200).json({ ok: true, ...result });
    },
  );

  private getDetail = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const { transactionId } = req.params;
    if (!transactionId) throw new BadRequestError("TRANSACTION_ID_MISSING");

    const result =
      await this.adminUserService.getTransactionDetail(transactionId);
    res.status(200).json({ ok: true, data: result });
  });

  private getDashboardStats = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const result = await this.adminUserService.getDashboardStats();
      res.status(200).json({ ok: true, data: result });
    },
  );
}

export default AdminUserController;
