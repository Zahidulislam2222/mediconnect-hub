import { createRoot } from "react-dom/client";
import { Amplify } from "aws-amplify";
import { authConfig } from "./aws-config";
import App from "./App.tsx";
import "./index.css";

Amplify.configure(authConfig); // This line is crucial!

createRoot(document.getElementById("root")!).render(<App />);