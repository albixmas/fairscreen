"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  cn,
  formatNumber,
  getZoneColor,
  getZoneLabel,
  getSubcategoryLabel,
} from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SubScore {
  id: string;
  axis: string;
  code: string;
  ladderScore: number;
  normalizedU: number;
  weight: number;
  zScore: number | null;
  percentile: number | null;
  rationale: string;
  evidenceRefs: any;
}

interface AxisScoreData {
  eduScore: number;
  careerScore: number;
}

interface ZoneAssignment {
  zone: string;
  hiringZonePass: boolean;
  createdAt: string;
  policyVersion: {
    id: string;
    name: string;
    axisCutoffs: any;
    weights: any;
    createdAt: string;
  };
}

interface Extraction {
  id: string;
  provider: string;
  schemaVersion: string;
  status: string;
  extractedJson: any;
  evidenceJson: any;
  createdAt: string;
}

interface CandidateDetail {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  createdAt: string;
  cvFile: { id: string; filename: string; fileType: string } | null;
  extractions: Extraction[];
  preScreenResult: { status: string; reasons: any; yoeMonths: number | null; degreeClass: string | null } | null;
  subcategoryScores: SubScore[];
  axisScore: AxisScoreData | null;
  zoneAssignments: ZoneAssignment[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
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

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-gray-100", className)} />;
}

function ScoreBar({ score, max, color }: { score: number; max: number; color: string }) {
  const pct = Math.min((score / max) * 100, 100);
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function LadderDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "w-2.5 h-2.5 rounded-full transition-all duration-300",
            i <= score ? "bg-primary shadow-sm" : "bg-gray-100"
          )}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/candidates/${params.id}`);
        if (!res.ok) throw new Error("Candidate not found");
        setCandidate(await res.json());
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-[15px] font-medium text-foreground">Candidate not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/candidates")}>
          Back to Candidates
        </Button>
      </div>
    );
  }

  const zone = candidate.zoneAssignments?.[0]?.zone || "NO";
  const hiringZonePass = candidate.zoneAssignments?.[0]?.hiringZonePass || false;
  const edu = candidate.axisScore?.eduScore ?? 0;
  const career = candidate.axisScore?.careerScore ?? 0;
  const combined = edu + career;
  const extraction = candidate.extractions?.[0];
  const extractedData = extraction?.extractedJson as any;
  const evidenceData = (extraction?.evidenceJson || []) as any[];

  const eduScores = candidate.subcategoryScores.filter((s) => s.axis === "EDU").sort((a, b) => a.code.localeCompare(b.code));
  const careerScores = candidate.subcategoryScores.filter((s) => s.axis === "CAREER").sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/candidates")}
          className="w-8 h-8 rounded-lg bg-secondary/80 flex items-center justify-center hover:bg-secondary transition-smooth"
        >
          <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-[28px] font-bold tracking-tight text-foreground leading-none">
            {candidate.fullName}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            {candidate.email && (
              <span className="text-[13px] text-muted-foreground">{candidate.email}</span>
            )}
            {candidate.phone && (
              <span className="text-[13px] text-muted-foreground">{candidate.phone}</span>
            )}
            {candidate.location && (
              <span className="text-[13px] text-muted-foreground">{candidate.location}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={zoneBadgeVariant(zone)} className="text-[12px] px-3 py-1">
            {getZoneLabel(zone)}
          </Badge>
          {hiringZonePass && (
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
              Hiring Zone Pass
            </span>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Education Score */}
        <Card>
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Education
            </p>
            <p className="text-[28px] font-bold text-foreground tabular-nums leading-none">
              {formatNumber(edu)}
              <span className="text-[14px] font-normal text-muted-foreground ml-1">/25</span>
            </p>
            <div className="mt-3">
              <ScoreBar score={edu} max={25} color="#6366f1" />
            </div>
          </CardContent>
        </Card>

        {/* Career Score */}
        <Card>
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Career
            </p>
            <p className="text-[28px] font-bold text-foreground tabular-nums leading-none">
              {formatNumber(career)}
              <span className="text-[14px] font-normal text-muted-foreground ml-1">/25</span>
            </p>
            <div className="mt-3">
              <ScoreBar score={career} max={25} color="#8b5cf6" />
            </div>
          </CardContent>
        </Card>

        {/* Combined */}
        <Card>
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Combined
            </p>
            <p className="text-[28px] font-bold text-foreground tabular-nums leading-none">
              {formatNumber(combined)}
              <span className="text-[14px] font-normal text-muted-foreground ml-1">/50</span>
            </p>
            <div className="mt-3">
              <ScoreBar score={combined} max={50} color="#0ea5e9" />
            </div>
          </CardContent>
        </Card>

        {/* Pre-screen */}
        <Card>
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Pre-screen
            </p>
            {candidate.preScreenResult ? (
              <>
                <p className={cn(
                  "text-[20px] font-bold leading-none",
                  candidate.preScreenResult.status === "PASS" ? "text-emerald-600" : "text-red-500"
                )}>
                  {candidate.preScreenResult.status}
                </p>
                <div className="mt-2 space-y-1">
                  {candidate.preScreenResult.degreeClass && (
                    <p className="text-[11px] text-muted-foreground">
                      Degree: <span className="font-medium text-foreground">{candidate.preScreenResult.degreeClass}</span>
                    </p>
                  )}
                  {candidate.preScreenResult.yoeMonths != null && (
                    <p className="text-[11px] text-muted-foreground">
                      YOE: <span className="font-medium text-foreground">{candidate.preScreenResult.yoeMonths} months</span>
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[14px] text-muted-foreground">Not yet run</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="scores" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="scores">Scores</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/*  SCORES TAB                                                   */}
        {/* ============================================================ */}
        <TabsContent value="scores">
          <div className="grid grid-cols-2 gap-6">
            {/* Education Subcategories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  Educational Readiness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {eduScores.map((s) => (
                  <div key={s.code}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-muted-foreground tabular-nums w-6">{s.code}</span>
                        <span className="text-[13px] font-medium text-foreground">{getSubcategoryLabel(s.code)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <LadderDots score={s.ladderScore} />
                        <span className="text-[13px] font-bold text-foreground tabular-nums w-4 text-right">{s.ladderScore}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-8">
                      <span className="text-[10px] text-muted-foreground">
                        wt: {(s.weight * 100).toFixed(0)}%
                      </span>
                      {s.percentile != null && (
                        <span className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                          s.percentile >= 0.95 ? "bg-emerald-50 text-emerald-700" :
                          s.percentile >= 0.75 ? "bg-blue-50 text-blue-700" :
                          "bg-gray-50 text-muted-foreground"
                        )}>
                          P{(s.percentile * 100).toFixed(0)}
                        </span>
                      )}
                      {s.zScore != null && (
                        <span className="text-[10px] text-muted-foreground">
                          z={s.zScore.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {s.rationale && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 ml-8 leading-relaxed">
                        {s.rationale}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Career Subcategories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-500" />
                  Career & Leadership Readiness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {careerScores.map((s) => (
                  <div key={s.code}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-muted-foreground tabular-nums w-6">{s.code}</span>
                        <span className="text-[13px] font-medium text-foreground">{getSubcategoryLabel(s.code)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <LadderDots score={s.ladderScore} />
                        <span className="text-[13px] font-bold text-foreground tabular-nums w-4 text-right">{s.ladderScore}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-8">
                      <span className="text-[10px] text-muted-foreground">
                        wt: {(s.weight * 100).toFixed(0)}%
                      </span>
                      {s.percentile != null && (
                        <span className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                          s.percentile >= 0.95 ? "bg-emerald-50 text-emerald-700" :
                          s.percentile >= 0.75 ? "bg-blue-50 text-blue-700" :
                          "bg-gray-50 text-muted-foreground"
                        )}>
                          P{(s.percentile * 100).toFixed(0)}
                        </span>
                      )}
                      {s.zScore != null && (
                        <span className="text-[10px] text-muted-foreground">
                          z={s.zScore.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {s.rationale && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 ml-8 leading-relaxed">
                        {s.rationale}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/*  SUMMARY TAB                                                  */}
        {/* ============================================================ */}
        <TabsContent value="summary">
          <div className="grid grid-cols-2 gap-6">
            {/* Education */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px]">Education</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {extractedData?.education?.length > 0 ? (
                  extractedData.education.map((ed: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl bg-gray-50/80 space-y-1.5">
                      <p className="text-[14px] font-semibold text-foreground">{ed.institution}</p>
                      <p className="text-[13px] text-muted-foreground">
                        {ed.degreeType} {ed.field}
                      </p>
                      {ed.gradeText && (
                        <p className="text-[12px] text-muted-foreground">
                          Grade: <span className="font-medium text-foreground">{ed.gradeText}</span>
                          {ed.gradeNormalized && (
                            <span className="ml-2 text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              {ed.gradeNormalized}
                            </span>
                          )}
                        </p>
                      )}
                      {ed.startDate && (
                        <p className="text-[11px] text-muted-foreground">
                          {ed.startDate} - {ed.endDate || "Present"}
                        </p>
                      )}
                      {ed.awards?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {ed.awards.map((a: string, j: number) => (
                            <span key={j} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] text-muted-foreground">No education data extracted</p>
                )}
              </CardContent>
            </Card>

            {/* Work Experience */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px]">Work Experience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {extractedData?.work?.length > 0 ? (
                  extractedData.work.map((w: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl bg-gray-50/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[14px] font-semibold text-foreground">{w.employer}</p>
                        {w.qualifyingInternship && (
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                            Qualifying
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-muted-foreground">{w.roleTitle}</p>
                      {w.durationWeeks && (
                        <p className="text-[11px] text-muted-foreground">{w.durationWeeks} weeks</p>
                      )}
                      {w.divisionKeywordsFound?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {w.divisionKeywordsFound.map((k: string, j: number) => (
                            <span key={j} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md">
                              {k}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] text-muted-foreground">No work data extracted</p>
                )}
              </CardContent>
            </Card>

            {/* Leadership */}
            {extractedData?.leadershipProjects?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-[15px]">Leadership Projects</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {extractedData.leadershipProjects.map((lp: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl bg-gray-50/80 space-y-1.5">
                      <p className="text-[14px] font-semibold text-foreground">{lp.title}</p>
                      <p className="text-[13px] text-muted-foreground">{lp.org}</p>
                      {lp.scope?.teamSize && (
                        <p className="text-[11px] text-muted-foreground">Team: {lp.scope.teamSize}</p>
                      )}
                      {lp.achievements?.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {lp.achievements.map((a: string, j: number) => (
                            <li key={j} className="text-[11px] text-muted-foreground pl-3 relative before:absolute before:left-0 before:top-[7px] before:w-1 before:h-1 before:bg-muted-foreground/40 before:rounded-full">
                              {a}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Non-Academic Excellence */}
            {extractedData?.nonAcademicExcellence?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-[15px]">Non-Academic Excellence</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {extractedData.nonAcademicExcellence.map((nae: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl bg-gray-50/80 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">
                          {nae.domain}
                        </span>
                        <span className="text-[10px] font-semibold uppercase bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {nae.level}
                        </span>
                      </div>
                      <p className="text-[13px] text-foreground">{nae.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/*  EVIDENCE TAB                                                 */}
        {/* ============================================================ */}
        <TabsContent value="evidence">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-[15px]">Evidence Spans</CardTitle>
                {candidate.cvFile && (
                  <span className="text-[12px] text-muted-foreground">
                    Source: {candidate.cvFile.filename}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {evidenceData.length > 0 ? (
                <div className="space-y-3">
                  {evidenceData.map((ev: any, i: number) => (
                    <div
                      key={ev.id || i}
                      className="p-4 rounded-xl border border-border/50 bg-gray-50/40 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-mono font-medium text-primary">
                          {ev.fieldPath}
                        </span>
                        <div className="flex items-center gap-2">
                          {ev.page != null && (
                            <span className="text-[10px] bg-gray-100 text-muted-foreground px-1.5 py-0.5 rounded">
                              Page {ev.page}
                            </span>
                          )}
                          {ev.confidence != null && (
                            <span className={cn(
                              "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                              ev.confidence >= 0.9 ? "bg-emerald-50 text-emerald-700" :
                              ev.confidence >= 0.7 ? "bg-amber-50 text-amber-700" :
                              "bg-red-50 text-red-700"
                            )}>
                              {(ev.confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <blockquote className="text-[13px] text-foreground bg-white rounded-lg px-4 py-3 border-l-3 border-primary/30 italic leading-relaxed">
                        {ev.snippet}
                      </blockquote>
                      {(ev.startOffset != null || ev.endOffset != null) && (
                        <p className="text-[10px] text-muted-foreground/60">
                          Offsets: {ev.startOffset ?? "?"} - {ev.endOffset ?? "?"}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-[14px] text-muted-foreground">No evidence spans available</p>
                  <p className="text-[12px] text-muted-foreground/60 mt-1">
                    Evidence is generated during LLM extraction
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/*  AUDIT TAB                                                    */}
        {/* ============================================================ */}
        <TabsContent value="audit">
          <div className="space-y-6">
            {/* Pre-screen reasons */}
            {candidate.preScreenResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-[15px]">Pre-screen Result</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant={candidate.preScreenResult.status === "PASS" ? "zone-yes" : "zone-no"}>
                      {candidate.preScreenResult.status}
                    </Badge>
                    {candidate.preScreenResult.degreeClass && (
                      <span className="text-[12px] text-muted-foreground">
                        Degree class: <span className="font-medium">{candidate.preScreenResult.degreeClass}</span>
                      </span>
                    )}
                    {candidate.preScreenResult.yoeMonths != null && (
                      <span className="text-[12px] text-muted-foreground">
                        YOE: <span className="font-medium">{candidate.preScreenResult.yoeMonths} months</span>
                      </span>
                    )}
                  </div>
                  {Array.isArray(candidate.preScreenResult.reasons) && candidate.preScreenResult.reasons.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fail Reasons</p>
                      {candidate.preScreenResult.reasons.map((r: string, i: number) => (
                        <p key={i} className="text-[12px] text-red-600 pl-3 relative before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:bg-red-400 before:rounded-full">
                          {r}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Zone assignments history */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px]">Zone Assignment History</CardTitle>
              </CardHeader>
              <CardContent>
                {candidate.zoneAssignments.length > 0 ? (
                  <div className="space-y-3">
                    {candidate.zoneAssignments.map((za, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50/60">
                        <Badge variant={zoneBadgeVariant(za.zone)} className="text-[10px]">
                          {getZoneLabel(za.zone)}
                        </Badge>
                        {za.hiringZonePass && (
                          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md">
                            HZ Pass
                          </span>
                        )}
                        <span className="text-[12px] text-muted-foreground flex-1">
                          Policy: <span className="font-medium text-foreground">{za.policyVersion.name}</span>
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {new Date(za.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground">No zone assignments recorded</p>
                )}
              </CardContent>
            </Card>

            {/* Extraction metadata */}
            {extraction && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-[15px]">Extraction Metadata</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Provider</p>
                      <p className="text-[13px] font-medium text-foreground">{extraction.provider}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Schema Version</p>
                      <p className="text-[13px] font-medium text-foreground">{extraction.schemaVersion}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                      <Badge variant={extraction.status === "SUCCEEDED" ? "zone-yes" : "zone-no"} className="text-[10px]">
                        {extraction.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Extracted At</p>
                    <p className="text-[12px] text-muted-foreground tabular-nums">
                      {new Date(extraction.createdAt).toLocaleString("en-GB")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CV File info */}
            {candidate.cvFile && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-[15px]">Source File</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/[0.06] flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-foreground">{candidate.cvFile.filename}</p>
                      <p className="text-[11px] text-muted-foreground">{candidate.cvFile.fileType}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
