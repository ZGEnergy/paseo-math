import {
  openExternalUrl,
  useAgent,
  type PluginTimelineItemProps,
} from "@getpaseo/plugin/client";
import {
  copyText,
  Icon,
  useRevealedText,
  useToast,
} from "@getpaseo/plugin/client/react-native";
import { memo, useCallback, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  Text,
  View,
  processColor,
  type TextStyle,
} from "react-native";
import type { MathMessage } from "../shared/message.js";
import Markdown, {
  MarkdownIt,
  markdownMath,
  type ASTNode,
  type RenderFunction,
  type RenderRules,
} from "./generated/markdown.js";
import { AssistantImage } from "./assistant-image.js";
import { Formula } from "./formula.js";
import { MathErrorBoundary } from "./error-boundary.js";
import { HighlightedCode } from "./highlight.js";
import { classifyHref, FilePathText, isInlineCodePath } from "./links.js";

const markdown = new MarkdownIt({
  html: false,
  typographer: false,
  linkify: true,
}).use(markdownMath);

// The dependency's runtime retains token.meta, but its public ASTNode type
// omits sourceMeta. Narrow that field instead of serializing TeX into markup.
type MathNode = ASTNode & { sourceMeta?: unknown };

function colorHex(color: TextStyle["color"], fallback: string): string {
  if (
    typeof color === "string" &&
    /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(color)
  )
    return color;
  const value = processColor(color ?? fallback);
  if (typeof value !== "number") return "#808080";
  // React Native processColor produces ARGB on all platforms (signed on Android).
  return `#${(value & 0xffffff).toString(16).padStart(6, "0")}${(value >>> 24).toString(16).padStart(2, "0")}`;
}

export function MathMessageView(props: PluginTimelineItemProps<MathMessage>) {
  return <MemoizedMathMessage {...props} />;
}

