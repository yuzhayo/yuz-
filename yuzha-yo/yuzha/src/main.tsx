// IMPORT SECTION
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./index.css";

// BOOTSTRAP SECTION
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Root element with id "root" was not found.');
}

// RENDER SECTION
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
