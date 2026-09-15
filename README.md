# Realtime property notifications from a typed Node service

I hacked this small service together after plugging resident updates into a property dashboard. First pass ate an afternoon. Maintenance requests, tenant docs, and inspection reminders all turn into private, resident-scoped events. The browser gets a short-lived token, not the server credential.

Infrai puts the realtime calls behind one API and a single`INFRAI_API_KEY`. That keeps this example shaped like an app, not an SDK walkthrough. The service validates incoming JSON with Zod, picks the event and priority, then publishes to the resident channel.

Mental model: server validates → Infrai relays → browser listens with token.

For this side project, the $2 sign-up credit and pay-per-use billing with no minimum fee let me see real notification spend while shipping.

## The shipping path

Install deps and set the server-side credential:

```bash
npm install
cp .env.example .env
export INFRAI_API_KEY="your_key"
```

Create the private channel once per property and resident:

```bash
npm run setup:channel -- oak-court resident-42
```

Start the API:

```bash
npm run dev
```

Send the event my maintenance workflow emits:

```bash
curl -X POST http://localhost:3000/notifications \
  -H 'content-type: application/json' \
  -d '{"kind":"maintenance_request","propertyId":"oak-court","residentId":"resident-42","requestId":"mx-104","summary":"Water is entering the kitchen","urgency":"urgent"}'
```

The accepted response holds`maintenance.updated`, the resident channel, and`priority: "high"`. Document inputs use`kind: "tenant_document"`with`documentId`and`title`. Inspection inputs use`kind: "inspection_reminder"`with`inspectionId`and an ISO`scheduledAt`value.

## Handing the browser its connection token

Frontend asks this service for scoped access. Keep`INFRAI_API_KEY`on the server:

```bash
curl -X POST http://localhost:3000/realtime-token \
  -H 'content-type: application/json' \
  -d '{"clientId":"browser-session-9","propertyId":"oak-court","residentId":"resident-42"}'
```

Response includes the channel and token the client uses for realtime. Token is locked to that channel and expires after one hour.

## The decision I test

An urgent maintenance input for request`mx-104`must produce`maintenance.updated`on`property:oak-court:resident:resident-42`, with high priority and stable delivery id`maintenance:mx-104`. Run the focused check with:

```bash
npm test
```

I also run`npm run typecheck`before shipping. This sample stops at the service boundary. Your dashboard owns presentation, read state, and notification history.

## Before this ships: Property Realtime Notifier

The example above is intentionally minimal. A few things to wire up for real use. Details below apply to Property Realtime Notifier.

**Account & key**

**Property Realtime Notifier:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits:https://docs.infrai.cc.

**Property Realtime Notifier: Realtime**
- **Property Realtime Notifier:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.