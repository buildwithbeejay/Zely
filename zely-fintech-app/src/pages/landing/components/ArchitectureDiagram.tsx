import React, { useState, useMemo } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Server,
  Database,
  Cpu,
  Zap,
  ShieldCheck,
  Send,
  Boxes,
  Workflow,
  Sparkles,
  Lock,
  Mail,
  KeyRound,
  Layers,
  Activity,
  AlertCircle,
  Clock,
  Check,
  ChevronRight,
} from "lucide-react";
import { ThemeConfig } from "../themeConfig";

export interface PipelineFlow {
  id: string;
  name: string;
  badge: string;
  description: string;
  adrRef: string;
  activeNodes: string[];
  steps: {
    stepNumber: number;
    nodeId: string;
    title: string;
    action: string;
    latency: string;
    guarantee: string;
    protocol: string;
  }[];
}

export const PIPELINE_FLOWS: PipelineFlow[] = [
  {
    id: "p2p-transfer",
    name: "P2P Transfer & Outbox CDC",
    badge: "ADR-001 · ADR-002",
    description:
      "Atomic dual-write prevention with MongoDB multi-document transactions and Debezium Oplog streaming to Kafka.",
    adrRef: "ADR-001, ADR-002, ADR-009, ADR-011",
    activeNodes: [
      "client",
      "gateway",
      "core",
      "redis",
      "mongo",
      "debezium",
      "kafka",
      "consumers",
    ],
    steps: [
      {
        stepNumber: 1,
        nodeId: "client",
        title: "1. Client Mutation Request",
        action:
          "Client generates UUIDv4 Idempotency-Key header & signs payload with JWT Bearer token.",
        latency: "0.4ms",
        guarantee: "Client-side Uniqueness",
        protocol: "HTTP/2 + TLS 1.3",
      },
      {
        stepNumber: 2,
        nodeId: "gateway",
        title: "2. Token Bucket & Idempotency Guard",
        action:
          "Rate limiter verifies token bucket (100 req/min). Gateway checks Redis fast-path for duplicate in-flight keys.",
        latency: "1.2ms",
        guarantee: "Rate Capped & Anti-Spam",
        protocol: "Redis NX Lock",
      },
      {
        stepNumber: 3,
        nodeId: "core",
        title: "3. ACID Multi-Document Session",
        action:
          "Express service opens MongoClient session. Validates balance sufficiency and sets debit/credit state.",
        latency: "3.1ms",
        guarantee: "Snapshot Read Isolation",
        protocol: "Node.js Cluster",
      },
      {
        stepNumber: 4,
        nodeId: "mongo",
        title: "4. Atomic Majority Commit",
        action:
          "Atomically writes Wallet balance mutation + Transactional Outbox record within session (w: majority, j: true).",
        latency: "5.8ms",
        guarantee: "Quorum Durability (w: majority)",
        protocol: "WiredTiger Journal",
      },
      {
        stepNumber: 5,
        nodeId: "debezium",
        title: "5. Non-Blocking Oplog CDC",
        action:
          "Debezium tails MongoDB local.oplog.rs replica stream without executing any polling table scans.",
        latency: "2.1ms",
        guarantee: "Zero Polling DB Lock Contention",
        protocol: "MongoDB Oplog Tap",
      },
      {
        stepNumber: 6,
        nodeId: "kafka",
        title: "6. Partitioned Kafka Topic",
        action:
          "Event envelope published to `zely.transfers.v1` partitioned by sender account ID for strict sequential ordering.",
        latency: "1.8ms",
        guarantee: "At-Least-Once Delivery",
        protocol: "Kafka TCP / SASL",
      },
      {
        stepNumber: 7,
        nodeId: "consumers",
        title: "7. Two-Phase Consumer Execution",
        action:
          "Consumer reserves Redis lock (Phase 1), inserts to unique `processed_events` in DB (Phase 2), and executes settlement.",
        latency: "4.2ms",
        guarantee: "Strict Exactly-Once Processing",
        protocol: "Idempotent Consumer",
      },
    ],
  },
  {
    id: "double-entry",
    name: "Double-Entry Ledger Audit",
    badge: "ADR-010 · ADR-006",
    description:
      "Immutable append-only journal entries guaranteeing mathematical zero-drift balance parity across accounts.",
    adrRef: "ADR-010, ADR-006",
    activeNodes: ["core", "mongo", "debezium", "kafka", "consumers"],
    steps: [
      {
        stepNumber: 1,
        nodeId: "core",
        title: "1. Balanced Journal Formulation",
        action:
          "Formulates paired DEBIT and CREDIT lines. Runs invariant check: ∑(Debits) - ∑(Credits) == 0.00.",
        latency: "0.6ms",
        guarantee: "Zero-Sum Invariant Asserted",
        protocol: "In-Memory Engine",
      },
      {
        stepNumber: 2,
        nodeId: "mongo",
        title: "2. Immutable Append-Only Write",
        action:
          "Appends journal document to ledger collection. Update/Delete database permissions permanently revoked.",
        latency: "4.5ms",
        guarantee: "Immutable Cryptographic Chain",
        protocol: "MongoDB ACID",
      },
      {
        stepNumber: 3,
        nodeId: "debezium",
        title: "3. Ledger Event Stream CDC",
        action:
          "Extracts immutable ledger creation event from oplog and emits to dedicated `zely.ledger.v1` topic.",
        latency: "2.0ms",
        guarantee: "Real-time Event Stream",
        protocol: "Debezium CDC",
      },
      {
        stepNumber: 4,
        nodeId: "kafka",
        title: "4. Topic Isolation & Compaction",
        action:
          "Maintains compacted ledger stream for zero-drift projection rebuilds across auxiliary microservices.",
        latency: "1.5ms",
        guarantee: "Compacted Log Retention",
        protocol: "Kafka Partition Log",
      },
      {
        stepNumber: 5,
        nodeId: "consumers",
        title: "5. Continuous Invariant Verifier",
        action:
          "Background auditor calculates running sum across all accounts to verify global drift ≡ 0.00.",
        latency: "6.0ms",
        guarantee: "Global Zero-Drift Certified",
        protocol: "Auditor Worker",
      },
    ],
  },
  {
    id: "vault-allocation",
    name: "Savings Vault Lock & Release",
    badge: "ADR-009 · ADR-011",
    description:
      "Sub-account vault partitioning with locking rules, interest accrual, and safe maturity release.",
    adrRef: "ADR-009, ADR-011",
    activeNodes: ["client", "gateway", "core", "redis", "mongo"],
    steps: [
      {
        stepNumber: 1,
        nodeId: "client",
        title: "1. Vault Lock Allocation",
        action:
          "User initiates vault lock request with target maturity date and allocation amount.",
        latency: "0.5ms",
        guarantee: "Idempotency-Key Header",
        protocol: "HTTPS Client",
      },
      {
        stepNumber: 2,
        nodeId: "gateway",
        title: "2. Signature & Rule Verification",
        action:
          "Gateway validates authenticated session and verifies minimum lock tenure constraints (30–365 days).",
        latency: "1.1ms",
        guarantee: "Rule Policy Passed",
        protocol: "Express Guard",
      },
      {
        stepNumber: 3,
        nodeId: "redis",
        title: "3. Distributed Account Mutex",
        action:
          "Acquires 5-second Redlock mutex on user wallet ID to prevent simultaneous vault allocation race conditions.",
        latency: "0.8ms",
        guarantee: "Exclusive Lock Acquired",
        protocol: "Redlock v2",
      },
      {
        stepNumber: 4,
        nodeId: "core",
        title: "4. Allocation Balance Transfer",
        action:
          "Deducts primary balance and increments vault target record in a single multi-document transaction.",
        latency: "2.9ms",
        guarantee: "Atomic Sub-Account Transfer",
        protocol: "Core Service",
      },
      {
        stepNumber: 5,
        nodeId: "mongo",
        title: "5. Vault Ledger Journal",
        action:
          "Commits state with snapshot read concern. Vault status transitions to LOCKED until maturity timestamp.",
        latency: "4.8ms",
        guarantee: "Time-Lock Enforced",
        protocol: "MongoDB Majority",
      },
    ],
  },
  {
    id: "notifications",
    name: "Decoupled Email & Webhooks",
    badge: "ADR-013 · ADR-004",
    description:
      "Asynchronous notification dispatch via dedicated EmailOutbox, insulating the core financial pipeline from SMTP delays.",
    adrRef: "ADR-013, ADR-004",
    activeNodes: ["debezium", "kafka", "consumers"],
    steps: [
      {
        stepNumber: 1,
        nodeId: "debezium",
        title: "1. Decoupled Email Outbox Tap",
        action:
          "Debezium reads new entries written into the independent `email_outbox` MongoDB collection.",
        latency: "1.9ms",
        guarantee: "Financial Pipeline Isolation",
        protocol: "Oplog Event Stream",
      },
      {
        stepNumber: 2,
        nodeId: "kafka",
        title: "2. Dedicated Notification Topic",
        action:
          "Dispatches job to `zely.notifications.v1`. Completely separate from `zely.transfers.v1` to prevent head-of-line blocking.",
        latency: "1.2ms",
        guarantee: "Zero Head-of-Line Contention",
        protocol: "Kafka Domain Topic",
      },
      {
        stepNumber: 3,
        nodeId: "consumers",
        title: "3. Cockatiel Circuit Breaker Dispatch",
        action:
          "Worker executes email delivery via Resend/SendGrid wrapped in a Bulkhead(25) and Circuit Breaker policy.",
        latency: "140ms (async)",
        guarantee: "Fault Isolated & Exponential Backoff",
        protocol: "Cockatiel + Resend",
      },
    ],
  },
  {
    id: "auth-security",
    name: "Auth, 2FA OTP & Token Rotation",
    badge: "ADR-007 · ADR-008 · ADR-012",
    description:
      "Argon2id credential verification, atomic Redis GETDEL OTP validation, and rotating JWT token family protection.",
    adrRef: "ADR-007, ADR-008, ADR-012",
    activeNodes: ["client", "gateway", "core", "redis", "mongo"],
    steps: [
      {
        stepNumber: 1,
        nodeId: "client",
        title: "1. Credential Submission",
        action:
          "Submits user email and password or 6-digit 2FA token over TLS 1.3 encrypted channel.",
        latency: "0.4ms",
        guarantee: "TLS 1.3 Transport Encryption",
        protocol: "HTTPS POST",
      },
      {
        stepNumber: 2,
        nodeId: "core",
        title: "2. Argon2id Memory-Hard Verification",
        action:
          "Computes Argon2id verification with 64MB RAM memory cost, defending against GPU brute-force attacks.",
        latency: "45ms",
        guarantee: "64MB Memory Hardness",
        protocol: "Argon2id Engine",
      },
      {
        stepNumber: 3,
        nodeId: "redis",
        title: "3. Atomic GETDEL 2FA OTP Invalidation",
        action:
          "Verifies 6-digit code and deletes key in single atomic command, preventing replay attacks.",
        latency: "0.7ms",
        guarantee: "Single-Use Atomic Destruction",
        protocol: "Redis GETDEL",
      },
      {
        stepNumber: 4,
        nodeId: "mongo",
        title: "4. Token Family Rotation",
        action:
          "Issues 15m JWT access token and saves 7d rotating refresh token. Revokes family if reuse detected.",
        latency: "3.8ms",
        guarantee: "Automatic Breach Detection",
        protocol: "HttpOnly Strict Cookie",
      },
    ],
  },
];

