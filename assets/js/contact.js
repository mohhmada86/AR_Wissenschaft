import { applyBranding, el, loadCatalog, loadSite } from "./common.js";
import { TABLES, insertPublicRow, sharedBackendAvailable } from "./community-backend.js";
import { REQUEST_TYPES, emailIsValid, requestError } from "./contact-validation.js";

const $ = id => document.getElementById(id);
const LOCAL_KEY = "arabic-book-review-portal-request-draft-v1";
const type = $("request-type");
const choice = $("request-book");
const form = $("request-form");
const status = $("request-status");
let books = [];
let site = {};
let lastSent = 0;
let preview = "";
const value = id => $(id).value.trim();
const shared = sharedBackendAvailable();

function showStatus(message, success = false) {
  status.textContent = message;
  status.className = "form-status " + (success ? "success" : "failure");
}


function setType() {
  const translation = type.value === "translation";
  $("translation-fields").hidden = !translation;
  $("translation-fields").querySelectorAll("input").forEach(input => { input.disabled = !translation; });
  $("request-book-section").hidden = !["download", "source"].includes(type.value);
  form.hidden = false;
  $("draft-result").hidden = true;
  status.textContent = "";
  $("request-help").textContent = {
    translation: "كتاب دراسي، مذكرات، دليل تعليمي أو مادة مقرر: أخبرنا بما تدرسه وما تحتاج إلى فهمه.",
    download: "اختر الكتاب ووضح النسخة التي تحتاج إليها للدراسة. سنراجع ما يمكن توفيره.",
    source: "اختر الكتاب واشرح كيف ترغب في المشاركة. توفير ملفات التحرير يعتمد على توافرها وحقوق استخدامها.",
    general: "اكتب سؤالك أو اقتراحك، واترك بريدًا يمكننا الرد عليه."
  }[type.value];
  $("request-message-label").textContent = type.value === "source" ? "كيف ترغب في التعاون؟" : "وصف مختصر للطلب";
}

function recordFromForm() {
  const translation = type.value === "translation";
  const selected = ["download", "source"].includes(type.value) ? books.find(book => book.id === choice.value) : null;
  return {
    request_type: type.value,
    book_id: selected?.id || null,
    book_title: selected?.title_ar || null,
    name: value("request-name") || null,
    email: value("request-email"),
    material_title: translation ? value("material-title") : null,
    author: translation ? value("material-author") || null : null,
    original_language: translation ? value("original-language") : null,
    subject_area: translation ? value("subject-area") : null,
    source_url: translation ? value("source-url") || null : null,
    message: value("request-message"),
    notes: value("request-notes") || null
  };
}

function formatRequest(record) {
  return [
    "طلب إلى العلم بالعربي", "نوع الطلب: " + REQUEST_TYPES[record.request_type],
    record.book_title && "الكتاب: " + record.book_title,
    record.book_id && "معرّف الكتاب: " + record.book_id,
    record.material_title && "المادة: " + record.material_title,
    record.author && "المؤلف: " + record.author,
    record.original_language && "اللغة الأصلية: " + record.original_language,
    record.subject_area && "المجال: " + record.subject_area,
    record.source_url && "الرابط: " + record.source_url,
    record.name && "الاسم: " + record.name, "بريد التواصل: " + record.email,
    "الطلب: " + record.message, record.notes && "ملاحظات: " + record.notes
  ].filter(Boolean).join("\n\n");
}

function saveDraft(record) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(record)); return true; }
  catch { return false; }
}

function showDraft(record) {
  preview = formatRequest(record);
  $("request-preview").textContent = preview;
  $("draft-result").hidden = false;
  const mailto = $("request-mailto");
  mailto.hidden = !emailIsValid(site.contact_email);
  if (!mailto.hidden) mailto.href = "mailto:" + encodeURIComponent(site.contact_email) + "?subject=" + encodeURIComponent("طلب: " + REQUEST_TYPES[record.request_type]) + "&body=" + encodeURIComponent(preview);
}

function restoreDraft(params) {
  try {
    const draft = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
    if (!draft || typeof draft !== "object" || !["translation", "download", "source", "general"].includes(draft.request_type)) return;
    if (params.has("type") && params.get("type") !== draft.request_type) return;
    if (params.has("book") && params.get("book") !== draft.book_id) return;
    type.value = draft.request_type;
    choice.value = books.some(book => book.id === draft.book_id) ? draft.book_id : "";
    const fields = { name: "request-name", email: "request-email", material_title: "material-title", author: "material-author", original_language: "original-language", subject_area: "subject-area", source_url: "source-url", message: "request-message", notes: "request-notes" };
    for (const [key, id] of Object.entries(fields)) if (typeof draft[key] === "string") $(id).value = draft[key].slice(0, $(id).maxLength);
    setType();
    showStatus("استُعيدت مسودتك المحفوظة على هذا الجهاز. لم تُرسل تلقائيًا.", true);
  } catch { /* An unreadable local draft must not stop the form. */ }
}

