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
  RotateCw,
  Radio,
  Code2,
  Hash,
  Activity,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";

export interface KafkaStage {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  badge: string;
  description: string;
  details: {
    technology: string;
    throughput: string;
    latency: string;
    reliability: string;
    configuration: Record<string, string>;
  };
  samplePayload?: Record<string, any>;
}

const KAFKA_STAGES: KafkaStage[] = [
  {
    id: "api-producer",
    stepNumber: 1,
    title: "API Client & Ingress",
    subtitle: "Atomic Transaction Scope",
    icon: Server,
    color: "purple",
    badge: "STAGE 1: PRODUCER",
    description:
      "Incoming HTTP transfer request opens a single MongoDB multi-document ACID transaction. The wallet balance update and the Outbox event are written atomically.",
    details: {
      technology: "Express.js + Mongoose Session",
      throughput: "1,450 req/sec",
      latency: "< 8ms p99",
      reliability: "Snapshot Isolation (MVCC)",
      configuration: {
        readConcern: "snapshot",
        writeConcern: 'w: "majority", j: true',
        maxCommitTimeMS: "5000",
        retryWrites: "true",
      },
    },
    samplePayload: {
      action: "INITIATE_TRANSFER",
      clientRequestId: "req_98a71b2e-44c1",
      idempotencyKey: "idem_550e8400-e29b-41d4",
      senderWalletId: "w_991204_ngn",
      recipientWalletId: "w_448102_ngn",
      amount: 25000.0,
      currency: "NGN",
    },
  },
  {
    id: "mongo-outbox",
    stepNumber: 2,
    title: "MongoDB Outbox Table",
    subtitle: "WiredTiger Oplog Replication",
    icon: Database,
    color: "emerald",
    badge: "STAGE 2: OUTBOX STORAGE",
    description:
      "The event payload is inserted into the outbox_events collection within the same transaction. This eliminates dual-write anomalies (writing to DB + network Kafka call).",
    details: {
      technology: "MongoDB 7.0 (Replica Set Quorum)",
      throughput: "12,000 writes/sec",
      latency: "1.4ms journal write",
      reliability: "Zero Data Loss (RPO = 0)",
      configuration: {
        collection: "outbox_events",
        indexes: "{ status: 1, createdAt: 1 }, { partitionKey: 1 }",
        oplogSizeMB: "10240",
        retentionPolicy: "TTL 7 days post-ACK",
      },
    },
    samplePayload: {
      _id: "6674a1f89c02e11894b1a201",
      aggregateType: "WALLET_TRANSFER",
      aggregateId: "tr_8841920",
      eventType: "TRANSFER_INITIATED",
      partitionKey: "usr_991204",
      status: "STAGED",
      createdAt: "2026-08-24T09:41:20.104Z",
    },
  },
  {
    id: "debezium-cdc",
    stepNumber: 3,
    title: "Debezium CDC Connector",
    subtitle: "Non-Blocking Oplog Tailing",
    icon: Zap,
    color: "amber",
    badge: "STAGE 3: CHANGE DATA CAPTURE",
    description:
      "Kafka Connect Debezium engine continuously tails MongoDB oplog.rs. It captures changes as an immutable stream without placing any table locks on active user transactions.",
    details: {
      technology: "Debezium MongoDB Connector 2.6",
      throughput: "45,000 events/sec",
      latency: "2-4ms capture lag",
      reliability: "At-Least-Once Streaming",
      configuration: {
        "connector.class": "io.debezium.connector.mongodb.MongoDbConnector",
        "capture.mode": "change_streams_update_lookup",
        "tombstones.on.delete": "false",
        "heartbeat.interval.ms": "1000",
      },
    },
    samplePayload: {
      op: "c",
      ts_ms: 1774892480112,
      source: {
        version: "2.6.0.Final",
        connector: "mongodb",
        name: "fintech-core",
        rs: "rs0",
      },
      after: {
        eventId: "evt_99812",
        type: "TRANSFER_INITIATED",
        partitionKey: "usr_991204",
      },
    },
  },
  {
    id: "kafka-cluster",
    stepNumber: 4,
    title: "Apache Kafka Cluster",
    subtitle: "Murmur2 Keyed Partitioning",
    icon: Cpu,
    color: "blue",
    badge: "STAGE 4: BROKER PARTITIONING",
    description:
      "Messages are hashed via Murmur2(partitionKey) and routed to sequential partitions. Events for the same user or wallet are guaranteed strict in-order delivery.",
    details: {
      technology: "Apache Kafka 3.7 (KRaft Consensus)",
      throughput: "180,000 msgs/sec",
      latency: "< 1.5ms publish ACK",
      reliability: "min.insync.replicas = 2",
      configuration: {
        topic: "fintech.transfers.initiated",
        partitions: "6",
        "replication.factor": "3",
        acks: "all",
        "compression.type": "zstd",
        "cleanup.policy": "delete",
      },
    },
    samplePayload: {
      topic: "fintech.transfers.initiated",
      partition: 2,
      offset: 1049281,
      key: "usr_991204",
      timestamp: 1774892480119,
      headers: {
        "x-correlation-id": "corr_91fa81",
        "x-idempotency-hash": "sha256_9a8c",
      },
    },
  },
  {
    id: "consumer-groups",
    stepNumber: 5,
    title: "Idempotent Consumer Groups",
    subtitle: "Offset Commits & Parallel Workers",
    icon: Inbox,
    color: "purple",
    badge: "STAGE 5: CONSUMPTION & LEDGER",
    description:
      "Decoupled consumer services process events independently. Each worker uses atomic deduplication tables to ensure idempotency even on Kafka network retries.",
    details: {
      technology: "Node.js KafkaJS Consumer Workers",
      throughput: "8,500 processed/sec/worker",
      latency: "4-8ms processing",
      reliability: "Exactly-Once Processing Semantics",
      configuration: {
        "group.id": "ledger-posting-service-v2",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": "false",
        "max.poll.interval.ms": "300000",
        "session.timeout.ms": "45000",
      },
    },
    samplePayload: {
      consumerGroup: "ledger-posting-service-v2",
      workerId: "worker-node-03",
      processedEventId: "evt_99812",
      journalEntryPosted: "jrn_7718290",
      debitsCreditsBalanced: true,
      committedOffset: 1049282,
    },
  },
  {
    id: "dlq-quarantine",
    stepNumber: 6,
    title: "Poison Pill DLQ & Quarantine",
    subtitle: "Automated 3-Retry Exponential Backoff",
    icon: ShieldAlert,
    color: "rose",
    badge: "SAFETY: DEAD LETTER QUEUE",
    description:
      "Any malformed message or downstream network timeout triggers 3 exponential retries before automatic rerouting to fintech.dlq.transfers with full audit context.",
    details: {
      technology: "Kafka DLQ Topic + Alert Dispatcher",
      throughput: "Zero cluster blocking",
      latency: "Immediate quarantine",
      reliability: "100% Unprocessed Auditability",
      configuration: {
        "dlq.topic": "fintech.dlq.transfers",
        "max.retries": "3",
        "backoff.initial.ms": "500",
        "backoff.multiplier": "2.0",
        "alert.webhook": "enabled",
      },
    },
    samplePayload: {
      failedEventId: "evt_99812",
      originalTopic: "fintech.transfers.initiated",
      failureReason: "INVALID_RECIPIENT_CURRENCY_MISMATCH",
      attemptCount: 3,
      quarantinedAt: "2026-08-24T09:41:22.901Z",
      requiresManualReview: true,
    },
  },
];

