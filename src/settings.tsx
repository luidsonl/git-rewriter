import React from "react";
import ReactDOM from "react-dom/client";
import { SettingsPage } from "./pages/SettingsPage";
import { ToastContainer } from "./components/molecules/ToastContainer";
import "./App.css"; // Includes tailwind
import "./i18n/config";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans">
      <SettingsPage />
      <ToastContainer />
    </div>
  </React.StrictMode>,
);
