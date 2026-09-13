export const BASE = new URL("../../", import.meta.url);
export const STATUS = Object.freeze({
  review: "قيد المراجعة",
  translation: "قيد الترجمة",
  correction: "قيد التصحيح",
  final_review: "مراجعة نهائية",
  complete: "مكتمل",
  paused: "متوقف مؤقتًا",
  coming_soon: "قريبًا"
});
export const UPDATE_TYPES = Object.freeze({
  release: "إصدار", correction: "تصحيح", progress: "تقدم المراجعة",
  status: "تغيير الحالة", note: "ملاحظة"
});
export const DEFAULT_SITE = Object.freeze({
  title: "مشروع القراءة والمراجعة الجماعية",
  intro: "اختر كتابًا، واقرأ النسخة الحالية، وشارك بملاحظاتك وتصحيحاتك.",
  about: "مساحة للقراءة الجماعية ومراجعة الكتب في مختلف التخصصات.",
  github_url: "", site_url: ""
});
export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const VERSION_PATTERN = /^v\d+\.\d+$/;
const nonempty = value => typeof value === "string" && value.trim().length > 0;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });
const dateFormatter = new Intl.DateTimeFormat("ar-EG-u-ca-gregory-nu-latn", {
  year: "numeric", month: "long", day: "numeric", timeZone: "UTC"
});

export function localURL(path = "index.html") {
  return new URL(path, BASE).href;
}

export function bookURL(id, history = false) {
  const url = new URL("book.html", BASE);
  url.searchParams.set("id", id);
  if (history) url.hash = "updates";
  return url.href;
}

export function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function formatDate(value) {
  return validDate(value) ? dateFormatter.format(new Date(value + "T00:00:00Z")) : "تاريخ غير متاح";
}

export function safeHTTPS(value) {
  if (!nonempty(value) || /[\s\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    return url;
  } catch { return null; }
}

export function driveURL(value) {
  const url = safeHTTPS(value);
  if (!url || url.hostname !== "drive.google.com") return null;
  // PDF sharing links use these file routes; folder and download routes are excluded.
  const fileRoute = /^\/file\/d\/[a-zA-Z0-9_-]+\/(?:view|preview)\/?$/.test(url.pathname);
  const legacyRoute = url.pathname === "/open" && /^[a-zA-Z0-9_-]+$/.test(url.searchParams.get("id") || "");
  return fileRoute || legacyRoute ? url.href : null;
}

export function validCover(value) {
  if (value === "") return true;
  return typeof value === "string" && /^[a-zA-Z0-9._/-]+\.(?:svg|webp|png|jpe?g)$/i.test(value)
    && !value.startsWith("/") && value.split("/").every(part => part && part !== "." && part !== "..");
}

function unavailableURL(value) {
  return value === "" || value === "YOUR_GOOGLE_DRIVE_LINK_HERE";
}

export function parseJSON(text, name = "JSON") {
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`${name}: صيغة JSON غير صحيحة. افحص الأقواس والفواصل وعلامات التنصيص.`); }
  // JSON.parse alone silently accepts repeated keys. Scan valid JSON tokens to reject them.
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g) || [];
  const stack = [];
  for (const token of tokens) {
    const top = stack.at(-1);
    if (token === "{") stack.push({ keys: new Set(), keyNext: true });
    else if (token === "[") stack.push({ keys: null });
    else if (token === "}" || token === "]") stack.pop();
    else if (token === "," && top?.keys) top.keyNext = true;
    else if (token.startsWith('"') && top?.keys && top.keyNext) {
      const key = JSON.parse(token);
      if (top.keys.has(key)) throw new Error(`${name}: مفتاح مكرر «${key}». احتفظ بنسخة واحدة من الحقل.`);
      top.keys.add(key);
      top.keyNext = false;
    }
  }
  return data;
}

export async function fetchJSON(path) {
  try {
    const response = await fetch(localURL(path), { cache: "no-cache" });
    if (!response.ok) throw new Error(`${path}: تعذر التحميل (HTTP ${response.status}).`);
    return parseJSON(await response.text(), path);
  } catch (error) {
    if (error instanceof TypeError) throw new Error(`${path}: تعذر الاتصال. افتح الموقع عبر HTTP(S) وتحقق من وجود الملف.`);
    throw error;
  }
}

