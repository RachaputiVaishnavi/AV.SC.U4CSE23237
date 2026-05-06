import http from "node:http";
import { createLogger, httpError, readJson, sendJson, withRequestLogging } from "../../logging_middleware/index.js";
import { fetchNotifications } from "./apiClient.js";
import { getTopPriorityNotifications, normalizeNotifications } from "./priorityInbox.js";

const logger = createLogger("notification-app-be", "service");
const PORT = Number(process.env.NOTIFICATION_SERVICE_PORT || 3002);

async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { status: "ok", service: "notification_app_be" });
  }

  if (req.method === "GET" && url.pathname === "/notifications/top") {
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 10)));
    const payload = await fetchNotifications();
    const notifications = normalizeNotifications(payload);
    return sendJson(res, 200, {
      notifications: getTopPriorityNotifications(notifications, limit),
      totalFetched: notifications.length
    });
  }

  if (req.method === "POST" && url.pathname === "/notifications/top") {
    const body = await readJson(req);
    const limit = Math.min(50, Math.max(1, Number(body.limit || 10)));
    const notifications = normalizeNotifications(body.notifications || []);
    return sendJson(res, 200, {
      notifications: getTopPriorityNotifications(notifications, limit),
      totalFetched: notifications.length
    });
  }

  if (req.method === "POST" && url.pathname === "/notifications/notify-all") {
    const body = await readJson(req);
    if (!Array.isArray(body.studentIds) || !body.message) {
      throw httpError(400, "studentIds[] and message are required");
    }
    return sendJson(res, 202, {
      status: "accepted",
      queuedJobs: body.studentIds.length,
      message: "Jobs should be processed asynchronously by workers with retry and idempotency keys."
    });
  }

  throw httpError(404, "Route not found");
}

const server = http.createServer(withRequestLogging(handler, logger));

server.listen(PORT, () => {
  logger.info("service_started", { port: PORT });
});
