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
  getSubcategoryLabel,
} from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SubScore {
  code: string;
  ladderScore: number;
  percentile: number | null;
}

interface CandidateRow {
  id: string;
  fullName: string;
  email: string | null;
  location: string | null;
  createdAt: string;
  axisScore: { eduScore: number; careerScore: number } | null;
  preScreenResult: { status: string; reasons: any } | null;
  zoneAssignments: Array<{ zone: string; hiringZonePass: boolean }>;
  subcategoryScores: SubScore[];
}

/* ------------------------------------------------------------------ */
/*  Zone badge helper                                                  */
/* ------------------------------------------------------------------ */

function zoneBadgeVariant(zone: string) {
  switch (zone) {
    case "STRONG_YES": return "zone-strong-yes" as const;
    case "YES": return "zone-yes" as const;
    case "MAYBE": return "zone-maybe" as const;
    case "NO": return "zone-no" as const;
    case "PRESCREEN_FAIL": return "zone-prescreen-fail" as const;
    default: return "secondary" as const;
  }
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-gray-100", className)} />;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CandidatesPage() {
  const router = useRouter();

  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"combined" | "edu" | "career" | "name">("combined");
  const limit = 25;

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search) params.set("search", search);
    if (zoneFilter) params.set("zone", zoneFilter);

    try {
      const res = await fetch(`/api/candidates?${params}`);
      if (!res.ok) throw new Error("Failed to fetch candidates");
      const data = await res.json();
      setCandidates(data.candidates || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, zoneFilter]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, zoneFilter]);

  // Client-side sort
  const sorted = [...candidates].sort((a, b) => {
    if (sortBy === "name") return a.fullName.localeCompare(b.fullName);
    const aEdu = a.axisScore?.eduScore ?? 0;
    const bEdu = b.axisScore?.eduScore ?? 0;
    const aCareer = a.axisScore?.careerScore ?? 0;
    const bCareer = b.axisScore?.careerScore ?? 0;
    if (sortBy === "edu") return bEdu - aEdu;
    if (sortBy === "career") return bCareer - aCareer;
    return (bEdu + bCareer) - (aEdu + aCareer);
  });

  const ZONES = ["", "STRONG_YES", "YES", "MAYBE", "NO", "PRESCREEN_FAIL"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-foreground leading-none">
            Candidates
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {total.toLocaleString()} candidates in the system
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-[13px]"
            onClick={() => {
              window.location.href = "/api/export?type=shortlist&format=csv";
            }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export Shortlist
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-[13px]"
            onClick={() => {
              window.location.href = "/api/export?type=audit&format=json";
            }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            Audit Log
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-4 rounded-lg bg-secondary/60 border-0 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>

            {/* Zone filter */}
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="h-9 px-3 rounded-lg bg-secondary/60 border-0 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer"
            >
              <option value="">All Zones</option>
              {ZONES.filter(Boolean).map((z) => (
                <option key={z} value={z}>{getZoneLabel(z)}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 px-3 rounded-lg bg-secondary/60 border-0 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer"
            >
              <option value="combined">Sort: Combined Score</option>
              <option value="edu">Sort: Education</option>
              <option value="career">Sort: Career</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                </svg>
              </div>
              <p className="text-[15px] font-medium text-foreground">No candidates found</p>
              <p className="text-[13px] text-muted-foreground mt-1">
                {search || zoneFilter ? "Try adjusting your filters" : "Upload CVs or load demo data to get started"}
              </p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_100px_100px_100px_110px_80px] gap-4 px-6 py-3 border-b border-border/30 bg-gray-50/50">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Candidate</span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Education</span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Career</span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Combined</span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Zone</span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center">HZ</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-border/30">
                {sorted.map((c) => {
                  const edu = c.axisScore?.eduScore ?? 0;
                  const career = c.axisScore?.careerScore ?? 0;
                  const combined = edu + career;
                  const zone = c.zoneAssignments?.[0]?.zone || "NO";
                  const hiringZonePass = c.zoneAssignments?.[0]?.hiringZonePass || false;
                  const preScreenFail = c.preScreenResult?.status === "FAIL";

                  return (
                    <div
                      key={c.id}
                      className="grid grid-cols-[1fr_100px_100px_100px_110px_80px] gap-4 px-6 py-3.5 items-center cursor-pointer hover:bg-gray-50/60 transition-smooth"
                      onClick={() => router.push(`/candidates/${c.id}`)}
                    >
                      {/* Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/[0.06] flex items-center justify-center shrink-0">
                          <span className="text-[12px] font-semibold text-primary">
                            {c.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">{c.fullName}</p>
                          {c.email && (
                            <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>
                          )}
                        </div>
                      </div>

                      {/* Edu */}
                      <div className="text-right">
                        <span className="text-[14px] font-semibold text-foreground tabular-nums">{formatNumber(edu)}</span>
                        <span className="text-[11px] text-muted-foreground ml-0.5">/25</span>
                      </div>

                      {/* Career */}
                      <div className="text-right">
                        <span className="text-[14px] font-semibold text-foreground tabular-nums">{formatNumber(career)}</span>
                        <span className="text-[11px] text-muted-foreground ml-0.5">/25</span>
                      </div>

                      {/* Combined */}
                      <div className="text-right">
                        <span className="text-[15px] font-bold text-foreground tabular-nums">{formatNumber(combined)}</span>
                        <span className="text-[11px] text-muted-foreground ml-0.5">/50</span>
                      </div>

                      {/* Zone */}
                      <div className="flex justify-center">
                        <Badge variant={zoneBadgeVariant(preScreenFail ? "PRESCREEN_FAIL" : zone)} className="text-[10px]">
                          {preScreenFail ? "Pre-screen Fail" : getZoneLabel(zone)}
                        </Badge>
                      </div>

                      {/* HZ */}
                      <div className="flex justify-center">
                        {hiringZonePass ? (
                          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                            Pass
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40">-</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-muted-foreground">
            Showing {((page - 1) * limit) + 1}-{Math.min(page * limit, total)} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="text-[12px] h-8"
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-[12px] font-medium transition-smooth",
                      page === pageNum
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="text-[12px] h-8"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
