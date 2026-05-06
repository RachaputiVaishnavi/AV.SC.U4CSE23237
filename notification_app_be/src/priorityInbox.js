const TYPE_WEIGHT = {
  Placement: 20,
  Result: 15,
  Event: 10
};

const KEYWORD_WEIGHT = {
  hiring: 10,
  selected: 10,
  interview: 8,
  project: 6,
  farewell: 2
};

export function normalizeNotifications(payload) {
  const list = payload?.notifications || payload || [];
  if (!Array.isArray(list)) return [];

  return list
    .map((item) => ({
      id: item.ID || item.id,
      type: item.Type || item.type,
      message: item.Message || item.message || "",
      timestamp: item.Timestamp || item.timestamp
    }))
    .filter((item) => item.id && item.type && item.timestamp);
}

export function calculatePriority(notification, now = new Date()) {
  const typeScore = TYPE_WEIGHT[notification.type] || 5;
  const message = notification.message.toLowerCase();
  const keywordScore = Object.entries(KEYWORD_WEIGHT).reduce(
    (sum, [keyword, weight]) => sum + (message.includes(keyword) ? weight : 0),
    0
  );
  const ageHours = Math.max(0, (now.getTime() - new Date(notification.timestamp).getTime()) / 36e5);
  const recencyScore = Math.max(0, 20 - ageHours / 12);

  return Math.round((typeScore + keywordScore + recencyScore) * 100) / 100;
}

class MinHeap {
  constructor(compare) {
    this.items = [];
    this.compare = compare;
  }

  get size() {
    return this.items.length;
  }

  peek() {
    return this.items[0];
  }

  push(item) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  replaceRoot(item) {
    this.items[0] = item;
    this.bubbleDown(0);
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.items[parent], this.items[index]) <= 0) break;
      [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
      index = parent;
    }
  }

  bubbleDown(index) {
    for (;;) {
      let smallest = index;
      const left = index * 2 + 1;
      const right = index * 2 + 2;

      if (left < this.items.length && this.compare(this.items[left], this.items[smallest]) < 0) smallest = left;
      if (right < this.items.length && this.compare(this.items[right], this.items[smallest]) < 0) smallest = right;
      if (smallest === index) break;

      [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
      index = smallest;
    }
  }
}

export function getTopPriorityNotifications(notifications, limit = 10, now = new Date()) {
  const heap = new MinHeap((a, b) => a.priority - b.priority);

  for (const notification of notifications) {
    const item = {
      ...notification,
      priority: calculatePriority(notification, now)
    };
    if (heap.size < limit) heap.push(item);
    else if (item.priority > heap.peek().priority) heap.replaceRoot(item);
  }

  return heap.items.sort((a, b) => b.priority - a.priority || new Date(b.timestamp) - new Date(a.timestamp));
}
