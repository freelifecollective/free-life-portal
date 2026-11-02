/* The map's background worker has to be served from our own site (the bundler cannot find it by itself). This copies the matching file out of the installed map library. */
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre-gl-worker.mjs");
