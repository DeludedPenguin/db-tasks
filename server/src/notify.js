// ============= Notifications (ntfy) =============
// Optional scheduled notifications for the self-hosted API.
// Entirely env-var driven — see the "Notifications (ntfy)" section of
// SELF_HOSTING.md. Disabled unless NTFY_URL is set and NTFY_ENABLED=true.

import { query } from "./db.js";

const CHECK_INTERVAL_MS = 30_000;
const SEND_TIMEOUT_MS = 10_000;

const config = {
  url: process.env.NTFY_URL || "",
  enabled: process.env.NTFY_ENABLED === "true",
  token: process.env.NTFY_TOKEN || "",
  digestAt: process.env.NTFY_DIGEST_AT || "08:00",
  escalateAt: process.env.NTFY_ESCALATE_AT || "",
  tzOffset: process.env.NTFY_TZ_OFFSET || "+10:00",
};

const state = {
  lastDigest: null, // { date, title, sentAt }
  lastEscalation: null, // { date, title, sentAt }
  lastError: null,
};

let timer = null;

export function notifyConfigured() {
  return Boolean(config.url) && config.enabled;
}

export function notifyStatus() {
  return {
    digestAt: config.digestAt,
    escalateAt: config.escalateAt || null,
    tzOffset: config.tzOffset,
    lastDigest: state.lastDigest,
    lastEscalation: state.lastEscalation,
    lastError: state.lastError,
  };
}

function offsetMinutes(offset) {
  const m = /^([+-])(\d{1,2}):?(\d{2})$/.exec(String(offset).trim());
  if (!m) return 600; // unparseable → default +10:00 (Melbourne)
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

// "Today" and the wall-clock time in the configured timezone, so the digest
// fires on the user's morning rather than the server's UTC clock.
export function localNow(now = new Date()) {
  const d = new Date(now.getTime() + offsetMinutes(config.tzOffset) * 60_000);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

async function sendNtfy(title, body) {
  if (!config.url) return false;
  const headers = { Title: title };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`ntfy responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    state.lastError = null;
    return true;
  } catch (err) {
    state.lastError = String(err.message || err);
    console.error("ntfy send failed:", state.lastError);
    return false;
  }
}

export async function sendTestNotification() {
  const { date, time } = localNow();
  return sendNtfy(
    "DB_Tasks test notification",
    `Notifications are working. Sent ${time} local time on ${date}.`,
  );
}

async function loadOpenTasks() {
  return query(`
    SELECT name, priority,
           to_char(due_date, 'YYYY-MM-DD') AS due_date,
           to_char(do_date, 'YYYY-MM-DD')  AS do_date
    FROM tasks
    WHERE completed = false
      AND (due_date IS NOT NULL OR do_date IS NOT NULL)
  `);
}

function daysOverdue(dueDate, today) {
  return Math.round((Date.parse(today) - Date.parse(dueDate)) / 86_400_000);
}

function label(t) {
  return t.priority ? ` [P${t.priority}]` : "";
}

async function buildDigest(today) {
  const tasks = await loadOpenTasks();
  const dueToday = tasks.filter((t) => t.due_date === today);
  const doToday = tasks.filter((t) => t.do_date === today && t.due_date !== today);
  const overdue = tasks
    .filter((t) => t.due_date && t.due_date < today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  if (dueToday.length === 0 && doToday.length === 0 && overdue.length === 0) {
    return { title: "DB_Tasks — all clear", body: "Nothing due or scheduled for today." };
  }

  const sections = [];
  if (dueToday.length) {
    sections.push(
      `Due today (${dueToday.length}):\n${dueToday.map((t) => `- ${t.name}${label(t)}`).join("\n")}`,
    );
  }
  if (doToday.length) {
    sections.push(
      `Do today (${doToday.length}):\n${doToday.map((t) => `- ${t.name}${label(t)}`).join("\n")}`,
    );
  }
  if (overdue.length) {
    sections.push(
      `Overdue (${overdue.length}):\n${overdue
        .map((t) => {
          const n = daysOverdue(t.due_date, today);
          return `- ${t.name} — overdue ${n} day${n === 1 ? "" : "s"}${label(t)}`;
        })
        .join("\n")}`,
    );
  }
  return {
    title: `DB_Tasks — ${dueToday.length + doToday.length} today, ${overdue.length} overdue`,
    body: sections.join("\n\n"),
  };
}

async function buildEscalation(today) {
  const tasks = await loadOpenTasks();
  const overdue = tasks
    .filter((t) => t.due_date && t.due_date < today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  if (overdue.length === 0) return null;
  return {
    title: `DB_Tasks — ${overdue.length} overdue`,
    body: overdue
      .map((t) => {
        const n = daysOverdue(t.due_date, today);
        return `- ${t.name} — overdue ${n} day${n === 1 ? "" : "s"}${label(t)}`;
      })
      .join("\n"),
  };
}

async function checkSchedule() {
  if (!notifyConfigured()) return;
  const { date, time } = localNow();

  // Fire once per day when the local clock has passed the scheduled time —
  // also catches a container that starts after the scheduled moment.
  try {
    if (time >= config.digestAt && state.lastDigest?.date !== date) {
      const { title, body } = await buildDigest(date);
      const ok = await sendNtfy(title, body);
      state.lastDigest = { date, title, sentAt: new Date().toISOString(), ok };
    }
    if (config.escalateAt && time >= config.escalateAt && state.lastEscalation?.date !== date) {
      const message = await buildEscalation(date);
      if (message) {
        const ok = await sendNtfy(message.title, message.body);
        state.lastEscalation = { date, title: message.title, sentAt: new Date().toISOString(), ok };
      } else {
        state.lastEscalation = { date, title: "nothing overdue", sentAt: new Date().toISOString(), ok: true };
      }
    }
  } catch (err) {
    console.error("Notification scheduler error:", err);
  }
}

export function startNotifyScheduler() {
  if (!notifyConfigured()) {
    console.log("Notifications disabled (set NTFY_URL and NTFY_ENABLED=true to enable)");
    return;
  }
  if (timer) return;
  console.log(
    `ntfy notifications enabled — digest at ${config.digestAt} local (${config.tzOffset})` +
      (config.escalateAt ? `, escalation at ${config.escalateAt}` : ""),
  );
  checkSchedule();
  timer = setInterval(checkSchedule, CHECK_INTERVAL_MS);
  timer.unref?.();
}
