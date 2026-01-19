// src/main.tsx
import './aws-config'; // This loads the config and connects to AWS automatically
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);