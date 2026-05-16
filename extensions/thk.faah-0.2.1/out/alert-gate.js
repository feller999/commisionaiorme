"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRemainingPlaybackCooldownMs = getRemainingPlaybackCooldownMs;
exports.getSnoozeRemainingMs = getSnoozeRemainingMs;
exports.snoozeAlertsForMs = snoozeAlertsForMs;
exports.clearSnoozeAlerts = clearSnoozeAlerts;
exports.getAlertSuppressionReason = getAlertSuppressionReason;
exports.tryAcquirePlaybackWindow = tryAcquirePlaybackWindow;
const sharedWindowMs = 250;
const globalScope = "__global__";
const lastPlaybackAtMsByScope = new Map();
let lastPlaybackScope = null;
let snoozeUntilMs = 0;
function toMinutesSinceMidnight(time) {
    const [hoursText, minutesText] = time.split(":");
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes))
        return 0;
    return hours * 60 + minutes;
}
function isNowWithinQuietHours(settings, nowMs) {
    if (!settings.quietHoursEnabled)
        return false;
    const startMinutes = toMinutesSinceMidnight(settings.quietHoursStart);
    const endMinutes = toMinutesSinceMidnight(settings.quietHoursEnd);
    if (startMinutes === endMinutes)
        return true;
    const now = new Date(nowMs);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (startMinutes < endMinutes) {
        return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    }
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}
function getRemainingPlaybackCooldownMs(cooldownMs, scope = globalScope, nowMs = Date.now()) {
    const scopedElapsedMs = nowMs - (lastPlaybackAtMsByScope.get(scope) ?? 0);
    const scopedRemainingMs = Math.max(0, cooldownMs - scopedElapsedMs);
    const sharedElapsedMs = nowMs - (lastPlaybackAtMsByScope.get(globalScope) ?? 0);
    const shouldApplySharedWindow = lastPlaybackScope !== null && lastPlaybackScope !== scope;
    const sharedRemainingMs = shouldApplySharedWindow
        ? Math.max(0, sharedWindowMs - sharedElapsedMs)
        : 0;
    return Math.max(scopedRemainingMs, sharedRemainingMs);
}
function getSnoozeRemainingMs(nowMs = Date.now()) {
    return Math.max(0, snoozeUntilMs - nowMs);
}
function snoozeAlertsForMs(durationMs) {
    const nowMs = Date.now();
    const clampedDurationMs = Math.max(0, Math.floor(durationMs));
    snoozeUntilMs = nowMs + clampedDurationMs;
    return snoozeUntilMs;
}
function clearSnoozeAlerts() {
    snoozeUntilMs = 0;
}
function getAlertSuppressionReason(settings, nowMs = Date.now()) {
    if (getSnoozeRemainingMs(nowMs) > 0)
        return "snoozed";
    if (isNowWithinQuietHours(settings, nowMs))
        return "quietHours";
    return null;
}
function tryAcquirePlaybackWindow(cooldownMs, scope = globalScope) {
    const nowMs = Date.now();
    if (getRemainingPlaybackCooldownMs(cooldownMs, scope, nowMs) > 0)
        return false;
    lastPlaybackAtMsByScope.set(scope, nowMs);
    lastPlaybackAtMsByScope.set(globalScope, nowMs);
    lastPlaybackScope = scope;
    return true;
}
//# sourceMappingURL=alert-gate.js.map