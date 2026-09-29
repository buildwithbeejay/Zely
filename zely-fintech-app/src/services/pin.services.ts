import axiosPrivate from "@/api/client";

export const pinService = {
  // GET /auth/pin/status
  isPinSet: async (): Promise<boolean> => {
    try {
      const res = await axiosPrivate.get("/auth/pin/status");
      return res.data.isPinSet;
    } catch {
      return false;
    }
  },

  // POST /auth/pin/setup
  setupPin: async (payload: {
    pin: string;
    confirmPin: string;
  }): Promise<{ message: string }> => {
    const res = await axiosPrivate.post("/auth/pin/setup", payload);
    return res.data;
  },

  // POST /auth/pin/change
  changePin: async (payload: {
    currentPin: string;
    newPin: string;
    confirmNewPin: string;
    authType: "password" | "otp";
    password?: string;
    otp?: string;
  }): Promise<{ message: string }> => {
    const res = await axiosPrivate.post("/auth/pin/change", payload);
    return res.data;
  },

  // POST /auth/pin/change/request-otp — sends OTP for change PIN secondary auth
  requestChangePinOtp: async (): Promise<{ message: string }> => {
    const res = await axiosPrivate.post("/auth/pin/change/request-otp");

    return res.data;
  },

  // POST /auth/pin/forgot — sends OTP to email for reset
  requestResetOtp: async (): Promise<{ message: string }> => {
    const res = await axiosPrivate.post("/auth/pin/forgot");
    return res.data;
  },

  // POST /auth/pin/reset
  resetPin: async (payload: {
    otp: string;
    newPin: string;
    confirmPin: string;
  }): Promise<{ message: string }> => {
    const res = await axiosPrivate.post("/auth/pin/reset", payload);
    return res.data;
  },
};
