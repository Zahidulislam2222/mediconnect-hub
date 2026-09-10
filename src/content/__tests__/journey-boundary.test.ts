import { describe, expect, it } from "vitest";

const sources = import.meta.glob<string>("../../components/journey/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("local journey configuration and secret boundary", () => {
  it("actually covers the complete presentation and routing entry", () => {
    expect(Object.keys(sources)).toHaveLength(7);
  });

  it.each(Object.entries(sources))(
    "keeps %s offline and provider-free",
    (_, source) => {
      expect(source).not.toMatch(/https?:\/\/|import\.meta\.env|process\.env/);
      expect(source).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
      expect(source).not.toMatch(
        /localStorage|sessionStorage|dangerouslySetInnerHTML/,
      );
      expect(source).not.toMatch(
        /(?:bytedance|openai|anthropic)\/[a-z0-9.-]+/i,
      );
      expect(source).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
      expect(source).not.toMatch(/\b(?:sk|sk-or-v1)-[A-Za-z0-9_-]{16,}/);
      expect(source).not.toMatch(/\bAKIA[A-Z0-9]{16}\b/);
      expect(source).toContain(_.endsWith("/Routing.tsx") ? "@/config/journey-routing" : "@/content/journey");
    },
  );
});
