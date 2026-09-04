import { startWorker } from "./runtime";
import { startScheduler } from "./scheduler";

// Handlers register themselves on import.
import "./handlers/crawl";
import "./handlers/psi";
import "./handlers/tracking";

// Start daily 6:00 PM IST scheduler
startScheduler();

startWorker().catch((error) => {
  console.error("❌ Worker crashed:", error);
  process.exit(1);
});
