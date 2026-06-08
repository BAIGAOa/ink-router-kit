// ── Screen System ──────────────────────────────────────────
export {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  skip,
  back,
  gotoScreen,
  overlay,
  closeOverlay,
  useScreenSystem,
} from "./screen/index.js";

export type {
  SkipOptions,
  SkipFn,
  BackFn,
  GotoScreenFn,
  OverlayFn,
  CloseOverlayFn,
  RegisterOptions,
  ScenarioManagementProviderProps,
} from "./screen/index.js";

// ── Keyboard System ────────────────────────────────────────
export { KeyboardProvider, useKeyboard } from "./keyboard/index.js";

export type {
  KeyHandler,
  BoundKeyboardOptions,
  BoundKeyEntry,
  ScreenKeyboardLayer,
  KeyboardProviderProps,
} from "./keyboard/index.js";

export type {
  BlockedKeyOptions,
  StopOptions,
  FocusTarget,
} from "./keyboard/index.js";
export { useFocusState } from "./keyboard/index.js";


// Components — SelectInput
export { SelectInput } from "./components/select/SelectInput.js";
export type { Item } from "./components/select/types.js";
export type { SelectInputProps } from "./components/select/types.js";

// Components — MultiSelectInput
export { MultiSelectInput } from "./components/multi-select/MultiSelectInput.js";
export type { MultiSelectInputProps } from "./components/multi-select/types.js";

// Components — TextInput
export { TextInput, UncontrolledTextInput } from "./components/text/TextInput.js";
export type { TextInputProps, UncontrolledTextInputProps } from "./components/text/types.js";

// Components — Dialog
export { ConfirmDialog } from "./components/dialog/ConfirmDialog.js";
export type { ConfirmDialogProps } from "./components/dialog/types.js";

// Components — Spinner
export { Spinner } from "./components/spinner/Spinner.js";
export type { SpinnerType } from "./components/spinner/Spinner.js";

// Components — ProgressBar
export { ProgressBar } from "./components/progress-bar/ProgressBar.js";

// Components — Divider
export { Divider } from "./components/divider/Divider.js";

// Components — Badge
export { Badge } from "./components/badge/Badge.js";

// Components — KeyHint
export { KeyHint } from "./components/key-hint/KeyHint.js";

// Components — NumberInput
export { NumberInput } from "./components/number-input/NumberInput.js";

// Components — SearchInput
export { SearchInput } from "./components/search-input/SearchInput.js";

// Components — Tabs
export { Tabs } from "./components/tabs/Tabs.js";
export type { Tab, TabsProps } from "./components/tabs/types.js";

// Components — Fold
export { Fold } from "./components/fold/Fold.js";
export type { FoldProps } from "./components/fold/types.js";

// Components — Form
export { Form } from "./components/form/Form.js";
export { Field } from "./components/form/Field.js";
export { useFormContext } from "./components/form/context.js";
export type {
  FormProps,
  FieldProps,
  FieldRenderProps,
  FormContextValue,
  Validator,
} from "./components/form/types.js";

// I18n — Language
export { LanguageProvider } from "./language/index.js";
export { useI18n } from "./language/index.js";
export type { LanguageProviderProps, I18nContextValue } from "./language/index.js";

// Theme System
export { ThemeProvider } from "./theme/index.js";
export { useTheme } from "./theme/index.js";
export type { ThemeProviderProps, ThemeContextValue, ThemeDefinition } from "./theme/index.js";

// Persistence System
export { createStorage } from "./storage/index.js";
export type { StorageOptions, StorageAPI } from "./storage/index.js";

// Binary Persistence System
export { createBinaryStorage, TypeTag, TAG_NAMES } from "./binary-storage/index.js";
export type { BinaryStorageOptions, BinaryStorageAPI } from "./binary-storage/index.js";

// Binary Streaming Reader
export { createStreamingReader, StreamCorruptError } from "./binary-storage/StreamingReader.js";
export type { StreamingReaderOptions, StreamingReaderAPI } from "./binary-storage/StreamingReader.js";
