import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Server,
  Database,
  Workflow,
  Layers,
  Lock,
  ShieldCheck,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  FileCode,
  Terminal,
  Scale,
  Hash,
  GitBranch,
  Cpu,
  ShieldAlert,
  Zap,
  ArrowRight,
  Coins,
  Activity,
  Eye,
  Sparkles,
  Inbox,
  Radio,
  ExternalLink,
  ChevronRight,
  Globe,
  Sliders,
  Home,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import KafkaFlowVisualizer from "../../components/architecture/KafkaFlowVisualizer";

interface TabItem {
  id: string;
  name: string;
  shortName: string;
  icon: React.ElementType;
  badge: string;
}

const TABS: TabItem[] = [
  {
    id: "overview",
    name: "Infrastructure Topology",
    shortName: "Topology",
    icon: Layers,
    badge: "Full Mesh",
  },
  {
    id: "kafka",
    name: "Kafka Event Stream & Outbox",
    shortName: "Kafka & CDC",
    icon: Workflow,
    badge: "ADR-002",
  },
  {
    id: "mongodb",
    name: "MongoDB ACID Transactions",
    shortName: "Mongo ACID",
    icon: Database,
    badge: "ADR-001",
  },
  {
    id: "ledger",
    name: "Append-Only Double-Entry Ledger",
    shortName: "Ledger Engine",
    icon: Scale,
    badge: "ADR-004",
  },
  {
    id: "idempotency",
    name: "Distributed Locking & Idempotency",
    shortName: "Locking & Idempotency",
    icon: Lock,
    badge: "ADR-003",
  },
  {
    id: "reconciliation",
    name: "3-Layer Reconciliation Engine",
    shortName: "3-Layer Recon",
    icon: ShieldCheck,
    badge: "ADR-008",
  },
];

interface InfraNode {
  id: string;
  name: string;
  category: string;
  icon: React.ElementType;
  color: string;
  status: string;
  role: string;
  guarantee: string;
  throughput: string;
  latency: string;
}

const INFRASTRUCTURE_NODES: InfraNode[] = [
  {
    id: "api-gateway",
    name: "Edge API Ingress & Auth",
    category: "API Gateway",
    icon: Globe,
    color: "indigo",
    status: "SYS_OK · 99.99%",
    role: "TLS termination, JWT validation, rate limiting, and request signature verification.",
    guarantee: "Sub-millisecond ingress with automated DDoS mitigation",
    throughput: "3,500 req/s",
    latency: "0.8ms",
  },
  {
    id: "redis-lock",
    name: "Distributed Idempotency Layer",
    category: "Caching & Mutex",
    icon: Lock,
    color: "amber",
    status: "ACTIVE · 0.00ms lag",
    role: "Redis distributed locks with SET NX EX 120 and database compound unique indexes.",
    guarantee: "Exact-once execution across high-concurrency payment retries",
    throughput: "45,000 ops/s",
    latency: "1.2ms",
  },
  {
    id: "mongodb-cluster",
    name: "MongoDB Multi-Doc ACID Cluster",
    category: "Transactional Store",
    icon: Database,
    color: "emerald",
    status: "HEALTHY · Quorum (3/3)",
    role: "Executes wallet balance updates and outbox insertions inside a single transaction.",
    guarantee: "Snapshot isolation with majority write concern replication",
    throughput: "14,000 writes/s",
    latency: "3.4ms",
  },
  {
    id: "debezium-engine",
    name: "Debezium CDC Stream Engine",
    category: "Change Data Capture",
    icon: Zap,
    color: "purple",
    status: "STREAMING · 0 lag",
    role: "Non-blocking tailing of MongoDB replica set oplog.rs with instant Kafka dispatch.",
    guarantee:
      "Eliminates dual-write inconsistencies between database and message broker",
    throughput: "50,000 evt/s",
    latency: "2.1ms",
  },
  {
    id: "kafka-mesh",
    name: "Apache Kafka Broker Mesh",
    category: "Event Backbone",
    icon: Cpu,
    color: "blue",
    status: "HEALTHY · KRaft ISR=3",
    role: "Deterministic Murmur2 keyed partitioning with in-sync replication factor of 3.",
    guarantee:
      "Strict sequential ordering per wallet with zero out-of-order mutations",
    throughput: "220,000 msgs/s",
    latency: "1.5ms",
  },
  {
    id: "ledger-engine",
    name: "Append-Only Double-Entry Ledger",
    category: "Core Accounting",
    icon: Scale,
    color: "purple",
    status: "BALANCED · 0.00 DRIFT",
    role: "Immutable journal recording debit/credit pairs with cryptographic SHA-256 block hashes.",
    guarantee: "Zero-sum balance invariant: ∑(Debits) - ∑(Credits) = 0",
    throughput: "12,500 posts/s",
    latency: "4.2ms",
  },
  {
    id: "recon-engine",
    name: "3-Layer Reconciliation Engine",
    category: "Continuous Audit",
    icon: ShieldCheck,
    color: "emerald",
    status: "VERIFIED · 0 Mismatches",
    role: "Clears gateway settlement batches, checks wallet ledger sums, and verifies locked vaults.",
    guarantee:
      "Continuous automated discrepancy detection within 60-second clearing windows",
    throughput: "Full Ledger Scan",
    latency: "Periodic 60s",
  },
  {
    id: "dlq-circuit",
    name: "Dead-Letter Queue (DLQ) & Circuit",
    category: "Fault Isolation",
    icon: ShieldAlert,
    color: "rose",
    status: "ARMED · 0 Poison Pills",
    role: "Quarantines unparseable or rejected payloads after 3 exponential backoff attempts.",
    guarantee:
      "Prevents consumer group pipeline starvation during external provider downtime",
    throughput: "Zero Block",
    latency: "< 0.5ms",
  },
];

