# Notification System Design

## Stage 1

### Core APIs

`GET /students/{studentId}/notifications`

Headers:

```http
Authorization: Bearer <token>
Accept: application/json
```

Query parameters:

| Name | Required | Description |
| --- | --- | --- |
| `limit` | No | Page size, default `20`, max `100` |
| `cursor` | No | Cursor returned by the previous response |
| `unreadOnly` | No | `true` to fetch only unread notifications |
| `type` | No | One of `Event`, `Result`, `Placement` |

Response:

```json
{
  "notifications": [
    {
      "id": "notification-id",
      "studentId": 1042,
      "type": "Placement",
      "title": "CSX Corporation hiring",
      "message": "CSX Corporation hiring",
      "isRead": false,
      "createdAt": "2026-04-22T17:51:18Z"
    }
  ],
  "nextCursor": "opaque-cursor"
}
```

`PATCH /students/{studentId}/notifications/{notificationId}/read`

Request:

```json
{ "isRead": true }
```

Response:

```json
{ "status": "updated" }
```

`GET /students/{studentId}/notifications/stream`

This uses Server-Sent Events for real-time notification delivery. WebSockets are also valid, but SSE is simpler when the client only needs server-to-client pushes.

## Stage 2

Use PostgreSQL for the primary system of record because the domain needs strong consistency for read state, auditing, pagination, and admin queries. A NoSQL store can handle this, but relational indexing and transactional updates are a better fit for notification inboxes.

Schema:

```sql
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE student_notifications (
  student_id BIGINT NOT NULL,
  notification_id UUID NOT NULL REFERENCES notifications(id),
  is_read BOOLEAN NOT NULL DEFAULT false,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  PRIMARY KEY (student_id, notification_id)
);
```

As volume grows, the join table becomes the hot table. Partition `student_notifications` by hash on `student_id`, keep notifications immutable, and archive old read rows after the retention period.

## Stage 3

The query is too slow if it scans many rows for a student and then sorts them:

```sql
SELECT *
FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

Indexing every column is wasteful: it slows writes, increases storage, and still may not match the query shape. The useful index is a composite partial index:

```sql
CREATE INDEX idx_student_unread_created
ON student_notifications (student_id, delivered_at DESC)
WHERE is_read = false;
```

If the notification type filter is common, add a targeted index with type included in the query path:

```sql
CREATE INDEX idx_student_type_unread_created
ON student_notifications (student_id, notification_type, delivered_at DESC)
WHERE is_read = false;
```

This changes lookup cost from scanning a large table to reading a small ordered index range for one student.

## Stage 4

Do not fetch notifications from the database on every page load. Keep a short-lived Redis cache per student for unread counts and the first notification page, invalidate it when a new notification is delivered or when the student marks one as read, and use cursor pagination for older pages.

Real-time updates should flow through SSE or WebSocket connections. The page loads cached state first, then receives new events through the stream. This reduces database pressure while keeping the interface current.

Tradeoff: cache invalidation adds complexity and stale reads are possible for a few seconds. For notifications, that is acceptable if read/unread mutations invalidate immediately.

## Stage 5

The current pseudocode is not reliable because email, database, and push writes are performed sequentially. If `send_email` fails after 200 students, some students receive partial delivery and the function has no clean resume point.

Improved flow:

```text
notify_all(student_ids, message):
  campaign_id = create_campaign(message)
  for student_id in student_ids:
    enqueue NotificationJob(campaign_id, student_id, message)

worker(job):
  if already_processed(job.campaign_id, job.student_id):
    return
  begin transaction
    insert inbox notification with unique(campaign_id, student_id)
    insert outbox rows for email and push
  commit
  process outbox with retries and dead-letter queue
```

This design is reliable because each student has an idempotency key. Retrying the job will not duplicate inbox rows, and failed email/push work can be retried independently from database persistence.

## Stage 6

Priority should combine notification type, recency, and message content. For the supplied API shape, a practical scoring formula is:

```text
priority = type_weight + keyword_weight + recency_weight
```

Example weights:

| Signal | Score |
| --- | --- |
| Placement | 20 |
| Result | 15 |
| Event | 10 |
| hiring/selected | +10 |
| interview | +8 |
| project | +6 |
| newer than 24 hours | up to +20 |

For large inputs, keep only the top 10 in a min-heap. Each notification is scored once. The complexity is `O(n log 10)`, effectively linear, with `O(10)` extra memory.

The implementation is in `notification_app_be/src/priorityInbox.js` and exposed through:

```http
GET /notifications/top?limit=10
POST /notifications/top
```
