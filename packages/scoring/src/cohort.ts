/**
 * Cohort normalization: z-scores and empirical percentiles.
 */

import type { SubcategoryScoreResult } from "@fairscreen/shared";

export interface CandidateScoreData {
  candidateId: string;
  subcategoryScores: SubcategoryScoreResult[];
  eduScore: number;
  careerScore: number;
}

export interface NormalizedScore {
  candidateId: string;
  code: string;
  zScore: number;
  percentile: number; // 0-1
}

export interface CohortDistribution {
  code: string;
  mean: number;
  std: number;
  count: number;
  bins: Array<{ binStart: number; binEnd: number; count: number }>;
  percentiles: { p25: number; p10: number; p5: number; p1: number };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values: number[], m: number): number {
  if (values.length <= 1) return 0;
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function empiricalPercentile(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  let count = 0;
  for (const v of sortedValues) {
    if (v <= value) count++;
    else break;
  }
  return count / sortedValues.length;
}

function computeBins(values: number[], numBins: number = 20): Array<{ binStart: number; binEnd: number; count: number }> {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const binWidth = range / numBins;

  const bins: Array<{ binStart: number; binEnd: number; count: number }> = [];
  for (let i = 0; i < numBins; i++) {
    bins.push({
      binStart: min + i * binWidth,
      binEnd: min + (i + 1) * binWidth,
      count: 0,
    });
  }

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), numBins - 1);
    bins[idx].count++;
  }

  return bins;
}

function quantile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) return 0;
  const pos = q * (sortedValues.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (pos - lower) * (sortedValues[upper] - sortedValues[lower]);
}

export function computeCohortStats(
  candidates: CandidateScoreData[]
): {
  normalized: NormalizedScore[];
  distributions: CohortDistribution[];
  axisStats: { edu: { mean: number; std: number }; career: { mean: number; std: number } };
} {
  if (candidates.length === 0) {
    return { normalized: [], distributions: [], axisStats: { edu: { mean: 0, std: 0 }, career: { mean: 0, std: 0 } } };
  }

  // Gather all codes
  const allCodes = new Set<string>();
  for (const c of candidates) {
    for (const s of c.subcategoryScores) {
      allCodes.add(s.code);
    }
  }

  const distributions: CohortDistribution[] = [];
  const normalized: NormalizedScore[] = [];

  for (const code of allCodes) {
    // Collect all normalizedU values for this code
    const values: Array<{ candidateId: string; value: number }> = [];
    for (const c of candidates) {
      const score = c.subcategoryScores.find((s) => s.code === code);
      if (score) {
        values.push({ candidateId: c.candidateId, value: score.normalizedU });
      }
    }

    const nums = values.map((v) => v.value);
    const m = mean(nums);
    const s = std(nums, m);
    const sorted = [...nums].sort((a, b) => a - b);

    // Distribution
    distributions.push({
      code,
      mean: m,
      std: s,
      count: nums.length,
      bins: computeBins(nums, 10),
      percentiles: {
        p25: quantile(sorted, 0.75),
        p10: quantile(sorted, 0.90),
        p5: quantile(sorted, 0.95),
        p1: quantile(sorted, 0.99),
      },
    });

    // Z-scores and percentiles per candidate
    for (const v of values) {
      const zScore = s > 0 ? (v.value - m) / s : 0;
      const percentile = empiricalPercentile(v.value, sorted);
      normalized.push({
        candidateId: v.candidateId,
        code,
        zScore,
        percentile,
      });
    }
  }

  // Axis stats
  const eduScores = candidates.map((c) => c.eduScore);
  const careerScores = candidates.map((c) => c.careerScore);
  const eduMean = mean(eduScores);
  const careerMean = mean(careerScores);

  return {
    normalized,
    distributions,
    axisStats: {
      edu: { mean: eduMean, std: std(eduScores, eduMean) },
      career: { mean: careerMean, std: std(careerScores, careerMean) },
    },
  };
}

/**
 * Check if a candidate meets subcategory percentile thresholds.
 */
export function meetsPercentileThresholds(
  candidatePercentiles: Map<string, number>,
  thresholds: Record<string, string> // code -> "ANY" | "TOP_25" | "TOP_10" | "TOP_5" | "TOP_1"
): boolean {
  const pctMap: Record<string, number> = {
    ANY: 0,
    TOP_25: 0.75,
    TOP_10: 0.90,
    TOP_5: 0.95,
    TOP_1: 0.99,
  };

  for (const [code, toggle] of Object.entries(thresholds)) {
    if (toggle === "ANY") continue;
    const required = pctMap[toggle] ?? 0;
    const actual = candidatePercentiles.get(code) ?? 0;
    if (actual < required) return false;
  }
  return true;
}
