import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Server,
  Database,
  Workflow,
  Cpu,
  Layers,
  Inbox,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Terminal,
  Zap,
  Lock,
  Radio,
  Code2,
  Hash,
  Activity,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";

export interface FlowNode {
  id: string;
  step: number;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  color: string;
  badge: string;
  summary: string;
  latency: string;
  metric: string;
  payload: Record<string, any>;
  tech: string;
}

const FLOW_NODES: FlowNode[] = [
  {
    id: "api-ingress",
    step: 1,
    label: "1. API Ingress Gateway",
    sublabel: "TLS & Idempotency Interceptor",
    icon: Server,
    color: "indigo",
    badge: "STAGE 1: INGRESS",
    summary:
      "Accepts incoming transfer request. Verifies client signature, validates JWT token, and acquires sub-millisecond Redis idempotency mutex.",
    latency: "1.2ms",
    metric: "1,450 req/s",
    tech: "Express.js + Redis SET NX",
    payload: {
      action: "INITIATE_TRANSFER",
      clientRequestId: "req_88a71b2e-44c1",
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      senderWalletId: "w_991204_ngn",
      recipientWalletId: "w_448102_ngn",
      amount: 25000.0,
      currency: "NGN",
    },
  },
  {
    id: "mongo-acid",
    step: 2,
    label: "2. MongoDB ACID Outbox",
    sublabel: "Snapshot Multi-Doc Session",
    icon: Database,
    color: "emerald",
    badge: "STAGE 2: ATOMIC OUTBOX",
    summary:
      "Opens single multi-document ACID transaction. Atomically debits sender wallet, credits internal pending clearing, and inserts event record to outbox_events table.",
    latency: "3.8ms",
    metric: "12,000 w/s",
    tech: "MongoDB 7.0 (w: majority, j: true)",
    payload: {
      _id: "6674a1f89c02e11894b1a201",
      aggregateType: "WALLET_TRANSFER",
      aggregateId: "tr_8841920",
      eventType: "TRANSFER_INITIATED",
      partitionKey: "usr_991204",
      status: "STAGED",
      createdAt: "2026-08-24T09:45:00.104Z",
    },
  },
  {
    id: "debezium-cdc",
    step: 3,
    label: "3. Debezium CDC Stream",
    sublabel: "Non-Blocking Oplog Tailing",
    icon: Zap,
    color: "amber",
    badge: "STAGE 3: CHANGE CAPTURE",
    summary:
      "Tails MongoDB replica set oplog.rs continuously. Emits immutable change events to Kafka without taking any database table locks.",
    latency: "0.9ms",
    metric: "45,000 ops/s",
    tech: "Debezium MongoDB Connector 2.6",
    payload: {
      source: {
        version: "2.6.0.Final",
        connector: "mongodb",
        name: "zely_cluster",
        ts_ms: 1787564700120,
        snapshot: "false",
        db: "zely_core",
        collection: "outbox_events",
      },
      op: "c",
      ts_ms: 1787564700124,
    },
  },
  {
    id: "kafka-broker",
    step: 4,
    label: "4. Kafka Broker Cluster",
    sublabel: "Keyed Strict-Order Partitioning",
    icon: Workflow,
    color: "purple",
    badge: "STAGE 4: KAFKA MESH",
    summary:
      "Routes event to payments.transfer.initiated topic. Deterministic hash of sender wallet key ensures in-order delivery across 6 partitioned broker nodes.",
    latency: "1.4ms",
    metric: "98,000 msg/s",
    tech: "Apache Kafka 3.7 (KRaft Quorum)",
    payload: {
      topic: "zely.payments.transfer.initiated",
      partition: 2,
      offset: 1049281,
      key: "usr_991204",
      headers: {
        "x-trace-id": "trc_8841920_771b",
        "x-schema-version": "1.4.0",
        "x-origin-service": "zely-ingress-daemon",
      },
    },
  },
  {
    id: "ledger-consumer",
    step: 5,
    label: "5. Double-Entry Ledger Engine",
    sublabel: "Decoupled Event Consumer",
    icon: Layers,
    color: "blue",
    badge: "STAGE 5: SETTLEMENT",
    summary:
      "Consumes event with consumer group zely-settlement-engine. Validates zero-sum invariant (Debit = Credit) and writes immutable ledger entry with crypto hash chaining.",
    latency: "2.1ms",
    metric: "8,500 post/s",
    tech: "TypeScript Worker + TigerBeetle / Mongo Ledger",
    payload: {
      journalEntryId: "jrn_9920194",
      debitAccountId: "acc_usr_991204_available",
      creditAccountId: "acc_usr_448102_available",
      amountKobo: 2500000,
      balanceCheck: "VERIFIED_ZERO_SUM",
      ledgerHash:
        "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    },
  },
  {
    id: "dlq-circuit",
    step: 6,
    label: "6. Poison Pill DLQ & Alerts",
    sublabel: "Fault Isolation & Zero Data Loss",
    icon: ShieldAlert,
    color: "rose",
    badge: "STAGE 6: RESILIENCE",
    summary:
      "Catches unrecoverable schema faults or deserialization errors. Moves failing records to dead letter queue with automated notification and zero crash cascade.",
    latency: "0.4ms",
    metric: "0.00% drop",
    tech: "Kafka DLQ + PagerDuty / Sentry Hook",
    payload: {
      dlqTopic: "zely.payments.transfer.dlq",
      failureReason: "RETRY_BUDGET_EXCEEDED (3/3 attempts)",
      originalTopic: "zely.payments.transfer.initiated",
      quarantinedAt: "2026-08-24T09:45:02.901Z",
      requiresManualReview: true,
    },
  },
];

export const KafkaFlowVisualizer: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);

  const currentNode =
    FLOW_NODES.find((n) => n.step === activeStep) || FLOW_NODES[0];

  const handleCopy = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const getNodeBorder = (nodeStep: number) => {
    if (nodeStep === activeStep) {
      return "border-purple-500 bg-slate-950 text-white shadow-xl ring-2 ring-purple-500/30";
    }
    if (nodeStep < activeStep) {
      return "border-emerald-300 bg-emerald-50/40 text-slate-900";
    }
    return "border-slate-200 bg-[#FBFBF9] text-slate-800 hover:border-slate-300";
  };

  return (
    <div className="w-full space-y-6 font-mono">
      {/* Top Controller Header */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-800 text-[11px] font-bold mb-1.5">
              <Radio className="w-3.5 h-3.5 text-purple-600" />
              <span>EVENT-DRIVEN ARCHITECTURE PIPELINE</span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-950">
              Kafka Event Stream & Transactional Outbox Flow
            </h3>
            <p className="text-xs text-slate-600 font-sans mt-0.5">
              Select any stage below to inspect the data contract, oplog
              streaming specifications, and operational guarantees.
            </p>
          </div>

          {/* Direct Stage Selector Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {FLOW_NODES.map((node) => (
              <button
                key={node.id}
                onClick={() => setActiveStep(node.step)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  activeStep === node.step
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                }`}
              >
                Stage {node.step}
              </button>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STEP-BY-STEP DIAGRAM GRID */}
        {/* ========================================================================= */}
        <div className="pt-6 relative">
          {/* Progress Indicator Bar */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-6 relative">
            <div
              className="h-full bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-500 transition-all duration-300"
              style={{ width: `${(activeStep / FLOW_NODES.length) * 100}%` }}
            />
          </div>

          {/* 6 Modern Node Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
            {FLOW_NODES.map((node) => {
              const Icon = node.icon;
              const isCurrent = node.step === activeStep;
              const isPast = node.step < activeStep;

              return (
                <button
                  key={node.id}
                  onClick={() => setActiveStep(node.step)}
                  className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative flex flex-col justify-between ${getNodeBorder(node.step)}`}
                >
                  {/* Top Status Header */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-2 rounded-xl ${
                            isCurrent
                              ? "bg-purple-900 text-purple-300 border border-purple-700"
                              : isPast
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span
                          className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md ${
                            isCurrent
                              ? "bg-purple-900/80 text-purple-200 border border-purple-700"
                              : isPast
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {node.badge}
                        </span>
                      </div>

                      {isPast && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      {isCurrent && (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                        </span>
                      )}
                    </div>

                    <h4
                      className={`text-sm font-bold mt-1 ${isCurrent ? "text-white" : "text-slate-900"}`}
                    >
                      {node.label}
                    </h4>
                    <p
                      className={`text-xs mt-0.5 ${isCurrent ? "text-purple-300" : "text-slate-500"}`}
                    >
                      {node.sublabel}
                    </p>

                    <p
                      className={`text-xs mt-3 leading-relaxed font-sans line-clamp-2 ${isCurrent ? "text-slate-300" : "text-slate-600"}`}
                    >
                      {node.summary}
                    </p>
                  </div>

                  {/* Latency / Throughput Footer */}
                  <div
                    className={`mt-4 pt-3 border-t flex items-center justify-between text-[11px] ${
                      isCurrent
                        ? "border-slate-800 text-slate-400"
                        : "border-slate-200/80 text-slate-500"
                    }`}
                  >
                    <span className="flex items-center gap-1 font-mono">
                      <span>Latency:</span>
                      <strong
                        className={
                          isCurrent ? "text-emerald-400" : "text-emerald-700"
                        }
                      >
                        {node.latency}
                      </strong>
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <span>Rate:</span>
                      <strong
                        className={
                          isCurrent ? "text-purple-300" : "text-purple-700"
                        }
                      >
                        {node.metric}
                      </strong>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DEEP INSPECTOR & LIVE DATA CONTRACT FOR ACTIVE STAGE */}
      {/* ========================================================================= */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentNode.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Left Column: Stage Architecture Detail */}
          <div className="lg:col-span-6 bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
                    <currentNode.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-purple-700 font-bold uppercase tracking-wider block">
                      Stage {currentNode.step} of 6 Detailed Specification
                    </span>
                    <h3 className="text-base font-extrabold text-slate-950">
                      {currentNode.label}
                    </h3>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                  {currentNode.tech}
                </span>
              </div>

              <div className="space-y-4 text-xs font-sans text-slate-700">
                <div>
                  <h4 className="font-mono font-bold text-slate-900 uppercase text-[11px] mb-1">
                    Operational Mechanism
                  </h4>
                  <p className="leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-slate-800 text-[11px]">
                    {currentNode.summary}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 font-mono">
                    <span className="text-[10px] text-purple-700 font-bold block mb-0.5">
                      Throughput Capacity
                    </span>
                    <span className="text-sm font-extrabold text-purple-950">
                      {currentNode.metric}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 font-mono">
                    <span className="text-[10px] text-emerald-700 font-bold block mb-0.5">
                      Processing Overhead
                    </span>
                    <span className="text-sm font-extrabold text-emerald-950">
                      {currentNode.latency}
                    </span>
                  </div>
                </div>

                {/* Subsystem specific highlights */}
                {currentNode.step === 1 && (
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 font-mono text-[11px] space-y-1.5">
                    <div className="text-purple-400 font-bold">
                      Idempotency Invariant:
                    </div>
                    <p className="text-slate-400">
                      Redis key{" "}
                      <code className="text-amber-300">
                        lock:transfer:{`{idempotencyKey}`}
                      </code>{" "}
                      is acquired with 120s TTL prior to database transaction
                      dispatch.
                    </p>
                  </div>
                )}

                {currentNode.step === 2 && (
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 font-mono text-[11px] space-y-1.5">
                    <div className="text-emerald-400 font-bold">
                      ACID Guarantee:
                    </div>
                    <p className="text-slate-400">
                      Multi-document transaction committed with{" "}
                      <code className="text-emerald-300">{`{ w: "majority", j: true }`}</code>{" "}
                      guarantees zero phantom debits without publishing orphaned
                      events.
                    </p>
                  </div>
                )}

                {currentNode.step === 3 && (
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 font-mono text-[11px] space-y-1.5">
                    <div className="text-amber-400 font-bold">
                      Zero-Lock CDC Streaming:
                    </div>
                    <p className="text-slate-400">
                      Debezium connector streams raw MongoDB oplog changes
                      asynchronously, eliminating polling queries and table lock
                      contention.
                    </p>
                  </div>
                )}

                {currentNode.step === 4 && (
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 font-mono text-[11px] space-y-1.5">
                    <div className="text-purple-400 font-bold">
                      Partitioning Guarantee:
                    </div>
                    <p className="text-slate-400">
                      Keyed hashing on{" "}
                      <code className="text-purple-300">senderWalletId</code>{" "}
                      ensures all transactions for the same account arrive in
                      strict chronological sequence.
                    </p>
                  </div>
                )}

                {currentNode.step === 5 && (
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 font-mono text-[11px] space-y-1.5">
                    <div className="text-blue-400 font-bold">
                      Double-Entry Audit Invariant:
                    </div>
                    <p className="text-slate-400">
                      Every ledger journal verifies{" "}
                      <code className="text-blue-300">
                        Σ Debits - Σ Credits = 0
                      </code>{" "}
                      with SHA-256 block hashing prior to committing.
                    </p>
                  </div>
                )}

                {currentNode.step === 6 && (
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 font-mono text-[11px] space-y-1.5">
                    <div className="text-rose-400 font-bold">
                      Dead-Letter Circuit Breaker:
                    </div>
                    <p className="text-slate-400">
                      After 3 failed retries with exponential jitter, poison
                      pills are safely quarantined to DLQ to prevent blocking
                      consumer partitions.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-mono">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Deterministic Zero Data Loss Guarantee</span>
              </span>
              <span className="text-slate-400 font-bold">
                STAGE {currentNode.step} OF 6
              </span>
            </div>
          </div>

          {/* Right Column: Live Event Schema / Payload Inspector */}
          <div className="lg:col-span-6 bg-slate-950 border border-slate-800 rounded-2xl p-6 text-white shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-purple-400" />
                  <span className="font-bold text-xs text-slate-200 uppercase tracking-wider">
                    Live Wire Payload & Event Contract
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                    JSON Schema v1.4
                  </span>
                  <button
                    onClick={() => handleCopy(currentNode.payload)}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    title="Copy payload to clipboard"
                  >
                    {copiedPayload ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[11px] text-emerald-400 font-bold">
                          Copied
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[11px]">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Payload Viewer */}
              <div className="rounded-xl bg-slate-900/90 border border-slate-800/80 p-4 font-mono text-xs overflow-x-auto">
                <pre className="text-emerald-300 leading-relaxed">
                  {JSON.stringify(currentNode.payload, null, 2)}
                </pre>
              </div>
            </div>

            {/* Subsystem Security Badge */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-purple-400" />
                <span>HMAC Signed & End-to-End Encrypted</span>
              </span>
              <span className="font-bold text-slate-500">CRC32 VALIDATED</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default KafkaFlowVisualizer;
