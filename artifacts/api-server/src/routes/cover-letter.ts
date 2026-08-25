import { Router, type IRouter } from "express";
import {
  GenerateCoverLetterBody,
  GenerateCoverLetterResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const STOP_WORDS = new Set([
  "about", "above", "after", "again", "against", "being", "below", "could",
  "from", "have", "into", "more", "most", "other", "over", "their", "there",
  "these", "they", "this", "those", "through", "under", "using", "what",
  "when", "where", "which", "while", "with", "would", "your", "looking",
  "software", "engineer", "build", "reliable", "application", "applications",
  "experience", "team", "teams", "role", "work", "will", "you",
]);

function cleanSentence(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[•\-–—\s]+/, "").trim();
}

function findEvidence(resume: string, keywords: string[]): string[] {
  const lines = resume
    .split(/\r?\n/)
    .map(cleanSentence)
    .filter((line) => line.length > 24);

  return keywords
    .flatMap((keyword) => lines.filter((line) => line.toLowerCase().includes(keyword)))
    .filter((line, index, all) => all.indexOf(line) === index)
    .slice(0, 3);
}

function extractKeywords(jobDescription: string): string[] {
  return [...new Set(
    jobDescription
      .toLowerCase()
      .replace(/[^a-z0-9+#\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 5 && !STOP_WORDS.has(word)),
  )].slice(0, 8);
}

function firstName(resume: string): string | null {
  const firstLine = resume.split(/\r?\n/).map(cleanSentence).find(Boolean);
  if (!firstLine || firstLine.includes("@") || firstLine.length > 80) return null;
  return firstLine.split(/\s+/)[0] ?? null;
}

router.post("/cover-letter/generate", (req, res) => {
  const parsed = GenerateCoverLetterBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Please provide a resume and a detailed job description." });
    return;
  }

  const input = parsed.data;
  const title = input.roleTitle || "this opportunity";
  const company = input.companyName || "your team";
  const keywords = extractKeywords(input.jobDescription);
  const evidence = findEvidence(input.resumeText, keywords);
  const candidate = firstName(input.resumeText);
  const greeting = input.recipientName ? `Dear ${input.recipientName},` : "Dear Hiring Team,";
  const signoff = candidate ? `Sincerely,\n${candidate}` : "Sincerely,\n[Your name]";
  const evidenceLine = evidence[0] || "my experience and transferable strengths described in my resume";
  const focus = keywords.slice(0, 3).join(", ");
  const opening = `I am excited to apply for the ${title} role at ${company}. My background has prepared me to contribute thoughtfully from day one, and I am particularly drawn to the opportunity to bring my experience to a team working on meaningful problems.`;
  const body = `Across my experience, I have built a track record that connects directly to this role${focus ? `, including ${focus}` : ""}. ${evidenceLine} This reflects the kind of ownership, collaboration, and practical problem-solving I would bring to ${company}.`;
  const closing = `I would welcome the opportunity to discuss how my experience can support ${company}'s goals. Thank you for your time and consideration.`;
  const letter = `${greeting}\n\n${opening}\n\n${body}\n\n${closing}\n\n${signoff}`;
  const missingEvidence = keywords
    .filter((keyword) => !input.resumeText.toLowerCase().includes(keyword))
    .slice(0, 4)
    .map((keyword) => `Consider adding specific evidence for “${keyword}” if it reflects your experience.`);

  const result = GenerateCoverLetterResponse.parse({
    letter,
    sections: [
      { name: "opening", text: opening, evidence: [], requirements: [title] },
      { name: "evidence", text: body, evidence, requirements: keywords.slice(0, 5) },
      { name: "closing", text: closing, evidence: [], requirements: [] },
    ],
    warnings: [
      "This first draft is generated from the text you provided. Review every claim before sending.",
      ...(candidate ? [] : ["Add your name before exporting the letter."]),
    ],
    missingEvidence,
  });

  req.log.info({ resumeLength: input.resumeText.length, jobLength: input.jobDescription.length }, "Generated cover letter draft");
  res.json(result);
});

export default router;