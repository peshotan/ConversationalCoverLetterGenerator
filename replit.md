# Conversational Cover Letter Generator

An evidence-grounded writing assistant that turns a resume and job description into an editable cover letter.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/conversational-cover-letter-generator/src/pages/home.tsx` — main input, generation, editing, and export experience
- `artifacts/conversational-cover-letter-generator/src/index.css` — shared visual theme and motion
- `artifacts/api-server/src/routes/cover-letter.ts` — resume/job-description generation endpoint
- `lib/api-spec/openapi.yaml` — source of truth for the generation contract
- `DESIGN.md` — product decisions, requirements, and build sequence

## Architecture decisions

- The MVP uses session-scoped client state and does not persist resumes or generated letters.
- PDF resumes are kept in session memory and sent directly to the AI path only when the user enables AI-generated content.
- The default generator is deterministic and evidence-based so the product remains usable without a model call.
- The API contract is generated from OpenAPI so the frontend and server share the same request and response types.

## Product

- Paste a resume and job description or upload a PDF/text resume.
- Set optional company, role, recipient, tone, and length details.
- Generate an editable cover letter with evidence links and missing-evidence warnings.
- Copy, download, or reset the current draft.

## User preferences

- Keep secrets and confidential data out of repositories.
- Use feature branches and open pull requests; never push directly to the default branch.

## Gotchas

- The generation endpoint requires at least 80 characters for both resume and job description.
- Artifact workflows provide `PORT` and `BASE_PATH`; do not hardcode them in the app.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
