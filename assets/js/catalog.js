import {
  STATUS, BASE, loadSite, loadCatalog, applyBranding, selectBooks,
  renderCard, el, notice, catalogWarnings
} from "./common.js";

const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });
const catalog = document.getElementById("catalog");
const filters = document.getElementById("filters");
const fields = document.getElementById("filter-fields");
const controls = Object.fromEntries(
  ["search", "category", "status"].map(id => [id, document.getElementById(id)])
);
let data = null;
let visible = [];

function option(value, label) {
  const node = el("option", label);
  node.value = value;
  return node;
}

function requestedCategory() {
  return new URLSearchParams(location.search).get("category")?.trim() || "";
}

function updateCategoryURL() {
  const url = new URL("catalog.html", BASE);
  if (controls.category.value) url.searchParams.set("category", controls.category.value);
  history.replaceState(null, "", url);
}

function updateHeading() {
  const category = controls.category.value;
  const title = category ? `كتب مجال: ${category}` : "جميع الكتب";
  document.getElementById("catalog-title").textContent = title;
  document.getElementById("catalog-summary").textContent = category
    ? `تصفح الكتب المنشورة في مجال ${category} أو استخدم البحث للوصول إلى عنوان محدد.`
    : "ابحث عن كتاب بالعنوان أو المؤلف، أو اختر مجالًا وحالة.";
}

function renderResults() {
  if (!data) return;
  const books = selectBooks(visible, data.updates, {
    search: controls.search.value,
    category: controls.category.value,
    status: controls.status.value,
    sort: "latest"
  });

  updateHeading();
  document.getElementById("result-count").textContent = `${books.length} من ${visible.length} كتاب`;

  if (books.length) {
    catalog.replaceChildren(...books.map(book => renderCard(book, data.updates, data.updatesAvailable)));
    return;
  }

  if (controls.search.value.trim()) {
    notice(catalog, "لم يتم العثور على كتاب مطابق. جرّب كلمة أقصر أو امسح البحث.");
  } else if (controls.category.value) {
    notice(catalog, "لا توجد كتب منشورة في هذا المجال حاليًا.");
  } else {
    notice(catalog, "لا توجد كتب منشورة حاليًا.");
  }
}

function showLoadError(retry) {
  const box = el("div", null, "notice error");
  box.setAttribute("role", "alert");
  box.append(el("h2", "تعذر تحميل الكتب"), el("p", "تحقق من الاتصال ثم أعد المحاولة."));
  const button = el("button", "إعادة المحاولة", "button");
  button.type = "button";
  button.addEventListener("click", retry);
  box.append(button);
  catalog.replaceChildren(box);
}

async function start() {
  fields.disabled = true;
  catalog.setAttribute("aria-busy", "true");
  notice(catalog, "جارٍ تحميل الكتب…");

  try {
    const [site, loaded] = await Promise.all([loadSite(), loadCatalog()]);
    data = loaded;
    applyBranding(site);
    visible = data.books.filter(book => book.enabled && !book.demo);

    const categories = [...new Set(visible.map(book => book.category))].sort(collator.compare);
    const queryCategory = requestedCategory();
    const categoryOptions = categories.map(value => option(value, value));
    if (queryCategory && !categories.includes(queryCategory)) {
      categoryOptions.push(option(queryCategory, queryCategory));
    }
    controls.category.replaceChildren(option("", "كل المجالات"), ...categoryOptions);
    controls.category.value = queryCategory;

    const statuses = new Set(visible.map(book => book.status));
    controls.status.replaceChildren(
      option("", "كل الحالات"),
      ...Object.entries(STATUS).filter(([key]) => statuses.has(key)).map(([key, label]) => option(key, label))
    );

    catalogWarnings(document.getElementById("warnings"), data);
    fields.disabled = false;
    renderResults();
    document.title = queryCategory ? `${queryCategory} | ${site.title}` : `جميع الكتب | ${site.title}`;
  } catch {
    data = null;
    visible = [];
    document.getElementById("result-count").textContent = "تعذر تحميل الكتب";
    showLoadError(start);
  } finally {
    catalog.setAttribute("aria-busy", "false");
  }
}

filters.addEventListener("submit", event => event.preventDefault());
filters.addEventListener("input", renderResults);
filters.addEventListener("change", event => {
  if (event.target === controls.category) updateCategoryURL();
  renderResults();
});
filters.addEventListener("reset", () => {
  setTimeout(() => {
    updateCategoryURL();
    renderResults();
  }, 0);
});

start();
