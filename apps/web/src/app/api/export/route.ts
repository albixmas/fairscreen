import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "csv";
  const type = searchParams.get("type") || "shortlist";
  const policyVersionId = searchParams.get("policyVersionId");

  if (type === "shortlist") {
    return exportShortlist(format, policyVersionId);
  }

  if (type === "audit") {
    return exportAudit(format, policyVersionId);
  }

  return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
}

async function exportShortlist(format: string, policyVersionId: string | null) {
  const where: any = { hiringZonePass: true };
  if (policyVersionId) where.policyVersionId = policyVersionId;

  const assignments = await prisma.zoneAssignment.findMany({
    where,
    include: {
      candidate: {
        include: {
          axisScore: true,
          subcategoryScores: true,
          preScreenResult: true,
        },
      },
      policyVersion: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (format === "csv") {
    const headers = [
      "Name", "Email", "Zone", "Edu Score", "Career Score",
      "E1", "E2", "E3", "E4", "E5",
      "C1", "C2", "C3", "C4", "C5",
      "Pre-screen", "Policy",
    ];

    const rows = assignments.map((a) => {
      const c = a.candidate;
      const scores = Object.fromEntries(
        c.subcategoryScores.map((s) => [s.code, s.ladderScore])
      );
      return [
        c.fullName,
        c.email || "",
        a.zone,
        c.axisScore?.eduScore.toFixed(1) || "",
        c.axisScore?.careerScore.toFixed(1) || "",
        scores["E1"] || "", scores["E2"] || "", scores["E3"] || "",
        scores["E4"] || "", scores["E5"] || "",
        scores["C1"] || "", scores["C2"] || "", scores["C3"] || "",
        scores["C4"] || "", scores["C5"] || "",
        c.preScreenResult?.status || "",
        a.policyVersion?.name || "",
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=shortlist.csv",
      },
    });
  }

  return NextResponse.json({ shortlist: assignments });
}

async function exportAudit(format: string, policyVersionId: string | null) {
  const where: any = {};
  if (policyVersionId) where.policyVersionId = policyVersionId;

  const assignments = await prisma.zoneAssignment.findMany({
    where,
    include: {
      candidate: {
        include: {
          axisScore: true,
          subcategoryScores: true,
          preScreenResult: true,
          extractions: { take: 1 },
        },
      },
      policyVersion: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const audit = assignments.map((a) => ({
    candidateId: a.candidate.id,
    candidateName: a.candidate.fullName,
    zone: a.zone,
    hiringZonePass: a.hiringZonePass,
    eduScore: a.candidate.axisScore?.eduScore,
    careerScore: a.candidate.axisScore?.careerScore,
    subcategoryScores: a.candidate.subcategoryScores.map((s) => ({
      code: s.code,
      ladderScore: s.ladderScore,
      normalizedU: s.normalizedU,
      weight: s.weight,
      zScore: s.zScore,
      percentile: s.percentile,
      rationale: s.rationale,
    })),
    preScreen: {
      status: a.candidate.preScreenResult?.status,
      reasons: a.candidate.preScreenResult?.reasons,
    },
    policyVersion: {
      id: a.policyVersion.id,
      name: a.policyVersion.name,
      axisCutoffs: a.policyVersion.axisCutoffs,
      weights: a.policyVersion.weights,
    },
    timestamp: a.createdAt,
  }));

  if (format === "csv") {
    const headers = [
      "Candidate ID", "Name", "Zone", "Hiring Zone Pass",
      "Edu Score", "Career Score", "Pre-screen Status",
      "Policy Name", "Timestamp",
    ];
    const rows = audit.map((a) => [
      a.candidateId, a.candidateName, a.zone, a.hiringZonePass,
      a.eduScore?.toFixed(1), a.careerScore?.toFixed(1),
      a.preScreen.status, a.policyVersion.name, a.timestamp,
    ].join(","));

    const csv = [headers.join(","), ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=audit.csv",
      },
    });
  }

  return NextResponse.json({ audit });
}
