/**
 * A single theme definition — a flat map of key-value pairs plus a unique id.
 */
export interface ThemeDefinition {
  /** Unique identifier for this theme (e.g. "dark", "light"). */
  id: string;
  /** Flat key-value pairs where values are Ink color names or style booleans. */
  [key: string]: string | boolean;
}

/**
 * Props for the {@link ThemeProvider} component.
 */
export interface ThemeProviderProps {
  children: React.ReactNode;

  /** Directory path containing `{id}.json` files. */
  path?: string;

  /** Inline theme definitions (alternative to `path`). */
  themes?: ThemeDefinition[];

  /** Id of the theme to activate initially. Defaults to the first available. */
  defaultTheme?: string;
}

/**
 * Value provided by {@link ThemeProvider} via React context.
 * Accessed via the {@link useTheme} hook.
 */
export interface ThemeContextValue {
  /** Get a color value from the current theme (returns the raw string or undefined). */
  color: (key: string) => string | undefined;

  /** Get a style value (boolean) from the current theme (returns undefined if not set). */
  style: (key: string) => boolean | undefined;

  /** Currently active theme id. */
  themeId: string;

  /** List of all available theme ids. */
  themes: string[];

  /** Switch to a different theme by id. */
  setTheme: (id: string) => void;

  /**
   * Merge additional theme files from one or more directory paths.
   * Later paths override earlier paths for matching keys.
   * Only themes whose id already exists are merged; new ids are ignored.
   */
  mergeTheme: (paths: string[]) => void;

  /**
   * Add new themes from one or more directory paths.
   *
   * Unlike {@link mergeTheme}, this adds **new** themes to the pool.
   * - Same filename across paths → later overwrites earlier.
   * - Same id as existing base theme → throws immediately.
   * - Same id across different filenames within the batch → throws.
   * - Missing or extra keys vs. existing themes → throws.
   */
  addThemes: (paths: string[]) => void;
}
