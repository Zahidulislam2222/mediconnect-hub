import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import JourneyApp from "./components/journey/JourneyApp";
import "./index.css";
import "./styles/journey.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <JourneyApp />
    </BrowserRouter>
  </StrictMode>,
);
