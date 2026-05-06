import { authHeaders } from "../../logging_middleware/index.js";

const BASE_URL = process.env.EVALUATION_API_BASE_URL || "http://20.207.122.201/evaluation-service";

async function getJson(path) {
  const headers = { Accept: "application/json", ...(await authHeaders()) };

  const response = await fetch(`${BASE_URL}${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  return response.json();
}

export function fetchDepots() {
  return getJson("/depots");
}

export function fetchVehicles() {
  return getJson("/vehicles");
}
