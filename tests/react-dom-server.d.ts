// @types/react-dom is not a dependency; tests use only this one function.
declare module "react-dom/server" {
  export function renderToStaticMarkup(element: unknown): string;
}
