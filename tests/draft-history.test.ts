import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearDrafts,
  deleteDraft,
  DraftHistoryUnavailableError,
  DraftHistoryImportError,
  importDraftHistory,
  listDrafts,
  parseDraftHistory,
  saveDraft,
  serializeDraft,
  serializeDraftHistory,
  updateDraft,
  type DraftRecord,
} from "../artifacts/conversational-cover-letter-generator/src/lib/draft-history";

type RequestHandler = (() => void) | null;

class FakeRequest {
  result: unknown;
  error: Error | null = null;
  onsuccess: RequestHandler = null;
  onerror: RequestHandler = null;

  succeed(result: unknown) {
    this.result = result;
    queueMicrotask(() => this.onsuccess?.());
  }
}

class FakeStore {
  constructor(private readonly records: Map<string, DraftRecord>, private readonly transaction: FakeTransaction) {}

  getAll() {
    const request = new FakeRequest();
    request.succeed([...this.records.values()]);
    return request as unknown as IDBRequest;
  }

  get(id: string) {
    const request = new FakeRequest();
    request.succeed(this.records.get(id));
    return request as unknown as IDBRequest;
  }

  put(record: DraftRecord) {
    const request = new FakeRequest();
    this.records.set(record.id, structuredClone(record));
    request.succeed(record.id);
    return request as unknown as IDBRequest;
  }

  delete(id: string) {
    const request = new FakeRequest();
    this.records.delete(id);
    request.succeed(undefined);
    return request as unknown as IDBRequest;
  }

  clear() {
    const request = new FakeRequest();
    this.records.clear();
    request.succeed(undefined);
    return request as unknown as IDBRequest;
  }
}

class FakeTransaction {
  oncomplete: RequestHandler = null;
  onerror: RequestHandler = null;
  onabort: RequestHandler = null;

  constructor(private readonly records: Map<string, DraftRecord>) {}

  objectStore() {
    return new FakeStore(this.records, this) as unknown as IDBObjectStore;
  }

  finish() {
    queueMicrotask(() => this.oncomplete?.());
  }
}

class FakeDatabase {
  objectStoreNames = { contains: () => true };

  constructor(private readonly records: Map<string, DraftRecord>) {}

  transaction() {
    const transaction = new FakeTransaction(this.records);
    const originalStore = transaction.objectStore.bind(transaction);
    transaction.objectStore = () => {
      const store = originalStore();
      const originalMethods = ["getAll", "get", "put", "delete", "clear"] as const;
      for (const method of originalMethods) {
        const original = store[method].bind(store);
        store[method] = ((...args: never[]) => {
          const request = original(...args);
          transaction.finish();
          return request;
        }) as never;
      }
      return store;
    };
    return transaction;
  }

  close() {}
}

class FakeIndexedDb {
  private readonly records = new Map<string, DraftRecord>();

  open() {
    const request = new FakeRequest() as FakeRequest & {
      onupgradeneeded: RequestHandler;
      onblocked: RequestHandler;
      result: FakeDatabase;
    };
    request.result = new FakeDatabase(this.records);
    request.onupgradeneeded = null;
    request.onblocked = null;
    queueMicrotask(() => {
      request.onupgradeneeded?.();
      queueMicrotask(() => request.onsuccess?.());
    });
    return request as unknown as IDBOpenDBRequest;
  }
}

const result = {
  letter: "Dear Hiring Team,\n\nA grounded draft.\n\nSincerely,\nPeshotan",
  sections: [
    {
      name: "opening" as const,
      text: "A focused opening.",
      evidence: ["Product strategy"],
      requirements: ["Clear communication"],
    },
  ],
  warnings: ["Add a measurable outcome."],
  missingEvidence: ["Team size is not specified."],
};

const form = {
  companyName: "Northstar Health",
  roleTitle: "Product Designer",
  recipientName: "Maya Chen",
  tone: "warm" as const,
  length: "standard" as const,
  useAiGeneratedContent: false,
};

