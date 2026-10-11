import test, { before } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, cp, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { COVER_VERSION, coverModel, artworkSVG, classify, THEMES, validImagePath } from "../assets/js/cover-design.js";
import { validateData, selectBooks, renderCard, bookURL, driveURL } from "../assets/js/common.js";
import { initializeCovers, displayCover, coverAsset } from "../assets/js/cover-client.js";
import { dailyBook, dailyMessage } from "../assets/js/reading-inspiration.js";
import { generate, PROJECT } from "../tools/generate-covers.mjs";

const readJSON = async name => JSON.parse(await readFile(resolve(PROJECT, name), "utf8"));
const books = await readJSON("data/books.json");
const overrides = await readJSON("data/cover-overrides.json");
const assets = await readJSON("data/covers.json");

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.handlers = {}; this.style = { setProperty() {} }; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, callback) { (this.handlers[name] ||= []).push(callback); }
  dispatch(name) { for (const callback of this.handlers[name] || []) callback({ target: this }); }
}
const nodes = (node, predicate) => {
  const found = predicate(node) ? [node] : [];
  for (const child of node.children || []) if (typeof child === "object") found.push(...nodes(child, predicate));
  return found;
};
before(async () => {
  globalThis.document = { createElement: tag => new Element(tag) };
  globalThis.fetch = async url => ({ ok: true, json: async () => String(url).includes("overrides") ? overrides : assets });
  await initializeCovers();
});

test("catalog keeps its schema, valid IDs, links, and multi-part records", async () => {
  const checked = validateData(books, await readJSON("data/updates.json"));
  assert.deepEqual(checked.errors, []);
  assert.equal(new Set(books.map(book => book.id)).size, books.length);
  for (const book of books) if (book.drive_url) assert.equal(driveURL(book.drive_url), book.drive_url);
  const parts = books.filter(book => /young-freedman.*part-/.test(book.id));
  assert.equal(parts.length, 4);
  assert.equal(new Set(parts.map(book => book.drive_url)).size, 4);
});

test("all current records have usable generated assets and matching metadata", async () => {
  assert.equal(Object.keys(assets.books).length, books.length);
  const signatures = new Set();
  for (const book of books) {
    const model = coverModel(book, overrides);
    const asset = coverAsset(model, assets);
    assert.ok(asset, book.id);
    assert.ok((await stat(resolve(PROJECT, asset.path))).size > 0);
    if (!asset.explicit) {
      assert.equal(asset.layout.unknown_glyphs, 0, book.id);
      assert.ok(asset.layout.title_bottom < asset.layout.author_top - 20, book.id);
      assert.ok(asset.layout.minimum_title_font >= 18, book.id);
      assert.ok(asset.layout.art_height >= 80, book.id);
    }
    signatures.add(model.signature);
  }
  assert.equal(signatures.size, books.length);
});

test("stable IDs give deterministic illustrations; duplicate titles stay distinct", () => {
  const original = books[0];
  const a = coverModel(original, overrides), b = coverModel({ ...original }, overrides);
  assert.deepEqual(a, b); assert.equal(artworkSVG(a), artworkSVG(b));
  const duplicate = coverModel({ ...original, id: "different-edition" }, overrides);
  assert.notEqual(a.signature, duplicate.signature);
  assert.notEqual(artworkSVG(a), artworkSVG(duplicate));
  const renamed = coverModel({ ...original, title_ar: "عنوان جديد" }, overrides);
  assert.equal(renamed.seed, a.seed);
  assert.notEqual(renamed.signature, a.signature);
});

test("subject taxonomy covers all requested disciplines and respects explicit overrides", () => {
  assert.equal(Object.keys(THEMES).length, 14);
  for (const [category, title, expected] of [
    ["فيزياء", "Quantum Mechanics", "quantum"], ["هندسة كهربائية", "Microwave Engineering", "electronics"],
    ["رياضيات", "Geometry", "mathematics"], ["كيمياء", "Chemistry", "chemistry"],
    ["أحياء", "Cell Biology", "biology"], ["طب", "Cardiology", "medicine"],
    ["علوم الحاسوب", "Algorithms", "computing"], ["ذكاء اصطناعي", "AI", "ai"],
    ["هندسة", "Mechanics", "engineering"], ["فيزياء", "Astronomy", "astronomy"],
    ["فلسفة", "Modern Physics", "humanities"], ["تعلم اللغات", "German", "languages"],
    ["", "Untitled", "other"]
  ]) assert.equal(classify({ category, title_en: title }), expected);
  assert.equal(classify(books[0], { subject: "medicine" }), "medicine");
});

test("new, stale, missing, and failed cover assets use automatic live designs", () => {
  const added = { ...books[0], id: "new-auto-book", cover: "" };
  const cover = displayCover(added);
  assert.equal(cover.dataset.coverState, "automatic");
  assert.ok(cover.getAttribute("aria-label").includes(added.title_ar));
  assert.equal(cover.children[0].className.includes("generated-cover"), true);
  const changed = { ...books[0], title_ar: "عنوان تم تحديثه" };
  assert.equal(displayCover(changed).dataset.coverState, "automatic");
  const existing = displayCover(books[0]);
  assert.equal(existing.dataset.coverState, "generated");
  assert.equal(existing.children[0].loading, "lazy");
  existing.children[0].dispatch("error");
  assert.equal(existing.dataset.coverState, "automatic");
  assert.equal(displayCover(books[0], false).children[0].loading, "eager");
});

