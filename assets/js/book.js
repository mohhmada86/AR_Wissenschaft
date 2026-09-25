import {
  loadSite, loadCatalog, applyBranding, coverImage, badges, metadata, progressBlock,
  relatedUpdates, renderEvent, readingAction, el, isolated, link, localURL,
  notice, errorState, catalogWarnings, scrollHistory, requestURL, externalLink
} from "./common.js";

const content = document.getElementById("book-content");
const sitePromise = loadSite();
sitePromise.then(applyBranding);

function showBook(book, data, site) {
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
  actions.append(readingAction(book.drive_url));
  body.append(
    actions,
    el("p", "اقرأ بالعربية لفهم الفكرة، وقارن بالمصدر الأصلي إن كان متاحًا لديك لتعلّم المصطلحات وتوسيع فهمك.", "help-text")
  );

  const accessHelp = el("section", null, "panel");
  accessHelp.append(
    el("h3", "هل تواجه مشكلة في فتح الكتاب على Google Drive؟"),
    el("p", "إذا لم يفتح الكتاب أو تعذرت القراءة على Google Drive، تواصل معنا واذكر اسم الكتاب. سنرسل لك رابط تحميل للنسخة المتاحة.")
  );
  const contactActions = el("div", null, "request-actions");
  const email = site.contact_email || "mohhmadahamad0@gmail.com";
  const emailLine = el("p", null, "help-text");
  emailLine.append("البريد: ", isolated(email, "ltr", "span"));
  accessHelp.append(emailLine);
  const subject = encodeURIComponent(`مشكلة في فتح كتاب على Google Drive - ${book.title_ar}`);
  const bodyText = encodeURIComponent(`مرحبًا،\n\nأواجه مشكلة في فتح هذا الكتاب على Google Drive:\n${book.title_ar}\n\nأرجو إرسال رابط تحميل للنسخة المتاحة.\n`);
  contactActions.append(
    link("راسلنا بالبريد الإلكتروني", `mailto:${email}?subject=${subject}&body=${bodyText}`, "button"),
    externalLink("راسلنا على فيسبوك", site.facebook_url || "https://www.facebook.com/profile.php?id=61594138598701", "button")
  );
  accessHelp.append(contactActions);
  body.append(accessHelp);

  const requests = el("div", null, "detail-requests");
  requests.append(
    link("طلب نسخة للتحميل", requestURL("download", book.id), "section-link"),
    link("طلب ملفات التحرير", requestURL("source", book.id), "section-link")
  );
  body.append(requests);
  if (book.status === "review") body.append(el("p", "هذه نسخة قراءة ومراجعة قبل النشر النهائي: متاحة للدراسة الآن، ويستمر المشروع في تحسين الإصدارات القادمة.", "storage-note"));
  body.append(el("p", "رقم الإصدار يخص مراجعة المشروع أو ترجمته، وليس طبعة الناشر الأصلية. طلب الملفات يخضع لتوافرها وحقوق استخدامها.", "help-text"), link("سجل التحديثات", "#updates", "back-link"));
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
    const book = data.books.find(item => item.id === id && !item.demo);
    if (!book) {
      const box = el("section", null, "section notice");
      box.append(el("h1", "الكتاب غير موجود"), el("p", "قد يكون الرابط غير صحيح أو لم يعد الكتاب ظاهرًا في الفهرس."), link("العودة إلى الصفحة الرئيسية", localURL("index.html"), "button"));
      content.replaceChildren(box);
      document.title = `الكتاب غير موجود | ${site.title}`;
    } else {
      showBook(book, data, site);
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
