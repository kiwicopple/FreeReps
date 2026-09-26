import { useSyncExternalStore } from "react";
import { localTimeZone, localToday } from "../utils/localDate";

const snapshot = () => `${localTimeZone()}|${localToday()}`;
function subscribe(notify: () => void) {
  const timer = window.setInterval(notify, 60_000);
  window.addEventListener("focus", notify);
  document.addEventListener("visibilitychange", notify);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", notify);
    document.removeEventListener("visibilitychange", notify);
  };
}

/** Refresh date-dependent queries at midnight and when returning to the app after travel. */
export function useLocalDay() {
  const [timezone, today] = useSyncExternalStore(subscribe, snapshot).split(
    "|",
  );
  return { timezone, today };
}
