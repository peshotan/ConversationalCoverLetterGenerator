type PdfTextItem = { str: string; hasEOL?: boolean };
type PdfPage = {
  getTextContent: () => Promise<{ items: unknown[] }>;
  cleanup?: () => void;
};
export type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  cleanup: () => void;
};

export function normalizePdfText(value: string): string {
  return value
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractTextFromPdfDocument(document: PdfDocument): Promise<string> {
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    let pageText = "";

    for (const item of content.items) {
      if (typeof item === "object" && item !== null && "str" in item) {
        const textItem = item as PdfTextItem;
        pageText += `${textItem.str}${textItem.hasEOL ? "\n" : " "}`;
      }
    }

    pages.push(normalizePdfText(pageText));
    page.cleanup?.();
  }

  return pages.filter(Boolean).join("\n\n");
}