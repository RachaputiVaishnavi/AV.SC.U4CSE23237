const API_BASE_URL = process.env.EVALUATION_API_BASE_URL || "http://20.207.122.201/evaluation-service";
const LEVELS = new Set(["debug", "info", "warn", "error", "fatal"]);
const BACKEND_PACKAGES = new Set([
  "cache",
  "controller",
  "cron_job",
  "db",
  "domain",
  "handler",
  "repository",
  "route",
  "service",
  "auth",
  "config",
  "middleware",
  "utils"
]);

let cachedToken = process.env.AFFORDMED_TOKEN || process.env.EVALUATION_API_TOKEN || "";

function now() {
  return new Date().toISOString();
}

function serializeError(error) {
  if (!error) return undefined;
  return {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  };
}

export async function getAuthorizationToken() {
  if (cachedToken) return cachedToken;

  const payload = {
    email: process.env.AFFORDMED_EMAIL,
    name: process.env.AFFORDMED_NAME,
    rollNo: process.env.AFFORDMED_ROLL_NO,
    accessCode: process.env.AFFORDMED_ACCESS_CODE,
    clientID: process.env.AFFORDMED_CLIENT_ID,
    clientSecret: process.env.AFFORDMED_CLIENT_SECRET
  };

  const missing = Object.entries(payload)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing auth environment values: ${missing.join(", ")}`);
  }

  const response = await fetch(`${API_BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Auth failed with ${response.status}`);
  }

  const body = await response.json();
  cachedToken = body.access_token || body.accessToken || body.token;
  if (!cachedToken) throw new Error("Auth response did not include an access token");
  return cachedToken;
}

export async function authHeaders() {
  const token = await getAuthorizationToken();
  return { Authorization: `Bearer ${token}` };
}

export async function registerClient() {
  const payload = {
    email: process.env.AFFORDMED_EMAIL,
    name: process.env.AFFORDMED_NAME,
    mobileNo: process.env.AFFORDMED_MOBILE_NO,
    githubUsername: process.env.AFFORDMED_GITHUB_USERNAME,
    rollNo: process.env.AFFORDMED_ROLL_NO,
    accessCode: process.env.AFFORDMED_ACCESS_CODE
  };

  const missing = Object.entries(payload)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing registration environment values: ${missing.join(", ")}`);
  }

  const response = await fetch(`${API_BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Registration failed with ${response.status}`);
  }

  return response.json();
}

export async function Log(stack, level, packageName, message) {
  const normalizedStack = String(stack || "").toLowerCase();
  const normalizedLevel = String(level || "").toLowerCase();
  const normalizedPackage = String(packageName || "").toLowerCase();

  if (normalizedStack !== "backend" && normalizedStack !== "frontend") {
    throw new Error("stack must be backend or frontend");
  }
  if (!LEVELS.has(normalizedLevel)) {
    throw new Error("level must be debug, info, warn, error, or fatal");
  }
  if (normalizedStack === "backend" && !BACKEND_PACKAGES.has(normalizedPackage)) {
    throw new Error("invalid backend package");
  }

  const headers = await authHeaders();
  const response = await fetch(`${API_BASE_URL}/logs`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      stack: normalizedStack,
      level: normalizedLevel,
      package: normalizedPackage,
      message: String(message || "")
    })
  });

  if (!response.ok) {
    throw new Error(`Log API failed with ${response.status}`);
  }

  return response.json();
}

export function createLogger(scope = "app", packageName = "handler") {
  function write(level, message, details = {}) {
    if (!LEVELS.has(level)) level = "info";
    const line = {
      timestamp: now(),
      level,
      scope,
      message,
      ...details
    };
    const output = JSON.stringify(line);
    if (level === "error") console.error(output);
    else if (level === "warn") console.warn(output);
    else console.log(output);

    if (process.env.DISABLE_REMOTE_LOGS !== "true") {
      Log("backend", level, packageName, `${message} ${JSON.stringify(details)}`).catch((error) => {
        console.warn(
          JSON.stringify({
            timestamp: now(),
            level: "warn",
            scope: "logging_middleware",
            message: "remote_log_failed",
            error: error.message
          })
        );
      });
    }
  }

  return {
    debug: (message, details) => write("debug", message, details),
    info: (message, details) => write("info", message, details),
    warn: (message, details) => write("warn", message, details),
    fatal: (message, details) => write("fatal", message, details),
    error: (message, error, details = {}) =>
      write("error", message, { ...details, error: serializeError(error) })
  };
}

export function withRequestLogging(handler, logger = createLogger("http")) {
  return async (req, res) => {
    const startedAt = performance.now();
    const requestId = crypto.randomUUID();
    res.setHeader("X-Request-Id", requestId);

    logger.info("request_started", {
      requestId,
      method: req.method,
      url: req.url
    });

    try {
      await handler(req, res, { logger, requestId });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      logger.error("request_failed", error, {
        requestId,
        statusCode,
        method: req.method,
        url: req.url
      });
      if (!res.headersSent) {
        sendJson(res, statusCode, {
          error: statusCode === 500 ? "Internal Server Error" : error.message,
          requestId
        });
      }
    } finally {
      logger.info("request_finished", {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100
      });
    }
  };
}

export function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
}

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw httpError(400, "Invalid JSON body");
  }
}
