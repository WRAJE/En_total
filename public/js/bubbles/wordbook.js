const Wordbook = {
  getKey() {
    const u = typeof Auth !== "undefined" ? Auth.getUser() : null;
    return u ? `bubbles_wordbook_u${u.id}` : null;
  },

  getAll() {
    const key = this.getKey();
    if (!key) return [];
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  save(words) {
    const key = this.getKey();
    if (!key) return [];
    localStorage.setItem(key, JSON.stringify(words));
    return words;
  },

  add(word) {
    const list = this.getAll();
    if (!list.find((w) => w.en === word.en)) {
      list.push(word);
      this.save(list);
    }
    return list;
  },

  remove(en) {
    const list = this.getAll().filter((w) => w.en !== en);
    this.save(list);
    return list;
  },

  toggle(word) {
    const list = this.getAll();
    const idx = list.findIndex((w) => w.en === word.en);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(word);
    this.save(list);
    return list;
  },

  has(en) {
    return this.getAll().some((w) => w.en === en);
  },

  count() {
    return this.getAll().length;
  },

  clear() {
    const key = this.getKey();
    if (key) localStorage.removeItem(key);
  },
};
