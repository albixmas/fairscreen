"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TierStat {
  total: number;
  selected: number;
}

interface FalseNegative {
  id: string;
  name: string;
  eduScore: number | null;
  careerScore: number | null;
  highScores: Array<{ code: string; score: number }>;
}

export default function FairnessPage() {
  const [tierStats, setTierStats] = useState<Record<string, TierStat>>({});
  const [falseNegatives, setFalseNegatives] = useState<FalseNegative[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats?type=fairness")
      .then((r) => r.json())
      .then((data) => {
        setTierStats(data.tierStats || {});
        setFalseNegatives(data.falseNegatives || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const tiers = ["PRIORITY_1", "TIER_1", "TIER_2", "OTHER"];
  const tierLabels: Record<string, string> = {
    PRIORITY_1: "Priority Tier 1",
    TIER_1: "Tier 1",
    TIER_2: "Tier 2",
    OTHER: "Other",
  };
  const tierColors: Record<string, string> = {
    PRIORITY_1: "#8b5cf6",
    TIER_1: "#3b82f6",
    TIER_2: "#06b6d4",
    OTHER: "#9ca3af",
  };

  const codeLabels: Record<string, string> = {
    E1: "Institution", E2: "Degree", E3: "Master's", E4: "Academic", E5: "Engagement",
    C1: "Career", C2: "Leadership", C3: "Entrepreneurial", C4: "Excellence", C5: "Distinction",
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight">Fairness & Audit</h1>
          <p className="text-[15px] text-muted-foreground mt-1">Loading...</p>
        </div>
      </div>
    );
  }

  const maxTotal = Math.max(...tiers.map((t) => tierStats[t]?.total || 0), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight">Fairness & Audit</h1>
        <p className="text-[15px] text-muted-foreground mt-1">
          Monitor selection rates and identify potential bias
        </p>
      </div>

      {/* Selection Rates by University Tier */}
      <div className="apple-card p-6">
        <h3 className="text-[15px] font-semibold mb-1">Selection Rates by University Tier</h3>
        <p className="text-[12px] text-muted-foreground mb-6">
          Proportion selected (Strong Yes + Yes) per tier
        </p>

        <div className="space-y-5">
          {tiers.map((tier) => {
            const stat = tierStats[tier] || { total: 0, selected: 0 };
            const rate = stat.total > 0 ? (stat.selected / stat.total) * 100 : 0;
            const barWidth = stat.total > 0 ? (stat.total / maxTotal) * 100 : 0;

            return (
              <div key={tier} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: tierColors[tier] }}
                    />
                    <span className="text-[13px] font-medium">{tierLabels[tier]}</span>
                  </div>
                  <div className="text-[13px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{stat.selected}</span>
                    <span> / {stat.total}</span>
                    <span className="ml-2 font-medium" style={{ color: tierColors[tier] }}>
                      {rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="relative h-6 bg-secondary/60 rounded-lg overflow-hidden">
                  {/* Total bar */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-lg opacity-20"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: tierColors[tier],
                    }}
                  />
                  {/* Selected bar */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-lg"
                    style={{
                      width: `${(stat.selected / maxTotal) * 100}%`,
                      backgroundColor: tierColors[tier],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Disparity indicator */}
        {Object.keys(tierStats).length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Disparity Check</span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              {(() => {
                const rates = tiers
                  .map((t) => tierStats[t])
                  .filter((s) => s && s.total > 0)
                  .map((s) => s.selected / s.total);
                if (rates.length < 2) return "Insufficient data for disparity analysis.";
                const maxRate = Math.max(...rates);
                const minRate = Math.min(...rates);
                const ratio = maxRate > 0 ? minRate / maxRate : 1;
                if (ratio >= 0.8) return "Selection rates are within acceptable bounds (4/5ths rule satisfied).";
                return `Potential adverse impact detected. Selection ratio: ${ratio.toFixed(2)} (below 0.80 threshold). Review subcategory weights and thresholds.`;
              })()}
            </p>
          </div>
        )}
      </div>

      {/* False Negative Sampler */}
      <div className="apple-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30">
          <h3 className="text-[15px] font-semibold">False Negative Review Queue</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Candidates in "No" zone with high subcategory spikes (score 4+)
          </p>
        </div>

        {falseNegatives.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-muted-foreground">
            No false negative candidates to review
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {falseNegatives.map((fn) => (
              <a
                key={fn.id}
                href={`/candidates/${fn.id}`}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-secondary/30 transition-smooth"
              >
                <div>
                  <p className="text-[13px] font-medium">{fn.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Edu: {fn.eduScore?.toFixed(1) || "–"} / Career: {fn.careerScore?.toFixed(1) || "–"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {fn.highScores.map((hs) => (
                    <span
                      key={hs.code}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                    >
                      {codeLabels[hs.code] || hs.code}: {hs.score}/5
                    </span>
                  ))}
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                    Review
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
