/**
 * Mock extraction provider for development and testing.
 * Returns realistic but synthetic extraction data.
 */

import type { ExtractionResult, EvidenceItem } from "@fairscreen/shared";
import type { ExtractionProvider } from "./provider";

const INSTITUTIONS = [
  "University of Oxford", "University of Cambridge", "LSE",
  "Imperial College London", "UCL", "University of Warwick",
  "University of Edinburgh", "Durham University", "University of Bath",
  "University of Bristol", "University of Manchester", "King's College London",
  "University of Sheffield", "University of York", "Lancaster University",
  "University of Southampton", "Northumbria University", "De Montfort University",
];

const EMPLOYERS = [
  "McKinsey & Company", "Goldman Sachs", "BCG", "Bain & Company",
  "PwC", "Deloitte", "EY", "KPMG", "Accenture",
  "Morgan Stanley", "JPMorgan", "Rothschild",
  "Google", "Amazon", "Barclays", "HSBC",
  "Local Consulting Firm", "Small Tech Startup",
];

const DEGREE_TYPES = ["BA", "BSC", "BENG", "MENG", "MSC", "MPHIL"] as const;
const GRADES = ["FIRST", "HIGH_21", "SECOND_21", "SECOND_22"] as const;
const FIELDS = ["Economics", "PPE", "Mathematics", "Computer Science", "Engineering", "History", "Finance", "Physics"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function maybe<T>(value: T, probability: number = 0.5): T | undefined {
  return Math.random() < probability ? value : undefined;
}

export class MockExtractionProvider implements ExtractionProvider {
  name = "mock";

  async extract(text: string): Promise<{
    result: ExtractionResult;
    evidence: EvidenceItem[];
  }> {
    // Try to extract name from text
    const nameMatch = text.match(/^([A-Z][a-z]+ [A-Z][a-z]+)/m);
    const fullName = nameMatch ? nameMatch[1] : `Candidate_${Math.floor(Math.random() * 10000)}`;

    const institution = pick(INSTITUTIONS);
    const employer = pick(EMPLOYERS);
    const grade = pick(GRADES);
    const degreeType = pick(DEGREE_TYPES);

    const result: ExtractionResult = {
      candidate: {
        fullName,
        email: maybe(`${fullName.toLowerCase().replace(" ", ".")}@email.com`, 0.8),
        phone: maybe("+44 7700 900000", 0.6),
        location: maybe("London, UK", 0.7),
      },
      education: [
        {
          institution,
          country: "UK",
          degreeType,
          field: pick(FIELDS),
          startDate: "2019-09",
          endDate: "2022-06",
          gradeText: grade === "FIRST" ? "First Class Honours" : grade === "HIGH_21" ? "Upper Second Class (2:1)" : "2:2",
          gradeNormalized: grade,
          marks: grade === "FIRST" ? 72 + Math.floor(Math.random() * 10) : null,
          awards: Math.random() > 0.6 ? ["Dean's List", "Academic Prize"] : [],
          societies: Math.random() > 0.5 ? ["Economics Society", "Case Competition Team"] : [],
          activities: Math.random() > 0.7 ? ["Organized annual conference"] : [],
        },
      ],
      work: [
        {
          employer,
          roleTitle: pick(["Summer Analyst", "Intern", "Associate", "Consultant", "Strategy Intern"]),
          divisionKeywordsFound: pick([["strategy"], ["audit"], ["consulting"], ["investment banking"], ["deals"]]),
          startDate: "2022-06",
          endDate: "2022-09",
          durationWeeks: pick([6, 8, 10, 12]),
          bullets: [
            { text: "Supported deal team on $500M acquisition", metrics: [{ value: "500", unit: "M", context: "deal size" }] },
            { text: "Built financial models for client presentations", metrics: [] },
          ],
          internshipFlag: true,
          qualifyingInternship: true,
        },
      ],
      leadershipProjects: Math.random() > 0.4
        ? [{
            title: pick(["Founded university charity", "Led consulting project", "Started student startup"]),
            org: pick(["University Society", "Independent", "Student Union"]),
            scope: { teamSize: Math.floor(Math.random() * 20) + 3, fundsRaised: maybe("£10,000") },
            achievements: ["Successfully delivered project outcomes"],
            metrics: [],
          }]
        : [],
      nonAcademicExcellence: Math.random() > 0.5
        ? [{
            domain: pick(["SPORT", "ARTS", "COMPETITION", "VOLUNTEERING"]),
            level: pick(["LOCAL", "UNIVERSITY", "REGIONAL", "NATIONAL"]),
            description: "Significant achievement in extracurricular domain",
          }]
        : [],
    };

    const evidence: EvidenceItem[] = [
      {
        id: "ev_1",
        fieldPath: "education[0].institution",
        snippet: institution,
        page: 1,
        startOffset: null,
        endOffset: null,
        confidence: 0.95,
      },
      {
        id: "ev_2",
        fieldPath: "education[0].gradeNormalized",
        snippet: grade,
        page: 1,
        startOffset: null,
        endOffset: null,
        confidence: 0.9,
      },
      {
        id: "ev_3",
        fieldPath: "work[0].employer",
        snippet: employer,
        page: 1,
        startOffset: null,
        endOffset: null,
        confidence: 0.95,
      },
    ];

    return { result, evidence };
  }
}
