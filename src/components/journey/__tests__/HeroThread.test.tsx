import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import HeroThread from "../HeroThread";
import { journey } from "@/content/journey";
import { publicSite } from "@/content/public-site";
import { autoplayDurationMs } from "@/lib/hero-thread";

const homepageSources = import.meta.glob<string>(
  ["../Home.tsx", "../HeroThread.tsx", "../HomeSections.tsx", "../../../lib/hero-thread.ts"],
  { query: "?raw", import: "default", eager: true },
);
const states = () =>
  screen.getAllByRole("listitem").map((item) => item.getAttribute("data-state"));
const moment = (label: string) => screen.getByRole("button", { name: new RegExp(label) });
const prefersReducedMotion = (reduce: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
const renderHero = () => render(<MemoryRouter><HeroThread /></MemoryRouter>);

beforeEach(() => {
  vi.useFakeTimers();
  prefersReducedMotion(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("homepage hero thread", () => {
  it("travels through every moment once and then rests on the last", () => {
    renderHero();
    expect(states()).toEqual(["ahead", "ahead", "ahead", "ahead"]);
    act(() => { vi.advanceTimersByTime(journey.heroMotion.startDelayMs); });
    expect(states()).toEqual(["current", "ahead", "ahead", "ahead"]);
    act(() => { vi.advanceTimersByTime(journey.heroMotion.stepMs); });
    expect(states()).toEqual(["reached", "current", "ahead", "ahead"]);
    act(() => { vi.advanceTimersByTime(autoplayDurationMs(journey.heroMotion, journey.moments.length)); });
    expect(states()).toEqual(["reached", "reached", "reached", "current"]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("runs the sequence once under React strict mode's repeated effects", () => {
    render(<StrictMode><MemoryRouter><HeroThread /></MemoryRouter></StrictMode>);
    expect(vi.getTimerCount()).toBe(journey.moments.length);
    act(() => { vi.advanceTimersByTime(journey.heroMotion.startDelayMs + journey.heroMotion.stepMs); });
    expect(states()).toEqual(["reached", "current", "ahead", "ahead"]);
    act(() => { vi.advanceTimersByTime(autoplayDurationMs(journey.heroMotion, journey.moments.length)); });
    expect(states()).toEqual(["reached", "reached", "reached", "current"]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("stops the sequence when a moment is chosen and marks later moments as ahead", () => {
    renderHero();
    act(() => { vi.advanceTimersByTime(journey.heroMotion.startDelayMs); });
    fireEvent.click(moment(journey.moments[1].label));
    expect(states()).toEqual(["reached", "current", "ahead", "ahead"]);
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(states()).toEqual(["reached", "current", "ahead", "ahead"]);
    expect(moment(journey.moments[1].label)).toHaveAttribute("aria-pressed", "true");
    expect(moment(journey.moments[3].label)).toHaveAttribute("aria-pressed", "false");
  });
  it("starts settled with no timers when reduced motion is requested", () => {
    prefersReducedMotion(true);
    renderHero();
    expect(states()).toEqual(["reached", "reached", "reached", "current"]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("names and describes each moment while hiding the sketch from assistive technology", () => {
    prefersReducedMotion(true);
    renderHero();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("list", { name: journey.hero.momentsLabel })).toBeInTheDocument();
    journey.moments.forEach((item, index) => {
      const button = moment(item.label);
      expect(button).toHaveAccessibleName(`${index + 1} ${item.label}`);
      expect(button).toHaveAccessibleDescription(`${item.title} ${item.body}`);
      expect(button.querySelector(".jy-hero-tile")).toHaveAttribute("aria-hidden", "true");
    });
  });
  it("states that the illustration is not real and that services are unavailable", () => {
    prefersReducedMotion(true);
    renderHero();
    const note = document.querySelector(".jy-hero-note");
    expect(note).toHaveTextContent(journey.hero.illustrationNote);
    expect(note).toHaveTextContent(publicSite.status);
  });
  it("sends the main button to account access and the text link to the next section", () => {
    prefersReducedMotion(true);
    renderHero();
    const primary = screen.getByRole("link", { name: journey.hero.primary });
    expect(primary).toHaveClass("jy-button");
    expect(primary.getAttribute("href")).toMatch(/auth$/);
    expect(screen.getByRole("link", { name: journey.hero.secondary })).toHaveAttribute("href", "/#explore");
  });
  it("passes validated timing to the stylesheet", () => {
    prefersReducedMotion(true);
    renderHero();
    const style = document.querySelector<HTMLElement>(".jy-hero-thread")!.style;
    expect(style.getPropertyValue("--jy-hero-segment")).toBe(`${journey.heroMotion.segmentMs}ms`);
    expect(style.getPropertyValue("--jy-hero-reveal")).toBe(`${journey.heroMotion.revealMs}ms`);
    expect(style.getPropertyValue("--jy-hero-arrival")).toMatch(/^\d+ms$/);
  });
  it("clears pending timers when it leaves the page", () => {
    const { unmount } = renderHero();
    expect(vi.getTimerCount()).toBe(journey.moments.length);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps the 3D library and media players out of the homepage source", () => {
    const sources = Object.entries(homepageSources);
    expect(sources).toHaveLength(4);
    for (const [file, source] of sources) {
      expect(source, file).not.toMatch(/from\s+["']three["']|import\(\s*["']three["']\s*\)|<video|<canvas/);
    }
  });
});
