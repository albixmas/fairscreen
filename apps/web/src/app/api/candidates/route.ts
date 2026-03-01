import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const zone = searchParams.get("zone");
  const search = searchParams.get("search");
  const policyVersionId = searchParams.get("policyVersionId");

  const where: any = {};
  if (search) {
    where.fullName = { contains: search, mode: "insensitive" };
  }
  if (zone && policyVersionId) {
    where.zoneAssignments = {
      some: { zone, policyVersionId },
    };
  }

  const [candidates, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      include: {
        axisScore: true,
        preScreenResult: true,
        zoneAssignments: policyVersionId
          ? { where: { policyVersionId }, take: 1 }
          : { take: 1, orderBy: { createdAt: "desc" } },
        subcategoryScores: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.candidate.count({ where }),
  ]);

  return NextResponse.json({
    candidates,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
