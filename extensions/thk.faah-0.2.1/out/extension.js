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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const alert_gate_1 = require("./alert-gate");
const audio_1 = require("./audio");
const commands_1 = require("./commands");
const diagnostics_monitor_1 = require("./diagnostics-monitor");
const execution_monitor_1 = require("./execution-monitor");
const settings_1 = require("./settings");
const settings_webview_1 = require("./settings-webview");
const status_bar_1 = require("./status-bar");
const terminal_shell_integration_1 = require("./terminal-shell-integration");
const editorDiagnosticsTypingDebounceMs = 300;
const statusRefreshIntervalMs = 15000;
const onboardingStateKey = "faah.onboarding.seenVersion";
const snoozeActions = [
    { durationMinutes: 15, label: "15 minutes" },
    { durationMinutes: 30, label: "30 minutes" },
    { durationMinutes: 60, label: "1 hour" },
    { durationMinutes: 120, label: "2 hours" },
];
function formatTime(dateMs) {
    return new Date(dateMs).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
}
function getVscodeExport(key) {
    if (!Object.prototype.hasOwnProperty.call(vscode, key))
        return undefined;
    return vscode[key];
}
function activate(context) {
    let storedSettings = (0, settings_1.loadStoredSettings)(context);
    let settings = (0, settings_1.toRuntimeSettings)(storedSettings);
    let soundPath = (0, audio_1.resolveSoundPath)(context, storedSettings);
    let editorTypingDebounceTimer;
    let statusRefreshTimer;
    const { item: statusBarItem, update: updateStatusBar } = (0, status_bar_1.createStatusBarController)();
    const terminalMonitoringCapability = (0, terminal_shell_integration_1.getTerminalMonitoringCapability)();
    const terminalShellExecutionApi = (0, terminal_shell_integration_1.getTerminalShellExecutionApi)();
    const languagesApi = getVscodeExport("languages");
    const windowApi = getVscodeExport("window");
    const workspaceApi = getVscodeExport("workspace");
    const terminalMonitoringSupported = terminalMonitoringCapability !== "none";
    let settingsUiAvailable = false;
    const showSettingsUiUnavailableWarning = () => {
        void vscode.window.showWarningMessage("Faah settings UI is unavailable in this session.");
    };
    if (terminalMonitoringCapability === "none") {
        console.info("[faah] Terminal shell execution APIs are unavailable in this host. Terminal monitoring is disabled for this session.");
    }
    else if (terminalMonitoringCapability === "outputOnly") {
        console.info("[faah] Terminal shell execution APIs expose output-stream monitoring only in this host. Exit-code terminal alerts are unavailable for this session.");
    }
    else if (terminalMonitoringCapability === "exitCodeOnly") {
        console.info("[faah] Terminal shell execution APIs expose exit-code monitoring only in this host. Output-stream terminal alerts are unavailable for this session.");
    }
    const clearEditorTypingDebounce = () => {
        if (!editorTypingDebounceTimer)
            return;
        clearTimeout(editorTypingDebounceTimer);
        editorTypingDebounceTimer = undefined;
    };
    const clearStatusRefreshTimer = () => {
        if (!statusRefreshTimer)
            return;
        clearInterval(statusRefreshTimer);
        statusRefreshTimer = undefined;
    };
    const refreshSoundPath = () => {
        const previousSoundPath = soundPath;
        soundPath = (0, audio_1.resolveSoundPath)(context, storedSettings);
        if (soundPath !== previousSoundPath) {
            (0, audio_1.resetPrewarmState)();
        }
        (0, audio_1.prewarmAudioBackend)(soundPath);
    };
    const syncStatusBar = () => {
        const snoozeRemainingMs = (0, alert_gate_1.getSnoozeRemainingMs)();
        updateStatusBar(settings, {
            snoozeRemainingMs,
            terminalMonitoringCapability,
        });
        if (snoozeRemainingMs > 0 && !statusRefreshTimer) {
            statusRefreshTimer = setInterval(() => {
                updateStatusBar(settings, {
                    snoozeRemainingMs: (0, alert_gate_1.getSnoozeRemainingMs)(),
                    terminalMonitoringCapability,
                });
            }, statusRefreshIntervalMs);
            return;
        }
        if (snoozeRemainingMs <= 0) {
            clearStatusRefreshTimer();
        }
    };
    const scheduleDebouncedDiagnosticsScan = () => {
        clearEditorTypingDebounce();
        editorTypingDebounceTimer = setTimeout(() => {
            editorTypingDebounceTimer = undefined;
            if (!settings.enabled || !settings.monitorDiagnostics)
                return;
            (0, diagnostics_monitor_1.scanActiveEditorDiagnostics)(() => settings, () => soundPath);
        }, editorDiagnosticsTypingDebounceMs);
    };
    const applySettings = async (nextSettings, persistTarget = "global") => {
        storedSettings = (0, settings_1.normalizeStoredSettings)(nextSettings);
        settings = (0, settings_1.toRuntimeSettings)(storedSettings);
        refreshSoundPath();
        const persistResult = await (0, settings_1.persistStoredSettings)(context, storedSettings, persistTarget);
        if (!settings.enabled || !settings.monitorDiagnostics) {
            clearEditorTypingDebounce();
        }
        syncStatusBar();
        return persistResult;
    };
    const reloadSettingsFromConfiguration = () => {
        storedSettings = (0, settings_1.loadStoredSettings)(context);
        settings = (0, settings_1.toRuntimeSettings)(storedSettings);
        refreshSoundPath();
        syncStatusBar();
    };
    syncStatusBar();
    (0, audio_1.prewarmAudioBackend)(soundPath);
    const patchSettings = async (patch) => {
        await applySettings({
            ...storedSettings,
            ...patch,
        }, getPreferredPersistTarget());
    };
    function getPreferredPersistTarget() {
        const hasWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
        const rememberedTarget = typeof context.globalState?.get === "function"
            ? context.globalState.get(settings_webview_1.saveTargetStorageKey)
            : undefined;
        return rememberedTarget === "workspace" && hasWorkspace
            ? "workspace"
            : "global";
    }
    const getEffectiveTerminalMonitoringState = () => (0, terminal_shell_integration_1.getEffectiveTerminalMonitoringCapability)(terminalMonitoringCapability, settings.terminalDetectionMode);
    const showCurrentModeUnsupportedWarning = () => {
        void vscode.window.showWarningMessage("Faah terminal monitoring is unavailable for current Terminal Detection Mode in this host. Change Terminal Detection Mode to a supported signal.");
    };
    const getCompatibilityStatusMessage = () => {
        const hostName = vscode.env.appName || "This editor";
        const hostVersion = vscode.version;
        const baseMessage = `${hostName} reports VS Code API ${hostVersion}.`;
        const effectiveTerminalMonitoringCapability = getEffectiveTerminalMonitoringState();
        if (effectiveTerminalMonitoringCapability === "full") {
            return {
                level: "info",
                message: `${baseMessage} Faah diagnostics and terminal monitoring are available.`,
            };
        }
        if (effectiveTerminalMonitoringCapability === "outputOnly") {
            return {
                level: "warning",
                message: `${baseMessage} Faah diagnostics monitoring is available. Terminal monitoring has partial host support: output-stream alerts work, but non-zero exit-code monitoring is unavailable.`,
            };
        }
        if (effectiveTerminalMonitoringCapability === "exitCodeOnly") {
            return {
                level: "warning",
                message: `${baseMessage} Faah diagnostics monitoring is available. Terminal monitoring has partial host support: non-zero exit-code alerts work, but output-stream monitoring is unavailable.`,
            };
        }
        if (terminalMonitoringCapability !== "none") {
            return {
                level: "warning",
                message: `${baseMessage} Faah diagnostics monitoring is available, but terminal monitoring is unavailable for current Terminal Detection Mode in this host. Change Terminal Detection Mode to a supported signal.`,
            };
        }
        return {
            level: "warning",
            message: `${baseMessage} Faah diagnostics monitoring is available, but terminal monitoring is not supported in this host.`,
        };
    };
    const showCompatibilityStatus = () => {
        const { level, message } = getCompatibilityStatusMessage();
        if (level === "info") {
            void vscode.window.showInformationMessage(message);
            return;
        }
        void vscode.window.showWarningMessage(message);
    };
    const startDisposable = terminalShellExecutionApi?.onDidStartTerminalShellExecution?.((event) => {
        if (!settings.enabled || !settings.monitorTerminal)
            return;
        if (!(0, terminal_shell_integration_1.isTerminalExecutionLike)(event.execution))
            return;
        void (0, execution_monitor_1.monitorExecutionOutput)(event.execution, () => settings, () => soundPath);
    });
    const endDisposable = terminalShellExecutionApi?.onDidEndTerminalShellExecution?.((event) => {
        if (!settings.enabled || !settings.monitorTerminal)
            return;
        if (settings.terminalDetectionMode === "output")
            return;
        if (event.exitCode === undefined || event.exitCode === 0)
            return;
        if (!(0, terminal_shell_integration_1.isExecutionIdentity)(event.execution))
            return;
        (0, execution_monitor_1.tryPlayForExecution)(event.execution, settings, soundPath);
    });
    const playTestSoundDisposable = vscode.commands.registerCommand(commands_1.commandIds.playTestSound, () => {
        (0, audio_1.playAlert)(settings, soundPath);
    });
    const showCompatibilityStatusDisposable = vscode.commands.registerCommand(commands_1.commandIds.showCompatibilityStatus, showCompatibilityStatus);
    const snoozeDisposable = vscode.commands.registerCommand(commands_1.commandIds.snoozeAlerts, async () => {
        const clearLabel = "Clear Snooze";
        const options = [
            ...snoozeActions.map((action) => ({
                label: `Snooze for ${action.label}`,
                description: "Temporarily silence alerts",
            })),
            {
                label: clearLabel,
                description: "Resume alerts immediately",
            },
        ];
        const selected = await vscode.window.showQuickPick(options, {
            title: "Faah Snooze",
            placeHolder: "Choose a snooze duration",
        });
        if (!selected)
            return;
        if (selected.label === clearLabel) {
            (0, alert_gate_1.clearSnoozeAlerts)();
            syncStatusBar();
            vscode.window.showInformationMessage("Faah snooze cleared.");
            return;
        }
        const chosenAction = snoozeActions.find((action) => selected.label === `Snooze for ${action.label}`);
        if (!chosenAction)
            return;
        const snoozeUntil = (0, alert_gate_1.snoozeAlertsForMs)(chosenAction.durationMinutes * 60000);
        syncStatusBar();
        vscode.window.showInformationMessage(`Faah alerts snoozed for ${chosenAction.label} (until ${formatTime(snoozeUntil)}).`);
    });
    const clearSnoozeDisposable = vscode.commands.registerCommand(commands_1.commandIds.clearSnooze, () => {
        (0, alert_gate_1.clearSnoozeAlerts)();
        syncStatusBar();
        vscode.window.showInformationMessage("Faah snooze cleared.");
    });
    const quietHoursDisposable = vscode.commands.registerCommand(commands_1.commandIds.setQuietHours, async () => {
        const selected = await vscode.window.showQuickPick([
            {
                label: "Disable Quiet Hours",
                description: "Alerts can play any time",
                action: "disable",
            },
            {
                label: "22:00 - 07:00",
                description: "Default overnight quiet hours",
                action: "preset-night",
            },
            {
                label: "00:00 - 06:00",
                description: "Late-night quiet hours",
                action: "preset-midnight",
            },
            {
                label: "Custom Range",
                description: "Enter start/end times in 24h format",
                action: "custom",
            },
        ], {
            title: "Faah Quiet Hours",
            placeHolder: "Choose quiet hours behavior",
        });
        if (!selected)
            return;
        if (selected.action === "disable") {
            await patchSettings({ quietHoursEnabled: false });
            vscode.window.showInformationMessage("Faah quiet hours disabled.");
            return;
        }
        if (selected.action === "preset-night") {
            await patchSettings({
                quietHoursEnabled: true,
                quietHoursStart: "22:00",
                quietHoursEnd: "07:00",
            });
            vscode.window.showInformationMessage("Faah quiet hours set to 22:00 - 07:00.");
            return;
        }
        if (selected.action === "preset-midnight") {
            await patchSettings({
                quietHoursEnabled: true,
                quietHoursStart: "00:00",
                quietHoursEnd: "06:00",
            });
            vscode.window.showInformationMessage("Faah quiet hours set to 00:00 - 06:00.");
            return;
        }
        const start = await vscode.window.showInputBox({
            prompt: "Quiet hours start (24h HH:mm)",
            placeHolder: "22:00",
            value: storedSettings.quietHoursStart,
            validateInput: (value) => (0, settings_1.isValidQuietHoursTime)(value.trim())
                ? null
                : "Use 24h time format HH:mm",
        });
        if (start === undefined)
            return;
        const end = await vscode.window.showInputBox({
            prompt: "Quiet hours end (24h HH:mm)",
            placeHolder: "07:00",
            value: storedSettings.quietHoursEnd,
            validateInput: (value) => (0, settings_1.isValidQuietHoursTime)(value.trim())
                ? null
                : "Use 24h time format HH:mm",
        });
        if (end === undefined)
            return;
        await patchSettings({
            quietHoursEnabled: true,
            quietHoursStart: start.trim(),
            quietHoursEnd: end.trim(),
        });
        vscode.window.showInformationMessage(`Faah quiet hours set to ${start.trim()} - ${end.trim()}.`);
    });
    const quickActionsDisposable = vscode.commands.registerCommand(commands_1.commandIds.showQuickActions, async () => {
        const snoozeRemainingMs = (0, alert_gate_1.getSnoozeRemainingMs)();
        const effectiveTerminalMonitoringCapability = (0, terminal_shell_integration_1.getEffectiveTerminalMonitoringCapability)(terminalMonitoringCapability, settings.terminalDetectionMode);
        const effectiveTerminalMonitoringSupported = effectiveTerminalMonitoringCapability !== "none";
        const terminalMonitoringDescription = terminalMonitoringSupported
            ? effectiveTerminalMonitoringCapability === "none"
                ? "Current detection mode is unsupported in this host"
                : effectiveTerminalMonitoringCapability === "exitCodeOnly"
                    ? "Exit-code alerts only in this host"
                    : effectiveTerminalMonitoringCapability === "outputOnly"
                        ? "Output-stream alerts only in this host"
                        : "Watch shell output for errors"
            : "Unavailable in this Cursor/VS Code version";
        const actions = [
            {
                label: settings.enabled ? "Disable Faah" : "Enable Faah",
                description: "Master monitoring switch",
                action: "toggleEnabled",
            },
            {
                label: !terminalMonitoringSupported
                    ? "Terminal Monitoring Unavailable"
                    : !effectiveTerminalMonitoringSupported && !settings.monitorTerminal
                        ? "Terminal Monitoring Unsupported for Current Mode"
                        : settings.monitorTerminal
                            ? "Disable Terminal Monitoring"
                            : "Enable Terminal Monitoring",
                description: terminalMonitoringDescription,
                action: "toggleTerminal",
            },
            {
                label: settings.monitorDiagnostics
                    ? "Disable Editor Diagnostics Monitoring"
                    : "Enable Editor Diagnostics Monitoring",
                description: "Watch active-file diagnostics",
                action: "toggleDiagnostics",
            },
            {
                label: settings.diagnosticsSeverity === "warningAndError"
                    ? "Set Diagnostics Severity: Error Only"
                    : "Set Diagnostics Severity: Error + Warning",
                description: "Control which diagnostics can trigger alerts",
                action: "toggleDiagnosticsSeverity",
            },
            {
                label: "Snooze Alerts",
                description: "Temporarily silence all alerts",
                action: "snooze",
            },
            ...(snoozeRemainingMs > 0
                ? [
                    {
                        label: "Clear Snooze",
                        description: "Resume alerts immediately",
                        action: "clearSnooze",
                    },
                ]
                : []),
            {
                label: settings.quietHoursEnabled
                    ? `Update Quiet Hours (${settings.quietHoursStart} - ${settings.quietHoursEnd})`
                    : "Enable Quiet Hours",
                description: "Set overnight quiet window",
                action: "setQuietHours",
            },
            {
                label: "Open Faah Settings",
                description: "Open the full settings dashboard",
                action: "openSettings",
            },
            {
                label: "Show Compatibility Status",
                description: "Check editor host support for terminal monitoring",
                action: "showCompatibility",
            },
            {
                label: "Play Test Sound",
                description: "Verify audio output now",
                action: "playTestSound",
            },
        ];
        const selected = await vscode.window.showQuickPick(actions, {
            placeHolder: "Faah quick actions",
            title: "Faah",
        });
        if (!selected)
            return;
        switch (selected.action) {
            case "toggleEnabled":
                await patchSettings({ enabled: !storedSettings.enabled });
                break;
            case "toggleTerminal":
                if (!terminalMonitoringSupported) {
                    vscode.window.showInformationMessage("Faah terminal monitoring is unavailable in this Cursor/VS Code version.");
                    break;
                }
                if (!effectiveTerminalMonitoringSupported &&
                    !storedSettings.monitorTerminal) {
                    showCurrentModeUnsupportedWarning();
                    break;
                }
                await patchSettings({
                    monitorTerminal: !storedSettings.monitorTerminal,
                });
                break;
            case "toggleDiagnostics":
                await patchSettings({
                    monitorDiagnostics: !storedSettings.monitorDiagnostics,
                });
                break;
            case "toggleDiagnosticsSeverity":
                await patchSettings({
                    diagnosticsSeverity: storedSettings.diagnosticsSeverity === "warningAndError"
                        ? "error"
                        : "warningAndError",
                });
                break;
            case "snooze":
                await vscode.commands.executeCommand(commands_1.commandIds.snoozeAlerts);
                break;
            case "clearSnooze":
                await vscode.commands.executeCommand(commands_1.commandIds.clearSnooze);
                break;
            case "setQuietHours":
                await vscode.commands.executeCommand(commands_1.commandIds.setQuietHours);
                break;
            case "openSettings":
                if (!settingsUiAvailable) {
                    void vscode.window.showWarningMessage("Faah settings UI is unavailable in this session.");
                    break;
                }
                await vscode.commands.executeCommand(commands_1.commandIds.openSettingsUi);
                break;
            case "showCompatibility":
                await vscode.commands.executeCommand(commands_1.commandIds.showCompatibilityStatus);
                break;
            case "playTestSound":
                await vscode.commands.executeCommand(commands_1.commandIds.playTestSound);
                break;
            default:
                break;
        }
    });
    statusBarItem.command = commands_1.commandIds.showQuickActions;
    let settingsUiDisposable = { dispose: () => undefined };
    try {
        settingsUiDisposable = (0, settings_webview_1.registerSettingsUiCommand)(context, () => storedSettings, applySettings, (testSettings) => (0, audio_1.playAlert)((0, settings_1.toRuntimeSettings)(testSettings), (0, audio_1.resolveSoundPath)(context, testSettings)), terminalMonitoringCapability, commands_1.commandIds.openSettingsUi);
        settingsUiAvailable = true;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[faah] Settings UI registration failed: ${message}`);
        settingsUiDisposable = vscode.commands.registerCommand(commands_1.commandIds.openSettingsUi, showSettingsUiUnavailableWarning);
    }
    const diagnosticsDisposable = languagesApi?.onDidChangeDiagnostics?.((event) => {
        if (!settings.enabled || !settings.monitorDiagnostics)
            return;
        if (editorTypingDebounceTimer)
            return;
        (0, diagnostics_monitor_1.onDiagnosticsChanged)(event, () => settings, () => soundPath);
    });
    const activeEditorDisposable = windowApi?.onDidChangeActiveTextEditor?.(() => {
        if (!settings.enabled || !settings.monitorDiagnostics)
            return;
        clearEditorTypingDebounce();
        (0, diagnostics_monitor_1.scanActiveEditorDiagnostics)(() => settings, () => soundPath);
    });
    const textDocumentDisposable = workspaceApi?.onDidChangeTextDocument?.((event) => {
        if (!settings.enabled || !settings.monitorDiagnostics)
            return;
        if (event.contentChanges.length === 0)
            return;
        const activeEditor = windowApi?.activeTextEditor;
        if (!activeEditor)
            return;
        if (event.document.uri.toString() !== activeEditor.document.uri.toString())
            return;
        scheduleDebouncedDiagnosticsScan();
    });
    const configChangeDisposable = workspaceApi?.onDidChangeConfiguration?.((event) => {
        if (!event.affectsConfiguration("faah"))
            return;
        const diagnosticsStateAffects = event.affectsConfiguration("faah.enabled") ||
            event.affectsConfiguration("faah.monitorDiagnostics") ||
            event.affectsConfiguration("faah.diagnosticsSeverity") ||
            event.affectsConfiguration("faah.patternMode") ||
            event.affectsConfiguration("faah.excludePresetIds") ||
            event.affectsConfiguration("faah.patterns") ||
            event.affectsConfiguration("faah.excludePatterns");
        const terminalStateAffects = event.affectsConfiguration("faah.enabled") ||
            event.affectsConfiguration("faah.monitorTerminal") ||
            event.affectsConfiguration("faah.terminalDetectionMode") ||
            event.affectsConfiguration("faah.patternMode") ||
            event.affectsConfiguration("faah.excludePresetIds") ||
            event.affectsConfiguration("faah.patterns") ||
            event.affectsConfiguration("faah.excludePatterns");
        reloadSettingsFromConfiguration();
        if (terminalStateAffects) {
            (0, execution_monitor_1.resetExecutionMonitorState)();
        }
        if (diagnosticsStateAffects) {
            (0, diagnostics_monitor_1.clearDiagnosticsRetryTimers)();
            if (settings.enabled && settings.monitorDiagnostics) {
                (0, diagnostics_monitor_1.scanActiveEditorDiagnostics)(() => settings, () => soundPath);
            }
        }
    });
    const workspaceFoldersDisposable = workspaceApi?.onDidChangeWorkspaceFolders?.(() => {
        refreshSoundPath();
    });
    (0, diagnostics_monitor_1.scanActiveEditorDiagnostics)(() => settings, () => soundPath);
    context.subscriptions.push(settingsUiDisposable, playTestSoundDisposable, showCompatibilityStatusDisposable, snoozeDisposable, clearSnoozeDisposable, quietHoursDisposable, quickActionsDisposable, { dispose: clearEditorTypingDebounce }, { dispose: clearStatusRefreshTimer }, { dispose: diagnostics_monitor_1.disposeDiagnosticsMonitorState }, statusBarItem);
    if (diagnosticsDisposable) {
        context.subscriptions.push(diagnosticsDisposable);
    }
    if (activeEditorDisposable) {
        context.subscriptions.push(activeEditorDisposable);
    }
    if (textDocumentDisposable) {
        context.subscriptions.push(textDocumentDisposable);
    }
    if (configChangeDisposable) {
        context.subscriptions.push(configChangeDisposable);
    }
    if (workspaceFoldersDisposable) {
        context.subscriptions.push(workspaceFoldersDisposable);
    }
    if (startDisposable) {
        context.subscriptions.push(startDisposable);
    }
    if (endDisposable) {
        context.subscriptions.push(endDisposable);
    }
    queueMicrotask(() => {
        void (async () => {
            try {
                const currentVersion = String(context.extension?.packageJSON?.version ?? "unknown");
                const seenVersion = typeof context.globalState?.get === "function"
                    ? context.globalState.get(onboardingStateKey)
                    : undefined;
                if (seenVersion === currentVersion)
                    return;
                if (typeof context.globalState?.update === "function") {
                    await context.globalState.update(onboardingStateKey, currentVersion);
                }
                const effectiveTerminalMonitoringCapability = getEffectiveTerminalMonitoringState();
                const onboardingMessage = effectiveTerminalMonitoringCapability === "exitCodeOnly"
                    ? "Faah is ready. Diagnostics alerts work, and terminal monitoring has partial host support: non-zero exit-code alerts work but output-stream monitoring is unavailable."
                    : effectiveTerminalMonitoringCapability === "outputOnly"
                        ? "Faah is ready. Diagnostics alerts work, and terminal monitoring has partial host support: output-stream alerts work but non-zero exit-code monitoring is unavailable."
                        : effectiveTerminalMonitoringCapability === "full"
                            ? "Faah is ready. Diagnostics and terminal monitoring are available in this host."
                            : terminalMonitoringSupported
                                ? "Faah is ready. Diagnostics monitoring is available, but terminal monitoring is unavailable for current Terminal Detection Mode in this host. Change Terminal Detection Mode to a supported signal."
                                : "Faah is ready. Diagnostics monitoring is available, but terminal monitoring is unavailable in this host.";
                const selection = await vscode.window.showInformationMessage(onboardingMessage, "Open Settings", "Play Test Sound", "Show Compatibility");
                if (selection === "Open Settings") {
                    await vscode.commands.executeCommand(commands_1.commandIds.openSettingsUi);
                    return;
                }
                if (selection === "Play Test Sound") {
                    await vscode.commands.executeCommand(commands_1.commandIds.playTestSound);
                    return;
                }
                if (selection === "Show Compatibility") {
                    await vscode.commands.executeCommand(commands_1.commandIds.showCompatibilityStatus);
                }
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.warn(`[faah] Onboarding flow failed: ${message}`);
            }
        })();
    });
}
function deactivate() { }
//# sourceMappingURL=extension.js.map