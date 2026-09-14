import { describe, expect, it } from "vitest";
import { cinematic, cinematicSchema } from "../cinematic";
import source from "../cinematic.json";
import authSource from "../../pages/CinematicAuth.tsx?raw";
import worldSource from "../../components/cinematic/CareWorld.tsx?raw";
import entrySource from "../../cinematic-main.tsx?raw";

describe("Cinematic content boundary", () => {
  it("validates the maintained copy and media configuration", () => {
    expect(cinematicSchema.safeParse(source).success).toBe(true);
    expect(cinematic.journey.stages).toHaveLength(cinematic.motion.stages.length);
  });
  it("rejects remote or executable asset URLs", () => {
    for (const hero of ["https://example.test/image.webp", "//example.test/image.webp", "javascript:alert(1)"])
      expect(cinematicSchema.safeParse({ ...source, media: { ...source.media, hero } }).success).toBe(false);
  });
  it("rejects duplicate stage IDs and invalid camera planes", () => {
    expect(cinematicSchema.safeParse({ ...source, journey: { ...source.journey, stages: [source.journey.stages[0], source.journey.stages[0], source.journey.stages[2]] } }).success).toBe(false);
    expect(cinematicSchema.safeParse({ ...source, motion: { ...source.motion, cameraFar: 0.01 } }).success).toBe(false);
  });
  it("keeps incomplete video generation out of the runtime", () => {
    expect(source.media.video).toBeNull();
    expect(source.auth.notice).toContain("never sent or saved");
    expect(source.hero.footnote).toContain("offline");
  });
  it("does not send or persist credentials in the isolated auth preview", () => {
    expect(authSource).not.toMatch(/\b(?:fetch|signIn|signUp|resetPassword)\s*\(|localStorage|sessionStorage|aws-amplify/);
    expect(entrySource).not.toMatch(/aws-amplify|\.\/main["']/);
  });
  it("keeps resource URLs and provider secrets outside the viewer", () => {
    expect(worldSource).toContain("fetch(c.media.model");
    expect(worldSource).not.toMatch(/https?:\/\/|sk-or-v1-[a-zA-Z0-9]{20,}|-----BEGIN.*PRIVATE KEY/);
  });
});
