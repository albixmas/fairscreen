import { describe, it, expect } from "vitest";
import {
  scoreE1, scoreE2, scoreE3, scoreE4, scoreE5,
  scoreC1, scoreC2, scoreC3, scoreC4, scoreC5,
  scoreCandidate,
  computeCohortStats,
  meetsPercentileThresholds,
  InMemoryUniversityLookup,
  InMemoryEmployerLookup,
  InMemoryDivisionLookup,
  DEFAULT_UK_UNIVERSITIES,
  DEFAULT_UK_EMPLOYERS,
  DEFAULT_UK_DIVISION_RULES,
  runPreScreen,
} from "../src";
import type { ExtractionResult } from "@fairscreen/shared";

const uniLookup = new InMemoryUniversityLookup(DEFAULT_UK_UNIVERSITIES);
const empLookup = new InMemoryEmployerLookup(DEFAULT_UK_EMPLOYERS);
const divLookup = new InMemoryDivisionLookup(DEFAULT_UK_DIVISION_RULES);

// ===== E1 Tests =====
describe("E1 Institution Strength", () => {
  it("scores 5 for Oxford", () => {
    const result = scoreE1(
      [{ institution: "University of Oxford", degreeType: "BA", field: "PPE", awards: [], societies: [], activities: [] }],
      uniLookup
    );
    expect(result.score).toBe(5);
  });

  it("scores 4 for Warwick", () => {
    const result = scoreE1(
      [{ institution: "University of Warwick", degreeType: "BSC", field: "Maths", awards: [], societies: [], activities: [] }],
      uniLookup
    );
    expect(result.score).toBe(4);
  });

  it("scores 3 for Sheffield", () => {
    const result = scoreE1(
      [{ institution: "University of Sheffield", degreeType: "BA", field: "History", awards: [], societies: [], activities: [] }],
      uniLookup
    );
    expect(result.score).toBe(3);
  });

  it("scores 2 for unknown university", () => {
    const result = scoreE1(
      [{ institution: "Random University", degreeType: "BA", field: "Business", awards: [], societies: [], activities: [] }],
      uniLookup
    );
    expect(result.score).toBe(2);
  });

  it("scores 1 for no education", () => {
    const result = scoreE1([], uniLookup);
    expect(result.score).toBe(1);
  });

  it("takes best tier when multiple institutions", () => {
    const result = scoreE1(
      [
        { institution: "Random University", degreeType: "BA", field: "Business", awards: [], societies: [], activities: [] },
        { institution: "University of Cambridge", degreeType: "MSC", field: "CS", awards: [], societies: [], activities: [] },
      ],
      uniLookup
    );
    expect(result.score).toBe(5);
  });
});

// ===== E2 Tests =====
describe("E2 Degree Performance", () => {
  it("scores 5 for First", () => {
    const result = scoreE2([{
      institution: "Oxford", degreeType: "BA", field: "PPE",
      gradeNormalized: "FIRST", awards: [], societies: [], activities: [],
    }]);
    expect(result.score).toBe(5);
  });

  it("scores 4 for HIGH_21", () => {
    const result = scoreE2([{
      institution: "Oxford", degreeType: "BA", field: "PPE",
      gradeNormalized: "HIGH_21", awards: [], societies: [], activities: [],
    }]);
    expect(result.score).toBe(4);
  });

  it("treats marks >= 70 as FIRST", () => {
    const result = scoreE2([{
      institution: "Oxford", degreeType: "BA", field: "PPE",
      gradeNormalized: "UNKNOWN", marks: 72, awards: [], societies: [], activities: [],
    }]);
    expect(result.score).toBe(5);
  });

  it("caps predicted grades at 4", () => {
    const result = scoreE2([{
      institution: "Oxford", degreeType: "BA", field: "PPE",
      gradeNormalized: "FIRST", gradeText: "Predicted First", awards: [], societies: [], activities: [],
    }]);
    expect(result.score).toBe(4);
  });
});

// ===== E3 Tests =====
describe("E3 Master's Signal", () => {
  it("ignores MBA", () => {
    const result = scoreE3(
      [{
        institution: "Oxford", degreeType: "MBA" as any, field: "MBA",
        awards: [], societies: [], activities: [],
      }],
      uniLookup
    );
    expect(result.score).toBe(1);
  });

  it("scores 5 for MSc Distinction at Priority 1", () => {
    const result = scoreE3(
      [{
        institution: "LSE", degreeType: "MSC", field: "Finance",
        gradeText: "Distinction", awards: [], societies: [], activities: [],
      }],
      uniLookup
    );
    expect(result.score).toBe(5);
  });

  it("scores 1 for no master's", () => {
    const result = scoreE3(
      [{
        institution: "Oxford", degreeType: "BA", field: "PPE",
        awards: [], societies: [], activities: [],
      }],
      uniLookup
    );
    expect(result.score).toBe(1);
  });
});

