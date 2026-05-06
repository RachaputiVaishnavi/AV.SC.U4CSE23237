import test from "node:test";
import assert from "node:assert/strict";
import { chooseMaintenanceTasks } from "../src/scheduler.js";

test("chooses the highest impact tasks within mechanic hours", () => {
  const result = chooseMaintenanceTasks(
    [
      { taskId: "a", duration: 5, impact: 10 },
      { taskId: "b", duration: 4, impact: 40 },
      { taskId: "c", duration: 6, impact: 30 },
      { taskId: "d", duration: 3, impact: 50 }
    ],
    10
  );

  assert.equal(result.totalImpact, 90);
  assert.equal(result.totalDuration, 7);
  assert.deepEqual(result.selectedTasks.map((task) => task.taskId), ["b", "d"]);
});
