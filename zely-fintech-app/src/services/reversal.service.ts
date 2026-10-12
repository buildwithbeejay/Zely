import { axiosPrivate } from "../api/client";

export type ReversalType = "TRANSFER_REVERSAL" | "MANUAL_CREDIT";
export type ReversalStatus = "PENDING" | "COMPLETED" | "FAILED";
export type ReversalReason =
  | "FRAUD"
  | "USER_DISPUTE"
  | "COMPLIANCE"
  | "DUPLICATE_TRANSACTION"
  | "TECHNICAL_ERROR"
  | "MANUAL_CREDIT_WEBHOOK_FAILURE"
  | "OTHER";

// export interface ReversalRecord {
//   reversalId: string;
//   type: ReversalType;
//   status: ReversalStatus;
//   originalTransactionRef: string;
//   reversalTransactionRef?: string;
//   originalAmount: number;
//   originalFee: number;
//   reverseFee: boolean;
//   reversalAmount: number; // computed: originalAmount + (reverseFee ? originalFee : 0)
//   reason: ReversalReason;
//   notes: string;
//   initiatedBy: string;
//   senderPublicId: string;
//   receiverPublicId: string;
//   createdAt: string;
//   initiatedAt: string;
//   completedAt?: string | null;
//   failureReason?: string | null;
//   receiverFrozen: boolean;
//   receiverWentNegative: boolean;
//   paymentRef?: string;
// }

export interface ReversalParty {
  userPublicId: string;
  name: string;
  email: string;
}

export interface ReversalRecord {
  reversalId: string;
  type: ReversalType;
  status: ReversalStatus;
  originalTransactionRef: string;
  reversalTransactionRef?: string;
  originalAmount: number;
  originalFee: number;
  reverseFee: boolean;
  reversalAmount: number;
  reason: ReversalReason;
  notes: string;
  initiatedBy: string;
  senderPublicId: string;
  receiverPublicId: string;
  sender: ReversalParty;
  receiver: ReversalParty;
  createdAt: string;
  initiatedAt: string;
  completedAt?: string | null;
  failureReason?: string | null;
  receiverFrozen: boolean;
  receiverWentNegative: boolean;
  paymentRef?: string;
}

export interface ReversalListResponse {
  reversals: ReversalRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface InitiateReversalInput {
  originalTransactionRef: string;
  reason: ReversalReason;
  notes: string;
  reverseFee: boolean;
}

export interface ManualCreditInput {
  paymentRef: string;
  notes: string;
}

// Maps raw backend response to ReversalRecord (computes reversalAmount)
const mapReversal = (raw: any): ReversalRecord => ({
  ...raw,
  reversalAmount:
    raw.originalAmount + (raw.reverseFee ? (raw.originalFee ?? 0) : 0),
});

export const reversalService = {
  getReversals: async (params?: {
    type?: ReversalType;
    status?: ReversalStatus;
    reason?: ReversalReason;
    senderPublicId?: string;
    receiverPublicId?: string;
    page?: number;
    limit?: number;
  }): Promise<ReversalListResponse> => {
    const res = await axiosPrivate.get("/admin/reversals", { params });
    const { reversals, pagination } = res.data.data;
    return {
      reversals: reversals.map(mapReversal),
      pagination,
    };
  },

  getReversalById: async (reversalId: string): Promise<ReversalRecord> => {
    const res = await axiosPrivate.get(`/admin/reversals/${reversalId}`);
    return mapReversal(res.data.data);
  },

  initiateReversal: async (
    input: InitiateReversalInput,
  ): Promise<ReversalRecord> => {
    const res = await axiosPrivate.post("/admin/reversals", input);
    return mapReversal(res.data.data);
  },

  applyManualCredit: async (
    input: ManualCreditInput,
  ): Promise<ReversalRecord> => {
    const res = await axiosPrivate.post(
      "/admin/reversals/manual-credit",
      input,
    );
    return mapReversal(res.data.data);
  },
};
