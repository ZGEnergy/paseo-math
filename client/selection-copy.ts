import { Platform } from "react-native";
import type { RefObject } from "react";
import { useSelectionCopy as useWebSelectionCopy } from "./selection-copy.web.js";

function useNoSelectionCopy(_rowRef: RefObject<unknown>, _source: string): void {}

// The plugin compiler (esbuild, platform neutral) does not resolve `.web.ts`
// siblings, so this entry picks the implementation. The web module only touches
// the DOM inside its effect, so bundling it for native is safe.
export const useSelectionCopy: (rowRef: RefObject<unknown>, source: string) => void =
  Platform.OS === "web" ? useWebSelectionCopy : useNoSelectionCopy;
