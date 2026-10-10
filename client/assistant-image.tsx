import { useRpc } from "@getpaseo/plugin/client";
import { useEffect, useMemo, useState } from "react";
import { Image, Text, View } from "react-native";
import { readImage, type ImageOutput } from "../shared/image.js";
import { imageKey, peekImage, requestImage } from "./image-cache.js";
import { localFileSourceToPath } from "./vendor/local-file-source.js";
import { resolveFilePreviewReadTarget } from "./vendor/preview-target.js";

const PLACEHOLDER_HEIGHT = 120;
type Size = { key: string; width: number | undefined; ratio: number };

export function AssistantImage({
  source,
  alt,
  workspaceRoot,
  hostId = "",
  messageKey = "",
}: {
  source: string;
  alt: string;
  workspaceRoot: string | undefined;
  hostId?: string;
  /** Identifies the message occurrence, so a file rewritten for a later message is read again. */
  messageKey?: string;
}) {
  const call = useRpc(readImage);
  const trimmed = source.trim();
  const direct = /^(https?:|data:|blob:)/i.test(trimmed);
  const target = direct
    ? null
    : resolveFilePreviewReadTarget({ path: localFileSourceToPath(trimmed), workspaceRoot });
  const cwd = target?.cwd;
  const filePath = target?.path;
  const key = cwd !== undefined && filePath !== undefined ? imageKey(`${hostId}\0${messageKey}`, cwd, filePath) : null;
  // State is tagged with its key so a changed source never renders the previous image.
  const [loaded, setLoaded] = useState<{ key: string; result: ImageOutput | null } | null>(null);
  const cached = key ? peekImage(key) : undefined;
  const result = cached ?? (key !== null && loaded?.key === key ? loaded.result : undefined);

  useEffect(() => {
    if (key === null || cwd === undefined || filePath === undefined || peekImage(key)) return;
    let current = true;
    void requestImage(key, { cwd, path: filePath }, call).then((next) => {
      if (current) setLoaded({ key, result: next });
    });
    return () => {
      current = false;
    };
  }, [call, key, cwd, filePath]);

  const uri = useMemo(
    () =>
      direct ? trimmed : result?.ok ? `data:${result.mime};base64,${result.base64}` : undefined,
    [direct, trimmed, result],
  );
  const sizeKey = direct ? trimmed : key;
  const [size, setSize] = useState<Size | null>(null);

  useEffect(() => {
    if (!uri || sizeKey === null) return;
    let current = true;
    Image.getSize(
      uri,
      (width, height) => {
        if (current && width > 0 && height > 0) setSize({ key: sizeKey, width, ratio: width / height });
      },
      () => {
        if (current) setSize({ key: sizeKey, width: undefined, ratio: 16 / 9 });
      },
    );
    return () => {
      current = false;
    };
  }, [uri, sizeKey]);

  if (key === null && !direct) return <Text selectable>{alt || source}</Text>;
  if (result === null || (result && !result.ok)) return <Text selectable>{alt || source}</Text>;
  if (!uri) return <View style={{ width: "100%", height: PLACEHOLDER_HEIGHT }} />;
  const known = size && size.key === sizeKey ? size : null;
  return (
    <Image
      accessibilityLabel={alt}
      source={{ uri }}
      style={
        known
          ? { width: "100%", maxWidth: known.width, aspectRatio: known.ratio }
          : { width: "100%", height: PLACEHOLDER_HEIGHT }
      }
      resizeMode="contain"
    />
  );
}
