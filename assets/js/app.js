import {
  STATUS, loadSite, loadCatalog, applyBranding, selectBooks, renderCard,
  sortedUpdates, renderEvent, el, notice, errorState, catalogWarnings
} from "./common.js";

const catalog = document.getElementById("catalog");
const feed = document.getElementById("recent-feed");
const filters = document.getElementById("filters");
const fields = document.getElementById("filter-fields");
const controls = Object.fromEntries(["search", "category", "status", "sort"].map(id => [id, document.getElementById(id)]));
let data = null;

function option(value, label) {
  const node = el("option", label);
  node.value = value;
  return node;
}

function renderResults() {
  if (!data) return;
  const books = selectBooks(data.books, data.updates, Object.fromEntries(Object.entries(controls).map(([key, node]) => [key, node.value])));
  document.getElementById("result-count").textContent = `${books.length} من ${data.books.length} كتاب`;
  catalog.replaceChildren(...books.map(book => renderCard(book, data.updates, data.updatesAvailable)));
  if (!books.length) notice(catalog, data.books.length ? "لا توجد كتب مطابقة. جرّب كلمة أخرى أو أعد ضبط البحث." : "لا توجد كتب منشورة حاليًا. عُد لاحقًا للاطّلاع على الإضافات الجديدة.");
}

function renderFeed() {
  if (!data.updatesAvailable) return notice(feed, "التحديثات غير متاحة حاليًا. يمكنك تصفح الكتب وإعادة المحاولة لاحقًا.", "notice warning");
  const updates = sortedUpdates(data.updates).slice(0, 6);
  if (!updates.length) return notice(feed, "لم تُسجّل تحديثات بعد. ستظهر هنا الإصدارات والملاحظات الجديدة.");
  const list = el("ol", null, "feed");
  const booksByID = new Map(data.books.map(book => [book.id, book]));
  list.append(...updates.map(update => renderEvent(update, booksByID.get(update.book_id))));
  feed.replaceChildren(list);
}

async function start() {
  fields.disabled = true;
  catalog.setAttribute("aria-busy", "true");
  feed.setAttribute("aria-busy", "true");
  notice(catalog, "جارٍ تحميل الكتب…");
  try {
    data = await loadCatalog();
    const categories = [...new Set(data.books.map(book => book.category))].sort(new Intl.Collator("ar").compare);
    controls.category.replaceChildren(option("", "الكل"), ...categories.map(value => option(value, value)));
    const statuses = new Set(data.books.map(book => book.status));
    controls.status.replaceChildren(option("", "الكل"), ...Object.entries(STATUS).filter(([key]) => statuses.has(key)).map(([key, label]) => option(key, label)));
    catalogWarnings(document.getElementById("warnings"), data);
    fields.disabled = false;
    renderResults();
    renderFeed();
  } catch (error) {
    data = null;
    errorState(catalog, error, start);
    document.getElementById("result-count").textContent = "تعذر تحميل الكتب";
    notice(feed, "تحتاج قائمة التحديثات إلى بيانات الكتب. أعد المحاولة من رسالة الخطأ أعلاه.");
  } finally {
    catalog.setAttribute("aria-busy", "false");
    feed.setAttribute("aria-busy", "false");
  }
}

filters.addEventListener("submit", event => event.preventDefault());
filters.addEventListener("input", renderResults);
filters.addEventListener("change", renderResults);
filters.addEventListener("reset", () => { setTimeout(renderResults, 0); });
loadSite().then(site => { applyBranding(site); document.title = site.title; });
start();
