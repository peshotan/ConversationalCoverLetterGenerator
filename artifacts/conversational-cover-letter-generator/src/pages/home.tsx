import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  FileText,
  Info,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Upload,
  WandSparkles,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  useGenerateCoverLetter,
  useHealthCheck,
  type CoverLetterInput,
  type CoverLetterResult,
  type CoverLetterSection,
} from "@workspace/api-client-react";

type FormState = {
  resumeText: string;
  jobDescription: string;
  companyName: string;
  roleTitle: string;
  recipientName: string;
  tone: NonNullable<CoverLetterInput["tone"]>;
  length: NonNullable<CoverLetterInput["length"]>;
  extraContext: string;
};

const initialForm: FormState = {
  resumeText: "",
  jobDescription: "",
  companyName: "",
  roleTitle: "",
  recipientName: "",
  tone: "warm",
  length: "standard",
  extraContext: "",
};

const toneOptions: Array<{ value: FormState["tone"]; label: string; description: string }> = [
  { value: "warm", label: "Warm", description: "Human and thoughtful" },
  { value: "professional", label: "Professional", description: "Polished and measured" },
  { value: "confident", label: "Confident", description: "Clear and assured" },
  { value: "direct", label: "Direct", description: "Lean and purposeful" },
];

const lengthOptions: Array<{ value: FormState["length"]; label: string; detail: string }> = [
  { value: "concise", label: "Concise", detail: "2–3 paragraphs" },
  { value: "standard", label: "Standard", detail: "3–4 paragraphs" },
  { value: "detailed", label: "Detailed", detail: "4–5 paragraphs" },
];

function countWords(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function sectionTitle(name: CoverLetterSection["name"]) {
  if (name === "opening") return "Opening";
  if (name === "evidence") return "Relevant evidence";
  return "Closing";
}

function formatError(error: unknown) {
  const possibleError = error as { response?: { data?: { error?: string } }; message?: string };
  return possibleError.response?.data?.error || possibleError.message || "Something got in the way. Please try again.";
}

function extractPdfText(buffer: ArrayBuffer) {
  const decoded = new TextDecoder("latin1").decode(buffer);
  const fragments = decoded.match(/[A-Za-z][A-Za-z0-9,.;:'"()/%&+\- ]{18,}/g) || [];
  return fragments
    .map((fragment) => fragment.replace(/\s+/g, " ").trim())
    .filter((fragment) => !fragment.includes("endstream") && !fragment.includes("obj"))
    .slice(0, 120)
    .join("\n");
}

function StatusMark() {
  const health = useHealthCheck();
  const isOnline = health.isSuccess && health.data?.status === "ok";
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.74)] px-3 py-1.5 text-xs text-[hsl(var(--muted-foreground))]" data-testid="status-service">
      <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-[hsl(var(--accent-foreground))]" : health.isLoading ? "bg-[hsl(var(--muted-foreground))] animate-pulse" : "bg-[hsl(var(--destructive))]"}`} />
      {isOnline ? "Writing desk is ready" : health.isLoading ? "Checking desk" : "Desk needs attention"}
    </div>
  );
}

function FieldLabel({ htmlFor, children, optional = false }: { htmlFor: string; children: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
      <span>{children}</span>
      {optional && <span className="font-normal normal-case tracking-normal text-[hsl(var(--muted-foreground)/0.76)]">Optional</span>}
    </label>
  );
}

function TextCount({ value, minimum }: { value: string; minimum: number }) {
  const count = countWords(value);
  const isEnough = value.trim().length >= minimum;
  return (
    <span className={`font-mono text-[10px] ${isEnough ? "text-[hsl(var(--accent-foreground))]" : "text-[hsl(var(--muted-foreground))]"}`} data-testid="text-word-count">
      {count} words {minimum > 0 && <span className="ml-1 opacity-70">/ {minimum} chars min</span>}
    </span>
  );
}

function EmptyDesk({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/0.5)] px-6 py-14 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">
        <FileText size={28} strokeWidth={1.45} />
      </div>
      <p className="mb-2 font-serif text-3xl text-[hsl(var(--foreground))]">Your draft will live here.</p>
      <p className="max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">
        Bring the raw materials. We’ll help you decide which parts of your experience deserve the page.
      </p>
      <button type="button" onClick={onStart} className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-0.5 active:translate-y-0" data-testid="button-start-draft">
        Start with your materials <ArrowRight size={16} />
      </button>
    </div>
  );
}

