import { describe, it, expect } from "vitest";
import { screenReview, screenReviewSchema } from "../screen-review";

const sources = import.meta.glob<string>(
  "../../components/screen-review/*.tsx",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

describe("Blender comparison boundary", () => {
  it("keeps the comparison offline and configuration-owned", () => {
    expect(Object.keys(sources)).toHaveLength(1);
    for (const source of Object.values(sources)) {
      expect(source).not.toMatch(
        /https?:\/\/|import\.meta\.env|process\.env|localStorage|sessionStorage|dangerouslySetInnerHTML/,
      );
      expect(source).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
      expect(source).not.toMatch(
        /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk|sk-or-v1)-[A-Za-z0-9_-]{16,}/,
      );
      expect(source).toContain("@/content/screen-review");
    }
  });
  it("preserves the original and uses a distinct composite", () => {
    expect(screenReview.original).toContain("connected-care-v1.mp4");
    expect(screenReview.composite).not.toBe(screenReview.original);
    expect(screenReview.notice).toContain(
      "homepage still uses your accepted original",
    );
  });
  it("rejects remote and traversing film paths", () => {
    for (const composite of [
      "https://example.test/movie.mp4",
      "/media/../private.mp4",
    ])
      expect(
        screenReviewSchema.safeParse({ ...screenReview, composite }).success,
      ).toBe(false);
  });
  it("rejects unreachable comparison timestamps", () => {
    expect(
      screenReviewSchema.safeParse({ ...screenReview, initialTime: 99 })
        .success,
    ).toBe(false);
    expect(
      screenReviewSchema.safeParse({ ...screenReview, entranceTime: 99 })
        .success,
    ).toBe(false);
  });
  it("rejects misleading identical before and after", () => {
    expect(
      screenReviewSchema.safeParse({
        ...screenReview,
        composite: screenReview.original,
      }).success,
    ).toBe(false);
  });
  it("rejects missing disclosure and invalid seek tuning", () => {
    expect(
      screenReviewSchema.safeParse({ ...screenReview, notice: "" }).success,
    ).toBe(false);
    expect(
      screenReviewSchema.safeParse({ ...screenReview, seekStep: 0 }).success,
    ).toBe(false);
  });
});
