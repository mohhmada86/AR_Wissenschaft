import { cp, mkdir, rm, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generate, PROJECT } from "./generate-covers.mjs";

const force = process.argv.includes("--force");
await generate({ force });
const destination = resolve(PROJECT, "dist");
await rm(destination, { recursive: true, force: true });
await mkdir(resolve(destination, "tools"), { recursive: true });
for (const name of ["assets", "data", ".nojekyll"]) {
  await cp(resolve(PROJECT, name), resolve(destination, name), { recursive: true });
}
for (const name of await readdir(PROJECT)) {
  if (name.endsWith(".html")) await cp(resolve(PROJECT, name), resolve(destination, name));
}
for (const name of ["update-helper.html", "update-helper.js"]) {
  await cp(resolve(PROJECT, "tools", name), resolve(destination, "tools", name));
}
await writeFile(resolve(destination, ".nojekyll"), "");
console.log("Static site ready in dist/; original catalog and document links preserved.");
