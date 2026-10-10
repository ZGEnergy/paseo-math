type AssistantItem = { type: "assistant_message"; text: string; messageId?: string };
type Phase = "streaming" | "complete";

export function createTransformer(hasMath: (text: string) => boolean) {
  const objects = new WeakMap<object, { text: string; result: boolean }>();
  // Projection may clone settled items. Bound retained source while avoiding
  // reparsing those clones on every unrelated transcript/composer update.
  const sources = new Map<string, boolean>();
  let sourceCharacters = 0;
  function transform({ item, phase }: { item: AssistantItem; phase: Phase }) {
    const remembered = objects.get(item);
    let result =
      remembered?.text === item.text
        ? remembered.result
        : sources.get(item.text);
    if (result === undefined) {
      result = hasMath(item.text);
      if (item.text.length <= 512 * 1024) {
        sources.set(item.text, result);
        sourceCharacters += item.text.length;
        for (const source of sources.keys()) {
          if (sources.size <= 256 && sourceCharacters <= 512 * 1024) break;
          sources.delete(source);
          sourceCharacters -= source.length;
        }
      }
    }
    objects.set(item, { text: item.text, result });
    if (!result) return undefined;
    return {
      items: [
        {
          type: "plugin" as const,
          kind: "math-message",
          version: 2,
          data: {
            text: item.text,
            phase,
            ...(item.messageId ? { messageId: item.messageId } : {}),
          },
        },
      ],
    };
  }
  transform.clear = () => {
    sources.clear();
    sourceCharacters = 0;
  };
  return transform;
}
