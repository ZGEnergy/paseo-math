import type { ComponentType, ReactNode } from "react";
import { Text } from "react-native";

type Props = {
  source: string;
  color: string;
  fontSize: number;
  lineHeight: number;
  children: ReactNode;
};
type State = { failed: boolean; source: string };

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
  this.state = { failed: false, source: props.source };
}
Boundary.prototype.isReactComponent = {};
Boundary.prototype.render = function render(this: {
  props: Props;
  state: State;
}) {
  return this.state.failed ? (
    <Text
      selectable
      style={{
        color: this.props.color,
        fontSize: this.props.fontSize,
        lineHeight: this.props.lineHeight,
      }}
    >
      {this.props.source}
    </Text>
  ) : (
    this.props.children
  );
};
Boundary.getDerivedStateFromError = () => ({ failed: true });
// A throw on a transient streaming prefix must not stick once the source moves on.
Boundary.getDerivedStateFromProps = (props: Props, state: State) =>
  props.source === state.source
    ? null
    : { failed: false, source: props.source };

export const MathErrorBoundary = Boundary as unknown as ComponentType<Props>;
