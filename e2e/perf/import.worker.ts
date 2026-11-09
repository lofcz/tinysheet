import { exposeParseExcelWorker } from "@lofcz/tinysheet-excel";

const loadedMs = performance.now();
let requestedAt = 0;
const scope = globalThis as any;
exposeParseExcelWorker({
  addEventListener(type, listener) {
    scope.addEventListener(type, (event: MessageEvent) => {
      requestedAt = performance.now();
      listener(event);
    });
  },
  postMessage(message, transfer) {
    scope.postMessage(
      {
        ...message,
        benchmark: { loadedMs, parseMs: performance.now() - requestedAt },
      },
      transfer
    );
  },
});
