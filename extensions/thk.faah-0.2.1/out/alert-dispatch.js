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
exports.triggerAlert = triggerAlert;
const vscode = __importStar(require("vscode"));
const audio_1 = require("./audio");
const visualAlertThrottleMs = 1200;
const lastVisualAlertAtMsBySource = new Map();
function shouldShowVisualAlert(source, nowMs = Date.now()) {
    const lastShownAtMs = lastVisualAlertAtMsBySource.get(source) ?? 0;
    if (nowMs - lastShownAtMs < visualAlertThrottleMs)
        return false;
    lastVisualAlertAtMsBySource.set(source, nowMs);
    return true;
}
function createVisualAlertMessage(source) {
    if (source === "terminal") {
        return "Faah detected terminal error output.";
    }
    return "Faah detected editor diagnostics.";
}
function triggerAlert(source, settings, soundPath) {
    (0, audio_1.playAlert)(settings, soundPath);
    if (!settings.showVisualNotifications)
        return;
    if (!shouldShowVisualAlert(source))
        return;
    void vscode.window.showWarningMessage(createVisualAlertMessage(source));
}
//# sourceMappingURL=alert-dispatch.js.map