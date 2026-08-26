import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearDrafts,
  deleteDraft,
  DraftHistoryUnavailableError,
  listDrafts,
  saveDraft,
  serializeDraft,
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