import "dotenv/config";
import { startScheduler } from "./scheduler.js";
import { runCollection } from "./collector.js";
import { sendReport } from "./report.js";

const cmd = process.argv[2];

if (cmd === "collect") {
  // npm run dev collect — one-shot collection for testing
  runCollection().then(() => process.exit(0));
} else if (cmd === "report") {
  // npm run dev report — send report immediately for testing
  sendReport().then(() => process.exit(0));
} else {
  // Normal mode: start scheduler
  console.log("🤖 Days Digest News bot started");
  console.log(`   Kyiv time: ${new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kiev" })}`);
  startScheduler();
}
