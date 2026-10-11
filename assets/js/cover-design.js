// Shared by the browser and build tools. No network calls or DOM dependencies.
export const COVER_VERSION = "1.0.0";
export const THEMES = Object.freeze({
  physics: { ar: "فيزياء", en: "PHYSICS", palettes: [["#102e45", "#80c8ca", "#e9c484"], ["#243744", "#a6ccba", "#edc888"], ["#31394d", "#bdc5e8", "#e4be81"]] },
  quantum: { ar: "فيزياء الكم", en: "QUANTUM PHYSICS", palettes: [["#252448", "#b8a8e4", "#edc78d"], ["#19394a", "#88d1cd", "#c6b2e7"], ["#362b48", "#cba9d4", "#8ecdd2"]] },
  electronics: { ar: "إلكترونيات", en: "ELECTRONICS", palettes: [["#123c46", "#8bd0c9", "#e4b783"], ["#243349", "#99c4d5", "#e2af89"], ["#423128", "#d9bc93", "#8cccc5"]] },
  mathematics: { ar: "رياضيات", en: "MATHEMATICS", palettes: [["#344138", "#c2d7b2", "#ead099"], ["#28374c", "#b6cadf", "#e4c69b"], ["#3c3044", "#d2b8db", "#b5d2c3"]] },
  chemistry: { ar: "كيمياء", en: "CHEMISTRY", palettes: [["#3e342c", "#e3c5a1", "#aacdb8"], ["#1d403b", "#a2d2be", "#e3c597"], ["#453448", "#d6b3cd", "#e1c993"]] },
  biology: { ar: "علوم الحياة", en: "LIFE SCIENCES", palettes: [["#1b4037", "#a9d6bc", "#dfc793"], ["#21454c", "#9ccfd2", "#d7d29c"], ["#354631", "#bbd5a4", "#e2c792"]] },
  medicine: { ar: "طب", en: "MEDICINE", palettes: [["#23434b", "#a0d5d4", "#ebc9a0"], ["#433346", "#d2b6ce", "#e3c6a0"], ["#274439", "#b3d6bc", "#e7cd9e"]] },
  computing: { ar: "علوم الحاسوب", en: "COMPUTER SCIENCE", palettes: [["#243646", "#a5c9d7", "#dfbf89"], ["#2f3e39", "#b4cfb8", "#d1bdde"], ["#402f41", "#d0b0d6", "#a4cfc9"]] },
  ai: { ar: "ذكاء اصطناعي", en: "ARTIFICIAL INTELLIGENCE", palettes: [["#30304a", "#b5b5df", "#e6c48d"], ["#25433f", "#a7d4c6", "#d1bbe0"], ["#39304a", "#cab3df", "#8dcbd0"]] },
  engineering: { ar: "هندسة", en: "ENGINEERING", palettes: [["#3d3b31", "#d6c8a7", "#99c7c3"], ["#243e49", "#9bc4d4", "#e0bc8e"], ["#49332c", "#e1b99c", "#b3d0c6"]] },
  astronomy: { ar: "فلك", en: "ASTRONOMY", palettes: [["#1c2c43", "#a9c3df", "#e9c792"], ["#342b48", "#c1b0db", "#e5cb9f"], ["#193c45", "#9fd0cc", "#dcc095"]] },
  humanities: { ar: "فلسفة وإنسانيات", en: "HUMANITIES", palettes: [["#493b31", "#dfcaa8", "#bcc8ae"], ["#3e3343", "#ceb9cf", "#e2c698"], ["#354334", "#c2d0b1", "#dac198"]] },
  languages: { ar: "تعلم اللغات", en: "LANGUAGES", palettes: [["#3e3931", "#e0cda8", "#a6c6bb"], ["#333e4b", "#afc9db", "#e2c393"], ["#483440", "#d4b3c5", "#c8d2a9"]] },
  other: { ar: "معرفة", en: "KNOWLEDGE", palettes: [["#30423e", "#bcd3bd", "#e2c896"], ["#314052", "#b7cbdf", "#e1c59a"], ["#473c32", "#dfc9ae", "#b3cfbd"]] }
});

export const text = value => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim() : "";
export const xml = value => text(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
export function seed(value) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}

export function validImagePath(value) {
  return typeof value === "string" && /^assets\/[a-zA-Z0-9._/-]+\.(svg|png|webp|jpe?g)$/i.test(value)
    && value.split("/").every(part => part && part !== "." && part !== "..");
}

