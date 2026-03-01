/**
 * Deterministic scoring ladders for UK rubric v3.
 * Each function takes extracted data + taxonomy lookups and returns a ladder score 1-5
 * plus rationale and evidence references.
 */

import type { ExtractionResult, EducationEntry, WorkEntry, LeadershipProject, NonAcademicExcellence } from "@fairscreen/shared";
import type { UniversityLookup, EmployerLookup, DivisionLookup } from "./taxonomy-lookup";

export interface LadderResult {
  score: number; // 1-5
  rationale: string;
  evidenceRefs: string[];
}

// ===== E1: Institution Strength =====
export function scoreE1(
  education: EducationEntry[],
  uniLookup: UniversityLookup
): LadderResult {
  if (education.length === 0) {
    return { score: 1, rationale: "No education entries found", evidenceRefs: [] };
  }

  let bestTier = "OTHER" as string;
  let bestInst = "";
  const tierRank: Record<string, number> = { PRIORITY_1: 4, TIER_1: 3, TIER_2: 2, OTHER: 1 };

  for (const edu of education) {
    const tier = uniLookup.getTier(edu.institution);
    if ((tierRank[tier] ?? 0) > (tierRank[bestTier] ?? 0)) {
      bestTier = tier;
      bestInst = edu.institution;
    }
  }

  const scoreMap: Record<string, number> = { PRIORITY_1: 5, TIER_1: 4, TIER_2: 3, OTHER: 2 };
  const score = scoreMap[bestTier] ?? 1;

  return {
    score,
    rationale: `Best institution: ${bestInst} (${bestTier})`,
    evidenceRefs: [`education.institution:${bestInst}`],
  };
}

// ===== E2: Degree Performance =====
export function scoreE2(education: EducationEntry[]): LadderResult {
  if (education.length === 0) {
    return { score: 1, rationale: "No education entries", evidenceRefs: [] };
  }

  const gradeMap: Record<string, number> = {
    FIRST: 5,
    HIGH_21: 4,
    SECOND_21: 3,
    SECOND_22: 2,
    OTHER: 1,
    UNKNOWN: 1,
  };

  let bestScore = 0;
  let bestGrade = "UNKNOWN";
  let bestInst = "";

  for (const edu of education) {
    let effectiveGrade = edu.gradeNormalized ?? "UNKNOWN";

    // UK marks >= 70 => FIRST
    if (edu.marks != null && edu.marks >= 70 && (edu.country === "UK" || !edu.country)) {
      effectiveGrade = "FIRST";
    }

    const score = gradeMap[effectiveGrade] ?? 1;

    // Predicted grade cap at 4 unless strong evidence
    const isPredicted = edu.gradeText?.toLowerCase().includes("predicted");
    const cappedScore = isPredicted ? Math.min(score, 4) : score;

    if (cappedScore > bestScore) {
      bestScore = cappedScore;
      bestGrade = effectiveGrade;
      bestInst = edu.institution;
    }
  }

  return {
    score: Math.max(bestScore, 1),
    rationale: `Best degree classification: ${bestGrade} at ${bestInst}`,
    evidenceRefs: [`education.gradeNormalized:${bestGrade}`],
  };
}

// ===== E3: Master's Signal (MBA excluded) =====
export function scoreE3(
  education: EducationEntry[],
  uniLookup: UniversityLookup
): LadderResult {
  const mastersDegreeTypes = new Set(["MSC", "MPHIL", "MENG", "MSCI", "MMATH"]);
  const mastersEntries = education.filter(
    (e) => mastersDegreeTypes.has(e.degreeType) && e.degreeType !== "MBA"
  );

  // Also exclude anything with MBA in the field
  const filtered = mastersEntries.filter(
    (e) => !e.field?.toLowerCase().includes("mba") &&
           !e.institution?.toLowerCase().includes("mba")
  );

  if (filtered.length === 0) {
    return { score: 1, rationale: "No qualifying master's degree (MBA excluded)", evidenceRefs: [] };
  }

  let bestScore = 1;
  let bestRationale = "Weak/unclear master's";

  for (const m of filtered) {
    const tier = uniLookup.getTier(m.institution);
    const gradeText = (m.gradeText ?? "").toLowerCase();
    const isDistinction = gradeText.includes("distinction") || gradeText.includes("top");
    const isMerit = gradeText.includes("merit");

    if (tier === "PRIORITY_1" && isDistinction) {
      bestScore = Math.max(bestScore, 5);
      bestRationale = `Distinction at ${m.institution} (${tier})`;
    } else if ((tier === "PRIORITY_1" || tier === "TIER_1") && (isDistinction || isMerit)) {
      bestScore = Math.max(bestScore, 4);
      bestRationale = `Strong master's outcome at ${m.institution}`;
    } else if (tier === "TIER_1" || tier === "PRIORITY_1") {
      bestScore = Math.max(bestScore, 3);
      bestRationale = `Master's at ${m.institution} without standout outcome`;
    } else {
      bestScore = Math.max(bestScore, 2);
      bestRationale = `Master's at ${m.institution} (${tier})`;
    }
  }

  return {
    score: bestScore,
    rationale: bestRationale,
    evidenceRefs: filtered.map((m) => `education.institution:${m.institution}`),
  };
}

