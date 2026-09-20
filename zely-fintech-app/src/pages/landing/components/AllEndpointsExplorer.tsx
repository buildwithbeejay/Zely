import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Terminal,
  Search,
  Filter,
  Copy,
  Check,
  ShieldCheck,
  Layers,
  ChevronRight,
  ExternalLink,
  Lock,
  Zap,
  Tag,
  Code2,
} from "lucide-react";
import {
  ALL_64_ENDPOINTS,
  DOMAIN_CATEGORIES,
  ApiEndpointItem,
} from "../data/endpointsData";

export const AllEndpointsExplorer: React.FC = () => {
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedEndpointId, setSelectedEndpointId] =
    useState<string>("transfers-1");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter endpoints
  const filteredEndpoints = ALL_64_ENDPOINTS.filter((ep) => {
    const matchesDomain =
      selectedDomain === "all" || ep.domain === selectedDomain;
    const matchesMethod = methodFilter === "ALL" || ep.method === methodFilter;
    const matchesSearch =
      searchQuery === "" ||
      ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDomain && matchesMethod && matchesSearch;
  });

  const currentEndpoint =
    ALL_64_ENDPOINTS.find((e) => e.id === selectedEndpointId) ||
    ALL_64_ENDPOINTS[0];

  const handleCopyCurl = (ep: ApiEndpointItem) => {
    const curl = ep.requestBody
      ? `curl -X ${ep.method} "https://api.zely.dev${ep.path}" \\\n  -H "Content-Type: application/json" \\\n  ${ep.requiresAuth ? '-H "Authorization: Bearer eyJhbGciOi..." \\\n  ' : ""}${ep.requiresIdempotency ? '-H "x-idempotency-key: 550e8400-e29b-41d4-a716-446655440000" \\\n  ' : ""}-d '${ep.requestBody}'`
      : `curl -X ${ep.method} "https://api.zely.dev${ep.path}"${ep.requiresAuth ? ' \\\n  -H "Authorization: Bearer eyJhbGciOi..."' : ""}`;

    navigator.clipboard.writeText(curl);
    setCopiedId(ep.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "POST":
        return "bg-purple-50 text-purple-800 border-purple-200";
      case "PUT":
      case "PATCH":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "DELETE":
        return "bg-rose-50 text-rose-800 border-rose-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden text-slate-900 font-mono">
      {/* Header & Meta */}
      <div className="p-5 sm:p-6 bg-white border-b border-[#E5E7EB] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-slate-900" />
              <h3 className="text-base sm:text-lg font-extrabold text-slate-950 tracking-tight">
                64 API ENDPOINTS SPECIFICATION & LIVE CONTRACTS
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-xs font-bold">
                v2.4 REST
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium max-w-2xl">
              Complete, production-ready REST contracts covering all 11
              sub-systems with parameter schemas, error responses, and
              idempotency guarantees.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className="px-3 py-1.5 rounded-xl bg-[#FBFBF9] border border-[#E5E7EB]">
              Total Endpoints:{" "}
              <strong className="text-slate-950">
                {ALL_64_ENDPOINTS.length}
              </strong>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
              11 Domains
            </span>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
          {/* Search */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by path, title, or description (e.g. /transfers, /ledger)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#FBFBF9] border border-[#E5E7EB] rounded-xl text-xs font-medium text-slate-950 placeholder-slate-400 focus:outline-none focus:border-slate-900"
            />
          </div>

          {/* Method Filter */}
          <div className="md:col-span-6 flex flex-wrap items-center gap-1.5 justify-end">
            <span className="text-[11px] text-slate-500 font-bold uppercase mr-1">
              Method:
            </span>
            {["ALL", "GET", "POST", "DELETE"].map((m) => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  methodFilter === m
                    ? "bg-slate-900 text-white"
                    : "bg-[#FBFBF9] text-slate-600 hover:text-slate-950 border border-[#E5E7EB]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Domain Tabs List */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1">
          {DOMAIN_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedDomain(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedDomain === cat.id
                  ? "bg-slate-900 text-white"
                  : "bg-[#FBFBF9] text-slate-600 hover:text-slate-950 hover:bg-slate-100 border border-[#E5E7EB]"
              }`}
            >
              <span>{cat.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedDomain === cat.id
                    ? "bg-slate-700 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Body: Left List (5 cols) & Right Contract Inspector (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#E5E7EB]">
        {/* Left Side: Endpoints List */}
        <div className="lg:col-span-5 max-h-[640px] overflow-y-auto divide-y divide-[#E5E7EB] bg-[#FBFBF9]">
          {filteredEndpoints.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No endpoints matched your search criteria.
            </div>
          ) : (
            filteredEndpoints.map((ep) => {
              const isSelected = selectedEndpointId === ep.id;
              return (
                <button
                  key={ep.id}
                  onClick={() => setSelectedEndpointId(ep.id)}
                  className={`w-full text-left p-3.5 sm:p-4 flex items-start justify-between gap-3 transition-colors ${
                    isSelected
                      ? "bg-white border-l-4 border-slate-900"
                      : "hover:bg-white"
                  }`}
                >
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getMethodBadgeClass(ep.method)}`}
                      >
                        {ep.method}
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {ep.path}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-700 truncate">
                      {ep.title}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      {ep.requiresAuth && (
                        <span className="flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Auth
                        </span>
                      )}
                      {ep.requiresIdempotency && (
                        <span className="flex items-center gap-1 text-purple-700 font-semibold">
                          <Zap className="w-2.5 h-2.5" /> Idempotent
                        </span>
                      )}
                      <span>Status: {ep.status}</span>
                    </div>
                  </div>

                  <ChevronRight
                    className={`w-4 h-4 mt-1 shrink-0 ${isSelected ? "text-slate-900" : "text-slate-400"}`}
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Right Side: Contract Deep-Dive & Test Pane */}
        <div className="lg:col-span-7 p-5 sm:p-6 bg-white overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentEndpoint.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* Header & Meta for Selected Endpoint */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-bold border ${getMethodBadgeClass(currentEndpoint.method)}`}
                    >
                      {currentEndpoint.method}
                    </span>
                    <code className="text-sm font-bold text-slate-950">
                      {currentEndpoint.path}
                    </code>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {currentEndpoint.title}
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    {currentEndpoint.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                  <button
                    onClick={() => handleCopyCurl(currentEndpoint)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#FBFBF9] hover:bg-slate-100 border border-[#E5E7EB] text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {copiedId === currentEndpoint.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedId === currentEndpoint.id
                        ? "Copied cURL"
                        : "Copy cURL"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Security & Invariant Rules */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#FBFBF9] border border-[#E5E7EB]">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                    Authorization
                  </span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    {currentEndpoint.requiresAuth ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-slate-900" />
                        <span>Bearer JWT (HMAC SHA256)</span>
                      </>
                    ) : (
                      <span>Public Endpoint</span>
                    )}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#FBFBF9] border border-[#E5E7EB]">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                    Idempotency Guarantee
                  </span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    {currentEndpoint.requiresIdempotency ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
                        <span className="text-purple-800">
                          Two-Layer Lock (120s TTL)
                        </span>
                      </>
                    ) : (
                      <span>Idempotent Read / Statless</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Request Payload */}
              {currentEndpoint.requestBody && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>REQUEST PAYLOAD (JSON)</span>
                    <span className="text-slate-400 font-normal">
                      application/json
                    </span>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-slate-950 text-purple-200 text-xs overflow-x-auto border border-slate-800 leading-relaxed">
                    <code>{currentEndpoint.requestBody}</code>
                  </pre>
                </div>
              )}

              {/* Response Payload */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>
                    RESPONSE PAYLOAD (STATUS {currentEndpoint.status})
                  </span>
                  <span className="text-emerald-700 font-bold">
                    200 OK · 14ms latency
                  </span>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 text-emerald-300 text-xs overflow-x-auto border border-slate-800 leading-relaxed">
                  <code>{currentEndpoint.responseBody}</code>
                </pre>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 bg-[#FBFBF9] border-t border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>
            All 64 endpoints include OpenAPI / Swagger JSON schemas in the
            private gateway repository.
          </span>
        </div>
        <span className="text-slate-500 font-bold">
          Engineered for Zero Downtime
        </span>
      </div>
    </div>
  );
};
