import { useRpc } from "@getpaseo/plugin/client";
import { useEffect, useState } from "react";
import { Image, Text } from "react-native";
import { readImage } from "../shared/image.js";
import { resolveFilePreviewReadTarget } from "./vendor/preview-target.js";

type State = { kind: "loading" } | { kind: "ready"; uri: string } | { kind: "failed" };

export function AssistantImage({
  source,
  alt,
  workspaceRoot,
}: {
  source: string;
  alt: string;
  workspaceRoot: string | undefined;
}) {
  const call = useRpc(readImage);
  const trimmed = source.trim();
  const direct = /^(https?:|data:|blob:)/i.test(trimmed);
  const target = direct ? null : resolveFilePreviewReadTarget({ path: trimmed, workspaceRoot });
  const cwd = target?.cwd;
  const filePath = target?.path;
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (cwd === undefined || filePath === undefined) return;
    let current = true;
    setState({ kind: "loading" });
    call({ cwd, path: filePath })
      .then((result) => {
        if (!current) return;
        setState(
          result.ok
            ? { kind: "ready", uri: `data:${result.mime};base64,${result.base64}` }
            : { kind: "failed" },
        );
      })
      .catch(() => {
        if (current) setState({ kind: "failed" });
      });
    return () => {
      current = false;
    };
  }, [call, cwd, filePath]);

  const shown: State = direct ? { kind: "ready", uri: trimmed } : target ? state : { kind: "failed" };
  if (shown.kind === "failed") return <Text selectable>{alt || source}</Text>;
  if (shown.kind === "loading") return null;
  return (
    <Image
      accessibilityLabel={alt}
      source={{ uri: shown.uri }}
      style={{ width: "100%", aspectRatio: 16 / 9 }}
      resizeMode="contain"
    />
  );
}
