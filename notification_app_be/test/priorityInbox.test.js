import test from "node:test";
import assert from "node:assert/strict";
import { getTopPriorityNotifications } from "../src/priorityInbox.js";

test("returns only the highest priority notifications", () => {
  const now = new Date("2026-04-22T18:00:00Z");
  const result = getTopPriorityNotifications(
    [
      { id: "1", type: "Event", message: "farewell", timestamp: "2026-04-22 17:51:06" },
      { id: "2", type: "Placement", message: "company hiring interview", timestamp: "2026-04-22 17:51:18" },
      { id: "3", type: "Result", message: "mid-sem", timestamp: "2026-04-21 17:51:18" }
    ],
    2,
    now
  );

  assert.deepEqual(result.map((notification) => notification.id), ["2", "3"]);
});