describe("local draft history", () => {
  const originalIndexedDb = globalThis.indexedDB;

  beforeEach(() => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: new FakeIndexedDb(),
    });
  });

  afterEach(() => {
    if (originalIndexedDb) {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: originalIndexedDb });
    } else {
      delete (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    }
  });

  it("serializes generated content without source materials", () => {
    const draft = serializeDraft({
      result,
      letter: "Edited letter",
      form,
      id: "draft-safe",
      createdAt: 100,
      updatedAt: 200,
    });

    expect(draft).toEqual({
      id: "draft-safe",
      version: 1,
      createdAt: 100,
      updatedAt: 200,
      letter: "Edited letter",
      sections: result.sections,
      warnings: result.warnings,
      missingEvidence: result.missingEvidence,
      form,
    });
    expect(JSON.stringify(draft)).not.toContain("resumeText");
    expect(JSON.stringify(draft)).not.toContain("jobDescription");
    expect(JSON.stringify(draft)).not.toContain("resumePdfBase64");
  });

  it("round-trips exported history with the exact draft records", () => {
    const first = serializeDraft({
      result,
      letter: "First letter",
      form,
      id: "draft-first",
      createdAt: 100,
      updatedAt: 200,
    });
    const second = serializeDraft({
      result,
      letter: "Second letter",
      form: { ...form, tone: "confident" },
      id: "draft-second",
      createdAt: 300,
      updatedAt: 400,
    });

    const exported = serializeDraftHistory([first, second], 500);

    expect(parseDraftHistory(exported)).toEqual([first, second]);
    expect(JSON.parse(exported)).toEqual({
      format: "draftwell-history",
      version: 1,
      exportedAt: 500,
      drafts: [first, second],
    });
  });

  it.each([
    ["resume text", "resumeText", "A private resume"],
    ["job description", "jobDescription", "A private job description"],
    ["PDF data", "resumePdfBase64", "JVBERi0xLjQ="],
    ["credentials", "credentials", "a secret"],
  ])("rejects backups containing unknown %s fields", (_label, key, value) => {
    const draft = serializeDraft({
      result,
      letter: result.letter,
      form,
      id: "draft-with-sensitive-field",
      createdAt: 100,
      updatedAt: 100,
    });
    const backup = JSON.parse(serializeDraftHistory([draft])) as {
      drafts: Array<Record<string, unknown>>;
    };
    backup.drafts[0][key] = value;

    expect(() => parseDraftHistory(JSON.stringify(backup))).toThrow(DraftHistoryImportError);
  });

  it("does not change stored drafts when importing a malformed backup", async () => {
    const existing = serializeDraft({
      result,
      letter: "Keep this letter",
      form,
      id: "draft-existing",
      createdAt: 100,
      updatedAt: 100,
    });
    await saveDraft(existing);

    const malformed = JSON.parse(serializeDraftHistory([existing])) as {
      drafts: Array<Record<string, unknown>>;
    };
    malformed.drafts[0].jobDescription = "Do not store this";

    await expect(importDraftHistory(JSON.stringify(malformed))).rejects.toBeInstanceOf(DraftHistoryImportError);
    expect(await listDrafts()).toEqual([existing]);
  });

  it("skips existing and duplicate imported IDs without overwriting stored drafts", async () => {
    const existing = serializeDraft({
      result,
      letter: "Original stored letter",
      form,
      id: "draft-existing",
      createdAt: 100,
      updatedAt: 100,
    });
    const imported = serializeDraft({
      result,
      letter: "First imported letter",
      form,
      id: "draft-new",
      createdAt: 200,
      updatedAt: 200,
    });
    const duplicateExisting = serializeDraft({
      result,
      letter: "Replacement must be ignored",
      form,
      id: "draft-existing",
      createdAt: 300,
      updatedAt: 300,
    });
    const duplicateImported = serializeDraft({
      result,
      letter: "Duplicate imported letter must be ignored",
      form,
      id: "draft-new",
      createdAt: 400,
      updatedAt: 400,
    });
    await saveDraft(existing);

    const outcome = await importDraftHistory(
      serializeDraftHistory([duplicateExisting, imported, duplicateImported], 500),
    );

    expect(outcome.imported).toEqual([imported]);
    expect(outcome.skipped).toEqual([duplicateExisting, duplicateImported]);
    expect(await listDrafts()).toEqual([imported, existing]);
  });

  it("supports saving, listing, editing, deleting, and clearing drafts", async () => {
    const first = serializeDraft({ result, letter: result.letter, form, id: "draft-first", createdAt: 100, updatedAt: 100 });
    const second = serializeDraft({ result, letter: "Second letter", form, id: "draft-second", createdAt: 200, updatedAt: 300 });

    await saveDraft(first);
    await saveDraft(second);
    expect((await listDrafts()).map((draft) => draft.id)).toEqual(["draft-second", "draft-first"]);

    const edited = await updateDraft("draft-first", { letter: "Persisted edit" });
    expect(edited.letter).toBe("Persisted edit");
    expect((await listDrafts()).find((draft) => draft.id === "draft-first")?.letter).toBe("Persisted edit");

    await deleteDraft("draft-second");
    expect((await listDrafts()).map((draft) => draft.id)).toEqual(["draft-first"]);

    await clearDrafts();
    expect(await listDrafts()).toEqual([]);
  });

  it("reports unavailable storage instead of breaking generation", async () => {
    delete (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    await expect(listDrafts()).rejects.toBeInstanceOf(DraftHistoryUnavailableError);
  });
});