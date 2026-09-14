import {
  applyBranding, bookURL, coverImage, el, link, loadCatalog, loadSite
} from "./common.js";
import {
  TABLES, insertPublicRow, sharedBackendAvailable
} from "./community-backend.js";
import {
  ISSUE_TYPES, bookFeedbackError
} from "./participation-validation.js";

const LOCAL_KEY = "arabic-book-review-portal-feedback-v1";
const COOLDOWN_MS = 15000;

const form = document.getElementById("book-feedback-form");
const fieldset = document.getElementById("feedback-fields");
const selectedBook = document.getElementById("selected-book");
const storageNote = document.getElementById("feedback-storage-note");
const formStatus = document.getElementById("feedback-form-status");
const nameField = document.getElementById("reviewer-name");
const pageField = document.getElementById("page-number");
const typeField = document.getElementById("issue-type");
const commentField = document.getElementById("issue-comment");
const correctionField = document.getElementById("suggested-correction");
const emailField = document.getElementById("reviewer-email");
const wantsContactField = document.getElementById("wants-contact");
const emailRequiredNote = document.getElementById("email-required-note");
const backToBook = document.getElementById("back-to-book");

let currentBook = null;
let mode = "local";
let lastSubmissionAt = 0;

function populateIssueTypes() {
  ISSUE_TYPES.forEach(label => {
    const option = el("option", label);
    option.value = label;
    typeField.append(option);
  });
}

