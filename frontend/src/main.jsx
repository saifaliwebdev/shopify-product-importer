import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "@shopify/app-bridge-react";
import App from "./App";

// Get the shop from URL parameters (Shopify provides this)
const urlParams = new URLSearchParams(window.location.search);
const shop = urlParams.get('shop');
const host = urlParams.get('host');

console.log("App Bridge init - shop:", shop, "host:", host);

// Create App Bridge config
const config = {
  apiKey: 'd0f0ec29327c11fc4d6b093d6ecb77c0', // Your API key
  host: host, // Required for embedded apps
};

// Always try to use App Bridge if host is available (Shopify provides host)
if (host) {
  console.log("Initializing App Bridge with config:", config);
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <Provider config={config}>
        <App />
      </Provider>
    </React.StrictMode>
  );
} else {
  console.log("No host parameter found, using fallback mode");
  // Fallback for non-embedded mode (development)
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
