// Worker script for importPerformance.test.mjs: a node worker_threads
// stand-in for a browser module worker.
import { parentPort } from "node:worker_threads";
import { exposeParseExcelWorker } from "../../dist/index.js";

exposeParseExcelWorker(parentPort);
