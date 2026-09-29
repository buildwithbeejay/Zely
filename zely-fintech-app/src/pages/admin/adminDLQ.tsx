import React, { useState, useEffect, useMemo } from "react";
import {
  AlertOctagon,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Search,
  Filter,
  ChevronRight,
  Terminal,
  ExternalLink,
  Layers,
  AlertTriangle,
  X,
  Loader2,
  Play,
  Database,
  ArrowRight,
  ShieldAlert,
  Cpu,
} from "lucide-react";

import { useToast } from "../../context/ToastContext";
import { DLQEvent, dlqService } from "@/services/dlq.service";

export const AdminDLQScreen: React.FC = () => {
  const { showToast } = useToast();

  const [events, setEvents] = useState<DLQEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [replayingEventId, setReplayingEventId] = useState<string | null>(null);
  const [replayingTopic, setReplayingTopic] = useState<string | null>(null);

  // Inspect Modal State
  const [inspectEvent, setInspectEvent] = useState<DLQEvent | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING" | "REPLAYED"
  >("ALL");

  // Load events
  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await dlqService.getEvents();
      setEvents(data);
    } catch (err: any) {
      showToast("error", "Failed to load DLQ events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Copy helper
  const handleCopyId = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Replay single event: calls POST /admin/dlq/replay/:eventId
  const handleReplayEvent = async (eventId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReplayingEventId(eventId);

    try {
      const result = await dlqService.replayEvent(eventId);
      if (result.success) {
        showToast("success", `Event ${eventId} replayed successfully`);
        // Update state in place
        setEvents((prev) =>
          prev.map((item) =>
            item.eventId === eventId
              ? {
                  ...item,
                  status: "replayed" as const,
                  replayedAt: result.replayedAt,
                }
              : item,
          ),
        );
        if (inspectEvent && inspectEvent.eventId === eventId) {
          setInspectEvent((prev: any) =>
            prev
              ? {
                  ...prev,
                  status: "replayed" as const,
                  replayedAt: result.replayedAt,
                }
              : null,
          );
        }
      }
    } catch (err: any) {
      showToast("error", `Failed to replay event ${eventId}`);
    } finally {
      setReplayingEventId(null);
    }
  };

  // Replay bulk by topic: bulk replay all pending events for a specific topic
  const handleReplayTopic = async (topic: string) => {
    const pendingInTopic = events.filter(
      (e) => e.topic === topic && e.status !== "replayed",
    );
    if (pendingInTopic.length === 0) {
      showToast("error", `No pending events for topic ${topic}`);
      return;
    }

    setReplayingTopic(topic);
    try {
      const result = await dlqService.replayByTopic(topic);
      if (result.success) {
        showToast(
          "success",
          `Replayed ${result.replayedCount} events for topic "${topic}"`,
        );
        setEvents((prev) =>
          prev.map((item) =>
            item.topic === topic && item.status !== "replayed"
              ? {
                  ...item,
                  status: "replayed" as const,
                  replayedAt: result.replayedAt,
                }
              : item,
          ),
        );
        if (inspectEvent && inspectEvent.topic === topic) {
          setInspectEvent((prev: any) =>
            prev
              ? {
                  ...prev,
                  status: "replayed" as const,
                  replayedAt: result.replayedAt,
                }
              : null,
          );
        }
      }
    } catch (err: any) {
      showToast("error", `Failed to replay events for topic ${topic}`);
    } finally {
      setReplayingTopic(null);
    }
  };

  // Reset sample data for testing
  const handleResetQueue = () => {
    const reset = dlqService.resetSampleEvents();
    setEvents(reset);
    showToast("success", "DLQ sample queue restored to initial pending state");
  };

  // Group topics & counts
  const topicsSummary = useMemo(() => {
    const summary: Record<
      string,
      { total: number; pending: number; replayed: number }
    > = {};
    events.forEach((ev) => {
      if (!summary[ev.topic]) {
        summary[ev.topic] = { total: 0, pending: 0, replayed: 0 };
      }
      summary[ev.topic].total += 1;
      if (ev.status === "replayed") {
        summary[ev.topic].replayed += 1;
      } else {
        summary[ev.topic].pending += 1;
      }
    });
    return summary;
  }, [events]);

  const uniqueTopics = useMemo(
    () => Object.keys(topicsSummary),
    [topicsSummary],
  );

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = ev.eventId.toLowerCase().includes(q);
        const matchesTopic = ev.topic.toLowerCase().includes(q);
        const matchesError = ev.error.toLowerCase().includes(q);
        if (!matchesId && !matchesTopic && !matchesError) return false;
      }

      // Topic Filter
      if (selectedTopic !== "ALL" && ev.topic !== selectedTopic) {
        return false;
      }

      // Status Filter
      if (statusFilter === "PENDING" && ev.status === "replayed") {
        return false;
      }
      if (statusFilter === "REPLAYED" && ev.status !== "replayed") {
        return false;
      }

      return true;
    });
  }, [events, searchQuery, selectedTopic, statusFilter]);

  // Overall Stats
  const totalPending = useMemo(
    () => events.filter((e) => e.status !== "replayed").length,
    [events],
  );
  const totalReplayed = useMemo(
    () => events.filter((e) => e.status === "replayed").length,
    [events],
  );

  // Helper for topic colors
  const getTopicColor = (topic: string) => {
    switch (topic) {
      case "PAYMENT_SETTLED":
        return "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "WALLET_CREDIT":
        return "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "KYC_TIER_UPGRADE":
        return "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "TRANSFER_DISPATCH":
        return "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  // Helper to format date
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  // Relative time helper
  const getRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return "";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 dark:bg-red-950/50 rounded-2xl text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Dead Letter Queue (DLQ)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Authoritative event consumer poison pill inspection & idempotent
                replay management
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadEvents}
            disabled={loading}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold font-mono flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-600" : ""}`}
            />
            <span>Refresh Queue</span>
          </button>

          <button
            onClick={handleResetQueue}
            className="px-4 py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold font-mono flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Seed</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Pending DLQ Events */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Pending Events
            </span>
            <div className="p-1.5 bg-amber-100 dark:bg-amber-950/40 text-amber-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-amber-600 dark:text-amber-400">
              {totalPending}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              events requiring replay
            </span>
          </div>
        </div>

        {/* Metric 2: Successfully Replayed */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Replayed & Recovered
            </span>
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {totalReplayed}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              with replay timestamps
            </span>
          </div>
        </div>

        {/* Metric 3: Impacted Topics */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Impacted Topics
            </span>
            <div className="p-1.5 bg-blue-100 dark:bg-blue-950/40 text-blue-600 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-blue-600 dark:text-blue-400">
              {uniqueTopics.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              active dead letter partitions
            </span>
          </div>
        </div>

        {/* Metric 4: Max Retries Exhausted */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Max Retries Reach
            </span>
            <div className="p-1.5 bg-purple-100 dark:bg-purple-950/40 text-purple-600 rounded-lg">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-purple-600 dark:text-purple-400">
              {
                events.filter(
                  (e) =>
                    e.retryCount >= e.maxRetries && e.status !== "replayed",
                ).length
              }
            </span>
            <span className="text-xs text-slate-500 font-medium">
              exhausted 5/5 backoffs
            </span>
          </div>
        </div>
      </div>

      {/* Replay by Topic (Bulk Action Section) */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Replay by Topic (Bulk Actions)</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Bulk dispatch and replay all pending dead-letter events for an
              entire event stream topic simultaneously.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
          {uniqueTopics.map((topic) => {
            const stat = topicsSummary[topic];
            const isReplayingThis = replayingTopic === topic;
            const hasPending = stat.pending > 0;

            return (
              <div
                key={topic}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col justify-between gap-3"
              >
                <div>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold border ${getTopicColor(topic)} mb-2`}
                  >
                    {topic}
                  </span>
                  <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-slate-400">
                    <span>
                      Pending:{" "}
                      <b className="text-amber-600 dark:text-amber-400">
                        {stat.pending}
                      </b>
                    </span>
                    <span>
                      Replayed:{" "}
                      <b className="text-emerald-600 dark:text-emerald-400">
                        {stat.replayed}
                      </b>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleReplayTopic(topic)}
                  disabled={!hasPending || isReplayingThis}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    hasPending
                      ? "bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                  }`}
                >
                  {isReplayingThis ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Replaying Topic...</span>
                    </>
                  ) : hasPending ? (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Replay All ({stat.pending}) in Topic</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>All Clear in Topic</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Events Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {/* Table Controls (Search & Filters) */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-slate-50/50 dark:bg-slate-900">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by eventId, topic, or error snippet..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Topic Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase font-mono">
                Topic:
              </span>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600 cursor-pointer"
              >
                <option value="ALL">All Topics ({events.length})</option>
                {uniqueTopics.map((t) => (
                  <option key={t} value={t}>
                    {t} ({topicsSummary[t].total})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter Toggle */}
            <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl text-xs font-mono font-bold">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All ({events.length})
              </button>
              <button
                onClick={() => setStatusFilter("PENDING")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "PENDING"
                    ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Pending ({totalPending})
              </button>
              <button
                onClick={() => setStatusFilter("REPLAYED")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "REPLAYED"
                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Replayed ({totalReplayed})
              </button>
            </div>
          </div>
        </div>

        {/* Table of DLQ Events */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            <p className="text-sm font-mono font-medium">
              Fetching dead letter queue events from event bus...
            </p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              No Matching DLQ Events
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All messages in the current filter criteria have been successfully
              replayed or no poison pills match your search query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Event ID & Topic</th>
                  <th className="py-3.5 px-6">Error Cause</th>
                  <th className="py-3.5 px-6">Failed At</th>
                  <th className="py-3.5 px-6">Retries</th>
                  <th className="py-3.5 px-6">Status & Replayed Timestamp</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredEvents.map((event) => {
                  const isReplaying = replayingEventId === event.eventId;
                  const isReplayed = event.status === "replayed";

                  return (
                    <tr
                      key={event.eventId}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Column 1: Event ID & Topic */}
                      <td className="py-4 px-6 align-top">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {event.eventId}
                            </span>
                            <button
                              onClick={(e) => handleCopyId(event.eventId, e)}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors"
                              title="Copy eventId"
                            >
                              {copiedId === event.eventId ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getTopicColor(event.topic)}`}
                          >
                            {event.topic}
                          </span>
                        </div>
                      </td>

                      {/* Column 2: Error message */}
                      <td className="py-4 px-6 align-top max-w-xs sm:max-w-md">
                        <div className="space-y-1">
                          <p className="text-slate-800 dark:text-slate-200 font-medium line-clamp-2 leading-relaxed font-mono text-[11px]">
                            {event.error}
                          </p>
                          <button
                            onClick={() => setInspectEvent(event)}
                            className="text-[11px] font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1 font-mono cursor-pointer"
                          >
                            <span>Inspect Payload & Stack Trace</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Column 3: Failed At */}
                      <td className="py-4 px-6 align-top whitespace-nowrap">
                        <div className="space-y-0.5">
                          <p className="font-mono font-medium text-slate-900 dark:text-white text-[11px]">
                            {formatDate(event.failedAt)}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400">
                            <Clock className="w-3 h-3" />
                            {getRelativeTime(event.failedAt)}
                          </span>
                        </div>
                      </td>

                      {/* Column 4: Retry count */}
                      <td className="py-4 px-6 align-top whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                              event.retryCount >= event.maxRetries
                                ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            }`}
                          >
                            {event.retryCount} / {event.maxRetries} Retries
                          </span>
                          <span className="block text-[10px] font-mono text-slate-400">
                            {event.sourceService || "worker-instance"}
                          </span>
                        </div>
                      </td>

                      {/* Column 5: Status & Replayed Timestamp Indicator */}
                      <td className="py-4 px-6 align-top whitespace-nowrap">
                        {isReplayed ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-mono font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Replayed</span>
                            </span>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <span className="text-slate-400">At:</span>
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                {formatDate(event.replayedAt)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-mono font-bold">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Pending Replay</span>
                            </span>
                            <span className="block text-[10px] font-mono text-slate-400">
                              Awaiting dispatch
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Column 6: Actions */}
                      <td className="py-4 px-6 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleReplayEvent(event.eventId)}
                            disabled={isReplaying}
                            title="Calls POST /admin/dlq/replay/:eventId"
                            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              isReplayed
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                                : "bg-purple-600 hover:bg-purple-700 text-white shadow-sm hover:shadow"
                            }`}
                          >
                            {isReplaying ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Replaying...</span>
                              </>
                            ) : isReplayed ? (
                              <>
                                <RotateCcw className="w-3 h-3 text-slate-500" />
                                <span>Re-run</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 fill-current" />
                                <span>Replay</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs font-mono text-slate-500">
          <span>
            Showing {filteredEvents.length} of {events.length} DLQ records
          </span>
          <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400 font-bold">
            <Cpu className="w-3.5 h-3.5" />
            <span>Endpoint: POST /admin/dlq/replay/:eventId</span>
          </span>
        </div>
      </div>

      {/* Inspect Event Modal */}
      {inspectEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-950/40 text-purple-600 rounded-xl">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white font-mono">
                    {inspectEvent.eventId}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`px-2 py-0.2 rounded text-[10px] font-mono font-bold border ${getTopicColor(inspectEvent.topic)}`}
                    >
                      {inspectEvent.topic}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Worker: {inspectEvent.sourceService || "ledger-worker"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setInspectEvent(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs font-mono">
              {/* Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  inspectEvent.status === "replayed"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {inspectEvent.status === "replayed" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-600" />
                  )}
                  <div>
                    <span className="font-bold text-sm block">
                      {inspectEvent.status === "replayed"
                        ? "Event Replayed"
                        : "Pending Replay Dispatch"}
                    </span>
                    <span className="text-[11px] opacity-80">
                      {inspectEvent.status === "replayed"
                        ? `Replayed at: ${formatDate(inspectEvent.replayedAt)}`
                        : `Failed at: ${formatDate(inspectEvent.failedAt)} (${getRelativeTime(inspectEvent.failedAt)})`}
                    </span>
                  </div>
                </div>

                <span className="font-bold">
                  {inspectEvent.retryCount} of {inspectEvent.maxRetries} Retries
                  Exhausted
                </span>
              </div>

              {/* Error Breakdown */}
              <div className="space-y-2">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  Root Cause Exception
                </span>
                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl text-red-700 dark:text-red-300 font-medium">
                  {inspectEvent.error}
                </div>
              </div>

              {/* Stack Trace */}
              {inspectEvent.stackTrace && (
                <div className="space-y-2">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    Internal Worker Stack Trace
                  </span>
                  <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl overflow-x-auto text-[11px] leading-relaxed border border-slate-800">
                    {inspectEvent.stackTrace}
                  </pre>
                </div>
              )}

              {/* Payload JSON */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    Message Payload (Kafka / SQS Record)
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(inspectEvent.payload, null, 2),
                      );
                      setCopiedPayload(true);
                      setTimeout(() => setCopiedPayload(false), 2000);
                    }}
                    className="text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1 font-bold cursor-pointer"
                  >
                    {copiedPayload ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedPayload ? "Copied" : "Copy Payload"}</span>
                  </button>
                </div>

                <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto text-[11px] leading-relaxed border border-slate-800">
                  {JSON.stringify(inspectEvent.payload, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-between">
              <span className="text-slate-400 font-mono text-[11px]">
                Target Endpoint:{" "}
                <code className="text-purple-600 font-bold">
                  POST /admin/dlq/replay/{inspectEvent.eventId}
                </code>
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setInspectEvent(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold font-mono text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>

                <button
                  onClick={() => handleReplayEvent(inspectEvent.eventId)}
                  disabled={replayingEventId === inspectEvent.eventId}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold font-mono text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {replayingEventId === inspectEvent.eventId ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Replaying...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Execute Replay Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDLQScreen;
