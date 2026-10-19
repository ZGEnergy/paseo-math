import { Text, type TextProps, type TextStyle } from "react-native";
import { useState, type ReactNode } from "react";
import {
  classifyAssistantFileLink,
  isFileLookingAssistantToken,
} from "./vendor/assistant-file-links-parse.js";

export type HrefKind = "external" | "mailto" | "file" | "unsupported";

export function classifyHref(href: string, workspaceRoot?: string): HrefKind {
  if (/^https?:\/\//i.test(href)) return "external";
  if (/^mailto:/i.test(href)) return "mailto";
  const classified = classifyAssistantFileLink(href, {
    workspaceRoot,
    decodeHref: true,
    explicitLink: true,
  });
  if (classified && classified.kind !== "external") return "file";
  return "unsupported";
}

export function isInlineCodePath(text: string): boolean {
  return isFileLookingAssistantToken(text);
}

/** A pressable link, underlined only while a pointer hovers it, as in the host. */
export function LinkText({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: TextProps["style"];
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  // RN-web forwards mouse props to the DOM; React Native's Text types omit them.
  const hover = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  } as Partial<TextProps>;
  return (
    <Text
      {...hover}
      style={[style, { textDecorationLine: hovered ? "underline" : "none" }]}
      accessibilityRole="link"
      onPress={onPress}
    >
      {children}
    </Text>
  );
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
