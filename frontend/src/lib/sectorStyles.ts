import {
  Landmark, Car, ShoppingCart, Home, Utensils, Heart, GraduationCap,
  Briefcase, Wifi, Zap, Plane, Gift, Folder, type LucideIcon,
  CreditCard, Building2, Wrench, Music, Dumbbell, Shirt, Baby,
  PawPrint, Pill, TreePine, Monitor, ArrowLeftRight, TrendingUp
} from "lucide-react";

interface SectorStyle {
  icon: LucideIcon;
  borderColor: string;
  bgColor: string;
  textColor: string;
  badgeBg: string;
  badgeText: string;
}

const SECTOR_MAP: Record<string, SectorStyle> = {
  "banking": { icon: Landmark, borderColor: "border-emerald-500", bgColor: "bg-emerald-500/10", textColor: "text-emerald-600", badgeBg: "bg-emerald-100", badgeText: "text-emerald-700" },
  "transportation": { icon: Car, borderColor: "border-orange-500", bgColor: "bg-orange-500/10", textColor: "text-orange-600", badgeBg: "bg-orange-100", badgeText: "text-orange-700" },
  "shopping": { icon: ShoppingCart, borderColor: "border-blue-500", bgColor: "bg-blue-500/10", textColor: "text-blue-600", badgeBg: "bg-blue-100", badgeText: "text-blue-700" },
  "housing": { icon: Home, borderColor: "border-violet-500", bgColor: "bg-violet-500/10", textColor: "text-violet-600", badgeBg: "bg-violet-100", badgeText: "text-violet-700" },
  "rent": { icon: Home, borderColor: "border-violet-500", bgColor: "bg-violet-500/10", textColor: "text-violet-600", badgeBg: "bg-violet-100", badgeText: "text-violet-700" },
  "food": { icon: Utensils, borderColor: "border-rose-500", bgColor: "bg-rose-500/10", textColor: "text-rose-600", badgeBg: "bg-rose-100", badgeText: "text-rose-700" },
  "restaurant": { icon: Utensils, borderColor: "border-rose-500", bgColor: "bg-rose-500/10", textColor: "text-rose-600", badgeBg: "bg-rose-100", badgeText: "text-rose-700" },
  "dining": { icon: Utensils, borderColor: "border-rose-500", bgColor: "bg-rose-500/10", textColor: "text-rose-600", badgeBg: "bg-rose-100", badgeText: "text-rose-700" },
  "health": { icon: Heart, borderColor: "border-red-500", bgColor: "bg-red-500/10", textColor: "text-red-600", badgeBg: "bg-red-100", badgeText: "text-red-700" },
  "medical": { icon: Pill, borderColor: "border-red-500", bgColor: "bg-red-500/10", textColor: "text-red-600", badgeBg: "bg-red-100", badgeText: "text-red-700" },
  "education": { icon: GraduationCap, borderColor: "border-indigo-500", bgColor: "bg-indigo-500/10", textColor: "text-indigo-600", badgeBg: "bg-indigo-100", badgeText: "text-indigo-700" },
  "business": { icon: Briefcase, borderColor: "border-slate-500", bgColor: "bg-slate-500/10", textColor: "text-slate-600", badgeBg: "bg-slate-100", badgeText: "text-slate-700" },
  "internet": { icon: Wifi, borderColor: "border-cyan-500", bgColor: "bg-cyan-500/10", textColor: "text-cyan-600", badgeBg: "bg-cyan-100", badgeText: "text-cyan-700" },
  "utilities": { icon: Zap, borderColor: "border-yellow-500", bgColor: "bg-yellow-500/10", textColor: "text-yellow-600", badgeBg: "bg-yellow-100", badgeText: "text-yellow-700" },
  "travel": { icon: Plane, borderColor: "border-sky-500", bgColor: "bg-sky-500/10", textColor: "text-sky-600", badgeBg: "bg-sky-100", badgeText: "text-sky-700" },
  "gift": { icon: Gift, borderColor: "border-pink-500", bgColor: "bg-pink-500/10", textColor: "text-pink-600", badgeBg: "bg-pink-100", badgeText: "text-pink-700" },
  "payment": { icon: CreditCard, borderColor: "border-teal-500", bgColor: "bg-teal-500/10", textColor: "text-teal-600", badgeBg: "bg-teal-100", badgeText: "text-teal-700" },
  "salary": { icon: TrendingUp, borderColor: "border-emerald-500", bgColor: "bg-emerald-500/10", textColor: "text-emerald-600", badgeBg: "bg-emerald-100", badgeText: "text-emerald-700" },
  "income": { icon: TrendingUp, borderColor: "border-emerald-500", bgColor: "bg-emerald-500/10", textColor: "text-emerald-600", badgeBg: "bg-emerald-100", badgeText: "text-emerald-700" },
  "internal": { icon: ArrowLeftRight, borderColor: "border-slate-400", bgColor: "bg-slate-100/60", textColor: "text-slate-500", badgeBg: "bg-slate-100", badgeText: "text-slate-600" },
  "transfer": { icon: ArrowLeftRight, borderColor: "border-slate-400", bgColor: "bg-slate-100/60", textColor: "text-slate-500", badgeBg: "bg-slate-100", badgeText: "text-slate-600" },
  "manufacturing": { icon: Briefcase, borderColor: "border-gray-500", bgColor: "bg-gray-500/10", textColor: "text-gray-600", badgeBg: "bg-gray-100", badgeText: "text-gray-700" },
  "professional": { icon: Briefcase, borderColor: "border-slate-500", bgColor: "bg-slate-500/10", textColor: "text-slate-600", badgeBg: "bg-slate-100", badgeText: "text-slate-700" },
  "marketing": { icon: Monitor, borderColor: "border-fuchsia-500", bgColor: "bg-fuchsia-500/10", textColor: "text-fuchsia-600", badgeBg: "bg-fuchsia-100", badgeText: "text-fuchsia-700" },
  "legal": { icon: Briefcase, borderColor: "border-zinc-500", bgColor: "bg-zinc-500/10", textColor: "text-zinc-600", badgeBg: "bg-zinc-100", badgeText: "text-zinc-700" },
  "maintenance": { icon: Wrench, borderColor: "border-amber-500", bgColor: "bg-amber-500/10", textColor: "text-amber-600", badgeBg: "bg-amber-100", badgeText: "text-amber-700" },
  "entertainment": { icon: Music, borderColor: "border-fuchsia-500", bgColor: "bg-fuchsia-500/10", textColor: "text-fuchsia-600", badgeBg: "bg-fuchsia-100", badgeText: "text-fuchsia-700" },
  "fitness": { icon: Dumbbell, borderColor: "border-lime-500", bgColor: "bg-lime-500/10", textColor: "text-lime-600", badgeBg: "bg-lime-100", badgeText: "text-lime-700" },
  "clothing": { icon: Shirt, borderColor: "border-purple-500", bgColor: "bg-purple-500/10", textColor: "text-purple-600", badgeBg: "bg-purple-100", badgeText: "text-purple-700" },
  "kids": { icon: Baby, borderColor: "border-pink-400", bgColor: "bg-pink-400/10", textColor: "text-pink-500", badgeBg: "bg-pink-100", badgeText: "text-pink-600" },
  "pets": { icon: PawPrint, borderColor: "border-amber-600", bgColor: "bg-amber-600/10", textColor: "text-amber-700", badgeBg: "bg-amber-100", badgeText: "text-amber-800" },
  "environment": { icon: TreePine, borderColor: "border-green-600", bgColor: "bg-green-600/10", textColor: "text-green-700", badgeBg: "bg-green-100", badgeText: "text-green-800" },
  "technology": { icon: Monitor, borderColor: "border-blue-600", bgColor: "bg-blue-600/10", textColor: "text-blue-700", badgeBg: "bg-blue-100", badgeText: "text-blue-800" },
};

