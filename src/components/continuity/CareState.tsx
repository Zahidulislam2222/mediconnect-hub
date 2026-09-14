import { useState, type ReactNode } from "react";
import { CareContext, chooseSlot, initialCareState } from "./care-store";

export function CareProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialCareState);
  return (
    <CareContext.Provider
      value={{
        ...state,
        setSlot: (slot) => setState((current) => chooseSlot(current, slot)),
        toggleReady: () =>
          setState((current) => ({
            ...current,
            status: current.status === "ready" ? "needs-confirmation" : "ready",
          })),
        reset: () => setState(initialCareState),
      }}
    >
      {children}
    </CareContext.Provider>
  );
}
