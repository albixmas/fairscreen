import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "overview";

  if (type === "overview") {
    return getOverviewStats();
  }

  if (type === "distributions") {
    return getDistributions();
  }

  if (type === "matrix") {
    return getMatrixData(searchParams);
  }

  if (type === "fairness") {
    return getFairnessStats();
  }

  return NextResponse.json({ error: "Unknown stats type" }, { status: 400 });
}

async function getOverviewStats() {
  const [
    totalCandidates,
    totalFiles,
    pendingFiles,
    latestCohort,
  ] = await Promise.all([
    prisma.candidate.count(),
    prisma.cVFile.count(),
    prisma.cVFile.count({ where: { parseStatus: { in: ["QUEUED", "RUNNING"] } } }),
    prisma.cohortStats.findFirst({ orderBy: { computedAt: "desc" } }),
  ]);

  // Zone counts from latest zone assignments
  const zoneCounts = await prisma.zoneAssignment.groupBy({
    by: ["zone"],
    _count: true,
    orderBy: { _count: { zone: "desc" } },
  });

  const hiringZonePassCount = await prisma.zoneAssignment.count({
    where: { hiringZonePass: true },
  });

  return NextResponse.json({
    totalCandidates,
    totalFiles,
    pendingFiles,
    zoneCounts: Object.fromEntries(
      zoneCounts.map((z) => [z.zone, z._count])
    ),
    hiringZonePassCount,
    cohortStats: latestCohort?.statsJson || null,
  });
}

async function getDistributions() {
  const latestCohort = await prisma.cohortStats.findFirst({
    orderBy: { computedAt: "desc" },
  });

  if (!latestCohort) {
    return NextResponse.json({ distributions: null });
  }

  return NextResponse.json({ distributions: latestCohort.statsJson });
}

async function getMatrixData(params: URLSearchParams) {
  const policyVersionId = params.get("policyVersionId");

  const candidates = await prisma.candidate.findMany({
    include: {
      axisScore: true,
      zoneAssignments: policyVersionId
        ? { where: { policyVersionId }, take: 1 }
        : { take: 1, orderBy: { createdAt: "desc" } },
    },
    where: {
      axisScore: { isNot: null },
    },
  });

  // For density binning (>500 candidates)
  const points = candidates
    .filter((c) => c.axisScore)
    .map((c) => ({
      id: c.id,
      name: c.fullName,
      x: c.axisScore!.eduScore,
      y: c.axisScore!.careerScore,
      zone: c.zoneAssignments[0]?.zone || "NO",
      hiringZonePass: c.zoneAssignments[0]?.hiringZonePass || false,
    }));

  // Compute hex bins for density
  const binSize = 2;
  const bins: Record<string, { x: number; y: number; count: number; zones: Record<string, number> }> = {};

  for (const p of points) {
    const bx = Math.floor(p.x / binSize) * binSize;
    const by = Math.floor(p.y / binSize) * binSize;
    const key = `${bx},${by}`;
    if (!bins[key]) {
      bins[key] = { x: bx + binSize / 2, y: by + binSize / 2, count: 0, zones: {} };
    }
    bins[key].count++;
    bins[key].zones[p.zone] = (bins[key].zones[p.zone] || 0) + 1;
  }

  return NextResponse.json({
    points: points.length <= 500 ? points : [],
    bins: Object.values(bins),
    totalPoints: points.length,
    useDensity: points.length > 500,
  });
}

async function getFairnessStats() {
  // Get candidates with their university info from extractions
  const candidates = await prisma.candidate.findMany({
    include: {
      extractions: { take: 1, orderBy: { createdAt: "desc" } },
      zoneAssignments: { take: 1, orderBy: { createdAt: "desc" } },
      axisScore: true,
    },
    where: {
      axisScore: { isNot: null },
    },
  });

  // Selection rates by university tier
  const tierStats: Record<string, { total: number; selected: number }> = {
    PRIORITY_1: { total: 0, selected: 0 },
    TIER_1: { total: 0, selected: 0 },
    TIER_2: { total: 0, selected: 0 },
    OTHER: { total: 0, selected: 0 },
  };

  for (const c of candidates) {
    const extraction = c.extractions[0]?.extractedJson as any;
    if (!extraction?.education?.[0]) continue;

    // Simple tier detection from extraction
    const inst = extraction.education[0].institution?.toLowerCase() || "";
    let tier = "OTHER";
    if (inst.includes("oxford") || inst.includes("cambridge") || inst.includes("lse") || inst.includes("imperial") || inst.includes("ucl")) {
      tier = "PRIORITY_1";
    } else if (inst.includes("warwick") || inst.includes("durham") || inst.includes("edinburgh") || inst.includes("bath") || inst.includes("bristol") || inst.includes("manchester")) {
      tier = "TIER_1";
    } else if (inst.includes("sheffield") || inst.includes("york") || inst.includes("southampton") || inst.includes("lancaster")) {
      tier = "TIER_2";
    }

    tierStats[tier].total++;
    const zone = c.zoneAssignments[0]?.zone;
    if (zone === "STRONG_YES" || zone === "YES") {
      tierStats[tier].selected++;
    }
  }

  // False negative sampler: NO zone but high spike (any subcategory score >= 4)
  const falseNegatives = await prisma.candidate.findMany({
    where: {
      zoneAssignments: {
        some: { zone: "NO" },
      },
      subcategoryScores: {
        some: { ladderScore: { gte: 4 } },
      },
    },
    include: {
      subcategoryScores: true,
      axisScore: true,
      zoneAssignments: { take: 1 },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    tierStats,
    falseNegatives: falseNegatives.map((c) => ({
      id: c.id,
      name: c.fullName,
      eduScore: c.axisScore?.eduScore,
      careerScore: c.axisScore?.careerScore,
      highScores: c.subcategoryScores
        .filter((s) => s.ladderScore >= 4)
        .map((s) => ({ code: s.code, score: s.ladderScore })),
    })),
  });
}
