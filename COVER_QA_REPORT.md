# Automatic covers — release QA / تقرير التحقق

Release: 11 October 2026. Source: the supplied AR_Wissenschaft-main ZIP and screenshot.

## Verified results

| Check | Result |
| --- | --- |
| Original / final book records | 154 / 154 |
| Catalog bytes, fields, IDs, titles, authors, categories and URLs | Identical to the original; SHA-256 below |
| Existing document destinations preserved | 154 |
| Generated vector covers | 154 |
| Distinct complete cover hashes | 154 |
| WebP derivatives | 308, at 360×540 and 600×900 |
| Average WebP size | 21,634 bytes (about 21.1 KiB) |
| Supported subject design families | 14 |
| Families represented in the real catalog | 11 |
| Cover rendering failures / missing glyphs | 0 / 0 |
| Full real-catalog titles and authors fitted | Yes; no compact/ellipsized cases |
| Functional tests | 11 passed, 0 failed, 0 skipped |
| Typography stress cases | 8 passed |
| Incremental build | 154 cached covers reused; 0 regenerated on unchanged inputs |
| Static production output | Built successfully into dist/ |
| HTML pages / local HTML references inspected | 6 / 85 |
| SVG XML, internal references and image decoding | Passed for all 154 SVGs and 308 WebP files |
| Workflow YAML / permission structure | Parsed and inspected; build read only, deployment scoped to Pages |

Catalog SHA-256: `f46deaf2493e8bf1b2a65068117f2510637c74159172660b5bc6c69a69bf526a`.
The book catalog, updates, site settings and community configuration remain byte-identical.
Original PDFs were never opened for alteration. Existing cover art and brand assets remain preserved.

## Functional behavior exercised

- New records display an automatic cover without a generated asset or manual image association.
- Changed title metadata invalidates the cached image; the existing stable ID retains its design seed.
- Failed, missing and stale images display a live subject-specific fallback.
- Repeated unchanged generation reuses assets. Forced generation produced identical SVG bytes in the deterministic test.
- Added records generate only their new assets; changes regenerate only affected records; missing assets are repaired.
- Removed records clean only generated files, preserving original cover art and document destinations.
- Duplicate titles with different IDs remain distinct. Duplicate IDs fail validation before generation.
- Multi-part entries remain exactly as supplied, including all four Young–Freedman parts and their separate destinations.
- Arabic/English title and author searches, category filtering and detail-page navigation pass the functional checks.
- Untrusted metadata remains text. Traversal paths, remote image URLs and executable URL overrides are rejected.
- Daily book selection uses real catalog records and is deterministic for a local calendar day.

## Typography and visual evidence

Arabic is shaped by Pango/HarfBuzz with bundled DejaVu Sans, then converted to glyph outlines.
The contact sheet shows actual rendered cover files, not a website mockup. Representative covers were visually inspected
for Arabic joining, title hierarchy, spacing, artwork variety and author placement.

The eight synthetic cases cover long Arabic titles, long English titles, multiple authors, Arabic only, English only,
mathematical symbols and numerals, missing optional metadata, and long unbroken technical identifiers.
Long synthetic samples use a compact cover layout with ellipsis at a readable font size; complete strings remain in
SVG descriptions and the actual card/detail text. No title/author block collisions or unknown glyphs were reported.
Synthetic QA records were never added to the real catalog.

Evidence:

- `qa/original-website-reference.png`: the user's original screenshot.
- `qa/cover-contact-sheet.png`: 21 representative actual generated covers across existing subjects.
- `qa/typography-contact-sheet.png`: eight clearly labeled synthetic typography proofs.
- `qa/catalog-baseline.json`: machine-readable original records and original-byte checksum.
- `qa/verification-results.json`, `qa/typography-results.json`: exact metrics.
- `qa/functional-tests.txt`, `qa/generation-log.txt`, `qa/build-log.txt`: executed command results.
- `qa/file-changes.json`: exact added/modified filenames, including every generated asset.

## Accessibility, responsiveness and verification limits

The implementation uses semantic directions and language tags, image roles and full metadata labels, keyboard-visible
focus, image dimensions, lazy loading, logical CSS properties and reduced-motion rules. It retains the existing navigation,
contact, review, maintenance and history features. Responsive rules cover 360, 600, 800 and 1100 px breakpoints.

**Actual browser viewport tests were unavailable and were not performed.** HTML/CSS inspection and DOM-level functional
checks do not replace browser layout or assistive-technology testing. There are no claimed after-update website screenshots;
the attached sheets prove generated artwork and typography only. Phone, tablet, desktop, LTR/mixed presentation and
full-page keyboard/assistive-technology verification remain to be checked in a browser.

**No live GitHub deployment or GitHub-hosted Actions run was performed in this session.** The static production build was
executed locally; the supplied workflow was parsed and inspected. Current branch publishing remains available. Optional
Actions deployment requires choosing Pages → GitHub Actions and setting `AUTO_DEPLOY_PAGES=true` as documented.
Google Drive destinations were compared exactly; remote sharing permissions and PDF availability were not probed.

## Metadata fallback cases and remaining data limits

Twelve original records contain no English title. Their Arabic titles are preserved; no English bibliography was invented.
Arabic author forms are supplied only through explicit, editable transliterations or existing Arabic metadata. Authors
without a complete Arabic mapping retain their original names. Edition text comes from supplied titles or optional explicit
metadata; the project revision number is never treated as a publisher edition.

The current catalog has no medicine, astronomy or generic-only records. These styles are supported and covered by the
classifier and synthetic tests, without inventing library holdings. Daily messages are original library copy with no fabricated
famous-person attribution, popularity scores or personal reading history.

## Reproduce

Follow `AUTOMATIC_COVERS.md` for renderer prerequisites and Pages settings. Commands actually exercised:

```bash
node tools/generate-covers.mjs --strict
npm test
npm run build
node tools/typography-proof.mjs
python3 tools/preview-covers.py
```

JavaScript syntax checks, Python compilation, YAML parsing, original-data byte comparisons, local-reference inspection,
SVG XML/reference validation, SHA-256 asset verification and WebP decoding were also completed.
