import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  const swUrl = `/sw.js?v=${encodeURIComponent(__APP_BUILD_ID__)}`;
  void navigator.serviceWorker
    .register(swUrl, { scope: "/", updateViaCache: "none" })
    .then((reg) => {
      void reg.update();
      setInterval(() => void reg.update(), 60 * 60 * 1000);
    })
    .catch(() => {});
}