export function validateData(books, updates) {
  const errors = [];
  const badBooks = new Set();
  const badUpdates = new Set();
  function fail(file, index, field, message) {
    errors.push(`${file}[${index + 1}].${field}: ${message}`);
    (file === "books.json" ? badBooks : badUpdates).add(index);
  }
  if (!Array.isArray(books)) errors.push("books.json: يجب أن يحتوي مصفوفة بين [ و ].");
  if (!Array.isArray(updates)) errors.push("updates.json: يجب أن يحتوي مصفوفة بين [ و ].");
  const bookList = Array.isArray(books) ? books : [];
  const updateList = Array.isArray(updates) ? updates : [];
  function checkRecords(records, file, required) {
    const seen = new Map();
    records.forEach((record, index) => {
      const error = (field, message) => fail(file, index, field, message);
      if (!object(record)) return error("record", "يجب أن يكون السجل كائنًا بين { و }.");
      for (const field of required) if (!nonempty(record[field])) error(field, "نص غير فارغ مطلوب.");
      if (typeof record.id !== "string" || !ID_PATTERN.test(record.id)) error("id", "استخدم حروفًا إنجليزية صغيرة وأرقامًا وشرطات مفردة.");
      else if (seen.has(record.id)) {
        error("id", `معرّف مكرر: ${record.id}.`);
        fail(file, seen.get(record.id), "id", `معرّف مكرر: ${record.id}.`);
      } else seen.set(record.id, index);
      const dateField = file === "books.json" ? "last_updated" : "date";
      if (!validDate(record[dateField])) error(dateField, "تاريخ تقويمي صحيح بصيغة YYYY-MM-DD مطلوب.");
      if (typeof record.version !== "string" || !(VERSION_PATTERN.test(record.version) || (file === "updates.json" && record.version === ""))) error("version", "استخدم v1.0؛ ويسمح بالنص الفارغ للأحداث فقط.");
      const url = record.drive_url;
      if (!(file === "updates.json" && url === undefined) && (typeof url !== "string" || (!unavailableURL(url) && !driveURL(url)))) error("drive_url", "ضع رابط ملف HTTPS من drive.google.com أو اتركه فارغًا.");
    });
  }
  checkRecords(bookList, "books.json", ["title_ar", "author", "category", "description"]);
  bookList.forEach((book, index) => {
    if (!object(book)) return;
    const error = (field, message) => fail("books.json", index, field, message);
    if (book.title_en !== undefined && typeof book.title_en !== "string") error("title_en", "يجب أن يكون نصًا؛ يمكن تركه فارغًا.");
    if (!validCover(book.cover)) error("cover", "مسار محلي دون / في البداية أو ..؛ أو نص فارغ.");
    if (typeof book.status !== "string" || !owns(STATUS, book.status)) error("status", "اختر مفتاح حالة معتمدًا.");
    if (book.progress != null && (typeof book.progress !== "number" || !Number.isFinite(book.progress) || book.progress < 0 || book.progress > 100)) error("progress", "رقم من 0 إلى 100 أو null، دون علامة %. ");
    for (const field of ["enabled", "demo"]) if (typeof book[field] !== "boolean") error(field, "القيمة true أو false مطلوبة.");
  });
  const validBooks = bookList.filter((_, index) => !badBooks.has(index));
  const bookIDs = new Set(validBooks.map(book => book.id));
  checkRecords(updateList, "updates.json", ["book_id", "title", "description"]);
  updateList.forEach((update, index) => {
    if (!object(update)) return;
    if (typeof update.type !== "string" || !owns(UPDATE_TYPES, update.type)) fail("updates.json", index, "type", "اختر نوع حدث معتمدًا.");
    if (!bookIDs.has(update.book_id)) fail("updates.json", index, "book_id", "لا يطابق معرّف كتاب صالح وفريد.");
  });
  return { errors, books: validBooks, updates: updateList.filter((_, index) => !badUpdates.has(index)) };
}

export function validateSite(site) {
  const errors = [];
  if (!object(site)) return ["site.json: كائن واحد مطلوب."];
  for (const field of ["title", "intro", "about"]) if (!nonempty(site[field])) errors.push(`site.json.${field}: نص غير فارغ مطلوب.`);
  for (const field of ["github_url", "site_url"]) {
    if (site[field] === "") continue;
    const url = safeHTTPS(site[field]);
    if (!url || (field === "github_url" && url.hostname !== "github.com") || (field === "site_url" && (!url.pathname.endsWith("/") || url.search || url.hash))) errors.push(`site.json.${field}: رابط HTTPS صالح مطلوب أو نص فارغ.`);
  }
  return errors;
}

export async function loadSite() {
  try {
    const site = await fetchJSON("data/site.json");
    return validateSite(site).length ? { ...DEFAULT_SITE } : site;
  } catch { return { ...DEFAULT_SITE }; }
}

