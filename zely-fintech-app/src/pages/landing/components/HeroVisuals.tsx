import React, { useState } from "react";
import {
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  Bell,
  CreditCard,
  Wallet,
  PiggyBank,
  ArrowLeftRight,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Download,
  Check,
  Copy,
  Layers,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export const HeroVisual: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "overview" | "wallets" | "savings" | "transfers"
  >("overview");
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);

  const recentTransactions = [
    {
      id: "tx_1",
      title: "Salary Direct Deposit · TechCorp",
      date: "Today, 10:45 AM",
      amount: 850000,
      type: "incoming",
      category: "Income",
      status: "Settled",
      method: "NIP Inward",
    },
    {
      id: "tx_2",
      title: "Transfer to Amara Okafor",
      date: "Today, 08:30 AM",
      amount: -25000,
      type: "outgoing",
      category: "P2P",
      status: "Settled",
      method: "Instant Lock",
    },
    {
      id: "tx_3",
      title: "AWS Cloud Hosting",
      date: "Yesterday, 04:12 PM",
      amount: -48200,
      type: "outgoing",
      category: "Infrastructure",
      status: "Settled",
      method: "Virtual Visa",
    },
    {
      id: "tx_4",
      title: "Vault Interest Accrual (12.5% APY)",
      date: "Aug 28, 11:59 PM",
      amount: 14650,
      type: "incoming",
      category: "Yield Vault",
      status: "Settled",
      method: "Auto-Compound",
    },
    {
      id: "tx_5",
      title: "Paystack Merchant Settlement",
      date: "Aug 27, 02:15 PM",
      amount: 320000,
      type: "incoming",
      category: "Merchant",
      status: "Settled",
      method: "WebHook Recon",
    },
  ];

  const quickContacts = [
    {
      name: "Amara Okafor",
      role: "Dev Lead",
      initials: "AO",
      bg: "bg-purple-100 text-purple-700",
    },
    {
      name: "David Kalu",
      role: "Product Ops",
      initials: "DK",
      bg: "bg-blue-100 text-blue-700",
    },
    {
      name: "Sarah Miller",
      role: "Treasury",
      initials: "SM",
      bg: "bg-emerald-100 text-emerald-700",
    },
    {
      name: "Tunde Bakare",
      role: "Risk Officer",
      initials: "TB",
      bg: "bg-amber-100 text-amber-700",
    },
    {
      name: "Chioma Ade",
      role: "Accounting",
      initials: "CA",
      bg: "bg-indigo-100 text-indigo-700",
    },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText("0123456789");
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  return (
    <div className="w-full relative select-none">
      {/* Main Wide Central Real Dashboard Container */}
      <div className="w-full rounded-2xl sm:rounded-3xl border border-slate-300 bg-[#FBFBF9] text-slate-900 overflow-hidden text-left">
        {/* Top App Chrome / Header Navigation */}
        <div className="px-4 sm:px-8 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          {/* Brand + URL */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 mr-2">
              <span className="w-3 h-3 rounded-full bg-slate-300 inline-block" />
              <span className="w-3 h-3 rounded-full bg-slate-300 inline-block" />
              <span className="w-3 h-3 rounded-full bg-slate-300 inline-block" />
            </div>

            <div
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="bg-[#7C3AED] p-1.5 rounded-xl text-white font-bold text-sm w-7 h-7 flex items-center justify-center">
                Z
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-black tracking-tight text-slate-900">
                  Zely
                </span>
                <span className="text-[9px] font-mono font-medium text-slate-500 uppercase tracking-wider">
                  Fintech Engine
                </span>
              </div>
            </div>
          </div>

          {/* Central Navigation Tabs (Matches Real App Navigation) */}
          <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === "overview"
                  ? "bg-slate-900 text-white font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("wallets")}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === "wallets"
                  ? "bg-slate-900 text-white font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
            >
              Wallets
            </button>
            <button
              onClick={() => setActiveTab("savings")}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === "savings"
                  ? "bg-slate-900 text-white font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
            >
              Savings Vaults
            </button>
            <button
              onClick={() => setActiveTab("transfers")}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === "transfers"
                  ? "bg-slate-900 text-white font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
            >
              Transfers
            </button>
          </div>

          {/* Right Status Controls */}
          <div className="flex items-center gap-3 ml-auto sm:ml-0">
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>SETTLEMENT: 0.00 DRIFT</span>
            </div>

            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold font-mono flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>Launch Live Dashboard</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Central Wide Dashboard Body */}
        <div className="p-5 sm:p-8 lg:p-10 space-y-8 max-w-7xl mx-auto">
          {/* Greeting & Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Good Afternoon, Alex</span>
                <span>👋</span>
              </h1>
              <p className="text-slate-500 text-sm font-medium mt-1">
                Here's your authoritative financial overview & multi-wallet
                ledger.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-600">
                <span className="font-bold text-slate-700">Wema Bank</span>
                <span>•</span>
                <span>Acct: 0123456789</span>
                <button
                  onClick={handleCopy}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors"
                  title="Copy account number"
                >
                  {copiedAccount ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <button
                onClick={() => navigate("/fund-wallet")}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors text-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Money</span>
              </button>
            </div>
          </div>

          {/* Real Authoritative Total Balance Card (Signature Zely Dark Card) */}
          <div className="bg-slate-900 rounded-3xl p-6 sm:p-9 border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 text-white">
            <div>
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
                  Total Balance
                </span>
                <div className="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-300 text-[10px] font-bold font-mono">
                  NGN
                </div>
                <div className="px-2 py-0.5 rounded border border-emerald-900/60 bg-emerald-950 text-emerald-300 text-[10px] font-bold font-mono">
                  ZERO DRIFT
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl lg:text-5xl font-bold text-purple-400">
                  ₦
                </span>
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white font-mono">
                  14,850,250.00
                </h2>
              </div>

              <div className="flex items-center gap-2 mt-3 text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +₦850,000.00 this month (6.08%)
                </span>
                <span>•</span>
                <span>Verified across 3 ledger accounts</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0">
              <button
                onClick={() => navigate("/transfers")}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors cursor-pointer text-sm whitespace-nowrap"
              >
                <Send className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Transfer</span>
              </button>

              <button
                onClick={() => navigate("/savings")}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white border border-slate-700 rounded-xl font-bold hover:bg-slate-700 transition-colors cursor-pointer text-sm whitespace-nowrap"
              >
                <PiggyBank className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Savings Vault</span>
              </button>

              <button
                onClick={() => navigate("/fund-wallet")}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 text-white border border-slate-700 rounded-xl font-bold hover:bg-slate-700 transition-colors cursor-pointer text-sm whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-slate-300 shrink-0" />
                <span>Deposit</span>
              </button>
            </div>
          </div>

          {/* Lower Grid: Quick Transfer & Cards (Left 7-8 cols) + Recent Activity (Right 4-5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Section (7 columns on desktop) */}
            <div className="lg:col-span-7 space-y-8">
              {/* Quick Transfer Row */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Quick Transfer
                  </h3>
                  <button
                    onClick={() => navigate("/transfers")}
                    className="text-xs font-bold text-purple-700 hover:text-purple-800 font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <span>Manage Contacts</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-4 overflow-x-auto pb-1 no-scrollbar">
                  {/* Add New Contact Button */}
                  <button
                    onClick={() => navigate("/transfers")}
                    className="flex flex-col items-center gap-2 min-w-[76px] group cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-full bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 group-hover:border-purple-600 group-hover:text-purple-600 transition-colors">
                      <Plus className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 group-hover:text-purple-700 transition-colors">
                      New
                    </span>
                  </button>

                  {/* Contacts List */}
                  {quickContacts.map((contact, idx) => (
                    <button
                      key={idx}
                      onClick={() =>
                        navigate(
                          `/transfers?recipient=${encodeURIComponent(contact.name)}&type=p2p`,
                        )
                      }
                      className="flex flex-col items-center gap-2 min-w-[76px] group cursor-pointer"
                    >
                      <div
                        className={`w-14 h-14 rounded-full ${contact.bg} flex items-center justify-center font-bold text-sm border border-slate-200 transition-transform group-hover:scale-105`}
                      >
                        {contact.initials}
                      </div>
                      <div className="text-center w-full">
                        <span className="text-xs font-bold text-slate-800 block truncate group-hover:text-purple-700">
                          {contact.name.split(" ")[0]}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {contact.role}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* My Cards (Real Design from DashboardScreen) */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    My Cards
                  </h3>
                  <button
                    onClick={() => navigate("/wallets")}
                    className="text-xs font-bold text-slate-500 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    Manage Cards
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Card 1: Main Checking Card (Solid Slate 900) */}
                  <div
                    onClick={() => navigate("/wallets")}
                    className="bg-slate-900 text-white rounded-[1.5rem] p-6 cursor-pointer flex flex-col justify-between aspect-[1.586/1] border border-slate-800 transition-colors hover:border-slate-700"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-white text-sm tracking-wide">
                          Main Checking
                        </span>
                        {/* EMV Chip */}
                        <div className="w-9 h-6 bg-amber-400/90 rounded mt-2 border border-amber-300" />
                      </div>
                      <span className="font-black italic text-xl tracking-widest text-white">
                        VISA
                      </span>
                    </div>

                    <div className="mt-auto">
                      <p className="font-mono text-slate-300 tracking-[0.25em] text-xs sm:text-sm mb-2">
                        •••• •••• •••• 4298
                      </p>
                      <div className="flex justify-between items-end">
                        <h4 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-white">
                          ₦12,450,000.00
                        </h4>
                        <div className="text-right">
                          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                            Exp
                          </span>
                          <span className="text-xs font-mono font-medium text-slate-200">
                            12/25
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: High-Yield Savings Card (Clean White) */}
                  <div
                    onClick={() => navigate("/savings")}
                    className="bg-white text-slate-900 rounded-[1.5rem] p-6 cursor-pointer flex flex-col justify-between aspect-[1.586/1] border border-slate-200 transition-colors hover:border-slate-300"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-900 text-sm tracking-wide">
                          High-Yield Savings
                        </span>
                        {/* EMV Chip */}
                        <div className="w-9 h-6 bg-slate-200 rounded mt-2 border border-slate-300" />
                      </div>
                      <span className="font-bold text-slate-500 text-sm">
                        Mastercard
                      </span>
                    </div>

                    <div className="mt-auto">
                      <p className="font-mono text-slate-500 tracking-[0.25em] text-xs sm:text-sm mb-2">
                        •••• •••• •••• 8821
                      </p>
                      <div className="flex justify-between items-end">
                        <h4 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-purple-700">
                          ₦2,400,250.00
                        </h4>
                        <div className="text-right">
                          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] font-mono">
                            <ArrowUpRight className="w-3 h-3" />
                            <span>12.5% APY</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Section (5 columns on desktop): Recent Activity Feed */}
            <div className="lg:col-span-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Recent Activity
                </h3>
                <button
                  onClick={() => navigate("/transactions")}
                  className="text-xs font-bold text-slate-500 hover:text-purple-700 transition-colors cursor-pointer"
                >
                  View All
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between min-h-[460px]">
                <div className="divide-y divide-slate-100">
                  {recentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      onClick={() => navigate("/transactions")}
                      className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            tx.type === "incoming"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {tx.type === "incoming" ? (
                            <ArrowDownLeft className="w-5 h-5" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-purple-700 transition-colors truncate">
                            {tx.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                            <span>{tx.date}</span>
                            <span>•</span>
                            <span className="text-slate-600">{tx.method}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono pl-2">
                        <span
                          className={`text-xs sm:text-sm font-bold block ${
                            tx.type === "incoming"
                              ? "text-emerald-700"
                              : "text-slate-900"
                          }`}
                        >
                          {tx.type === "incoming" ? "+" : "-"}₦
                          {Math.abs(tx.amount).toLocaleString("en-NG")}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Core Invariant Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-mono text-slate-600">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Cryptographic Ledger Synced</span>
                  </span>
                  <span className="text-slate-500">TigerBeetle Core</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroVisual;
