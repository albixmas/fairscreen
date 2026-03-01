/**
 * Deterministic scoring engine.
 * Takes extraction JSON + taxonomy lookups + weights -> produces subcategory scores, axis scores, zones.
 */

import type {
  ExtractionResult,
  SubcategoryScoreResult,
  AxisScoreResult,
  ZoneResult,
  AxisCutoffs,
  Weights,
  SpikePolicy,
  PreScreenRules,
} from "@fairscreen/shared";
import {
  DEFAULT_EDU_WEIGHTS,
  DEFAULT_CAREER_WEIGHTS,
  DEFAULT_AXIS_CUTOFFS,
} from "@fairscreen/shared";

import type { UniversityLookup, EmployerLookup, DivisionLookup } from "./taxonomy-lookup";
import { scoreE1, scoreE2, scoreE3, scoreE4, scoreE5 } from "./ladders";
import { scoreC1, scoreC2, scoreC3, scoreC4, scoreC5 } from "./ladders";
import { runPreScreen, type PreScreenOutput } from "./prescreen";

export interface ScoringContext {
  extraction: ExtractionResult;
  uniLookup: UniversityLookup;
  employerLookup: EmployerLookup;
  divisionLookup: DivisionLookup;
  weights?: Weights;
  axisCutoffs?: AxisCutoffs;
  spikePolicy?: SpikePolicy;
  preScreenRules?: PreScreenRules;
}

export interface ScoringResult {
  preScreen: PreScreenOutput;
  subcategoryScores: SubcategoryScoreResult[];
  axisScores: AxisScoreResult;
  zone: ZoneResult;
}

function normalizeU(ladderScore: number): number {
  return (ladderScore - 1) / 4;
}

function computeAxisScore(
  scores: SubcategoryScoreResult[],
  axis: "EDU" | "CAREER"
): number {
  const axisScores = scores.filter((s) => s.axis === axis);
  let sum = 0;
  for (const s of axisScores) {
    sum += s.weight * s.normalizedU;
  }
  return 25 * sum;
}

export function determineZone(
  eduScore: number,
  careerScore: number,
  cutoffs: AxisCutoffs,
  preScreenStatus: "PASS" | "FAIL",
  spikePolicy?: SpikePolicy,
  percentiles?: Map<string, number>
): ZoneResult {
  if (preScreenStatus === "FAIL") {
    return { zone: "PRESCREEN_FAIL", hiringZonePass: false };
  }

  const { strongYes, yes, maybe } = cutoffs;

  let zone: "STRONG_YES" | "YES" | "MAYBE" | "NO";
  if (eduScore >= strongYes && careerScore >= strongYes) {
    zone = "STRONG_YES";
  } else if (
    (eduScore >= yes && careerScore >= yes) ||
    (eduScore >= strongYes && careerScore >= yes) ||
    (eduScore >= yes && careerScore >= strongYes)
  ) {
    zone = "YES";
  } else if (eduScore >= maybe && careerScore >= maybe) {
    zone = "MAYBE";
  } else {
    zone = "NO";
  }

  // Spike policy
  if (spikePolicy?.enabled && percentiles) {
    const maxPercentile = Math.max(...percentiles.values(), 0);
    if (zone === "MAYBE" && maxPercentile >= (spikePolicy.thresholdPct ?? 0.99)) {
      zone = "YES"; // promote
    }
    // Never auto-promote NO to YES
  }

  const hiringZonePass = zone === "STRONG_YES" || zone === "YES";
  return { zone, hiringZonePass };
}

