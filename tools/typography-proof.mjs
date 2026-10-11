import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { coverModel, artworkSVG } from "../assets/js/cover-design.js";
import { PROJECT } from "./generate-covers.mjs";

// Synthetic typography samples, explicitly outside the real catalog.
const samples = [
  { id: "long-arabic", category: "فيزياء", title_ar: "مبادئ القياس والتحليل المتقدم في فيزياء الحالة الصلبة وأشباه الموصلات والأنظمة الإلكترونية والظواهر الكمية وتطبيقاتها التجريبية ".repeat(3), title_en: "Typography QA sample", author: "QA sample author" },
  { id: "long-english", category: "رياضيات", title_ar: "عينة اختبار للعناوين الطويلة", title_en: "Advanced Mathematical Methods for Scientific Computation, Measurement, Signal Processing and Multiscale Experimental Modeling ".repeat(3), author: "QA sample author" },
  { id: "many-authors", category: "أحياء", title_ar: "عينة اختبار أسماء المؤلفين", title_en: "Multiple-author Typography Sample", author: "QA author A; QA author B; QA author C; QA author D; QA author E; QA author F; QA author G; QA author H" },
  { id: "arabic-only", category: "طب", title_ar: "مبادئ القياس الطبي — عينة لاختبار العربية فقط", author: "مؤلف للاختبار" },
  { id: "english-only", category: "Astronomy", title_en: "Orbital Mechanics: An English-only QA Sample", author: "QA sample author" },
  { id: "mixed-symbols", category: "فيزياء", title_ar: "الطاقة E = ℏω، والقياس Δx · Δp ≥ ℏ/2: عينة اختبار 2026 (MOSFET)", title_en: "Mixed notation: E = ℏω, ∫ f(x) dx, μm, 10³", author: "QA sample author" },
  { id: "missing-metadata" },
  { id: "unbroken-title", title_en: "SchrodingerPoissonNumericalSemiconductorTransportMeasurement".repeat(5), category: "فيزياء", author: "QA sample author" }
];
await mkdir(resolve(PROJECT, "qa/typography"), { recursive: true });
const jobs = samples.map((sample, index) => {
  const config = { books: { [sample.id]: { composition: index % 4 } } };
  const model = coverModel(sample, config);
  return { model, artwork: artworkSVG(model), destination: resolve(PROJECT, `qa/typography/${sample.id}.svg`) };
});
const rendered = spawnSync(process.env.COVER_PYTHON || "python3", [resolve(PROJECT, "tools/render-covers.py")], {
  input: JSON.stringify({ font_directory: resolve(PROJECT, "assets/fonts"), covers: jobs }), encoding: "utf8", maxBuffer: 8 * 1024 * 1024
});
if (rendered.status) throw new Error(rendered.stderr || "Typography rendering failed");
const response = JSON.parse(rendered.stdout);
for (const result of response.results) {
  assert.ok(result.ok, result.id + ": " + result.error);
  assert.equal(result.layout.unknown_glyphs, 0, result.id);
  assert.ok(result.layout.title_bottom < result.layout.author_top - 20, result.id);
  assert.ok(result.layout.art_height > 0, result.id);
}
await writeFile(resolve(PROJECT, "qa/typography-results.json"), JSON.stringify({
  note: "Synthetic QA samples; no additions to books.json. Compact display lines retain full text in SVG metadata and card/detail text.",
  results: response.results
}, null, 2) + "\n");
console.log(`${response.results.length} typography cases passed: long Arabic/English, many authors, single language, symbols, missing fields and unbroken words.`);
