export function normalizeTasks(payload) {
  const list = payload?.vehicles || payload?.tasks || payload || [];
  if (!Array.isArray(list)) return [];

  return list
    .map((item, index) => ({
      taskId: item.TaskID || item.taskId || item.id || `task-${index + 1}`,
      duration: Number(item.Duration ?? item.duration ?? item.EstimatedHours),
      impact: Number(item.Impact ?? item.impact ?? item.Score)
    }))
    .filter((item) => item.taskId && item.duration > 0 && item.impact >= 0);
}

export function normalizeDepots(payload) {
  const list = payload?.depots || payload || [];
  if (!Array.isArray(list)) return [];

  return list
    .map((item) => ({
      depotId: item.ID ?? item.id ?? item.depotId,
      mechanicHours: Number(item.MechanicHours ?? item.mechanicHours ?? item.capacity)
    }))
    .filter((item) => item.depotId !== undefined && item.mechanicHours > 0);
}

export function chooseMaintenanceTasks(tasks, mechanicHours) {
  const capacity = Math.floor(Number(mechanicHours));
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return { selectedTasks: [], totalDuration: 0, totalImpact: 0, remainingHours: 0 };
  }

  const validTasks = tasks
    .map((task) => ({
      ...task,
      duration: Math.floor(Number(task.duration)),
      impact: Number(task.impact)
    }))
    .filter((task) => task.duration > 0 && task.duration <= capacity && task.impact >= 0);

  const dp = new Array(capacity + 1).fill(0);
  const keep = Array.from({ length: validTasks.length }, () => new Uint8Array(capacity + 1));

  for (let i = 0; i < validTasks.length; i += 1) {
    const task = validTasks[i];
    for (let hours = capacity; hours >= task.duration; hours -= 1) {
      const candidate = dp[hours - task.duration] + task.impact;
      if (candidate > dp[hours]) {
        dp[hours] = candidate;
        keep[i][hours] = 1;
      }
    }
  }

  const selectedTasks = [];
  let hours = capacity;
  for (let i = validTasks.length - 1; i >= 0; i -= 1) {
    if (keep[i][hours] === 1) {
      const task = validTasks[i];
      selectedTasks.push(task);
      hours -= task.duration;
    }
  }

  selectedTasks.reverse();
  const totalDuration = selectedTasks.reduce((sum, task) => sum + task.duration, 0);
  const totalImpact = selectedTasks.reduce((sum, task) => sum + task.impact, 0);

  return {
    selectedTasks,
    totalDuration,
    totalImpact,
    remainingHours: capacity - totalDuration
  };
}
