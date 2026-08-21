"use client";

import { EmailStatus, CampaignStatus } from "@/lib/types";

interface BadgeProps {
  status: EmailStatus | CampaignStatus;
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; pulse?: boolean }> = {
  PENDING: {
    bg: "bg-slate-500/15",
    text: "text-slate-400",
    dot: "bg-slate-400",
  },
  SCHEDULED: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    dot: "bg-amber-400",
    pulse: true,
  },
  SENDING: {
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    dot: "bg-blue-400",
    pulse: true,
  },
  SENT: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  FAILED: {
    bg: "bg-red-500/15",
    text: "text-red-400",
    dot: "bg-red-400",
  },
  PROCESSING: {
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    dot: "bg-blue-400",
    pulse: true,
  },
  COMPLETED: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
};

export default function Badge({ status, className = "" }: BadgeProps) {
  const config = statusConfig[status] || statusConfig.PENDING;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        ${config.bg} ${config.text} ${className}
      `}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${config.dot} ${config.pulse ? "animate-pulse" : ""}`}
      />
      {status}
    </span>
  );
}
