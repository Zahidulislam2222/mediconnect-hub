import { describe, expect, it } from "vitest";
import componentSource from "../../pages/Showcase.tsx?raw";
import entrySource from "../../showcase-main.tsx?raw";
import { showcase } from "../showcase";

describe("showcase content and isolation contract", () => {
  it("offers all three unique care stages and role perspectives", () => {
    expect(showcase.preview.stages.map(stage => stage.id)).toEqual(["appointment", "consultation", "followup"]);
    expect(showcase.workspace.roles.map(role => role.id)).toEqual(["patient", "clinician", "team"]);
  });
  it("labels fictional records and operational limitations", () => {
    expect(showcase.hero.disclaimer).toContain("No real patient data");
    expect(showcase.preview.personDetail).toContain("Fictional");
    expect(showcase.footer.status).toContain("Backend services inactive");
    expect(showcase.faq.items[0].answer).toContain("not an operating healthcare service");
  });
  it("keeps navigation inside the local preview", () => {
    expect(showcase.navigation.every(link => /^#[a-z-]+$/.test(link.href))).toBe(true);
    expect(JSON.stringify(showcase)).not.toMatch(/https?:\/\/|sk_live_|sk-proj-|AKIA[A-Z0-9]{16}|BEGIN.*PRIVATE KEY/);
  });
  it("does not import cloud clients or embed endpoints in the showcase view", () => {
    const component = componentSource;
    expect(component).not.toMatch(/aws-amplify|@aws-sdk|@stripe|@\/lib\/api|fetch\(|https?:\/\/|import\.meta\.env/);
    expect(component).toContain('@/content/showcase');
  });
  it("retains the original guarded app as a separate lazy entry", () => {
    const entry = entrySource;
    expect(entry).toContain('import("./main")');
    expect(entry).not.toMatch(/from ["'].*(?:aws|stripe|App)["']/);
  });
});
