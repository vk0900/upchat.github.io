import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize document title
document.title = "FileChat";

// Set favicon if needed
const favicon = document.createElement("link");
favicon.rel = "icon";
favicon.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💬</text></svg>";
document.head.appendChild(favicon);

createRoot(document.getElementById("root")!).render(<App />);