test("untrusted metadata is text; malicious image overrides cannot escape assets", () => {
  const malicious = { ...books[0], id: "unsafe-title", title_ar: '<script>alert("x")</script>', author: '<img onerror="alert(1)">' };
  const model = coverModel(malicious, { books: { "unsafe-title": { image: "javascript:alert(1)", subject: "<script>" } } });
  assert.equal(model.image, "");
  assert.ok(!artworkSVG(model).includes("alert("));
  const rendered = displayCover(malicious);
  const titles = nodes(rendered, node => node.className === "generated-title-ar");
  assert.equal(titles[0].textContent, malicious.title_ar);
  for (const value of ["../secret.svg", "/assets/cover.svg", "https://example.com/image.svg", "assets/../data/x.svg", "assets/x.svg?bad"]) assert.equal(validImagePath(value), false);
});

test("Arabic and English author/title searches and filters remain usable", () => {
  const arabic = selectBooks(books, [], { search: "بوزار" });
  const english = selectBooks(books, [], { search: "Pozar" });
  assert.ok(arabic.length > 0); assert.equal(arabic.length, english.length);
  assert.ok(selectBooks(books, [], { search: "الْإِلِكْتْرُونِيَّات" }).length > 0);
  assert.ok(selectBooks(books, [], { category: "رياضيات" }).every(book => book.category === "رياضيات"));
});

test("cards retain their exact book identity and detail navigation", () => {
  const book = books[0];
  const card = renderCard(book, [], true);
  assert.equal(card.dataset.bookId, book.id);
  const links = nodes(card, node => node.tagName === "a");
  assert.ok(links.length >= 3);
  assert.ok(links.every(node => node.href === bookURL(book.id)));
  assert.equal(new URL(bookURL(book.id)).searchParams.get("id"), book.id);
  assert.ok(new URL(bookURL(book.id)).pathname.endsWith("/book.html"));
});

test("daily discovery is stable, real, and independent of catalog order", () => {
  const date = new Date(2026, 9, 11);
  assert.equal(dailyBook(books, date).id, dailyBook([...books].reverse(), date).id);
  assert.equal(dailyBook([], date), null);
  assert.notEqual(dailyMessage(date).ar, dailyMessage(new Date(2026, 9, 12)).ar);
  assert.ok(books.some(book => book.id === dailyBook(books, date).id));
});

test("incremental generation adds, changes, repairs and removes assets without touching document URLs", async () => {
  const root = await mkdtemp(join(tmpdir(), "library-covers-"));
  try {
    await mkdir(join(root, "data"), { recursive: true });
    await cp(resolve(PROJECT, "assets/fonts"), join(root, "assets/fonts"), { recursive: true });
    const sample = [{ ...books.find(book => book.title_en), id: "automatic-sample", cover: "" }];
    await writeFile(join(root, "data/books.json"), JSON.stringify(sample));
    await writeFile(join(root, "data/updates.json"), "[]");
    const first = await generate({ root, strict: true });
    assert.equal(first.report.generated, 1);
    const svg = join(root, first.manifest.books[sample[0].id].svg_path);
    const hash = createHash("sha256").update(await readFile(svg)).digest("hex");
    const second = await generate({ root, strict: true });
    assert.equal(second.report.skipped, 1); assert.equal(second.report.generated, 0);
    const forced = await generate({ root, force: true, strict: true });
    assert.equal(forced.report.generated, 1);
    assert.equal(createHash("sha256").update(await readFile(svg)).digest("hex"), hash);
    sample.push({ ...sample[0], id: "automatic-sample-part-2" });
    await writeFile(join(root, "data/books.json"), JSON.stringify(sample));
    const added = await generate({ root, strict: true });
    assert.equal(added.report.generated, 1); assert.equal(added.report.skipped, 1);
    sample[0].title_en += " — corrected title";
    await writeFile(join(root, "data/books.json"), JSON.stringify(sample));
    const changed = await generate({ root, strict: true });
    assert.equal(changed.report.generated, 1); assert.equal(changed.report.skipped, 1);
    await rm(svg);
    const repaired = await generate({ root, strict: true });
    assert.equal(repaired.report.generated, 1);
    sample.shift();
    await writeFile(join(root, "data/books.json"), JSON.stringify(sample));
    const deleted = await generate({ root, strict: true });
    assert.ok(deleted.report.removed >= 1);
    assert.equal(Object.keys(deleted.manifest.books).length, 1);
    const manual = join(root, "assets/covers/chosen.svg");
    await writeFile(manual, artworkSVG(coverModel(sample[0])));
    await writeFile(join(root, "data/cover-overrides.json"), JSON.stringify({ books: { [sample[0].id]: { image: "assets/covers/chosen.svg" } } }));
    const explicit = await generate({ root, strict: true });
    assert.equal(explicit.manifest.books[sample[0].id].explicit, true);
    await writeFile(manual, (await readFile(manual, "utf8")) + "\n");
    const updatedArt = await generate({ root, strict: true });
    assert.notEqual(explicit.manifest.books[sample[0].id].asset_sha256, updatedArt.manifest.books[sample[0].id].asset_sha256);
    await rm(manual);
    const fallback = await generate({ root, strict: true });
    assert.equal(fallback.report.generated, 1);
    assert.equal((await readJSON("data/books.json")).find(book => book.id === books[0].id).drive_url, books[0].drive_url);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("invalid duplicate catalog IDs fail validation before generating assets", () => {
  assert.ok(validateData([books[0], books[0]], []).errors.some(message => message.includes("معرّف مكرر")));
});
