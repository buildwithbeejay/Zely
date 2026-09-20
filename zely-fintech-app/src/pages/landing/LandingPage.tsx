import { AllEndpointsExplorer } from "@/pages/landing/components/AllEndpointsExplorer";
import { ArchitectureDiagram } from "@/pages/landing/components/ArchitectureDiagram";
import { DocsModal } from "@/pages/landing/components/DocsModal";
import HeroVisual from "@/pages/landing/components/HeroVisuals";
import {
  ArrowRight,
  Cpu,
  FileText,
  GitBranch,
  Lock,
  Menu,
  PiggyBank,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EngineeringDecisionsAccordion } from "./components/EngineeringDecisionsAccordion";
import { THEMES } from "./themeConfig";

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = THEMES["paper-mono"];
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const techStack = [
    {
      name: "Node.js",
      type: "Runtime",
      color: "text-slate-900 border-slate-300 bg-white",
    },
    {
      name: "TypeScript",
      type: "Strict Types",
      color: "text-slate-900 border-slate-300 bg-white",
    },
    {
      name: "MongoDB",
      type: "ACID Storage",
      color: "text-slate-900 border-slate-300 bg-white",
    },
    {
      name: "Redis",
      type: "Cache & Locks",
      color: "text-slate-900 border-slate-300 bg-white",
    },
    {
      name: "Apache Kafka",
      type: "Event Stream",
      color: "text-slate-900 border-slate-300 bg-white",
    },
    {
      name: "Debezium",
      type: "CDC Engine",
      color: "text-slate-900 border-slate-300 bg-white",
    },
    {
      name: "Paystack",
      type: "Payment Gateway",
      color: "text-slate-900 border-slate-300 bg-white",
    },
    {
      name: "Cloudinary",
      type: "KYC Vault",
      color: "text-slate-900 border-slate-300 bg-white",
    },
    {
      name: "Resend",
      type: "Transactional Mail",
      color: "text-slate-900 border-slate-300 bg-white",
    },
  ];

  const features = [
    {
      icon: Lock,
      title: "Two-Layer Idempotent Transfers",
      subtitle: "ZERO DOUBLE-DEBITS",
      desc: "Combines Redis fast-path reservation with strict atomic MongoDB upserts. Duplicate requests with identical x-idempotency-key headers return identical cached responses with zero double charges.",
      badge: "Redlock + Mongo Oplog",
    },
    {
      icon: Scale,
      title: "Double-Entry Financial Ledger",
      subtitle: "INVARIANT PRESERVED",
      desc: "Immutable audit trail where every transaction produces balanced debits and credits: Σ(Debits) - Σ(Credits) = 0. Enforces zero drift across customer wallets, merchant reserves, and clearing accounts.",
      badge: "Mathematically Verifiable",
    },
    {
      icon: Cpu,
      title: "Kafka Event Pipeline & CDC",
      subtitle: "ZERO-POLLING OUTBOX",
      desc: "Debezium tails MongoDB oplog changes directly. Domain events are broadcasted asynchronously across Kafka topics for real-time notifications, audit logs, and analytics with zero polling overhead.",
      badge: "Debezium + Kafka",
    },
    {
      icon: PiggyBank,
      title: "Three Savings Vault Models",
      subtitle: "FLEXIBLE · LOCKED · TARGET",
      desc: "Engineered for real-world automated wealth accumulation: Flexible on-demand withdrawals, Locked maturity deposits with interest accrual, and Target goals with milestone tracking.",
      badge: "Automated Maturity",
    },
    {
      icon: ShieldCheck,
      title: "Session Kill-Switch & Auth",
      subtitle: "DUAL-TIER SECURITY",
      desc: "MongoDB serves as the authoritative session truth with sub-millisecond Redis fast path caching. Instant kill-switch invalidation on suspicious activity with fail-open fallback.",
      badge: "Argon2id + JWT",
    },
    {
      icon: RefreshCw,
      title: "3-Layer Automated Reconciliation",
      subtitle: "SETTLEMENT ENGINE",
      desc: "Runs continuous automated invariant checks against Paystack settlement webhooks, internal ledger entries, and wallet balance aggregates to detect discrepancies instantly.",
      badge: "Zero-Drift Guarantee",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-slate-950 font-mono selection:bg-slate-900 selection:text-white relative">
      {/* ========================================================================= */}
      {/* NAVBAR */}
      {/* ========================================================================= */}
      <header
        className={`sticky top-0 z-40 transition-colors duration-200 bg-white border-b border-[#E5E7EB] text-slate-900 py-3.5`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Logo */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-extrabold text-base group-hover:bg-slate-800 transition-colors duration-200 ease-out">
              Z
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-950">
                Zely
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                FinTech Engine
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-mono font-bold text-slate-700">
            <button
              onClick={() => scrollToSection("features")}
              className="hover:text-slate-950 transition-colors duration-200 ease-out cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("architecture")}
              className="hover:text-slate-950 transition-colors duration-200 ease-out cursor-pointer"
            >
              Architecture
            </button>
            <button
              onClick={() => scrollToSection("decisions")}
              className="hover:text-slate-950 transition-colors duration-200 ease-out cursor-pointer"
            >
              Trade-offs (ADRs)
            </button>
            <button
              onClick={() => scrollToSection("api-docs")}
              className="hover:text-slate-950 transition-colors duration-200 ease-out cursor-pointer"
            >
              64 API Endpoints
            </button>
            <button
              onClick={() => scrollToSection("about")}
              className="hover:text-slate-950 transition-colors duration-200 ease-out cursor-pointer"
            >
              About
            </button>
          </nav>

          {/* Actions Right */}
          <div className="hidden sm:flex items-center gap-3">
            <a
              href="https://github.com/DevMobolaji"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition-all duration-200 ease-out"
              title="GitHub Source"
            >
              <GitBranch className="w-4 h-4" />
            </a>

            <button
              onClick={() => setIsDocsModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg border border-[#E5E7EB] hover:border-slate-400 bg-[#FBFBF9] hover:bg-white text-slate-800 hover:text-slate-950 text-xs font-mono font-bold transition-all duration-200 ease-out cursor-pointer"
            >
              Specs & 64 Endpoints
            </button>

            <button
              onClick={() => navigate("/login")}
              className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono font-bold transition-all duration-200 ease-out active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Open App</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors duration-200 ease-out"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="md:hidden overflow-hidden px-4 pt-3 pb-5 border-t border-[#E5E7EB] bg-white space-y-2 text-xs font-mono"
            >
              <button
                onClick={() => scrollToSection("features")}
                className="w-full text-left py-2 px-3 rounded-lg text-slate-800 hover:bg-slate-100 font-bold cursor-pointer"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection("architecture")}
                className="w-full text-left py-2 px-3 rounded-lg text-slate-800 hover:bg-slate-100 font-bold cursor-pointer"
              >
                Architecture
              </button>
              <button
                onClick={() => scrollToSection("decisions")}
                className="w-full text-left py-2 px-3 rounded-lg text-slate-800 hover:bg-slate-100 font-bold cursor-pointer"
              >
                Trade-offs (ADRs)
              </button>
              <button
                onClick={() => scrollToSection("api-docs")}
                className="w-full text-left py-2 px-3 rounded-lg text-slate-800 hover:bg-slate-100 font-bold cursor-pointer"
              >
                64 API Endpoints
              </button>
              <button
                onClick={() => scrollToSection("about")}
                className="w-full text-left py-2 px-3 rounded-lg text-slate-800 hover:bg-slate-100 font-bold cursor-pointer"
              >
                About
              </button>
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsDocsModalOpen(true);
                  }}
                  className="flex-1 py-2 rounded-lg border border-[#E5E7EB] bg-[#FBFBF9] text-center font-bold text-slate-800 cursor-pointer"
                >
                  API Docs
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate("/login");
                  }}
                  className="flex-1 py-2 rounded-lg bg-slate-900 text-center font-bold text-white cursor-pointer"
                >
                  Open App
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ========================================================================= */}
      {/* SECTION 1: HERO SECTION */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-18 lg:pb-24 border-b border-[#E5E7EB] bg-[#FBFBF9]">
        {/* Subtle architectural background grid accents */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#E5E7EB_1px,transparent_1px),linear-gradient(to_bottom,#E5E7EB_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Centered Hero Header & Typography Block */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-4xl mx-auto text-center space-y-6"
          >
            {/* Architecture Trust Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-300 text-slate-900 text-xs font-mono font-bold mx-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>FAULT-TOLERANT FINTECH BACKEND & SETTLEMENT ENGINE</span>
            </div>

            {/* Main Display Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.1]">
              Deterministic Money Movement at Scale.
            </h1>

            {/* Compelling Value Proposition Body */}
            <p className="text-base sm:text-lg text-slate-700 max-w-2xl mx-auto leading-relaxed font-sans font-normal">
              Zely guarantees{" "}
              <strong className="text-slate-950 font-bold">
                zero financial drift
              </strong>{" "}
              through append-only double-entry ledger invariants, multi-document
              MongoDB ACID isolation, and two-layer idempotency locking designed
              for high-concurrency wallet transfers.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2 font-mono text-xs">
              <button
                onClick={() => navigate("/register")}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold transition-all duration-150 ease-out active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Get Started — Create Account</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsDocsModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white hover:bg-[#F3F4F6] border border-slate-300 text-slate-900 font-bold transition-all duration-150 ease-out hover:border-slate-400 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-slate-600" />
                <span>View 64 API Specs</span>
              </button>

              <button
                onClick={() => scrollToSection("architecture")}
                className="flex items-center gap-1.5 px-4 py-3.5 rounded-xl text-slate-700 hover:text-slate-950 font-bold transition-colors duration-150 ease-out cursor-pointer"
              >
                <span>Explore Architecture</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quantitative Mathematical Invariants Pills */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-slate-700 text-xs font-mono">
              <div className="flex items-baseline gap-2">
                <span className="text-slate-950 font-black text-sm sm:text-base">
                  0.00 DRIFT
                </span>
                <span className="text-slate-600 font-medium">
                  Double-Entry Sum
                </span>
              </div>
              <div className="hidden sm:block text-slate-300">•</div>
              <div className="flex items-baseline gap-2">
                <span className="text-slate-950 font-black text-sm sm:text-base">
                  &lt; 1.2ms
                </span>
                <span className="text-slate-600 font-medium">
                  Idempotency Lock
                </span>
              </div>
              <div className="hidden sm:block text-slate-300">•</div>
              <div className="flex items-baseline gap-2">
                <span className="text-slate-950 font-black text-sm sm:text-base">
                  64 ENDPOINTS
                </span>
                <span className="text-slate-600 font-medium">
                  11 Domain Schemas
                </span>
              </div>
            </div>
          </motion.div>

          {/* Big Prominent Dashboard Visual Showcase Showcase Frame */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="mt-12 sm:mt-14 max-w-5xl mx-auto"
          >
            <HeroVisual />
          </motion.div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 2: WHAT IS ZELY */}
      {/* ========================================================================= */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="py-16 sm:py-20 bg-white border-b border-[#E5E7EB]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-2">
              System Architecture & Core Domain
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              An API-First Backend Engine for Mission-Critical Financial Flows
            </h3>
            <p className="mt-4 text-sm sm:text-base text-slate-700 leading-relaxed font-medium">
              Designed and implemented from scratch to solve real-world payment
              failures: double-debit race conditions, outbox polling lag, ghost
              balances, and un-reconciled third-party webhook dropouts.
            </p>
          </div>

          {/* Three Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="p-6 rounded-2xl bg-[#FBFBF9] border border-[#E5E7EB] hover:border-slate-400 transition-colors duration-200 ease-out"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-mono font-extrabold text-base mb-4">
                64
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-950 mb-1">
                Full-Fledged Endpoints
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Auth, Wallets, Tiered KYC, Inter-Wallet Transfers, Three-Model
                Savings Vaults, Double-Entry Journals, and Settlement
                Verification.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="p-6 rounded-2xl bg-[#FBFBF9] border border-[#E5E7EB] hover:border-slate-400 transition-colors duration-200 ease-out"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-mono font-extrabold text-base mb-4">
                11
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-950 mb-1">
                Isolated Business Domains
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Clear separation of concerns across accounts, transactions,
                auditing, interest computation, session management, and external
                gateways.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="p-6 rounded-2xl bg-[#FBFBF9] border border-[#E5E7EB] hover:border-slate-400 transition-colors duration-200 ease-out"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-mono font-extrabold text-base mb-4">
                3-L
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-950 mb-1">
                Three-Layer Reconciliation
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Automated continuous validation of external Paystack settlement
                records, internal ledger entries, and wallet balance
                aggregation.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ========================================================================= */}
      {/* SECTION 3: CORE FEATURES */}
      {/* ========================================================================= */}
      <motion.section
        id="features"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="py-16 sm:py-24 bg-[#FBFBF9] border-b border-[#E5E7EB]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 block mb-2">
              Robust Financial Engineering
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Engineered for Zero Data Loss and Flawless Settlement
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-mono">
            {features.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-30px" }}
                  transition={{
                    duration: 0.4,
                    delay: idx * 0.08,
                    ease: "easeOut",
                  }}
                  whileHover={{ y: -4 }}
                  className="bg-white border border-[#E5E7EB] rounded-2xl p-6 hover:border-slate-400 transition-colors duration-200 ease-out group relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-900 transition-colors duration-200 ease-out">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#FBFBF9] text-slate-700 border border-[#E5E7EB]">
                      {item.badge}
                    </span>
                  </div>

                  <div className="text-[10px] font-mono font-bold text-slate-500 tracking-wider uppercase mb-1">
                    {item.subtitle}
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-slate-950 mb-2">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {item.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* ========================================================================= */}
      {/* SECTION 4: ARCHITECTURE & EVENT PIPELINE */}
      {/* ========================================================================= */}
      <motion.section
        id="architecture"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="py-16 sm:py-24 bg-white border-b border-[#E5E7EB]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Under the Hood
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
                Distributed Architecture & Pipeline
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <p className="text-xs text-slate-600 max-w-xs font-mono font-medium">
                Designed around asynchronous event propagation, outbox
                consistency, and fault-isolated circuit breakers.
              </p>
              <button
                onClick={() => navigate("/architecture")}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-mono font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm shrink-0"
              >
                <span>Open Full System Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Architecture Diagram Interactive Component */}
          <ArchitectureDiagram theme={theme} />

          {/* Tech Stack Chips */}
          <div className="pt-8 border-t border-[#E5E7EB]">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-4">
              Core Technologies & Infrastructure
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {techStack.map((tech, idx) => (
                <motion.div
                  key={tech.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: idx * 0.04 }}
                  whileHover={{ scale: 1.05 }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-2 cursor-default ${tech.color}`}
                >
                  <span className="font-bold">{tech.name}</span>
                  <span className="text-[10px] opacity-75 font-normal">
                    · {tech.type}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ========================================================================= */}
      {/* SECTION 5: KEY ENGINEERING DECISIONS (ADR ACCORDION) */}
      {/* ========================================================================= */}
      <motion.section
        id="decisions"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="py-16 sm:py-24 bg-white border-b border-[#E5E7EB]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-3xl">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Architectural Decision Records (ADRs)
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Deliberate Engineering Trade-offs
            </h2>
            <p className="text-sm sm:text-base text-slate-700 mt-2 font-medium">
              Click to expand each technical tradeoff. Includes rejected
              alternatives, failure scenarios, mathematical invariant proofs,
              and code implementations.
            </p>
          </div>

          {/* Interactive ADR Accordion with Smooth Animated Height Expansion */}
          <EngineeringDecisionsAccordion />
        </div>
      </motion.section>

      {/* ========================================================================= */}
      {/* SECTION 6: ALL 64 ENDPOINTS SPECIFICATION */}
      {/* ========================================================================= */}
      <motion.section
        id="api-docs"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="py-16 sm:py-24 bg-[#FBFBF9] border-b border-[#E5E7EB]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Developer Experience & Complete Surface
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
                All 64 API Endpoints
              </h2>
            </div>

            <button
              onClick={() => setIsDocsModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#E5E7EB] text-slate-900 text-xs font-mono font-bold transition-all duration-200 ease-out self-start md:self-auto cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              <span>Full OpenAPI Specification</span>
            </button>
          </div>

          {/* All 64 Endpoints Explorer Component */}
          <AllEndpointsExplorer />
        </div>
      </motion.section>

      {/* ========================================================================= */}
      {/* SECTION 7: WHY ZELY EXISTS (The Story) */}
      {/* ========================================================================= */}
      <motion.section
        id="about"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="py-16 sm:py-24 bg-white border-b border-[#E5E7EB]"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#FBFBF9] border border-[#E5E7EB] rounded-3xl p-8 sm:p-12 relative overflow-hidden font-mono">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                M
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-950">
                  Engineered by Mobolaji Beejay (DevMobolaji)
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Backend & Distributed Systems Engineer · Lagos, Nigeria
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
              <p>
                In African fintech, high failure rates during inter-bank
                transfers and webhook delivery dropouts cause billions in lost
                trust and manual customer support overhead every month.
              </p>
              <p>
                <strong className="text-slate-950 font-bold">Zely</strong> was
                built to demonstrate how modern distributed systems principles —
                such as{" "}
                <em className="text-slate-900">Change Data Capture (CDC)</em>,{" "}
                <em className="text-slate-900">Outbox pattern</em>,{" "}
                <em className="text-slate-900">
                  Redlock distributed idempotency
                </em>
                , and{" "}
                <em className="text-slate-900">
                  automated three-layer settlement reconciliation
                </em>{" "}
                — can completely eliminate ghost balances, double debits, and
                ledger drift.
              </p>
              <p>
                Targeted at backend and core infrastructure engineering teams at
                tier-one fintech companies (such as{" "}
                <strong className="text-slate-950 font-bold">Paystack</strong>,{" "}
                <strong className="text-slate-950 font-bold">
                  Flutterwave
                </strong>
                ,{" "}
                <strong className="text-slate-950 font-bold">Moniepoint</strong>
                , and <strong className="text-slate-950 font-bold">Kuda</strong>
                ).
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/DevMobolaji"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono font-bold transition-colors duration-200 ease-out"
                >
                  <GitBranch className="w-4 h-4" />
                  <span>github.com/DevMobolaji</span>
                </a>
              </div>

              <button
                onClick={() => navigate("/login")}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono font-bold transition-colors duration-200 ease-out cursor-pointer"
              >
                <span>Launch Interactive Demo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ========================================================================= */}
      {/* SECTION 9: HIGH IMPACT CTA BANNER */}
      {/* ========================================================================= */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="py-16 sm:py-20 bg-[#FBFBF9] border-b border-[#E5E7EB]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-slate-950 border border-slate-800 text-white p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
            <div className="space-y-2 max-w-xl font-mono">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Ready to explore the live fintech application?
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                Log into the demo dashboard to initiate idempotent transfers,
                create target savings vaults, trigger real-time reconciliation
                runs, and inspect live ledger journal balance invariants.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-xs">
              <button
                onClick={() => navigate("/register")}
                className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-extrabold transition-colors duration-200 ease-out active:scale-95 cursor-pointer"
              >
                Create Demo Account
              </button>
              <button
                onClick={() => navigate("/login")}
                className="px-5 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold transition-colors duration-200 ease-out cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ========================================================================= */}
      {/* FOOTER */}
      {/* ========================================================================= */}
      <footer className="bg-white text-slate-600 text-xs font-mono py-12 border-t border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
                Z
              </div>
              <span className="text-base font-bold text-slate-950 tracking-tight">
                Zely FinTech Engine
              </span>
            </div>

            <div className="flex items-center gap-6 text-slate-600 font-bold">
              <button
                onClick={() => scrollToSection("features")}
                className="hover:text-slate-950 transition-colors duration-200 ease-out"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection("architecture")}
                className="hover:text-slate-950 transition-colors duration-200 ease-out"
              >
                Architecture
              </button>
              <button
                onClick={() => scrollToSection("simulator")}
                className="hover:text-slate-950 transition-colors duration-200 ease-out"
              >
                Simulator
              </button>
              <button
                onClick={() => scrollToSection("decisions")}
                className="hover:text-slate-950 transition-colors duration-200 ease-out"
              >
                Trade-offs
              </button>
              <button
                onClick={() => scrollToSection("api-docs")}
                className="hover:text-slate-950 transition-colors duration-200 ease-out"
              >
                64 APIs
              </button>
              <button
                onClick={() => setIsDocsModalOpen(true)}
                className="hover:text-slate-950 transition-colors duration-200 ease-out"
              >
                Documentation
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500 text-[11px] font-medium">
            <div>
              © 2026 Zely Inc. Engineered by Mobolaji Beejay (DevMobolaji).
            </div>
            <div className="flex items-center gap-4 font-bold">
              <span>Zero Drift Ledger Guarantee</span>
              <span>·</span>
              <span>Apache Kafka CDC</span>
              <span>·</span>
              <span>MongoDB ACID Outbox</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Docs Specification Modal */}
      <DocsModal
        isOpen={isDocsModalOpen}
        onClose={() => setIsDocsModalOpen(false)}
      />
    </div>
  );
};

export default LandingPage;
