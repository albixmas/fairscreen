import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

let connection: IORedis | null = null;
function getConnection() {
  if (!connection) {
    connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

export const parseCvQueue = new Queue("parse_cv_file", { connection: getConnection() });
export const cohortFinalizeQueue = new Queue("cohort_finalize_stats", { connection: getConnection() });
export const assignZoneQueue = new Queue("assign_zone_under_policy", { connection: getConnection() });
