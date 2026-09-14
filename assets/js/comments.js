import { el } from "./common.js";
import {
  TABLES, insertPublicRow, loadApprovedGeneralComments, sharedBackendAvailable
} from "./community-backend.js";
import { generalCommentError } from "./participation-validation.js";

const LOCAL_KEY = "arabic-book-review-portal-comments-v1";
const PAGE_SIZE = 5;
const COOLDOWN_MS = 10000;
const dateFormatter = new Intl.DateTimeFormat("ar-EG-u-ca-gregory-nu-latn", {
  year: "numeric",
  month: "short",
  day: "numeric"
});

let comments = [];
let visibleCount = PAGE_SIZE;
let mode = "local";
let localStorageAvailable = true;
let lastSubmissionAt = 0;

const form = document.getElementById("comment-form");
const nameField = document.getElementById("comment-name");
const commentField = document.getElementById("comment-text");
const formStatus = document.getElementById("comment-form-status");
const storageNote = document.getElementById("comments-storage-note");
const list = document.getElementById("comments-list");
const moreButton = document.getElementById("comments-more");

function validComment(item) {
  return item && typeof item.name === "string" && item.name.trim().length >= 2 &&
    item.name.trim().length <= 60 && typeof item.comment === "string" &&
    item.comment.trim().length >= 3 && item.comment.trim().length <= 1000;
}

function normalizedComment(item) {
  return {
    id: String(item.id ?? ""),
    name: item.name.trim(),
    comment: item.comment.trim(),
    created_at: typeof item.created_at === "string" ? item.created_at : ""
  };
}

function localComments() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    localStorageAvailable = true;
    return Array.isArray(parsed) ? parsed.filter(validComment).map(normalizedComment) : [];
  } catch {
    localStorageAvailable = false;
    return [];
  }
}

function saveLocalComments() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(comments));
    localStorageAvailable = true;
  } catch {
    localStorageAvailable = false;
  }
}

function formatCommentDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
}

function renderComment(item) {
  const article = el("article", null, "comment-item");
  const header = el("header", null, "comment-header");
  header.append(el("strong", item.name));
  const formattedDate = formatCommentDate(item.created_at);
  if (formattedDate) {
    const time = el("time", formattedDate);
    time.dateTime = item.created_at;
    header.append(time);
  }
  article.append(header, el("p", item.comment));
  return article;
}

function renderComments() {
  list.setAttribute("aria-busy", "false");
  if (!comments.length) {
    list.replaceChildren(el("p", "لا توجد تعليقات بعد. كن أول من يشارك رأيه.", "notice"));
    moreButton.hidden = true;
    return;
  }
  list.replaceChildren(...comments.slice(0, visibleCount).map(renderComment));
  moreButton.hidden = visibleCount >= comments.length;
}

function setLocalMode(note = "") {
  mode = "local";
  comments = localComments();
  storageNote.textContent = note || (localStorageAvailable
    ? "تُحفظ التعليقات على هذا الجهاز حاليًا، ولن تظهر للزوار الآخرين."
    : "يتعذر الحفظ الدائم في هذا المتصفح؛ سيبقى التعليق خلال هذه الزيارة فقط.");
  renderComments();
}

async function loadSharedComments() {
  const loaded = await loadApprovedGeneralComments(100);
  comments = loaded.filter(validComment).map(normalizedComment);
}

async function submitSharedComment(name, comment) {
  await insertPublicRow(TABLES.generalComments, { name, comment });
}

function localID() {
  if (globalThis.crypto?.randomUUID) return `local-${crypto.randomUUID()}`;
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function saveSubmittedCommentLocally(name, comment) {
  comments.unshift({
    id: localID(),
    name,
    comment,
    created_at: new Date().toISOString()
  });
  visibleCount = PAGE_SIZE;
  saveLocalComments();
  renderComments();
}

async function submit(event) {
  event.preventDefault();
  const name = nameField.value.trim();
  const comment = commentField.value.trim();
  const invalid = generalCommentError(name, comment);
  formStatus.classList.remove("success", "failure");

  if (invalid) {
    formStatus.textContent = invalid.message;
    formStatus.classList.add("failure");
    (invalid.field === "name" ? nameField : commentField).focus();
    return;
  }

  if (Date.now() - lastSubmissionAt < COOLDOWN_MS) {
    formStatus.textContent = "انتظر لحظات قليلة قبل إرسال تعليق آخر.";
    formStatus.classList.add("failure");
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  formStatus.textContent = "جارٍ إرسال التعليق…";

  try {
    if (mode === "shared") {
      await submitSharedComment(name, comment);
      form.reset();
      lastSubmissionAt = Date.now();
      formStatus.textContent = "شكرًا لك. تم استلام تعليقك للمراجعة.";
      formStatus.classList.add("success");
    } else {
      saveSubmittedCommentLocally(name, comment);
      form.reset();
      lastSubmissionAt = Date.now();
      formStatus.textContent = localStorageAvailable
        ? "شكرًا لك. حُفظ تعليقك على هذا الجهاز."
        : "ظهر تعليقك الآن، لكنه لن يبقى بعد إغلاق هذه الصفحة.";
      formStatus.classList.add("success");
    }
  } catch {
    setLocalMode("تعذر الاتصال بالتعليقات العامة؛ حُفظ تعليقك على هذا الجهاز فقط.");
    saveSubmittedCommentLocally(name, comment);
    form.reset();
    lastSubmissionAt = Date.now();
    formStatus.textContent = "لم يصل التعليق إلى المراجعة العامة، لكنه محفوظ على هذا الجهاز.";
    formStatus.classList.add("failure");
  } finally {
    submitButton.disabled = false;
  }
}

export async function initComments() {
  if (!form || !list || !storageNote || !moreButton) return;

  form.addEventListener("submit", submit);
  moreButton.addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    renderComments();
  });

  list.setAttribute("aria-busy", "true");
  if (!sharedBackendAvailable()) {
    setLocalMode();
    return;
  }

  mode = "shared";
  storageNote.textContent = "تظهر التعليقات العامة بعد مراجعتها.";
  try {
    await loadSharedComments();
    renderComments();
  } catch {
    setLocalMode("تعذر الاتصال بالتعليقات العامة؛ تُحفظ التعليقات على هذا الجهاز حاليًا.");
  }
}
