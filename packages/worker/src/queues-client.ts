/**
 * Re-export queues for use from the web app.
 * This allows the Next.js app to enqueue jobs without importing the full worker.
 */
export {
  parseCvQueue,
  llmExtractQueue,
  prescreenQueue,
  scoreLaddersQueue,
  cohortFinalizeQueue,
  assignZoneQueue,
  QUEUE_NAMES,
} from "./queues";
