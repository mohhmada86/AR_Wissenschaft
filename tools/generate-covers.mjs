import { readFile, writeFile, mkdir, readdir, unlink, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { COVER_VERSION, coverModel, artworkSVG } from "../assets/js/cover-design.js";
import { validateData } from "../assets/js/common.js";

export const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
async function readJSON(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error.code === "ENOENT" && fallback !== undefined) return fallback; throw error; }
}
const exists = async path => { try { const info = await stat(path); return info.isFile() && info.size > 0; } catch { return false; } };
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

export async function generate({ root = PROJECT, force = false, strict = false } = {}) {
  const books = await readJSON(resolve(root, "data/books.json"));
  const updates = await readJSON(resolve(root, "data/updates.json"), []);
  const checked = validateData(books, updates);
  if (checked.errors.length) throw new Error("Catalog validation failed:\n" + checked.errors.join("\n"));
  const config = await readJSON(resolve(root, "data/cover-overrides.json"), {});
  const old = await readJSON(resolve(root, "data/covers.json"), { books: {} });
  const output = resolve(root, "assets/covers/generated");
  await mkdir(output, { recursive: true });
  const rendererHash = sha256(Buffer.concat(await Promise.all([
    "tools/render-covers.py", "assets/js/cover-design.js"
  ].map(name => readFile(resolve(PROJECT, name))))));
  const fontHash = sha256(Buffer.concat(await Promise.all(["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"].map(name => readFile(resolve(root, "assets/fonts", name))))));
  const manifest = { version: COVER_VERSION, renderer: rendererHash, fonts: fontHash, books: {} };
  const jobs = [];
  let skipped = 0;
  for (const book of books) {
    const model = coverModel(book, config);
    const path = `assets/covers/generated/${book.id}.svg`;
    const hash = sha256(JSON.stringify([model, rendererHash, fontHash]));
    const previous = old.books?.[book.id];
    if (model.image && await exists(resolve(root, model.image))) {
      manifest.books[book.id] = { path: model.image, signature: model.signature, hash, subject: model.subject,
        asset_sha256: sha256(await readFile(resolve(root, model.image))), explicit: true };
      continue;
    }
    if (model.image) console.warn(`Explicit cover missing for ${book.id}; automatic design remains available: ${model.image}`);
    if (!force && previous?.hash === hash && await exists(resolve(root, path))
      && previous.asset_sha256 === sha256(await readFile(resolve(root, path)))
      && (await Promise.all(Object.entries(previous.derivatives || {}).map(async ([name, sum]) =>
        await exists(resolve(output, name)) && sha256(await readFile(resolve(output, name))) === sum))).every(Boolean)) {
      manifest.books[book.id] = previous;
      skipped++;
    } else {
      jobs.push({ model, artwork: artworkSVG(model), destination: resolve(root, path), path, hash });
    }
  }
  const results = [];
  if (jobs.length) {
    const rendered = spawnSync(process.env.COVER_PYTHON || "python3", [resolve(PROJECT, "tools/render-covers.py")], {
      input: JSON.stringify({ font_directory: resolve(root, "assets/fonts"), covers: jobs }),
      encoding: "utf8", maxBuffer: 32 * 1024 * 1024
    });
    let response;
    try { response = JSON.parse(rendered.stdout); }
    catch { response = { results: jobs.map(job => ({ id: job.model.id, ok: false, error: rendered.error?.message || rendered.stderr || "Cover renderer did not return JSON" })) }; }
    for (const result of response.results) {
      results.push(result);
      const job = jobs.find(item => item.model.id === result.id);
      if (result.ok) manifest.books[result.id] = {
        path: result.derivatives?.[`${result.id}.webp`] ? job.path.replace(/\.svg$/, '.webp') : job.path,
        svg_path: job.path,
        small_path: result.derivatives?.[`${result.id}-360.webp`] ? job.path.replace(/\.svg$/, '-360.webp') : "",
        derivatives: result.derivatives,
        signature: job.model.signature, hash: job.hash,
        asset_sha256: result.sha256, bytes: result.bytes, subject: job.model.subject,
        palette: job.model.paletteIndex, composition: job.model.composition,
        layout: result.layout
      };
      else console.warn(`Cover fallback for ${result.id}: ${result.error}`);
    }
  }
  // Restrict cleanup to generated assets; never touch original cover art or PDFs.
  const active = new Set(books.flatMap(book => [`${book.id}.svg`, `${book.id}.webp`, `${book.id}-360.webp`]));
  let removed = 0;
  for (const file of await readdir(output)) {
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*\.(svg|webp)$/.test(file) && !active.has(file)) {
      await unlink(resolve(output, file)); removed++;
    }
  }
  manifest.books = Object.fromEntries(Object.entries(manifest.books).sort(([a], [b]) => a.localeCompare(b, "en")));
  await writeFile(resolve(root, "data/covers.json"), JSON.stringify(manifest, null, 2) + "\n");
  const report = { total: books.length, generated: results.filter(r => r.ok).length,
    skipped, removed, fallback: results.filter(r => !r.ok),
    subjects: [...new Set(Object.values(manifest.books).map(b => b.subject))].sort() };
  console.log(JSON.stringify(report, null, 2));
  if (strict && report.fallback.length) throw new Error(`${report.fallback.length} covers could not be generated`);
  return { report, manifest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const index = args.indexOf("--root");
  generate({ root: index >= 0 ? resolve(args[index + 1]) : PROJECT, force: args.includes("--force"), strict: args.includes("--strict") })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
