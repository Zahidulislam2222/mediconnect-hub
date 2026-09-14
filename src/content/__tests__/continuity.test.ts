import { describe, expect, it } from "vitest";
import { continuity, validateContinuity } from "../continuity";
import {
  chooseSlot,
  initialCareState,
} from "../../components/continuity/care-store";
import auth from "../../pages/ContinuityAuth.tsx?raw";
import workspace from "../../pages/ContinuityWorkspace.tsx?raw";
import story from "../../components/continuity/CareJourney.tsx?raw";
import primitives from "../../components/continuity/Primitives.tsx?raw";
import entry from "../../continuity-main.tsx?raw";

describe("Appointment continuity boundary", () => {
  it("validates maintained content and ordered motion stages", () => {
    expect(() => validateContinuity(continuity)).not.toThrow();
    expect(() =>
      validateContinuity({
        ...continuity,
        motion: { ...continuity.motion, stageStops: [0, 0.7, 0.3, 1] },
      }),
    ).toThrow();
  });
  it("rejects remote, executable and parent-traversal media", () => {
    for (const url of [
      "https://example.test/a.mp4",
      "//example.test/a.mp4",
      "javascript:void(0)",
      "/media/continuity/../secret.mp4",
    ])
      expect(() =>
        validateContinuity({
          ...continuity,
          media: { ...continuity.media, clinicianVideo: url },
        }),
      ).toThrow();
  });
  it("requires unique role perspectives and a valid seed slot", () => {
    expect(() =>
      validateContinuity({
        ...continuity,
        sample: { ...continuity.sample, initialSlot: "25:90" },
      }),
    ).toThrow();
    expect(() =>
      validateContinuity({
        ...continuity,
        workspace: {
          ...continuity.workspace,
          roles: Array(3).fill(continuity.workspace.roles[0]),
        },
      }),
    ).toThrow();
  });
  it("rejects malformed copy, missing queue peers and unsafe motion intervals", () => {
    const malformed = structuredClone(continuity);
    Reflect.deleteProperty(malformed.workspace, "appointment");
    expect(() => validateContinuity(malformed)).toThrow();
    expect(() =>
      validateContinuity({
        ...continuity,
        workspace: { ...continuity.workspace, appointment: 7 },
      }),
    ).toThrow();
    expect(() =>
      validateContinuity({
        ...continuity,
        sample: { ...continuity.sample, queue: [] },
      }),
    ).toThrow();
    for (const stageStops of [
      [0.1, 0.32, 0.64, 1],
      [0, 0.32, 0.64, 0.9],
      [0, 0.05, 0.64, 1],
    ])
      expect(() =>
        validateContinuity({
          ...continuity,
          motion: { ...continuity.motion, stageStops },
        }),
      ).toThrow();
  });
  it("only accepts maintained sample slots and preserves coordination state", () => {
    expect(chooseSlot(initialCareState, "14:00")).toEqual({
      slot: "14:00",
      status: "needs-confirmation",
    });
    expect(chooseSlot(initialCareState, "invalid")).toBe(initialCareState);
    expect(
      chooseSlot({ ...initialCareState, status: "ready" }, "09:30").status,
    ).toBe("ready");
  });
  it("keeps narrative progress out of appointment state", () => {
    expect(story).not.toMatch(
      /setSlot|toggleReady|localStorage|sessionStorage/,
    );
    expect(story).toContain('aria-hidden="true"');
  });
  it("never sends, stores or logs auth/sample details", () => {
    for (const source of [auth, workspace, entry])
      expect(source).not.toMatch(
        /\b(?:fetch|signIn|signUp|resetPassword)\s*\(|localStorage|sessionStorage|aws-amplify|console\.(log|info)/,
      );
    expect(auth).toContain("event.currentTarget.reset()");
    expect(continuity.auth.notice).toContain("nothing is sent or saved");
  });
  it("owns media lifecycle and keeps provider config/secrets out of components", () => {
    expect(primitives).toContain("observer.disconnect()");
    expect(primitives).toContain('removeEventListener("visibilitychange"');
    expect(primitives).toContain("cancelVideoFrameCallback");
    for (const source of [auth, workspace, story, primitives, entry])
      expect(source).not.toMatch(
        /https?:\/\/|google\/veo|sk-or-v1-[A-Za-z0-9]{20,}|-----BEGIN.*PRIVATE KEY/,
      );
  });
});
