import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "./queues";
import {
  processParseCv,
  processLlmExtract,
  processPrescreen,
  processScoreLadders,
  processCohortFinalize,
  processAssignZone,
} from "./processors";

console.log("Starting FairScreen workers...");

const parseCvWorker = new Worker(
  QUEUE_NAMES.PARSE_CV,
  async (job) => processParseCv(job.data),
  { connection, concurrency: 5 }
);

const llmExtractWorker = new Worker(
  QUEUE_NAMES.LLM_EXTRACT,
  async (job) => processLlmExtract(job.data),
  { connection, concurrency: 3 }
);

const prescreenWorker = new Worker(
  QUEUE_NAMES.PRESCREEN,
  async (job) => processPrescreen(job.data),
  { connection, concurrency: 5 }
);

const scoreLaddersWorker = new Worker(
  QUEUE_NAMES.SCORE_LADDERS,
  async (job) => processScoreLadders(job.data),
  { connection, concurrency: 5 }
);

const cohortFinalizeWorker = new Worker(
  QUEUE_NAMES.COHORT_FINALIZE,
  async (job) => processCohortFinalize(job.data),
  { connection, concurrency: 1 }
);

const assignZoneWorker = new Worker(
  QUEUE_NAMES.ASSIGN_ZONE,
  async (job) => processAssignZone(job.data),
  { connection, concurrency: 1 }
);

const workers = [
  parseCvWorker, llmExtractWorker, prescreenWorker,
  scoreLaddersWorker, cohortFinalizeWorker, assignZoneWorker,
];

for (const w of workers) {
  w.on("completed", (job) => {
    console.log(`[${w.name}] Job ${job.id} completed`);
  });
  w.on("failed", (job, err) => {
    console.error(`[${w.name}] Job ${job?.id} failed:`, err.message);
  });
}

console.log("All workers started. Listening for jobs...");

process.on("SIGINT", async () => {
  console.log("Shutting down workers...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});
