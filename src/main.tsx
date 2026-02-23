// src/main.tsx
import { createRoot } from "react-dom/client";
import { Amplify } from "aws-amplify";
import App from "./App.tsx";
import "./index.css";
import { getAwsConfig } from "./aws-config";

// This ensures the app boots up connecting to the correct cloud (Frankfurt vs Virginia)
const config = getAwsConfig();
Amplify.configure(config);

createRoot(document.getElementById("root")!).render(<App />);