export function scoreCandidate(ctx: ScoringContext): ScoringResult {
  const { extraction, uniLookup, employerLookup, divisionLookup } = ctx;

  const eduWeights = ctx.weights?.edu ?? DEFAULT_EDU_WEIGHTS as Record<string, number>;
  const careerWeights = ctx.weights?.career ?? DEFAULT_CAREER_WEIGHTS as Record<string, number>;
  const cutoffs = ctx.axisCutoffs ?? DEFAULT_AXIS_CUTOFFS;
  const preScreenRules = ctx.preScreenRules ?? {
    degreeMin: "SECOND_21" as const,
    maxYOEMonths: 24,
    requiresDegree: true,
    qualifyingInternshipMinWeeks: 6,
  };

  // 1) Pre-screen
  const preScreen = runPreScreen({ extraction, rules: preScreenRules });

  // 2) Education subcategories
  const e1 = scoreE1(extraction.education, uniLookup);
  const e2 = scoreE2(extraction.education);
  const e3 = scoreE3(extraction.education, uniLookup);
  const e4 = scoreE4(extraction.education);
  const e5 = scoreE5(extraction.education);

  // 3) Career subcategories
  const c1 = scoreC1(extraction.work, employerLookup, divisionLookup, preScreenRules.qualifyingInternshipMinWeeks);
  const c2 = scoreC2(extraction.leadershipProjects, extraction.work, extraction.education);
  const c3 = scoreC3(extraction.leadershipProjects, extraction.work);
  const c4 = scoreC4(extraction.nonAcademicExcellence);

  // C5 needs other scores
  const priorScores = [
    { code: "E1", score: e1.score },
    { code: "E2", score: e2.score },
    { code: "E3", score: e3.score },
    { code: "E4", score: e4.score },
    { code: "E5", score: e5.score },
    { code: "C1", score: c1.score },
    { code: "C2", score: c2.score },
    { code: "C3", score: c3.score },
    { code: "C4", score: c4.score },
  ];
  const c5 = scoreC5(priorScores, extraction);

  // 4) Build subcategory results
  const ladders = [
    { code: "E1", axis: "EDU" as const, result: e1, weight: eduWeights.E1 ?? eduWeights["E1"] ?? 0.30 },
    { code: "E2", axis: "EDU" as const, result: e2, weight: eduWeights.E2 ?? eduWeights["E2"] ?? 0.30 },
    { code: "E3", axis: "EDU" as const, result: e3, weight: eduWeights.E3 ?? eduWeights["E3"] ?? 0.10 },
    { code: "E4", axis: "EDU" as const, result: e4, weight: eduWeights.E4 ?? eduWeights["E4"] ?? 0.20 },
    { code: "E5", axis: "EDU" as const, result: e5, weight: eduWeights.E5 ?? eduWeights["E5"] ?? 0.10 },
    { code: "C1", axis: "CAREER" as const, result: c1, weight: careerWeights.C1 ?? careerWeights["C1"] ?? 0.40 },
    { code: "C2", axis: "CAREER" as const, result: c2, weight: careerWeights.C2 ?? careerWeights["C2"] ?? 0.25 },
    { code: "C3", axis: "CAREER" as const, result: c3, weight: careerWeights.C3 ?? careerWeights["C3"] ?? 0.20 },
    { code: "C4", axis: "CAREER" as const, result: c4, weight: careerWeights.C4 ?? careerWeights["C4"] ?? 0.10 },
    { code: "C5", axis: "CAREER" as const, result: c5, weight: careerWeights.C5 ?? careerWeights["C5"] ?? 0.05 },
  ];

  const subcategoryScores: SubcategoryScoreResult[] = ladders.map((l) => ({
    code: l.code,
    axis: l.axis,
    ladderScore: l.result.score,
    normalizedU: normalizeU(l.result.score),
    weight: l.weight,
    rationale: l.result.rationale,
    evidenceRefs: l.result.evidenceRefs,
  }));

  // 5) Axis scores
  const eduScore = computeAxisScore(subcategoryScores, "EDU");
  const careerScore = computeAxisScore(subcategoryScores, "CAREER");
  const axisScores: AxisScoreResult = { eduScore, careerScore };

  // 6) Zone
  const zone = determineZone(
    eduScore,
    careerScore,
    cutoffs,
    preScreen.status,
    ctx.spikePolicy
  );

  return { preScreen, subcategoryScores, axisScores, zone };
}
