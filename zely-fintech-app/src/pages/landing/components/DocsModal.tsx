import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Server,
  ShieldCheck,
  Layers,
  Workflow,
  Terminal,
  Check,
  Copy,
  ChevronRight,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ALL_64_ENDPOINTS, DOMAIN_CATEGORIES } from "../data/endpointsData";

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [selectedSection, setSelectedSection] = useState<
    "overview" | "idempotency" | "ledger" | "endpoints" | "reconciliation"
  >("overview");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [endpointSearch, setEndpointSearch] = useState<string>("");

  const copySnippet = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredEndpoints = ALL_64_ENDPOINTS.filter(
    (ep) =>
      ep.path.toLowerCase().includes(endpointSearch.toLowerCase()) ||
      ep.title.toLowerCase().includes(endpointSearch.toLowerCase()),
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xs"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="bg-white border border-[#E5E7EB] rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 font-mono"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#FBFBF9]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
                  Z
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
                    <span>ZELY BACKEND SPECIFICATION & 64 API REFERENCE</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                      v2.4.0 REST
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Distributed systems architecture, idempotency rules &
                    endpoints
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onClose();
                    navigate("/login");
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  Open Dashboard
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Sidebar + Main Content */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Docs Navigation Sidebar */}
              <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#E5E7EB] bg-[#FBFBF9] p-4 space-y-1.5 overflow-y-auto shrink-0 text-xs">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold px-2 mb-2">
                  Architecture Specs
                </div>

                <button
                  onClick={() => setSelectedSection("overview")}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors font-semibold ${
                    selectedSection === "overview"
                      ? "bg-slate-900 text-white font-bold shadow-sm"
                      : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5" />
                    <span>System Architecture</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setSelectedSection("idempotency")}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors font-semibold ${
                    selectedSection === "idempotency"
                      ? "bg-slate-900 text-white font-bold shadow-sm"
                      : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Two-Layer Idempotency</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setSelectedSection("ledger")}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors font-semibold ${
                    selectedSection === "ledger"
                      ? "bg-slate-900 text-white font-bold shadow-sm"
                      : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Double-Entry Invariants</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setSelectedSection("reconciliation")}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors font-semibold ${
                    selectedSection === "reconciliation"
                      ? "bg-slate-900 text-white font-bold shadow-sm"
                      : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Workflow className="w-3.5 h-3.5" />
                    <span>3-Layer Reconciliation</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold px-2 pt-4 mb-2">
                  API References
                </div>

                <button
                  onClick={() => setSelectedSection("endpoints")}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors font-semibold ${
                    selectedSection === "endpoints"
                      ? "bg-slate-900 text-white font-bold shadow-sm"
                      : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>All 64 Endpoints Map</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Main Docs Content Area */}
              <div className="flex-1 p-6 sm:p-8 overflow-y-auto bg-white text-slate-900 space-y-6">
                {selectedSection === "overview" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-950 mb-2">
                        System Architecture & High-Availability Runtime
                      </h3>
                      <p className="text-sm text-slate-700 font-medium leading-relaxed">
                        Zely is structured as a resilient fintech platform
                        designed for high transaction throughput, zero
                        double-debit vulnerability, and automated drift
                        reconciliation.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[#E5E7EB]">
                        <h4 className="text-xs font-bold text-slate-950 mb-1 flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5 text-slate-900" />
                          CORE SERVICE RUNTIME
                        </h4>
                        <p className="text-xs text-slate-600 font-medium">
                          Node.js runtime with strict TypeScript types, Express
                          routers, Cockatiel circuit breakers, and rate
                          limiters.
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[#E5E7EB]">
                        <h4 className="text-xs font-bold text-slate-950 mb-1 flex items-center gap-1.5">
                          <Workflow className="w-3.5 h-3.5 text-slate-900" />
                          TRANSACTIONAL OUTBOX + CDC
                        </h4>
                        <p className="text-xs text-slate-600 font-medium">
                          Mutations write directly to outbox collections inside
                          the primary ACID transaction. Debezium streams events
                          to Kafka.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[#E5E7EB] space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-950">
                          SAMPLE ENVIRONMENT CONFIGURATION (.env)
                        </h4>
                        <button
                          onClick={() =>
                            copySnippet(
                              `PORT=3000\nNODE_ENV=production\nMONGODB_URI=mongodb://replica01,replica02/zely?replicaSet=rs0\nREDIS_CLUSTER_URL=redis://cluster.zely.internal:6379\nKAFKA_BROKERS=kafka-1:9092,kafka-2:9092\nPAYSTACK_SECRET_KEY=sk_live_...\nRESEND_API_KEY=re_...\nJWT_SECRET=...`,
                              "env",
                            )
                          }
                          className="text-xs text-slate-600 hover:text-slate-950 flex items-center gap-1 font-bold"
                        >
                          {copiedCode === "env" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {copiedCode === "env" ? "Copied" : "Copy"}
                          </span>
                        </button>
                      </div>
                      <pre className="p-3.5 rounded-lg bg-slate-950 text-emerald-300 text-xs overflow-x-auto border border-slate-800 leading-relaxed">
                        <code>{`PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://replica01,replica02/zely?replicaSet=rs0
REDIS_CLUSTER_URL=redis://cluster.zely.internal:6379
KAFKA_BROKERS=kafka-1:9092,kafka-2:9092
PAYSTACK_SECRET_KEY=sk_live_...
RESEND_API_KEY=re_...
JWT_SECRET=...`}</code>
                      </pre>
                    </div>
                  </div>
                )}

                {selectedSection === "idempotency" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-950 mb-2">
                        Two-Layer Distributed Idempotency Specification
                      </h3>
                      <p className="text-sm text-slate-700 font-medium leading-relaxed">
                        Zely prevents double-debited transfers across retried
                        HTTP requests, network timeouts, and consumer crashes
                        using a 2-stage lock.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[#E5E7EB]">
                        <h4 className="text-xs font-bold text-slate-950 mb-1">
                          LAYER 1: Redis Key Reservation (Fast Path)
                        </h4>
                        <p className="text-xs text-slate-600 font-medium">
                          When a transfer arrives with header{" "}
                          <code className="text-slate-900 font-bold">
                            x-idempotency-key: [UUID]
                          </code>
                          , the API attempts an atomic Redis SET NX with a 120s
                          TTL. If duplicate, returns HTTP 409 or cached
                          response.
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-[#FBFBF9] border border-[#E5E7EB]">
                        <h4 className="text-xs font-bold text-slate-950 mb-1">
                          LAYER 2: MongoDB Unique Index & Atomic Upsert
                          (Authoritative)
                        </h4>
                        <p className="text-xs text-slate-600 font-medium">
                          In the database layer, transactions create an
                          idempotency log document with a unique compound index{" "}
                          <code className="text-slate-900 font-bold">
                            {"{ userId: 1, idempotencyKey: 1 }"}
                          </code>
                          .
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedSection === "ledger" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-950 mb-2">
                        Double-Entry Invariant Rules
                      </h3>
                      <p className="text-sm text-slate-700 font-medium leading-relaxed">
                        Every monetary movement is recorded as a balanced
                        Journal entry containing at least one debit and one
                        credit.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                      <div className="font-bold mb-1">
                        MATHEMATICAL INVARIANT:
                      </div>
                      <code className="font-bold">
                        SUM(journal.debits) - SUM(journal.credits) == 0.00
                      </code>
                    </div>
                  </div>
                )}

                {selectedSection === "reconciliation" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-950 mb-2">
                        Three-Layer Automated Reconciliation Engine
                      </h3>
                      <p className="text-sm text-slate-700 font-medium leading-relaxed">
                        Scheduled cron workers and manual administrative
                        endpoints execute three independent audits:
                      </p>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="p-3.5 rounded-lg bg-[#FBFBF9] border border-[#E5E7EB]">
                        <span className="text-slate-950 font-bold">
                          1. Internal Ledger Balance vs Wallet Aggregate:
                        </span>
                        <p className="text-slate-600 text-xs mt-1 font-medium">
                          Compares the calculated sum of ledger journal entries
                          with the wallet balance snapshot.
                        </p>
                      </div>
                      <div className="p-3.5 rounded-lg bg-[#FBFBF9] border border-[#E5E7EB]">
                        <span className="text-emerald-800 font-bold">
                          2. Paystack Webhook Settlement Parity:
                        </span>
                        <p className="text-slate-600 text-xs mt-1 font-medium">
                          Fetches external Paystack transactions via API and
                          verifies every charge was credited to the user wallet.
                        </p>
                      </div>
                      <div className="p-3.5 rounded-lg bg-[#FBFBF9] border border-[#E5E7EB]">
                        <span className="text-slate-950 font-bold">
                          3. Zero-Sum Invariant Checker:
                        </span>
                        <p className="text-slate-600 text-xs mt-1 font-medium">
                          Verifies the system-wide balance of all asset,
                          liability, and equity accounts equals 0.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedSection === "endpoints" && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h3 className="text-lg font-extrabold text-slate-950">
                        64 Core Endpoints Across 11 Domains
                      </h3>
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Filter endpoints..."
                          value={endpointSearch}
                          onChange={(e) => setEndpointSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-[#FBFBF9] border border-[#E5E7EB] rounded-lg text-xs font-medium focus:outline-none focus:border-slate-900"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 text-xs max-h-[500px] overflow-y-auto pr-1">
                      {DOMAIN_CATEGORIES.filter((c) => c.id !== "all").map(
                        (cat) => {
                          const endpointsInCat = filteredEndpoints.filter(
                            (ep) => ep.domain === cat.id,
                          );
                          if (endpointsInCat.length === 0) return null;

                          return (
                            <div
                              key={cat.id}
                              className="p-4 rounded-xl bg-[#FBFBF9] border border-[#E5E7EB] space-y-2"
                            >
                              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                                <span className="font-bold text-slate-950">
                                  {cat.name}
                                </span>
                                <span className="text-[11px] text-slate-500 font-bold">
                                  {endpointsInCat.length} endpoints
                                </span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                                {endpointsInCat.map((ep) => (
                                  <div
                                    key={ep.id}
                                    className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          ep.method === "POST"
                                            ? "bg-purple-50 text-purple-800"
                                            : "bg-emerald-50 text-emerald-800"
                                        }`}
                                      >
                                        {ep.method}
                                      </span>
                                      <code className="font-bold text-slate-900 text-xs truncate">
                                        {ep.path}
                                      </code>
                                    </div>
                                    <p className="text-[11px] text-slate-600 truncate">
                                      {ep.title}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-[#E5E7EB] bg-[#FBFBF9] flex items-center justify-between text-xs text-slate-500">
              <span>Engineered by Mobolaji Beejay (DevMobolaji)</span>
              <button
                onClick={onClose}
                className="hover:text-slate-900 transition-colors font-bold cursor-pointer"
              >
                Close Specification [ESC]
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
