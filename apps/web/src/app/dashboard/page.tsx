"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  cn,
  formatNumber,
  getZoneColor,
  getZoneLabel,
  getZoneBgClass,
} from "@/lib/utils";
import {
  MatrixChart,
  type MatrixPoint,
  type MatrixBin,
  type AxisCutoffs,
} from "@/components/matrix-chart";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OverviewStats {
  totalCandidates: number;
  totalFiles: number;
  pendingFiles: number;
  zoneCounts: Record<string, number>;
  hiringZonePassCount: number;
  cohortStats: any;
}

interface MatrixData {
  points: MatrixPoint[];
  bins: MatrixBin[];
  totalPoints: number;
  useDensity: boolean;
}

interface CandidateRow {
  id: string;
  fullName: string;
  axisScore: { eduScore: number; careerScore: number } | null;
  zoneAssignments: Array<{ zone: string; hiringZonePass: boolean }>;
}

/* ------------------------------------------------------------------ */
/*  Skeleton helpers                                                    */
/* ------------------------------------------------------------------ */

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-gray-100",
        className,
      )}
    />
  );
}

function CardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <Skeleton className="h-3 w-20 mb-3" />
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-12" />
      </CardContent>
    </Card>
  );
}

function MatrixSkeleton() {
  return (
    <Card>
      <CardContent className="p-8">
        <Skeleton className="h-5 w-40 mb-6" />
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <Skeleton className="h-5 w-36 mb-5" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Zone config                                                        */
/* ------------------------------------------------------------------ */

const ZONE_ORDER = ["STRONG_YES", "YES", "MAYBE", "NO"] as const;

const ZONE_ICONS: Record<string, string> = {
  STRONG_YES: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  YES: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  MAYBE: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  NO: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
};

function zoneBadgeVariant(zone: string) {
  switch (zone) {
    case "STRONG_YES":
      return "zone-strong-yes" as const;
    case "YES":
      return "zone-yes" as const;
    case "MAYBE":
      return "zone-maybe" as const;
    case "NO":
      return "zone-no" as const;
    default:
      return "secondary" as const;
  }
}

/* ------------------------------------------------------------------ */
/*  Dashboard Page                                                     */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const router = useRouter();

  /* ---------- state ---------- */
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [topCandidates, setTopCandidates] = useState<CandidateRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------- data fetching ---------- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [overviewRes, matrixRes, candidatesRes] = await Promise.all([
        fetch("/api/stats?type=overview"),
        fetch("/api/stats?type=matrix"),
        fetch("/api/candidates?limit=10"),
      ]);

      if (!overviewRes.ok || !matrixRes.ok || !candidatesRes.ok) {
        throw new Error("Failed to load dashboard data");
      }

      const [overviewData, matrixData, candidatesData] = await Promise.all([
        overviewRes.json(),
        matrixRes.json(),
        candidatesRes.json(),
      ]);

      setOverview(overviewData);
      setMatrix(matrixData);

      // Sort candidates by combined score descending
      const sorted = (candidatesData.candidates || [])
        .filter((c: CandidateRow) => c.axisScore)
        .sort(
          (a: CandidateRow, b: CandidateRow) =>
            (b.axisScore!.eduScore + b.axisScore!.careerScore) -
            (a.axisScore!.eduScore + a.axisScore!.careerScore),
        )
        .slice(0, 10);

      setTopCandidates(sorted);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---------- demo dataset handler ---------- */
  const loadDemo = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/demo", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load demo dataset");
      }
      // Refresh all data after demo seed
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to load demo dataset");
    } finally {
      setDemoLoading(false);
    }
  };

  /* ---------- derived ---------- */
  const axisCutoffs: AxisCutoffs = { strongYes: 18, yes: 15, maybe: 10 };
  const isEmpty = overview && overview.totalCandidates === 0;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-8">
      {/* ============================================================ */}
      {/*  Hero                                                         */}
      {/* ============================================================ */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-foreground leading-none">
            Dashboard
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {loading
              ? "Loading candidate data..."
              : overview
                ? `${overview.totalCandidates.toLocaleString()} candidates scored`
                : "No data available"}
          </p>
        </div>

        <Button
          onClick={loadDemo}
          disabled={demoLoading}
          variant="outline"
          size="default"
          className="gap-2"
        >
          {demoLoading ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Seeding...
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              Load Demo Dataset
            </>
          )}
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* ============================================================ */}
      {/*  Zone Count Cards                                             */}
      {/* ============================================================ */}
      {loading ? (
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-5 gap-4">
          {ZONE_ORDER.map((zone) => {
            const count = overview.zoneCounts[zone] ?? 0;
            return (
              <Card key={zone} className="relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg
                      className="w-4 h-4"
                      style={{ color: getZoneColor(zone) }}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={ZONE_ICONS[zone]} />
                    </svg>
                    <span className="text-[13px] font-medium text-muted-foreground">
                      {getZoneLabel(zone)}
                    </span>
                  </div>
                  <p className="text-[28px] font-bold tracking-tight text-foreground leading-none">
                    {count.toLocaleString()}
                  </p>
                  <div className="mt-2">
                    <Badge variant={zoneBadgeVariant(zone)} className="text-[10px]">
                      {overview.totalCandidates > 0
                        ? `${((count / overview.totalCandidates) * 100).toFixed(1)}%`
                        : "0%"}
                    </Badge>
                  </div>
                  {/* Decorative accent bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px]"
                    style={{ backgroundColor: getZoneColor(zone) }}
                  />
                </CardContent>
              </Card>
            );
          })}

          {/* Hiring Zone Pass card */}
          <Card className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <svg
                  className="w-4 h-4 text-blue-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="M22 4 12 14.01l-3-3" />
                </svg>
                <span className="text-[13px] font-medium text-muted-foreground">
                  Hiring Zone Pass
                </span>
              </div>
              <p className="text-[28px] font-bold tracking-tight text-foreground leading-none">
                {overview.hiringZonePassCount.toLocaleString()}
              </p>
              <div className="mt-2">
                <Badge
                  className="text-[10px] border-blue-200 bg-blue-50 text-blue-700"
                >
                  {overview.totalCandidates > 0
                    ? `${((overview.hiringZonePassCount / overview.totalCandidates) * 100).toFixed(1)}%`
                    : "0%"}
                </Badge>
              </div>
              {/* Decorative accent bar */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-blue-600" />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ============================================================ */}
      {/*  Matrix + Distribution Sidebar                                */}
      {/* ============================================================ */}
      <div className="grid grid-cols-12 gap-6">
        {/* --- Matrix (left 8 cols) --- */}
        <div className="col-span-8">
          {loading ? (
            <MatrixSkeleton />
          ) : matrix && matrix.totalPoints > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-[17px]">
                      Candidate Matrix
                    </CardTitle>
                    <p className="text-[13px] text-muted-foreground mt-1">
                      {matrix.totalPoints.toLocaleString()} candidates plotted
                      {matrix.useDensity ? " (density view)" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    {ZONE_ORDER.map((zone) => (
                      <div key={zone} className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: getZoneColor(zone) }}
                        />
                        {getZoneLabel(zone)}
                      </div>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-6 px-6">
                <div className="flex justify-center">
                  <MatrixChart
                    points={matrix.points}
                    bins={matrix.bins}
                    useDensity={matrix.useDensity}
                    axisCutoffs={axisCutoffs}
                    width={680}
                    height={520}
                    onPointClick={(id) => router.push(`/candidates/${id}`)}
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                  <svg
                    className="w-8 h-8 text-muted-foreground/40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z" />
                  </svg>
                </div>
                <p className="text-[15px] font-medium text-foreground">
                  No candidate data yet
                </p>
                <p className="text-[13px] text-muted-foreground mt-1 max-w-sm">
                  Upload CVs or load the demo dataset to see the candidate
                  distribution matrix.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* --- Distribution sidebar (right 4 cols) --- */}
        <div className="col-span-4 space-y-4">
          {loading ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : overview ? (
            <>
              {/* Zone distribution mini bars */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-[15px]">Zone Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {ZONE_ORDER.map((zone) => {
                    const count = overview.zoneCounts[zone] ?? 0;
                    const pct =
                      overview.totalCandidates > 0
                        ? (count / overview.totalCandidates) * 100
                        : 0;
                    return (
                      <div key={zone}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-medium text-muted-foreground">
                            {getZoneLabel(zone)}
                          </span>
                          <span className="text-[12px] font-semibold text-foreground tabular-nums">
                            {count}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: getZoneColor(zone),
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Processing stats */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-[15px]">Processing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">
                      Total CVs
                    </span>
                    <span className="text-[13px] font-semibold text-foreground tabular-nums">
                      {overview.totalFiles.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">
                      Candidates Scored
                    </span>
                    <span className="text-[13px] font-semibold text-foreground tabular-nums">
                      {overview.totalCandidates.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">
                      Pending
                    </span>
                    <span className="text-[13px] font-semibold text-foreground tabular-nums">
                      {overview.pendingFiles}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">
                      Hiring Zone Pass Rate
                    </span>
                    <span className="text-[13px] font-semibold text-blue-600 tabular-nums">
                      {overview.totalCandidates > 0
                        ? `${((overview.hiringZonePassCount / overview.totalCandidates) * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Score range summary */}
              {overview.cohortStats?.axes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[15px]">Score Ranges</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      {
                        label: "Education",
                        axis: overview.cohortStats.axes.edu,
                        color: "#6366f1",
                      },
                      {
                        label: "Career",
                        axis: overview.cohortStats.axes.career,
                        color: "#8b5cf6",
                      },
                    ].map(
                      (item) =>
                        item.axis && (
                          <div key={item.label}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[12px] font-medium text-muted-foreground">
                                {item.label}
                              </span>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                avg {formatNumber(item.axis.mean)}
                              </span>
                            </div>
                            <div className="relative h-2 w-full rounded-full bg-gray-100">
                              {/* Range bar */}
                              <div
                                className="absolute h-full rounded-full opacity-30"
                                style={{
                                  left: `${(Math.max(item.axis.min, 0) / 25) * 100}%`,
                                  width: `${((Math.min(item.axis.max, 25) - Math.max(item.axis.min, 0)) / 25) * 100}%`,
                                  backgroundColor: item.color,
                                }}
                              />
                              {/* Mean marker */}
                              <div
                                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-white"
                                style={{
                                  left: `${(item.axis.mean / 25) * 100}%`,
                                  backgroundColor: item.color,
                                }}
                              />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                                {formatNumber(item.axis.min)}
                              </span>
                              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                                {formatNumber(item.axis.max)}
                              </span>
                            </div>
                          </div>
                        ),
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Top Candidates                                               */}
      {/* ============================================================ */}
      {loading ? (
        <TableSkeleton />
      ) : topCandidates && topCandidates.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[17px]">Top Candidates</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/candidates")}
                className="text-[13px] text-muted-foreground"
              >
                View all
                <svg
                  className="w-3.5 h-3.5 ml-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/50">
              {topCandidates.map((candidate, i) => {
                const combined =
                  (candidate.axisScore?.eduScore ?? 0) +
                  (candidate.axisScore?.careerScore ?? 0);
                const zone =
                  candidate.zoneAssignments?.[0]?.zone || "NO";
                const hiringZonePass =
                  candidate.zoneAssignments?.[0]?.hiringZonePass || false;

                return (
                  <div
                    key={candidate.id}
                    className="flex items-center gap-4 py-3.5 cursor-pointer hover:bg-gray-50/60 -mx-6 px-6 transition-smooth"
                    onClick={() =>
                      router.push(`/candidates/${candidate.id}`)
                    }
                  >
                    {/* Rank */}
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                      <span className="text-[12px] font-semibold text-muted-foreground tabular-nums">
                        {i + 1}
                      </span>
                    </div>

                    {/* Name + scores */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-foreground truncate">
                        {candidate.fullName}
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        Edu{" "}
                        <span className="font-medium text-foreground">
                          {formatNumber(candidate.axisScore?.eduScore ?? 0)}
                        </span>
                        <span className="mx-1.5 text-border">|</span>
                        Career{" "}
                        <span className="font-medium text-foreground">
                          {formatNumber(candidate.axisScore?.careerScore ?? 0)}
                        </span>
                      </p>
                    </div>

                    {/* Combined score */}
                    <div className="text-right shrink-0">
                      <p className="text-[16px] font-bold text-foreground tabular-nums">
                        {formatNumber(combined)}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        combined
                      </p>
                    </div>

                    {/* Zone badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={zoneBadgeVariant(zone)}>
                        {getZoneLabel(zone)}
                      </Badge>
                      {hiringZonePass && (
                        <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md">
                          HZ
                        </span>
                      )}
                    </div>

                    {/* Chevron */}
                    <svg
                      className="w-4 h-4 text-muted-foreground/40 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
