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
exports.isTerminalExecutionLike = isTerminalExecutionLike;
exports.isExecutionIdentity = isExecutionIdentity;
exports.getTerminalMonitoringCapability = getTerminalMonitoringCapability;
exports.getEffectiveTerminalMonitoringCapability = getEffectiveTerminalMonitoringCapability;
exports.getTerminalShellExecutionApi = getTerminalShellExecutionApi;
const vscode = __importStar(require("vscode"));
function isEventLike(value) {
    return typeof value === "function";
}
function isTerminalExecutionLike(value) {
    if (typeof value !== "object" || value === null)
        return false;
    return typeof value.read === "function";
}
function isExecutionIdentity(value) {
    return typeof value === "object" && value !== null;
}
function getTerminalMonitoringCapability(windowApi = vscode.window) {
    const hasStartEvent = isEventLike(windowApi.onDidStartTerminalShellExecution);
    const hasEndEvent = isEventLike(windowApi.onDidEndTerminalShellExecution);
    if (hasStartEvent && hasEndEvent)
        return "full";
    if (hasStartEvent)
        return "outputOnly";
    if (hasEndEvent)
        return "exitCodeOnly";
    return "none";
}
function getEffectiveTerminalMonitoringCapability(capability, detectionMode) {
    if (capability === "none")
        return "none";
    if (detectionMode === "either")
        return capability;
    if (detectionMode === "output") {
        if (capability === "exitCodeOnly")
            return "none";
        return "outputOnly";
    }
    if (capability === "outputOnly")
        return "none";
    return "exitCodeOnly";
}
function getTerminalShellExecutionApi(windowApi = vscode.window) {
    if (getTerminalMonitoringCapability(windowApi) === "none") {
        return null;
    }
    const startEvent = windowApi.onDidStartTerminalShellExecution;
    const endEvent = windowApi.onDidEndTerminalShellExecution;
    return {
        ...(isEventLike(startEvent)
            ? {
                onDidStartTerminalShellExecution: startEvent,
            }
            : {}),
        ...(isEventLike(endEvent)
            ? {
                onDidEndTerminalShellExecution: endEvent,
            }
            : {}),
    };
}
//# sourceMappingURL=terminal-shell-integration.js.map