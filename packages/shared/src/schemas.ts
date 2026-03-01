import { z } from "zod";

// ===== Evidence Schema =====
export const EvidenceItemSchema = z.object({
  id: z.string(),
  fieldPath: z.string(),
  snippet: z.string(),
  page: z.number().nullable(),
  startOffset: z.number().nullable(),
  endOffset: z.number().nullable(),
  confidence: z.number().min(0).max(1),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

// ===== Extraction Schemas =====
export const MetricSchema = z.object({
  value: z.string(),
  unit: z.string().optional(),
  context: z.string().optional(),
});

export const EducationEntrySchema = z.object({
  institution: z.string(),
  country: z.string().optional(),
  degreeType: z.enum([
    "BA", "BSC", "BENG", "MENG", "MSCI", "MMATH",
    "MSC", "MPHIL", "PHD", "OXBRIDGE_MA", "MBA", "OTHER",
  ]),
  field: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  gradeText: z.string().optional(),
  gradeNormalized: z.enum([
    "FIRST", "HIGH_21", "SECOND_21", "SECOND_22", "OTHER", "UNKNOWN",
  ]).optional(),
  marks: z.number().nullable().optional(),
  awards: z.array(z.string()).default([]),
  societies: z.array(z.string()).default([]),
  activities: z.array(z.string()).default([]),
});
export type EducationEntry = z.infer<typeof EducationEntrySchema>;

export const BulletSchema = z.object({
  text: z.string(),
  metrics: z.array(MetricSchema).default([]),
});

export const WorkEntrySchema = z.object({
  employer: z.string(),
  employerFamily: z.string().optional(),
  roleTitle: z.string(),
  divisionKeywordsFound: z.array(z.string()).default([]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  durationWeeks: z.number().nullable().optional(),
  bullets: z.array(BulletSchema).default([]),
  location: z.string().optional(),
  internshipFlag: z.boolean().optional(),
  qualifyingInternship: z.boolean().optional(),
});
export type WorkEntry = z.infer<typeof WorkEntrySchema>;

export const ScopeSchema = z.object({
  teamSize: z.number().nullable().optional(),
  fundsRaised: z.string().nullable().optional(),
  audienceSize: z.number().nullable().optional(),
  selectivity: z.string().nullable().optional(),
  responsibilityNotes: z.string().nullable().optional(),
});

export const LeadershipProjectSchema = z.object({
  title: z.string(),
  org: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  scope: ScopeSchema.default({}),
  achievements: z.array(z.string()).default([]),
  metrics: z.array(MetricSchema).default([]),
});
export type LeadershipProject = z.infer<typeof LeadershipProjectSchema>;

export const NonAcademicExcellenceSchema = z.object({
  domain: z.enum(["SPORT", "ARTS", "COMPETITION", "PUBLICATION", "VOLUNTEERING", "OTHER"]),
  level: z.enum(["LOCAL", "UNIVERSITY", "REGIONAL", "NATIONAL", "INTERNATIONAL"]),
  description: z.string(),
  metrics: z.array(MetricSchema).optional(),
});
export type NonAcademicExcellence = z.infer<typeof NonAcademicExcellenceSchema>;

export const CandidateCoreSchema = z.object({
  fullName: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
});

export const ExtractionResultSchema = z.object({
  candidate: CandidateCoreSchema,
  education: z.array(EducationEntrySchema),
  work: z.array(WorkEntrySchema),
  leadershipProjects: z.array(LeadershipProjectSchema).default([]),
  nonAcademicExcellence: z.array(NonAcademicExcellenceSchema).default([]),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ===== Policy Schemas =====
export const PercentileToggle = z.enum(["ANY", "TOP_25", "TOP_10", "TOP_5", "TOP_1"]);
export type PercentileToggle = z.infer<typeof PercentileToggle>;

export const AxisCutoffsSchema = z.object({
  strongYes: z.number().min(0).max(25).default(18),
  yes: z.number().min(0).max(25).default(15),
  maybe: z.number().min(0).max(25).default(10),
});
export type AxisCutoffs = z.infer<typeof AxisCutoffsSchema>;

export const PreScreenRulesSchema = z.object({
  degreeMin: z.enum(["FIRST", "HIGH_21", "SECOND_21", "SECOND_22", "OTHER"]).default("SECOND_21"),
  maxYOEMonths: z.number().default(24),
  requiresDegree: z.boolean().default(true),
  qualifyingInternshipMinWeeks: z.number().default(6),
});
export type PreScreenRules = z.infer<typeof PreScreenRulesSchema>;

export const SpikePolicySchema = z.object({
  enabled: z.boolean().default(true),
  thresholdPct: z.number().min(0).max(1).default(0.99),
  promoteMaybeToYes: z.boolean().default(true),
  noAutoPromoteNo: z.boolean().default(true),
});
export type SpikePolicy = z.infer<typeof SpikePolicySchema>;

export const WeightsSchema = z.object({
  edu: z.object({
    E1: z.number().default(0.30),
    E2: z.number().default(0.30),
    E3: z.number().default(0.10),
    E4: z.number().default(0.20),
    E5: z.number().default(0.10),
  }),
  career: z.object({
    C1: z.number().default(0.40),
    C2: z.number().default(0.25),
    C3: z.number().default(0.20),
    C4: z.number().default(0.10),
    C5: z.number().default(0.05),
  }),
});
export type Weights = z.infer<typeof WeightsSchema>;

export const SubcategoryThresholdsSchema = z.record(
  z.string(),
  PercentileToggle
);
export type SubcategoryThresholds = z.infer<typeof SubcategoryThresholdsSchema>;

export const PolicyConfigSchema = z.object({
  preScreenRules: PreScreenRulesSchema.default({}),
  axisCutoffs: AxisCutoffsSchema.default({}),
  subcategoryThresholds: SubcategoryThresholdsSchema.default({}),
  weights: WeightsSchema.default({
    edu: { E1: 0.30, E2: 0.30, E3: 0.10, E4: 0.20, E5: 0.10 },
    career: { C1: 0.40, C2: 0.25, C3: 0.20, C4: 0.10, C5: 0.05 },
  }),
  spikePolicy: SpikePolicySchema.default({}),
});
export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

// ===== Scoring Types =====
export interface SubcategoryScoreResult {
  code: string;
  axis: "EDU" | "CAREER";
  ladderScore: number; // 1-5
  normalizedU: number; // 0-1
  weight: number;
  rationale: string;
  evidenceRefs: string[];
}

export interface AxisScoreResult {
  eduScore: number; // 0-25
  careerScore: number; // 0-25
}

export interface ZoneResult {
  zone: "STRONG_YES" | "YES" | "MAYBE" | "NO" | "PRESCREEN_FAIL";
  hiringZonePass: boolean;
}

// ===== Default weights =====
export const DEFAULT_EDU_WEIGHTS: Record<string, number> = {
  E1: 0.30, E2: 0.30, E3: 0.10, E4: 0.20, E5: 0.10,
};

export const DEFAULT_CAREER_WEIGHTS: Record<string, number> = {
  C1: 0.40, C2: 0.25, C3: 0.20, C4: 0.10, C5: 0.05,
};

// ===== Axis cutoff defaults =====
export const DEFAULT_AXIS_CUTOFFS: AxisCutoffs = {
  strongYes: 18,
  yes: 15,
  maybe: 10,
};

// ===== Cohort Stats Schema =====
export const CohortStatsJsonSchema = z.object({
  subcategories: z.record(z.string(), z.object({
    mean: z.number(),
    std: z.number(),
    count: z.number(),
    bins: z.array(z.object({
      binStart: z.number(),
      binEnd: z.number(),
      count: z.number(),
    })),
    percentiles: z.object({
      p25: z.number(),
      p10: z.number(),
      p5: z.number(),
      p1: z.number(),
    }),
  })),
  axes: z.object({
    edu: z.object({ mean: z.number(), std: z.number() }),
    career: z.object({ mean: z.number(), std: z.number() }),
  }),
});
export type CohortStatsJson = z.infer<typeof CohortStatsJsonSchema>;
