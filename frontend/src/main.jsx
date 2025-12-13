import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "@shopify/app-bridge-react";
import App from "./App";

// Get the shop from URL parameters (Shopify provides this)
const urlParams = new URLSearchParams(window.location.search);
const shop = urlParams.get('shop');
const host = urlParams.get('host');

// Create App Bridge config
const config = {
  apiKey: 'd0f0ec29327c11fc4d6b093d6ecb77c0', // Your API key
  host: host, // Required for embedded apps
  forceRedirect: true,
};

// Only render if we have the required parameters
if (host && shop) {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <Provider config={config}>
        <App />
      </Provider>
    </React.StrictMode>
  );
} else {
  // Fallback for non-embedded mode (development)
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