const TOPIC_METRICS = [
  {
    name: "fintech.transfers.initiated",
    category: "Core Money Movement",
    partitions: 6,
    replication: 3,
    rate: "1,420 msgs/s",
    lag: "0 msgs",
    retention: "7 days",
    status: "ACTIVE",
    color: "purple",
  },
  {
    name: "fintech.ledger.journal_posted",
    category: "Double-Entry Accounting",
    partitions: 6,
    replication: 3,
    rate: "2,840 msgs/s",
    lag: "0 msgs",
    retention: "30 days",
    status: "ACTIVE",
    color: "emerald",
  },
  {
    name: "fintech.wallets.balance_updated",
    category: "Real-Time State Sync",
    partitions: 12,
    replication: 3,
    rate: "4,100 msgs/s",
    lag: "2 msgs",
    retention: "3 days",
    status: "ACTIVE",
    color: "blue",
  },
  {
    name: "fintech.notifications.dispatch",
    category: "Customer Alert Stream",
    partitions: 4,
    replication: 3,
    rate: "980 msgs/s",
    lag: "0 msgs",
    retention: "24 hours",
    status: "ACTIVE",
    color: "amber",
  },
  {
    name: "fintech.dlq.transfers",
    category: "Dead Letter Quarantine",
    partitions: 2,
    replication: 3,
    rate: "0.02 msgs/s",
    lag: "0 msgs",
    retention: "90 days",
    status: "HEALTHY",
    color: "rose",
  },
];

