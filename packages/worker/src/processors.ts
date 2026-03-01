/**
 * BullMQ job processors for the CV screening pipeline.
 */

import { prisma } from "@fairscreen/db";
import {
  scoreCandidate,
  computeCohortStats,
  InMemoryUniversityLookup,
  InMemoryEmployerLookup,
  InMemoryDivisionLookup,
  DEFAULT_UK_UNIVERSITIES,
  DEFAULT_UK_EMPLOYERS,
  DEFAULT_UK_DIVISION_RULES,
  determineZone,
  meetsPercentileThresholds,
} from "@fairscreen/scoring";
import { MockExtractionProvider } from "@fairscreen/extraction";
import type { ExtractionResult } from "@fairscreen/shared";
import { DEFAULT_AXIS_CUTOFFS } from "@fairscreen/shared";
import { llmExtractQueue, prescreenQueue, scoreLaddersQueue } from "./queues";

const uniLookup = new InMemoryUniversityLookup(DEFAULT_UK_UNIVERSITIES);
const empLookup = new InMemoryEmployerLookup(DEFAULT_UK_EMPLOYERS);
const divLookup = new InMemoryDivisionLookup(DEFAULT_UK_DIVISION_RULES);

// Use mock provider for dev; swap for OpenAI in production
const extractionProvider = new MockExtractionProvider();

export async function processParseCv(jobData: { cvFileId: string }) {
  const { cvFileId } = jobData;

  await prisma.cVFile.update({
    where: { id: cvFileId },
    data: { parseStatus: "RUNNING" },
  });

  try {
    const file = await prisma.cVFile.findUniqueOrThrow({ where: { id: cvFileId } });

    // For demo/mock: just use filename as text content
    let textContent = file.textContent || `CV content for ${file.filename}`;

    // In production, would use pdf-parse or mammoth here
    // based on file.fileType

    await prisma.cVFile.update({
      where: { id: cvFileId },
      data: {
        textContent,
        parseStatus: "SUCCEEDED",
      },
    });

    // Create candidate if not exists
    let candidate = await prisma.candidate.findUnique({
      where: { cvFileId },
    });
    if (!candidate) {
      candidate = await prisma.candidate.create({
        data: {
          fullName: file.filename.replace(/\.(pdf|docx)$/i, ""),
          cvFileId,
        },
      });
    }

    // Enqueue extraction
    await llmExtractQueue.add("extract", { candidateId: candidate.id, cvFileId });

    return { success: true, candidateId: candidate.id };
  } catch (error: any) {
    await prisma.cVFile.update({
      where: { id: cvFileId },
      data: { parseStatus: "FAILED", parseError: error.message },
    });
    throw error;
  }
}

export async function processLlmExtract(jobData: { candidateId: string; cvFileId: string }) {
  const { candidateId, cvFileId } = jobData;

  const extraction = await prisma.extraction.create({
    data: {
      candidateId,
      provider: extractionProvider.name,
      schemaVersion: "1.0",
      status: "RUNNING",
    },
  });

  try {
    const file = await prisma.cVFile.findUniqueOrThrow({ where: { id: cvFileId } });
    const text = file.textContent || "";

    const { result, evidence } = await extractionProvider.extract(text);

    // Update candidate with extracted info
    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        fullName: result.candidate.fullName,
        email: result.candidate.email,
        phone: result.candidate.phone,
        location: result.candidate.location,
      },
    });

    await prisma.extraction.update({
      where: { id: extraction.id },
      data: {
        extractedJson: result as any,
        evidenceJson: evidence as any,
        status: "SUCCEEDED",
      },
    });

    // Enqueue pre-screen + scoring
    await prescreenQueue.add("prescreen", { candidateId, extractionId: extraction.id });

    return { success: true };
  } catch (error: any) {
    await prisma.extraction.update({
      where: { id: extraction.id },
      data: { status: "FAILED", error: error.message },
    });
    throw error;
  }
}

export async function processPrescreen(jobData: { candidateId: string; extractionId: string }) {
  const { candidateId, extractionId } = jobData;

  const extraction = await prisma.extraction.findUniqueOrThrow({
    where: { id: extractionId },
  });

  const extractedJson = extraction.extractedJson as unknown as ExtractionResult;

  // Run scoring (includes pre-screen)
  const scoringResult = scoreCandidate({
    extraction: extractedJson,
    uniLookup: uniLookup,
    employerLookup: empLookup,
    divisionLookup: divLookup,
  });

  // Store pre-screen result
  await prisma.preScreenResult.upsert({
    where: { candidateId },
    create: {
      candidateId,
      status: scoringResult.preScreen.status,
      reasons: scoringResult.preScreen.reasons,
      yoeMonths: scoringResult.preScreen.yoeMonths,
      degreeClass: scoringResult.preScreen.degreeClass as any,
    },
    update: {
      status: scoringResult.preScreen.status,
      reasons: scoringResult.preScreen.reasons,
      yoeMonths: scoringResult.preScreen.yoeMonths,
      degreeClass: scoringResult.preScreen.degreeClass as any,
    },
  });

  // Enqueue ladder scoring
  await scoreLaddersQueue.add("score", { candidateId, extractionId });

  return { success: true, preScreenStatus: scoringResult.preScreen.status };
}