export function classify(book, override = {}) {
  if (Object.hasOwn(THEMES, override.subject)) return override.subject;
  const category = text(book.category).toLowerCase();
  const titles = [text(book.title_ar), text(book.title_en)].join(" ").toLowerCase();
  // Explicit categories take precedence over incidental words in a description.
  if (/ذكاء|artificial intelligence/.test(category)) return "ai";
  if (/تعلم اللغات|language/.test(category)) return "languages";
  if (/فلسف|humanit|philosoph/.test(category)) return "humanities";
  if (/أحياء|احياء|biolog/.test(category)) return "biology";
  if (/كيمياء|chemistr|biochem/.test(category)) return "chemistry";
  if (/طب|تمريض|medicin|nurs|cardiol/.test(category)) return "medicine";
  if (/رياضيات|math/.test(category)) return "mathematics";
  if (/إلكترونيات|الكترونيات|electronic/.test(category)) return "electronics";
  if (/علوم الحاسوب|computer|computing/.test(category)) return /artificial intelligence|machine learning|neural network/.test(titles) ? "ai" : "computing";
  if (/هندسة|علوم المواد|engineer|materials/.test(category)) return /circuit|electronic|microwave|rf circuit|دوائر|موجات الميكرو|إلكترون/.test(titles) ? "electronics" : "engineering";
  if (/فلك|astronom|cosmolog|astrophys/.test(category + " " + titles)) return "astronomy";
  if (/quantum|\bqed\b|الكم|كموم|ميكانيكا الكم/.test(titles)) return "quantum";
  if (/circuit|electronic|microwave|semiconductor|إلكترون|دوائر|أشباه/.test(titles)) return "electronics";
  if (/فيزياء|physic/.test(category)) return "physics";
  return "other";
}

function arabicAuthors(original, config) {
  if (!/[A-Za-zÀ-ž]/.test(original)) return original;
  const parts = original.split(/[؛;]/).map(part => part.trim());
  const converted = parts.map(part => text(config.authors?.[part]) || (!/[A-Za-zÀ-ž]/.test(part) ? part : ""));
  return converted.every(Boolean) ? converted.join("؛ ") : "";
}

