import React from "react";
import type { StorageAPI } from "../../storage/index.js";

export interface FoldProps {
  /** Focus target for the fold header bar. */
  focusId: string;
  /** Label shown on the header bar. */
  label: string;
  /** Optional preview content displayed when folded. */
  preview?: React.ReactNode;
  /** Content rendered when the fold is expanded. */
  children: React.ReactNode;
  /** Controlled: expanded state. */
  expanded?: boolean;
  /** Controlled: called when expand state is toggled. */
  onToggle?: () => void;
  /** Uncontrolled: initial expanded state. Defaults to false. */
  defaultExpanded?: boolean;
  /**
   * Optional persistence instance. When provided, the expanded state is
   * automatically saved and restored across sessions.
   */
  storage?: StorageAPI;
  /**
   * Storage key used for persistence. Defaults to `"fold:<focusId>"` when
   * not provided.
   */
  storageKey?: string;
}