// ===== E4: Academic Excellence & Distinctions =====
export function scoreE4(education: EducationEntry[]): LadderResult {
  const allAwards: string[] = [];
  for (const edu of education) {
    allAwards.push(...edu.awards);
  }

  if (allAwards.length === 0) {
    return { score: 1, rationale: "No academic awards or distinctions", evidenceRefs: [] };
  }

  const text = allAwards.join(" ").toLowerCase();

  // Top signals
  const topSignals = ["highest mark", "top 1%", "national prize", "major scholarship",
    "rhodes", "marshall", "gates", "chevening", "fulbright", "presidential scholar"];
  const strongSignals = ["top 5%", "dean's list", "deans list", "scholarship",
    "academic prize", "multiple awards", "first class"];
  const mediumSignals = ["dissertation", "recognition", "award", "commendation",
    "honours", "prize"];

  const hasTop = topSignals.some((s) => text.includes(s));
  const hasStrong = strongSignals.some((s) => text.includes(s));
  const hasMedium = mediumSignals.some((s) => text.includes(s));

  let score = 1;
  let rationale = "Generic claim only";

  if (hasTop) {
    score = 5;
    rationale = `Top 1% academic distinction: ${allAwards.slice(0, 2).join(", ")}`;
  } else if (hasStrong || allAwards.length >= 3) {
    score = 4;
    rationale = `Strong academic awards: ${allAwards.slice(0, 2).join(", ")}`;
  } else if (hasMedium) {
    score = 3;
    rationale = `Meaningful academic recognition: ${allAwards[0]}`;
  } else if (allAwards.length > 0) {
    score = 2;
    rationale = `Generic academic claim: ${allAwards[0]}`;
  }

  return {
    score,
    rationale,
    evidenceRefs: allAwards.map((a) => `education.awards:${a}`),
  };
}

// ===== E5: University Engagement =====
export function scoreE5(education: EducationEntry[]): LadderResult {
  const allSocieties: string[] = [];
  const allActivities: string[] = [];
  for (const edu of education) {
    allSocieties.push(...edu.societies);
    allActivities.push(...edu.activities);
  }

  const all = [...allSocieties, ...allActivities];
  if (all.length === 0) {
    return { score: 1, rationale: "No university engagement found", evidenceRefs: [] };
  }

  const text = all.join(" ").toLowerCase();

  const topSignals = ["winner", "finalist", "international", "national",
    "case competition", "first place", "champion"];
  const strongSignals = ["president", "chairman", "chair", "head of",
    "division head", "founder", "captain", "editor-in-chief"];
  const mediumSignals = ["committee", "organiser", "organizer", "lead",
    "director", "treasurer", "secretary", "vice"];
  const weakSignals = ["member", "participant", "attended"];

  const hasTop = topSignals.some((s) => text.includes(s));
  const hasStrong = strongSignals.some((s) => text.includes(s));
  const hasMedium = mediumSignals.some((s) => text.includes(s));

  let score = 2; // passive membership default if has some
  let rationale = "Passive membership";

  if (hasTop) {
    score = 5;
    rationale = `Selective leadership + external validation: ${all.slice(0, 2).join(", ")}`;
  } else if (hasStrong) {
    score = 4;
    rationale = `Strong society leadership: ${all.slice(0, 2).join(", ")}`;
  } else if (hasMedium) {
    score = 3;
    rationale = `Meaningful involvement with responsibilities: ${all.slice(0, 2).join(", ")}`;
  } else {
    score = 2;
    rationale = `Passive membership: ${all.slice(0, 2).join(", ")}`;
  }

  return {
    score,
    rationale,
    evidenceRefs: all.map((s) => `education.societies/activities:${s}`),
  };
}