export function coverModel(book, config = {}) {
  const override = config.books?.[book.id] || {};
  const subject = classify(book, override);
  const key = seed(text(book.id) || [text(book.title_ar), text(book.title_en), text(book.author)].join("|"));
  const style = THEMES[subject];
  const paletteIndex = Number.isInteger(override.palette) && override.palette >= 0 && override.palette < style.palettes.length ? override.palette : (key >>> 5) % style.palettes.length;
  const configured = config.styles?.[subject]?.palettes?.[paletteIndex];
  const palette = Array.isArray(configured) && configured.length === 3 && configured.every(c => /^#[0-9a-f]{6}$/i.test(c)) ? configured : style.palettes[paletteIndex];
  const author = text(book.author);
  const model = {
    id: text(book.id), seed: key, subject, subject_ar: style.ar, subject_en: style.en,
    category: text(book.category) || style.ar, palette, paletteIndex,
    composition: Number.isInteger(override.composition) && override.composition >= 0 && override.composition < 4 ? override.composition : (key >>> 11) % 4,
    motif: (key >>> 16) % 3,
    title_ar: text(override.title_ar) || text(book.title_ar),
    title_en: text(override.title_en) || text(book.title_en),
    author_ar: text(override.author_ar) || arabicAuthors(author, config),
    author_en: text(override.author_en) || (/[A-Za-zÀ-ž]/.test(author) ? author : ""),
    author_original: author,
    edition: text(override.edition), subtitle: text(override.subtitle),
    image: validImagePath(override.image) ? override.image : ""
  };
  if (!model.title_ar && !model.title_en) model.title_ar = "كتاب من المكتبة";
  const encoded = JSON.stringify([COVER_VERSION, model]);
  model.signature = seed(encoded).toString(16).padStart(8, "0") + seed("cover:" + encoded).toString(16).padStart(8, "0");
  return model;
}

function randomGenerator(key) {
  return () => { key = (Math.imul(1664525, key) + 1013904223) >>> 0; return key / 4294967296; };
}

// Original vector motifs; no copyrighted publisher artwork or external assets.
export function artworkSVG(model) {
  const [, ink, accent] = model.palette;
  const random = randomGenerator(model.seed);
  const n = value => Number(value.toFixed(2));
  const parts = [];
  const line = (x1, y1, x2, y2, color = ink, width = 2, opacity = 1) => parts.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`);
  const circle = (cx, cy, r, color = ink, fill = "none", opacity = 1) => parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" stroke="${color}" stroke-width="2" fill="${fill}" opacity="${opacity}"/>`);
  const path = (d, color = ink, width = 2, opacity = 1) => parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`);
  const rect = (x, y, w, h, color = ink, fill = "none", radius = 0) => parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" stroke="${color}" stroke-width="2" fill="${fill}"/>`);
  const wave = (y, amplitude, cycles, color, opacity = 1) => {
    let d = "";
    for (let x = 35; x <= 565; x += 3) d += `${x === 35 ? "M" : "L"}${x},${n(y + amplitude * Math.sin((x - 35) / 530 * Math.PI * 2 * cycles))} `;
    path(d, color, 2.5, opacity);
  };
  if (model.subject === "quantum") {
    const cycles = 2 + model.motif + random() * .65;
    for (let i = 0; i < 8; i++) wave(160 + (i - 3.5) * 8, 45 + i * 4, cycles + i * .025, i % 3 === 0 ? accent : ink, .3 + i * .08);
    line(35, 160, 565, 160, ink, 1, .25);
    if (model.motif === 1) for (let i = 0; i < 4; i++) { line(190 + i * 55, 30 + i * 35, 280 + i * 55, 30 + i * 35, accent); }
    else { circle(300, 160, 112, ink, "none", .3); circle(300, 160, 7, accent, accent); }
  } else if (["physics", "astronomy"].includes(model.subject)) {
    if (model.subject === "physics" && model.motif === 0) { for (let i = 0; i < 7; i++) wave(155 + (i - 3) * 13, 62 - i * 4, 1.5 + i * .13, i % 2 ? accent : ink, .5 + i * .055); }
    else {
      for (let i = 0; i < 4; i++) parts.push(`<ellipse cx="300" cy="160" rx="${74 + i * 43}" ry="${28 + i * 18}" transform="rotate(${(model.seed % 45) - 22} 300 160)" stroke="${i % 2 ? accent : ink}" opacity=".65" stroke-width="2" fill="none"/>`);
      circle(300, 160, 22, accent, accent);
      for (let i = 0; i < 8; i++) circle(60 + random() * 470, 40 + random() * 230, 2 + random() * 4, ink, ink, .55);
      circle(454, 193, 11, ink, ink);
    }
  } else if (model.subject === "electronics") {
    const offset = model.motif * 16 + Math.floor(random() * 22);
    rect(245, 88, 110, 132, accent, "none", 8);
    rect(270, 114, 60, 79, ink, "none", 3);
    for (let i = 0; i < 6; i++) {
      const y = 102 + i * 21;
      const left = 45 + (i % 3) * 30 + offset + Math.floor(random() * 18);
      const right = 554 - (i % 3) * 25 - offset - Math.floor(random() * 18);
      path(`M245 ${y} H${left + 28} V${y + (i % 2 ? 23 : -23)} H${left}`, ink, 2, .85);
      path(`M355 ${y} H${right - 28} V${y + (i % 2 ? -20 : 20)} H${right}`, ink, 2, .85);
      circle(left, y + (i % 2 ? 23 : -23), 5, accent); circle(right, y + (i % 2 ? -20 : 20), 5, accent);
    }
    for (let i = 0; i < 3; i++) { line(265 + i * 35, 88, 265 + i * 35, 55); line(265 + i * 35, 220, 265 + i * 35, 255); }
  } else if (model.subject === "mathematics") {
    line(52, 240, 550, 240, ink, 1, .4); line(95, 35, 95, 270, ink, 1, .4);
    for (let k = 0; k < 4; k++) {
      let d = "";
      for (let i = 0; i <= 180; i++) { const t = i / 180 * Math.PI * 2; const x = 315 + (156 + k * 12) * Math.cos(t * (2 + model.motif)); const y = 150 + (90 + k * 5) * Math.sin(t * 3 + k * .13); d += `${i ? "L" : "M"}${n(x)},${n(y)} `; }
      path(d + "Z", k % 2 ? accent : ink, 1.7, .65);
    }
  } else if (model.subject === "chemistry") {
    const shift = Math.floor(random() * 22);
    const centers = [[226 + shift, 128 + shift], [356 + shift, 128 + shift], [291 + shift, 233 + shift]];
    for (const [cx, cy] of centers.slice(0, model.motif === 0 ? 2 : 3)) {
      const points = Array.from({ length: 6 }, (_, i) => [cx + 68 * Math.cos(i * Math.PI / 3), cy + 68 * Math.sin(i * Math.PI / 3)]);
      path(points.map(([x, y], i) => `${i ? "L" : "M"}${n(x)},${n(y)}`).join(" ") + "Z", ink, 2.5);
      points.forEach(([x, y], i) => circle(x, y, 5, i % 2 ? accent : ink, i % 2 ? accent : ink));
      circle(cx, cy, 30, accent, "none", .5);
    }
    line(86, 108, 150, 108, accent); circle(72, 108, 14, accent); line(455, 180, 514, 212); circle(528, 220, 15, ink);
  } else if (model.subject === "biology") {
    if (model.motif === 0) {
      for (let i = 0; i < 19; i++) { const y = 20 + i * 15; const dx = 88 * Math.sin(i * .4); line(300 - dx, y, 300 + dx, y, i % 3 ? ink : accent, 2, .75); circle(300 - dx, y, 4, accent, accent); circle(300 + dx, y, 4, ink, ink); }
    } else {
      for (let i = 0; i < 8; i++) { const x = 80 + random() * 440; const y = 52 + random() * 205; const r = 25 + random() * 38; circle(x, y, r, ink, "none", .65); circle(x + 7, y - 4, r * .32, accent, "none", .9); for (let j = 0; j < 4; j++) circle(x + Math.cos(j * 1.8) * r * .6, y + Math.sin(j * 1.8) * r * .6, 3, ink, ink); }
    }
  } else if (model.subject === "medicine") {
    path("M55 165 H145 L165 145 L185 188 L205 88 L229 228 L250 165 H320 L335 152 L350 173 H545", ink, 3);
    path("M300 95 C245 40 195 93 225 138 L300 214 L375 138 C405 90 355 40 300 95 Z", accent, 2, .45);
  } else if (["computing", "ai"].includes(model.subject)) {
    const counts = model.subject === "ai" ? [2 + Math.floor(random() * 2), 4 + Math.floor(random() * 2), 3 + Math.floor(random() * 3), 2] : [1, 2, 3 + Math.floor(random() * 2), 2 + Math.floor(random() * 2)];
    const columns = counts.map((count, column) => Array.from({ length: count }, (_, i) => [80 + column * 144 + random() * 13, 160 + (i - (count - 1) / 2) * (47 + random() * 7)]));
    for (let c = 0; c < columns.length - 1; c++) for (const [x, y] of columns[c]) for (const [nx, ny] of columns[c + 1]) { if (model.subject === "ai" || random() > .36) line(x, y, nx, ny, ink, 1.1, .25 + random() * .38); }
    columns.forEach((nodes, c) => nodes.forEach(([x, y]) => { circle(x, y, 10 + model.motif * 2, c % 2 ? accent : ink, model.palette[0]); circle(x, y, 3, c % 2 ? accent : ink, c % 2 ? accent : ink); }));
  } else if (model.subject === "engineering") {
    rect(160, 55, 270, 205, ink, "none", 2);
    for (let i = 0; i < 6; i++) { line(160 + i * 45, 55, 160 + i * 45, 260, ink, 1, .18); line(160, 55 + i * 41, 430, 55 + i * 41, ink, 1, .18); }
    circle(295, 157, 73, accent); circle(295, 157, 39, ink);
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; line(295 + 74 * Math.cos(a), 157 + 74 * Math.sin(a), 295 + 86 * Math.cos(a), 157 + 86 * Math.sin(a), accent, 7); }
    line(135, 55, 135, 260, accent); line(128, 55, 142, 55); line(128, 260, 142, 260); line(160, 285, 430, 285, accent);
  } else if (model.subject === "languages") {
    path("M92 62 H323 Q342 62 342 82 V170 Q342 190 322 190 H198 L144 229 V190 H92 Q72 190 72 170 V82 Q72 62 92 62 Z", ink, 2.3);
    path("M307 118 H509 Q529 118 529 138 V223 Q529 243 509 243 H472 V278 L429 243 H307 Q287 243 287 223 V138 Q287 118 307 118 Z", accent, 2.3);
    parts.push(`<text x="195" y="154" text-anchor="middle" font-family="DejaVu Sans" font-size="65" fill="${ink}" direction="rtl">أ</text><text x="410" y="216" text-anchor="middle" font-family="DejaVu Sans" font-size="59" fill="${accent}">A</text>`);
  } else {
    for (let i = 0; i < 5; i++) { const shift = i * 19; path(`M${102 + shift} ${69 + shift * .3} Q${220 + shift} ${35 + shift * .3} 300 ${87 + shift * .3} Q${430 - shift} ${40 + shift * .3} ${508 - shift} ${70 + shift * .3} V${232 + shift * .3} Q420 ${215 + shift * .3} 300 ${254 + shift * .3} Q180 ${215 + shift * .3} ${102 + shift} ${233 + shift * .3} Z`, i % 2 ? accent : ink, 1.7, .4 + i * .1); }
    line(300, 90, 300, 254, accent, 2);
  }
  // Each composition changes the framing and relationship to the motif.
  const frame = model.composition === 0 ? `<rect x="18" y="12" width="564" height="296" rx="3" fill="none" stroke="${ink}" opacity=".25"/>`
    : model.composition === 1 ? `<path d="M22 84 V22 H134 M466 298 H578 V236" stroke="${accent}" fill="none" stroke-width="2"/>`
    : model.composition === 2 ? `<circle cx="300" cy="160" r="147" fill="none" stroke="${ink}" opacity=".25"/>` : `<path d="M30 280 H570 M30 40 H110" stroke="${accent}" fill="none" opacity=".4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">${frame}<g>${parts.join("")}</g></svg>`;
}
