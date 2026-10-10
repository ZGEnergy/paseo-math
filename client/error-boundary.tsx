import type { ComponentType, ReactNode } from "react";
import { Text } from "react-native";

type Props = { source: string; children: ReactNode };
type State = { failed: boolean };

// A throwing renderer makes the host replace the whole message with a
// "Plugin failed" card. Fall back to the raw source instead.
//
// Written as a prototype-based class component, not `class`/`extends
// Component`: client bundles must contain no class syntax (Hermes eval cannot
// lower it, see scripts/smoke.mjs), and Metro does not guarantee a named
// `Component` export for plugin bundles. React only needs
// `prototype.isReactComponent`, `render`, and the static error hook.
function Boundary(this: { props: Props; state: State }, props: Props) {
  this.props = props;
  this.state = { failed: false };
}
Boundary.prototype.isReactComponent = {};
Boundary.prototype.render = function render(this: {
  props: Props;
  state: State;
}) {
  return this.state.failed ? (
    <Text selectable>{this.props.source}</Text>
  ) : (
    this.props.children
  );
};
Boundary.getDerivedStateFromError = (): State => ({ failed: true });

export const MathErrorBoundary = Boundary as unknown as ComponentType<Props>;
