import {
  loadSite, loadCatalog, applyBranding, coverImage, badges, metadata, progressBlock,
  relatedUpdates, renderEvent, readingAction, el, isolated, link, localURL,
  notice, errorState, catalogWarnings, scrollHistory, reviewURL
} from "./common.js";

const content = document.getElementById("book-content");
const sitePromise = loadSite();
sitePromise.then(applyBranding);

function showBook(book, data) {
  const article = el("article", null, "book-detail");
  const body = el("div", null, "detail-body");
  body.append(el("p", book.category, "eyebrow"));
  const heading = el("h1", book.title_ar);
  heading.dir = "auto";
  body.append(heading);
  if (book.title_en) body.append(isolated(book.title_en, "ltr", "p"));
  body.append(badges(book), metadata(book, data.updates, data.updatesAvailable));
  const progress = progressBlock(book);
  if (progress) body.append(progress, el("p", "نسبة المراجعة تقدير يحدّثه صاحب المشروع، ولا تتزامن تلقائيًا مع تعليقات Drive.", "help-text"));
  const description = el("p", book.description, "description");
  description.dir = "auto";
  body.append(description);
  const actions = el("div", null, "actions");
  actions.append(
    readingAction(book.drive_url),
    link("أرسل ملاحظة على هذا الكتاب", reviewURL(book.id), "button review-button"),
    link("سجل التحديثات", "#updates", "button")
  );
  body.append(
    actions,
    el("p", "يمكنك إرسال تصحيح محدد مع رقم الصفحة من نموذج المراجعة. رقم الإصدار يخص مراجعة المشروع أو ترجمته، وليس طبعة الناشر الأصلية.", "help-text")
  );
  const idLine = el("p", "معرّف الكتاب: ", "help-text");
  idLine.append(isolated(book.id, "ltr"));
  body.append(idLine);
  article.append(coverImage(book, false), body);
  const history = el("section", null, "section");
  history.id = "updates";
  history.tabIndex = -1;
  history.setAttribute("aria-labelledby", "history-heading");
  const historyHeading = el("h2", "سجل التحديثات");
  historyHeading.id = "history-heading";
  history.append(historyHeading, el("p", "الرابط الرئيسي يفتح النسخة الحالية. روابط الملفات داخل هذا السجل تخص أحداثها وإصداراتها الأصلية.", "help-text"));
  const events = relatedUpdates(book, data.updates);
  const holder = el("div");
  if (!data.updatesAvailable) notice(holder, "سجل التحديثات غير متاح حاليًا. أعد تحميل الصفحة للمحاولة مجددًا.", "notice warning");
  else if (!events.length) notice(holder, "لم تُسجّل تحديثات لهذا الكتاب بعد.");
  else {
    const list = el("ol", null, "history");
    list.append(...events.map(update => renderEvent(update, book, true)));
    holder.append(list);
  }
  history.append(holder);
  content.replaceChildren(article, history);
}

async function start() {
  content.setAttribute("aria-busy", "true");
  notice(content, "جارٍ تحميل تفاصيل الكتاب…");
  const site = await sitePromise;
  try {
    const id = new URLSearchParams(location.search).get("id");
    const data = await loadCatalog();
    catalogWarnings(document.getElementById("warnings"), data);
    const book = data.books.find(item => item.id === id);
    if (!book) {
      const box = el("section", null, "section notice");
      box.append(el("h1", "الكتاب غير موجود"), el("p", "قد يكون الرابط غير صحيح أو لم يعد الكتاب ظاهرًا في الفهرس."), link("العودة إلى الصفحة الرئيسية", localURL("index.html"), "button"));
      content.replaceChildren(box);
      document.title = `الكتاب غير موجود | ${site.title}`;
    } else {
      showBook(book, data);
      document.title = `${book.title_ar} | ${site.title}`;
      scrollHistory();
    }
  } catch (error) {
    document.title = `تعذر تحميل الكتاب | ${site.title}`;
    errorState(content, error, start);
  } finally { content.setAttribute("aria-busy", "false"); }
}

window.addEventListener("hashchange", scrollHistory);
start();
