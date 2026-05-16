"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryPlayForExecution = tryPlayForExecution;
exports.monitorExecutionOutput = monitorExecutionOutput;
exports.resetExecutionMonitorState = resetExecutionMonitorState;
const alert_gate_1 = require("./alert-gate");
const alert_dispatch_1 = require("./alert-dispatch");
let tailByExecution = new WeakMap();
let playedByExecution = new WeakSet();
const MAX_TAIL_LENGTH = 500;
const LINE_SPLIT_REGEX = /\r?\n/;
const ANSI_ESCAPE_REGEX = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
function shouldMonitorTerminalOutput(settings) {
    return settings.terminalDetectionMode !== "exitCode";
}
function looksLikeError(line, patterns) {
    return patterns.some((pattern) => pattern.test(line));
}
function isExcluded(line, excludePatterns) {
    return excludePatterns.some((pattern) => pattern.test(line));
}
function normalizeTerminalLine(text) {
    return text.replace(ANSI_ESCAPE_REGEX, "").trim();
}
function matchesAlertPatterns(text, patterns, excludePatterns) {
    const line = normalizeTerminalLine(text);
    if (!line)
        return false;
    if (!looksLikeError(line, patterns))
        return false;
    if (isExcluded(line, excludePatterns))
        return false;
    return true;
}
function hasErrorInChunk(execution, chunk, patterns, excludePatterns) {
    const previousTail = tailByExecution.get(execution) ?? "";
    const lines = (previousTail + chunk).split(LINE_SPLIT_REGEX);
    const tail = lines.pop() ?? "";
    tailByExecution.set(execution, tail.slice(-MAX_TAIL_LENGTH));
    for (const rawLine of lines) {
        if (matchesAlertPatterns(rawLine, patterns, excludePatterns))
            return true;
    }
    return false;
}
function tryPlayForExecution(execution, settings, soundPath) {
    if (!settings.monitorTerminal)
        return;
    if ((0, alert_gate_1.getAlertSuppressionReason)(settings) !== null)
        return;
    if (playedByExecution.has(execution))
        return;
    if (!(0, alert_gate_1.tryAcquirePlaybackWindow)(settings.terminalCooldownMs, "terminal"))
        return;
    playedByExecution.add(execution);
    (0, alert_dispatch_1.triggerAlert)("terminal", settings, soundPath);
}
async function monitorExecutionOutput(execution, getSettings, getSoundPath) {
    try {
        const stream = execution.read();
        for await (const chunk of stream) {
            if (!chunk)
                continue;
            const settings = getSettings();
            if (!settings.enabled)
                continue;
            if (!settings.monitorTerminal)
                continue;
            if (!shouldMonitorTerminalOutput(settings))
                continue;
            if (hasErrorInChunk(execution, chunk, settings.patterns, settings.excludePatterns)) {
                tryPlayForExecution(execution, settings, getSoundPath());
            }
        }
        const settings = getSettings();
        const finalTail = tailByExecution.get(execution) ?? "";
        if (settings.enabled &&
            settings.monitorTerminal &&
            shouldMonitorTerminalOutput(settings) &&
            matchesAlertPatterns(finalTail, settings.patterns, settings.excludePatterns)) {
            tryPlayForExecution(execution, settings, getSoundPath());
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`Failed to read terminal shell execution stream: ${message}`);
    }
}
function resetExecutionMonitorState() {
    tailByExecution = new WeakMap();
    playedByExecution = new WeakSet();
}
//# sourceMappingURL=execution-monitor.js.map