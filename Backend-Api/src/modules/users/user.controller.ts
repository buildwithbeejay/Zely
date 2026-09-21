import { IAuthRequest } from "@/config/interfaces/request.interface";
import userService from "@/modules/users/user.service";
import BadRequestError from "@/shared/errors/badRequest";
import { NotFoundError } from "@/shared/errors/notFoundError";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { requireAuth } from "@/shared/middleware/auth.middleware";
import { getRequestContext } from "@/shared/middleware/request.context";
import { Response, Router } from "express";

class UserController {
  public path = "/users";
  private userService = new userService();
  public route = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.get(
      `${this.path}/provisioning-status`,
      requireAuth,
      this.getProvisioningStatus,
    );

    this.route.patch(`${this.path}/profile`, requireAuth, this.updateProfile);
    this.route.get(`${this.path}/profile`, requireAuth, this.getProfile);

    this.route.post(
      `${this.path}/retry-provisioning`,
      requireAuth,
      this.retryProvisioning,
    );

    this.route.get(
      `${this.path}/dashboard-summary`,
      requireAuth,
      this.getDashboardSummary,
    );

    this.route.get(`${this.path}/wallets`, requireAuth, this.getWallets);

    this.route.get(
      `${this.path}/transactions`,
      requireAuth,
      this.getTransactions,
    );
  }

  private getProvisioningStatus = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const userSub = req.user?.sub;
      const context = getRequestContext(req);

      if (!userSub) {
        throw new BadRequestError("USER_SUB_MISSING");
      }

      const result = await this.userService.getProvisioningStatus(
        userSub,
        context,
      );

      res.status(200).json(result);
    },
  );

  private retryProvisioning = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const userSub = req.user?.sub;
      const context = getRequestContext(req);

      if (!userSub) {
        throw new BadRequestError("USER_SUB_MISSING");
      }

      const result = await this.userService.retryProvisioning(userSub, context);

      res.status(200).json(result);
    },
  );

  private getDashboardSummary = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const userPublicId = req.user?.userId;

      if (!userPublicId) {
        throw new BadRequestError("USER_PUBLIC_ID_MISSING");
      }

      const result = await this.userService.getDashboardSummary(userPublicId);
      res.status(200).json({ ok: true, data: result });
    },
  );

  private getWallets = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const userPublicId = req.user?.userId;

      if (!userPublicId) {
        throw new BadRequestError("USER_PUBLIC_ID_MISSING");
      }

      const result = await this.userService.getWallets(userPublicId);
      res.status(200).json({ ok: true, data: result });
    },
  );

  private getTransactions = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const userPublicId = req.user?.userId;
      const { limit, page, direction, walletType, status } = req.query;

      if (!userPublicId) {
        throw new BadRequestError("USER_PUBLIC_ID_MISSING");
      }

      const result = await this.userService.getTransactions(userPublicId, {
        limit: limit ? parseInt(limit as string) : undefined,
        page: page ? parseInt(page as string) : undefined,
        direction: direction as "debit" | "credit" | undefined,
        walletType: walletType as string | undefined,
        status: status as string | undefined,
      });

      res.status(200).json({ ok: true, ...result });
    },
  );

  private getProfile = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const userSub = req.user?.sub;
      if (!userSub) throw new BadRequestError("USER_SUB_MISSING");

      const userProfile = await this.userService.getUserProfile(userSub);

      res.status(200).json(userProfile);
    },
  );

  private updateProfile = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const userSub = req.user?.sub;
      if (!userSub) throw new BadRequestError("USER_SUB_MISSING");

      const { name, phone, address } = req.body;

      // Only allow safe fields — never email or role
      const updateRecord: Record<string, string> = {};
      if (name?.trim()) updateRecord.name = name.trim();
      if (phone?.trim()) updateRecord.phone = phone.trim();
      if (address?.trim()) updateRecord.address = address.trim();

      if (Object.keys(updateRecord).length === 0) {
        throw new BadRequestError("NO_VALID_FIELDS_TO_UPDATE");
      }

      const updatedUser = await this.userService.updateUserProfile(
        userSub,
        updateRecord,
      );

      if (!updatedUser) throw new NotFoundError("USER_NOT_FOUND");

      res.status(200).json({ ok: true, data: updatedUser });
    },
  );
}

export default UserController;