export const SystemArchitecture: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);

  // MongoDB Transaction Simulator State
  const [mongoSimulating, setMongoSimulating] = useState(false);
  const [mongoStep, setMongoStep] = useState<number>(0);
  const [mongoLogs, setMongoLogs] = useState<string[]>([]);
  const [shouldInduceError, setShouldInduceError] = useState(false);

  // Ledger Simulator State
  const [ledgerEntries, setLedgerEntries] = useState([
    {
      id: "tx_001",
      time: "2026-08-24 09:10:02",
      desc: "Customer Wallet Funding via Paystack",
      debits: "Central Gateway Clearing: ₦50,000.00",
      credits: "User #102 Available: ₦50,000.00",
      balanced: true,
      hash: "a8f94e...1c2b",
    },
    {
      id: "tx_002",
      time: "2026-08-24 09:22:45",
      desc: "P2P Transfer to User #105",
      debits: "User #102 Available: ₦15,000.00",
      credits: "User #105 Available: ₦15,000.00",
      balanced: true,
      hash: "4f71a0...9e88",
    },
    {
      id: "tx_003",
      time: "2026-08-24 09:45:12",
      desc: "Locked Savings Vault Deposit",
      debits: "User #102 Available: ₦10,000.00",
      credits: "User #102 Locked Vault: ₦10,000.00",
      balanced: true,
      hash: "b12c88...6d4a",
    },
  ]);
  const [newTransferAmount, setNewTransferAmount] = useState<number>(5000);
  const [ledgerVerified, setLedgerVerified] = useState<boolean>(true);

  const copyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  // Run Mongo Transaction Simulation
  const runMongoSimulation = () => {
    if (mongoSimulating) return;
    setMongoSimulating(true);
    setMongoLogs([
      '[0.0ms] session = client.startSession({ defaultTransactionOptions: { readConcern: { level: "snapshot" }, writeConcern: { w: "majority", j: true } } })',
    ]);
    setMongoStep(1);

    setTimeout(() => {
      setMongoStep(2);
      setMongoLogs((prev) => [
        ...prev,
        "[2.4ms] session.startTransaction() -> Snapshot view established at clusterTime: 1774892102.3",
      ]);
    }, 600);

    setTimeout(() => {
      setMongoStep(3);
      if (shouldInduceError) {
        setMongoLogs((prev) => [
          ...prev,
          "[4.1ms] Optimistic concurrency check: Sender balance insufficient or modified concurrently (__v mismatch)",
          "[5.0ms] Transaction aborted safely -> session.abortTransaction()",
          "[5.4ms] All intermediate mutations rolled back. Zero partial state.",
        ]);
        setMongoStep(5); // Aborted
        setMongoSimulating(false);
      } else {
        setMongoLogs((prev) => [
          ...prev,
          "[4.8ms] Atomically updated Sender Wallet (₦ -5,000) & Receiver Wallet (₦ +5,000)",
          "[6.2ms] Inserted Transactional Outbox record within session",
        ]);
        setTimeout(() => {
          setMongoStep(4);
          setMongoLogs((prev) => [
            ...prev,
            "[8.0ms] session.commitTransaction() -> Written to majority of nodes (quorum ACK received)",
            "[9.1ms] Transaction completed successfully. Zero dual-write risk.",
          ]);
          setMongoSimulating(false);
        }, 800);
      }
    }, 800);
  };

  // Post new entry to ledger simulator
  const handlePostLedgerEntry = () => {
    if (newTransferAmount <= 0) return;
    const newTx = {
      id: `tx_${Math.floor(100 + Math.random() * 900)}`,
      time: new Date().toISOString().replace("T", " ").substring(0, 19),
      desc: `Instant Wallet Transfer (${newTransferAmount.toLocaleString()} NGN)`,
      debits: `Sender Available: ₦${newTransferAmount.toLocaleString()}.00`,
      credits: `Recipient Available: ₦${newTransferAmount.toLocaleString()}.00`,
      balanced: true,
      hash:
        Math.random().toString(36).substring(2, 10) +
        "..." +
        Math.random().toString(36).substring(2, 6),
    };
    setLedgerEntries((prev) => [newTx, ...prev]);
  };

  return (
    <div className="w-full space-y-6 font-mono text-slate-900 pb-16">
      {/* Top Banner & Navigation Header */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-800 text-[11px] font-bold">
                <Workflow className="w-3.5 h-3.5 text-purple-600" />
                <span>DISTRIBUTED ARCHITECTURE DASHBOARD</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                PROD READY
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950">
              System Architecture & Key Infrastructure Nodes
            </h1>
            <p className="text-xs text-slate-600 font-sans mt-1 max-w-3xl leading-relaxed">
              Explore the deterministic backend architecture powering Zely.
              Designed around multi-document MongoDB ACID isolation,
              non-blocking Debezium CDC oplog streaming, Murmur2 partitioned
              Kafka event queues, and append-only double-entry balancing.
            </p>
          </div>

          {/* Quick Navigation Links */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate("/admin")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Admin Home</span>
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Landing Page</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pt-4 no-scrollbar">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-slate-950 text-white shadow-sm ring-1 ring-slate-900"
                    : "bg-[#FBFBF9] hover:bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${isActive ? "text-purple-400" : "text-slate-500"}`}
                />
                <span>{tab.shortName}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isActive
                      ? "bg-slate-800 text-purple-300"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TOPOLOGY & MODERN INFRASTRUCTURE GRID */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top Summary Banner */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span>Key Infrastructure Nodes & Operational Guarantees</span>
                </h3>
                <p className="text-xs text-slate-600 font-sans mt-0.5">
                  Clean breakdown of the 8 core infrastructure subsystems
                  maintaining mathematical financial integrity.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Zero Financial Drift
              </span>
            </div>

            {/* 8 Infrastructure Nodes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
              {INFRASTRUCTURE_NODES.map((node) => {
                const Icon = node.icon;
                return (
                  <div
                    key={node.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-[#FBFBF9] hover:bg-white hover:border-purple-300 hover:shadow-sm transition-all duration-150 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-xl bg-purple-100 text-purple-800 border border-purple-200">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {node.status}
                        </span>
                      </div>

                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        {node.category}
                      </span>
                      <h4 className="text-xs font-extrabold text-slate-950 mt-0.5 leading-snug">
                        {node.name}
                      </h4>
                      <p className="text-[11px] text-slate-600 font-sans mt-2 leading-relaxed">
                        {node.role}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-200 text-[10px] space-y-1">
                      <div className="text-slate-700">
                        <span className="text-slate-500 block text-[9px] uppercase font-bold">
                          Guarantee:
                        </span>
                        <span className="font-semibold text-slate-900">
                          {node.guarantee}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 font-mono">
                        <span className="text-slate-500">
                          Latency:{" "}
                          <strong className="text-purple-700">
                            {node.latency}
                          </strong>
                        </span>
                        <span className="text-slate-500">
                          SLA:{" "}
                          <strong className="text-emerald-700">
                            {node.throughput}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Integrated Kafka Flow Visualizer inside Overview */}
          <KafkaFlowVisualizer />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: KAFKA EVENT STREAM & OUTBOX CDC */}
      {/* ========================================================================= */}
      {activeTab === "kafka" && (
        <div className="space-y-6">
          <KafkaFlowVisualizer />

          {/* Kafka Architecture Architectural Proof Card */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="border-b border-[#E5E7EB] pb-3">
              <h4 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  Transactional Outbox Invariant & Zero Dual-Write Proof
                </span>
              </h4>
              <p className="text-xs text-slate-600 font-sans mt-0.5">
                How atomic oplog tailing eliminates phantom transfers during
                network partitions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-mono font-bold text-slate-950 block text-xs">
                  1. Dual-Write Hazard Avoided
                </span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Traditional apps write to SQL/Mongo and then invoke{" "}
                  <code className="text-purple-700 font-bold font-mono">
                    kafka.send()
                  </code>{" "}
                  over network. If the broker ACK drops, the database is
                  committed but the event is permanently lost.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-mono font-bold text-slate-950 block text-xs">
                  2. Atomic Multi-Doc Outbox
                </span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Zely writes both the wallet debit and the{" "}
                  <code className="text-purple-700 font-bold font-mono">
                    outbox_events
                  </code>{" "}
                  row inside the exact same MongoDB snapshot transaction. If one
                  fails, both roll back instantly.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-mono font-bold text-slate-950 block text-xs">
                  3. Murmur2 Ordering Invariant
                </span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Every wallet partition key hashes to the exact same Kafka
                  partition. Downstream ledger consumers process events in
                  strict linear sequence without global database locks.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MONGODB MULTI-DOCUMENT ACID TRANSACTIONS */}
      {/* ========================================================================= */}
      {activeTab === "mongodb" && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>MongoDB Multi-Document ACID Isolation Engine</span>
                </h3>
                <p className="text-xs text-slate-600 font-sans mt-0.5">
                  Snapshot read concern (`level: snapshot`) and majority quorum
                  journal write concern (`w: majority, j: true`).
                </p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shrink-0 self-start sm:self-auto">
                ADR-001: ACID Transactions
              </span>
            </div>

            {/* Interactive ACID Session Simulator */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-xl bg-[#FBFBF9] border border-slate-200 space-y-3 text-xs">
                  <span className="font-bold text-slate-950 block uppercase text-[11px]">
                    ACID Transaction Controller
                  </span>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={shouldInduceError}
                      onChange={(e) => setShouldInduceError(e.target.checked)}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-slate-700 font-sans text-xs">
                      Simulate Concurrent Race Condition (Force Abort)
                    </span>
                  </label>

                  <button
                    onClick={runMongoSimulation}
                    disabled={mongoSimulating}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {mongoSimulating
                        ? "Executing ACID Session..."
                        : "Run ACID Transaction"}
                    </span>
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 text-xs space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Session Invariants
                  </span>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-purple-300">Read Concern</span>
                    <span className="font-bold text-emerald-300">snapshot</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-purple-300">Write Concern</span>
                    <span className="font-bold text-emerald-300">
                      w: "majority", j: true
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-purple-300">Max Commit Time</span>
                    <span className="font-bold text-emerald-300">5,000 ms</span>
                  </div>
                </div>
              </div>

              {/* Live Terminal Output */}
              <div className="lg:col-span-7 bg-slate-950 text-slate-200 rounded-2xl p-4.5 border border-slate-800 flex flex-col justify-between font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-slate-300">
                      WiredTiger Engine Oplog Stream
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      mongoStep === 4
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        : mongoStep === 5
                          ? "bg-rose-950 text-rose-400 border border-rose-800"
                          : mongoSimulating
                            ? "bg-amber-950 text-amber-400 border border-amber-800 animate-pulse"
                            : "bg-slate-900 text-slate-500"
                    }`}
                  >
                    {mongoStep === 4
                      ? "COMMITTED (QUORUM)"
                      : mongoStep === 5
                        ? "ABORTED & ROLLED BACK"
                        : mongoSimulating
                          ? "TRANSACTION IN FLIGHT"
                          : "IDLE SESSION"}
                  </span>
                </div>

                <div className="space-y-1.5 min-h-[160px] max-h-[220px] overflow-y-auto font-mono text-xs">
                  {mongoLogs.length === 0 ? (
                    <div className="text-slate-600 italic pt-6 text-center">
                      Click "Run ACID Transaction" to observe multi-document
                      snapshot session lifecycle.
                    </div>
                  ) : (
                    mongoLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className={
                          log.includes("aborted")
                            ? "text-rose-400"
                            : log.includes("commit")
                              ? "text-emerald-300 font-bold"
                              : "text-slate-300"
                        }
                      >
                        {log}
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
                  <span>
                    Replica Set: <strong>rs0 (3 Voting Members)</strong>
                  </span>
                  <span>
                    Optimistic Versioning: <strong>__v check</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: APPEND-ONLY DOUBLE-ENTRY LEDGER */}
      {/* ========================================================================= */}
      {activeTab === "ledger" && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-purple-600" />
                  <span>Append-Only Double-Entry Ledger Engine</span>
                </h3>
                <p className="text-xs text-slate-600 font-sans mt-0.5">
                  Immutable zero-sum journal entries with cryptographic SHA-256
                  block hash chaining.
                </p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold shrink-0 self-start sm:self-auto">
                ADR-004: Invariant Proof
              </span>
            </div>

            {/* Invariant Equation Banner */}
            <div className="p-4 rounded-xl bg-slate-950 text-white border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Fundamental Accounting Invariant
                </span>
                <code className="text-sm sm:text-base font-extrabold text-emerald-400">
                  ∑(Debits) - ∑(Credits) ≡ 0.00
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-bold">
                  Zero Financial Drift
                </span>
              </div>
            </div>

            {/* Interactive Posting Box */}
            <div className="p-4 rounded-xl bg-[#FBFBF9] border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="font-bold text-slate-800 whitespace-nowrap">
                  Transfer Amount (NGN):
                </span>
                <input
                  type="number"
                  value={newTransferAmount}
                  onChange={(e) => setNewTransferAmount(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono text-xs w-32 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={handlePostLedgerEntry}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
              >
                Post Balanced Journal Entry
              </button>
            </div>

            {/* Immutable Journal Entries Table */}
            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-3">Journal Entry ID</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Debit Leg</th>
                    <th className="p-3">Credit Leg</th>
                    <th className="p-3">Zero-Sum Proof</th>
                    <th className="p-3">SHA-256 Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {ledgerEntries.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-3 font-bold text-slate-900">{tx.id}</td>
                      <td className="p-3 text-slate-600 text-[11px]">
                        {tx.time}
                      </td>
                      <td className="p-3 text-rose-700 font-medium">
                        {tx.debits}
                      </td>
                      <td className="p-3 text-emerald-700 font-medium">
                        {tx.credits}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          BALANCED (Δ=0)
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 text-[11px]">
                        {tx.hash}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: DISTRIBUTED LOCKING & IDEMPOTENCY */}
      {/* ========================================================================= */}
      {activeTab === "idempotency" && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>Two-Tier Distributed Idempotency Locking Engine</span>
                </h3>
                <p className="text-xs text-slate-600 font-sans mt-0.5">
                  Sub-millisecond Redis mutex caching backed by MongoDB compound
                  unique key constraints.
                </p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold shrink-0 self-start sm:self-auto">
                ADR-003: Idempotency
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-mono font-bold text-slate-950 block text-xs">
                  Tier 1: Redis Mutex (`SET NX EX 120`)
                </span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  First line of defense intercepts identical in-flight requests
                  within 1.2ms. If another thread is actively processing the
                  same idempotency key, downstream requests are held or rejected
                  without hitting the database.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-mono font-bold text-slate-950 block text-xs">
                  Tier 2: MongoDB Unique Compound Index
                </span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Permanent safety net. Unique index on{" "}
                  <code className="text-purple-700 font-bold font-mono">
                    &#123; userId: 1, idempotencyKey: 1 &#125;
                  </code>{" "}
                  rejects duplicates with error code 11000 even if Redis
                  experiences a cluster failover.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: 3-LAYER CONTINUOUS RECONCILIATION */}
      {/* ========================================================================= */}
      {activeTab === "reconciliation" && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>3-Layer Continuous Automated Reconciliation</span>
                </h3>
                <p className="text-xs text-slate-600 font-sans mt-0.5">
                  Three independent audit loops detect and flag mathematical
                  discrepancy in real-time.
                </p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shrink-0 self-start sm:self-auto">
                ADR-008: Automated Recon
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="font-mono font-bold text-slate-950 block text-xs">
                  Layer 1: External Gateway Clearing
                </span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Matches Paystack/Flutterwave webhook settlement batches
                  against local transaction logs to confirm external provider
                  funds are strictly settled.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="font-mono font-bold text-slate-950 block text-xs">
                  Layer 2: Internal Wallet vs. Ledger Sum
                </span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Recomputes total user wallet balance from the immutable
                  journal history to verify that wallet state matches ledger
                  entries exactly.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="font-mono font-bold text-slate-950 block text-xs">
                  Layer 3: Vault Lock Integrity
                </span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Ensures locked target savings stashes are physically
                  non-withdrawable prior to designated unlock timestamp
                  invariants.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemArchitecture;
