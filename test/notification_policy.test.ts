import assert from "node:assert/strict";
import test from "node:test";
import { planNotification, propertyEventSchema } from "../src/notification_policy.js";

test("an urgent maintenance request becomes a high-priority resident notification", () => {
  const request = propertyEventSchema.parse({
    kind: "maintenance_request",
    propertyId: "oak-court",
    residentId: "resident-42",
    requestId: "mx-104",
    summary: "Water is entering the kitchen",
    urgency: "urgent",
  });

  assert.deepEqual(planNotification(request), {
    channel: "property:oak-court:resident:resident-42",
    event: "maintenance.updated",
    deliveryId: "maintenance:mx-104",
    data: {
      kind: "maintenance_request",
      requestId: "mx-104",
      summary: "Water is entering the kitchen",
      priority: "high",
    },
  });
});
