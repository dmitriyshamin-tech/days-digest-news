import { runCollection } from "./collector.js";
import { sendReport } from "./report.js";
import { sendWeeklyArticle } from "./weekly.js";

function kyivNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Kiev" }));
}

function msUntil(hour: number, minute: number): number {
  const now = kyivNow();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function scheduleDaily(hour: number, minute: number, task: () => Promise<void>) {
  const ms = msUntil(hour, minute);
  const label = `${hour}:${String(minute).padStart(2, "0")}`;
  console.log(`[scheduler] ${label} → in ${Math.round(ms / 60000)} min`);
  setTimeout(async () => {
    try { await task(); } catch (e) { console.error(`[scheduler] ${label} error:`, e); }
    scheduleDaily(hour, minute, task);
  }, ms);
}

function msUntilWeekly(targetDay: number, hour: number, minute: number): number {
  const now = kyivNow();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  const daysUntil = (targetDay - now.getDay() + 7) % 7 || 7;
  next.setDate(next.getDate() + daysUntil);
  return next.getTime() - now.getTime();
}

function scheduleWeekly(day: number, hour: number, minute: number, task: () => Promise<void>) {
  const ms = msUntilWeekly(day, hour, minute);
  const days = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
  console.log(`[scheduler] Weekly ${days[day]} ${hour}:${String(minute).padStart(2,"0")} → in ${Math.round(ms / 60000)} min`);
  setTimeout(async () => {
    try { await task(); } catch (e) { console.error("[scheduler] weekly error:", e); }
    scheduleWeekly(day, hour, minute, task);
  }, ms);
}

export function startScheduler() {
  scheduleDaily(4, 0,  () => { console.log("[scheduler] Collection pass 1 (04:00)"); return runCollection(); });
  scheduleDaily(6, 0,  () => { console.log("[scheduler] Collection pass 2 (06:00)"); return runCollection(); });
  scheduleDaily(7, 0,  () => { console.log("[scheduler] Sending digest (07:00)");    return sendReport(); });
  scheduleWeekly(5, 17, 0, () => { console.log("[scheduler] Weekly article (Fri 17:00)"); return sendWeeklyArticle(); });
}
