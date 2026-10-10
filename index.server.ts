import type { PluginServerContext } from "@getpaseo/plugin/server";
import { readImage } from "./shared/image.js";
import { renderMath } from "./shared/render.js";
import { readImageFile } from "./server/image.js";
import { renderFormula } from "./server/render.js";

export default function setup(server: PluginServerContext) {
  server.handle(renderMath, renderFormula);
  server.handle(readImage, (input) => readImageFile(input));
  return () => {};
}