// ===== C1: Career Experience Quality =====
export function scoreC1(
  work: WorkEntry[],
  employerLookup: EmployerLookup,
  divisionLookup: DivisionLookup,
  qualifyingInternshipMinWeeks: number = 6
): LadderResult {
  if (work.length === 0) {
    return { score: 1, rationale: "No work experience found", evidenceRefs: [] };
  }

  let bestRawScore = 0;
  let bestRationale = "No qualifying experience";
  const evidenceRefs: string[] = [];

  for (const w of work) {
    const family = w.employerFamily ?? employerLookup.getFamily(w.employer);
    const tier = family ? employerLookup.getTier(family) : "OTHER";
    const keywords = [...w.divisionKeywordsFound, w.roleTitle];
    const multiplier = family
      ? divisionLookup.getMultiplier(family, keywords)
      : 0.5;

    // Duration check
    const weeks = w.durationWeeks ?? 0;
    const isQualifying = weeks >= qualifyingInternshipMinWeeks;

    // Base score from tier
    let tierBase = 0;
    if (tier === "ELITE") tierBase = 3;
    else if (tier === "SELECTIVE") tierBase = 2;
    else tierBase = 1;

    // Apply division multiplier (0-1)
    const raw = tierBase * multiplier;

    // Qualifying bonus
    const qualBonus = isQualifying ? 0.5 : 0;

    const total = raw + qualBonus;

    if (total > bestRawScore) {
      bestRawScore = total;
      bestRationale = `${w.employer} (${tier}, ${family ?? "unknown family"}, mult=${multiplier.toFixed(2)}, weeks=${weeks})`;
      evidenceRefs.push(`work.employer:${w.employer}`);
    }
  }

  // Map raw to ladder 1-5
  let score = 1;
  if (bestRawScore >= 3.0) score = 5;
  else if (bestRawScore >= 2.3) score = 4;
  else if (bestRawScore >= 1.5) score = 3;
  else if (bestRawScore >= 0.8) score = 2;
  else score = 1;

  return { score, rationale: bestRationale, evidenceRefs };
}

// ===== C2: Leadership Potential =====
export function scoreC2(
  leadershipProjects: LeadershipProject[],
  work: WorkEntry[],
  education: EducationEntry[]
): LadderResult {
  const allLeadership: string[] = [];

  // Gather leadership signals from all sources
  for (const lp of leadershipProjects) {
    allLeadership.push(lp.title);
    allLeadership.push(...lp.achievements);
  }
  for (const w of work) {
    if (w.roleTitle.toLowerCase().includes("lead") ||
        w.roleTitle.toLowerCase().includes("manager") ||
        w.roleTitle.toLowerCase().includes("head")) {
      allLeadership.push(w.roleTitle);
    }
    for (const b of w.bullets) {
      allLeadership.push(b.text);
    }
  }
  for (const edu of education) {
    allLeadership.push(...edu.societies.filter((s) =>
      s.toLowerCase().includes("president") ||
      s.toLowerCase().includes("captain") ||
      s.toLowerCase().includes("head")
    ));
  }

  if (allLeadership.length === 0) {
    return { score: 1, rationale: "No leadership signals", evidenceRefs: [] };
  }

  // Score based on scale and nature
  let maxTeamSize = 0;
  let hasElectedRole = false;
  let hasFundsOrRevenue = false;

  for (const lp of leadershipProjects) {
    if (lp.scope.teamSize && lp.scope.teamSize > maxTeamSize) {
      maxTeamSize = lp.scope.teamSize;
    }
    if (lp.scope.fundsRaised) hasFundsOrRevenue = true;
    const lower = lp.title.toLowerCase();
    if (lower.includes("president") || lower.includes("elected") || lower.includes("captain")) {
      hasElectedRole = true;
    }
  }

  const text = allLeadership.join(" ").toLowerCase();
  const hasLargeScale = maxTeamSize >= 20 || text.includes("100+") || text.includes("national");
  const hasMediumScale = maxTeamSize >= 5 || hasElectedRole;

  let score = 1;
  let rationale = "Minimal leadership evidence";

  if (hasLargeScale && hasFundsOrRevenue) {
    score = 5;
    rationale = `Large-scale leadership with financial responsibility (team ${maxTeamSize}+)`;
  } else if (hasLargeScale || (hasMediumScale && hasFundsOrRevenue)) {
    score = 4;
    rationale = `Significant leadership role (team ${maxTeamSize}, elected: ${hasElectedRole})`;
  } else if (hasMediumScale) {
    score = 3;
    rationale = `Moderate leadership with clear responsibilities`;
  } else if (allLeadership.length > 2) {
    score = 2;
    rationale = `Some leadership mentions but limited scale`;
  }

  return {
    score,
    rationale,
    evidenceRefs: leadershipProjects.map((lp) => `leadershipProjects.title:${lp.title}`),
  };
}