export async function loadCatalog() {
  const [bookResult, updateResult] = await Promise.allSettled([
    fetchJSON("data/books.json"), fetchJSON("data/updates.json")
  ]);
  if (bookResult.status === "rejected") throw bookResult.reason;
  if (!Array.isArray(bookResult.value)) throw new Error("books.json: يجب أن يحتوي مصفوفة.");
  const updatesAvailable = updateResult.status === "fulfilled" && Array.isArray(updateResult.value);
  const checked = validateData(bookResult.value, updatesAvailable ? updateResult.value : []);
  const books = checked.books.filter(book => book.enabled);
  const enabledIDs = new Set(books.map(book => book.id));
  return { books, updates: checked.updates.filter(update => enabledIDs.has(update.book_id)),
    errors: checked.errors, updatesAvailable };
}

export function sortedUpdates(updates) {
  return updates.map((update, index) => ({ update, index }))
    .sort((a, b) => b.update.date.localeCompare(a.update.date) || a.index - b.index)
    .map(item => item.update);
}

export function relatedUpdates(book, updates) {
  return sortedUpdates(updates.filter(update => update.book_id === book.id));
}

export function latestDate(book, updates) {
  return updates.reduce((latest, update) => update.book_id === book.id && update.date > latest ? update.date : latest, book.last_updated);
}

export function normalizeSearch(value) {
  return value.trim().toLocaleLowerCase("en").normalize("NFD")
    .replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/\s+/g, " ");
}

export function compareTitles(a, b) {
  return collator.compare(a.title_ar, b.title_ar) || a.id.localeCompare(b.id);
}

export function selectBooks(books, updates, { search = "", category = "", status = "", sort = "latest" } = {}) {
  const query = normalizeSearch(search);
  return books.filter(book => book.enabled && (!category || book.category === category) && (!status || book.status === status)
    && normalizeSearch([book.title_ar, book.title_en || "", book.author, book.category].join(" ")).includes(query))
    .sort((a, b) => {
      let order = 0;
      if (sort === "latest") order = latestDate(b, updates).localeCompare(latestDate(a, updates));
      if (sort === "progress") order = (b.progress ?? -1) - (a.progress ?? -1);
      return order || compareTitles(a, b);
    });
}

export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}

export function isolated(text, direction = "auto", tag = "bdi") {
  const node = el(tag, text);
  node.dir = direction;
  return node;
}

export function link(text, href, className = "") {
  const anchor = el("a", text, className);
  anchor.href = href;
  return anchor;
}

export function externalLink(text, href, className = "") {
  const anchor = link(text, href, className);
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.append(el("span", " (يفتح في علامة تبويب جديدة)", "sr-only"));
  return anchor;
}

export function readingAction(value, label = "اقرأ وشارك في المراجعة", className = "button primary") {
  const url = driveURL(value);
  return url ? externalLink(label, url, className) : el("span", "الرابط غير متاح حاليًا", "unavailable");
}

export function coverImage(book, lazy = true) {
  const image = el("img", null, "cover");
  const fallback = localURL("assets/covers/placeholder.svg");
  image.width = 600;
  image.height = 900;
  image.alt = book.cover && !book.cover.endsWith("placeholder.svg") ? `غلاف ${book.title_ar}` : `غلاف توضيحي — ${book.title_ar}`;
  image.loading = lazy ? "lazy" : "eager";
  image.decoding = "async";
  image.addEventListener("error", () => { image.src = fallback; image.alt = `غلاف بديل — ${book.title_ar}`; }, { once: true });
  image.src = book.cover && validCover(book.cover) ? localURL(book.cover) : fallback;
  return image;
}

export function badges(book) {
  const row = el("div", null, "badges");
  row.append(el("span", STATUS[book.status], `badge status-${book.status}`));
  if (book.demo) row.append(el("span", "بيانات تجريبية", "badge demo-badge"));
  return row;
}

export function progressBlock(book) {
  if (book.progress == null) return null;
  const block = el("div", null, "progress-block");
  const label = el("div", null, "progress-label");
  label.append(el("span", "نسبة المراجعة"), isolated(`${book.progress}%`, "ltr"));
  const bar = el("progress");
  bar.max = 100;
  bar.value = book.progress;
  bar.setAttribute("aria-label", `نسبة المراجعة: ${book.progress}%؛ تقدير يحدّثه صاحب المشروع`);
  block.append(label, bar);
  return block;
}

export function dateNode(date) {
  const time = el("time", formatDate(date));
  time.dateTime = date;
  return time;
}

export function metadata(book, updates, updatesAvailable) {
  const list = el("dl", null, "metadata");
  const pairs = [
    ["المؤلف", isolated(book.author)], ["التخصص", isolated(book.category)],
    ["الإصدار الحالي", isolated(book.version, "ltr")],
    ["آخر تحديث", dateNode(latestDate(book, updates))],
    ["سجل التحديثات", updatesAvailable ? String(relatedUpdates(book, updates).length) : "غير متاح حاليًا"]
  ];
  for (const [label, value] of pairs) {
    const row = el("div");
    row.append(el("dt", label));
    const dd = el("dd");
    dd.append(value);
    row.append(dd);
    list.append(row);
  }
  return list;
}

