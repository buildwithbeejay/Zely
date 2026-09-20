export interface ApiEndpointItem {
  id: string;
  domain: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  title: string;
  description: string;
  requiresAuth: boolean;
  requiresIdempotency: boolean;
  requestBody?: string;
  responseBody: string;
  status: number;
  headers?: Record<string, string>;
}

export interface DomainCategory {
  id: string;
  name: string;
  count: number;
  description: string;
}

export const DOMAIN_CATEGORIES: DomainCategory[] = [
  {
    id: "all",
    name: "All Domains",
    count: 64,
    description: "Complete RESTful API surface across all 11 subsystems",
  },
  {
    id: "auth",
    name: "1. Authentication & Sessions",
    count: 8,
    description:
      "JWT tokens, Argon2id hashing, session kill-switch, and fail-open auth",
  },
  {
    id: "wallets",
    name: "2. Wallets & Balances",
    count: 7,
    description:
      "Multi-currency wallets, virtual accounts, Tier 1-3 limits, balance caches",
  },
  {
    id: "transfers",
    name: "3. Idempotent Transfers",
    count: 7,
    description:
      "Two-stage Redlock + MongoDB upsert transfers with zero double debits",
  },
  {
    id: "vaults",
    name: "4. Savings Vaults",
    count: 7,
    description:
      "Flexible, locked, and target savings with automated maturity interest",
  },
  {
    id: "ledger",
    name: "5. Double-Entry Ledger",
    count: 7,
    description:
      "Immutable journal entries with Σ(Debits) - Σ(Credits) = 0 invariant",
  },
  {
    id: "kyc",
    name: "6. KYC & Identity Tiering",
    count: 6,
    description:
      "BVN/NIN validation, Cloudinary ID vault, and tier upgrade pipelines",
  },
  {
    id: "reconciliation",
    name: "7. 3-Layer Reconciliation",
    count: 5,
    description:
      "Automated settlement audits against Paystack and internal ledger balance",
  },
  {
    id: "webhooks",
    name: "8. Webhook Ingestion",
    count: 5,
    description:
      "HMAC-signed Paystack webhook processing with replay protection",
  },
  {
    id: "audit",
    name: "9. Audit & Compliance",
    count: 5,
    description:
      "Append-only tamper-evident security audit logs and risk telemetry",
  },
  {
    id: "beneficiaries",
    name: "10. Beneficiary Directory",
    count: 4,
    description:
      "Frequent transfer counterparties, saved bank accounts, and lookup",
  },
  {
    id: "system",
    name: "11. Health & Observability",
    count: 3,
    description:
      "Kubernetes readiness, circuit breaker metrics, and Kafka lag monitoring",
  },
];

