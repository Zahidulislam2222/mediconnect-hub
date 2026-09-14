import { createContext, useContext } from "react";
import { continuity as c } from "@/content/continuity";

type Coordination = "needs-confirmation" | "ready";
export const initialCareState = {
  slot: c.sample.initialSlot,
  status: c.sample.initialStatus as Coordination,
};
export function chooseSlot(current: typeof initialCareState, slot: string) {
  return c.sample.slots.includes(slot) ? { ...current, slot } : current;
}
type State = typeof initialCareState & {
  setSlot: (slot: string) => void;
  toggleReady: () => void;
  reset: () => void;
};
export const CareContext = createContext<State | null>(null);
export function useCare() {
  const state = useContext(CareContext);
  if (!state) throw new Error("CareProvider is required");
  return state;
}
