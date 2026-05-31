import React from "react";

export interface Tab {
  /** Unique identifier for this tab. */
  id: string;
  /** Display label shown in the tab bar. */
  label: string;
  /** Content rendered when this tab is active. */
  content: React.ReactNode;
}

export interface TabsProps {
  /** Focus target for the tab bar. */
  focusId: string;
  /** Array of tab definitions. */
  tabs: Tab[];
  /** Controlled: currently active tab id. */
  activeTab?: string;
  /** Controlled: called when active tab changes. */
  onChange?: (id: string) => void;
  /** Uncontrolled: initial active tab id (defaults to first tab). */
  defaultActiveTab?: string;
}
