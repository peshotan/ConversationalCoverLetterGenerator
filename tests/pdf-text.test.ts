import { describe, expect, it } from "vitest";
import { extractTextFromPdfDocument, normalizePdfText, type PdfDocument } from "../artifacts/conversational-cover-letter-generator/src/lib/pdf-text-utils";

describe("PDF text extraction", () => {
  it("normalizes spacing without exposing PDF syntax", () => {
    expect(normalizePdfText(" Ada   Lovelace \n\n\n Software Engineer ")).toBe("Ada Lovelace \n\n Software Engineer");
    expect(normalizePdfText("Ada Lovelace /XRef endobj")).toContain("Ada Lovelace");
  });

  it("joins text items page by page and preserves explicit line breaks", async () => {
    const pages = [
      [{ str: "Ada Lovelace", hasEOL: true }, { str: "Software Engineer", hasEOL: false }],
      [{ str: "Built TypeScript services", hasEOL: true }],
    ];
    const document: PdfDocument = {
      numPages: pages.length,
      getPage: async (pageNumber) => ({
        getTextContent: async () => ({ items: pages[pageNumber - 1] }),
        cleanup: () => undefined,
      }),
      cleanup: () => undefined,
    };

    await expect(extractTextFromPdfDocument(document)).resolves.toBe(
      "Ada Lovelace\nSoftware Engineer\n\nBuilt TypeScript services",
    );
  });
});