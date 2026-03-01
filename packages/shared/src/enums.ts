export enum FileType {
  PDF = "PDF",
  DOCX = "DOCX",
}

export enum JobStatus {
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
}

export enum PreScreenStatus {
  PASS = "PASS",
  FAIL = "FAIL",
}

export enum Zone {
  STRONG_YES = "STRONG_YES",
  YES = "YES",
  MAYBE = "MAYBE",
  NO = "NO",
  PRESCREEN_FAIL = "PRESCREEN_FAIL",
}

export enum Axis {
  EDU = "EDU",
  CAREER = "CAREER",
}

export enum Country {
  UK = "UK",
}

export enum RolePreset {
  UK_BA = "UK_BA",
}

export enum UserRole {
  ADMIN = "ADMIN",
  RECRUITER = "RECRUITER",
}

export enum DegreeClass {
  FIRST = "FIRST",
  HIGH_21 = "HIGH_21",
  SECOND_21 = "SECOND_21",
  SECOND_22 = "SECOND_22",
  OTHER = "OTHER",
  UNKNOWN = "UNKNOWN",
}

export enum DegreeType {
  BA = "BA",
  BSC = "BSC",
  BENG = "BENG",
  MENG = "MENG",
  MSCI = "MSCI",
  MMATH = "MMATH",
  MSC = "MSC",
  MPHIL = "MPHIL",
  PHD = "PHD",
  OXBRIDGE_MA = "OXBRIDGE_MA",
  MBA = "MBA",
  OTHER = "OTHER",
}

export enum UniversityTier {
  PRIORITY_1 = "PRIORITY_1",
  TIER_1 = "TIER_1",
  TIER_2 = "TIER_2",
  OTHER = "OTHER",
}

export enum EmployerTier {
  ELITE = "ELITE",
  SELECTIVE = "SELECTIVE",
  OTHER = "OTHER",
}

export enum DivisionCategory {
  STRATEGY = "STRATEGY",
  DEALS = "DEALS",
  IB = "IB",
  AUDIT = "AUDIT",
  COMPLIANCE = "COMPLIANCE",
  OPS = "OPS",
  TECH_PRODUCT = "TECH_PRODUCT",
  TECH_DATA = "TECH_DATA",
  CORPORATE_STRATEGY = "CORPORATE_STRATEGY",
  OTHER = "OTHER",
}

export enum ExcellenceDomain {
  SPORT = "SPORT",
  ARTS = "ARTS",
  COMPETITION = "COMPETITION",
  PUBLICATION = "PUBLICATION",
  VOLUNTEERING = "VOLUNTEERING",
  OTHER = "OTHER",
}

export enum ExcellenceLevel {
  LOCAL = "LOCAL",
  UNIVERSITY = "UNIVERSITY",
  REGIONAL = "REGIONAL",
  NATIONAL = "NATIONAL",
  INTERNATIONAL = "INTERNATIONAL",
}

export const EDU_SUBCATEGORY_CODES = ["E1", "E2", "E3", "E4", "E5"] as const;
export const CAREER_SUBCATEGORY_CODES = ["C1", "C2", "C3", "C4", "C5"] as const;
export const ALL_SUBCATEGORY_CODES = [...EDU_SUBCATEGORY_CODES, ...CAREER_SUBCATEGORY_CODES] as const;

export type EduSubcategoryCode = (typeof EDU_SUBCATEGORY_CODES)[number];
export type CareerSubcategoryCode = (typeof CAREER_SUBCATEGORY_CODES)[number];
export type SubcategoryCode = (typeof ALL_SUBCATEGORY_CODES)[number];
