import {
  STATUS, UPDATE_TYPES, fetchJSON, parseJSON, validateData, loadSite, applyBranding,
  driveURL, el, notice
} from "../assets/js/common.js";

const $ = id => document.getElementById(id);
const bookForm = $("book-form");
const updateForm = $("update-form");
let books = null;
let updates = null;
let unsavedForm = false;
let changedData = false;
let exported = false;
let loading = false;
let activeBookChoice = "";
const clone = value => JSON.parse(JSON.stringify(value));

function showErrors(target, errors) {
  const box = el("div", null, "notice error");
  box.append(el("p", "لم يُنفّذ الإجراء. صحّح الحقول التالية:"));
  const list = el("ul");
  for (const message of errors) { const item = el("li", message); item.dir = "auto"; list.append(item); }
  box.append(list);
  target.replaceChildren(box);
}

function clearExport() {
  $("export-area").hidden = true;
  $("books-output").value = "";
  $("updates-output").value = "";
  $("export-message").replaceChildren();
  exported = false;
}

function fillChoices(select, entries, firstLabel) {
  select.replaceChildren();
  if (firstLabel) { const option = el("option", firstLabel); option.value = ""; select.append(option); }
  for (const [value, label] of entries) { const option = el("option", label); option.value = value; select.append(option); }
}

function updateSummary() {
  $("data-summary").textContent = `${books.length} كتاب · ${updates.length} حدث محفوظ في الذاكرة. ${changedData ? "توجد تغييرات لم تُنشر بعد." : "حمّلت الملفين دون تغيير."}`;
}

function refreshChoices(selected = "") {
  fillChoices($("book-choice"), books.map((book, index) => [String(index), `${book.title_ar} — ${book.id}${book.enabled ? "" : " (مخفي)"}`]), "كتاب جديد");
  $("book-choice").value = selected;
  const previousUpdateBook = $("u-book").value;
  fillChoices($("u-book"), books.map(book => [book.id, `${book.title_ar} — ${book.id}`]), "اختر الكتاب");
  if (books.some(book => book.id === previousUpdateBook)) $("u-book").value = previousUpdateBook;
  updateSummary();
}

function fillBook() {
  const value = $("book-choice").value;
  activeBookChoice = value;
  const record = value === "" ? { version: "v1.0", status: "review", enabled: true, demo: false } : books[Number(value)];
  for (const [name, control] of Object.entries(Object.fromEntries([...bookForm.elements].filter(node => node.name).map(node => [node.name, node])))) {
    if (control.type === "checkbox") control.checked = record[name] === true;
    else control.value = record[name] ?? "";
  }
  $("b-id").readOnly = value !== "";
  unsavedForm = false;
}

function confirmDiscard() {
  return !(unsavedForm || changedData) || window.confirm("سيحل الملفان المختاران محل بيانات الذاكرة. هل حفظت ما تحتاجه وتريد المتابعة؟");
}

async function loadPair(loader) {
  if (loading || !confirmDiscard()) return;
  loading = true;
  $("load-published").disabled = true;
  $("import-files").disabled = true;
  $("book-fields").disabled = true;
  $("update-fields").disabled = true;
  $("validate-export").disabled = true;
  clearExport();
  notice($("load-message"), "جارٍ تحميل الملفين والتحقق منهما…");
  try {
    const [newBooks, newUpdates] = await loader();
    const result = validateData(newBooks, newUpdates);
    if (result.errors.length) {
      showErrors($("load-message"), result.errors);
      return;
    }
    // Keep full original objects so unknown fields survive every edit and export.
    books = clone(newBooks);
    updates = clone(newUpdates);
    changedData = false;
    unsavedForm = false;
    refreshChoices();
    fillBook();
    updateForm.reset();
    notice($("load-message"), "تم تحميل الملفين والتحقق منهما. ابدأ التعديل أدناه.");
    $("edit-message").replaceChildren();
  } catch (error) {
    showErrors($("load-message"), [error.message, books ? "احتُفظ ببيانات الذاكرة السابقة. لم تُستبدل بملفات فارغة. تأكد أنها الأحدث قبل متابعة العمل." : "لم تبدأ جلسة تعديل. حمّل ملفين صحيحين؛ لم تُنشأ مصفوفات فارغة بدل البيانات المفقودة."]);
  } finally {
    loading = false;
    $("load-published").disabled = false;
    $("import-files").disabled = false;
    const ready = books !== null && updates !== null;
    $("book-fields").disabled = !ready;
    $("update-fields").disabled = !ready;
    $("validate-export").disabled = !ready;
  }
}

function formValues(form) {
  return Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, value.trim()]));
}

function applyCandidate(nextBooks, nextUpdates, message) {
  const result = validateData(nextBooks, nextUpdates);
  if (result.errors.length) { showErrors($("edit-message"), result.errors); return false; }
  books = nextBooks;
  updates = nextUpdates;
  changedData = true;
  unsavedForm = false;
  clearExport();
  notice($("edit-message"), message);
  updateSummary();
  return true;
}

bookForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!books || !updates) return;
  const chosen = $("book-choice").value;
  const old = chosen === "" ? null : books[Number(chosen)];
  const fields = formValues(bookForm);
  const record = { ...old, ...fields,
    id: old ? old.id : fields.id,
    progress: fields.progress === "" ? null : Number(fields.progress),
    enabled: $("b-enabled").checked, demo: $("b-demo").checked
  };
  if (old && driveURL(old.drive_url) && driveURL(old.drive_url) !== driveURL(record.drive_url)) {
    const archived = updates.some(update => update.book_id === old.id && update.type === "release" && update.version === old.version && driveURL(update.drive_url) === driveURL(old.drive_url));
    if (!archived) {
      showErrors($("edit-message"), ["drive_url: قبل تغيير الرابط الحالي، أضف حدث إصدار للنسخة القديمة برابطها وتاريخها الفعليين، أو أصلح حدث إصدارها في JSON ثم أعد الاستيراد. لم يتغير الكتاب."]);
      return;
    }
  }
  const candidate = clone(books);
  const index = old ? Number(chosen) : candidate.length;
  if (old) candidate[index] = record;
  else candidate.push(record);
  if (applyCandidate(candidate, clone(updates), "حُفظ الكتاب في الذاكرة. إن نشرت PDF لأول مرة أو إصدارًا جديدًا، أضف حدث release قبل تنزيل الملفين.")) {
    refreshChoices(String(index));
    fillBook();
  }
});

updateForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!books || !updates) return;
  const record = formValues(updateForm);
  if (applyCandidate(clone(books), [record, ...clone(updates)], "أُضيف الحدث في بداية السجل. بقيت جميع الأحداث القديمة وبيانات النسخة الحالية كما هي.")) {
    const selectedBook = record.book_id;
    updateForm.reset();
    $("u-book").value = selectedBook;
  }
});

function switchTask(task) {
  if (unsavedForm && !window.confirm("لم تحفظ النموذج في الذاكرة. هل تريد ترك هذه التعديلات؟")) return;
  if (unsavedForm) { fillBook(); updateForm.reset(); unsavedForm = false; }
  bookForm.hidden = task !== "book";
  updateForm.hidden = task !== "update";
  $("task-book").setAttribute("aria-pressed", String(task === "book"));
  $("task-update").setAttribute("aria-pressed", String(task === "update"));
  $("edit-message").replaceChildren();
}

$("task-book").addEventListener("click", () => switchTask("book"));
$("task-update").addEventListener("click", () => switchTask("update"));
$("book-choice").addEventListener("change", () => {
  if (unsavedForm && !window.confirm("لم تحفظ هذا الكتاب في الذاكرة. هل تريد ترك تعديلات النموذج؟")) {
    $("book-choice").value = activeBookChoice;
    return;
  }
  fillBook();
  $("edit-message").replaceChildren();
});
for (const form of [bookForm, updateForm]) {
  form.addEventListener("input", event => {
    if (event.target.id === "book-choice") return;
    unsavedForm = true;
    clearExport();
  });
}

$("load-published").addEventListener("click", () => loadPair(() => Promise.all([fetchJSON("data/books.json"), fetchJSON("data/updates.json")])));
$("import-files").addEventListener("click", () => {
  const bookFile = $("import-books").files[0];
  const updateFile = $("import-updates").files[0];
  if (!bookFile || !updateFile) return showErrors($("load-message"), ["اختر books.json وupdates.json معًا قبل الاستيراد."]);
  loadPair(async () => [parseJSON(await bookFile.text(), "books.json"), parseJSON(await updateFile.text(), "updates.json")]);
});

$("validate-export").addEventListener("click", () => {
  clearExport();
  if (!books || !updates) return;
  if (unsavedForm) return showErrors($("export-message"), ["احفظ النموذج في الذاكرة أولًا؛ الحقول غير المحفوظة لن تدخل ملف JSON."]);
  const result = validateData(books, updates);
  if (result.errors.length) return showErrors($("export-message"), result.errors);
  for (const [name, value] of [["books", books], ["updates", updates]]) $(name + "-output").value = JSON.stringify(value, null, 2) + "\n";
  exported = true;
  $("export-area").hidden = false;
  notice($("export-message"), "الملفان صالحان. راجع المحتوى ثم نزّلهما؛ لم يُرسل شيء إلى GitHub.");
});

function download(name) {
  if (!exported) return;
  const blob = new Blob([$(name + "-output").value], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = el("a");
  anchor.href = url;
  anchor.download = name + ".json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function copy(name) {
  if (!exported) return;
  const output = $(name + "-output");
  try {
    await navigator.clipboard.writeText(output.value);
    notice($("export-message"), `نُسخ ${name}.json كاملًا.`);
  } catch {
    output.focus();
    output.select();
    notice($("export-message"), "النسخ التلقائي غير متاح. حُدّد النص كاملًا؛ اضغط Ctrl+C أو استخدم أمر النسخ في جهازك.", "notice warning");
  }
}

for (const name of ["books", "updates"]) {
  $("download-" + name).addEventListener("click", () => download(name));
  $("copy-" + name).addEventListener("click", () => copy(name));
}
fillChoices($("b-status"), Object.entries(STATUS));
fillChoices($("u-type"), Object.entries(UPDATE_TYPES));
loadSite().then(applyBranding);