// ===== E4 Tests =====
describe("E4 Academic Excellence", () => {
  it("scores 5 for major scholarship", () => {
    const result = scoreE4([{
      institution: "Oxford", degreeType: "BA", field: "PPE",
      awards: ["Rhodes Scholar", "Highest mark in cohort"], societies: [], activities: [],
    }]);
    expect(result.score).toBe(5);
  });

  it("scores 1 for no awards", () => {
    const result = scoreE4([{
      institution: "Oxford", degreeType: "BA", field: "PPE",
      awards: [], societies: [], activities: [],
    }]);
    expect(result.score).toBe(1);
  });
});

// ===== E5 Tests =====
describe("E5 University Engagement", () => {
  it("scores 5 for competition winner", () => {
    const result = scoreE5([{
      institution: "Oxford", degreeType: "BA", field: "PPE",
      awards: [],
      societies: ["Case Competition Winner - International Finals"],
      activities: [],
    }]);
    expect(result.score).toBe(5);
  });

  it("scores 4 for society president", () => {
    const result = scoreE5([{
      institution: "Oxford", degreeType: "BA", field: "PPE",
      awards: [],
      societies: ["President of Economics Society"],
      activities: [],
    }]);
    expect(result.score).toBe(4);
  });
});

// ===== C1 Tests =====
describe("C1 Career Experience Quality", () => {
  it("scores high for Strategy& at PwC with qualifying internship", () => {
    const result = scoreC1(
      [{
        employer: "PwC",
        employerFamily: "PwC",
        roleTitle: "Strategy Consultant",
        divisionKeywordsFound: ["strategy"],
        durationWeeks: 10,
        bullets: [],
      }],
      empLookup, divLookup, 6
    );
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it("scores lower for Audit at PwC", () => {
    const audit = scoreC1(
      [{
        employer: "PwC",
        employerFamily: "PwC",
        roleTitle: "Audit Associate",
        divisionKeywordsFound: ["audit"],
        durationWeeks: 10,
        bullets: [],
      }],
      empLookup, divLookup, 6
    );
    const strategy = scoreC1(
      [{
        employer: "PwC",
        employerFamily: "PwC",
        roleTitle: "Strategy Consultant",
        divisionKeywordsFound: ["strategy"],
        durationWeeks: 10,
        bullets: [],
      }],
      empLookup, divLookup, 6
    );
    expect(strategy.score).toBeGreaterThanOrEqual(audit.score);
  });

  it("scores 5 for McKinsey", () => {
    const result = scoreC1(
      [{
        employer: "McKinsey & Company",
        roleTitle: "Business Analyst",
        divisionKeywordsFound: ["consulting", "strategy"],
        durationWeeks: 10,
        bullets: [],
      }],
      empLookup, divLookup, 6
    );
    expect(result.score).toBeGreaterThanOrEqual(4);
  });

  it("scores 1 for no work", () => {
    const result = scoreC1([], empLookup, divLookup, 6);
    expect(result.score).toBe(1);
  });
});

// ===== C4 Tests =====
describe("C4 Non-Academic Excellence", () => {
  it("scores 5 for international level", () => {
    const result = scoreC4([{
      domain: "SPORT", level: "INTERNATIONAL",
      description: "Represented UK at international athletics",
    }]);
    expect(result.score).toBe(5);
  });

  it("scores 1 for nothing", () => {
    const result = scoreC4([]);
    expect(result.score).toBe(1);
  });
});

// ===== Pre-Screen Tests =====
describe("Pre-Screen", () => {
  it("passes a valid candidate", () => {
    const result = runPreScreen({
      extraction: {
        candidate: { fullName: "Test" },
        education: [{
          institution: "Oxford", degreeType: "BA", field: "PPE",
          gradeNormalized: "FIRST", awards: [], societies: [], activities: [],
        }],
        work: [{ employer: "PwC", roleTitle: "Intern", durationWeeks: 8, bullets: [], divisionKeywordsFound: [] }],
        leadershipProjects: [],
        nonAcademicExcellence: [],
      },
      rules: { degreeMin: "SECOND_21", maxYOEMonths: 24, requiresDegree: true, qualifyingInternshipMinWeeks: 6 },
    });
    expect(result.status).toBe("PASS");
  });

  it("fails candidate with degree below threshold", () => {
    const result = runPreScreen({
      extraction: {
        candidate: { fullName: "Test" },
        education: [{
          institution: "Oxford", degreeType: "BA", field: "PPE",
          gradeNormalized: "SECOND_22", awards: [], societies: [], activities: [],
        }],
        work: [],
        leadershipProjects: [],
        nonAcademicExcellence: [],
      },
      rules: { degreeMin: "SECOND_21", maxYOEMonths: 24, requiresDegree: true, qualifyingInternshipMinWeeks: 6 },
    });
    expect(result.status).toBe("FAIL");
    expect(result.reasons).toContain("Degree classification SECOND_22 below minimum SECOND_21");
  });
});

// ===== Full Scoring Test =====
describe("Full Scoring Pipeline", () => {
  it("produces valid scores for a strong candidate", () => {
    const extraction: ExtractionResult = {
      candidate: { fullName: "Alice Smith", email: "alice@ox.ac.uk" },
      education: [{
        institution: "University of Oxford",
        degreeType: "BA",
        field: "PPE",
        gradeNormalized: "FIRST",
        awards: ["Dean's List", "Academic Prize"],
        societies: ["President of Economics Society"],
        activities: ["Oxford Case Competition Finalist"],
      }],
      work: [{
        employer: "Goldman Sachs",
        roleTitle: "Summer Analyst",
        divisionKeywordsFound: ["investment banking"],
        durationWeeks: 10,
        bullets: [{ text: "Worked on M&A deal worth $2bn", metrics: [] }],
      }],
      leadershipProjects: [{
        title: "Founded university charity raising £50k",
        achievements: ["Raised £50k for local charities"],
        metrics: [{ value: "50000", unit: "GBP" }],
        scope: { teamSize: 15, fundsRaised: "£50k" },
      }],
      nonAcademicExcellence: [{
        domain: "COMPETITION",
        level: "NATIONAL",
        description: "National debating championship finalist",
      }],
    };

    const result = scoreCandidate({
      extraction,
      uniLookup: uniLookup,
      employerLookup: empLookup,
      divisionLookup: divLookup,
    });

    expect(result.preScreen.status).toBe("PASS");
    expect(result.subcategoryScores).toHaveLength(10);
    expect(result.axisScores.eduScore).toBeGreaterThanOrEqual(15);
    expect(result.axisScores.careerScore).toBeGreaterThanOrEqual(10);
    expect(result.zone.zone).not.toBe("NO");

    // Verify each subcategory has valid scores
    for (const s of result.subcategoryScores) {
      expect(s.ladderScore).toBeGreaterThanOrEqual(1);
      expect(s.ladderScore).toBeLessThanOrEqual(5);
      expect(s.normalizedU).toBeGreaterThanOrEqual(0);
      expect(s.normalizedU).toBeLessThanOrEqual(1);
    }
  });
});

// ===== Cohort Stats Tests =====
describe("Cohort Stats", () => {
  it("computes z-scores and percentiles", () => {
    const candidates = Array.from({ length: 50 }, (_, i) => ({
      candidateId: `c${i}`,
      subcategoryScores: [
        { code: "E1", axis: "EDU" as const, ladderScore: Math.ceil(Math.random() * 5), normalizedU: Math.random(), weight: 0.3, rationale: "", evidenceRefs: [] },
        { code: "E2", axis: "EDU" as const, ladderScore: Math.ceil(Math.random() * 5), normalizedU: Math.random(), weight: 0.3, rationale: "", evidenceRefs: [] },
      ],
      eduScore: Math.random() * 25,
      careerScore: Math.random() * 25,
    }));

    const result = computeCohortStats(candidates);
    expect(result.normalized.length).toBeGreaterThan(0);
    expect(result.distributions.length).toBe(2); // E1, E2

    for (const d of result.distributions) {
      expect(d.mean).toBeGreaterThanOrEqual(0);
      expect(d.count).toBe(50);
    }
  });
});

// ===== Percentile Thresholds Test =====
describe("Percentile Thresholds", () => {
  it("passes when all thresholds met", () => {
    const percentiles = new Map([["E1", 0.95], ["C1", 0.99]]);
    expect(meetsPercentileThresholds(percentiles, { E1: "TOP_10", C1: "TOP_1" })).toBe(true);
  });

  it("fails when threshold not met", () => {
    const percentiles = new Map([["E1", 0.80], ["C1", 0.99]]);
    expect(meetsPercentileThresholds(percentiles, { E1: "TOP_10", C1: "TOP_1" })).toBe(false);
  });

  it("passes ANY thresholds always", () => {
    const percentiles = new Map([["E1", 0.10]]);
    expect(meetsPercentileThresholds(percentiles, { E1: "ANY" })).toBe(true);
  });
});

// ===== Division Mapping Tests =====
describe("Division Mapping", () => {
  it("Strategy& at PwC gets high multiplier", () => {
    const mult = divLookup.getMultiplier("PwC", ["strategy"]);
    expect(mult).toBeGreaterThanOrEqual(0.9);
  });

  it("Audit at PwC gets low multiplier", () => {
    const mult = divLookup.getMultiplier("PwC", ["audit"]);
    expect(mult).toBeLessThanOrEqual(0.5);
  });

  it("EY-Parthenon gets high multiplier", () => {
    const mult = divLookup.getMultiplier("EY", ["parthenon", "strategy"]);
    expect(mult).toBeGreaterThanOrEqual(0.9);
  });

  it("Monitor Deloitte gets strategy classification", () => {
    const cat = divLookup.getCategory("Deloitte", ["monitor", "strategy"]);
    expect(cat).toBe("STRATEGY");
  });
});
