import {
  BASE, loadSite, loadCatalog, applyBranding, bookURL, coverImage,
  el, link, badges, catalogWarnings, isolated
} from "./common.js";
import {
  visibleBooks, categorySummaries, selectFeaturedBooks, bookCountLabel
} from "./home-data.js";
import { dailyMessage, dailyBook } from "./reading-inspiration.js";
import { coverMetadata } from "./cover-client.js";
import { classify, THEMES } from "./cover-design.js";

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
  anchor.style.setProperty("--subject-color", THEMES[classify(summary.books[0])].palettes[0][0]);
  anchor.append(
    el("strong", summary.name),
    el("span", bookCountLabel(summary.books.length), "category-count"),
    el("span", "←", "category-action")
  );
  return anchor;
}

function renderFeaturedBook(book) {
  const card = el("article", null, "featured-card");
  card.dataset.bookId = book.id;
  const imageLink = link(null, bookURL(book.id), "featured-cover-link");
  imageLink.tabIndex = -1;
  imageLink.setAttribute("aria-hidden", "true");
  imageLink.append(coverImage(book));

  const body = el("div", null, "featured-body");
  const heading = el("h3");
  heading.dir = "auto";
  heading.append(link(book.title_ar, bookURL(book.id)));
  const author = el("p", book.author, "featured-author");
  author.dir = "auto";
  if (book.title_en) {
    const english = isolated(book.title_en, "ltr", "p");
    english.className = "original-title";
    body.append(el("p", book.category, "eyebrow"), heading, english);
  } else body.append(el("p", book.category, "eyebrow"), heading);
  const authorAr = coverMetadata(book).author_ar;
  if (authorAr && authorAr !== book.author) body.append(isolated(authorAr, "rtl", "p"));
  body.append(
    author,
    badges(book),
    link("تفاصيل الكتاب", bookURL(book.id), "button")
  );
  card.append(imageLink, body);
  return card;
}

function renderDailyBook(book) {
  const holder = document.getElementById("daily-book");
  if (!book || !holder) return;
  const image = link(null, bookURL(book.id), "spotlight-cover-link");
  image.tabIndex = -1; image.setAttribute("aria-hidden", "true");
  image.append(coverImage(book, false));
  const body = el("div", null, "spotlight-body");
  const heading = el("h2");
  heading.append(link(book.title_ar, bookURL(book.id)));
  body.append(el("p", "من المكتبة اليوم", "eyebrow"), heading);
  if (book.title_en) body.append(isolated(book.title_en, "ltr", "p"));
  body.append(el("p", book.category, "spotlight-category"), link("اكتشف هذا الكتاب ←", bookURL(book.id), "section-link"));
  holder.replaceChildren(image, body);
  holder.className = "hero-spotlight";
}

const message = dailyMessage();
for (const [id, value] of [["reading-message-ar", message.ar], ["reading-message-en", message.en], ["reading-tip", message.tip], ["reading-tip-en", message.tip_en]]) {
  const holder = document.getElementById(id);
  if (holder) holder.textContent = value;
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
    document.title = `${site.title} | اقرأ، قارن، تعلّم`;

    const books = visibleBooks(data.books);
    const summaries = categorySummaries(books);
    const featured = selectFeaturedBooks(books, site, summaries);
    renderDailyBook(dailyBook(books));

    document.getElementById("book-stat").textContent = String(books.length);
    document.getElementById("category-stat").textContent = String(summaries.length);
    catalogWarnings(document.getElementById("warnings"), data);

    if (summaries.length) categoryGrid.replaceChildren(...summaries.map(renderCategory));
    else categoryGrid.replaceChildren(el("p", "لا توجد كتب منشورة حاليًا.", "notice"));

    if (featured.length) featuredGrid.replaceChildren(...featured.map(renderFeaturedBook));
    else featuredGrid.replaceChildren(el("p", "ستظهر الكتب المختارة هنا عند نشرها.", "notice"));
  } catch {
    document.getElementById("book-stat").textContent = "—";
    document.getElementById("category-stat").textContent = "—";
    loadingError(categoryGrid, start);
    loadingError(featuredGrid, start);
  } finally {
    categoryGrid.setAttribute("aria-busy", "false");
    featuredGrid.setAttribute("aria-busy", "false");
  }
}

start();
