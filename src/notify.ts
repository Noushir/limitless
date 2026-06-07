import { spawn } from "node:child_process";
import type { Config, WebhookFormat } from "./types.js";

export type NotifyEventType =
  | "started" | "sleeping" | "resumed" | "finished" | "failed" | "weekly_stopped";

export interface NotifyEvent {
  type: NotifyEventType;
  message: string;
}

export interface Notifier {
  send(title: string, message: string): Promise<void>;
}

export const macNotifier: Notifier = {
  send: (title, message) =>
    new Promise((resolve) => {
      const safe = (s: string) => s.replace(/"/g, '\\"');
      const script = `display notification "${safe(message)}" with title "${safe(title)}" sound name "Glass"`;
      const child = spawn("osascript", ["-e", script], { stdio: "ignore" });
      child.on("error", () => resolve());
      child.on("close", () => resolve());
    }),
};

export function formatWebhook(
  format: WebhookFormat,
  event: NotifyEvent,
): { body: string; headers: Record<string, string> } {
  const text = `[limitless] ${event.message}`;
  switch (format) {
    case "slack":
      return { body: JSON.stringify({ text }), headers: { "Content-Type": "application/json" } };
    case "telegram":
    case "pushover":
    case "generic":
      return { body: JSON.stringify({ message: text, event: event.type }), headers: { "Content-Type": "application/json" } };
    case "ntfy":
    default:
      return { body: text, headers: { "Content-Type": "text/plain" } };
  }
}

export interface NotifyDeps {
  notifier?: Notifier;
  fetchFn?: typeof fetch;
}

export async function notify(event: NotifyEvent, config: Config, deps: NotifyDeps = {}): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (config.notify.local) {
    const notifier = deps.notifier ?? macNotifier;
    tasks.push(notifier.send("limitless", event.message).catch(() => {}));
  }
  const url = config.notify.webhook.url;
  if (url) {
    const fetchFn = deps.fetchFn ?? fetch;
    const { body, headers } = formatWebhook(config.notify.webhook.format, event);
    tasks.push(fetchFn(url, { method: "POST", body, headers }).then(() => {}).catch(() => {}));
  }
  await Promise.all(tasks);
}
