import { Response, Router } from "express";
import { StatusCodes } from "http-status-codes";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { requireAuth, isAdmin } from "@/shared/middleware/auth.middleware";
import { getRequestContext } from "@/shared/middleware/request.context";
import Controller from "@/config/interfaces/controller.interfaces";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import ReversalService from "./reversal.service";
import { ReversalReason, ReversalStatus, ReversalType } from "./reversal.model";
import BadRequestError from "@/shared/errors/badRequest";

class ReversalController implements Controller {
  public path = "/admin/reversals";
  public route = Router();
  private reversalService = ReversalService;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // All reversal endpoints are admin-only
    this.route.post(
      `${this.path}`,
      requireAuth,
      isAdmin,
      this.initiateReversal,
    );

    this.route.post(
      `${this.path}/manual-credit`,
      requireAuth,
      isAdmin,
      this.initiateManualCredit,
    );

    this.route.get(`${this.path}`, requireAuth, isAdmin, this.listReversals);

    this.route.get(
      `${this.path}/:reversalId`,
      requireAuth,
      isAdmin,
      this.getReversal,
    );
  }

  private initiateReversal = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const context = getRequestContext(req);
      const adminPublicId = req.user?.userId;
      if (!adminPublicId) throw new BadRequestError("Not authenticated");

      const { originalTransactionRef, reason, notes, reverseFee } = req.body;

      if (!originalTransactionRef) {
        throw new BadRequestError("originalTransactionRef is required");
      }
      if (!reason || !Object.values(ReversalReason).includes(reason)) {
        throw new BadRequestError("Valid reason is required");
      }
      if (!notes) throw new BadRequestError("notes is required");

      const result = await this.reversalService.initiateReversal({
        originalTransactionRef,
        reason,
        notes,
        reverseFee: reverseFee ?? true,
        adminPublicId,
        context,
      });

      return res.status(StatusCodes.CREATED).json({ ok: true, data: result });
    },
  );

  private initiateManualCredit = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const context = getRequestContext(req);
      const adminPublicId = req.user?.userId;
      if (!adminPublicId) throw new BadRequestError("Not authenticated");

      const { paymentRef, notes } = req.body;

      if (!paymentRef) throw new BadRequestError("paymentRef is required");
      if (!notes) throw new BadRequestError("notes is required");

      const result = await this.reversalService.initiateManualCredit({
        paymentRef,
        notes,
        adminPublicId,
        context,
      });

      return res.status(StatusCodes.CREATED).json({ ok: true, data: result });
    },
  );

  private listReversals = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const {
        type,
        status,
        reason,
        senderPublicId,
        receiverPublicId,
        limit,
        page,
      } = req.query;

      const result = await this.reversalService.listReversals({
        type: type as ReversalType,
        status: status as ReversalStatus,
        reason: reason as ReversalReason,
        senderPublicId: senderPublicId as string,
        receiverPublicId: receiverPublicId as string,
        limit: limit ? parseInt(limit as string) : undefined,
        page: page ? parseInt(page as string) : undefined,
      });

      return res.status(StatusCodes.OK).json({ ok: true, data: result });
    },
  );

  private getReversal = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const { reversalId } = req.params;
      const result = await this.reversalService.getReversal(reversalId);
      return res.status(StatusCodes.OK).json({ ok: true, data: result });
    },
  );
}

export default ReversalController;