export const ALL_64_ENDPOINTS: ApiEndpointItem[] = [
  // ==========================================
  // DOMAIN 1: AUTHENTICATION & SESSIONS (8)
  // ==========================================
  {
    id: "auth-1",
    domain: "auth",
    method: "POST",
    path: "/api/v1/auth/register",
    title: "User Registration & Auto-Provisioning",
    description:
      "Registers identity in MongoDB, initializes Tier 1 ledger accounts, and triggers transactional welcome email via Resend.",
    requiresAuth: false,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      {
        email: "engineer@fintech.co",
        password: "SecurePassword#2026",
        firstName: "Mobolaji",
        lastName: "Beejay",
        phone: "+2348012345678",
      },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 201,
        data: {
          userId: "usr_01HX89M4",
          email: "engineer@fintech.co",
          kycTier: "TIER_1",
          walletId: "wlt_01HX98ZELY4492A",
          accountNumber: "0123456789",
          createdAt: "2026-08-23T11:00:00Z",
        },
      },
      null,
      2,
    ),
    status: 201,
  },
  {
    id: "auth-2",
    domain: "auth",
    method: "POST",
    path: "/api/v1/auth/login",
    title: "Password Authentication & Session Init",
    description:
      "Verifies credentials with Argon2id, generates access & refresh tokens, and populates Redis fast-path session.",
    requiresAuth: false,
    requiresIdempotency: false,
    requestBody: JSON.stringify(
      {
        email: "engineer@fintech.co",
        password: "SecurePassword#2026",
      },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          refreshToken: "rt_01HX99AABB1234",
          expiresIn: 900,
          user: {
            id: "usr_01HX89M4",
            email: "engineer@fintech.co",
            role: "USER",
          },
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "auth-3",
    domain: "auth",
    method: "POST",
    path: "/api/v1/auth/refresh",
    title: "Token Rotation & Access Refresh",
    description:
      "Rotates expired access tokens using single-use refresh token with reuse detection.",
    requiresAuth: false,
    requiresIdempotency: false,
    requestBody: JSON.stringify({ refreshToken: "rt_01HX99AABB1234" }, null, 2),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: { accessToken: "eyJhbGciOiJIUzI1Ni...", expiresIn: 900 },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "auth-4",
    domain: "auth",
    method: "POST",
    path: "/api/v1/auth/kill-session",
    title: "Emergency Session Kill-Switch",
    description:
      "Instantly invalidates session in Redis cache and marks revocation flag in MongoDB authoritative store.",
    requiresAuth: true,
    requiresIdempotency: false,
    requestBody: JSON.stringify({ sessionId: "sess_9921_abc" }, null, 2),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        message: "Session revoked across all devices.",
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "auth-5",
    domain: "auth",
    method: "GET",
    path: "/api/v1/auth/me",
    title: "Current User Identity & Permissions",
    description:
      "Returns profile details, active session metadata, and assigned role capabilities.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          id: "usr_01HX89M4",
          email: "engineer@fintech.co",
          kycTier: "TIER_1",
          permissions: ["TRANSFER_INIT", "VAULT_WRITE"],
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "auth-6",
    domain: "auth",
    method: "POST",
    path: "/api/v1/auth/forgot-password",
    title: "Password Reset Request Initiation",
    description:
      "Generates secure short-lived cryptographic reset token and dispatches email.",
    requiresAuth: false,
    requiresIdempotency: false,
    requestBody: JSON.stringify({ email: "engineer@fintech.co" }, null, 2),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        message: "Password reset dispatch initiated.",
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "auth-7",
    domain: "auth",
    method: "POST",
    path: "/api/v1/auth/reset-password",
    title: "Complete Password Reset",
    description:
      "Validates reset token, updates Argon2id password hash, and invalidates all existing sessions.",
    requiresAuth: false,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      { token: "rst_9918231", newPassword: "NewSecurePassword#2026" },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        message: "Password updated successfully.",
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "auth-8",
    domain: "auth",
    method: "POST",
    path: "/api/v1/auth/logout",
    title: "Graceful User Sign-Out",
    description:
      "Evicts user session from Redis and logs compliance audit event.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      { success: true, statusCode: 200, message: "Logged out successfully." },
      null,
      2,
    ),
    status: 200,
  },

  // ==========================================
  // DOMAIN 2: WALLETS & BALANCES (7)
  // ==========================================
  {
    id: "wallets-1",
    domain: "wallets",
    method: "GET",
    path: "/api/v1/wallets",
    title: "List User Wallets & Multi-Currency Accounts",
    description:
      "Returns all provisioned currency wallets (NGN, USD, EUR) associated with user account.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: [
          {
            id: "wlt_ngn_01",
            currency: "NGN",
            balance: 14850250.0,
            accountNumber: "0123456789",
            status: "ACTIVE",
          },
          {
            id: "wlt_usd_01",
            currency: "USD",
            balance: 4500.0,
            accountNumber: "USD-982104",
            status: "ACTIVE",
          },
        ],
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "wallets-2",
    domain: "wallets",
    method: "GET",
    path: "/api/v1/wallets/balance",
    title: "Authoritative Multi-Vault Balance Snapshot",
    description:
      "Fetches cached balance with real-time double-entry ledger parity and drift calculation.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          currency: "NGN",
          availableBalance: 14850250.0,
          ledgerBalance: 14850250.0,
          drift: 0.0,
          vaults: { flexible: 3200000.0, locked: 11650250.0 },
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "wallets-3",
    domain: "wallets",
    method: "POST",
    path: "/api/v1/wallets/virtual-account",
    title: "Generate Dynamic Virtual NUBAN Account",
    description:
      "Provisions dedicated Paystack virtual account number linked to user wallet for incoming bank transfers.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify({ preferredBank: "Wema Bank" }, null, 2),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 201,
        data: {
          bankName: "Wema Bank",
          accountNumber: "7829104812",
          accountName: "ZELY / MOBOLAJI BEEJAY",
        },
      },
      null,
      2,
    ),
    status: 201,
  },
  {
    id: "wallets-4",
    domain: "wallets",
    method: "GET",
    path: "/api/v1/wallets/limits",
    title: "Fetch Daily & Transactional Limits",
    description:
      "Returns maximum single transaction, daily cumulative limit, and current tier restrictions.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          kycTier: "TIER_1",
          maxDailyTransfer: 50000.0,
          singleTransferLimit: 20000.0,
          dailyUsageRemaining: 35000.0,
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "wallets-5",
    domain: "wallets",
    method: "POST",
    path: "/api/v1/wallets/lock",
    title: "Administrative Account Freeze / Lock",
    description:
      "Locks wallet account from initiating outbound debits due to compliance flags.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      { walletId: "wlt_ngn_01", reason: "Suspicious login geo anomaly" },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        message: "Wallet temporarily restricted.",
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "wallets-6",
    domain: "wallets",
    method: "POST",
    path: "/api/v1/wallets/unlock",
    title: "Administrative Wallet Unfreeze",
    description:
      "Restores standard transaction capabilities following KYC clearance.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      { walletId: "wlt_ngn_01", reviewerId: "adm_9918" },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      { success: true, statusCode: 200, message: "Wallet restriction lifted." },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "wallets-7",
    domain: "wallets",
    method: "GET",
    path: "/api/v1/wallets/statement",
    title: "Generate Periodic Account Statement",
    description:
      "Aggregates all posted ledger entries into downloadable statement format.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          statementUrl: "https://cdn.zely.dev/statements/stmt_202608.pdf",
          totalDebits: 1250000.0,
          totalCredits: 3400000.0,
        },
      },
      null,
      2,
    ),
    status: 200,
  },

  // ==========================================
  // DOMAIN 3: IDEMPOTENT TRANSFERS (7)
  // ==========================================
  {
    id: "transfers-1",
    domain: "transfers",
    method: "POST",
    path: "/api/v1/transfers/initiate",
    title: "Execute Two-Layer Idempotent Transfer",
    description:
      "Performs atomic transfer with mandatory x-idempotency-key, Redlock reservation, and MongoDB outbox write.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      {
        recipientAccountNumber: "9876543210",
        amount: 250000.0,
        currency: "NGN",
        narration: "Core compute cluster invoice #402",
        pin: "1234",
      },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          transferId: "trf_88x99a22bb",
          idempotencyKey: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
          status: "COMPLETED",
          amount: 250000.0,
          fee: 0.0,
          senderBalanceAfter: 14600250.0,
          ledgerJournalId: "jrn_01HX9921_BALANCED",
          createdAt: "2026-08-23T11:00:00Z",
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "transfers-2",
    domain: "transfers",
    method: "GET",
    path: "/api/v1/transfers/:id",
    title: "Fetch Transfer Details & Ledger Trace",
    description:
      "Retrieves complete transaction state, associated journal entry ID, and dispatch logs.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          transferId: "trf_88x99a22bb",
          status: "COMPLETED",
          amount: 250000.0,
          recipientName: "ADEBAYO KUDUS",
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "transfers-3",
    domain: "transfers",
    method: "GET",
    path: "/api/v1/transfers/history",
    title: "Query Paginated Transfer History",
    description:
      "Returns chronological list of transfers with date filtering and status tags.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: { page: 1, limit: 20, totalCount: 142, items: [] },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "transfers-4",
    domain: "transfers",
    method: "POST",
    path: "/api/v1/transfers/verify-recipient",
    title: "Name Inquiry & Account Verification",
    description:
      "Performs instant inter-bank or internal NUBAN account name resolution before transfer.",
    requiresAuth: true,
    requiresIdempotency: false,
    requestBody: JSON.stringify(
      { accountNumber: "9876543210", bankCode: "044" },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          accountName: "ADEBAYO KUDUS",
          accountNumber: "9876543210",
          bankName: "Access Bank",
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "transfers-5",
    domain: "transfers",
    method: "POST",
    path: "/api/v1/transfers/retry",
    title: "Retry Failed Transfer via Idempotent Pipeline",
    description:
      "Safely re-evaluates a stalled transfer without risk of multiple debits.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify({ transferId: "trf_88x99a22bb" }, null, 2),
    responseBody: JSON.stringify(
      { success: true, statusCode: 200, data: { status: "COMPLETED" } },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "transfers-6",
    domain: "transfers",
    method: "GET",
    path: "/api/v1/transfers/idempotency/:key",
    title: "Query Idempotency Key Status",
    description:
      "Inspects cached response payload and lock status for given UUIDv4 key in Redis.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          key: "9b1deb4d-3b7d-4bad...",
          state: "RESOLVED",
          cachedStatus: 200,
          ttlSecondsRemaining: 98,
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "transfers-7",
    domain: "transfers",
    method: "POST",
    path: "/api/v1/transfers/cancel",
    title: "Cancel Pending Scheduled Transfer",
    description:
      "Cancels un-executed scheduled or recurring transfer and releases reserved balance.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify({ scheduledTransferId: "sch_991823" }, null, 2),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        message: "Transfer schedule cancelled.",
      },
      null,
      2,
    ),
    status: 200,
  },

  // ==========================================
  // DOMAIN 4: SAVINGS VAULTS (7)
  // ==========================================
  {
    id: "vaults-1",
    domain: "vaults",
    method: "POST",
    path: "/api/v1/vaults/create",
    title: "Create New Savings Vault",
    description:
      "Provisions Flexible, Locked, or Target savings container with custom interest rules.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      {
        vaultType: "TARGET",
        name: "Cloud Infrastructure Reserve Q3",
        targetAmount: 5000000.0,
        depositAmount: 500000.0,
        maturityDate: "2026-12-31T23:59:59Z",
        interestRatePcnt: 14.5,
      },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 201,
        data: {
          vaultId: "vlt_target_991823",
          status: "ACTIVE",
          currentAmount: 500000.0,
          projectedPayoutAtMaturity: 526540.21,
        },
      },
      null,
      2,
    ),
    status: 201,
  },
  {
    id: "vaults-2",
    domain: "vaults",
    method: "GET",
    path: "/api/v1/vaults/all",
    title: "List All User Savings Vaults",
    description:
      "Fetches active, matured, and archived vaults with accrued interest breakdown.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: [
          {
            id: "vlt_flex_01",
            type: "FLEXIBLE",
            name: "Emergency Fund",
            balance: 3200000.0,
            apy: 12.0,
          },
          {
            id: "vlt_lock_02",
            type: "LOCKED",
            name: "Year-End Node Upgrades",
            balance: 11650250.0,
            apy: 16.5,
          },
        ],
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "vaults-3",
    domain: "vaults",
    method: "GET",
    path: "/api/v1/vaults/:id",
    title: "Get Vault Specific Details",
    description:
      "Returns complete deposit history, milestone progress percentage, and penalty rules.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          id: "vlt_lock_02",
          name: "Year-End Node Upgrades",
          balance: 11650250.0,
          accruedInterest: 482104.22,
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "vaults-4",
    domain: "vaults",
    method: "POST",
    path: "/api/v1/vaults/deposit",
    title: "Deposit Funds to Vault",
    description:
      "Transfers money from main wallet to target vault via internal ledger pipeline.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      { vaultId: "vlt_flex_01", amount: 150000.0 },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      { success: true, statusCode: 200, data: { newVaultBalance: 3350000.0 } },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "vaults-5",
    domain: "vaults",
    method: "POST",
    path: "/api/v1/vaults/withdraw",
    title: "Withdraw from Vault to Main Wallet",
    description:
      "Transfers funds back to main wallet with early withdrawal penalty check if locked.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      { vaultId: "vlt_flex_01", amount: 100000.0 },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: { remainingVaultBalance: 3250000.0 },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "vaults-6",
    domain: "vaults",
    method: "GET",
    path: "/api/v1/vaults/projections",
    title: "Calculate Compounding Interest Projection",
    description:
      "Computes future yield based on deposit size, APY rate, and lock term in days.",
    requiresAuth: false,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          principal: 1000000.0,
          apy: 16.0,
          durationDays: 180,
          totalInterest: 78904.11,
          finalPayout: 1078904.11,
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "vaults-7",
    domain: "vaults",
    method: "POST",
    path: "/api/v1/vaults/claim-interest",
    title: "Claim Accrued Interest Payout",
    description:
      "Credits matured interest from system interest liability account into user balance.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify({ vaultId: "vlt_lock_02" }, null, 2),
    responseBody: JSON.stringify(
      { success: true, statusCode: 200, data: { interestPaid: 482104.22 } },
      null,
      2,
    ),
    status: 200,
  },

  // ==========================================
  // DOMAIN 5: DOUBLE-ENTRY LEDGER (7)
  // ==========================================
  {
    id: "ledger-1",
    domain: "ledger",
    method: "GET",
    path: "/api/v1/ledger/accounts",
    title: "List Chart of Accounts",
    description:
      "Returns all system asset, liability, equity, revenue, and expense accounts.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: [
          {
            code: "1001",
            name: "CASH_AT_BANK_PAYSTACK",
            type: "ASSET",
            balance: 48200000.0,
          },
          {
            code: "2001",
            name: "CUSTOMER_WALLET_LIABILITY",
            type: "LIABILITY",
            balance: 48200000.0,
          },
          {
            code: "3001",
            name: "RECONCILIATION_ADJUSTMENTS",
            type: "EQUITY",
            balance: 0.0,
          },
        ],
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "ledger-2",
    domain: "ledger",
    method: "GET",
    path: "/api/v1/ledger/journals",
    title: "Query Immutable Journal Entries",
    description:
      "Lists double-entry journal records where sum of debits equals sum of credits.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          totalJournals: 94210,
          entries: [
            {
              journalId: "jrn_01HX9921_BALANCED",
              timestamp: "2026-08-23T11:00:00Z",
              debitAccountId: "acct_user_wallet_01",
              debitAmount: 250000.0,
              creditAccountId: "acct_user_wallet_02",
              creditAmount: 250000.0,
              balanced: true,
            },
          ],
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "ledger-3",
    domain: "ledger",
    method: "GET",
    path: "/api/v1/ledger/journals/:id",
    title: "Fetch Journal Audit Trail by ID",
    description:
      "Returns cryptographic hash, transaction reference, and balanced line items.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          journalId: "jrn_01HX9921_BALANCED",
          sha256Signature:
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          isZeroDrift: true,
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "ledger-4",
    domain: "ledger",
    method: "GET",
    path: "/api/v1/ledger/trial-balance",
    title: "Compute Real-Time Trial Balance",
    description:
      "Validates system invariant: Σ(All Debits) - Σ(All Credits) = 0.00.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          totalDebits: 894025000.0,
          totalCredits: 894025000.0,
          difference: 0.0,
          status: "BALANCED_PERFECT",
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "ledger-5",
    domain: "ledger",
    method: "GET",
    path: "/api/v1/ledger/audit-trail",
    title: "Query Tamper-Evident Ledger Audit Log",
    description:
      "Streams sequential immutable modifications and verification block headers.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: { auditedBlocksCount: 512, verified: true },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "ledger-6",
    domain: "ledger",
    method: "POST",
    path: "/api/v1/ledger/reconcile-account",
    title: "Execute Single-Account Ledger Verification",
    description:
      "Recalculates balance from genesis journal entries to ensure zero cache corruption.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify({ accountId: "acct_user_wallet_01" }, null, 2),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          computedBalance: 14850250.0,
          storedBalance: 14850250.0,
          drift: 0.0,
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "ledger-7",
    domain: "ledger",
    method: "POST",
    path: "/api/v1/ledger/adjustment",
    title: "Post Balanced Contra-Account Adjustment",
    description:
      "Posts administrative balancing journal against RECONCILIATION_ADJUSTMENTS.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      {
        targetAccountId: "acct_user_wallet_01",
        amount: 100.0,
        reason: "Paystack fee rounding fix",
      },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        message: "Adjustment journal posted with zero drift.",
      },
      null,
      2,
    ),
    status: 200,
  },

  // ==========================================
  // DOMAIN 6: KYC & IDENTITY TIERING (6)
  // ==========================================
  {
    id: "kyc-1",
    domain: "kyc",
    method: "POST",
    path: "/api/v1/kyc/bvn-verify",
    title: "Verify Bank Verification Number (BVN)",
    description:
      "Matches biometric 11-digit BVN against NIBSS records and upgrades to Tier 2.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      { bvn: "22345678901", dateOfBirth: "1995-04-12" },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          verified: true,
          matchedName: "MOBOLAJI BEEJAY",
          upgradedTier: "TIER_2",
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "kyc-2",
    domain: "kyc",
    method: "POST",
    path: "/api/v1/kyc/nin-verify",
    title: "Verify National Identity Number (NIN)",
    description: "Validates 11-digit NIN with NIMC verification gateway.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify({ nin: "12345678901" }, null, 2),
    responseBody: JSON.stringify(
      { success: true, statusCode: 200, data: { verified: true } },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "kyc-3",
    domain: "kyc",
    method: "POST",
    path: "/api/v1/kyc/upload-id",
    title: "Upload Government ID Document",
    description:
      "Encrypts and uploads passport or driver license to secure Cloudinary vault.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      { documentType: "PASSPORT", fileBase64: "data:image/jpeg;base64,..." },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: { documentId: "doc_991823", status: "PENDING_REVIEW" },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "kyc-4",
    domain: "kyc",
    method: "GET",
    path: "/api/v1/kyc/status",
    title: "Query Current KYC Tier Status",
    description:
      "Returns active tier level, completed verification steps, and pending requirements.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          currentTier: "TIER_1",
          bvnVerified: true,
          idDocVerified: false,
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "kyc-5",
    domain: "kyc",
    method: "GET",
    path: "/api/v1/kyc/tiers",
    title: "List All KYC Tier Configurations & Limits",
    description:
      "Details Tier 1, Tier 2, and Tier 3 balance caps and daily transfer allowances.",
    requiresAuth: false,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: [
          { tier: "TIER_1", maxBalance: 300000.0, maxDailyTransfer: 50000.0 },
          { tier: "TIER_2", maxBalance: 1000000.0, maxDailyTransfer: 200000.0 },
          {
            tier: "TIER_3",
            maxBalance: "UNLIMITED",
            maxDailyTransfer: 5000000.0,
          },
        ],
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "kyc-6",
    domain: "kyc",
    method: "POST",
    path: "/api/v1/kyc/address-proof",
    title: "Submit Proof of Residential Address",
    description:
      "Submits utility bill verification for Tier 3 unlimited transaction clearance.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      { address: "Victoria Island, Lagos", utilityBillUrl: "https://..." },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        message: "Address proof submitted for review.",
      },
      null,
      2,
    ),
    status: 200,
  },

  // ==========================================
  // DOMAIN 7: 3-LAYER RECONCILIATION (5)
  // ==========================================
  {
    id: "rec-1",
    domain: "reconciliation",
    method: "POST",
    path: "/api/v1/reconciliation/run",
    title: "Trigger Automated 3-Layer Settlement Audit",
    description:
      "Executes full reconciliation across Paystack records, internal journals, and zero-sum invariant.",
    requiresAuth: true,
    requiresIdempotency: true,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          runId: "rec_run_20260823_01",
          executionTimeMs: 142,
          layersChecked: {
            layer1_ledgerDrift: "PASSED (0 drift across 4,120 accounts)",
            layer2_paystackSettlement:
              "PASSED (Matched ₦ 48,200,000.00 in webhook events)",
            layer3_invariantVerification: "PASSED (ΣDebits - ΣCredits == 0)",
          },
          discrepanciesCount: 0,
        },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "rec-2",
    domain: "reconciliation",
    method: "GET",
    path: "/api/v1/reconciliation/history",
    title: "List Historic Reconciliation Runs",
    description:
      "Returns historical audit execution logs with detected drift reports.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: { runsCount: 365, allPassed: true },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "rec-3",
    domain: "reconciliation",
    method: "GET",
    path: "/api/v1/reconciliation/discrepancies",
    title: "List Unresolved Discrepancies",
    description:
      "Identifies dropped webhooks or timing mismatches requiring auto-adjustment.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      { success: true, statusCode: 200, data: { count: 0, items: [] } },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "rec-4",
    domain: "reconciliation",
    method: "POST",
    path: "/api/v1/reconciliation/resolve",
    title: "Resolve Settlement Discrepancy",
    description:
      "Applies automated contra-journal adjustment to rebalance ledger.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      { discrepancyId: "disc_9918", resolutionType: "AUTO_POST_ADJUSTMENT" },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      { success: true, statusCode: 200, message: "Discrepancy resolved." },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "rec-5",
    domain: "reconciliation",
    method: "GET",
    path: "/api/v1/reconciliation/summary",
    title: "Real-Time Financial Settlement Dashboard Data",
    description:
      "Aggregates 24-hour total inflows, outflows, gateway processing fees, and ledger drift metrics.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: {
          totalInflow: 48200000.0,
          totalOutflow: 33350000.0,
          netReserve: 14850000.0,
          driftPcnt: 0.0,
        },
      },
      null,
      2,
    ),
    status: 200,
  },

  // ==========================================
  // DOMAIN 8: WEBHOOK INGESTION (5)
  // ==========================================
  {
    id: "webhook-1",
    domain: "webhooks",
    method: "POST",
    path: "/api/v1/webhooks/paystack",
    title: "Ingest Paystack Payment Webhook",
    description:
      "Validates x-paystack-signature HMAC SHA512 header, enforces deduplication, and credits wallet atomically.",
    requiresAuth: false,
    requiresIdempotency: true,
    headers: { "x-paystack-signature": "a8b7c6d5e4f3..." },
    requestBody: JSON.stringify(
      {
        event: "charge.success",
        data: {
          reference: "ref_paystack_9921",
          amount: 5000000,
          customer: { email: "engineer@fintech.co" },
        },
      },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      { success: true, statusCode: 200, message: "Webhook processed." },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "webhook-2",
    domain: "webhooks",
    method: "GET",
    path: "/api/v1/webhooks/logs",
    title: "Query Ingested Webhook Audit Log",
    description:
      "Returns history of incoming gateway events with HTTP status and processing latency.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: { processedEvents: 8412, droppedEvents: 0 },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "webhook-3",
    domain: "webhooks",
    method: "POST",
    path: "/api/v1/webhooks/replay",
    title: "Replay Dropped Webhook Event",
    description:
      "Re-evaluates an event payload safely through the idempotent ingestion pipeline.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify({ webhookEventId: "evt_991823" }, null, 2),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        message: "Event replayed successfully.",
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "webhook-4",
    domain: "webhooks",
    method: "POST",
    path: "/api/v1/webhooks/resend-inbound",
    title: "Process Transactional Email Webhook",
    description:
      "Tracks delivery status, opens, and bounces from Resend mail provider.",
    requiresAuth: false,
    requiresIdempotency: true,
    responseBody: JSON.stringify(
      { success: true, statusCode: 200, message: "Email telemetry recorded." },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "webhook-5",
    domain: "webhooks",
    method: "GET",
    path: "/api/v1/webhooks/health",
    title: "Webhook Listener Uptime & Queue Backlog",
    description:
      "Monitors Debezium and Kafka ingestion queue depth and webhook listener health.",
    requiresAuth: false,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: { queueDepth: 0, healthy: true },
      },
      null,
      2,
    ),
    status: 200,
  },

  // ==========================================
  // DOMAIN 9: AUDIT TRAIL & COMPLIANCE (5)
  // ==========================================
  {
    id: "audit-1",
    domain: "audit",
    method: "GET",
    path: "/api/v1/audit/logs",
    title: "Query Security Audit Logs",
    description:
      "Returns tamper-evident log of administrative logins, role changes, and wallet freezes.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      { success: true, statusCode: 200, data: { items: [], total: 1042 } },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "audit-2",
    domain: "audit",
    method: "GET",
    path: "/api/v1/audit/sessions",
    title: "Inspect Active User Sessions Across Fleet",
    description:
      "Returns client IP addresses, user-agent fingerprints, and Redis token expirations.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: { activeSessions: 3, currentIp: "102.89.42.11" },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "audit-3",
    domain: "audit",
    method: "POST",
    path: "/api/v1/audit/export",
    title: "Export Compliance Audit Trail (CSV / JSON)",
    description:
      "Generates signed export for central bank compliance inspection.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      { dateFrom: "2026-01-01", dateTo: "2026-08-23" },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      { success: true, statusCode: 200, data: { downloadUrl: "https://..." } },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "audit-4",
    domain: "audit",
    method: "GET",
    path: "/api/v1/audit/risk-score",
    title: "Real-Time Transaction Risk Evaluation",
    description:
      "Calculates velocity risk score based on rapid outbound transfers and IP anomalies.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: { riskScore: 12, riskLevel: "LOW" },
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "audit-5",
    domain: "audit",
    method: "POST",
    path: "/api/v1/audit/flag-anomaly",
    title: "Manually Flag Suspicious Transaction",
    description:
      "Attaches compliance investigation flag and triggers secondary manager review.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      { transferId: "trf_88x99a22bb", reason: "High velocity outlier" },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        message: "Transaction flagged for compliance.",
      },
      null,
      2,
    ),
    status: 200,
  },

  // ==========================================
  // DOMAIN 10: BENEFICIARIES & DIRECTORY (4)
  // ==========================================
  {
    id: "ben-1",
    domain: "beneficiaries",
    method: "GET",
    path: "/api/v1/beneficiaries",
    title: "List Saved Beneficiaries",
    description:
      "Returns frequently transacted bank and internal wallet counterparties.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        success: true,
        statusCode: 200,
        data: [
          {
            id: "ben_01",
            name: "Adebayo Kudus",
            accountNumber: "9876543210",
            bankName: "Access Bank",
          },
          {
            id: "ben_02",
            name: "Chioma Okonkwo",
            accountNumber: "1234567890",
            bankName: "GTBank",
          },
        ],
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "ben-2",
    domain: "beneficiaries",
    method: "POST",
    path: "/api/v1/beneficiaries",
    title: "Save New Transfer Beneficiary",
    description:
      "Stores verified counterparty details for quick 1-click transfers.",
    requiresAuth: true,
    requiresIdempotency: true,
    requestBody: JSON.stringify(
      { name: "Adebayo Kudus", accountNumber: "9876543210", bankCode: "044" },
      null,
      2,
    ),
    responseBody: JSON.stringify(
      { success: true, statusCode: 201, message: "Beneficiary saved." },
      null,
      2,
    ),
    status: 201,
  },
  {
    id: "ben-3",
    domain: "beneficiaries",
    method: "DELETE",
    path: "/api/v1/beneficiaries/:id",
    title: "Remove Saved Beneficiary",
    description: "Deletes contact from frequent recipient directory.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      { success: true, statusCode: 200, message: "Beneficiary deleted." },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "ben-4",
    domain: "beneficiaries",
    method: "GET",
    path: "/api/v1/beneficiaries/frequent",
    title: "Get Top 5 Frequent Transfer Targets",
    description:
      "Computes velocity matrix to recommend recipient shortlist in transfer modal.",
    requiresAuth: true,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      { success: true, statusCode: 200, data: [] },
      null,
      2,
    ),
    status: 200,
  },

  // ==========================================
  // DOMAIN 11: HEALTH & OBSERVABILITY (3)
  // ==========================================
  {
    id: "sys-1",
    domain: "system",
    method: "GET",
    path: "/api/v1/health",
    title: "Kubernetes Liveness & Readiness Check",
    description:
      "Evaluates MongoDB replica set connection, Redis cluster ping, and Kafka broker connectivity.",
    requiresAuth: false,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        status: "ok",
        uptimeSeconds: 842109,
        services: {
          mongodb: "HEALTHY",
          redis: "HEALTHY",
          kafka: "HEALTHY",
          debezium: "CONNECTED",
        },
        timestamp: "2026-08-23T11:00:00Z",
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "sys-2",
    domain: "system",
    method: "GET",
    path: "/api/v1/metrics",
    title: "Prometheus Telemetry & Circuit Breaker Stats",
    description:
      "Streams Cockatiel circuit breaker state, HTTP request latency histograms, and outbox lag.",
    requiresAuth: false,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        circuitBreakers: { paystack: "CLOSED", resend: "CLOSED" },
        httpRequestsTotal: 1420942,
        p99LatencyMs: 18.4,
        kafkaLagEvents: 0,
      },
      null,
      2,
    ),
    status: 200,
  },
  {
    id: "sys-3",
    domain: "system",
    method: "GET",
    path: "/api/v1/version",
    title: "Engine Semantic Version & Build Hash",
    description:
      "Returns Git commit SHA, build timestamp, and active environment flags.",
    requiresAuth: false,
    requiresIdempotency: false,
    responseBody: JSON.stringify(
      {
        version: "2.4.0",
        gitCommit: "7a9c8f2",
        environment: "production",
        nodeVersion: "v20.12.2",
      },
      null,
      2,
    ),
    status: 200,
  },
];
