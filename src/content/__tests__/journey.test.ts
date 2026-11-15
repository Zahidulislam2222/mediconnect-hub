import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { journeySchema, journey, MOMENT_IDS } from "../journey";

/** Reads the pixel size from a WebP header (lossy, lossless or extended layout). */
function webpSize(bytes: Buffer) {
  const kind = bytes.subarray(12, 16).toString("latin1");
  if (kind === "VP8X") return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  if (kind === "VP8 ") return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  if (kind === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  throw new Error(`Unknown WebP layout: ${kind}`);
}

describe("connected-care content boundary", () => {
  it.each(["coordinationArticleSlug", "preparationArticleSlug"] as const)(
    "accepts content-only article renaming for %s",
    (field) => {
      const oldSlug = journey.workspace[field];
      const result = journeySchema.safeParse({
        ...journey,
        workspace: { ...journey.workspace, [field]: "renamed-article" },
        articles: journey.articles.map(article => article.slug === oldSlug
          ? { ...article, slug: "renamed-article" } : article),
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.workspace[field]).toBe("renamed-article");
    },
  );
  it.each(["coordinationArticleSlug", "preparationArticleSlug"])(
    "rejects absent or wrong-kind workspace reference %s",
    (field) => {
      for (const target of ["missing-article", journey.articles.find(article => article.kind === "blog")!.slug]) {
        expect(journeySchema.safeParse({
          ...journey,
          workspace: { ...journey.workspace, [field]: target },
        }).success).toBe(false);
      }
    },
  );
  it.each(["care-team-coordination", "prepare-for-your-visit"])(
    "rejects deleting referenced article %s",
    (slug) => {
      expect(journeySchema.safeParse({
        ...journey, articles: journey.articles.filter(article => article.slug !== slug),
      }).success).toBe(false);
    },
  );
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
  it("keeps the four hero moments in care-journey order", () => {
    expect(journey.moments.map((moment) => moment.id)).toEqual([...MOMENT_IDS]);
    for (const moments of [
      journey.moments.slice(1),
      [...journey.moments].reverse(),
      [journey.moments[0], journey.moments[0], ...journey.moments.slice(2)],
      journey.moments.map((moment, index) => (index ? moment : { ...moment, title: " " })),
    ]) expect(journeySchema.safeParse({ ...journey, moments }).success).toBe(false);
  });
  it("rejects a hero load sequence that would run past five seconds", () => {
    for (const heroMotion of [
      { ...journey.heroMotion, stepMs: 1600 },
      { ...journey.heroMotion, startDelayMs: 2000, stepMs: 900 },
      { ...journey.heroMotion, stepMs: journey.heroMotion.segmentMs - 1 },
      { ...journey.heroMotion, segmentMs: 12.5 },
      // Looks like 5000 ms until the moment's own 500 ms fade is counted.
      { startDelayMs: 0, stepMs: 1600, segmentMs: 100, revealMs: 500 },
      { ...journey.heroMotion, revealMs: undefined },
    ]) expect(journeySchema.safeParse({ ...journey, heroMotion }).success).toBe(false);
  });
  it("marks the hero illustration as not real, without release-banned wording", () => {
    expect(journey.hero.illustrationNote).toMatch(/illustration only/i);
    expect(journey.hero.illustrationNote).toMatch(/not real/i);
    const shown = JSON.stringify([journey.hero, journey.moments, journey.heroPreview, journey.clinicPreview, journey.media.alt]);
    expect(shown).not.toMatch(/\b(?:demo(?:nstrat\w*)?|preview|sample|fictional|portfolio|mockup|simulation|concept)\b/i);
    expect(journeySchema.safeParse({
      ...journey,
      heroPreview: { ...journey.heroPreview, plan: { ...journey.heroPreview.plan, items: [] } },
    }).success).toBe(false);
  });
  it("keeps realistic-people footage out of the hero and shared posters", () => {
    expect(journey.media).not.toHaveProperty("film");
    for (const image of [journey.media.poster, journey.media.homePoster])
      expect(image).toMatch(/^\/media\/journey\/care-thread-/);
  });
  it("serves the shared posters as light WebP stills drawn from the live illustrations", () => {
    const limits = JSON.parse(readFileSync(path.join(process.cwd(), "design/care-thread-posters/posters.json"), "utf8"));
    expect(limits.posters.map((poster: { mediaKey: string }) => poster.mediaKey).sort()).toEqual(["homePoster", "poster"]);
    expect(journey.media.poster).not.toBe(journey.media.homePoster);
    for (const image of [journey.media.poster, journey.media.homePoster]) {
      // v1 was rendered from the retired 3D scene.
      expect(image).not.toMatch(/-v1\.webp$/);
      const bytes = readFileSync(path.join(process.cwd(), "public", image));
      expect(bytes.subarray(0, 4).toString("latin1")).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("latin1")).toBe("WEBP");
      expect(bytes.length).toBeLessThanOrEqual(limits.output.maxBytes);
      expect(webpSize(bytes)).toEqual({ width: limits.output.width, height: limits.output.height });
    }
    expect(journey.media.alt).toMatch(/no people/i);
  });
  it("draws the clinician schedule from the sample slots with initials only", () => {
    const { schedule, note } = journey.clinicPreview;
    expect(schedule.rows).toHaveLength(journey.sample.slots.length);
    expect(note).toMatch(/illustration only/i);
    expect(note).toMatch(/not real/i);
    const shown = JSON.stringify(journey.clinicPreview);
    for (const name of [journey.sample.patient, journey.sample.doctor]) expect(shown).not.toContain(name);
    for (const rows of [
      schedule.rows.slice(1),
      [...schedule.rows, schedule.rows[0]],
      schedule.rows.map((row, index) => (index === 0 ? { ...row, initials: "Mona K" } : row)),
    ]) {
      expect(journeySchema.safeParse({
        ...journey,
        clinicPreview: { ...journey.clinicPreview, schedule: { ...schedule, rows } },
      }).success).toBe(false);
    }
  });
  it("keeps the clinician schedule to rows the panel can hold and to distinct slots", () => {
    const sample = { ...journey.sample, slots: [...journey.sample.slots, "16:00"] };
    const rows = [...journey.clinicPreview.schedule.rows, { label: "Check-in", initials: "ZZ" }];
    expect(journeySchema.safeParse({
      ...journey,
      sample,
      clinicPreview: { ...journey.clinicPreview, schedule: { ...journey.clinicPreview.schedule, rows } },
    }).success).toBe(false);
    const repeated = journey.sample.slots.map((slot, index) => (index === 0 ? journey.sample.slots[1] : slot));
    expect(journeySchema.safeParse({ ...journey, sample: { ...journey.sample, slots: repeated } }).success).toBe(false);
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
    expect(journey.notice).toContain("currently unavailable");
    expect(journey.notice).toContain("do not submit health records or payment information");
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
