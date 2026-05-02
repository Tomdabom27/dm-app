/**
 * useNotifications.ts
 * Manages browser push notifications for new messages.
 * Requests permission once, then exposes a notify() function.
 * Only fires when the tab is not focused (no double-notifying).
 */

import { useEffect, useRef, useCallback } from "react";

export function useNotifications() {
  const permissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if (!("Notification" in window)) return;
    permissionRef.current = Notification.permission;

    // Request permission if not yet decided
    if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        permissionRef.current = p;
      });
    }
  }, []);

  const notify = useCallback((title: string, body: string) => {
    if (!("Notification" in window)) return;
    if (permissionRef.current !== "granted") return;
    // Only notify when the tab is hidden / not focused
    if (document.visibilityState === "visible") return;

    const n = new Notification(
      title,
      {
        body,
        icon: "/favicon.ico",
        tag: "dm-message", // replaces previous notification instead of stacking
        renotify: true,
      } as NotificationOptions & { renotify?: boolean }
    );

    // Auto-close after 5 seconds
    setTimeout(() => n.close(), 5000);
  }, []);

  return { notify };
}