async function submit(event) {
  event.preventDefault();
  if (form.hidden) return;
  const record = recordFromForm();
  const invalid = requestError(record);
  if (invalid) { showStatus(invalid.message); $(invalid.field).focus(); return; }
  if (Date.now() - lastSent < 15000) { showStatus("انتظر لحظات قبل إرسال طلب آخر."); return; }
  const button = $("request-submit");
  button.disabled = true;
  status.textContent = shared ? "جارٍ إرسال الطلب…" : "جارٍ تجهيز مسودة الطلب…";
  try {
    if (shared) {
      await insertPublicRow(TABLES.contactRequests, record);
      lastSent = Date.now();
      try { localStorage.removeItem(LOCAL_KEY); } catch { /* Submission already succeeded. */ }
      form.reset();
      $("draft-result").hidden = true;
      showStatus("شكرًا لك. وصل طلبك إلى فريق المشروع للمراجعة. إرسال الطلب لا يعني قبوله تلقائيًا.", true);
    } else {
      const saved = saveDraft(record);
      showDraft(record);
      showStatus(saved ? "حُفظت مسودة على هذا الجهاز فقط؛ لم يصل الطلب إلى فريق المشروع." : "تعذر الحفظ في المتصفح. انسخ الطلب أو نزّله الآن؛ لم يُرسل إلى الفريق.", saved);
    }
  } catch {
    const saved = saveDraft(record);
    showDraft(record);
    showStatus("تعذر تأكيد وصول الطلب. " + (saved ? "حُفظت مسودة على هذا الجهاز. " : "بقيت بياناتك في النموذج؛ انسخها للاحتفاظ بها. ") + "يمكنك المحاولة لاحقًا؛ إذا انقطع الاتصال بعد الإرسال، فتحقق قبل التكرار.");
  } finally { button.disabled = false; }
}

async function start() {
  const params = new URLSearchParams(location.search);
  if (Object.hasOwn(REQUEST_TYPES, params.get("type"))) type.value = params.get("type");
  setType();
  site = await loadSite();
  applyBranding(site);
  document.title = "تواصل وطلبات | " + site.title;
  $("request-submit").textContent = shared ? "إرسال الطلب" : "حفظ مسودة الطلب";
  $("request-storage-note").textContent = shared
    ? "يصل الطلب إلى فريق المشروع، ولا يُعرض للعامة."
    : "لم يُفعّل استقبال الطلبات بعد. الحفظ على هذا الجهاز فقط، ولا يصل إلى الفريق. يمكنك نسخ الطلب أو تنزيله" + (emailIsValid(site.contact_email) ? " أو فتحه في تطبيق البريد لإرساله بنفسك." : ".");
  try {
    const data = await loadCatalog();
    books = data.books.filter(book => !book.demo);
    choice.replaceChildren(el("option", "اختر الكتاب"));
    choice.firstElementChild.value = "";
    books.forEach(book => { const option = el("option", book.title_ar); option.value = book.id; choice.append(option); });
    choice.disabled = !books.length;
    if (params.has("book")) {
      const found = books.find(book => book.id === params.get("book"));
      if (found) choice.value = found.id;
      else $("request-book-error").textContent = "لم نجد الكتاب في الرابط. اختر كتابًا من القائمة.";
    }
  } catch {
    choice.replaceChildren(el("option", "تعذر تحميل الكتب"));
    $("request-book-error").textContent = "أعد تحميل الصفحة لاختيار كتاب. يمكنك إرسال طلب ترجمة أو استفسار عام الآن.";
  }
  $("request-fields").disabled = false;
  restoreDraft(params);
}

function updateRequestURL() {
  const url = new URL(location.href);
  url.searchParams.set("type", type.value);
  if (["download", "source"].includes(type.value) && choice.value) url.searchParams.set("book", choice.value);
  else url.searchParams.delete("book");
  history.replaceState(null, "", url);
}
type.addEventListener("change", () => { setType(); updateRequestURL(); });
choice.addEventListener("change", updateRequestURL);
form.addEventListener("submit", submit);
$("copy-request").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(preview); showStatus("نُسخ الطلب. لم يُرسل تلقائيًا.", true); }
  catch { showStatus("تعذر النسخ التلقائي؛ حدد النص وانسخه أو استخدم «تنزيل الطلب كنص»."); }
});
$("download-request").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob(["\ufeff" + preview], { type: "text/plain;charset=utf-8" }));
  const anchor = el("a"); anchor.href = url; anchor.download = "alilm-request.txt"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("clear-request").addEventListener("click", () => {
  try { localStorage.removeItem(LOCAL_KEY); form.reset(); preview = ""; $("draft-result").hidden = true; showStatus("حُذفت المسودة من هذا الجهاز. لا يؤثر ذلك في أي طلب سبق إرساله.", true); }
  catch { showStatus("تعذر حذف المسودة. يمكنك مسح بيانات الموقع من إعدادات المتصفح."); }
});
start();