export async function processScoreLadders(jobData: { candidateId: string; extractionId: string }) {
  const { candidateId, extractionId } = jobData;

  const extraction = await prisma.extraction.findUniqueOrThrow({
    where: { id: extractionId },
  });

  const extractedJson = extraction.extractedJson as unknown as ExtractionResult;

  const scoringResult = scoreCandidate({
    extraction: extractedJson,
    uniLookup: uniLookup,
    employerLookup: empLookup,
    divisionLookup: divLookup,
  });

  // Delete old scores
  await prisma.subcategoryScore.deleteMany({ where: { candidateId } });

  // Store subcategory scores
  await prisma.subcategoryScore.createMany({
    data: scoringResult.subcategoryScores.map((s) => ({
      candidateId,
      axis: s.axis,
      code: s.code,
      ladderScore: s.ladderScore,
      normalizedU: s.normalizedU,
      weight: s.weight,
      rationale: s.rationale,
      evidenceRefs: s.evidenceRefs,
    })),
  });

  // Store axis scores
  await prisma.axisScore.upsert({
    where: { candidateId },
    create: {
      candidateId,
      eduScore: scoringResult.axisScores.eduScore,
      careerScore: scoringResult.axisScores.careerScore,
    },
    update: {
      eduScore: scoringResult.axisScores.eduScore,
      careerScore: scoringResult.axisScores.careerScore,
    },
  });

  return { success: true, axisScores: scoringResult.axisScores };
}

export async function processCohortFinalize(jobData: { country?: string; rolePreset?: string }) {
  // Gather all scored candidates
  const candidates = await prisma.candidate.findMany({
    include: {
      subcategoryScores: true,
      axisScore: true,
    },
    where: {
      axisScore: { isNot: null },
    },
  });

  const candidateData = candidates
    .filter((c) => c.axisScore)
    .map((c) => ({
      candidateId: c.id,
      subcategoryScores: c.subcategoryScores.map((s) => ({
        code: s.code,
        axis: s.axis as "EDU" | "CAREER",
        ladderScore: s.ladderScore,
        normalizedU: s.normalizedU,
        weight: s.weight,
        rationale: s.rationale,
        evidenceRefs: s.evidenceRefs as string[],
      })),
      eduScore: c.axisScore!.eduScore,
      careerScore: c.axisScore!.careerScore,
    }));

  const { normalized, distributions, axisStats } = computeCohortStats(candidateData);

  // Update z-scores and percentiles
  for (const norm of normalized) {
    await prisma.subcategoryScore.updateMany({
      where: { candidateId: norm.candidateId, code: norm.code },
      data: { zScore: norm.zScore, percentile: norm.percentile },
    });
  }

  // Store cohort stats
  const statsJson = {
    subcategories: Object.fromEntries(
      distributions.map((d) => [d.code, {
        mean: d.mean,
        std: d.std,
        count: d.count,
        bins: d.bins,
        percentiles: d.percentiles,
      }])
    ),
    axes: axisStats,
  };

  await prisma.cohortStats.create({
    data: {
      country: "UK",
      rolePreset: "UK_BA",
      statsJson: statsJson as any,
    },
  });

  return { success: true, candidateCount: candidateData.length };
}

export async function processAssignZone(jobData: { policyVersionId: string }) {
  const { policyVersionId } = jobData;

  const policy = await prisma.policyVersion.findUniqueOrThrow({
    where: { id: policyVersionId },
  });

  const axisCutoffs = policy.axisCutoffs as any;
  const spikePolicy = policy.spikePolicy as any;
  const subcategoryThresholds = policy.subcategoryThresholds as Record<string, string>;

  const candidates = await prisma.candidate.findMany({
    include: {
      axisScore: true,
      preScreenResult: true,
      subcategoryScores: true,
    },
    where: {
      axisScore: { isNot: null },
    },
  });

  // Delete old zone assignments for this policy
  await prisma.zoneAssignment.deleteMany({ where: { policyVersionId } });

  const assignments = [];
  for (const c of candidates) {
    if (!c.axisScore) continue;

    const preScreenStatus = c.preScreenResult?.status ?? "FAIL";

    // Build percentile map
    const percentiles = new Map<string, number>();
    for (const s of c.subcategoryScores) {
      if (s.percentile != null) {
        percentiles.set(s.code, s.percentile);
      }
    }

    const zoneResult = determineZone(
      c.axisScore.eduScore,
      c.axisScore.careerScore,
      axisCutoffs,
      preScreenStatus as "PASS" | "FAIL",
      spikePolicy,
      percentiles
    );

    // Check subcategory thresholds
    const meetsThresholds = meetsPercentileThresholds(percentiles, subcategoryThresholds);
    const hiringZonePass = zoneResult.hiringZonePass && meetsThresholds;

    assignments.push({
      candidateId: c.id,
      zone: zoneResult.zone,
      hiringZonePass,
      policyVersionId,
    });
  }

  await prisma.zoneAssignment.createMany({ data: assignments });

  return { success: true, count: assignments.length };
}
