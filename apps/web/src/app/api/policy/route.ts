import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assignZoneQueue } from "@/lib/queues";
import {
  determineZone,
  meetsPercentileThresholds,
} from "@fairscreen/scoring";
import type { AxisCutoffs, SpikePolicy } from "@fairscreen/shared";

export async function GET() {
  const policies = await prisma.policyVersion.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ policies });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  if (action === "preview") {
    return handlePreview(body);
  }

  if (action === "save") {
    return handleSave(body);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function handlePreview(body: any) {
  const { axisCutoffs, subcategoryThresholds, spikePolicy } = body;

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

  const zoneCounts: Record<string, number> = {
    STRONG_YES: 0, YES: 0, MAYBE: 0, NO: 0, PRESCREEN_FAIL: 0,
  };
  let hiringZonePassCount = 0;
  const matrixPoints: Array<{ id: string; x: number; y: number; zone: string; name: string }> = [];

  for (const c of candidates) {
    if (!c.axisScore) continue;

    const preScreenStatus = c.preScreenResult?.status ?? "FAIL";
    const percentiles = new Map<string, number>();
    for (const s of c.subcategoryScores) {
      if (s.percentile != null) {
        percentiles.set(s.code, s.percentile);
      }
    }

    const zoneResult = determineZone(
      c.axisScore.eduScore,
      c.axisScore.careerScore,
      axisCutoffs as AxisCutoffs,
      preScreenStatus as "PASS" | "FAIL",
      spikePolicy as SpikePolicy,
      percentiles
    );

    const meetsThresholds = meetsPercentileThresholds(
      percentiles,
      subcategoryThresholds || {}
    );
    const hiringZonePass = zoneResult.hiringZonePass && meetsThresholds;

    zoneCounts[zoneResult.zone]++;
    if (hiringZonePass) hiringZonePassCount++;

    matrixPoints.push({
      id: c.id,
      x: c.axisScore.eduScore,
      y: c.axisScore.careerScore,
      zone: zoneResult.zone,
      name: c.fullName,
    });
  }

  return NextResponse.json({
    zoneCounts,
    hiringZonePassCount,
    totalCandidates: candidates.length,
    matrixPoints,
  });
}

async function handleSave(body: any) {
  const {
    name, axisCutoffs, subcategoryThresholds, weights,
    preScreenRules, spikePolicy, notes,
  } = body;

  // Use a default admin user ID for MVP
  let user = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!user) {
    const bcrypt = await import("bcryptjs");
    user = await prisma.user.create({
      data: {
        email: "admin@fairscreen.io",
        passwordHash: await bcrypt.hash("admin", 10),
        role: "ADMIN",
      },
    });
  }

  const policy = await prisma.policyVersion.create({
    data: {
      name: name || `Policy ${new Date().toISOString()}`,
      preScreenRules: preScreenRules || {},
      axisCutoffs: axisCutoffs || { strongYes: 18, yes: 15, maybe: 10 },
      subcategoryThresholds: subcategoryThresholds || {},
      weights: weights || {
        edu: { E1: 0.30, E2: 0.30, E3: 0.10, E4: 0.20, E5: 0.10 },
        career: { C1: 0.40, C2: 0.25, C3: 0.20, C4: 0.10, C5: 0.05 },
      },
      spikePolicy: spikePolicy || { enabled: true, thresholdPct: 0.99 },
      createdByUserId: user.id,
      notes,
    },
  });

  // Trigger zone assignment
  await assignZoneQueue.add("assign", { policyVersionId: policy.id });

  return NextResponse.json({ policy });
}
