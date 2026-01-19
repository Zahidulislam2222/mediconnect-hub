import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface VitalCardProps {
  title: string;
  value: string | number;
  unit: string;
  status: "normal" | "warning" | "critical" | "excellent";
  change: string;
  trend: number[];
  icon: ReactNode;
  color: "blue" | "green" | "red" | "purple" | "teal";
}

const colorMap = {
  blue: {
    gradient: ["#0ea5e9", "#0284c7"],
    bg: "bg-blue-500/10",
    text: "text-blue-600",
    chart: "#0ea5e9",
  },
  green: {
    gradient: ["#22c55e", "#16a34a"],
    bg: "bg-green-500/10",
    text: "text-green-600",
    chart: "#22c55e",
  },
  red: {
    gradient: ["#ef4444", "#dc2626"],
    bg: "bg-red-500/10",
    text: "text-red-600",
    chart: "#ef4444",
  },
  purple: {
    gradient: ["#a855f7", "#9333ea"],
    bg: "bg-purple-500/10",
    text: "text-purple-600",
    chart: "#a855f7",
  },
  teal: {
    gradient: ["#14b8a6", "#0d9488"],
    bg: "bg-teal-500/10",
    text: "text-teal-600",
    chart: "#14b8a6",
  },
};

const statusMap = {
  normal: { label: "Normal", class: "metric-badge-success" },
  excellent: { label: "Excellent", class: "metric-badge-success" },
  warning: { label: "Warning", class: "metric-badge-warning" },
  critical: { label: "Critical", class: "metric-badge-danger" },
};

export function VitalCard({
  title,
  value,
  unit,
  status,
  change,
  trend,
  icon,
  color,
}: VitalCardProps) {
  const colors = colorMap[color];
  const statusInfo = statusMap[status];
  const isPositive = change.startsWith("+");
  const isNeutral = change === "0%";

  const chartData = trend.map((val, idx) => ({ value: val, index: idx }));

  return (
    <div className="vital-card group">
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", colors.bg)}>
            <div className={colors.text}>{icon}</div>
          </div>
          <span className={cn("metric-badge", statusInfo.class)}>
            {statusInfo.label}
          </span>
        </div>

        {/* Value */}
        <div className="mb-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-foreground">{value}</span>
            <span className="text-sm font-medium text-muted-foreground">{unit}</span>
          </div>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">{title}</p>
        </div>

        {/* Trend */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isNeutral ? (
              <Minus className="h-4 w-4 text-muted-foreground" />
            ) : isPositive ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            <span
              className={cn(
                "text-sm font-medium",
                isNeutral
                  ? "text-muted-foreground"
                  : isPositive
                    ? "text-success"
                    : "text-destructive"
              )}
            >
              {change}
            </span>
            <span className="text-xs text-muted-foreground">vs last week</span>
          </div>
        </div>

        {/* Sparkline */}
        <div className="h-12 mt-3 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.chart} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={colors.chart} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={colors.chart}
                strokeWidth={2}
                fill={`url(#gradient-${color})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
