"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  cn,
  formatNumber,
  getZoneColor,
  getZoneLabel,
  getSubcategoryLabel,
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

interface PreviewResult {
  zoneCounts: Record<string, number>;
  hiringZonePassCount: number;
  totalCandidates: number;
  matrixPoints: Array<{ id: string; x: number; y: number; zone: string; name: string }>;
}

const SUBCATEGORY_CODES = ["E1", "E2", "E3", "E4", "E5", "C1", "C2", "C3", "C4", "C5"];
const THRESHOLD_OPTIONS = [
  { value: "ANY", label: "Any" },
  { value: "TOP_25", label: "Top 25%" },
  { value: "TOP_10", label: "Top 10%" },
  { value: "TOP_5", label: "Top 5%" },
  { value: "TOP_1", label: "Top 1%" },
];

const ZONE_ORDER = ["STRONG_YES", "YES", "MAYBE", "NO", "PRESCREEN_FAIL"] as const;

function zoneBadgeVariant(zone: string) {
  switch (zone) {
    case "STRONG_YES": return "zone-strong-yes" as const;
    case "YES": return "zone-yes" as const;
    case "MAYBE": return "zone-maybe" as const;
    case "NO": return "zone-no" as const;
    default: return "secondary" as const;
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HiringZonePage() {
  const router = useRouter();

  /* --- Policy state --- */
  const [strongYesCutoff, setStrongYesCutoff] = useState(18);
  const [yesCutoff, setYesCutoff] = useState(15);
  const [maybeCutoff, setMaybeCutoff] = useState(10);
  const [spikeEnabled, setSpikeEnabled] = useState(true);
  const [spikeThreshold, setSpikeThreshold] = useState(0.99);
  const [subcategoryThresholds, setSubcategoryThresholds] = useState<Record<string, string>>(
    Object.fromEntries(SUBCATEGORY_CODES.map((c) => [c, "ANY"]))
  );
  const [targetSlots, setTargetSlots] = useState<string>("");
  const [policyName, setPolicyName] = useState("");

  /* --- Preview state --- */
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  /* --- Derived cutoffs --- */
  const axisCutoffs: AxisCutoffs = {
    strongYes: strongYesCutoff,
    yes: yesCutoff,
    maybe: maybeCutoff,
  };

  /* --- Auto-preview on changes --- */
  const runPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          axisCutoffs: {
            strongYes: strongYesCutoff,
            yes: yesCutoff,
            maybe: maybeCutoff,
          },
          subcategoryThresholds,
          spikePolicy: {
            enabled: spikeEnabled,
            thresholdPct: spikeThreshold,
          },
        }),
      });
      if (!res.ok) throw new Error("Preview failed");
      setPreview(await res.json());
    } catch {
      // silent
    } finally {
      setPreviewLoading(false);
    }
  }, [strongYesCutoff, yesCutoff, maybeCutoff, subcategoryThresholds, spikeEnabled, spikeThreshold]);

  useEffect(() => {
    const t = setTimeout(runPreview, 300);
    return () => clearTimeout(t);
  }, [runPreview]);

  /* --- Auto-suggest for capacity target --- */
  const suggestedCutoffs = (() => {
    if (!targetSlots || !preview || preview.totalCandidates === 0) return null;
    const target = parseInt(targetSlots);
    if (isNaN(target) || target <= 0) return null;

    // Simple: count how many are in STRONG_YES + YES
    const currentSY = preview.zoneCounts.STRONG_YES ?? 0;
    const currentY = preview.zoneCounts.YES ?? 0;
    const currentSelected = currentSY + currentY;

    if (currentSelected >= target) {
      // Need to raise cutoffs
      return { strongYes: strongYesCutoff + 1, yes: yesCutoff + 1, action: "raise" };
    } else {
      // Need to lower cutoffs
      const newYes = Math.max(yesCutoff - 2, maybeCutoff);
      const newStrong = Math.max(strongYesCutoff - 2, newYes);
      return { strongYes: newStrong, yes: newYes, action: "lower" };
    }
  })();

  /* --- Save policy --- */
  const savePolicy = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          name: policyName || `Policy ${new Date().toISOString().slice(0, 16)}`,
          axisCutoffs: { strongYes: strongYesCutoff, yes: yesCutoff, maybe: maybeCutoff },
          subcategoryThresholds,
          spikePolicy: { enabled: spikeEnabled, thresholdPct: spikeThreshold },
          weights: {
            edu: { E1: 0.30, E2: 0.30, E3: 0.10, E4: 0.20, E5: 0.10 },
            career: { C1: 0.40, C2: 0.25, C3: 0.20, C4: 0.10, C5: 0.05 },
          },
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  /* --- Matrix data conversion --- */
  const matrixPoints: MatrixPoint[] = (preview?.matrixPoints || []).map((p) => ({
    ...p,
    hiringZonePass: false,
  }));

  // Compute bins for density
  const binSize = 2;
  const binsMap: Record<string, MatrixBin> = {};
  for (const p of matrixPoints) {
    const bx = Math.floor(p.x / binSize) * binSize;
    const by = Math.floor(p.y / binSize) * binSize;
    const key = `${bx},${by}`;
    if (!binsMap[key]) {
      binsMap[key] = { x: bx + binSize / 2, y: by + binSize / 2, count: 0, zones: {} };
    }
    binsMap[key].count++;
    binsMap[key].zones[p.zone] = (binsMap[key].zones[p.zone] || 0) + 1;
  }
  const matrixBins = Object.values(binsMap);
  const useDensity = matrixPoints.length > 500;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-foreground leading-none">
            Hiring Zone Builder
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Configure policy thresholds and preview impact in real time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Policy name..."
            value={policyName}
            onChange={(e) => setPolicyName(e.target.value)}
            className="h-9 px-3 rounded-lg bg-secondary/60 border-0 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 w-48"
          />
          <Button
            onClick={savePolicy}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : saveSuccess ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : null}
            {saveSuccess ? "Saved" : "Save Policy"}
          </Button>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-12 gap-6">

        {/* ============================================================ */}
        {/*  LEFT: Controls                                               */}
        {/* ============================================================ */}
        <div className="col-span-3 space-y-4">
          {/* Axis cutoff sliders */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[14px]">Axis Cutoffs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-medium text-muted-foreground">Strong Yes</span>
                  <span className="text-[13px] font-bold text-foreground tabular-nums">{strongYesCutoff}</span>
                </div>
                <Slider
                  value={[strongYesCutoff]}
                  onValueChange={([v]) => setStrongYesCutoff(v)}
                  min={0}
                  max={25}
                  step={0.5}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-medium text-muted-foreground">Yes</span>
                  <span className="text-[13px] font-bold text-foreground tabular-nums">{yesCutoff}</span>
                </div>
                <Slider
                  value={[yesCutoff]}
                  onValueChange={([v]) => setYesCutoff(v)}
                  min={0}
                  max={25}
                  step={0.5}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-medium text-muted-foreground">Maybe</span>
                  <span className="text-[13px] font-bold text-foreground tabular-nums">{maybeCutoff}</span>
                </div>
                <Slider
                  value={[maybeCutoff]}
                  onValueChange={([v]) => setMaybeCutoff(v)}
                  min={0}
                  max={25}
                  step={0.5}
                />
              </div>
            </CardContent>
          </Card>

          {/* Spike policy */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[14px]">Spike Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground">Enable spike promotion</span>
                <button
                  onClick={() => setSpikeEnabled(!spikeEnabled)}
                  className={cn(
                    "w-10 h-6 rounded-full transition-all duration-200 relative",
                    spikeEnabled ? "bg-primary" : "bg-gray-200"
                  )}
                >
                  <div className={cn(
                    "w-4.5 h-4.5 rounded-full bg-white shadow-sm absolute top-[3px] transition-all duration-200",
                    spikeEnabled ? "left-[19px]" : "left-[3px]"
                  )} style={{ width: 18, height: 18 }} />
                </button>
              </div>
              {spikeEnabled && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-medium text-muted-foreground">Threshold</span>
                    <span className="text-[13px] font-bold text-foreground tabular-nums">{(spikeThreshold * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[spikeThreshold * 100]}
                    onValueChange={([v]) => setSpikeThreshold(v / 100)}
                    min={90}
                    max={100}
                    step={1}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subcategory percentile thresholds */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[14px]">Percentile Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {SUBCATEGORY_CODES.map((code) => (
                <div key={code} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground tabular-nums w-5">{code}</span>
                    <span className="text-[11px] text-foreground truncate max-w-[100px]">{getSubcategoryLabel(code)}</span>
                  </div>
                  <select
                    value={subcategoryThresholds[code]}
                    onChange={(e) =>
                      setSubcategoryThresholds((prev) => ({ ...prev, [code]: e.target.value }))
                    }
                    className="h-7 px-2 rounded-md bg-secondary/60 border-0 text-[10px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer"
                  >
                    {THRESHOLD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Capacity target */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[14px]">Capacity Target</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-[12px] text-muted-foreground mb-1 block">
                  Target interview slots
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={targetSlots}
                  onChange={(e) => setTargetSlots(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-secondary/60 border-0 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
              {suggestedCutoffs && (
                <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-100 space-y-2">
                  <p className="text-[11px] font-medium text-blue-700">
                    Suggestion: {suggestedCutoffs.action === "raise" ? "Raise" : "Lower"} cutoffs
                  </p>
                  <p className="text-[10px] text-blue-600">
                    Strong Yes: {suggestedCutoffs.strongYes} / Yes: {suggestedCutoffs.yes}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[11px] h-7 text-blue-700 border-blue-200 hover:bg-blue-100"
                    onClick={() => {
                      setStrongYesCutoff(suggestedCutoffs.strongYes);
                      setYesCutoff(suggestedCutoffs.yes);
                    }}
                  >
                    Apply Suggestion
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ============================================================ */}
        {/*  CENTER: Matrix                                               */}
        {/* ============================================================ */}
        <div className="col-span-6">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-[17px]">Policy Preview</CardTitle>
                  {preview && (
                    <p className="text-[13px] text-muted-foreground mt-1">
                      {preview.totalCandidates.toLocaleString()} candidates
                      {previewLoading && " (updating...)"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  {["STRONG_YES", "YES", "MAYBE", "NO"].map((zone) => (
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
            <CardContent className="pt-0 flex justify-center">
              {preview && preview.totalCandidates > 0 ? (
                <MatrixChart
                  points={useDensity ? [] : matrixPoints}
                  bins={matrixBins}
                  useDensity={useDensity}
                  axisCutoffs={axisCutoffs}
                  width={560}
                  height={480}
                  onPointClick={(id) => router.push(`/candidates/${id}`)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-[15px] font-medium text-foreground">No data</p>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    Load demo data first to preview policy impact
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ============================================================ */}
        {/*  RIGHT: Counts & Shortlist Preview                            */}
        {/* ============================================================ */}
        <div className="col-span-3 space-y-4">
          {/* Zone counts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[14px]">Zone Counts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ZONE_ORDER.map((zone) => {
                const count = preview?.zoneCounts[zone] ?? 0;
                const pct = preview && preview.totalCandidates > 0
                  ? (count / preview.totalCandidates) * 100
                  : 0;
                return (
                  <div key={zone}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: getZoneColor(zone) }}
                        />
                        <span className="text-[12px] font-medium text-muted-foreground">
                          {getZoneLabel(zone)}
                        </span>
                      </div>
                      <span className="text-[13px] font-bold text-foreground tabular-nums">
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
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

          {/* Hiring zone pass */}
          <Card className="border-blue-100 bg-blue-50/30">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="M22 4 12 14.01l-3-3" />
                </svg>
                <span className="text-[13px] font-semibold text-blue-700">Hiring Zone Pass</span>
              </div>
              <p className="text-[32px] font-bold text-blue-700 tabular-nums leading-none">
                {preview?.hiringZonePassCount ?? 0}
              </p>
              {preview && preview.totalCandidates > 0 && (
                <p className="text-[12px] text-blue-600 mt-1 tabular-nums">
                  {((preview.hiringZonePassCount / preview.totalCandidates) * 100).toFixed(1)}% of cohort
                </p>
              )}
            </CardContent>
          </Card>

          {/* Strong Yes + Yes total */}
          <Card>
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Selected (Strong Yes + Yes)
              </p>
              <p className="text-[28px] font-bold text-foreground tabular-nums leading-none">
                {((preview?.zoneCounts.STRONG_YES ?? 0) + (preview?.zoneCounts.YES ?? 0)).toLocaleString()}
              </p>
              {targetSlots && (
                <p className="text-[12px] text-muted-foreground mt-1">
                  Target: {targetSlots} slots
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-[12px] justify-start gap-2"
                onClick={() => {
                  window.location.href = "/api/export?type=shortlist&format=csv";
                }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Export Shortlist (CSV)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-[12px] justify-start gap-2"
                onClick={() => {
                  window.location.href = "/api/export?type=audit&format=json";
                }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
                Export Audit Log (JSON)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-[12px] justify-start gap-2"
                onClick={() => router.push("/candidates")}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                </svg>
                View All Candidates
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