// ===== C3: Entrepreneurial Mindset =====
export function scoreC3(
  leadershipProjects: LeadershipProject[],
  work: WorkEntry[]
): LadderResult {
  const signals: string[] = [];

  for (const lp of leadershipProjects) {
    const text = [lp.title, ...lp.achievements].join(" ").toLowerCase();
    if (text.includes("founder") || text.includes("co-founder") ||
        text.includes("startup") || text.includes("launched") ||
        text.includes("built") || text.includes("created")) {
      signals.push(lp.title);
    }
  }

  for (const w of work) {
    const text = [w.roleTitle, ...w.bullets.map((b) => b.text)].join(" ").toLowerCase();
    if (text.includes("founder") || text.includes("entrepreneur") ||
        text.includes("startup") || text.includes("launched product")) {
      signals.push(w.roleTitle);
    }
  }

  if (signals.length === 0) {
    return { score: 1, rationale: "No entrepreneurial signals", evidenceRefs: [] };
  }

  // Check for traction
  const allText = signals.join(" ").toLowerCase();
  const hasTraction = allText.includes("revenue") || allText.includes("users") ||
    allText.includes("funding") || allText.includes("investment") ||
    allText.includes("partnership") || allText.includes("client");
  const hasMultiple = signals.length >= 2;

  let score = 2;
  let rationale = "Entrepreneurial interest but limited traction";

  if (hasTraction && hasMultiple) {
    score = 5;
    rationale = `Strong entrepreneurial track: multiple ventures with traction`;
  } else if (hasTraction) {
    score = 4;
    rationale = `Entrepreneurial venture with measurable traction`;
  } else if (hasMultiple) {
    score = 3;
    rationale = `Multiple entrepreneurial initiatives`;
  }

  return {
    score,
    rationale,
    evidenceRefs: signals.map((s) => `leadershipProjects/work:${s}`),
  };
}

// ===== C4: Excellence & Accomplishment (non-academic) =====
export function scoreC4(
  nonAcademicExcellence: NonAcademicExcellence[]
): LadderResult {
  if (nonAcademicExcellence.length === 0) {
    return { score: 1, rationale: "No non-academic excellence", evidenceRefs: [] };
  }

  const levelMap: Record<string, number> = {
    INTERNATIONAL: 5,
    NATIONAL: 5,
    REGIONAL: 4,
    UNIVERSITY: 3,
    LOCAL: 2,
  };

  let bestScore = 1;
  let bestDesc = "";

  for (const nae of nonAcademicExcellence) {
    const levelScore = levelMap[nae.level] ?? 1;
    if (levelScore > bestScore) {
      bestScore = levelScore;
      bestDesc = `${nae.domain} at ${nae.level}: ${nae.description}`;
    }
  }

  // Boost if multiple strong entries
  if (nonAcademicExcellence.length >= 3 && bestScore < 5) {
    bestScore = Math.min(bestScore + 1, 5);
  }

  return {
    score: bestScore,
    rationale: bestDesc || "Hobby-level engagement",
    evidenceRefs: nonAcademicExcellence.map((n) => `nonAcademicExcellence:${n.description}`),
  };
}

// ===== C5: Distinction Signal (flex) =====
export function scoreC5(
  allScores: { code: string; score: number }[],
  extraction: ExtractionResult
): LadderResult {
  // C5 is awarded conservatively for additional spikes not captured elsewhere
  // Max 3 unless evidence truly exceptional
  const highScores = allScores.filter((s) => s.score >= 4);
  const maxExisting = Math.max(...allScores.map((s) => s.score), 0);

  // Count unique high-scoring areas
  const uniqueHighAreas = new Set(highScores.map((s) => s.code.startsWith("E") ? "edu" : "career"));

  let score = 1;
  let rationale = "No additional distinction spike";

  if (highScores.length >= 6 && uniqueHighAreas.size >= 2) {
    score = 4;
    rationale = `Exceptional breadth: ${highScores.length} subcategories at 4+`;
  } else if (highScores.length >= 4) {
    score = 3;
    rationale = `Strong breadth: ${highScores.length} subcategories at 4+`;
  } else if (highScores.length >= 2) {
    score = 2;
    rationale = `Some distinction signals across ${highScores.length} areas`;
  }

  // Cap at 3 by default
  score = Math.min(score, 3);

  return { score, rationale, evidenceRefs: [] };
}
