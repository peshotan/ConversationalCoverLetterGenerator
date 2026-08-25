import { describe, expect, it } from "vitest";
import { findUnsupportedEvidence } from "../artifacts/api-server/src/lib/cover-letter-utils";

describe("cover letter evidence helpers", () => {
  it("identifies evidence that is not present in the resume", () => {
    const sections = [
      { evidence: ["Built REST APIs", "Managed a $2M budget"] },
    ];

    expect(findUnsupportedEvidence(sections, "Built REST APIs for a cloud platform.")).toEqual(["Managed a $2M budget"]);
  });

  it("matches evidence without treating capitalization as a mismatch", () => {
    const sections = [{ evidence: ["REST APIs", "TypeScript Services"] }];

    expect(findUnsupportedEvidence(sections, "Built REST APIs and TypeScript services.")).toEqual([]);
  });
});