function localID() {
  if (globalThis.crypto?.randomUUID) return "local-" + crypto.randomUUID();
  return "local-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

function saveLocalFeedback(record) {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    const stored = Array.isArray(parsed) ? parsed : [];
    stored.unshift({
      ...record,
      local_id: localID(),
      local_saved_at: new Date().toISOString()
    });
    localStorage.setItem(LOCAL_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

function fieldValues() {
  return {
    reviewer_name: nameField.value.trim(),
    reviewer_email: emailField.value.trim(),
    page_number: pageField.value.trim(),
    issue_type: typeField.value,
    comment: commentField.value.trim(),
    suggested_correction: correctionField.value.trim(),
    wants_contact: wantsContactField.checked
  };
}

function fieldFor(name) {
  return {
    reviewer_name: nameField,
    reviewer_email: emailField,
    page_number: pageField,
    issue_type: typeField,
    comment: commentField,
    suggested_correction: correctionField
  }[name];
}

function updateEmailRequirement() {
  emailField.required = wantsContactField.checked;
  emailRequiredNote.textContent = wantsContactField.checked
    ? "البريد مطلوب الآن لأنك اخترت التواصل."
    : "اختياري، ولن يظهر للعامة.";
}

function renderSelectedBook(book) {
  const card = el("article", null, "review-book-card");
  const body = el("div", null, "review-book-body");
  body.append(
    el("p", "أنت ترسل ملاحظة على:", "eyebrow"),
    el("h2", book.title_ar),
    el("p", book.author, "help-text"),
    el("p", book.category, "review-book-category"),
    link("فتح صفحة الكتاب", bookURL(book.id), "back-link")
  );
  card.append(coverImage(book, false), body);
  selectedBook.replaceChildren(card);
  backToBook.href = bookURL(book.id);
}

function setStorageMode() {
  if (sharedBackendAvailable()) {
    mode = "shared";
    storageNote.textContent = "تُرسل الملاحظة إلى فريق المشروع للمراجعة، ولا تُعرض بياناتك أو ملاحظتك التفصيلية للعامة.";
    storageNote.classList.remove("warning");
  } else {
    mode = "local";
    storageNote.textContent = "لم يُفعّل الاستقبال المشترك بعد. ستُحفظ الملاحظة على هذا الجهاز فقط، ولن تصل إلى فريق المشروع.";
    storageNote.classList.add("warning");
  }
}

async function submitFeedback(event) {
  event.preventDefault();
  if (!currentBook) return;

  const values = fieldValues();
  const invalid = bookFeedbackError(values);
  formStatus.classList.remove("success", "failure");
  if (invalid) {
    formStatus.textContent = invalid.message;
    formStatus.classList.add("failure");
    fieldFor(invalid.field).focus();
    return;
  }

  if (Date.now() - lastSubmissionAt < COOLDOWN_MS) {
    formStatus.textContent = "انتظر لحظات قليلة قبل إرسال ملاحظة أخرى.";
    formStatus.classList.add("failure");
    return;
  }

  const record = {
    book_id: currentBook.id,
    book_title: currentBook.title_ar,
    reviewer_name: values.reviewer_name,
    reviewer_email: values.reviewer_email || null,
    page_number: values.page_number,
    issue_type: values.issue_type,
    comment: values.comment,
    suggested_correction: values.suggested_correction || null,
    wants_contact: values.wants_contact
  };

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  formStatus.textContent = "جارٍ إرسال الملاحظة…";

  try {
    if (mode === "shared") {
      await insertPublicRow(TABLES.bookFeedback, record);
      form.reset();
      updateEmailRequirement();
      lastSubmissionAt = Date.now();
      formStatus.textContent = "شكرًا لك. وصلت ملاحظتك وستُراجع من فريق المشروع.";
      formStatus.classList.add("success");
    } else {
      const saved = saveLocalFeedback(record);
      form.reset();
      updateEmailRequirement();
      lastSubmissionAt = Date.now();
      formStatus.textContent = saved
        ? "حُفظت الملاحظة على هذا الجهاز فقط. فعّل التخزين المشترك لإرسالها إلى الفريق."
        : "تعذر حفظ الملاحظة في هذا المتصفح.";
      formStatus.classList.add(saved ? "success" : "failure");
    }
  } catch {
    mode = "local";
    const saved = saveLocalFeedback(record);
    storageNote.textContent = "تعذر الاتصال بالاستقبال المشترك. حُفظت الملاحظة على هذا الجهاز فقط.";
    storageNote.classList.add("warning");
    form.reset();
    updateEmailRequirement();
    lastSubmissionAt = Date.now();
    formStatus.textContent = saved
      ? "لم تصل الملاحظة إلى الفريق، لكنها محفوظة على هذا الجهاز."
      : "تعذر إرسال الملاحظة أو حفظها.";
    formStatus.classList.add("failure");
  } finally {
    submitButton.disabled = false;
  }
}

async function start() {
  populateIssueTypes();
  setStorageMode();
  wantsContactField.addEventListener("change", updateEmailRequirement);
  updateEmailRequirement();
  form.addEventListener("submit", submitFeedback);

  try {
    const [site, data] = await Promise.all([loadSite(), loadCatalog()]);
    applyBranding(site);
    const params = new URLSearchParams(location.search);
    const id = params.get("book") || params.get("id");
    currentBook = data.books.find(book => book.id === id) || null;
    if (!currentBook) {
      selectedBook.replaceChildren(
        el("h2", "تعذر تحديد الكتاب"),
        el("p", "ارجع إلى صفحة أحد الكتب، ثم اختر «أرسل ملاحظة على هذا الكتاب».", "notice warning"),
        link("العودة إلى جميع الكتب", "catalog.html", "button")
      );
      fieldset.disabled = true;
      document.title = "تعذر تحديد الكتاب | " + site.title;
      return;
    }
    renderSelectedBook(currentBook);
    fieldset.disabled = false;
    document.title = "مراجعة " + currentBook.title_ar + " | " + site.title;
  } catch {
    selectedBook.replaceChildren(
      el("h2", "تعذر تحميل بيانات الكتاب"),
      el("p", "أعد تحميل الصفحة أو ارجع إلى الفهرس وحاول مرة أخرى.", "notice error")
    );
    fieldset.disabled = true;
  } finally {
    selectedBook.setAttribute("aria-busy", "false");
  }
}

start();
