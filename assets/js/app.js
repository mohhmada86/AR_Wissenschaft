import {
  BASE, loadSite, loadCatalog, applyBranding, bookURL, coverImage,
  el, link, catalogWarnings
} from "./common.js";
import { initComments } from "./comments.js";
import {
  visibleBooks, categorySummaries, selectFeaturedBooks, bookCountLabel
} from "./home-data.js";

const categoryGrid = document.getElementById("category-grid");
const featuredGrid = document.getElementById("featured-grid");

function catalogURL(category = "") {
  const url = new URL("catalog.html", BASE);
  if (category) url.searchParams.set("category", category);
  return url.href;
}

function renderCategory(summary) {
  const anchor = el("a", null, "category-card");
  anchor.href = catalogURL(summary.name);
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.setAttribute("aria-label", `${summary.name}، ${bookCountLabel(summary.books.length)}، يفتح في علامة تبويب جديدة`);
  anchor.append(
    el("strong", summary.name),
    el("span", bookCountLabel(summary.books.length), "category-count"),
    el("span", "عرض كتب هذا المجال ←", "category-action")
  );
  return anchor;
}

function renderFeaturedBook(book) {
  const card = el("article", null, "featured-card");
  card.dataset.bookId = book.id;
  const imageLink = link(null, bookURL(book.id), "featured-cover-link");
  imageLink.append(coverImage(book));

  const body = el("div", null, "featured-body");
  const heading = el("h3");
  heading.dir = "auto";
  heading.append(link(book.title_ar, bookURL(book.id)));
  const author = el("p", book.author, "featured-author");
  author.dir = "auto";
  body.append(
    el("p", book.category, "eyebrow"),
    heading,
    author,
    link("تفاصيل الكتاب", bookURL(book.id), "button")
  );
  card.append(imageLink, body);
  return card;
}

function loadingError(container, retry) {
  const box = el("div", null, "notice error");
  box.setAttribute("role", "alert");
  box.append(
    el("h2", "تعذر تحميل المكتبة"),
    el("p", "تحقق من الاتصال ثم أعد المحاولة.")
  );
  const button = el("button", "إعادة المحاولة", "button");
  button.type = "button";
  button.addEventListener("click", retry);
  box.append(button);
  container.replaceChildren(box);
}

async function start() {
  categoryGrid.setAttribute("aria-busy", "true");
  featuredGrid.setAttribute("aria-busy", "true");
  categoryGrid.replaceChildren(el("p", "جارٍ تحميل المجالات…", "notice"));
  featuredGrid.replaceChildren(el("p", "جارٍ تحميل الكتب المختارة…", "notice"));

  try {
    const [site, data] = await Promise.all([loadSite(), loadCatalog()]);
    applyBranding(site);
    document.title = site.title;

    const books = visibleBooks(data.books);
    const summaries = categorySummaries(books);
    const featured = selectFeaturedBooks(books, site, summaries);

    document.getElementById("book-stat").textContent = String(books.length);
    document.getElementById("category-stat").textContent = String(summaries.length);
    catalogWarnings(document.getElementById("warnings"), data);

    if (summaries.length) categoryGrid.replaceChildren(...summaries.map(renderCategory));
    else categoryGrid.replaceChildren(el("p", "لا توجد كتب منشورة حاليًا.", "notice"));

    if (featured.length) featuredGrid.replaceChildren(...featured.map(renderFeaturedBook));
    else featuredGrid.replaceChildren(el("p", "ستظهر الكتب المختارة هنا عند نشرها.", "notice"));
  } catch {
    document.getElementById("book-stat").textContent = "0";
    document.getElementById("category-stat").textContent = "0";
    loadingError(categoryGrid, start);
    loadingError(featuredGrid, start);
  } finally {
    categoryGrid.setAttribute("aria-busy", "false");
    featuredGrid.setAttribute("aria-busy", "false");
  }
}

initComments();
start();
