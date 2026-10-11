import { COVER_VERSION, coverModel, artworkSVG, validImagePath } from "./cover-design.js";

const BASE = new URL("../../", import.meta.url);
let config = {};
let manifest = { books: {} };
let initialization;
const models = new Map();

async function optionalJSON(path) {
  try {
    const response = await fetch(new URL(path, BASE), { cache: "no-cache" });
    if (!response.ok) return {};
    const value = await response.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export function initializeCovers() {
  if (!initialization) initialization = Promise.all([
    optionalJSON("data/cover-overrides.json"), optionalJSON("data/covers.json")
  ]).then(([overrides, assets]) => { config = overrides; manifest = assets; models.clear(); });
  return initialization;
}

export function coverMetadata(book) {
  // Metadata can change while a page remains open: key by relevant content, not ID alone.
  const key = JSON.stringify([book.id, book.title_ar, book.title_en, book.author, book.category]);
  if (!models.has(key)) models.set(key, coverModel(book, config));
  return models.get(key);
}

export function coverAsset(model, assets = manifest) {
  const asset = assets.version === COVER_VERSION ? assets.books?.[model.id] : null;
  if (model.image) return asset?.explicit && asset.signature === model.signature && asset.path === model.image
    ? asset : { path: model.image, explicit: true };
  return asset?.signature === model.signature && validImagePath(asset.path) ? asset : null;
}

const node = (tag, className, content) => {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (content) result.textContent = content;
  return result;
};

function fallback(model) {
  const wrapper = node("span", `generated-cover composition-${model.composition}`);
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.style.setProperty("--cover-bg", model.palette[0]);
  wrapper.style.setProperty("--cover-ink", model.palette[1]);
  wrapper.style.setProperty("--cover-accent", model.palette[2]);
  const category = node("span", "generated-category", model.category);
  category.dir = "auto";
  const englishCategory = node("span", "generated-subject", model.subject_en);
  englishCategory.lang = "en"; englishCategory.dir = "ltr";
  const titles = node("span", "generated-titles");
  for (const [value, language, direction] of [[model.title_ar, "ar", "rtl"], [model.title_en, "en", "ltr"]]) {
    if (!value) continue;
    const title = node("span", `generated-title-${language}`, value);
    title.lang = language; title.dir = direction;
    titles.append(title);
  }
  const artwork = node("span", "generated-artwork");
  // SVG consists solely of trusted code and validated hex colors; no catalog text.
  artwork.innerHTML = artworkSVG(model);
  const authors = node("span", "generated-authors");
  for (const [value, direction] of [[model.author_ar, "rtl"], [model.author_en, "ltr"]]) {
    if (!value) continue;
    const author = node("span", "generated-author", value);
    author.dir = direction; author.lang = direction === "rtl" ? "ar" : "en";
    authors.append(author);
  }
  wrapper.append(category, englishCategory, titles, artwork, authors,
    node("span", "generated-footer", "العلم بالعربي · غلاف عرض"));
  return wrapper;
}

export function displayCover(book, lazy = true) {
  const model = coverMetadata(book);
  const container = node("span", "cover display-cover");
  container.dataset.bookId = book.id;
  container.setAttribute("role", "img");
  container.setAttribute("aria-label", [model.title_ar, model.title_en, model.author_ar, model.author_en,
    model.image ? "غلاف الكتاب" : "غلاف توضيحي خاص بالموقع"].filter(Boolean).join(" — "));
  const asset = coverAsset(model);
  const useFallback = () => {
    container.dataset.coverState = "automatic";
    container.replaceChildren(fallback(model));
  };
  if (!asset) { useFallback(); return container; }
  const image = node("img", "cover-asset");
  image.width = 600; image.height = 900; image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.loading = lazy ? "lazy" : "eager";
  image.decoding = "async";
  image.addEventListener("error", useFallback, { once: true });
  const url = new URL(asset.path, BASE);
  url.searchParams.set("v", asset.asset_sha256?.slice(0, 16) || model.signature);
  image.src = url.href;
  if (asset.small_path && validImagePath(asset.small_path)) {
    const small = new URL(asset.small_path, BASE); small.searchParams.set("v", asset.asset_sha256?.slice(0, 16) || model.signature);
    image.srcset = `${small.href} 360w, ${url.href} 600w`;
    image.sizes = lazy ? "(max-width: 600px) 110px, (max-width: 1100px) 220px, 250px" : "270px";
  }
  container.dataset.coverState = asset.explicit ? "explicit" : "generated";
  container.append(image);
  return container;
}
