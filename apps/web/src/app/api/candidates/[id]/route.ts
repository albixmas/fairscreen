import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      cvFile: true,
      extractions: { orderBy: { createdAt: "desc" }, take: 1 },
      preScreenResult: true,
      subcategoryScores: true,
      axisScore: true,
      zoneAssignments: {
        include: { policyVersion: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  return NextResponse.json(candidate);
}
