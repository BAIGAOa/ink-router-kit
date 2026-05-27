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