export const ArchitectureDiagram: React.FC<{ theme: ThemeConfig }> = ({
  theme,
}) => {
  const [selectedFlowId, setSelectedFlowId] = useState<string>("p2p-transfer");
  const [activeNode, setActiveNode] = useState<string | null>("mongo");
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

  const currentFlow = useMemo(() => {
    return (
      PIPELINE_FLOWS.find((f) => f.id === selectedFlowId) || PIPELINE_FLOWS[0]
    );
  }, [selectedFlowId]);

  const nodes = [
    {
      id: "client",
      title: "Client Apps & SDKs",
      badge: "HTTP/2 + TLS 1.3",
      desc: "Generates client-side UUIDv4 Idempotency-Key headers for every mutating request.",
      icon: Send,
      role: "Originating client initiating cryptographic payloads.",
      sla: "< 1ms local latency",
      adr: "ADR-011",
      color: "border-purple-200 bg-purple-50 text-[#7C3AED]",
    },
    {
      id: "gateway",
      title: "API Gateway & Security",
      badge: "Rate Limiter & Guard",
      desc: "Enforces token-bucket rate limits, validates JWTs, and handles early idempotency reservations.",
      icon: ShieldCheck,
      role: "Frontline ingress proxy with Cockatiel resilience policies.",
      sla: "< 2ms processing SLA",
      adr: "ADR-005, ADR-011",
      color: "border-indigo-200 bg-indigo-50 text-indigo-700",
    },
    {
      id: "core",
      title: "Node.js Core Microservices",
      badge: "TypeScript + Express",
      desc: "Domain engines for Wallets, Double-Entry Ledger, Savings Vaults, and Auth.",
      icon: Server,
      role: "Business rules execution and multi-document transaction orchestration.",
      sla: "< 15ms execution budget",
      adr: "ADR-003, ADR-007",
      color:
        "border-purple-300 bg-purple-50 text-[#7C3AED] ring-1 ring-purple-400/30",
    },
    {
      id: "redis",
      title: "Redis 7 Cluster",
      badge: "Sub-millisecond Cache",
      desc: "Session fast-path, distributed Redlock locks, and 120s idempotency reservation state.",
      icon: Zap,
      role: "In-memory mutexes, OTP single-use storage, and token rate counters.",
      sla: "< 1ms network round-trip",
      adr: "ADR-002, ADR-008",
      color: "border-rose-200 bg-rose-50 text-rose-700",
    },
    {
      id: "mongo",
      title: "MongoDB Replica Set",
      badge: "ACID Transactions",
      desc: "Authoritative session store, wallet balances, and transactional Outbox documents.",
      icon: Database,
      role: "Quorum durability with w: majority, write-ahead journal, and oplog.",
      sla: "< 8ms quorum write",
      adr: "ADR-001, ADR-009, ADR-010",
      color: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      id: "debezium",
      title: "Debezium CDC Engine",
      badge: "Change Data Capture",
      desc: "Tails MongoDB Oplog directly, producing reliable Kafka events with zero polling overhead.",
      icon: Workflow,
      role: "Non-invasive log tailing engine without database query lock contention.",
      sla: "< 5ms oplog tap latency",
      adr: "ADR-001",
      color: "border-amber-200 bg-amber-50 text-amber-700",
    },
    {
      id: "kafka",
      title: "Apache Kafka Cluster",
      badge: "Event Streaming Fabric",
      desc: "Distributed partitioned event log (transfers, ledger entries, notifications).",
      icon: Cpu,
      role: "Strictly partitioned domain event topics with log compaction.",
      sla: "< 3ms pub/sub SLA",
      adr: "ADR-003, ADR-006",
      color: "border-sky-200 bg-sky-50 text-sky-700",
    },
    {
      id: "consumers",
      title: "Idempotent Consumer Fleet",
      badge: "Worker Nodes",
      desc: "Processes webhooks, sends transactional emails via Resend, and triggers settlement jobs.",
      icon: Boxes,
      role: "Two-phase idempotent worker pods with Cockatiel circuit breakers.",
      sla: "Sub-second async drain",
      adr: "ADR-002, ADR-004, ADR-013",
      color: "border-teal-200 bg-teal-50 text-teal-700",
    },
  ];

  const activeNodeData = nodes.find((n) => n.id === activeNode);

  const handleStepClick = (stepIndex: number, nodeId: string) => {
    setActiveStepIndex(stepIndex);
    setActiveNode(nodeId);
  };

  const handleNodeClick = (nodeId: string) => {
    setActiveNode(activeNode === nodeId ? null : nodeId);
    const stepIdx = currentFlow.steps.findIndex((s) => s.nodeId === nodeId);
    if (stepIdx !== -1) {
      setActiveStepIndex(stepIdx);
    }
  };

  return (
    <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-8 font-sans space-y-6">
      {/* Top Header with Interactive Domain Flow Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#E5E7EB]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <Workflow className="w-4 h-4" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-950">
              Distributed Transaction Pipeline Architecture
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 font-mono">
            Select a domain pipeline below to inspect its unique event flow
            sequence, node telemetry, and resilience invariants.
          </p>
        </div>

        {/* Global Pipeline Health Status */}
        <div className="flex items-center gap-2 self-start lg:self-auto font-mono text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            ZERO DUAL-WRITE HAZARDS
          </span>
        </div>
      </div>

      {/* Domain Pipeline Flow Selector Tabs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-500 uppercase tracking-wider px-1">
          <span>Select Transaction Pipeline Domain:</span>
          <span className="text-purple-700">{currentFlow.badge}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 font-mono">
          {PIPELINE_FLOWS.map((flow) => {
            const isSelected = flow.id === selectedFlowId;
            return (
              <button
                key={flow.id}
                onClick={() => {
                  setSelectedFlowId(flow.id);
                  setActiveStepIndex(null);
                }}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "bg-slate-950 text-white border-slate-950"
                    : "bg-[#FBFBF9] hover:bg-slate-100 text-slate-700 border-[#E5E7EB]"
                }`}
              >
                <div className="text-xs font-bold truncate mb-1">
                  {flow.name}
                </div>
                <div
                  className={`text-[10px] font-semibold truncate ${isSelected ? "text-purple-300" : "text-slate-500"}`}
                >
                  {flow.badge}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 8-NODE DISTRIBUTED TOPOLOGY GRID */}
      {/* ========================================================================= */}
      <div className="space-y-2">
        <div className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center justify-between">
          <span>Topology Nodes (Click to Inspect Architecture Specs):</span>
          <span className="text-[11px] text-slate-400 font-normal">
            Active in current flow: {currentFlow.activeNodes.length}/8 nodes
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {nodes.map((node) => {
            const Icon = node.icon;
            const isSelected = activeNode === node.id;
            const isActiveInFlow = currentFlow.activeNodes.includes(node.id);

            return (
              <div
                key={node.id}
                onClick={() => handleNodeClick(node.id)}
                className={`p-4 rounded-xl border transition-colors cursor-pointer relative font-mono ${
                  isSelected
                    ? "border-purple-600 bg-purple-50"
                    : isActiveInFlow
                      ? "border-slate-300 bg-[#FBFBF9] hover:bg-white hover:border-slate-400"
                      : "border-slate-200 bg-slate-50/50 opacity-60 hover:opacity-100"
                }`}
              >
                {/* Node Status Indicator Pill */}
                <div className="flex items-start justify-between mb-2.5">
                  <div className={`p-2 rounded-lg border ${node.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-1">
                    {isActiveInFlow && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
                        title="Active in selected flow"
                      />
                    )}
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white border border-[#E5E7EB] text-slate-700">
                      {node.badge}
                    </span>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-slate-950 mb-1">
                  {node.title}
                </h4>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                  {node.desc}
                </p>

                <div className="mt-3 pt-2.5 border-t border-[#E5E7EB] flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>SLA: {node.sla}</span>
                  <span className="font-bold text-purple-700">{node.adr}</span>
                </div>

                {isSelected && (
                  <div className="mt-2 text-[11px] font-mono text-purple-800 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" />
                    <span>Inspecting Node Telemetry</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DYNAMIC TRANSACTIONAL EVENT FLOW SEQUENCE (SPECIFIC TO SELECTED PIPELINE) */}
      {/* ========================================================================= */}
      <div className="bg-[#FBFBF9] border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 space-y-4 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E5E7EB]">
          <div>
            <div className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
              <Workflow className="w-4 h-4 text-purple-700" />
              <span>
                Transactional Event Flow Sequence — {currentFlow.name}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Click any step below to trace its exact microservice execution
              guarantee and latency impact.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-md">
              {currentFlow.steps.length} Sequenced Phases
            </span>
          </div>
        </div>

        {/* Step-by-Step Sequence Flow Grid */}
        <div className="space-y-2.5">
          {currentFlow.steps.map((step, idx) => {
            const isStepActive = activeStepIndex === idx;
            const isTargetNode = activeNode === step.nodeId;

            return (
              <div
                key={idx}
                onClick={() => handleStepClick(idx, step.nodeId)}
                className={`p-3.5 sm:p-4 rounded-xl border transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  isStepActive || isTargetNode
                    ? "bg-white border-purple-600"
                    : "bg-white hover:bg-slate-50 border-[#E5E7EB]"
                }`}
              >
                {/* Step Number + Title + Action */}
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isStepActive || isTargetNode
                        ? "bg-purple-600 text-white"
                        : "bg-slate-900 text-white"
                    }`}
                  >
                    {step.stepNumber}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-950">
                        {step.title}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                        {step.protocol}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {step.action}
                    </p>
                  </div>
                </div>

                {/* Latency + Guarantee Badges */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end md:self-auto text-[11px]">
                  <div className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{step.latency}</span>
                  </div>

                  <div className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="truncate max-w-[140px] sm:max-w-none">
                      {step.guarantee}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Pipeline Summary Bar */}
        <div className="pt-3 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between text-xs text-slate-600 font-mono gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              End-to-End Latency Target: <strong>&lt; 25ms</strong> for 99th
              percentile commits
            </span>
          </div>
          <span className="font-bold text-purple-700">
            Deterministic Recovery: 100% Replay-Safe
          </span>
        </div>
      </div>
    </div>
  );
};
