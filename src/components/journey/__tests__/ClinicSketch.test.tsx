import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ClinicSketch from "../ClinicSketch";
import HomeSections from "../HomeSections";
import { journey } from "@/content/journey";

afterEach(cleanup);

describe("clinician illustration", () => {
  it("draws one schedule row per sample slot and marks only the current one", () => {
    const { container } = render(<ClinicSketch />);
    const rows = [...container.querySelectorAll<HTMLElement>(".jy-clinic-sketch-row")];
    expect(rows.map((row) => row.querySelector(".jy-hero-time")?.textContent)).toEqual(journey.sample.slots);
    expect(rows.map((row) => row.dataset.now)).toEqual(
      journey.sample.slots.map((slot) => String(slot === journey.sample.defaultSlot)),
    );
    const current = rows.filter((row) => row.dataset.now === "true");
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain(journey.clinicPreview.schedule.now);
    expect(rows.map((row) => row.querySelector(".jy-clinic-sketch-initials")?.textContent)).toEqual(
      journey.clinicPreview.schedule.rows.map((row) => row.initials),
    );
  });

  it("is decorative, people-free and says it is an illustration", () => {
    const { container } = render(<ClinicSketch />);
    const panel = container.firstElementChild as HTMLElement;
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(panel.querySelectorAll("img, video, canvas, a, button, [tabindex]")).toHaveLength(0);
    expect(panel.textContent).toContain(journey.clinicPreview.note);
    for (const name of [journey.sample.patient, journey.sample.doctor]) expect(panel.textContent).not.toContain(name);
  });

  it("replaces the rendered poster in the homepage clinician section", () => {
    const { container } = render(<MemoryRouter><HomeSections /></MemoryRouter>);
    const section = container.querySelector(".jy-home-clinicians") as HTMLElement;
    expect(section.querySelectorAll(".jy-home-clinician-image.jy-clinic-sketch")).toHaveLength(1);
    expect(section.querySelectorAll("img")).toHaveLength(0);
    expect(section.firstElementChild?.classList.contains("jy-clinic-sketch")).toBe(true);
  });
});
