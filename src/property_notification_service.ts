import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { InfraiError, issueResidentToken, publishResidentEvent } from "./infrai_realtime.js";
import { planNotification, propertyEventSchema } from "./notification_policy.js";

const tokenRequestSchema = z.object({
  clientId: z.string().min(1),
  propertyId: z.string().min(1),
  residentId: z.string().min(1),
});

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64_000) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/notifications") {
      const input = propertyEventSchema.parse(await readJson(request));
      const notification = planNotification(input);
      await publishResidentEvent(
        {
          channel: notification.channel,
          event: notification.event,
          data: notification.data,
          account_id: input.propertyId,
        },
        notification.deliveryId,
      );
      send(response, 202, { accepted: true, notification });
      return;
    }

    if (request.method === "POST" && request.url === "/realtime-token") {
      const input = tokenRequestSchema.parse(await readJson(request));
      const channel = `property:${input.propertyId}:resident:${input.residentId}`;
      const token = await issueResidentToken(input.clientId, channel);
      send(response, 200, { channel, token: token.token });
      return;
    }

    send(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      send(response, 400, { error: "Invalid request", issues: error.issues });
    } else if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.message, detail: error.detail });
    } else {
      send(response, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
    }
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Property notifier listening on http://localhost:${port}`));
