export const READING_MESSAGES = Object.freeze([
  { ar: "صفحات قليلة كل يوم تصنع معرفة كبيرة بمرور الوقت.", en: "A few pages each day can build lasting understanding.", tip: "حدد وقتًا قصيرًا للقراءة، ثم دوّن فكرة واحدة فهمتها.", tip_en: "Set aside a short reading session, then write down one idea you understood." },
  { ar: "لا تقرأ لتُنهي الكتاب، بل لتفهم ما يضيفه إلى معرفتك.", en: "Read with curiosity, beyond the goal of finishing.", tip: "أغلق الكتاب واشرح الفكرة بكلماتك، ثم راجع ما لم يتضح.", tip_en: "Close the book and explain the idea in your own words, then check what remains unclear." },
  { ar: "كل سؤال جديد تكتشفه أثناء القراءة بداية لفهم أعمق.", en: "A thoughtful question can lead to deeper understanding.", tip: "احتفظ بقائمة أسئلة قصيرة؛ ابحث عن إجابة أحدها في قراءتك التالية.", tip_en: "Keep a short list of questions and explore one in your next reading session." },
  { ar: "التعلّم يبدأ عندما تحوّل ما تقرؤه إلى فهم وتطبيق.", en: "Turn what you read into understanding and practice.", tip: "بعد قراءة مثال محلول، حاول حل مسألة مشابهة دون الرجوع إليه.", tip_en: "After reading a worked example, try a similar problem without looking back." },
  { ar: "فكرة تفهمها جيدًا تفتح لك أبوابًا أكثر من صفحات تمرّ بها سريعًا.", en: "One well-understood idea can open many doors.", tip: "اربط الفكرة الجديدة بمفهوم تعرفه، واكتب الرابط في سطر واحد.", tip_en: "Connect a new idea to something you already know and record the connection." }
]);

export function dayIndex(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}
export function dailyMessage(date = new Date()) {
  return READING_MESSAGES[((dayIndex(date) % READING_MESSAGES.length) + READING_MESSAGES.length) % READING_MESSAGES.length];
}
export function dailyBook(books, date = new Date()) {
  const available = books.filter(book => book.enabled && !book.demo).sort((a, b) => a.id.localeCompare(b.id, "en"));
  return available.length ? available[((dayIndex(date) % available.length) + available.length) % available.length] : null;
}
