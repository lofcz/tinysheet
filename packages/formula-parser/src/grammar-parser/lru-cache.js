/**
 * Minimal LRU cache on top of Map insertion order.
 */
export default class LruCache {
  constructor(limit) {
    this.limit = limit;
    this.map = new Map();
  }

  get(key) {
    const map = this.map;

    if (!map.has(key)) {
      return void 0;
    }
    const value = map.get(key);

    // Refresh recency.
    map.delete(key);
    map.set(key, value);

    return value;
  }

  set(key, value) {
    const map = this.map;

    if (map.has(key)) {
      map.delete(key);
    } else if (map.size >= this.limit) {
      map.delete(map.keys().next().value);
    }
    map.set(key, value);
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }
}
