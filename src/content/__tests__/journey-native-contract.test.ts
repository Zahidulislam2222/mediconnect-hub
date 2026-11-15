import { describe, expect, it } from "vitest";
import raw from "../journey.json";
import { journey } from "../journey";

/**
 * The Android and iOS clients under native/ parse this same content file at build time. A web-only
 * edit that drops a field they read breaks their next build, so the fields are pinned here.
 */
const kotlin = import.meta.glob<string>(
  "../../../native/android/app/src/main/java/com/mediconnect/nativeapp/Native{Journey,Editorial,Demo}.kt",
  { query: "?raw", import: "default", eager: true },
);
const swift = import.meta.glob<string>("../../../native/ios/Sources/NativeJourney.swift", {
  query: "?raw",
  import: "default",
  eager: true,
});
const document = raw as Record<string, unknown>;
const filled = (value: unknown) => typeof value === "string" && value.trim().length > 0;

describe("shared content contract with the native clients", () => {
  it("reads the native parsers it protects", () => {
    expect(Object.keys(kotlin)).toHaveLength(3);
    expect(Object.keys(swift)).toHaveLength(1);
  });

  it("keeps every top-level section the Android parsers open", () => {
    const source = Object.values(kotlin).join("\n");
    const sections = new Set(
      [...source.matchAll(/document\.get(?:JSONObject|JSONArray)\("(\w+)"\)|text\(document, "(\w+)"\)/g)].map(
        (match) => match[1] ?? match[2],
      ),
    );
    expect(sections.size).toBeGreaterThanOrEqual(10);
    for (const section of sections) expect(document, section).toHaveProperty(section);
  });

  it("keeps every field read straight from a section", () => {
    const source = Object.values(kotlin).join("\n");
    const fields = [...source.matchAll(/text\(document\.getJSONObject\("(\w+)"\), "(\w+)"\)/g)].map((match) => [match[1], match[2]]);
    expect(fields.length).toBeGreaterThanOrEqual(8);
    for (const [section, field] of fields) {
      expect(filled((document[section] as Record<string, unknown>)[field]), `${section}.${field}`).toBe(true);
    }
  });

  it("keeps the welcome screen's hero, illustration caption and chapters", () => {
    const welcome = Object.values(swift)[0];
    for (const field of ["eyebrow", "title", "emphasis", "body", "illustration"] as const) {
      expect(welcome, field).toMatch(new RegExp(`let ${field}: String`));
      expect(filled(journey.hero[field]), `hero.${field}`).toBe(true);
    }
    expect(welcome).toMatch(/let stages: \[JourneyChapter\]/);
    // The native welcome screens list the chapters after the first.
    expect(journey.stages.length).toBeGreaterThan(1);
    expect(new Set(journey.stages.map((stage) => stage.id)).size).toBe(journey.stages.length);
    for (const stage of journey.stages) {
      for (const field of ["id", "label", "title", "emphasis", "body"] as const) expect(filled(stage[field]), `stages.${field}`).toBe(true);
    }
  });

  it("names posters the native asset rule accepts", () => {
    // Same pattern as NativeJourney.kt, NativeJourney.swift and the Android asset copy task.
    for (const image of [journey.media.poster, journey.media.homePoster]) expect(image).toMatch(/^\/media\/journey\/[A-Za-z0-9_-]+\.webp$/);
    expect(filled(journey.media.alt)).toBe(true);
  });
});
