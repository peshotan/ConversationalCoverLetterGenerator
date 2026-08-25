import type { CoverLetterSection } from "@workspace/api-zod";

export function findUnsupportedEvidence(
  sections: Pick<CoverLetterSection, "evidence">[],
  resume: string,
): string[] {
  const resumeLower = resume.toLowerCase();
  return sections
    .flatMap((section) => section.evidence)
    .filter((evidence) => !resumeLower.includes(evidence.toLowerCase()));
}