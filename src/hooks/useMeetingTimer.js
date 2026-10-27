import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_END = "meetingEndTime";
const STORAGE_ENDED = "meetingEnded";
const DURATION = 20 * 60; // 20 minutes in seconds

// Module-level state: survives component unmount / page navigation.
// The setInterval keeps ticking as long as the tab is open, regardless of which
// page is mounted, so the countdown never stops or resets.
let endTime = null;
let ended = false;
let listeners = new Set();
let intervalId = null;

function playSchoolBell() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === "suspended") ctx.resume();
    // School-bell pattern: 4 rings with short gaps
    const ring = (start, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + start + 0.02);
      gain.gain.setValueAtTime(0.4, ctx.currentTime + start + dur - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    ring(0, 0.45);
    ring(0.55, 0.45);
    ring(1.1, 0.45);
    ring(1.65, 0.45);
    ring(2.2, 0.6);
  } catch (e) {
    console.error("Bell sound failed", e);
  }
}

function tick() {
  if (!endTime) return;
  const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
  listeners.forEach((fn) => fn(remaining, false));
  if (remaining <= 0 && !ended) {
    ended = true;
    endTime = null;
    localStorage.removeItem(STORAGE_END);
    localStorage.setItem(STORAGE_ENDED, "true");
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    playSchoolBell();
    listeners.forEach((fn) => fn(0, true));
  }
}

function startInterval() {
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(tick, 1000);
  tick();
}

function stopInterval() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

function readEndFromStorage() {
  const stored = localStorage.getItem(STORAGE_END);
  if (!stored) return null;
  const et = parseInt(stored, 10);
  if (isNaN(et)) { localStorage.removeItem(STORAGE_END); return null; }
  return et;
}

export function useMeetingTimer() {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (endTime) return Math.max(0, Math.round((endTime - Date.now()) / 1000));
    const et = readEndFromStorage();
    if (et && et > Date.now()) { endTime = et; return Math.round((et - Date.now()) / 1000); }
    return DURATION;
  });
  const [meetingActive, setMeetingActive] = useState(() => {
    if (endTime) return true;
    const et = readEndFromStorage();
    if (et && et > Date.now()) { endTime = et; return true; }
    return false;
  });
  const [expired, setExpired] = useState(() => {
    if (ended) return true;
    return localStorage.getItem(STORAGE_ENDED) === "true";
  });
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const listener = (remaining, isExpired) => {
      if (!mountedRef.current) return;
      setSecondsLeft(remaining);
      if (isExpired) {
        setMeetingActive(false);
        setExpired(true);
      }
    };
    listeners.add(listener);

    // Resume timer if active in storage but interval not running
    if (!endTime) {
      const et = readEndFromStorage();
      if (et && et > Date.now()) {
        endTime = et;
        if (!intervalId) startInterval();
      }
    } else if (!intervalId && endTime > Date.now()) {
      startInterval();
    }

    return () => {
      mountedRef.current = false;
      listeners.delete(listener);
    };
  }, []);

  const start = useCallback(() => {
    ended = false;
    endTime = Date.now() + DURATION * 1000;
    localStorage.setItem(STORAGE_END, String(endTime));
    localStorage.removeItem(STORAGE_ENDED);
    setMeetingActive(true);
    setExpired(false);
    setSecondsLeft(DURATION);
    startInterval();
  }, []);

  const stop = useCallback(() => {
    endTime = null;
    ended = false;
    localStorage.removeItem(STORAGE_END);
    localStorage.removeItem(STORAGE_ENDED);
    setMeetingActive(false);
    setExpired(false);
    setSecondsLeft(DURATION);
    stopInterval();
  }, []);

  const clearExpired = useCallback(() => {
    ended = false;
    localStorage.removeItem(STORAGE_ENDED);
    setExpired(false);
  }, []);

  return { secondsLeft, meetingActive, expired, start, stop, clearExpired, duration: DURATION };
};