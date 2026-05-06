# AffordMed Backend Assessment

Backend submission for the AffordMed campus hiring evaluation.

## Required repository structure

Keep these items in the repository exactly as required by the backend track instructions:

```text
AffordMed/
|-- logging_middleware/
|-- vehicle_maintenance_scheduler/
|-- notification_app_be/
|-- notification_system_design.md
`-- .gitignore
```

## Files kept in this submission

Required items:

- `logging_middleware/`
- `vehicle_maintenance_scheduler/`
- `notification_app_be/`
- `notification_system_design.md`
- `.gitignore`

Supporting items used to run the services locally:

- `package.json`
- `scripts/`
- `README.md`

## What each folder contains

### `logging_middleware/`

Reusable logging package integrated into the backend services.

- structured logging helpers
- AffordMed auth helper support
- AffordMed `/logs` API integration
- request logging wrapper for local services

### `vehicle_maintenance_scheduler/`

Vehicle maintenance scheduling microservice.

- fetches depot data from AffordMed `/depots`
- fetches vehicle task data from AffordMed `/vehicles`
- computes the best subset of tasks using a 0/1 knapsack style approach
- exposes local endpoints for health check and schedule generation

### `notification_app_be/`

Priority notifications microservice.

- fetches notifications from AffordMed `/notifications`
- ranks notifications using type, message, and recency
- exposes local endpoints for health check and top notification retrieval

### `notification_system_design.md`

Contains the Stage 1 to Stage 6 notification system design answers.

## AffordMed APIs used inside the backend

The backend integrates with these protected upstream APIs:

- `/register`
- `/auth`
- `/logs`
- `/depots`
- `/vehicles`
- `/notifications`

These are consumed inside the backend services. The submission proof endpoints are the local `localhost` APIs.

## How to run

Run from:

```powershell
cd C:\Users\shiva\Documents\AffordMed
```

Start vehicle service:

```powershell
$env:AFFORDMED_TOKEN="your_access_token"
$env:DISABLE_REMOTE_LOGS="true"
npm.cmd run start:vehicle
```

Start notification service in a second terminal:

```powershell
cd C:\Users\shiva\Documents\AffordMed
$env:AFFORDMED_TOKEN="your_access_token"
$env:DISABLE_REMOTE_LOGS="true"
npm.cmd run start:notifications
```

## Local endpoints

Vehicle scheduler:

- `GET http://localhost:3001/health`
- `POST http://localhost:3001/schedule`
- `GET http://localhost:3001/schedule`

Notifications:

- `GET http://localhost:3002/health`
- `POST http://localhost:3002/notifications/top`
- `GET http://localhost:3002/notifications/top`

## Postman verification

Verified using:

- `GET /health` for both services
- `POST /schedule` with sample body
- `GET /schedule` using AffordMed data
- `GET /notifications/top` using AffordMed data

## Note

No user login or registration is implemented in the application, as the problem statement states that users should be treated as pre-authorized.
