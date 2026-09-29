import axiosPrivate from "@/api/client";

export interface UserSession {
  sessionId: string;
  deviceName: string;
  ipAddress: string;
  lastUsedAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export const sessionService = {
  getSessions: async (): Promise<UserSession[]> => {
    const res = await axiosPrivate.get("/auth/sessions");
    return res.data.data;
  },

  killSession: async (sessionId: string): Promise<void> => {
    await axiosPrivate.delete(`/auth/sessions/${sessionId}`);
  },

  killAllOtherSessions: async (): Promise<void> => {
    await axiosPrivate.delete("/auth/sessions");
  },
};
