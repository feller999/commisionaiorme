"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanActiveEditorDiagnostics = scanActiveEditorDiagnostics;
exports.onDiagnosticsChanged = onDiagnosticsChanged;
exports.clearDiagnosticsRetryTimers = clearDiagnosticsRetryTimers;
exports.disposeDiagnosticsMonitorState = disposeDiagnosticsMonitorState;
const vscode = __importStar(require("vscode"));
const alert_gate_1 = require("./alert-gate");
const alert_dispatch_1 = require("./alert-dispatch");
const lastFingerprintByUri = new Map();
const retryTimerByUri = new Map();
const FINGERPRINT_LINE_SEPARATOR = "\n";
function normalizeDiagnosticCode(code) {
    if (typeof code === "string" || typeof code === "number")
        return String(code);
    if (!code)
        return "";
    return String(code.value);
}
function isDiagnosticSeverityAllowed(severity, mode) {
    if (severity === vscode.DiagnosticSeverity.Error)
        return true;
    if (mode === "warningAndError" &&
        severity === vscode.DiagnosticSeverity.Warning)
        return true;
    return false;
}
function isDiagnosticExcluded(diagnostic, excludePatterns) {
    return excludePatterns.some((pattern) => pattern.test(diagnostic.message));
}
function serializeDiagnostic(diagnostic) {
    const code = normalizeDiagnosticCode(diagnostic.code);
    const source = diagnostic.source ?? "";
    const line = diagnostic.range.start.line;
    return `${source}|${code}|${line}|${diagnostic.message}`;
}
function createMonitoredDiagnosticsFingerprint(uri, settings) {
    const monitoredDiagnostics = vscode.languages
        .getDiagnostics(uri)
        .filter((diagnostic) => isDiagnosticSeverityAllowed(diagnostic.severity, settings.diagnosticsSeverity))
        .filter((diagnostic) => !isDiagnosticExcluded(diagnostic, settings.excludePatterns));
    if (monitoredDiagnostics.length === 0)
        return null;
    return monitoredDiagnostics
        .map(serializeDiagnostic)
        .sort()
        .join(FINGERPRINT_LINE_SEPARATOR);
}
function clearRetry(uriKey) {
    const existingTimer = retryTimerByUri.get(uriKey);
    if (!existingTimer)
        return;
    clearTimeout(existingTimer);
    retryTimerByUri.delete(uriKey);
}
function scheduleRetry(uriKey, delayMs, getSettings, getSoundPath) {
    if (retryTimerByUri.has(uriKey))
        return;
    const timer = setTimeout(() => {
        retryTimerByUri.delete(uriKey);
        scanActiveEditorDiagnostics(getSettings, getSoundPath);
    }, Math.max(50, delayMs));
    if (typeof timer.unref === "function") {
        timer.unref();
    }
    retryTimerByUri.set(uriKey, timer);
}
function tryPlayForEditor(editor, getSettings, getSoundPath) {
    const settings = getSettings();
    if (!editor || !settings.enabled || !settings.monitorDiagnostics)
        return;
    if ((0, alert_gate_1.getAlertSuppressionReason)(settings) !== null)
        return;
    const uri = editor.document.uri;
    const uriKey = uri.toString();
    const nextFingerprint = createMonitoredDiagnosticsFingerprint(uri, settings);
    const previousFingerprint = lastFingerprintByUri.get(uriKey) ?? null;
    if (!nextFingerprint) {
        lastFingerprintByUri.delete(uriKey);
        clearRetry(uriKey);
        return;
    }
    if (nextFingerprint === previousFingerprint) {
        clearRetry(uriKey);
        return;
    }
    const remainingCooldownMs = (0, alert_gate_1.getRemainingPlaybackCooldownMs)(settings.diagnosticsCooldownMs, "diagnostics");
    if (remainingCooldownMs > 0) {
        scheduleRetry(uriKey, remainingCooldownMs + 30, getSettings, getSoundPath);
        return;
    }
    if (!(0, alert_gate_1.tryAcquirePlaybackWindow)(settings.diagnosticsCooldownMs, "diagnostics")) {
        scheduleRetry(uriKey, 80, getSettings, getSoundPath);
        return;
    }
    clearRetry(uriKey);
    lastFingerprintByUri.set(uriKey, nextFingerprint);
    (0, alert_dispatch_1.triggerAlert)("diagnostics", settings, getSoundPath());
}
function scanActiveEditorDiagnostics(getSettings, getSoundPath) {
    tryPlayForEditor(vscode.window.activeTextEditor, getSettings, getSoundPath);
}
function onDiagnosticsChanged(event, getSettings, getSoundPath) {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor)
        return;
    const activeUri = activeEditor.document.uri.toString();
    if (!event.uris.some((uri) => uri.toString() === activeUri))
        return;
    tryPlayForEditor(activeEditor, getSettings, getSoundPath);
}
function clearDiagnosticsRetryTimers() {
    for (const timer of retryTimerByUri.values()) {
        clearTimeout(timer);
    }
    retryTimerByUri.clear();
}
function disposeDiagnosticsMonitorState() {
    clearDiagnosticsRetryTimers();
    lastFingerprintByUri.clear();
}
//# sourceMappingURL=diagnostics-monitor.js.map