const FALLBACK_COLORS = [
  { borderColor: "border-emerald-500", bgColor: "bg-emerald-500/10", textColor: "text-emerald-600", badgeBg: "bg-emerald-100", badgeText: "text-emerald-700" },
  { borderColor: "border-blue-500", bgColor: "bg-blue-500/10", textColor: "text-blue-600", badgeBg: "bg-blue-100", badgeText: "text-blue-700" },
  { borderColor: "border-violet-500", bgColor: "bg-violet-500/10", textColor: "text-violet-600", badgeBg: "bg-violet-100", badgeText: "text-violet-700" },
  { borderColor: "border-orange-500", bgColor: "bg-orange-500/10", textColor: "text-orange-600", badgeBg: "bg-orange-100", badgeText: "text-orange-700" },
  { borderColor: "border-rose-500", bgColor: "bg-rose-500/10", textColor: "text-rose-600", badgeBg: "bg-rose-100", badgeText: "text-rose-700" },
  { borderColor: "border-teal-500", bgColor: "bg-teal-500/10", textColor: "text-teal-600", badgeBg: "bg-teal-100", badgeText: "text-teal-700" },
];

export function getSectorStyle(sectorName: string, index: number): SectorStyle {
  const lower = sectorName.toLowerCase();
  for (const [key, style] of Object.entries(SECTOR_MAP)) {
    if (lower.includes(key)) return style;
  }
  const fallback = FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  return { icon: Folder, ...fallback };
}
