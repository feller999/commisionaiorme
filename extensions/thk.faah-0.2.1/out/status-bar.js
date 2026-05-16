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
exports.createStatusBarController = createStatusBarController;
const vscode = __importStar(require("vscode"));
const terminal_shell_integration_1 = require("./terminal-shell-integration");
function summarizeSources(settings, terminalMonitoringCapability) {
    const terminalMonitoringSupported = (0, terminal_shell_integration_1.getEffectiveTerminalMonitoringCapability)(terminalMonitoringCapability, settings.terminalDetectionMode) !== "none";
    const terminalMonitoringEnabled = settings.monitorTerminal && terminalMonitoringSupported;
    if (terminalMonitoringEnabled && settings.monitorDiagnostics)
        return "T+E";
    if (terminalMonitoringEnabled)
        return "T";
    if (settings.monitorDiagnostics)
        return "E";
    return "None";
}
function describeDiagnosticsSeverity(settings) {
    return settings.diagnosticsSeverity === "warningAndError"
        ? "Error + Warning"
        : "Error only";
}
function describeQuietHours(settings) {
    if (!settings.quietHoursEnabled)
        return "Off";
    return `${settings.quietHoursStart} - ${settings.quietHoursEnd}`;
}
function formatSnoozeRemaining(snoozeRemainingMs) {
    const totalMinutes = Math.max(1, Math.ceil(snoozeRemainingMs / 60000));
    if (totalMinutes >= 60) {
        const hours = Math.ceil(totalMinutes / 60);
        return `${hours}h`;
    }
    return `${totalMinutes}m`;
}
function createStatusBarController() {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    item.name = "Faah";
    item.show();
    const update = (settings, runtimeState) => {
        const terminalMonitoringCapability = runtimeState?.terminalMonitoringCapability ?? "full";
        const effectiveTerminalMonitoringCapability = (0, terminal_shell_integration_1.getEffectiveTerminalMonitoringCapability)(terminalMonitoringCapability, settings.terminalDetectionMode);
        const terminalMonitoringSupported = effectiveTerminalMonitoringCapability !== "none";
        const sourceSummary = summarizeSources(settings, terminalMonitoringCapability);
        const snoozeRemainingMs = runtimeState?.snoozeRemainingMs ?? 0;
        const isSnoozed = snoozeRemainingMs > 0;
        if (!settings.enabled) {
            item.text = "$(bell-slash) Faah Off";
            item.tooltip = [
                "Faah monitoring is disabled.",
                "Click for quick actions.",
            ].join("\n");
            return;
        }
        const unsupportedTerminalBadge = settings.monitorTerminal && !terminalMonitoringSupported
            ? " $(warning)"
            : settings.monitorTerminal &&
                effectiveTerminalMonitoringCapability !== "full"
                ? " $(info)"
                : "";
        item.text = isSnoozed
            ? "$(bell-slash) Faah Snoozed"
            : `$(bell) Faah ${sourceSummary}${unsupportedTerminalBadge}`;
        item.tooltip = [
            `Sources: ${sourceSummary}`,
            `Diagnostics severity: ${describeDiagnosticsSeverity(settings)}`,
            ...(settings.monitorTerminal && !terminalMonitoringSupported
                ? [
                    terminalMonitoringCapability === "none"
                        ? "Terminal monitoring: unavailable in this Cursor/VS Code version."
                        : "Terminal monitoring: current detection mode is unavailable in this host. Change Terminal Detection Mode to a supported signal.",
                ]
                : settings.monitorTerminal &&
                    effectiveTerminalMonitoringCapability === "exitCodeOnly"
                    ? [
                        "Terminal monitoring: partial host support. Exit-code alerts work, but output-stream monitoring is unavailable.",
                    ]
                    : settings.monitorTerminal &&
                        effectiveTerminalMonitoringCapability === "outputOnly"
                        ? [
                            "Terminal monitoring: partial host support. Output-stream alerts work, but exit-code monitoring is unavailable.",
                        ]
                        : []),
            `Terminal cooldown: ${settings.terminalCooldownMs}ms`,
            `Diagnostics cooldown: ${settings.diagnosticsCooldownMs}ms`,
            `Quiet hours: ${describeQuietHours(settings)}`,
            ...(isSnoozed
                ? [`Snooze remaining: ${formatSnoozeRemaining(snoozeRemainingMs)}`]
                : []),
            "Click for quick actions.",
        ].join("\n");
    };
    return { item, update };
}
//# sourceMappingURL=status-bar.js.map