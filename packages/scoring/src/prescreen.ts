import type { ExtractionResult, PreScreenRules } from "@fairscreen/shared";

export interface PreScreenInput {
  extraction: ExtractionResult;
  rules: PreScreenRules;
}

export interface PreScreenOutput {
  status: "PASS" | "FAIL";
  reasons: string[];
  yoeMonths: number | null;
  degreeClass: string | null;
}

const DEGREE_CLASS_ORDER: Record<string, number> = {
  FIRST: 5,
  HIGH_21: 4,
  SECOND_21: 3,
  SECOND_22: 2,
  OTHER: 1,
  UNKNOWN: 0,
};

export function runPreScreen(input: PreScreenInput): PreScreenOutput {
  const { extraction, rules } = input;
  const reasons: string[] = [];

  // 1) Check degree requirement
  let bestDegreeClass: string | null = null;
  let bestDegreeRank = 0;

  for (const edu of extraction.education) {
    const grade = edu.gradeNormalized ?? "UNKNOWN";
    // If marks >= 70 in UK context, treat as FIRST
    let effectiveGrade = grade;
    if (edu.marks && edu.marks >= 70 && (edu.country === "UK" || !edu.country)) {
      effectiveGrade = "FIRST";
    }
    const rank = DEGREE_CLASS_ORDER[effectiveGrade] ?? 0;
    if (rank > bestDegreeRank) {
      bestDegreeRank = rank;
      bestDegreeClass = effectiveGrade;
    }
  }

  if (rules.requiresDegree && extraction.education.length === 0) {
    reasons.push("No degree found");
  }

  const minDegreeRank = DEGREE_CLASS_ORDER[rules.degreeMin] ?? 3;
  if (bestDegreeRank > 0 && bestDegreeRank < minDegreeRank) {
    reasons.push(`Degree classification ${bestDegreeClass} below minimum ${rules.degreeMin}`);
  }

  // 2) Check YOE (years of experience)
  let totalWorkMonths = 0;
  for (const w of extraction.work) {
    if (w.durationWeeks != null) {
      totalWorkMonths += w.durationWeeks / 4.33;
    } else if (w.startDate && w.endDate) {
      const start = new Date(w.startDate);
      const end = new Date(w.endDate);
      const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      if (months > 0) totalWorkMonths += months;
    }
  }
  const yoeMonths = Math.round(totalWorkMonths);

  if (yoeMonths > rules.maxYOEMonths) {
    reasons.push(`Total experience ${yoeMonths} months exceeds max ${rules.maxYOEMonths} months`);
  }

  return {
    status: reasons.length === 0 ? "PASS" : "FAIL",
    reasons,
    yoeMonths,
    degreeClass: bestDegreeClass,
  };
}
