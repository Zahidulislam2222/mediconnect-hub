// The static landing page does not initialize cloud SDKs, consent UI or chat.
// Original application routes and their authentication guards remain intact.
import { createRoot } from "react-dom/client";
import Showcase from "./pages/Showcase";
import "./index.css";

if (window.location.pathname === "/") {
  createRoot(document.getElementById("root")!).render(<Showcase />);
} else {
  void import("./main");
}