export const KafkaEventFlowVisualizer: React.FC = () => {
  const [selectedStageId, setSelectedStageId] =
    useState<string>("kafka-cluster");
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);
  const [animatingPulse, setAnimatingPulse] = useState<boolean>(true);
  const [selectedTopic, setSelectedTopic] = useState<string>(
    "fintech.transfers.initiated",
  );

  const activeStage =
    KAFKA_STAGES.find((s) => s.id === selectedStageId) || KAFKA_STAGES[3];

  const handleCopyPayload = (payload: any) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  return (
    <div className="space-y-6 font-mono text-slate-900">
      {/* Visual Header Card */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-800 text-[11px] font-bold mb-2">
              <Radio className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
              <span>EVENT-DRIVEN ARCHITECTURE VISUALIZATION</span>
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-950 flex items-center gap-2">
              <span>Kafka Event Pipeline & Outbox CDC Architecture</span>
            </h3>
            <p className="text-xs text-slate-600 font-sans mt-1 max-w-2xl leading-relaxed">
              Explore how financial transaction events flow from the initial API
              boundary through atomic database Outbox tables, non-blocking
              Debezium CDC oplog streaming, partitioned Kafka brokers, and
              idempotent consumer groups.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setAnimatingPulse(!animatingPulse)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                animatingPulse
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : "bg-slate-100 border-slate-300 text-slate-700"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>
                {animatingPulse ? "Live Pulse Active" : "Pulse Paused"}
              </span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE STAGES PIPELINE CARDS (STEP 1 - 6) */}
        {/* ========================================================================= */}
        <div className="pt-6">
          <div className="flex items-center justify-between mb-3 text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>
              Pipeline Stages (Click any stage card to inspect deep
              configuration & payload)
            </span>
            <span className="text-purple-700 font-bold">
              Step {activeStage.stepNumber} of 6 Selected
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {KAFKA_STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const isSelected = selectedStageId === stage.id;

              return (
                <div key={stage.id} className="relative group">
                  <button
                    onClick={() => setSelectedStageId(stage.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer h-full flex flex-col justify-between ${
                      isSelected
                        ? "bg-slate-950 text-white border-purple-500 shadow-md ring-2 ring-purple-500/20"
                        : "bg-[#FBFBF9] hover:bg-white text-slate-900 border-slate-200 hover:border-slate-300 shadow-xs"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div
                          className={`p-1.5 rounded-lg ${
                            isSelected
                              ? "bg-purple-900/80 text-purple-300 border border-purple-700"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded font-mono ${
                            isSelected
                              ? "bg-purple-950 text-purple-300 border border-purple-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          0{stage.stepNumber}
                        </span>
                      </div>

                      <div>
                        <span
                          className={`text-[10px] block font-bold uppercase tracking-wider truncate ${
                            isSelected ? "text-purple-300" : "text-slate-500"
                          }`}
                        >
                          {stage.badge}
                        </span>
                        <h4
                          className={`text-xs font-extrabold leading-snug mt-0.5 ${
                            isSelected ? "text-white" : "text-slate-950"
                          }`}
                        >
                          {stage.title}
                        </h4>
                      </div>
                    </div>

                    <p
                      className={`text-[10px] line-clamp-2 mt-2 leading-relaxed font-sans ${
                        isSelected ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {stage.subtitle}
                    </p>

                    {/* Step indicator arrow for desktop */}
                    {idx < KAFKA_STAGES.length - 1 && (
                      <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] border shadow-xs ${
                            isSelected
                              ? "bg-purple-600 text-white border-purple-400"
                              : "bg-white text-slate-400 border-slate-200"
                          }`}
                        >
                          →
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ACTIVE STAGE DEEP INSPECTOR CARD */}
        {/* ========================================================================= */}
        <div className="mt-6 pt-6 border-t border-[#E5E7EB]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStage.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Left Column: Stage Specifications & Guarantees */}
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-100 text-purple-800 border border-purple-200">
                    <activeStage.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                        {activeStage.badge}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                        VERIFIED INVARIANT
                      </span>
                    </div>
                    <h4 className="text-base font-extrabold text-slate-950">
                      {activeStage.title}
                    </h4>
                  </div>
                </div>

                <p className="text-xs text-slate-700 font-sans leading-relaxed">
                  {activeStage.description}
                </p>

                {/* Specification Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#FBFBF9] border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">
                      Technology
                    </span>
                    <span className="font-bold text-slate-900 block truncate">
                      {activeStage.details.technology}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FBFBF9] border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">
                      Throughput
                    </span>
                    <span className="font-bold text-emerald-700 block">
                      {activeStage.details.throughput}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FBFBF9] border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">
                      Latency SLA
                    </span>
                    <span className="font-bold text-purple-700 block">
                      {activeStage.details.latency}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FBFBF9] border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">
                      Reliability Standard
                    </span>
                    <span className="font-bold text-slate-900 block truncate">
                      {activeStage.details.reliability}
                    </span>
                  </div>
                </div>

                {/* Engine Configuration Parameters */}
                <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider pb-1 border-b border-slate-800">
                    <span>Engine Configuration Key</span>
                    <span>Enforced Value</span>
                  </div>
                  {Object.entries(activeStage.details.configuration).map(
                    ([key, val]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-[11px] font-mono"
                      >
                        <span className="text-purple-300">{key}</span>
                        <code className="text-emerald-300 font-bold">
                          {val}
                        </code>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {/* Right Column: JSON Event Payload Schema */}
              <div className="lg:col-span-6 flex flex-col justify-between bg-slate-950 text-slate-200 border border-slate-800 rounded-2xl p-4.5 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-slate-300 text-xs">
                      Stage Data Contract / Payload
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyPayload(activeStage.samplePayload)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedPayload ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedPayload ? "Copied" : "Copy JSON"}</span>
                  </button>
                </div>

                <pre className="p-3 rounded-xl bg-slate-900 text-emerald-300 text-xs overflow-x-auto border border-slate-800 leading-relaxed font-mono min-h-[180px] max-h-[260px]">
                  <code>
                    {JSON.stringify(activeStage.samplePayload, null, 2)}
                  </code>
                </pre>

                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>
                    Serialization: <strong>JSON / Avro Schema v2</strong>
                  </span>
                  <span className="text-emerald-400 font-bold">
                    Strict Schema Validation
                  </span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KAFKA TOPICS & PARTITION DISTRIBUTION CARDS */}
      {/* ========================================================================= */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
          <div>
            <h4 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Active Kafka Topics & Consumer Group Matrix</span>
            </h4>
            <p className="text-xs text-slate-600 font-sans mt-0.5">
              Strict topic partitioning by sender/wallet ID ensures linear
              execution order without global cluster locks.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0 self-start sm:self-auto">
            All 5 Topics In-Sync (ISR=3)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {TOPIC_METRICS.map((topic) => {
            const isSelected = selectedTopic === topic.name;
            return (
              <button
                key={topic.name}
                onClick={() => setSelectedTopic(topic.name)}
                className={`p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer space-y-2.5 ${
                  isSelected
                    ? "bg-purple-50/60 border-purple-400 shadow-sm"
                    : "bg-[#FBFBF9] hover:bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {topic.category}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {topic.status}
                  </span>
                </div>

                <div className="font-mono font-bold text-xs text-slate-950 break-all">
                  {topic.name}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">
                      Partitions
                    </span>
                    <span className="font-bold text-slate-900">
                      {topic.partitions} (ISR: {topic.replication})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">
                      Publish Rate
                    </span>
                    <span className="font-bold text-purple-700">
                      {topic.rate}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">
                      Consumer Lag
                    </span>
                    <span className="font-bold text-emerald-700">
                      {topic.lag}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">
                      Retention
                    </span>
                    <span className="font-bold text-slate-700">
                      {topic.retention}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Keyed Partitioning Routing Invariant Card */}
          <div className="p-4 rounded-xl border border-dashed border-purple-300 bg-purple-50/30 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center gap-1.5 text-purple-800 text-xs font-bold">
                <Hash className="w-3.5 h-3.5" />
                <span>Partition Key Hash Invariant</span>
              </div>
              <p className="text-[11px] text-slate-600 font-sans mt-1 leading-relaxed">
                Partition index is deterministically calculated as{" "}
                <code className="text-purple-900 font-bold">
                  abs(Murmur2(key)) % numPartitions
                </code>
                . All events for the same wallet always land on the exact same
                partition.
              </p>
            </div>
            <div className="p-2 rounded bg-white border border-purple-200 text-[10px] text-purple-950 font-bold">
              Guarantees zero out-of-order ledger updates
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KafkaEventFlowVisualizer;