function LoadingDraft() {
  return (
    <div className="paper-shadow min-h-[610px] rounded-[3px] bg-[hsl(var(--card))] p-7 sm:p-12" data-testid="status-generating">
      <div className="mb-10 flex items-center justify-between border-b border-[hsl(var(--border))] pb-5">
        <div className="h-3 w-28 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
        <div className="h-3 w-20 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
      </div>
      <div className="space-y-5">
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
        <div className="h-3 w-full animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
        <div className="h-3 w-11/12 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
        <div className="h-3 w-4/5 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
        <div className="mt-10 h-3 w-full animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
        <div className="h-3 w-full animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
        <div className="h-3 w-10/12 animate-pulse rounded-full bg-[hsl(var(--secondary))]" />
      </div>
      <div className="mt-16 flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
        <span className="h-1.5 w-16 origin-left animate-pulse-line rounded-full bg-[hsl(var(--accent))]" />
        Reading for signal, not keywords
      </div>
    </div>
  );
}

function SourcePill({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--secondary))] px-2.5 py-1 font-mono text-[10px] text-[hsl(var(--foreground)/0.76)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent-foreground))]" />
      {children}
    </span>
  );
}

function ResultView({ result, input, onReset }: { result: CoverLetterResult; input: FormState; onReset: () => void }) {
  const [letter, setLetter] = useState(result.letter);
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(true);

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(letter);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const blob = new Blob([letter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(input.roleTitle || "cover-letter").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const evidenceCount = result.sections.reduce((total, section) => total + section.evidence.length, 0);
  return (
    <div className="animate-rise-in space-y-6" data-testid="section-generated-result">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent-foreground))]">Draft / first pass</p>
          <h2 className="font-serif text-4xl leading-none text-[hsl(var(--foreground))] sm:text-5xl">A letter with a point of view.</h2>
          <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
            {input.roleTitle || "Your target role"}{input.companyName ? ` at ${input.companyName}` : ""} · {evidenceCount} evidence links found
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleCopy} className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2 text-sm font-semibold text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--secondary))]" data-testid="button-copy-letter">
            {copied ? <Check size={15} /> : <Clipboard size={15} />} {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={handleDownload} className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2 text-sm font-semibold text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--secondary))]" data-testid="button-download-letter">
            <ArrowDownToLine size={15} /> Download .txt
          </button>
          <button type="button" onClick={onReset} className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]" data-testid="button-reset-top">
            <RotateCcw size={15} /> Start over
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="paper-shadow rounded-[3px] bg-[hsl(var(--card))] p-6 sm:p-12">
          <div className="mb-9 flex items-start justify-between border-b border-[hsl(var(--border))] pb-5">
            <div>
              <p className="font-serif text-2xl text-[hsl(var(--foreground))]">{input.companyName || "The hiring team"}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">Cover letter · editable draft</p>
            </div>
            <span className="rounded-full bg-[hsl(var(--secondary))] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">v1</span>
          </div>
          <textarea
            value={letter}
            onChange={(event) => setLetter(event.target.value)}
            className="min-h-[570px] w-full resize-y border-0 bg-transparent font-serif text-[19px] leading-[1.78] text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))] sm:text-[20px]"
            data-testid="textarea-generated-letter"
            aria-label="Editable generated cover letter"
          />
          <div className="mt-5 flex items-center justify-between border-t border-[hsl(var(--border))] pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
            <span data-testid="text-letter-word-count">{countWords(letter)} words</span>
            <span>Edits stay in your browser</span>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.76)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--accent-foreground))]">Editor’s notes</p>
                <h3 className="mt-1 font-serif text-2xl">Why this works</h3>
              </div>
              <Sparkles size={18} className="text-[hsl(var(--accent-foreground))]" />
            </div>
            <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              Every highlighted thread below is tied back to something you supplied. No invented metrics, titles, or experience.
            </p>
            <button type="button" onClick={() => setShowSources((current) => !current)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--primary))] hover:underline" data-testid="button-toggle-evidence">
              {showSources ? "Hide" : "Show"} evidence trail <ArrowRight size={13} />
            </button>
          </div>

          {showSources && result.sections.map((section, index) => (
            <div key={`${section.name}-${index}`} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.65)] p-4 transition-transform hover:-translate-y-0.5" data-testid={`card-section-${section.name}`}>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--secondary))] font-mono text-[10px] text-[hsl(var(--primary))]">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="text-sm font-semibold">{sectionTitle(section.name)}</h3>
              </div>
              <p className="mb-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{section.text}</p>
              <div className="flex flex-wrap gap-1.5">
                {section.evidence.map((evidence, evidenceIndex) => <SourcePill key={`${evidence}-${evidenceIndex}`}>{evidence}</SourcePill>)}
                {section.requirements.map((requirement, requirementIndex) => <span key={`${requirement}-${requirementIndex}`} className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-2 py-1 font-mono text-[10px] text-[hsl(var(--muted-foreground))]"><Check size={10} /> {requirement}</span>)}
              </div>
            </div>
          ))}
        </aside>
      </div>

      {(result.warnings.length > 0 || result.missingEvidence.length > 0) && (
        <div className="rounded-2xl border border-[hsl(36_74%_61%/0.5)] bg-[hsl(36_74%_61%/0.12)] p-5 sm:p-6" data-testid="panel-missing-evidence">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(36_74%_61%/0.23)] text-[hsl(30_52%_30%)]"><AlertTriangle size={18} /></div>
            <div className="flex-1">
              <h3 className="font-semibold text-[hsl(var(--foreground))]">A few honest gaps to look at</h3>
              <p className="mt-1 text-sm leading-6 text-[hsl(var(--foreground)/0.72)]">These are not flaws in your application. They are places where more detail could make your story more specific.</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {[...result.missingEvidence, ...result.warnings].map((warning, index) => <li key={`${warning}-${index}`} className="flex gap-2 text-sm text-[hsl(var(--foreground)/0.84)]" data-testid={`text-warning-${index}`}><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[hsl(30_52%_30%)]" />{warning}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<CoverLetterResult | null>(null);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateCoverLetter = useGenerateCoverLetter();

  const canSubmit = useMemo(() => form.resumeText.trim().length >= 80 && form.jobDescription.trim().length >= 80, [form.resumeText, form.jobDescription]);
  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm((current) => ({ ...current, [field]: value }));

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")
        ? await file.text()
        : extractPdfText(await file.arrayBuffer());
      if (text.trim().length > 20) {
        updateField("resumeText", text);
      } else {
        setError("This PDF has no selectable text. Paste the resume text below so the editor can work from the actual details.");
      }
    } catch {
      setError("We couldn’t read that file in the browser. Paste the resume text below instead.");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!canSubmit) {
      setError("Add at least 80 characters to both your resume and the job description before generating.");
      return;
    }
    const payload: CoverLetterInput = {
      resumeText: form.resumeText.trim(),
      jobDescription: form.jobDescription.trim(),
      companyName: form.companyName.trim() || null,
      roleTitle: form.roleTitle.trim() || null,
      recipientName: form.recipientName.trim() || null,
      tone: form.tone,
      length: form.length,
      extraContext: form.extraContext.trim() || null,
    };
    generateCoverLetter.mutate({ data: payload }, {
      onSuccess: (generated) => setResult(generated),
      onError: (requestError) => setError(formatError(requestError)),
    });
  };

  const reset = () => {
    setForm(initialForm);
    setResult(null);
    setError("");
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (result) {
    return (
      <main className="min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
        <header className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <button type="button" onClick={reset} className="group flex items-center gap-3 text-left" data-testid="button-brand-reset">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] transition-transform group-hover:rotate-[-6deg]"><WandSparkles size={17} /></span>
            <span><span className="block font-semibold tracking-[-0.02em]">Draftwell</span><span className="block font-mono text-[9px] uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">a writing partner</span></span>
          </button>
          <StatusMark />
        </header>
        <div className="mx-auto max-w-[1440px] px-5 pb-16 sm:px-8 lg:px-12">
          <ResultView result={result} input={form} onReset={reset} />
        </div>
      </main>
    );
  }

  return (
    <main className="desk-grid min-h-[100dvh] text-[hsl(var(--foreground))]">
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3" data-testid="brand-draftwell">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><WandSparkles size={17} /></span>
          <span><span className="block font-semibold tracking-[-0.02em]">Draftwell</span><span className="block font-mono text-[9px] uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">a writing partner</span></span>
        </div>
        <StatusMark />
      </header>

      <section className="mx-auto max-w-[1440px] px-5 pb-8 pt-10 sm:px-8 sm:pt-16 lg:px-12 lg:pb-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(500px,1.18fr)] lg:items-end lg:gap-20">
          <div className="max-w-xl animate-rise-in">
            <p className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--accent-foreground))]"><span className="h-px w-8 bg-[hsl(var(--accent-foreground))]" /> The thoughtful first draft</p>
            <h1 className="text-balance font-serif text-[clamp(3.5rem,7vw,6.5rem)] leading-[0.88] tracking-[-0.045em] text-[hsl(var(--foreground))]">Tell the part of your story that matters.</h1>
            <p className="mt-7 max-w-md text-[15px] leading-7 text-[hsl(var(--muted-foreground))]">Draftwell reads your experience beside the role, then helps you make the strongest honest case — with the receipts to prove it.</p>
            <div className="mt-8 flex items-center gap-5 text-xs text-[hsl(var(--muted-foreground))]">
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[hsl(var(--accent-foreground))]" /> Evidence-led</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[hsl(var(--accent-foreground))]" /> Yours to edit</span>
            </div>
          </div>
          <div className="relative hidden min-h-[205px] lg:block" aria-hidden="true">
            <div className="absolute right-[7%] top-0 h-44 w-44 rounded-full border border-[hsl(var(--accent)/0.25)]" />
            <div className="absolute right-[14%] top-7 h-32 w-32 rounded-full border border-dashed border-[hsl(var(--accent)/0.42)]" />
            <div className="absolute right-[23%] top-14 flex h-20 w-20 rotate-6 items-center justify-center rounded-2xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-lg shadow-[hsl(var(--accent)/0.2)]"><Sparkles size={28} strokeWidth={1.4} /></div>
            <div className="absolute bottom-4 right-0 font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">Resume → signal → story</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 pb-20 sm:px-8 lg:px-12">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,0.82fr)_minmax(500px,1.18fr)] lg:gap-20">
          <form onSubmit={handleSubmit} className="animate-rise-in rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.8)] p-5 shadow-[0_18px_50px_-35px_hsl(var(--primary)/0.45)] sm:p-7" style={{ animationDelay: "100ms" }} data-testid="form-cover-letter-input">
            <div className="mb-7 flex items-start justify-between border-b border-[hsl(var(--border))] pb-5">
              <div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--accent-foreground))]">01 / Materials</p><h2 className="mt-1 font-serif text-3xl">Start at the source.</h2></div>
              <span className="rounded-full bg-[hsl(var(--secondary))] px-2.5 py-1 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">Private by design</span>
            </div>

            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between"><FieldLabel htmlFor="resume-text">Your resume</FieldLabel><TextCount value={form.resumeText} minimum={80} /></div>
                <textarea id="resume-text" value={form.resumeText} onChange={(event) => updateField("resumeText", event.target.value)} placeholder="Paste the text from your resume here…" className="min-h-[160px] w-full resize-y rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background)/0.62)] p-3.5 text-sm leading-6 outline-none transition-shadow placeholder:text-[hsl(var(--muted-foreground)/0.75)] focus:border-[hsl(var(--accent-foreground))] focus:ring-4 focus:ring-[hsl(var(--accent)/0.14)]" data-testid="textarea-resume" />
                <input ref={fileInputRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={handleFile} className="hidden" data-testid="input-resume-file" />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--primary))] transition-colors hover:text-[hsl(var(--accent-foreground))]" data-testid="button-upload-resume"><Upload size={14} /> Upload PDF or text</button>
                  {fileName && <span className="flex min-w-0 items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground))]" data-testid="text-uploaded-file"><FileText size={12} /><span className="truncate">{fileName}</span><button type="button" onClick={() => { setFileName(""); updateField("resumeText", ""); if (fileInputRef.current) fileInputRef.current.value = ""; }} aria-label="Remove uploaded resume" data-testid="button-remove-file"><X size={13} /></button></span>}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between"><FieldLabel htmlFor="job-description">Job description</FieldLabel><TextCount value={form.jobDescription} minimum={80} /></div>
                <textarea id="job-description" value={form.jobDescription} onChange={(event) => updateField("jobDescription", event.target.value)} placeholder="Paste the role, responsibilities, and what they’re looking for…" className="min-h-[160px] w-full resize-y rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background)/0.62)] p-3.5 text-sm leading-6 outline-none transition-shadow placeholder:text-[hsl(var(--muted-foreground)/0.75)] focus:border-[hsl(var(--accent-foreground))] focus:ring-4 focus:ring-[hsl(var(--accent)/0.14)]" data-testid="textarea-job-description" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div><FieldLabel htmlFor="company-name" optional>Company</FieldLabel><input id="company-name" value={form.companyName} onChange={(event) => updateField("companyName", event.target.value)} placeholder="e.g. Northstar Health" className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background)/0.62)] px-3.5 py-3 text-sm outline-none transition-shadow placeholder:text-[hsl(var(--muted-foreground)/0.75)] focus:border-[hsl(var(--accent-foreground))] focus:ring-4 focus:ring-[hsl(var(--accent)/0.14)]" data-testid="input-company-name" /></div>
                <div><FieldLabel htmlFor="role-title" optional>Role title</FieldLabel><input id="role-title" value={form.roleTitle} onChange={(event) => updateField("roleTitle", event.target.value)} placeholder="e.g. Senior Product Designer" className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background)/0.62)] px-3.5 py-3 text-sm outline-none transition-shadow placeholder:text-[hsl(var(--muted-foreground)/0.75)] focus:border-[hsl(var(--accent-foreground))] focus:ring-4 focus:ring-[hsl(var(--accent)/0.14)]" data-testid="input-role-title" /></div>
                <div><FieldLabel htmlFor="recipient-name" optional>Address it to</FieldLabel><input id="recipient-name" value={form.recipientName} onChange={(event) => updateField("recipientName", event.target.value)} placeholder="e.g. Maya Chen" className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background)/0.62)] px-3.5 py-3 text-sm outline-none transition-shadow placeholder:text-[hsl(var(--muted-foreground)/0.75)] focus:border-[hsl(var(--accent-foreground))] focus:ring-4 focus:ring-[hsl(var(--accent)/0.14)]" data-testid="input-recipient-name" /></div>
                <div><FieldLabel htmlFor="extra-context" optional>One more thing</FieldLabel><input id="extra-context" value={form.extraContext} onChange={(event) => updateField("extraContext", event.target.value)} placeholder="A referral, motivation, or constraint" className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background)/0.62)] px-3.5 py-3 text-sm outline-none transition-shadow placeholder:text-[hsl(var(--muted-foreground)/0.75)] focus:border-[hsl(var(--accent-foreground))] focus:ring-4 focus:ring-[hsl(var(--accent)/0.14)]" data-testid="input-extra-context" /></div>
              </div>

              <div>
                <FieldLabel htmlFor="tone-warm">Voice</FieldLabel>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {toneOptions.map((tone) => <button key={tone.value} id={`tone-${tone.value}`} type="button" onClick={() => updateField("tone", tone.value)} className={`rounded-xl border px-3 py-2.5 text-left transition-all ${form.tone === tone.value ? "border-[hsl(var(--accent-foreground))] bg-[hsl(var(--accent)/0.16)] shadow-sm" : "border-[hsl(var(--border))] bg-transparent hover:bg-[hsl(var(--secondary))]"}`} data-testid={`button-tone-${tone.value}`}><span className="block text-xs font-semibold">{tone.label}</span><span className="mt-0.5 block text-[10px] text-[hsl(var(--muted-foreground))]">{tone.description}</span></button>)}
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="length-standard">Length</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {lengthOptions.map((length) => <button key={length.value} id={`length-${length.value}`} type="button" onClick={() => updateField("length", length.value)} className={`rounded-lg border px-3 py-2 text-left transition-all ${form.length === length.value ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "border-[hsl(var(--border))] bg-transparent hover:bg-[hsl(var(--secondary))]"}`} data-testid={`button-length-${length.value}`}><span className="mr-2 text-xs font-semibold">{length.label}</span><span className={`text-[10px] ${form.length === length.value ? "text-[hsl(var(--primary-foreground)/0.7)]" : "text-[hsl(var(--muted-foreground))]"}`}>{length.detail}</span></button>)}
                </div>
              </div>
            </div>

            {error && <div className="mt-5 flex gap-2 rounded-xl border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.08)] p-3 text-sm leading-5 text-[hsl(var(--destructive))]" role="alert" data-testid="alert-generation-error"><Info size={16} className="mt-0.5 shrink-0" />{error}</div>}

            <div className="mt-7 flex flex-col gap-3 border-t border-[hsl(var(--border))] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xs text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">We’ll flag missing proof instead of filling gaps with made-up claims.</p>
              <button type="submit" disabled={generateCoverLetter.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[hsl(var(--primary)/0.18)] active:translate-y-0 disabled:cursor-wait disabled:opacity-70" data-testid="button-generate-letter">
                {generateCoverLetter.isPending ? <><LoaderCircle size={16} className="animate-spin" /> Finding the thread…</> : <><Sparkles size={16} /> Draft my letter</>}
              </button>
            </div>
          </form>

          <div className="animate-rise-in lg:pt-7" style={{ animationDelay: "180ms" }}>
            {generateCoverLetter.isPending ? <LoadingDraft /> : <EmptyDesk onStart={() => document.getElementById("resume-text")?.focus()} />}
            <div className="mt-5 flex items-start gap-2 px-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]"><Info size={14} className="mt-0.5 shrink-0 text-[hsl(var(--accent-foreground))]" /> A good cover letter doesn’t repeat your resume. It interprets it for this particular reader.</div>
          </div>
        </div>
      </section>
      <footer className="mx-auto flex max-w-[1440px] flex-col gap-2 border-t border-[hsl(var(--border)/0.7)] px-5 py-6 text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <span>Draftwell / 2024</span><span>Good work deserves the right words.</span>
      </footer>
    </main>
  );
}