export function renderCard(book, updates, updatesAvailable) {
  const card = el("article", null, "book-card");
  card.dataset.bookId = book.id;
  const top = el("div", null, "card-top");
  const title = el("div", null, "card-heading");
  const heading = el("h3");
  heading.append(link(book.title_ar, bookURL(book.id)));
  heading.dir = "auto";
  title.append(el("p", book.category, "eyebrow"), heading);
  if (book.title_en) title.append(isolated(book.title_en, "ltr", "p"));
  top.append(coverImage(book), title);
  card.append(top, badges(book), metadata(book, updates, updatesAvailable));
  const progress = progressBlock(book);
  if (progress) card.append(progress);
  const description = el("p", book.description, "description clamp");
  description.dir = "auto";
  card.append(description);
  const actions = el("div", null, "card-actions");
  actions.append(readingAction(book.drive_url));
  const secondary = el("div", null, "inline-links");
  secondary.append(link("تفاصيل الكتاب", bookURL(book.id)), link("سجل التحديثات", bookURL(book.id, true)));
  actions.append(secondary);
  card.append(actions);
  return card;
}

export function renderEvent(update, book, detail = false) {
  const item = el("li", null, "update-item");
  const meta = el("div", null, "event-meta");
  meta.append(el("span", UPDATE_TYPES[update.type], "event-type"), dateNode(update.date));
  if (update.version) meta.append(isolated(update.version, "ltr"));
  item.append(meta);
  if (!detail) item.append(link(book.title_ar, bookURL(book.id, true), "event-book"));
  if (book.demo) item.append(el("span", "بيانات تجريبية", "badge demo-badge"));
  const heading = el("h3", update.title);
  heading.dir = "auto";
  const description = el("p", update.description, detail ? "description" : "description clamp");
  description.dir = "auto";
  item.append(heading, description);
  if (detail && driveURL(update.drive_url)) {
    const older = (update.version && update.version !== book.version) || driveURL(update.drive_url) !== driveURL(book.drive_url);
    item.append(readingAction(update.drive_url, older ? "نسخة سابقة — ملف هذا الحدث" : "ملف هذا الحدث", "history-file"));
  }
  return item;
}

export function notice(container, message, className = "notice") {
  const node = el("p", message, className);
  container.replaceChildren(node);
}

export function errorState(container, error, retry) {
  const box = el("div", null, "notice error");
  box.setAttribute("role", "alert");
  box.append(el("h2", "تعذر تحميل الكتب"), el("p", error.message));
  const button = el("button", "إعادة المحاولة", "button");
  button.type = "button";
  button.addEventListener("click", retry);
  box.append(button);
  container.replaceChildren(box);
}

export function catalogWarnings(container, data) {
  container.replaceChildren();
  if (!data.updatesAvailable) container.append(el("p", "سجل التحديثات غير متاح حاليًا. تُعرض تواريخ بيانات الكتب مؤقتًا؛ أعد تحميل الصفحة للمحاولة مجددًا.", "notice warning"));
  if (data.errors.length) {
    const details = el("details", null, "notice warning");
    details.append(el("summary", "تم تجاهل سجلات غير صالحة. عرض تفاصيل التصحيح"));
    const list = el("ul");
    data.errors.forEach(message => { const item = el("li", message); item.dir = "auto"; list.append(item); });
    details.append(list);
    container.append(details);
  }
}

export function applyBranding(site) {
  document.querySelectorAll("[data-site-title]").forEach(node => { node.textContent = site.title; });
  document.querySelectorAll("[data-site-intro]").forEach(node => { node.textContent = site.intro; });
  document.querySelectorAll("[data-site-about]").forEach(node => { node.textContent = site.about; });
  document.querySelectorAll("[data-github]").forEach(node => {
    node.replaceChildren();
    const url = safeHTTPS(site.github_url);
    if (url?.hostname === "github.com") node.append(externalLink("GitHub", url.href));
    node.hidden = !node.childElementCount;
  });
  if (site.site_url && !validateSite(site).length) {
    let tag = document.querySelector('meta[property="og:url"]');
    if (!tag) { tag = el("meta"); tag.setAttribute("property", "og:url"); document.head.append(tag); }
    tag.content = site.site_url;
  }
}

export function scrollHistory() {
  if (location.hash !== "#updates") return;
  requestAnimationFrame(() => {
    const target = document.getElementById("updates");
    target?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
  });
}
