import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (type === "universities") {
    const unis = await prisma.universityTaxonomy.findMany({
      orderBy: [{ tier: "asc" }, { institutionName: "asc" }],
    });
    return NextResponse.json({ universities: unis });
  }

  if (type === "employers") {
    const employers = await prisma.employerFamilyTaxonomy.findMany({
      orderBy: [{ tier: "asc" }, { employerFamily: "asc" }],
    });
    return NextResponse.json({ employers });
  }

  if (type === "divisions") {
    const divisions = await prisma.divisionRoleTaxonomy.findMany({
      orderBy: [{ employerFamily: "asc" }, { category: "asc" }],
    });
    return NextResponse.json({ divisions });
  }

  return NextResponse.json({ error: "Specify type parameter" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, data } = body;

  if (type === "university") {
    const result = await prisma.universityTaxonomy.upsert({
      where: {
        country_institutionName_versionTag: {
          country: data.country || "UK",
          institutionName: data.institutionName,
          versionTag: data.versionTag || "v1",
        },
      },
      create: {
        country: data.country || "UK",
        institutionName: data.institutionName,
        tier: data.tier,
        disciplineNotes: data.disciplineNotes,
        versionTag: data.versionTag || "v1",
      },
      update: {
        tier: data.tier,
        disciplineNotes: data.disciplineNotes,
      },
    });
    return NextResponse.json({ result });
  }

  if (type === "employer") {
    const result = await prisma.employerFamilyTaxonomy.upsert({
      where: {
        country_employerFamily_versionTag: {
          country: data.country || "UK",
          employerFamily: data.employerFamily,
          versionTag: data.versionTag || "v1",
        },
      },
      create: {
        country: data.country || "UK",
        employerFamily: data.employerFamily,
        tier: data.tier,
        versionTag: data.versionTag || "v1",
      },
      update: {
        tier: data.tier,
      },
    });
    return NextResponse.json({ result });
  }

  if (type === "division") {
    const result = await prisma.divisionRoleTaxonomy.upsert({
      where: {
        country_employerFamily_category_versionTag: {
          country: data.country || "UK",
          employerFamily: data.employerFamily,
          category: data.category,
          versionTag: data.versionTag || "v1",
        },
      },
      create: {
        country: data.country || "UK",
        employerFamily: data.employerFamily,
        category: data.category,
        keywords: data.keywords || [],
        selectivityMultiplier: data.selectivityMultiplier || 1.0,
        notes: data.notes,
        versionTag: data.versionTag || "v1",
      },
      update: {
        keywords: data.keywords,
        selectivityMultiplier: data.selectivityMultiplier,
        notes: data.notes,
      },
    });
    return NextResponse.json({ result });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
