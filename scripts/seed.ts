/**
 * Seed script for FairScreen.
 * Creates default taxonomies, admin user, and default policy.
 *
 * Usage: npx tsx scripts/seed.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const UK_UNIVERSITIES = [
  { institutionName: "University of Oxford", tier: "PRIORITY_1" as const },
  { institutionName: "University of Cambridge", tier: "PRIORITY_1" as const },
  { institutionName: "London School of Economics", tier: "PRIORITY_1" as const },
  { institutionName: "Imperial College London", tier: "PRIORITY_1" as const },
  { institutionName: "University College London", tier: "PRIORITY_1" as const },
  { institutionName: "University of Warwick", tier: "TIER_1" as const },
  { institutionName: "Durham University", tier: "TIER_1" as const },
  { institutionName: "University of Edinburgh", tier: "TIER_1" as const },
  { institutionName: "University of Bath", tier: "TIER_1" as const },
  { institutionName: "University of Bristol", tier: "TIER_1" as const },
  { institutionName: "University of Manchester", tier: "TIER_1" as const },
  { institutionName: "King's College London", tier: "TIER_1" as const },
  { institutionName: "University of St Andrews", tier: "TIER_1" as const },
  { institutionName: "University of Exeter", tier: "TIER_1" as const },
  { institutionName: "University of Sheffield", tier: "TIER_2" as const },
  { institutionName: "University of York", tier: "TIER_2" as const },
  { institutionName: "University of Southampton", tier: "TIER_2" as const },
  { institutionName: "Lancaster University", tier: "TIER_2" as const },
  { institutionName: "University of Leeds", tier: "TIER_2" as const },
  { institutionName: "University of Nottingham", tier: "TIER_2" as const },
];

const UK_EMPLOYERS = [
  { employerFamily: "McKinsey", tier: "ELITE" as const },
  { employerFamily: "BCG", tier: "ELITE" as const },
  { employerFamily: "Bain", tier: "ELITE" as const },
  { employerFamily: "Goldman Sachs", tier: "ELITE" as const },
  { employerFamily: "J.P. Morgan", tier: "ELITE" as const },
  { employerFamily: "Morgan Stanley", tier: "ELITE" as const },
  { employerFamily: "Rothschild", tier: "ELITE" as const },
  { employerFamily: "PwC", tier: "SELECTIVE" as const },
  { employerFamily: "Deloitte", tier: "SELECTIVE" as const },
  { employerFamily: "EY", tier: "SELECTIVE" as const },
  { employerFamily: "KPMG", tier: "SELECTIVE" as const },
  { employerFamily: "Accenture", tier: "SELECTIVE" as const },
  { employerFamily: "Oliver Wyman", tier: "ELITE" as const },
  { employerFamily: "Lazard", tier: "ELITE" as const },
];

const UK_DIVISIONS = [
  { employerFamily: "PwC", category: "STRATEGY" as const, keywords: ["Strategy&", "strategy consulting"], selectivityMultiplier: 1.0 },
  { employerFamily: "PwC", category: "DEALS" as const, keywords: ["Deals", "M&A", "transactions"], selectivityMultiplier: 0.9 },
  { employerFamily: "PwC", category: "AUDIT" as const, keywords: ["Audit", "Assurance"], selectivityMultiplier: 0.4 },
  { employerFamily: "Deloitte", category: "STRATEGY" as const, keywords: ["Monitor", "Monitor Deloitte", "strategy"], selectivityMultiplier: 1.0 },
  { employerFamily: "Deloitte", category: "DEALS" as const, keywords: ["Deals", "Financial Advisory", "M&A"], selectivityMultiplier: 0.9 },
  { employerFamily: "Deloitte", category: "AUDIT" as const, keywords: ["Audit", "Assurance"], selectivityMultiplier: 0.4 },
  { employerFamily: "EY", category: "STRATEGY" as const, keywords: ["EY-Parthenon", "Parthenon", "Strategy"], selectivityMultiplier: 1.0 },
  { employerFamily: "EY", category: "DEALS" as const, keywords: ["Strategy and Transactions", "SaT", "M&A"], selectivityMultiplier: 0.9 },
  { employerFamily: "EY", category: "AUDIT" as const, keywords: ["Audit", "Assurance"], selectivityMultiplier: 0.4 },
  { employerFamily: "KPMG", category: "DEALS" as const, keywords: ["Deal Advisory", "M&A"], selectivityMultiplier: 0.9 },
  { employerFamily: "KPMG", category: "AUDIT" as const, keywords: ["Audit"], selectivityMultiplier: 0.4 },
  { employerFamily: "Accenture", category: "STRATEGY" as const, keywords: ["Accenture Strategy", "strategy"], selectivityMultiplier: 1.0 },
  { employerFamily: "Accenture", category: "OTHER" as const, keywords: ["delivery", "operations"], selectivityMultiplier: 0.5 },
];

async function main() {
  console.log("Seeding FairScreen database...\n");

  // Admin user
  const passwordHash = await bcrypt.hash("admin", 10);
  const user = await prisma.user.upsert({
    where: { email: "admin@fairscreen.io" },
    update: {},
    create: {
      email: "admin@fairscreen.io",
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`Admin user: ${user.email}`);

  // Universities
  for (const uni of UK_UNIVERSITIES) {
    await prisma.universityTaxonomy.upsert({
      where: {
        country_institutionName_versionTag: {
          country: "UK",
          institutionName: uni.institutionName,
          versionTag: "v1",
        },
      },
      update: { tier: uni.tier },
      create: { country: "UK", institutionName: uni.institutionName, tier: uni.tier, versionTag: "v1" },
    });
  }
  console.log(`Universities: ${UK_UNIVERSITIES.length} seeded`);

  // Employers
  for (const emp of UK_EMPLOYERS) {
    await prisma.employerFamilyTaxonomy.upsert({
      where: {
        country_employerFamily_versionTag: {
          country: "UK",
          employerFamily: emp.employerFamily,
          versionTag: "v1",
        },
      },
      update: { tier: emp.tier },
      create: { country: "UK", employerFamily: emp.employerFamily, tier: emp.tier, versionTag: "v1" },
    });
  }
  console.log(`Employers: ${UK_EMPLOYERS.length} seeded`);

  // Division rules
  for (const div of UK_DIVISIONS) {
    await prisma.divisionRoleTaxonomy.upsert({
      where: {
        country_employerFamily_category_versionTag: {
          country: "UK",
          employerFamily: div.employerFamily,
          category: div.category,
          versionTag: "v1",
        },
      },
      update: { keywords: div.keywords, selectivityMultiplier: div.selectivityMultiplier },
      create: {
        country: "UK",
        employerFamily: div.employerFamily,
        category: div.category,
        keywords: div.keywords,
        selectivityMultiplier: div.selectivityMultiplier,
        versionTag: "v1",
      },
    });
  }
  console.log(`Division rules: ${UK_DIVISIONS.length} seeded`);

  // Default policy
  const policy = await prisma.policyVersion.upsert({
    where: { id: "default-uk-ba-v1" },
    update: {},
    create: {
      id: "default-uk-ba-v1",
      name: "UK BA Default v1",
      country: "UK",
      rolePreset: "UK_BA",
      preScreenRules: {
        degreeMin: "SECOND_21",
        maxYOEMonths: 24,
        requiresDegree: true,
        qualifyingInternshipMinWeeks: 6,
      },
      axisCutoffs: { strongYes: 18, yes: 15, maybe: 10 },
      subcategoryThresholds: {},
      weights: {
        edu: { E1: 0.30, E2: 0.30, E3: 0.10, E4: 0.20, E5: 0.10 },
        career: { C1: 0.40, C2: 0.25, C3: 0.20, C4: 0.10, C5: 0.05 },
      },
      spikePolicy: { enabled: true, thresholdPct: 0.99 },
      createdByUserId: user.id,
      notes: "Default UK Business Analyst screening policy",
    },
  });
  console.log(`Default policy: ${policy.name}`);

  console.log("\nSeed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
