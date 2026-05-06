import http from "node:http";
import { createLogger, httpError, readJson, sendJson, withRequestLogging } from "../../logging_middleware/index.js";
import { fetchDepots, fetchVehicles } from "./apiClient.js";
import { chooseMaintenanceTasks, normalizeDepots, normalizeTasks } from "./scheduler.js";

const logger = createLogger("vehicle-maintenance-scheduler", "service");
const PORT = Number(process.env.VEHICLE_SERVICE_PORT || 3001);

function buildSchedule(depots, tasks) {
  return depots.map((depot) => ({
    depotId: depot.depotId,
    mechanicHours: depot.mechanicHours,
    ...chooseMaintenanceTasks(tasks, depot.mechanicHours)
  }));
}

async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { status: "ok", service: "vehicle_maintenance_scheduler" });
  }

  if (req.method === "GET" && url.pathname === "/schedule") {
    const [depotPayload, vehiclePayload] = await Promise.all([fetchDepots(), fetchVehicles()]);
    const depots = normalizeDepots(depotPayload);
    const tasks = normalizeTasks(vehiclePayload);
    return sendJson(res, 200, {
      schedules: buildSchedule(depots, tasks),
      taskCount: tasks.length
    });
  }

  if (req.method === "POST" && url.pathname === "/schedule") {
    const body = await readJson(req);
    const depots = normalizeDepots(body.depots ? { depots: body.depots } : [{ ID: body.depotId || 1, MechanicHours: body.mechanicHours }]);
    const tasks = normalizeTasks(body.vehicles || body.tasks || []);
    if (depots.length === 0) throw httpError(400, "At least one depot/mechanicHours value is required");
    if (tasks.length === 0) throw httpError(400, "At least one vehicle task is required");
    return sendJson(res, 200, { schedules: buildSchedule(depots, tasks), taskCount: tasks.length });
  }

  throw httpError(404, "Route not found");
}

const server = http.createServer(withRequestLogging(handler, logger));

server.listen(PORT, () => {
  logger.info("service_started", { port: PORT });
});
