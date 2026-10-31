import { describe, it, expect } from "vitest";
import { journeySchema, journey } from "../journey";

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
  it("requires one valid camera stop per chapter and a forward thread reveal", () => {
    const scene = journey.scene;
    for (const broken of [
      { ...scene, cameras: scene.cameras.slice(1) },
      { ...scene, threadReveal: [0.8, 0.2] },
      { ...scene, palette: { ...scene.palette, accent: "url(javascript:alert(1))" } },
      { ...scene, maxFov: scene.fov - 1 },
      { ...scene, cameras: [{ ...scene.cameras[0], position: [0, Number.NaN, 0] }, ...scene.cameras.slice(1)] },
    ]) expect(journeySchema.safeParse({ ...journey, scene: broken }).success).toBe(false);
  });
  it("keeps realistic-people footage out of the hero and shared posters", () => {
    expect(journey.media).not.toHaveProperty("film");
    for (const image of [journey.media.poster, journey.media.homePoster])
      expect(image).toMatch(/^\/media\/journey\/care-thread-/);
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
