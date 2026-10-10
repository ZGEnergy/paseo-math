import { Text, type TextStyle } from "react-native";
import type { ReactNode } from "react";
import {
  classifyAssistantFileLink,
  isFileLookingAssistantToken,
} from "./vendor/assistant-file-links-parse.js";

export type HrefKind = "external" | "mailto" | "file" | "unsupported";

export function classifyHref(href: string, workspaceRoot?: string): HrefKind {
  if (/^https?:\/\//i.test(href)) return "external";
  if (/^mailto:/i.test(href)) return "mailto";
  const classified = classifyAssistantFileLink(href, { workspaceRoot });
  if (classified && classified.kind !== "external") return "file";
  return "unsupported";
}

export function isInlineCodePath(text: string): boolean {
  return isFileLookingAssistantToken(text);
}

/** Looks like a host file link; does nothing on press (plugins cannot open workspace files). */
export function FilePathText({
  children,
  color,
  style,
}: {
  children: ReactNode;
  color: string;
  style?: TextStyle;
}) {
  return (
    <Text selectable style={[style, { color }]}>
      {children}
    </Text>
  );
}
