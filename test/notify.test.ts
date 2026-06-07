import { describe, it, expect, vi } from "vitest";
import { notify, formatWebhook, escapeAppleScript } from "../src/notify.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import type { Config } from "../src/types.js";

describe("notify", () => {
  it("sends a local notification when local is enabled", async () => {
    const send = vi.fn(async () => {});
    await notify({ type: "finished", message: "done" }, DEFAULT_CONFIG, {
      notifier: { send },
    });
    expect(send).toHaveBeenCalledWith("limitless", expect.stringContaining("done"));
  });

  it("posts to the webhook when configured", async () => {
    const cfg: Config = {
      ...DEFAULT_CONFIG,
      notify: { local: false, webhook: { url: "https://ntfy.sh/x", format: "ntfy" } },
    };
    const fetchFn = vi.fn(async () => new Response("ok"));
    await notify({ type: "sleeping", message: "until 3pm" }, cfg, {
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(fetchFn).toHaveBeenCalledWith("https://ntfy.sh/x", expect.objectContaining({ method: "POST" }));
  });
});

describe("escapeAppleScript", () => {
  it("escapes backslashes before quotes", () => {
    expect(escapeAppleScript('path C:\\foo "bar"')).toBe('path C:\\\\foo \\"bar\\"');
  });
});

describe("formatWebhook", () => {
  it("ntfy uses a plain-text body", () => {
    const { body } = formatWebhook("ntfy", { type: "finished", message: "all done" });
    expect(body).toContain("all done");
  });

  it("slack wraps the message in a json text field", () => {
    const { body } = formatWebhook("slack", { type: "failed", message: "boom" });
    expect(JSON.parse(body).text).toContain("boom");
  });
});
