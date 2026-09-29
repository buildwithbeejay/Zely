import Controller from "@/config/interfaces/controller.interfaces";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import pinValidation from "@/modules/pin/pin.validation";
import { getRequestContext } from "@/shared/middleware/request.context";
import { Response, Router } from "express";
import { StatusCodes } from "http-status-codes";
import asyncWrapper from "shared/middleware/async.wrapper";
import {
  requireAuth,
  requireFreshSession,
} from "shared/middleware/auth.middleware";
import validateRequest from "shared/middleware/validation.middleware";
import PinService from "./pin.service";
import {
  pinSetupLimiters,
  pinChangeLimiters,
  pinForgotLimiters,
  pinResetLimiters,
  pinRequestChangeOtpLimiters,
} from "@/infrastructure/helpers/ratelimiter";

class PinController implements Controller {
  public path = "/auth/pin";
  public route = Router();
  private pinService = new PinService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.post(
      `${this.path}/setup`,
      requireAuth,
      ...pinSetupLimiters,
      validateRequest(pinValidation.setup, "body"),
      this.setup,
    );

    this.route.post(
      `${this.path}/change`,
      requireAuth,
      requireFreshSession,
      ...pinChangeLimiters,
      validateRequest(pinValidation.change, "body"),
      this.change,
    );

    this.route.post(
      `${this.path}/change/request-otp`,
      requireAuth,
      ...pinRequestChangeOtpLimiters,
      this.requestChangeOtp,
    );

    this.route.post(
      `${this.path}/forgot`,
      requireAuth,
      ...pinForgotLimiters,
      this.forgot,
    );

    this.route.post(
      `${this.path}/reset`,
      requireAuth,
      requireFreshSession,
      ...pinResetLimiters,
      validateRequest(pinValidation.reset, "body"),
      this.reset,
    );

    this.route.get(`${this.path}/status`, requireAuth, this.status);
  }

  private setup = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const { pin, confirmPin } = req.body;
    const userId = req.user!.userId;
    const context = getRequestContext(req);

    const result = await this.pinService.setupPin(
      userId,
      pin,
      confirmPin,
      context,
    );

    return res.status(StatusCodes.CREATED).json(result);
  });

  private change = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const { currentPin, newPin, confirmNewPin, authType, password, otp } =
      req.body;
    const userId = req.user!.userId;
    const context = getRequestContext(req);

    // authValue is whichever secondary factor came in
    const authValue = authType === "password" ? password : otp;

    const result = await this.pinService.changePin(
      userId,
      currentPin,
      newPin,
      confirmNewPin,
      authType,
      authValue,
      context,
    );

    return res.status(StatusCodes.OK).json(result);
  });

  private forgot = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const context = getRequestContext(req);

    const result = await this.pinService.forgotPin(userId, context);

    return res.status(StatusCodes.OK).json(result);
  });

  private reset = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const { otp, newPin, confirmPin } = req.body;
    const userId = req.user!.userId;
    const context = getRequestContext(req);

    const result = await this.pinService.resetPin(
      userId,
      otp,
      newPin,
      confirmPin,
      context,
    );

    return res.status(StatusCodes.OK).json(result);
  });

  private status = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const context = getRequestContext(req);

    const result = await this.pinService.getPinStatus(userId);

    return res.status(StatusCodes.OK).json(result);
  });

  private requestChangeOtp = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const userId = req.user!.userId;
      const context = getRequestContext(req);

      const result = await this.pinService.requestChangePinOtp(userId, context);

      return res.status(StatusCodes.OK).json(result);
    },
  );
}

export default PinController;
