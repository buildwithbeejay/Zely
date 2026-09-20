import React, { useState } from "react";
import { Copy, Check, Terminal, Play, ArrowRight, Shield } from "lucide-react";
import { ThemeConfig } from "../themeConfig";

interface ApiEndpoint {
  method: "POST" | "GET";
  path: string;
  title: string;
  description: string;
  headers: Record<string, string>;
  requestBody?: string;
  responseBody: string;
  status: number;
}

export const ApiExplorer: React.FC<{
  onOpenDocs: () => void;
  theme: ThemeConfig;
}> = ({ onOpenDocs, theme }) => {
  const [activeTab, setActiveTab] = useState(1); // default to transfers/initiate
  const [copied, setCopied] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const endpoints: ApiEndpoint[] = [
    {
      method: "POST",
      path: "/auth/register",
      title: "User Registration & Wallet Provisioning",
      description:
        "Creates user identity in MongoDB and triggers synchronous Tier 1 Ledger Account creation with automated welcome email via Resend.",
      headers: {
        "Content-Type": "application/json",
      },
      requestBody: `{
  "email": "engineer@fintech.co",
  "password": "SecurePassword#2025",
  "firstName": "Mobolaji",
  "lastName": "Beejay",
  "phone": "+2348012345678"
}`,
      responseBody: `{
  "success": true,
  "statusCode": 201,
  "data": {
    "user": {
      "id": "usr_99a8b7c6",
      "email": "engineer@fintech.co",
      "kycTier": "TIER_1",
      "wallet": {
        "id": "wlt_01HX98ZELY4492A",
        "accountNumber": "0123456789",
        "currency": "NGN",
        "ledgerAccountId": "acct_cust_99a8b7c6"
      }
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900
    }
  }
}`,
      status: 201,
    },
    {
      method: "POST",
      path: "/transfers/initiate",
      title: "Idempotent Inter-Wallet Transfer",
      description:
        "Executes atomic wallet transfer with required idempotency reservation in Redis, atomic MongoDB outbox write, and Kafka CDC event generation.",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer eyJhbGciOiJIUzI1Ni...",
        "x-idempotency-key": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      },
      requestBody: `{
  "recipientAccountNumber": "9876543210",
  "amount": 250000.00,
  "currency": "NGN",
  "narration": "Infrastructure cluster node invoice #402",
  "pin": "1234"
}`,
      responseBody: `{
  "success": true,
  "statusCode": 200,
  "data": {
    "transferId": "trf_88x99a22bb",
    "idempotencyKey": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "status": "COMPLETED",
    "amount": 250000.00,
    "fee": 0.00,
    "senderBalanceAfter": 14600250.00,
    "ledgerJournalId": "jrn_01HX9921_BALANCED",
    "createdAt": "2026-08-23T10:45:00.000Z"
  }
}`,
      status: 200,
    },
    {
      method: "GET",
      path: "/wallets/balance",
      title: "Multi-Vault Ledger Balance Check",
      description:
        "Fetches cached balance with instant Redis fallback to MongoDB aggregation and checks real-time double-entry ledger balance parity.",
      headers: {
        Authorization: "Bearer eyJhbGciOiJIUzI1Ni...",
      },
      responseBody: `{
  "success": true,
  "statusCode": 200,
  "data": {
    "currency": "NGN",
    "availableBalance": 14850250.00,
    "ledgerBalance": 14850250.00,
    "drift": 0.00,
    "vaults": {
      "flexible": 3200000.00,
      "locked": 11650250.00
    },
    "lastSettledAt": "2026-08-23T10:44:12.000Z"
  }
}`,
      status: 200,
    },
    {
      method: "POST",
      path: "/vaults/deposit",
      title: "Vault Creation & Target Maturity Lock",
      description:
        "Transfers funds internally from main wallet to target/locked savings vault without external fees, computing projected maturity interest.",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer eyJhbGciOiJIUzI1Ni...",
      },
      requestBody: `{
  "vaultType": "TARGET",
  "name": "Cloud Infrastructure Reserve Q3",
  "targetAmount": 5000000.00,
  "depositAmount": 500000.00,
  "maturityDate": "2026-12-31T23:59:59.000Z",
  "interestRatePcnt": 14.5
}`,
      responseBody: `{
  "success": true,
  "statusCode": 201,
  "data": {
    "vaultId": "vlt_target_991823",
    "name": "Cloud Infrastructure Reserve Q3",
    "currentAmount": 500000.00,
    "targetAmount": 5000000.00,
    "status": "ACTIVE",
    "projectedPayoutAtMaturity": 526540.21
  }
}`,
      status: 200,
    },
    {
      method: "POST",
      path: "/reconciliation/run",
      title: "Three-Layer Invariant Reconciliation",
      description:
        "Executes automated settlement comparison against Paystack records and detects internal ledger drift across all domain accounts.",
      headers: {
        Authorization: "Bearer eyJhbGciOiJIUzI1Ni_ADMIN...",
      },
      responseBody: `{
  "success": true,
  "statusCode": 200,
  "data": {
    "runId": "rec_run_20260823_01",
    "executionTimeMs": 142,
    "layersChecked": {
      "layer1_ledgerDrift": "PASSED (0 drift across 4,120 accounts)",
      "layer2_paystackSettlement": "PASSED (Matched ₦ 48,200,000.00 in webhook events)",
      "layer3_invariantVerification": "PASSED (ΣDebits - ΣCredits == 0)"
    },
    "discrepanciesCount": 0,
    "counterpartyAccount": "RECONCILIATION_ADJUSTMENTS"
  }
}`,
      status: 200,
    },
  ];

  const current = endpoints[activeTab];

  const handleCopy = () => {
    const content = current.requestBody
      ? `curl -X ${current.method} "https://api.zely.dev/api/v1${current.path}" \\\n  -H "Content-Type: application/json" \\\n  -d '${current.requestBody}'`
      : `curl -X ${current.method} "https://api.zely.dev/api/v1${current.path}"`;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulate = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
    }, 400);
  };

  return (
    <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl shadow-sm overflow-hidden text-slate-800 font-sans">
      {/* Top Bar with Endpoint Selectors */}
      <div className="bg-[#FBFBF9] border-b border-[#E5E7EB] p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Terminal className={`w-4 h-4 ${theme.brandText}`} />
          <span className="text-xs font-mono font-bold text-slate-900 tracking-wider">
            ZELY RESTful API CONTRACTS
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {endpoints.map((ep, idx) => (
            <button
              key={ep.path}
              onClick={() => setActiveTab(idx)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 ${
                activeTab === idx
                  ? `${theme.brandAccentSoft} ${theme.brandText} font-bold border ${theme.brandBorder} shadow-sm`
                  : "bg-white text-slate-600 hover:text-slate-900 border border-[#E5E7EB] hover:border-slate-300"
              }`}
            >
              <span
                className={`text-[10px] font-bold ${
                  ep.method === "POST" ? "text-[#7C3AED]" : "text-emerald-600"
                }`}
              >
                {ep.method}
              </span>
              <span>{ep.path}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Endpoint Metadata & Description */}
      <div className="p-4 sm:p-6 bg-white border-b border-[#E5E7EB] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                current.method === "POST"
                  ? "bg-purple-50 text-[#7C3AED] border border-purple-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {current.method}
            </span>
            <code className="text-sm font-mono font-bold text-slate-900">
              /api/v1{current.path}
            </code>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            {current.description}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto font-sans">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FBFBF9] hover:bg-white border border-[#E5E7EB] text-slate-700 text-xs font-mono transition-all"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? "Copied cURL" : "Copy cURL"}</span>
          </button>

          <button
            onClick={handleSimulate}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg ${theme.brandAccent} ${theme.brandAccentHover} text-white text-xs font-mono font-semibold transition-all shadow-sm active:scale-95`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isExecuting ? "Simulating..." : "Test Request"}</span>
          </button>
        </div>
      </div>

      {/* Code Viewer: Split Request & Response with clean high contrast dark code pane */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 bg-slate-900 text-slate-200">
        {/* Request Side */}
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2.5 pb-2 border-b border-slate-800">
            <span>REQUEST PAYLOAD & HEADERS</span>
            <span className="text-purple-300">JSON RFC 8259</span>
          </div>

          <div className="mb-3 space-y-1 text-xs font-mono text-slate-400 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
            {Object.entries(current.headers).map(([key, val]) => (
              <div
                key={key}
                className="flex items-center gap-2 overflow-x-auto text-[11px]"
              >
                <span className="text-purple-300 font-semibold">{key}:</span>
                <span className="text-slate-300 truncate">{val}</span>
              </div>
            ))}
          </div>

          {current.requestBody ? (
            <pre className="text-xs font-mono text-purple-200 bg-slate-950/80 p-3.5 rounded-lg border border-slate-800 overflow-x-auto leading-relaxed">
              <code>{current.requestBody}</code>
            </pre>
          ) : (
            <div className="p-8 text-center text-xs font-mono text-slate-500 italic bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
              No request body required for this GET query.
            </div>
          )}
        </div>

        {/* Response Side */}
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2.5 pb-2 border-b border-slate-800">
            <span>RESPONSE OUTPUT</span>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">
                STATUS {current.status} OK
              </span>
              <span className="text-slate-500 font-mono">· 18ms</span>
            </div>
          </div>

          <pre className="text-xs font-mono text-emerald-300 bg-slate-950/80 p-3.5 rounded-lg border border-slate-800 overflow-x-auto leading-relaxed">
            <code>{current.responseBody}</code>
          </pre>
        </div>
      </div>

      {/* Bottom Bar with Full Docs Trigger */}
      <div className="p-4 bg-[#FBFBF9] border-t border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans">
        <div className="flex items-center gap-2 text-slate-600">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>
            All endpoints strictly enforce HMAC webhook signatures & Rate
            Limiting
          </span>
        </div>

        <button
          onClick={onOpenDocs}
          className={`flex items-center gap-1.5 ${theme.brandText} font-semibold hover:underline self-start sm:self-auto`}
        >
          <span>Explore all 64 API Endpoints in Docs Modal</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
