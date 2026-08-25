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

  it("accepts a bounded PDF payload without pasted resume text", () => {
    const result = GenerateCoverLetterBody.safeParse({
      resumeText: null,
      resumePdfBase64: "JVBERi0xLjQ=",
      resumePdfFileName: "resume.pdf",
      jobDescription: "B".repeat(80),
    });

    expect(result.success).toBe(true);
  });

  it("rejects malformed PDF payloads", () => {
    expect(GenerateCoverLetterBody.safeParse({
      resumeText: null,
      resumePdfBase64: "this is not base64",
      jobDescription: "B".repeat(80),
    }).success).toBe(false);
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