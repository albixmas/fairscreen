import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  scoreCandidate,
  InMemoryUniversityLookup,
  InMemoryEmployerLookup,
  InMemoryDivisionLookup,
  DEFAULT_UK_UNIVERSITIES,
  DEFAULT_UK_EMPLOYERS,
  DEFAULT_UK_DIVISION_RULES,
} from "@fairscreen/scoring";
import { MockExtractionProvider } from "@fairscreen/extraction";
import type { ExtractionResult } from "@fairscreen/shared";
import * as fs from "fs";
import * as path from "path";

const UPLOAD_DIR = process.env.STORAGE_LOCAL_PATH || "./uploads";

const uniLookup = new InMemoryUniversityLookup(DEFAULT_UK_UNIVERSITIES);
const empLookup = new InMemoryEmployerLookup(DEFAULT_UK_EMPLOYERS);
const divLookup = new InMemoryDivisionLookup(DEFAULT_UK_DIVISION_RULES);
const extractionProvider = new MockExtractionProvider();

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  // Ensure upload directory exists
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const results = [];

  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    const fileType = ext === ".pdf" ? "PDF" : ext === ".docx" ? "DOCX" : null;

    if (!fileType) {
      results.push({ filename: file.name, error: "Unsupported file type" });
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const storagePath = path.join(UPLOAD_DIR, `${Date.now()}-${file.name}`);
      fs.writeFileSync(storagePath, buffer);

      // --- Stage 1: Parse CV ---
      const cvFile = await prisma.cVFile.create({
        data: {
          filename: file.name,
          fileType,
          storagePath,
          parseStatus: "RUNNING",
        },
      });

      const textContent = `CV content for ${file.name}`;
      await prisma.cVFile.update({
        where: { id: cvFile.id },
        data: { textContent, parseStatus: "SUCCEEDED" },
      });

      const candidate = await prisma.candidate.create({
        data: {
          fullName: file.name.replace(/\.(pdf|docx)$/i, ""),
          cvFileId: cvFile.id,
        },
      });

      // --- Stage 2: LLM Extraction ---
      const extraction = await prisma.extraction.create({
        data: {
          candidateId: candidate.id,
          provider: extractionProvider.name,
          schemaVersion: "1.0",
          status: "RUNNING",
        },
      });

      const { result, evidence } = await extractionProvider.extract(textContent);

      await prisma.candidate.update({
        where: { id: candidate.id },
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

      // --- Stage 3: Pre-screen ---
      const extractedJson = result as unknown as ExtractionResult;
      const scoringResult = scoreCandidate({
        extraction: extractedJson,
        uniLookup,
        employerLookup: empLookup,
        divisionLookup: divLookup,
      });

      await prisma.preScreenResult.upsert({
        where: { candidateId: candidate.id },
        create: {
          candidateId: candidate.id,
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

      // --- Stage 4: Score Ladders ---
      await prisma.subcategoryScore.deleteMany({ where: { candidateId: candidate.id } });

      await prisma.subcategoryScore.createMany({
        data: scoringResult.subcategoryScores.map((s) => ({
          candidateId: candidate.id,
          axis: s.axis,
          code: s.code,
          ladderScore: s.ladderScore,
          normalizedU: s.normalizedU,
          weight: s.weight,
          rationale: s.rationale,
          evidenceRefs: s.evidenceRefs,
        })),
      });

      await prisma.axisScore.upsert({
        where: { candidateId: candidate.id },
        create: {
          candidateId: candidate.id,
          eduScore: scoringResult.axisScores.eduScore,
          careerScore: scoringResult.axisScores.careerScore,
        },
        update: {
          eduScore: scoringResult.axisScores.eduScore,
          careerScore: scoringResult.axisScores.careerScore,
        },
      });

      results.push({
        filename: file.name,
        cvFileId: cvFile.id,
        candidateId: candidate.id,
        status: "PROCESSED",
        axisScores: scoringResult.axisScores,
        preScreen: scoringResult.preScreen.status,
      });
    } catch (error: any) {
      results.push({ filename: file.name, error: error.message, status: "FAILED" });
    }
  }

  return NextResponse.json({ results, count: results.length });
}

export async function GET() {
  const files = await prisma.cVFile.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      candidate: {
        include: {
          axisScore: true,
          zoneAssignments: { take: 1, orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  return NextResponse.json({ files });
}
