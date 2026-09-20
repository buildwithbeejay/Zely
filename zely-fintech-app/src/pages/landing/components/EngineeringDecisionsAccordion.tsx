import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Scale,
  Search,
  ArrowUpRight,
  ListFilter
} from 'lucide-react';
import { ARCHITECTURAL_DECISIONS, ArchitecturalDecision } from '../data/decisionsData';

export const EngineeringDecisionsAccordion: React.FC = () => {
  const [openIds, setOpenIds] = useState<string[]>(['adr-001', 'adr-002']); // default open first two
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories = useMemo(() => {
    const cats = Array.from(new Set(ARCHITECTURAL_DECISIONS.map(d => d.category)));
    return ['ALL', ...cats];
  }, []);

  const filteredDecisions = useMemo(() => {
    return ARCHITECTURAL_DECISIONS.filter(decision => {
      const matchesCategory = selectedCategory === 'ALL' || decision.category === selectedCategory;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        decision.number.toLowerCase().includes(query) ||
        decision.title.toLowerCase().includes(query) ||
        decision.summary.toLowerCase().includes(query) ||
        decision.problemStatement.toLowerCase().includes(query) ||
        decision.chosenSolution.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const toggleOpen = (id: string) => {
    setOpenIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const expandAll = () => {
    setOpenIds(filteredDecisions.map(d => d.id));
  };

  const collapseAll = () => {
    setOpenIds([]);
  };

  const jumpToAdr = (id: string) => {
    if (!openIds.includes(id)) {
      setOpenIds(prev => [...prev, id]);
    }
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  return (
    <div className="w-full space-y-8 font-mono">

      {/* Top Controls & Search Bar */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 space-y-4">

        {/* Header Title + Stats */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-mono font-bold text-sm">
              ADR
            </div>
            <div>
              <div className="text-sm sm:text-base font-extrabold text-slate-950 font-mono tracking-tight flex items-center gap-2">
                <span>13 ARCHITECTURAL DECISION RECORDS (ADRs)</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                  100% PRODUCTION VERIFIED
                </span>
              </div>
              <p className="text-xs text-slate-600 font-mono mt-0.5">
                Complete engineering index with trade-off analyses, rejected alternatives, and failure scenarios.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={expandAll}
              className="px-3 py-1.5 rounded-lg bg-[#FBFBF9] hover:bg-slate-100 border border-[#E5E7EB] text-slate-800 font-semibold transition-colors cursor-pointer"
            >
              Expand All ({filteredDecisions.length})
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1.5 rounded-lg bg-[#FBFBF9] hover:bg-slate-100 border border-[#E5E7EB] text-slate-800 font-semibold transition-colors cursor-pointer"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="pt-4 border-t border-[#E5E7EB] flex flex-col md:flex-row items-center gap-3">
          <div className="relative w-full md:flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ADR by number, keyword (e.g. Kafka, Redis, Argon2, Outbox, JWT)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#FBFBF9] border border-[#E5E7EB] text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
            />
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-[#FBFBF9] hover:bg-slate-100 text-slate-600 border border-[#E5E7EB]'
                }`}
              >
                {cat === 'ALL' ? 'All (13)' : cat.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* EXPANDABLE ACCORDION LIST OF ALL 13 ADRs */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
            Full Specification & Technical Deep-Dives ({filteredDecisions.length} Records)
          </h3>
        </div>

        {filteredDecisions.map((decision) => {
          const isOpen = openIds.includes(decision.id);

          return (
            <div
              key={decision.id}
              id={decision.id}
              className={`bg-white border rounded-2xl transition-colors overflow-hidden scroll-mt-24 ${
                isOpen
                  ? 'border-slate-400'
                  : 'border-[#E5E7EB] hover:border-slate-300'
              }`}
            >
              {/* Clickable Accordion Header */}
              <button
                onClick={() => toggleOpen(decision.id)}
                className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 bg-white hover:bg-[#FBFBF9] transition-colors cursor-pointer"
                aria-expanded={isOpen}
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-mono text-xs font-bold tracking-wide">
                      {decision.number}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-mono font-bold">
                      {decision.category.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold flex items-center gap-1 ${
                      decision.status === 'PROVEN'
                        ? 'bg-purple-50 text-purple-800 border border-purple-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      {decision.status}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-extrabold text-slate-950 font-mono tracking-tight leading-snug">
                    {decision.title}
                  </h3>

                  <p className="text-xs sm:text-sm font-medium text-slate-700 font-mono leading-relaxed max-w-4xl">
                    {decision.summary}
                  </p>
                </div>

                <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-950 shrink-0 mt-1">
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    <ChevronDown className="w-5 h-5" />
                  </motion.div>
                </div>
              </button>

              {/* Expandable Deep Technical Details with Smooth Height Animation */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                    className="overflow-hidden border-t border-[#E5E7EB] bg-[#FBFBF9]"
                  >
                    <div className="p-5 sm:p-7 space-y-6">

                      {/* Problem vs Chosen Solution Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Problem Statement */}
                        <div className="p-5 rounded-xl bg-white border border-rose-200 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-mono font-bold text-rose-800 uppercase tracking-wider">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            <span>The Architectural Problem & Risk</span>
                          </div>
                          <p className="text-xs sm:text-sm font-medium text-slate-800 font-mono leading-relaxed">
                            {decision.problemStatement}
                          </p>
                        </div>

                        {/* Chosen Solution */}
                        <div className="p-5 rounded-xl bg-white border border-emerald-200 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-800 uppercase tracking-wider">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Engineered Solution & Guarantees</span>
                          </div>
                          <p className="text-xs sm:text-sm font-medium text-slate-800 font-mono leading-relaxed">
                            {decision.chosenSolution}
                          </p>
                        </div>
                      </div>

                      {/* Rejected Alternatives */}
                      <div className="p-5 rounded-xl bg-white border border-[#E5E7EB] space-y-3">
                        <div className="text-xs font-mono font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
                          <Scale className="w-4 h-4 text-slate-700" />
                          <span>Alternatives Considered & Why They Were Rejected</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {decision.rejectedAlternatives.map((alt, idx) => (
                            <div key={idx} className="p-3.5 rounded-lg bg-[#FBFBF9] border border-slate-200 text-xs font-mono">
                              <span className="block font-bold text-slate-950 mb-1 line-through text-rose-700">
                                ✕ {alt.name}
                              </span>
                              <span className="text-slate-600 leading-relaxed block font-medium">
                                {alt.reason}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Failure Scenarios and Mitigations */}
                      <div className="p-5 rounded-xl bg-white border border-[#E5E7EB] space-y-3">
                        <div className="text-xs font-mono font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-slate-700" />
                          <span>Failure Scenarios & Resilience Proof</span>
                        </div>

                        <div className="space-y-2.5">
                          {decision.failureScenariosAndMitigation.map((fail, idx) => (
                            <div key={idx} className="p-3.5 rounded-lg bg-[#FBFBF9] border border-slate-200 font-mono text-xs">
                              <div className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                <span>Scenario: {fail.scenario}</span>
                              </div>
                              <p className="text-slate-700 pl-4 border-l-2 border-slate-400 font-medium leading-relaxed">
                                <strong className="text-emerald-800">System Behavior:</strong> {fail.systemBehavior}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

    </div>
  );
};
