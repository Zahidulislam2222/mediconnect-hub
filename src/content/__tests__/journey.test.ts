import { describe, it, expect } from "vitest";
import { journeySchema, journey } from "../journey";

describe("connected-care content boundary", () => {
  it("contains all public and role destinations", () => {
    expect(journey.explore.roles.map((role) => role.id)).toEqual([
      "patient",
      "doctor",
      "staff",
    ]);
    expect(
      journey.articles.filter((item) => item.kind === "knowledge"),
    ).toHaveLength(6);
    expect(
      journey.articles.filter((item) => item.kind === "blog"),
    ).toHaveLength(3);
  });
  it("rejects missing article destinations", () => {
    expect(
      journeySchema.safeParse({
        ...journey,
        articles: journey.articles.filter((item) => item.kind !== "blog"),
      }).success,
    ).toBe(false);
  });
  it("rejects remote and traversing media", () => {
    for (const poster of [
      "https://example.test/video.webp",
      "/media/../private.webp",
    ]) {
      expect(
        journeySchema.safeParse({
          ...journey,
          media: { ...journey.media, poster },
        }).success,
      ).toBe(false);
    }
  });
  it("rejects falsely finished absent footage", () => {
    expect(
      journeySchema.safeParse({
        ...journey,
        media: { ...journey.media, finished: true, film: "" },
      }).success,
    ).toBe(false);
  });
  it("requires ordered well-spaced scene stops", () => {
    const stages = structuredClone(journey.stages);
    stages[2].at = 0.2;
    expect(journeySchema.safeParse({ ...journey, stages }).success).toBe(false);
  });
  it("rejects duplicate article slugs and roles", () => {
    expect(
      journeySchema.safeParse({
        ...journey,
        articles: [...journey.articles, journey.articles[0]],
      }).success,
    ).toBe(false);
    expect(
      journeySchema.safeParse({
        ...journey,
        explore: {
          ...journey.explore,
          roles: Array(3).fill(journey.explore.roles[0]),
        },
      }).success,
    ).toBe(false);
  });
  it("keeps clinical claims out of sample appointment content", () => {
    expect(journey.notice).toContain("No real appointments");
    expect(journey.notice).toContain("not a claim of regulatory certification");
    expect(journey.auth.notice).toContain("No credentials are sent or saved");
    expect(journey.workspace.callNotice).toContain(
      "No camera, microphone, or live call",
    );
  });
  it("rejects an unavailable default sample slot", () => {
    expect(
      journeySchema.safeParse({
        ...journey,
        sample: { ...journey.sample, defaultSlot: "unavailable" },
      }).success,
    ).toBe(false);
  });
});
