import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import enTranslations from "@shopify/polaris/locales/en.json";

// Pages
import Dashboard from "../pages/Dashboard";
import ImportSingle from "../pages/ImportSingle";
import ImportBulk from "../pages/ImportBulk";
import ImportHistory from "../pages/ImportHistory";
import Settings from "../pages/Settings";

// Components
import NavigationMenu from "./components/NavigationMenu";

export default function App() {
  return (
    <AppProvider i18n={enTranslations}>
      <BrowserRouter>
        <NavigationMenu />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import/single" element={<ImportSingle />} />
          <Route path="/import/bulk" element={<ImportBulk />} />
          <Route path="/history" element={<ImportHistory />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
