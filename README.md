# Conversational Cover Letter Generator

An evidence-grounded writing assistant that turns a resume and job description into an editable cover letter.

## Run it yourself

This section starts the app from a fresh checkout. The project uses two services:

- **API server** — receives resume and job-description input on port `8080`
- **Web app** — serves the Draftwell interface on port `22475`

### 1. Install prerequisites

Install:

- Node.js 24 or newer
- pnpm
- PostgreSQL, only if you plan to use the database tooling

Check your versions:

```bash
node --version
pnpm --version
```

### 2. Clone the repository and install dependencies

```bash
git clone https://github.com/peshotan/ConversationalCoverLetterGenerator.git
cd ConversationalCoverLetterGenerator
pnpm install
```

### 3. Configure environment variables

The server uses the following environment variable names for OpenAI access. Export them in the same terminal where you start the API server:

```bash
export AI_INTEGRATIONS_OPENAI_API_KEY="your-openai-api-key"
export AI_INTEGRATIONS_OPENAI_BASE_URL="https://api.openai.com/v1"
```

Use your real key only in your local shell, a password manager, or your hosting provider's secret manager. Do not paste it into this README, commit it to Git, or put it in a checked-in `.env` file. This project does not automatically load `.env` files.

The `Use AI-generated content` option is enabled from the web form. The deterministic no-AI draft still uses pasted resume text, while AI mode supports pasted text and direct PDF input.

If you are running the database commands, also set your PostgreSQL connection string:

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
```

The current MVP keeps resumes and generated letters in session-scoped client state, so `DATABASE_URL` is not needed for the basic cover-letter writing flow.

If you are running this inside Replit, provision the OpenAI AI integration or add these same variables through Secrets. Replit may provide the values automatically; never print or commit the secret value.

### 4. Start the API server

Open a terminal at the repository root and run:

```bash
export PORT=8080
pnpm --filter @workspace/api-server run dev
```

Leave this terminal running. A healthy server responds at:

```text
http://localhost:8080/api/healthz
```

### 5. Start the web app

Open a second terminal at the same repository root:

```bash
export PORT=22475
export BASE_PATH=/
pnpm --filter @workspace/conversational-cover-letter-generator run dev
```

Open `http://localhost:22475` in your browser.

When running in Replit, use the existing web preview. Replit's artifact routing connects the web app's `/api` requests to the API service. A plain local Vite server does not provide that cross-port `/api` routing by itself, so use a local reverse proxy or equivalent path router if the web page cannot reach `http://localhost:8080/api/healthz`.

### 6. Create your first draft

1. Paste at least 80 characters of resume text.
2. Paste at least 80 characters of job-description text.
3. Optionally enter the company, role, recipient, tone, and length.
4. Leave **Use AI-generated content** unchecked for the deterministic evidence-based draft.
5. Turn it on to use OpenAI. You can then upload a PDF, which is sent directly to the AI path rather than parsed into the resume text box.
6. Select **Draft my letter**.
7. Review the evidence links and warnings, edit the letter, then copy or download it.

### Useful commands

```bash
# Run tests
pnpm test

# Typecheck the workspace
pnpm run typecheck

# Build the API package
pnpm --filter @workspace/api-server run build

# Build the web package
PORT=22475 BASE_PATH=/ pnpm --filter @workspace/conversational-cover-letter-generator run build

# Regenerate typed API clients after editing the OpenAPI contract
pnpm --filter @workspace/api-spec run codegen
```

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