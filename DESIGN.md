# Conversational Cover Letter Generator

## 1. Product direction

Conversational Cover Letter Generator turns a resume and a job description into a credible, tailored cover letter without inventing experience. The product should feel like a thoughtful writing partner: it extracts the user's strongest evidence, explains the match, drafts the letter, and lets the user revise it in plain language.

### Core promise

> Give me the job and my experience; help me tell the most relevant, honest story.

### Primary user

Job seekers applying to knowledge-work roles who already have a resume but spend too much time rewriting the same cover letter for each application.

### Design principles

1. **Evidence before eloquence** — every meaningful claim should trace back to the resume or be clearly marked as a suggestion.
2. **Conversational, not bureaucratic** — users should be able to say “make this warmer” or “focus more on leadership.”
3. **Useful defaults, visible control** — generate a strong first draft quickly, while keeping tone, length, and emphasis adjustable.
4. **No fabricated qualifications** — never add a skill, employer, credential, metric, or achievement not supported by the supplied material.
5. **Respect sensitive career data** — make upload, processing, retention, and deletion behavior clear.

## 2. Brainstormed product ideas

### MVP candidates

- Resume input by pasted text or PDF upload.
- Job description text area with character count and paste-friendly formatting.
- Optional fields: company name, role title, recipient name, tone, and length.
- Resume parsing into a readable “experience snapshot.”
- Job description extraction: responsibilities, required skills, preferred skills, and company signals.
- Tailored cover letter generation with a concise rationale.
- Inline editing and regeneration by instruction.
- Copy, download as `.txt`/`.docx`, and start-over actions.
- Match/evidence panel showing resume passages used for each section.

### High-value follow-on ideas

- Multiple letter styles: direct, warm, confident, academic, and concise.
- “Missing evidence” warnings for important job requirements.
- A job-specific bullet bank for interview preparation.
- Version history for applications.
- Saved reusable resume profiles, only after users explicitly opt in.
- ATS-friendly formatting mode with a visible plain-text preview.
- Quality checks for clichés, repetition, unsupported claims, and excessive length.
- Conversational interview mode that asks one or two targeted questions before drafting.

### Ideas deliberately deferred

- Auto-applying to jobs.
- Scraping job boards.
- Automatic resume rewriting.
- Social profiles and third-party account connections.
- A dashboard for tracking every application.

These expand scope and introduce additional privacy, accuracy, and integration concerns before the core writing experience is proven.

## 3. User experience

### Main flow

1. **Welcome / input**
   - Paste resume or upload one PDF.
   - Paste the job description.
   - Optional role/company details.
   - Choose tone and approximate length.
2. **Review extracted context**
   - Show detected name, experience, skills, education, and selected accomplishments.
   - Allow the user to correct or remove parsed content.
3. **Generate**
   - Show a short progress state with meaningful stages: reading resume, finding relevant evidence, drafting.
4. **Editor**
   - Editable letter on the left.
   - Match insights on the right: requirements addressed, evidence used, and gaps.
   - Conversational instruction box for revisions.
5. **Export**
   - Copy to clipboard.
   - Download a clean text document.
   - Reset inputs and begin another application.

### Important empty and error states

- No resume text detected in PDF: ask the user to paste the resume instead.
- Job description too short: explain that more context will improve tailoring.
- Unsupported or oversized file: state the accepted PDF limit.
- Generation failure: preserve all inputs and offer retry.
- Unsupported claim detected: flag it and provide a safer rewrite.

## 4. Functional requirements

### Inputs

- Resume pasted as text.
- Resume uploaded as PDF.
- Job description pasted as text.
- Optional company, role, recipient, tone, and length.

### Generation

- Produce a complete, professional cover letter.
- Use only supplied evidence.
- Address the most relevant job requirements.
- Avoid repeating the resume verbatim.
- Include placeholders only when necessary, clearly marked.
- Return structured metadata for evidence and warnings.

### Editing

- Direct text editing.
- Revision instruction in natural language.
- Regenerate selected section or full letter.
- Preserve the latest draft in the current session.

### Privacy

- Do not retain uploaded resume content beyond the active session by default.
- Provide a visible delete/reset action.
- Do not use resume content for unrelated purposes.
- Avoid logging raw resume text or generated letters.

## 5. Technical direction

The durable implementation should be a full web app rather than a static page:

- **Frontend:** React with a polished two-panel editor experience.
- **Backend:** server API for PDF text extraction and model requests.
- **Validation:** schema-validated request and response objects.
- **Storage:** no persistent resume storage for MVP; temporary processing only.
- **Authentication:** defer until saved profiles or history are introduced.
- **Export:** client-side text export first; add DOCX after the core flow is stable.

### Suggested generation contract

```json
{
  "letter": "string",
  "sections": [
    {
      "name": "opening|evidence|closing",
      "text": "string",
      "evidence": ["string"],
      "requirements": ["string"]
    }
  ],
  "warnings": ["string"],
  "missingEvidence": ["string"]
}
```

### Trust and quality safeguards

- Keep source resume text and job description separate in the prompt payload.
- Explicitly instruct the model not to infer unsupported facts.
- Run a post-generation check for names, employers, dates, metrics, and skills not found in inputs.
- Show a warning when the draft contains a claim that cannot be traced to source text.
- Let users edit before copying or exporting.

## 6. Success criteria

### MVP success

- A user can go from raw inputs to a usable draft in under two minutes.
- The letter is visibly tailored to the job, not a generic template.
- Users understand why specific experience was selected.
- Unsupported claims are prevented or clearly surfaced.
- Resetting the session removes the sensitive working data.

### Product signals to measure later

- Generation completion rate.
- Time from input to first accepted draft.
- Number of revision turns per letter.
- Copy/export rate.
- Unsupported-claim warning rate.
- Percentage of users who report the draft needed only light editing.

## 7. Recommended build sequence

1. Build the input and review screens with pasted resume text.
2. Add generation with structured evidence metadata.
3. Add the editor and conversational revisions.
4. Add PDF extraction and robust file errors.
5. Add copy/download and quality warnings.
6. Polish responsive behavior, accessibility, and privacy messaging.
7. Consider saved profiles and DOCX export only after the core loop feels excellent.