const MemoizedMathMessage = memo(
  function MathMessageView({
    agentId,
    item,
    host,
    theme,
    layout,
  }: PluginTimelineItemProps<MathMessage>) {
    const { text: sourceText, phase } = item.data;
    const text = useRevealedText(sourceText, phase);
    const colors = theme.colors;
    const toast = useToast();
    const workspaceRoot = useAgent(agentId, (agent) => agent.cwd) ?? undefined;
    const [width, setWidth] = useState(0);
    const fontSize = layout.compact ? 14 : 16;
    const styles = useMemo(
      () => ({
        body: {
          color: colors.foreground,
          fontSize,
          lineHeight: fontSize * 1.5,
        },
        textgroup: { flexShrink: 1 },
        paragraph: { marginTop: 4, marginBottom: 8 },
        heading1: {
          fontSize: fontSize * 1.8,
          lineHeight: fontSize * 2.3,
          marginVertical: 8,
        },
        heading2: {
          fontSize: fontSize * 1.5,
          lineHeight: fontSize * 2,
          marginVertical: 6,
        },
        heading3: {
          fontSize: fontSize * 1.25,
          lineHeight: fontSize * 1.75,
          marginVertical: 4,
        },
        blockquote: {
          color: colors.foregroundMuted,
          backgroundColor: colors.surface1,
          borderColor: colors.border,
          paddingVertical: 4,
        },
        link: { color: colors.accent },
        code_inline: {
          color: colors.foreground,
          backgroundColor: colors.surface2,
          borderColor: colors.border,
          padding: 1,
        },
        code_block: {
          color: colors.foreground,
          backgroundColor: colors.surface1,
          borderColor: colors.border,
        },
        fence: {
          color: colors.foreground,
          backgroundColor: colors.surface1,
          borderColor: colors.border,
        },
        hr: { backgroundColor: colors.border },
        table: { borderColor: colors.border },
        tr: { borderColor: colors.border },
        blocklink: { borderColor: colors.border },
      }),
      [
        fontSize,
        colors.foreground,
        colors.foregroundMuted,
        colors.surface1,
        colors.surface2,
        colors.border,
        colors.accent,
      ],
    );

    const onLinkPress = useCallback(
      (url: string) => {
        // Opening happens only after a user's press, never while parsing/rendering.
        // Anything other than web, mailto, and workspace-file links is refused.
        const kind = classifyHref(url, workspaceRoot);
        if (kind === "external") {
          void openExternalUrl(url).catch(() =>
            toast.error("Unable to open this link."),
          );
        } else if (kind === "mailto") {
          void Linking.openURL(url).catch(() =>
            toast.error("Unable to open this link."),
          );
        } else if (kind === "unsupported") {
          toast.error("This link type is not supported.");
        }
        return false;
      },
      [toast, workspaceRoot],
    );

    const rules = useMemo<RenderRules>(() => {
      const mathRule: RenderFunction = (
        node: MathNode,
        _children,
        _parents,
        _styles,
        inherited: TextStyle = {},
      ) => {
        const meta = node.sourceMeta;
        const source =
          meta &&
          typeof meta === "object" &&
          "source" in meta &&
          typeof meta.source === "string"
            ? meta.source
            : `${node.markup}${node.content}${node.markup === "\\(" ? "\\)" : node.markup === "\\[" ? "\\]" : node.markup}`;
        return (
          <Formula
            key={node.key}
            expression={node.content}
            source={source}
            display={
              meta &&
              typeof meta === "object" &&
              "display" in meta &&
              typeof meta.display === "boolean"
                ? meta.display
                : node.type === "math_block"
            }
            block={node.type === "math_block"}
            color={colorHex(inherited.color, colors.foreground)}
            hostId={host.id}
            textStyle={inherited}
            maxInlineWidth={Math.max(1, width - 48)}
          />
        );
      };
      return {
        math_inline: mathRule,
        math_block: mathRule,
        text: (node, _children, _parents, ruleStyles, inherited = {}) => (
          <Text key={node.key} selectable style={[inherited, ruleStyles.text]}>
            {node.content}
          </Text>
        ),
        code_inline: (
          node,
          _children,
          _parents,
          ruleStyles,
          inherited = {},
        ) => (
          <Text
            key={node.key}
            selectable
            style={[
              inherited,
              ruleStyles.code_inline,
              isInlineCodePath(node.content) && { color: colors.accent },
            ]}
          >
            {node.content}
          </Text>
        ),
        // The library passes onLinkPress (not inherited styles) as the 5th link
        // argument; use the closure below so the press path stays in one place.
        link: (node, children, _parents, ruleStyles) => {
          const href = String(node.attributes.href ?? "");
          return classifyHref(href, workspaceRoot) === "file" ? (
            <FilePathText key={node.key} color={colors.accent}>
              {children}
            </FilePathText>
          ) : (
            <Text
              key={node.key}
              style={ruleStyles.link}
              onPress={() => onLinkPress(href)}
            >
              {children}
            </Text>
          );
        },
        image: (node) => (
          <AssistantImage
            key={node.key}
            source={String(node.attributes.src ?? "")}
            alt={String(node.attributes.alt ?? "")}
            workspaceRoot={workspaceRoot}
          />
        ),
        fence: (node, _children, _parents, ruleStyles, inherited = {}) => (
          <HighlightedCode
            key={node.key}
            code={node.content.replace(/\n$/, "")}
            info={(node as ASTNode & { sourceInfo?: string }).sourceInfo}
            surface0={colors.surface0}
            style={[inherited, ruleStyles.fence]}
          />
        ),
        code_block: (node, _children, _parents, ruleStyles, inherited = {}) => (
          <HighlightedCode
            key={node.key}
            code={node.content.replace(/\n$/, "")}
            info={null}
            surface0={colors.surface0}
            style={[inherited, ruleStyles.code_block]}
          />
        ),
      };
    }, [
      colors.accent,
      colors.foreground,
      colors.surface0,
      host.id,
      onLinkPress,
      width,
      workspaceRoot,
    ]);

    const copySource = useCallback(async () => {
      try {
        await copyText(sourceText);
        toast.show("Source copied", { variant: "success" });
      } catch {
        toast.error("Unable to copy the source.");
      }
    }, [sourceText, toast]);

    return (
      <MathErrorBoundary
        source={sourceText}
        color={colors.foreground}
        fontSize={fontSize}
        lineHeight={fontSize * 1.5}
      >
        <View
          style={{ minWidth: 0, width: "100%", paddingRight: 44, minHeight: 44 }}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        >
          <Markdown
            markdownit={markdown}
            style={styles}
            rules={rules}
            onLinkPress={onLinkPress}
          >
            {text}
          </Markdown>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy source"
            onPress={copySource}
            style={({ pressed }) => ({
              position: "absolute",
              top: 0,
              right: 0,
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name="Copy" size={14} color={colors.foregroundMuted} />
          </Pressable>
        </View>
      </MathErrorBoundary>
    );
  },
  (previous, next) => {
    const a = previous.theme.colors;
    const b = next.theme.colors;
    return (
      previous.item.data.text === next.item.data.text &&
      previous.item.data.phase === next.item.data.phase &&
      previous.host.id === next.host.id &&
      previous.layout.compact === next.layout.compact &&
      a.foreground === b.foreground &&
      a.foregroundMuted === b.foregroundMuted &&
      a.surface0 === b.surface0 &&
      a.surface1 === b.surface1 &&
      a.surface2 === b.surface2 &&
      a.border === b.border &&
      a.accent === b.accent
    );
  },
);
