import { createChannel } from "../src/infrai_realtime.js";

const [propertyId, residentId] = process.argv.slice(2);
if (!propertyId || !residentId) {
  console.error("Usage: npm run setup:channel -- <property-id> <resident-id>");
  process.exit(1);
}

const channel = `property:${propertyId}:resident:${residentId}`;
const result = await createChannel(channel);
console.log(JSON.stringify({ created: true, channel, result }, null, 2));
