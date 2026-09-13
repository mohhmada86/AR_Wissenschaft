export const MAX_FEATURED_BOOKS = 5;

const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });

export function visibleBooks(books) {
  return books.filter(book => book.enabled && !book.demo);
}

function realCover(book) {
  return Boolean(book.cover) && !book.cover.endsWith("placeholder.svg");
}

export function categorySummaries(books) {
  const groups = new Map();
  books.forEach((book, index) => {
    if (!groups.has(book.category)) {
      groups.set(book.category, { name: book.category, books: [], firstIndex: index });
    }
    groups.get(book.category).books.push(book);
  });
  return [...groups.values()].sort((a, b) =>
    b.books.length - a.books.length ||
    collator.compare(a.name, b.name) ||
    a.firstIndex - b.firstIndex
  );
}

export function selectFeaturedBooks(books, site, summaries) {
  const selected = [];
  const selectedIDs = new Set();
  const representedCategories = new Set();

  const add = book => {
    if (!book || selectedIDs.has(book.id) || selected.length >= MAX_FEATURED_BOOKS) return;
    selected.push(book);
    selectedIDs.add(book.id);
    representedCategories.add(book.category);
  };

  if (Array.isArray(site.featured_book_ids)) {
    site.featured_book_ids.slice(0, MAX_FEATURED_BOOKS)
      .forEach(id => add(books.find(book => book.id === id)));
  }

  for (const summary of summaries) {
    if (selected.length >= MAX_FEATURED_BOOKS) break;
    if (representedCategories.has(summary.name)) continue;
    add(summary.books.find(realCover) || summary.books[0]);
  }

  if (selected.length < MAX_FEATURED_BOOKS) {
    [...books]
      .sort((a, b) => Number(realCover(b)) - Number(realCover(a)))
      .forEach(add);
  }

  return selected;
}

export function bookCountLabel(count) {
  if (count === 1) return "كتاب واحد";
  if (count === 2) return "كتابان";
  if (count >= 3 && count <= 10) return `${count} كتب`;
  return `${count} كتابًا`;
}
