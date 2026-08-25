import type { CoverLetterSection } from "@workspace/api-zod";

type ResumeSource = {
  resumeText?: string | null;
  resumePdfBase64?: string | null;
};

export function hasResumeSource(input: ResumeSource): boolean {
  return Boolean(input.resumeText?.trim() || input.resumePdfBase64);
}

export function isPdfBase64(value: string): boolean {
  return Buffer.from(value.slice(0, 24), "base64").subarray(0, 4).toString("ascii") === "%PDF";
}

export function safePdfFileName(value?: string | null): string {
  const cleaned = (value || "resume.pdf")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 255);

  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

export function findUnsupportedEvidence(
  sections: Pick<CoverLetterSection, "evidence">[],
  resume: string,
): string[] {
  const resumeLower = resume.toLowerCase();
  return sections
    .flatMap((section) => section.evidence)
    .filter((evidence) => !resumeLower.includes(evidence.toLowerCase()));
}