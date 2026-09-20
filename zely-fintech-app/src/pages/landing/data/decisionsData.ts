export interface ArchitecturalDecision {
  id: string;
  number: string;
  title: string;
  status: "ACCEPTED" | "PROVEN" | "ACTIVE";
  category:
    | "DISTRIBUTED_SYSTEMS"
    | "FINANCIAL_INTEGRITY"
    | "RESILIENCE"
    | "STORAGE_ARCHITECTURE"
    | "SECURITY_IDENTITY"
    | "API_INFRASTRUCTURE";
  summary: string;
  problemStatement: string;
  chosenSolution: string;
  rejectedAlternatives: {
    name: string;
    reason: string;
  }[];
  failureScenariosAndMitigation: {
    scenario: string;
    systemBehavior: string;
  }[];
  mathematicalProofOrInvariant: string;
  codeSnippet?: {
    language: string;
    title: string;
    code: string;
  };
}

export const ARCHITECTURAL_DECISIONS: ArchitecturalDecision[] = [
  {
    id: "adr-001",
    number: "ADR-001",
    title: "CDC over polling outbox",
    status: "ACCEPTED",
    category: "DISTRIBUTED_SYSTEMS",
    summary:
      "Eliminate dual-write hazards and database CPU lock contention by writing event envelopes inside MongoDB ACID sessions and streaming changes via Debezium CDC from the oplog.",
    problemStatement:
      'Publishing events directly to Kafka within HTTP handlers creates the classic 2PC Dual-Write hazard: if Kafka is unreachable or the container crashes after DB commit, downstream ledger and settlement consumers lose the event. Conversely, background polling cron workers ("SELECT * FROM outbox WHERE processed = false") create severe table scan lock contention and 1–5s latency jitter.',
    chosenSolution:
      "Adopt the Transactional Outbox pattern paired with Debezium Change Data Capture (CDC). When a user mutates wallet balances, an outbox document is written inside the same MongoDB multi-document ACID transaction. Debezium connects as a replica set member and streams the immutable MongoDB Oplog directly to Kafka topics without any database polling queries.",
    rejectedAlternatives: [
      {
        name: "Direct Kafka Producer within HTTP Request",
        reason:
          "Dual-write risk: Network partitions or pod crashes after DB commit result in silent data loss.",
      },
      {
        name: 'Database Polling Cron ("SELECT * FROM outbox WHERE processed = false")',
        reason:
          "Causes index degradation, polling latency jitter, and database CPU lock contention under high TPS.",
      },
      {
        name: "Two-Phase Commit (2PC / XA Transactions)",
        reason:
          "Brittle distributed blocking protocol that stalls container execution during network partitions.",
      },
    ],
    failureScenariosAndMitigation: [
      {
        scenario:
          "Kafka broker cluster experiences a 30-second network partition.",
        systemBehavior:
          "HTTP transfer requests commit to MongoDB normally. Outbox records accumulate safely in the oplog. When Kafka connectivity recovers, Debezium resumes streaming from its saved checkpoint offset with zero dropped events.",
      },
      {
        scenario:
          "Debezium connector container crashes during stream dispatch.",
        systemBehavior:
          "Debezium persists its consumer offset to an internal compacted Kafka topic. Upon container restart, it reads the checkpoint and resumes streaming without missing any records (at-least-once delivery).",
      },
    ],
    mathematicalProofOrInvariant:
      "Atomicity Invariant: Let T be the database transaction. Commit(T) = { WalletMutation ∧ OutboxEvent } ∈ { ∅, {State, Event} }. No state can transition without an identical outbox record.",
    codeSnippet: {
      language: "typescript",
      title: "Atomic MongoDB Outbox Session Commit",
      code: `const session = client.startSession();
try {
  await session.withTransaction(async () => {
    // 1. Mutate balances
    await Wallets.updateOne({ _id: senderId }, { $inc: { balance: -amount } }, { session });
    await Wallets.updateOne({ _id: recipientId }, { $inc: { balance: amount } }, { session });

    // 2. Write Outbox Event within SAME ACID session
    await Outbox.insertOne({
      eventType: 'TRANSFER_COMPLETED',
      aggregateId: transferId,
      payload: { senderId, recipientId, amount, ledgerJournalId },
      createdAt: new Date()
    }, { session });
  });
} finally {
  await session.endSession();
}`,
    },
  },
  {
    id: "adr-002",
    number: "ADR-002",
    title: "Two-phase consumer idempotency",
    status: "PROVEN",
    category: "DISTRIBUTED_SYSTEMS",
    summary:
      "Guarantee strict exactly-once event processing at Kafka consumer boundaries using Redis fast-path reservations followed by authoritative MongoDB unique processed_events records.",
    problemStatement:
      "Kafka provides at-least-once delivery semantics. During consumer group rebalances, partition reassignments, or node restarts, duplicate event messages will be dispatched to consumers. If consumers execute debit/credit mutations without idempotency, accounts will be duplicate debited.",
    chosenSolution:
      "Implement a two-phase consumer idempotency protocol. Phase 1 (Reservation): Consumer acquires a short-lived Redis lock with `SET idemp:consumer:{eventId} IN_FLIGHT NX EX 60`. If already locked, message processing yields early. Phase 2 (Authoritative Commit): Consumer inserts `{ eventId, consumerGroup, processedAt }` into the MongoDB `processed_events` collection guarded by a unique compound index inside the ACID business transaction.",
    rejectedAlternatives: [
      {
        name: "In-Memory Set on Consumer Node",
        reason:
          "State is lost on pod restart or horizontal autoscaling, allowing duplicate processing across replicas.",
      },
      {
        name: "Redis-Only Processed Keys with TTL",
        reason:
          "Key eviction under memory pressure or Redis restart could erase history, allowing duplicates on historic re-reads.",
      },
    ],
    failureScenariosAndMitigation: [
      {
        scenario:
          "Kafka delivers the exact same TRANSFER_CREATED message to two competing consumer pods simultaneously.",
        systemBehavior:
          "Pod A acquires the Redis reservation and executes the transaction. Pod B fails to acquire the Redis NX lock and acknowledges Kafka offset without re-executing balance mutations.",
      },
      {
        scenario:
          "Pod A crashes after inserting to MongoDB but before Kafka commits the offset.",
        systemBehavior:
          "Kafka re-delivers the message to Pod C. Pod C attempts MongoDB insert, encounters MongoError E11000 (duplicate key), recognizes completion, and safely commits offset.",
      },
    ],
    mathematicalProofOrInvariant:
      "Idempotency Guarantee: ∀ e ∈ Events, MultiExecute(e, N) = SingleExecute(e, 1). State delta ΔS is applied exactly once.",
    codeSnippet: {
      language: "typescript",
      title: "Two-Phase Consumer Idempotency Handler",
      code: `async function handleKafkaEvent(event: KafkaEnvelope, context: ConsumerContext) {
  const redisKey = \`idemp:consumer:\${context.groupId}:\${event.id}\`;

  // Phase 1: In-memory distributed lock reservation
  const acquired = await redis.set(redisKey, 'PROCESSING', 'EX', 60, 'NX');
  if (!acquired) {
    logger.warn(\`Duplicate event \${event.id} suppressed at Phase 1\`);
    return;
  }

  // Phase 2: Authoritative unique record inside DB session
  const session = await mongo.startSession();
  try {
    await session.withTransaction(async () => {
      await ProcessedEvents.insertOne({
        eventId: event.id,
        consumerGroup: context.groupId,
        processedAt: new Date()
      }, { session });

      await processBusinessLogic(event.payload, session);
    });
    await redis.set(redisKey, 'COMPLETED', 'EX', 86400);
  } catch (err: any) {
    if (err.code === 11000) {
      logger.info(\`Event \${event.id} already committed in database. Safely acknowledged.\`);
      return;
    }
    await redis.del(redisKey);
    throw err;
  } finally {
    await session.endSession();
  }
}`,
    },
  },
  {
    id: "adr-003",
    number: "ADR-003",
    title: "Per-process Kafka clientId",
    status: "ACCEPTED",
    category: "DISTRIBUTED_SYSTEMS",
    summary:
      "Assign dynamically generated, deterministic client identifiers (`zely-core-${POD_NAME}-${PID}`) to isolate client metrics, avoid JMX collision, and streamline consumer group rebalances.",
    problemStatement:
      'When all Kubernetes consumer pods share a static `clientId` (e.g. "zely-consumer"), Kafka broker logs and JMX metrics cannot distinguish which specific pod is experiencing socket stalls, lag spikes, or heartbeat timeouts. Furthermore, coordinator rebalances become chaotic during rolling deploys.',
    chosenSolution:
      'Configure every Kafka producer and consumer instance with an explicit, unique clientId constructed as `${serviceName}-${process.env.HOSTNAME || process.env.POD_NAME || "local"}-${process.pid}`. This allows Kafka brokers, JMX metrics, and Prometheus scrapers to trace socket connections, fetch requests, and lag telemetry directly to the individual pod.',
    rejectedAlternatives: [
      {
        name: 'Static Shared clientId ("zely-backend")',
        reason:
          "Makes cluster-level debugging impossible; broker JMX metrics group all pod metrics into a single noisy aggregate.",
      },
      {
        name: "Completely Random UUID on Every Reconnect",
        reason:
          "Pollutes broker metadata cache with orphaned client identifiers across transient socket reconnections.",
      },
    ],
    failureScenariosAndMitigation: [
      {
        scenario:
          "A single Kubernetes pod enters a CPU throttle loop and fails heartbeats.",
        systemBehavior:
          "Kafka broker logs specifically identify `zely-core-deployment-7f9b-w2x8-1` as the expired member, allowing on-call engineers to pinpoint the exact degraded container in Grafana.",
      },
    ],
    mathematicalProofOrInvariant:
      "Uniqueness Invariant: ∀ p1, p2 ∈ ActivePods, p1 ≠ p2 ⇒ ClientId(p1) ≠ ClientId(p2). Broker connection mapping is strictly bijective.",
    codeSnippet: {
      language: "typescript",
      title: "Deterministic Dynamic Kafka Client Configuration",
      code: `import { Kafka } from 'kafkajs';

const podIdentifier = process.env.POD_NAME || process.env.HOSTNAME || 'dev-instance';
const clientId = \`zely-core-\${podIdentifier}-\${process.pid}\`;

export const kafka = new Kafka({
  clientId,
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  connectionTimeout: 5000,
  requestTimeout: 25000,
  retry: {
    initialRetryTime: 300,
    retries: 8
  }
});`,
    },
  },
  {
    id: "adr-004",
    number: "ADR-004",
    title: "Cockatiel over Opossum",
    status: "ACCEPTED",
    category: "RESILIENCE",
    summary:
      "Adopt Cockatiel as the TypeScript-native resilience engine, leveraging composable Bulkhead + CircuitBreaker policies with strict static typing and zero EventEmitter memory leaks.",
    problemStatement:
      "Upstream banking APIs (NIBSS, Paystack) suffer intermittent latency spikes and 504 gateway timeouts. Legacy circuit breaker libraries like Opossum rely on untyped event emitters, lack native bulkhead concurrency governors, and introduce memory leaks when instantiating dynamic route policies.",
    chosenSolution:
      "Adopt Cockatiel for all external egress integrations. Cockatiel is written in modern TypeScript, provides policy composition via `wrap(bulkhead, circuitBreaker, retryPolicy)`, avoids global event listener leaks, and enforces strict concurrency caps (25 concurrent slots) with configurable half-open probing windows.",
    rejectedAlternatives: [
      {
        name: "Opossum Circuit Breaker",
        reason:
          "Untyped JavaScript origins, lacks first-class Bulkhead composition, and exhibits EventEmitter listener leaks under dynamic instantiate cycles.",
      },
      {
        name: "Unconstrained Axios / Fetch with Naive Retries",
        reason:
          'Triggers the "Thundering Herd" problem, accelerating partner outage cascades and exhausting Node.js socket pools.',
      },
    ],
    failureScenariosAndMitigation: [
      {
        scenario:
          "Paystack webhook verification or transfer gateway experiences 100% 500 Internal Server Errors.",
        systemBehavior:
          'Cockatiel circuit breaker trips after 5 consecutive failures. Subsequent requests fail instantly in 0ms with HTTP 503 "Payment Provider Degraded", preserving all internal server sockets.',
      },
    ],
    mathematicalProofOrInvariant:
      "Fault Isolation: UpstreamLatency(Partner) → ∞ ⇒ MaxInternalImpact ≤ 25 concurrent slots ∧ Latency(ZelyInternal) ≤ 15ms.",
    codeSnippet: {
      language: "typescript",
      title: "Cockatiel Policy Composition",
      code: `import { CircuitBreakerPolicy, BulkheadPolicy, ConsecutiveBreaker, wrap, retry, handleAll } from 'cockatiel';

// 1. Concurrency isolation
const bulkhead = BulkheadPolicy(25, 50); // 25 concurrent calls, 50 queued

// 2. Circuit breaker with consecutive error detection
const circuitBreaker = CircuitBreakerPolicy(new ConsecutiveBreaker(5), {
  halfOpenAfter: 15_000,
  samplingDuration: 15_000
});

// 3. Composed resilient policy execution
export const resilientBankClient = wrap(bulkhead, circuitBreaker);`,
    },
  },
  {
    id: "adr-005",
    number: "ADR-005",
    title: "requireConsumerReady middleware",
    status: "PROVEN",
    category: "RESILIENCE",
    summary:
      "Gate mutating financial HTTP endpoints behind Kafka consumer group readiness checks to prevent accepting requests before asynchronous event stream pipelines are operational.",
    problemStatement:
      "During pod startup or rolling deployments, the Express HTTP server may begin listening on port 3000 before the Kafka consumer has connected, joined the group, and been assigned partition offsets. If a user creates a transfer during this window, outbox events emitted to Kafka will not be processed by local consumers, causing processing lag and webhook delivery stalls.",
    chosenSolution:
      "Implement a `requireConsumerReady` middleware that checks `kafkaConsumer.isReady()`. Until the consumer emits the `GROUP_JOIN` event and completes partition assignment, mutating endpoints return HTTP 503 Service Starting (or Kubernetes readiness probes fail traffic routing to this pod).",
    rejectedAlternatives: [
      {
        name: "Optimistic HTTP Start (Listen before Kafka Connect)",
        reason:
          "Produces unhandled event pileups and cold-start race conditions where events sit unconsumed while HTTP handlers report success.",
      },
      {
        name: "Arbitrary `setTimeout(startHttp, 5000)` Delay",
        reason:
          "Unreliable; Kafka brokers may take 1s or 20s to complete coordinator rebalances depending on cluster load.",
      },
    ],
    failureScenariosAndMitigation: [
      {
        scenario:
          "Kafka cluster coordinator is rebalancing partitions during a heavy traffic spike.",
        systemBehavior:
          "Readiness probe reports false. Ingress load balancer routes incoming requests to other healthy pods that have already settled partition assignments.",
      },
    ],
    mathematicalProofOrInvariant:
      "Readiness Condition: MutateEndpoint(Status) = 200 ⇔ ConsumerState == CONSUMING_ACTIVE ∧ PartitionAssignment != ∅.",
    codeSnippet: {
      language: "typescript",
      title: "requireConsumerReady Express Middleware",
      code: `import { Request, Response, NextFunction } from 'express';
import { kafkaConsumerService } from '@/services/kafka.service';

export const requireConsumerReady = (req: Request, res: Response, next: NextFunction) => {
  if (!kafkaConsumerService.isConsumerReady()) {
    return res.status(503).json({
      status: 'error',
      code: 'SERVICE_INITIALIZING',
      message: 'Event stream consumers are synchronizing partition offsets. Please retry shortly.',
      retryAfterSeconds: 3
    });
  }
  next();
};`,
    },
  },
  {
    id: "adr-006",
    number: "ADR-006",
    title: "Per-domain Kafka topics over a single firehose",
    status: "ACCEPTED",
    category: "DISTRIBUTED_SYSTEMS",
    summary:
      "Isolate Kafka event streams into distinct domain-scoped topics (`transfers.v1`, `ledger.v1`, `wallets.v1`, `kyc.v1`) rather than a monolithic shared topic.",
    problemStatement:
      'Publishing all domain events into a single "zely-firehose" topic forces every microservice consumer to deserialize every single message even if irrelevant, creates head-of-line blocking (e.g. slow KYC image OCR blocks instant ledger transfers), and makes schema versioning intractable.',
    chosenSolution:
      "Partition Kafka topics strictly by business domain: `zely.transfers.v1`, `zely.ledger.v1`, `zely.wallets.v1`, `zely.kyc.v1`, and `zely.notifications.v1`. Each domain topic can be configured with independent partition counts, retention policies (compacted for ledger vs 7-day TTL for notifications), and dedicated consumer groups.",
    rejectedAlternatives: [
      {
        name: 'Single Global Topic ("zely-all-events")',
        reason:
          "Head-of-line blocking: Slow consumers on heavy events throttle high-priority real-time ledger balance updates.",
      },
      {
        name: "Topic per Tenant or per User",
        reason:
          "Creates thousands of Kafka topic metadata partitions, exhausting broker ZooKeeper/KRaft memory.",
      },
    ],
    failureScenariosAndMitigation: [
      {
        scenario:
          "Third-party KYC verification service experiences a 5-minute outage, causing KYC event processing to lag.",
        systemBehavior:
          "Only `zely.kyc.v1` consumer group accumulates lag. Real-time transfer and ledger consumers processing `zely.transfers.v1` continue at full sub-10ms throughput.",
      },
    ],
    mathematicalProofOrInvariant:
      "Domain Isolation Invariant: Lag(Topic_A) > 0 ⇏ Throughput(Topic_B) < MaxCapacity. Cross-topic interference is mathematically zero.",
    codeSnippet: {
      language: "typescript",
      title: "Domain Topic Constants and Envelope Routing",
      code: `export const KAFKA_TOPICS = {
  TRANSFERS: 'zely.transfers.v1',
  LEDGER: 'zely.ledger.v1',
  WALLETS: 'zely.wallets.v1',
  KYC: 'zely.kyc.v1',
  NOTIFICATIONS: 'zely.notifications.v1'
} as const;

export function resolveTopicForEvent(eventType: string): string {
  if (eventType.startsWith('TRANSFER_')) return KAFKA_TOPICS.TRANSFERS;
  if (eventType.startsWith('LEDGER_')) return KAFKA_TOPICS.LEDGER;
  if (eventType.startsWith('WALLET_')) return KAFKA_TOPICS.WALLETS;
  if (eventType.startsWith('KYC_')) return KAFKA_TOPICS.KYC;
  return KAFKA_TOPICS.NOTIFICATIONS;
}`,
    },
  },
  {
    id: "adr-007",
    number: "ADR-007",
    title: "Argon2id for passwords and PINs",
    status: "ACCEPTED",
    category: "SECURITY_IDENTITY",
    summary:
      "Standardize on Argon2id (winner of the Password Hashing Competition) with 64MB memory cost to safeguard user passwords and transfer PINs against GPU/ASIC brute-force attacks.",
    problemStatement:
      "Legacy hashing algorithms like MD5 and SHA-256 offer zero resistance to GPU parallelism. Even bcrypt and PBKDF2 are vulnerable to ASIC accelerated dictionary attacks because they are memory-light, allowing attackers to compute billions of hashes per second.",
    chosenSolution:
      "Enforce Argon2id for all user passwords and 4-digit transaction PINs using OWASP recommended parameters: Memory Cost = 64 MB (65,536 KiB), Time Cost (Iterations) = 3, Parallelism = 1 thread. Argon2id combines data-dependent and data-independent memory access to defend against both side-channel timing attacks and GPU-based hash crackers.",
    rejectedAlternatives: [
      {
        name: "bcrypt with cost 10",
        reason:
          "Susceptible to GPU/FPGA hardware acceleration due to low fixed 4KB memory footprint.",
      },
      {
        name: "PBKDF2-HMAC-SHA256",
        reason:
          "Compute-only algorithm lacking memory hardness; trivially parallelized on modern GPU clusters.",
      },
      {
        name: "Argon2d or Argon2i alone",
        reason:
          "Argon2d is vulnerable to side-channel timing attacks; Argon2i is vulnerable to tradeoff attacks. Argon2id provides the hybrid optimum.",
      },
    ],
    failureScenariosAndMitigation: [
      {
        scenario: "Database snapshot is leaked in an offline breach scenario.",
        systemBehavior:
          "Attackers cannot utilize high-speed GPU clusters to crack hashes because each Argon2id hash requires 64MB of dedicated RAM, bounding attacker throughput to negligible speeds.",
      },
    ],
    mathematicalProofOrInvariant:
      "Cost Bound: Cost(Hash) = 64MB RAM × 3 Iterations. An attacker with 16GB GPU memory can run at most 250 parallel attempts.",
    codeSnippet: {
      language: "typescript",
      title: "Argon2id Secure Hashing Implementation",
      code: `import argon2 from 'argon2';

const ARGON2_CONFIG: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16, // 64 MB
  timeCost: 3,         // 3 iterations
  parallelism: 1,      // 1 thread
  hashLength: 32
};

export async function hashCredential(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, ARGON2_CONFIG);
}

export async function verifyCredential(hash: string, plaintext: string): Promise<boolean> {
  return argon2.verify(hash, plaintext);
}`,
    },
  },
  {
    id: "adr-008",
    number: "ADR-008",
    title: "Redis for OTP storage with TTL",
    status: "ACCEPTED",
    category: "STORAGE_ARCHITECTURE",
    summary:
      "Store one-time passcodes (OTPs) and verification tokens in self-expiring Redis keys with atomic single-use invalidation (`GETDEL`) and strict rate limiting.",
    problemStatement:
      "Storing ephemeral 6-digit OTPs in MongoDB creates unneeded disk write overhead, requires background cleanup jobs that lag, and risks replay attacks if tokens are not purged instantly upon first verification.",
    chosenSolution:
      "Store OTPs exclusively in Redis under the key namespace `otp:{userId}:{purpose}` with a strict 300-second (5 minute) TTL. Implement verification using atomic `GETDEL` (or a Lua script) so that reading the OTP destroys it in the same atomic operation, preventing concurrent replay attacks. A sibling counter `otp:attempts:{userId}` enforces a maximum of 3 failed attempts before locking.",
    rejectedAlternatives: [
      {
        name: "MongoDB Collection with TTL Index",
        reason:
          "MongoDB TTL background threads run every 60 seconds; expired tokens can remain valid and queryable for up to a minute.",
      },
      {
        name: "JWT containing signed OTP",
        reason:
          "Stateless tokens cannot be revoked immediately upon first use without maintaining a revocation blacklist anyway.",
      },
    ],
    failureScenariosAndMitigation: [
      {
        scenario:
          "Attacker attempts to brute-force a 6-digit OTP with rapid HTTP requests.",
        systemBehavior:
          "The Redis attempt counter increments on each failure. Upon the 3rd failed attempt, the key is wiped immediately and the user is locked for 15 minutes.",
      },
    ],
    mathematicalProofOrInvariant:
      "Single-Use Invariant: For any token t, VerificationCount(t) ∈ {0, 1}. GETDEL(key) guarantees atomicity across distributed threads.",
    codeSnippet: {
      language: "typescript",
      title: "Atomic Redis OTP Verification",
      code: `export async function verifyAndConsumeOTP(userId: string, purpose: string, candidate: string): Promise<boolean> {
  const otpKey = \`otp:\${userId}:\${purpose}\`;
  const attemptsKey = \`otp:attempts:\${userId}:\${purpose}\`;

  const attempts = await redis.incr(attemptsKey);
  if (attempts === 1) await redis.expire(attemptsKey, 300);
  if (attempts > 3) {
    await redis.del(otpKey);
    throw new Error('Too many failed attempts. OTP has been invalidated.');
  }

  // Atomic fetch and delete to prevent replay
  const storedOtp = await redis.getdel(otpKey);
  if (!storedOtp) return false;

  return storedOtp === candidate;
}`,
    },
  },
  {
    id: "adr-009",
    number: "ADR-009",
    title: "MongoDB transactions with w: majority",
    status: "PROVEN",
    category: "FINANCIAL_INTEGRITY",
    summary:
      "Execute all balance mutations and ledger journals inside MongoDB multi-document transactions configured with write concern `w: majority` and read concern `snapshot`.",
    problemStatement:
      "Default MongoDB standalone operations or `w: 1` write concerns acknowledge writes as soon as the primary writes to memory. If the primary node crashes before replicating to secondaries, acknowledged financial transfers are rolled back, creating phantom deposits.",
    chosenSolution:
      'Require all monetary writes and journal postings to run within `session.withTransaction()` with `writeConcern: { w: "majority", j: true, wtimeout: 5000 }` and `readConcern: { level: "snapshot" }`. This ensures data is safely written to the write-ahead journal on a quorum of replica set nodes before the client receives an HTTP 200.',
    rejectedAlternatives: [
      {
        name: "Write Concern w: 1 (Default)",
        reason:
          "Vulnerable to data loss / rollback upon ungraceful primary election during container failovers.",
      },
      {
        name: "Single Document Updates without Session",
        reason:
          "Cannot guarantee double-entry balance parity across separate sender and receiver wallet documents.",
      },
    ],
    failureScenariosAndMitigation: [
      {
        scenario:
          "Primary MongoDB replica set node suffers sudden hardware power loss during a transfer.",
        systemBehavior:
          "Because `w: majority` required acknowledgment from at least 2 of 3 nodes, the newly elected primary already contains the committed transaction. Zero balance data is lost.",
      },
    ],
    mathematicalProofOrInvariant:
      "Quorum Durability: Let N = 3 be replica set nodes. Quorum Q = ⌊N/2⌋ + 1 = 2. A write is committed iff persisted to ≥ Q nodes.",
    codeSnippet: {
      language: "typescript",
      title: "Quorum ACID Transaction Options",
      code: `import { TransactionOptions } from 'mongodb';

export const FINANCIAL_TRANSACTION_OPTIONS: TransactionOptions = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority', j: true, wtimeout: 5000 },
  readPreference: 'primary'
};

export async function runFinancialTransaction<T>(
  client: MongoClient,
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = client.startSession();
  try {
    return await session.withTransaction(async () => {
      return await fn(session);
    }, FINANCIAL_TRANSACTION_OPTIONS);
  } finally {
    await session.endSession();
  }
}`,
    },
  },
  {
    id: "adr-010",
    number: "ADR-010",
    title: "Append-only ledger as source of truth",
    status: "PROVEN",
    category: "FINANCIAL_INTEGRITY",
    summary:
      "Enforce mathematical double-entry accounting where the append-only journal history is the immutable authoritative source of truth and user balance columns are cached projections.",
    problemStatement:
      "Directly incrementing or decrementing a single `wallet.balance` column without an immutable double-entry journal makes historic reconciliation impossible, hides software bugs, and fails financial regulatory audits.",
    chosenSolution:
      "Every movement of money creates an immutable `Journal` entry containing paired `DEBIT` and `CREDIT` lines such that `∑(Debits) - ∑(Credits) == 0`. Historical journal records are strictly append-only: `UPDATE` and `DELETE` queries on ledger collections are disabled at the database role level. If a dispute or correction occurs, a new compensating journal entry is appended.",
    rejectedAlternatives: [
      {
        name: "Single-Entry Mutating Balance Column Only",
        reason:
          "Zero audit trail; impossible to reconstruct historic balances or prove accounting validity.",
      },
      {
        name: "Mutable Ledger Records (Modifying past transactions)",
        reason:
          "Violates regulatory standards (GAAP, CBN) and destroys cryptographic audit chain.",
      },
    ],
    failureScenariosAndMitigation: [
      {
        scenario:
          "A software bug or rogue admin query attempts to deduct $50 from a user without a credit line.",
        systemBehavior:
          "The ledger invariant validator rejects the write with `UnbalancedJournalError`. Zero records are committed.",
      },
    ],
    mathematicalProofOrInvariant:
      "Zero-Sum Conservation: ∀ j ∈ Journals, ∑(DebitLines(j)) - ∑(CreditLines(j)) = 0. System Total Drift ≡ 0.00.",
    codeSnippet: {
      language: "typescript",
      title: "Double-Entry Invariant Validation Hook",
      code: `export function assertBalancedJournal(journal: { entries: { type: 'DEBIT' | 'CREDIT'; amount: number }[] }): void {
  const sumDebits = journal.entries
    .filter(e => e.type === 'DEBIT')
    .reduce((acc, e) => acc + e.amount, 0);

  const sumCredits = journal.entries
    .filter(e => e.type === 'CREDIT')
    .reduce((acc, e) => acc + e.amount, 0);

  const drift = Math.abs(sumDebits - sumCredits);
  if (drift > 0.0001) {
    throw new Error(\`Double-entry imbalance detected! Debits(\${sumDebits}) != Credits(\${sumCredits}), Drift=\${drift}\`);
  }
}`,
    },
  },
  {
    id: "adr-011",
    number: "ADR-011",
    title: "Idempotency-Key header on mutating endpoints",
    status: "ACCEPTED",
    category: "API_INFRASTRUCTURE",
    summary:
      "Require client-supplied UUIDv4 `Idempotency-Key` headers on all mutating POST/PUT/PATCH financial endpoints, caching response envelopes for 24 hours to prevent duplicate execution.",
    problemStatement:
      "Network timeouts, mobile app retries, and rapid button double-taps frequently cause identical HTTP POST requests to reach API gateways. Without header-level idempotency, each retry creates duplicate financial transfers or vault allocations.",
    chosenSolution:
      "Enforce mandatory `Idempotency-Key: <UUIDv4>` header validation on all mutating routes via Express middleware. The middleware coordinates a two-layer reservation: checking Redis for fast-path in-flight locks, storing the execution promise, and persisting the final serialized response status and body in MongoDB with a 24-hour TTL index. Identical requests replay the cached response instantly.",
    rejectedAlternatives: [
      {
        name: "Server-Generated Hash of Request Body",
        reason:
          "Flawed if a user legitimately intends to perform two identical $50 transfers to the same friend within a few minutes.",
      },
      {
        name: "Client-Side Button Disabling Only",
        reason:
          "Trivially bypassed by network packet retries, browser reloads, or malicious API scripts.",
      },
    ],
    failureScenariosAndMitigation: [
      {
        scenario:
          "Mobile client sends a transfer request, server processes it, but client drops connection before receiving 200 OK.",
        systemBehavior:
          "Client automatically retries with the same Idempotency-Key. Middleware intercepts the key, finds the cached 200 payload, and returns it immediately without re-debiting funds.",
      },
    ],
    mathematicalProofOrInvariant:
      "Idempotence: ∀ key k, Body b: Execute(k, b) = CachedResponse(k). Number of balance mutations = 1.",
    codeSnippet: {
      language: "typescript",
      title: "Idempotency Middleware Engine",
      code: `import { Request, Response, NextFunction } from 'express';

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const key = req.headers['idempotency-key'] as string;
  if (!key) {
    return res.status(400).json({ error: 'Missing required Idempotency-Key header.' });
  }

  const cacheKey = \`idemp:\${req.user?.id || 'anon'}:\${key}\`;
  const existing = await redis.get(cacheKey);

  if (existing) {
    const cached = JSON.parse(existing);
    return res.status(cached.status).json(cached.body);
  }

  // Intercept res.json to cache response
  const originalJson = res.json.bind(res);
  res.json = ((body: any) => {
    if (res.statusCode < 500) {
      redis.set(cacheKey, JSON.stringify({ status: res.statusCode, body }), 'EX', 86400);
    }
    return originalJson(body);
  }) as any;

  next();
};`,
    },
  },
  {
    id: "adr-012",
    number: "ADR-012",
    title: "JWT pair (15m access / 7d refresh) with rotation",
    status: "ACCEPTED",
    category: "SECURITY_IDENTITY",
    summary:
      "Implement dual-token authentication combining short-lived 15-minute access tokens in memory with 7-day single-use rotating refresh tokens stored in secure HttpOnly cookies.",
    problemStatement:
      "Long-lived access tokens stored in browser localStorage are vulnerable to XSS token theft and cannot be revoked without database lookups on every single request. Conversely, purely stateful sessions cause database bottlenecking on every API call.",
    chosenSolution:
      "Issue short-lived 15-minute JWT access tokens (verified statelessly in memory by API gateways) paired with 7-day cryptographically random refresh tokens stored in `HttpOnly, Secure, SameSite=Strict` cookies. Refresh tokens belong to a token family; whenever a refresh token is exchanged, a new pair is issued and the old refresh token is invalidated. If an already-used refresh token is presented, the entire token family is immediately revoked (Automatic Breach Detection).",
    rejectedAlternatives: [
      {
        name: "Single 30-day Access Token in localStorage",
        reason:
          "Extremely high risk: Stolen tokens cannot be revoked until expiration and are vulnerable to XSS script theft.",
      },
      {
        name: "Database Session Lookup on Every API Request",
        reason:
          "Destroys API gateway performance, adding 15–30ms of database latency to every single microservice call.",
      },
    ],
    failureScenariosAndMitigation: [
      {
        scenario:
          "An attacker intercepts an old, already-rotated refresh token from network logs.",
        systemBehavior:
          "The token rotation engine detects that token family version N was reused. It immediately revokes all active tokens for that user, terminating all active sessions and requiring re-authentication.",
      },
    ],
    mathematicalProofOrInvariant:
      "Token Lifetime Invariant: WindowOfVulnerability(Access) ≤ 15m. RefreshTokenUseCount(RT_i) ∈ {0, 1}.",
    codeSnippet: {
      language: "typescript",
      title: "Rotating Refresh Token Exchange Handler",
      code: `export async function rotateRefreshToken(oldToken: string, ipAddress: string) {
  const tokenDoc = await RefreshTokens.findOne({ token: oldToken });
  if (!tokenDoc) throw new UnauthorizedError('Invalid token');

  // Reuse detection: If token was already revoked/replaced, revoke entire family
  if (tokenDoc.isRevoked || tokenDoc.replacedByToken) {
    await RefreshTokens.updateMany({ familyId: tokenDoc.familyId }, { $set: { isRevoked: true } });
    throw new SecurityBreachError('Refresh token reuse detected! All active sessions revoked.');
  }

  // Generate new pair
  const newAccessToken = generateAccessToken({ userId: tokenDoc.userId, role: tokenDoc.role }, '15m');
  const newRefreshToken = generateSecureRandomToken();

  // Atomically mark old token replaced and insert new token
  tokenDoc.replacedByToken = newRefreshToken;
  tokenDoc.isRevoked = true;
  await tokenDoc.save();

  await RefreshTokens.create({
    userId: tokenDoc.userId,
    token: newRefreshToken,
    familyId: tokenDoc.familyId,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}`,
    },
  },
  {
    id: "adr-013",
    number: "ADR-013",
    title: "EmailOutbox separated from main outbox",
    status: "ACCEPTED",
    category: "DISTRIBUTED_SYSTEMS",
    summary:
      "Decouple high-volume, non-critical notification emails into a dedicated `email_outbox` collection, insulating the primary financial ledger CDC pipeline from external SMTP stalls.",
    problemStatement:
      "Writing email notification envelopes into the primary transactional outbox pollutes the core financial event stream. Slow SMTP providers (SendGrid, Mailgun) or large promotional blasts create consumer lag on Kafka topics, delaying mission-critical ledger balance notifications and webhook deliveries.",
    chosenSolution:
      "Separate outbox pipelines into `outbox` (dedicated exclusively to atomic financial ledger and transfer events with strict sub-second SLA) and `email_outbox` (dedicated to marketing, transactional receipts, and alerts). The email outbox uses an asynchronous queue worker with exponential backoff retries and dead-letter queues without touching the financial CDC pipeline.",
    rejectedAlternatives: [
      {
        name: "Shared Monolithic Outbox for All Events & Emails",
        reason:
          "SMTP rate limits and third-party delivery outages cause the core financial CDC processor to fall behind.",
      },
      {
        name: "Direct Inline SMTP Call inside HTTP Request",
        reason:
          "Adds 500–2000ms of synchronous latency to user transfer requests and causes HTTP timeouts if mail servers stall.",
      },
    ],
    failureScenariosAndMitigation: [
      {
        scenario:
          "Third-party email delivery provider experiences a 2-hour global service outage.",
        systemBehavior:
          "Core financial transactions and double-entry ledger journals continue processing at full speed with 0ms lag. Email jobs buffer safely in `email_outbox` and drain automatically when the provider recovers.",
      },
    ],
    mathematicalProofOrInvariant:
      "Pipeline Independence: Latency(LedgerPipeline) ⊥ Latency(EmailProvider). Outage in email service has zero effect on financial transactions.",
    codeSnippet: {
      language: "typescript",
      title: "Decoupled Email Outbox Dispatcher",
      code: `// Inside transfer transaction: only core financial outbox is written
await Outbox.insertOne({
  eventType: 'TRANSFER_COMPLETED',
  aggregateId: transfer.id,
  payload: { transferId: transfer.id, amount: transfer.amount }
}, { session });

// Asynchronous handler emits email outbox job in decoupled background queue
export async function queueReceiptEmail(transfer: TransferRecord) {
  await EmailOutbox.insertOne({
    recipient: transfer.senderEmail,
    templateId: 'TRANSFER_RECEIPT_V1',
    variables: { amount: transfer.amount, date: new Date().toISOString() },
    status: 'QUEUED',
    attempts: 0,
    nextAttemptAt: new Date()
  });
}`,
    },
  },
];
