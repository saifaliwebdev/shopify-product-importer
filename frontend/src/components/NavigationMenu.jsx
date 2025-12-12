import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Frame, Navigation } from "@shopify/polaris";
import {
  HomeIcon,
  ImportIcon,
  ProductIcon,
  ClockIcon,
  SettingsIcon,
} from "@shopify/polaris-icons";

export default function NavigationMenu() {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationMarkup = (
    <Navigation location={location.pathname}>
      <Navigation.Section
        items={[
          {
            label: "Dashboard",
            icon: HomeIcon,
            selected: location.pathname === "/",
            onClick: () => navigate("/"),
          },
          {
            label: "Import Product",
            icon: ImportIcon,
            selected: location.pathname === "/import/single",
            onClick: () => navigate("/import/single"),
          },
          {
            label: "Bulk Import",
            icon: ProductIcon,
            selected: location.pathname === "/import/bulk",
            onClick: () => navigate("/import/bulk"),
          },
          {
            label: "Import History",
            icon: ClockIcon,
            selected: location.pathname === "/history",
            onClick: () => navigate("/history"),
          },
          {
            label: "Settings",
            icon: SettingsIcon,
            selected: location.pathname === "/settings",
            onClick: () => navigate("/settings"),
          },
        ]}
      />
    </Navigation>
  );

  return null; // Navigation is rendered inside pages
}

export { NavigationMenu };