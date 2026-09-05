import { z } from "zod";

export const propertyEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("maintenance_request"),
    propertyId: z.string().min(1),
    residentId: z.string().min(1),
    requestId: z.string().min(1),
    summary: z.string().min(1).max(240),
    urgency: z.enum(["routine", "urgent"]),
  }),
  z.object({
    kind: z.literal("tenant_document"),
    propertyId: z.string().min(1),
    residentId: z.string().min(1),
    documentId: z.string().min(1),
    title: z.string().min(1).max(120),
  }),
  z.object({
    kind: z.literal("inspection_reminder"),
    propertyId: z.string().min(1),
    residentId: z.string().min(1),
    inspectionId: z.string().min(1),
    scheduledAt: z.string().datetime(),
  }),
]);

export type PropertyEvent = z.infer<typeof propertyEventSchema>;

export function planNotification(input: PropertyEvent) {
  const channel = `property:${input.propertyId}:resident:${input.residentId}`;

  if (input.kind === "maintenance_request") {
    return {
      channel,
      event: "maintenance.updated",
      deliveryId: `maintenance:${input.requestId}`,
      data: {
        kind: input.kind,
        requestId: input.requestId,
        summary: input.summary,
        priority: input.urgency === "urgent" ? "high" : "normal",
      },
    } as const;
  }

  if (input.kind === "tenant_document") {
    return {
      channel,
      event: "document.ready",
      deliveryId: `document:${input.documentId}`,
      data: { kind: input.kind, documentId: input.documentId, title: input.title },
    } as const;
  }

  return {
    channel,
    event: "inspection.reminder",
    deliveryId: `inspection:${input.inspectionId}`,
    data: {
      kind: input.kind,
      inspectionId: input.inspectionId,
      scheduledAt: input.scheduledAt,
    },
  } as const;
}
