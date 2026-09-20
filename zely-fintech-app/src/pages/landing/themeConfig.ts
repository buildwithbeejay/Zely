export type ThemeId =
  | "paper-mercury"
  | "paper-violet"
  | "paper-emerald"
  | "paper-mono";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  tagline: string;
  brandAccent: string;
  brandAccentHover: string;
  brandAccentSoft: string;
  brandBorder: string;
  brandText: string;
  brandRing: string;
  canvasBg: string;
  canvasAltBg: string;
  cardBg: string;
  cardBorder: string;
  headingColor: string;
  bodyColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  codeBg: string;
  codeText: string;
  heroGradient: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  "paper-mercury": {
    id: "paper-mercury",
    name: "Paper Ledger (Stripe & Mercury + Purple)",
    tagline:
      "Warm off-white paper canvas (#FBFBF9) with soft borders (#E5E7EB) and signature purple (#7C3AED) accents",
    brandAccent: "bg-[#7C3AED]",
    brandAccentHover: "hover:bg-[#6D28D9]",
    brandAccentSoft: "bg-purple-50",
    brandBorder: "border-purple-200",
    brandText: "text-[#7C3AED]",
    brandRing: "ring-[#7C3AED]",
    canvasBg: "bg-[#FBFBF9]",
    canvasAltBg: "bg-white",
    cardBg: "bg-white",
    cardBorder: "border-[#E5E7EB]",
    headingColor: "text-slate-900",
    bodyColor: "text-slate-600",
    badgeBg: "bg-purple-50",
    badgeText: "text-[#7C3AED]",
    badgeBorder: "border-purple-200",
    codeBg: "bg-slate-900",
    codeText: "text-purple-200",
    heroGradient: "from-purple-500/5 via-indigo-500/5 to-slate-500/5",
  },
  "paper-violet": {
    id: "paper-violet",
    name: "Royal Violet Paper",
    tagline:
      "Warm off-white paper canvas with high-contrast violet typography and double-entry ledger tags",
    brandAccent: "bg-[#6D28D9]",
    brandAccentHover: "hover:bg-[#5B21B6]",
    brandAccentSoft: "bg-violet-50",
    brandBorder: "border-violet-200",
    brandText: "text-[#6D28D9]",
    brandRing: "ring-[#6D28D9]",
    canvasBg: "bg-[#FBFBF9]",
    canvasAltBg: "bg-white",
    cardBg: "bg-white",
    cardBorder: "border-[#E5E7EB]",
    headingColor: "text-slate-900",
    bodyColor: "text-slate-600",
    badgeBg: "bg-violet-50",
    badgeText: "text-[#6D28D9]",
    badgeBorder: "border-violet-200",
    codeBg: "bg-slate-900",
    codeText: "text-violet-200",
    heroGradient: "from-violet-500/5 via-fuchsia-500/5 to-indigo-500/5",
  },
  "paper-emerald": {
    id: "paper-emerald",
    name: "Precision Mint Paper (Wise Ledger)",
    tagline:
      "Warm paper canvas with emerald settlement indicators and purple action buttons",
    brandAccent: "bg-[#059669]",
    brandAccentHover: "hover:bg-[#047857]",
    brandAccentSoft: "bg-emerald-50",
    brandBorder: "border-emerald-200",
    brandText: "text-[#059669]",
    brandRing: "ring-[#059669]",
    canvasBg: "bg-[#FBFBF9]",
    canvasAltBg: "bg-white",
    cardBg: "bg-white",
    cardBorder: "border-[#E5E7EB]",
    headingColor: "text-slate-900",
    bodyColor: "text-slate-600",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeBorder: "border-emerald-200",
    codeBg: "bg-slate-900",
    codeText: "text-emerald-200",
    heroGradient: "from-emerald-500/5 via-teal-500/5 to-slate-500/5",
  },
  "paper-mono": {
    id: "paper-mono",
    name: "Monochrome Paper Ledger",
    tagline:
      "High-density pure black and white with tactile borders and micro purple highlights",
    brandAccent: "bg-slate-900",
    brandAccentHover: "hover:bg-slate-800",
    brandAccentSoft: "bg-slate-100",
    brandBorder: "border-slate-300",
    brandText: "text-slate-900",
    brandRing: "ring-slate-900",
    canvasBg: "bg-[#FBFBF9]",
    canvasAltBg: "bg-white",
    cardBg: "bg-white",
    cardBorder: "border-[#E5E7EB]",
    headingColor: "text-slate-950",
    bodyColor: "text-slate-600",
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-800",
    badgeBorder: "border-[#E5E7EB]",
    codeBg: "bg-slate-950",
    codeText: "text-slate-200",
    heroGradient: "from-slate-500/5 via-purple-500/5 to-slate-400/5",
  },
};
