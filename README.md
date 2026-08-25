# Conversational Cover Letter Generator

Create a tailored, honest cover letter from a resume and a job description.

## Product overview

Conversational Cover Letter Generator is a focused writing assistant for job seekers. Users can paste their resume or upload a PDF, paste a job description, and generate a cover letter grounded in their actual experience.

The app is designed around a simple principle: **evidence before eloquence**. It should explain which experience was used, identify important requirements without supporting evidence, and avoid inventing qualifications.

## Planned MVP

- Paste resume text or upload one PDF
- Paste a job description
- Optional role, company, recipient, tone, and length controls
- Generate a tailored cover letter
- Show evidence and missing-support insights
- Edit the result conversationally
- Copy or download the finished letter
- Reset the session and clear working data

See [DESIGN.md](./DESIGN.md) for the product brainstorm, UX flow, requirements, technical direction, and build sequence.

## Why this is different

Most cover-letter generators optimize for polished-sounding paragraphs. This app will optimize for **credible relevance**:

- It uses the user's supplied resume as the source of truth.
- It maps letter sections to job requirements.
- It flags unsupported claims instead of quietly making them up.
- It keeps the workflow fast enough to use for every application.

## Development status

Initial product design and project documentation are complete. The application implementation is next.

## Planned stack

- React frontend
- Server API for PDF extraction and AI generation
- Schema-validated generation responses
- Temporary, session-scoped processing for resume data

The exact implementation stack may evolve as the first working flow is built.

## Privacy direction

Resume and job-description content are sensitive career data. The MVP should avoid persistent storage by default, provide a clear reset action, and avoid logging raw user content.

## Getting started

Implementation instructions will be added once the application scaffold is created.

## License

License to be selected when the initial implementation is published.