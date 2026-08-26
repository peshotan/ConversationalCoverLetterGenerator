import { describe, expect, it } from "vitest";
import {
  findUnsupportedEvidence,
  generateDeterministicCoverLetter,
  hasResumeSource,
  hasTextResume,
  isPdfBase64,
  safePdfFileName,
} from "../artifacts/api-server/src/lib/cover-letter-utils";

describe("cover letter evidence helpers", () => {
  it("identifies evidence that is not present in the resume", () => {
    const sections = [
      { evidence: ["Built REST APIs", "Managed a $2M budget"] },
    ];

    expect(findUnsupportedEvidence(sections, "Built REST APIs for a cloud platform.")).toEqual(["Managed a $2M budget"]);
  });

  it("matches evidence without treating capitalization as a mismatch", () => {
    const sections = [{ evidence: ["REST APIs", "TypeScript Services"] }];

    expect(findUnsupportedEvidence(sections, "Built REST APIs and TypeScript services.")).toEqual([]);
  });

  it("recognizes a pasted resume or an uploaded PDF as a source", () => {
    expect(hasResumeSource({ resumeText: "A short resume" })).toBe(true);
    expect(hasResumeSource({ resumePdfBase64: "JVBERi0xLjQ=" })).toBe(true);
    expect(hasResumeSource({ resumeText: "   " })).toBe(false);
    expect(hasTextResume({ resumeText: "A pasted resume" })).toBe(true);
    expect(hasTextResume({ resumePdfBase64: "JVBERi0xLjQ=" })).toBe(false);
  });

  it("identifies PDF bytes and sanitizes their filenames", () => {
    expect(isPdfBase64("JVBERi0xLjQ=")).toBe(true);
    expect(isPdfBase64("bm90IGEgcGRm")).toBe(false);
    expect(safePdfFileName("../../resume draft")).toBe(".._.._resume_draft.pdf");
  });

  it("creates the no-AI draft from pasted resume evidence", () => {
    const result = generateDeterministicCoverLetter({
      resumeText: "Peshotan Tan\nBuilt REST APIs for a cloud platform.\nLed TypeScript services for customer workflows.",
      jobDescription: "We need someone with strong TypeScript services and cloud platform experience.",
      companyName: "Northstar",
      roleTitle: "Software Engineer",
    });

    expect(result.letter).toContain("Dear Hiring Team,");
    expect(result.letter).toContain("Sincerely,\nPeshotan");
    expect(result.sections[1]?.evidence).toEqual(expect.arrayContaining([
      "Built REST APIs for a cloud platform.",
      "Led TypeScript services for customer workflows.",
    ]));
    expect(result.warnings[0]).toContain("text you provided");
  });
});