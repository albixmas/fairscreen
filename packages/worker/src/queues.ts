import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

export const QUEUE_NAMES = {
  PARSE_CV: "parse_cv_file",
  LLM_EXTRACT: "llm_extract_candidate",
  PRESCREEN: "prescreen_candidate",
  SCORE_LADDERS: "score_candidate_ladders",
  COHORT_FINALIZE: "cohort_finalize_stats",
  ASSIGN_ZONE: "assign_zone_under_policy",
} as const;

export const parseCvQueue = new Queue(QUEUE_NAMES.PARSE_CV, { connection });
export const llmExtractQueue = new Queue(QUEUE_NAMES.LLM_EXTRACT, { connection });
export const prescreenQueue = new Queue(QUEUE_NAMES.PRESCREEN, { connection });
export const scoreLaddersQueue = new Queue(QUEUE_NAMES.SCORE_LADDERS, { connection });
export const cohortFinalizeQueue = new Queue(QUEUE_NAMES.COHORT_FINALIZE, { connection });
export const assignZoneQueue = new Queue(QUEUE_NAMES.ASSIGN_ZONE, { connection });
