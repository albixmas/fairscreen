/**
 * OpenAI-compatible extraction provider.
 * Sends CV text to an LLM and parses response to strict JSON schema.
 */

import { ExtractionResultSchema, EvidenceItemSchema, type ExtractionResult, type EvidenceItem } from "@fairscreen/shared";
import { z } from "zod";
import type { ExtractionProvider, ExtractionProviderConfig } from "./provider";

const SYSTEM_PROMPT = `You are a CV/resume extraction engine. Extract structured data from the provided CV text.
You MUST output valid JSON matching the exact schema below. Do not include any text outside the JSON.

Output schema:
{
  "extraction": {
    "candidate": { "fullName": string, "email"?: string, "phone"?: string, "location"?: string },
    "education": [{
      "institution": string,
      "country"?: string,
      "degreeType": "BA"|"BSC"|"BENG"|"MENG"|"MSCI"|"MMATH"|"MSC"|"MPHIL"|"PHD"|"OXBRIDGE_MA"|"MBA"|"OTHER",
      "field": string,
      "startDate"?: string,
      "endDate"?: string,
      "gradeText"?: string,
      "gradeNormalized"?: "FIRST"|"HIGH_21"|"SECOND_21"|"SECOND_22"|"OTHER"|"UNKNOWN",
      "marks"?: number|null,
      "awards": string[],
      "societies": string[],
      "activities": string[]
    }],
    "work": [{
      "employer": string,
      "employerFamily"?: string,
      "roleTitle": string,
      "divisionKeywordsFound": string[],
      "startDate"?: string,
      "endDate"?: string,
      "durationWeeks"?: number|null,
      "bullets": [{ "text": string, "metrics": [{ "value": string, "unit"?: string, "context"?: string }] }],
      "location"?: string,
      "internshipFlag"?: boolean,
      "qualifyingInternship"?: boolean
    }],
    "leadershipProjects": [{
      "title": string,
      "org"?: string,
      "startDate"?: string,
      "endDate"?: string,
      "scope": { "teamSize"?: number, "fundsRaised"?: string, "audienceSize"?: number, "selectivity"?: string, "responsibilityNotes"?: string },
      "achievements": string[],
      "metrics": [{ "value": string, "unit"?: string, "context"?: string }]
    }],
    "nonAcademicExcellence": [{
      "domain": "SPORT"|"ARTS"|"COMPETITION"|"PUBLICATION"|"VOLUNTEERING"|"OTHER",
      "level": "LOCAL"|"UNIVERSITY"|"REGIONAL"|"NATIONAL"|"INTERNATIONAL",
      "description": string
    }]
  },
  "evidence": [{
    "id": string,
    "fieldPath": string,
    "snippet": string,
    "page": number|null,
    "startOffset": number|null,
    "endOffset": number|null,
    "confidence": number
  }]
}

Rules:
- For UK degree grading: First Class = FIRST, Upper Second (2:1) = HIGH_21, Lower Second (2:2) = SECOND_22
- If marks >= 70 in UK context, gradeNormalized should be FIRST
- Identify division keywords (strategy, audit, deals, m&a, consulting, etc.)
- Mark internships with internshipFlag=true, qualifyingInternship=true if >= 6 weeks
- Provide evidence snippets for every extracted field
- Generate unique IDs for evidence items (e.g., "ev_1", "ev_2", ...)`;

const ResponseSchema = z.object({
  extraction: ExtractionResultSchema,
  evidence: z.array(EvidenceItemSchema),
});

export class OpenAIExtractionProvider implements ExtractionProvider {
  name = "openai";
  private config: ExtractionProviderConfig;

  constructor(config: ExtractionProviderConfig) {
    this.config = config;
  }

  async extract(text: string, pageMap?: Record<number, { start: number; end: number }>): Promise<{
    result: ExtractionResult;
    evidence: EvidenceItem[];
  }> {
    const pageContext = pageMap
      ? `\n\nPage boundaries: ${JSON.stringify(pageMap)}`
      : "";

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Extract from this CV:\n\n${text}${pageContext}` },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("LLM response is not valid JSON");
    }

    // Validate
    const validated = ResponseSchema.safeParse(parsed);
    if (validated.success) {
      return { result: validated.data.extraction, evidence: validated.data.evidence };
    }

    // Retry with repair prompt
    const repairResponse = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Extract from this CV:\n\n${text}${pageContext}` },
          { role: "assistant", content: content },
          {
            role: "user",
            content: `Your JSON had validation errors: ${validated.error.message}\n\nPlease fix and return valid JSON matching the schema exactly.`,
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    const repairData = await repairResponse.json() as any;
    const repairContent = repairData.choices?.[0]?.message?.content;
    const repairParsed = JSON.parse(repairContent ?? "{}");
    const repairValidated = ResponseSchema.parse(repairParsed);
    return { result: repairValidated.extraction, evidence: repairValidated.evidence };
  }
}
