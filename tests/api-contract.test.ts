import { describe, expect, it } from "vitest";
import { GenerateCoverLetterBody, GenerateCoverLetterResponse } from "../lib/api-zod/src";

const validInput = {
  resumeText: "A".repeat(80),
  jobDescription: "B".repeat(80),
};

describe("cover letter API contract", () => {
  it("accepts valid input and applies defaults", () => {
    const parsed = GenerateCoverLetterBody.parse(validInput);

    expect(parsed.tone).toBe("professional");
    expect(parsed.length).toBe("standard");
  });

  it("rejects resumes and job descriptions below the minimum length", () => {
    expect(GenerateCoverLetterBody.safeParse({ ...validInput, resumeText: "too short" }).success).toBe(false);
    expect(GenerateCoverLetterBody.safeParse({ ...validInput, jobDescription: "too short" }).success).toBe(false);
  });

  it("rejects unsupported section names in generated responses", () => {
    const response = {
      letter: "Draft",
      sections: [{ name: "claims", text: "Draft", evidence: [], requirements: [] }],
      warnings: [],
      missingEvidence: [],
    };

    expect(GenerateCoverLetterResponse.safeParse(response).success).toBe(false);
  });
});