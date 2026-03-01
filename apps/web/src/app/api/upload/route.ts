import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseCvQueue } from "@/lib/queues";
import * as fs from "fs";
import * as path from "path";

const UPLOAD_DIR = process.env.STORAGE_LOCAL_PATH || "./uploads";

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = path.join(UPLOAD_DIR, `${Date.now()}-${file.name}`);
    fs.writeFileSync(storagePath, buffer);

    const cvFile = await prisma.cVFile.create({
      data: {
        filename: file.name,
        fileType,
        storagePath,
        parseStatus: "QUEUED",
      },
    });

    await parseCvQueue.add("parse", { cvFileId: cvFile.id });
    results.push({ filename: file.name, cvFileId: cvFile.id, status: "QUEUED" });
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
