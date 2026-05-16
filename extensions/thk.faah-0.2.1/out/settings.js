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
exports.defaultStoredSettings = exports.excludePatternPresetDefinitions = void 0;
exports.isValidQuietHoursTime = isValidQuietHoursTime;
exports.normalizeStoredSettings = normalizeStoredSettings;
exports.toRuntimeSettings = toRuntimeSettings;
exports.loadStoredSettings = loadStoredSettings;
exports.persistStoredSettings = persistStoredSettings;
exports.createPresetSettings = createPresetSettings;
const vscode = __importStar(require("vscode"));
const settingsStorageKey = "faah.settings.v1";
const configurationSection = "faah";
const minCooldownMs = 500;
const patternModes = ["override", "append"];
const diagnosticsSeverityModes = ["error", "warningAndError"];
const terminalDetectionModes = ["either", "output", "exitCode"];
const settingsPresetIds = ["balanced", "quiet", "aggressive"];
const excludePresetIds = [
    "conventionalCommits",
    "testSnapshots",
    "lintSummaries",
    "packageManagerAdvisories",
];
const quietHoursTimeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const defaultPatterns = [
    "\\berror\\b",
    "\\bfailed\\b",
    "\\bfailure\\b",
    "\\bfatal\\b",
    "\\bexception\\b",
    "\\bcritical\\b",
    "\\berr(or)?[:!\\]]",
    "\\buncaught\\b",
    "UnhandledPromiseRejection",
    "Traceback \\(most recent call last\\):",
    "\\bsyntaxerror\\b",
    "\\btypeerror\\b",
    "\\breferenceerror\\b",
    "\\brangeerror\\b",
    "\\bmodule\\s+not\\s+found\\b",
    "\\bcannot\\s+find\\s+module\\b",
    "\\bno\\s+module\\s+named\\b",
    "\\bsegmentation\\s+fault\\b",
    "\\bcore\\s+dumped\\b",
    "\\bpanic:|\\bpanicked\\s+at\\b",
    "^\\s*caused\\s+by:",
    "\\bpermission\\s+denied\\b",
    "\\baccess\\s+denied\\b",
    "\\bcommand\\s+not\\s+found\\b",
    "\\btimeout(?:\\s+exceeded)?\\b",
    "\\bconnection\\s+(?:refused|reset|timed\\s*out)\\b",
    "\\bhttp\\s+5\\d\\d\\b",
];
const defaultExcludePatterns = [
    "^\\[[^\\]]+\\s[0-9a-f]{7,40}\\]\\s(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\\([^)]+\\))?!?:\\s.+$",
    "^(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\\([^)]+\\))?!?:\\s.+$",
];
exports.excludePatternPresetDefinitions = [
    {
        id: "conventionalCommits",
        label: "Conventional Commits",
        description: "Ignore commit summary lines that mention error-like words.",
        patterns: [...defaultExcludePatterns],
    },
    {
        id: "testSnapshots",
        label: "Test Snapshots",
        description: "Ignore snapshot/test text that talks about expected errors.",
        patterns: [
            "^\\s*(?:PASS|SNAPSHOT)\\b.*\\berror\\b.*$",
            "^\\s*Expected(?:.*)\\berror\\b.*$",
            "^\\s*Received(?:.*)\\berror\\b.*$",
        ],
    },
    {
        id: "lintSummaries",
        label: "Lint Summaries",
        description: "Ignore summary banners that report counts without real failure lines.",
        patterns: [
            "^\\s*\\d+\\s+warnings?(?:,\\s*\\d+\\s+errors?)?\\s*$",
            "^\\s*\\d+\\s+errors?,\\s*\\d+\\s+warnings?\\s*$",
            "^\\s*\\u2716\\s+\\d+\\s+problems?\\s*\\(\\s*\\d+\\s+errors?,\\s*\\d+\\s+warnings?\\s*\\)\\s*$",
        ],
    },
    {
        id: "packageManagerAdvisories",
        label: "Package Manager Advisories",
        description: "Ignore package-manager audit/advisory summaries unless command actually fails.",
        patterns: [
            "^\\s*(?:npm|yarn|pnpm|bun)\\s+(?:audit|advisory)\\b.*$",
            "^\\s*found\\s+\\d+\\s+vulnerabilit(?:y|ies)\\b.*$",
            "^\\s*\\d+\\s+packages?\\s+are\\s+looking\\s+for\\s+funding\\s*$",
        ],
    },
];
const defaultCompiledPatterns = defaultPatterns.map((pattern) => new RegExp(pattern, "i"));
exports.defaultStoredSettings = {
    enabled: true,
    monitorTerminal: true,
    monitorDiagnostics: true,
    diagnosticsSeverity: "error",
    terminalDetectionMode: "either",
    cooldownMs: 1500,
    terminalCooldownMs: 1500,
    diagnosticsCooldownMs: 1500,
    patternMode: "override",
    volumePercent: 70,
    showVisualNotifications: false,
    customSoundPath: "",
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    excludePresetIds: [],
    patterns: [...defaultPatterns],
    excludePatterns: [...defaultExcludePatterns],
};
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
let compiledRegexCache = null;
function parseEnum(value, allowed, fallback) {
    if (!value)
        return fallback;
    return allowed.includes(value)
        ? value
        : fallback;
}
function compileRegexList(rawPatterns, kind) {
    return rawPatterns
        .map((pattern) => {
        try {
            return new RegExp(pattern, "i");
        }
        catch {
            console.warn(`[faah] Ignoring invalid ${kind} regex: ${pattern}`);
            return null;
        }
    })
        .filter((pattern) => pattern !== null);
}
function getExcludePresetPatterns(presetIdsToResolve) {
    return presetIdsToResolve.flatMap((presetId) => {
        const presetDefinition = exports.excludePatternPresetDefinitions.find((preset) => preset.id === presetId);
        return presetDefinition ? [...presetDefinition.patterns] : [];
    });
}
function isValidQuietHoursTime(value) {
    return quietHoursTimeRegex.test(value);
}
function normalizeQuietHoursTime(value, fallback) {
    if (typeof value !== "string")
        return fallback;
    const normalized = value.trim();
    return isValidQuietHoursTime(normalized) ? normalized : fallback;
}
function readConfigurationOverride(config, key) {
    const inspected = config.inspect(key);
    if (!inspected)
        return undefined;
    if (inspected.workspaceFolderValue !== undefined)
        return inspected.workspaceFolderValue;
    if (inspected.workspaceValue !== undefined)
        return inspected.workspaceValue;
    if (inspected.globalValue !== undefined)
        return inspected.globalValue;
    return undefined;
}
function updateConfigurationValue(config, key, value, target, skippedConfigurationKeys) {
    const inspect = config.inspect;
    if (typeof inspect === "function" &&
        inspect.call(config, key) === undefined) {
        console.warn(`[faah] Skipping update for unregistered configuration: ${configurationSection}.${key}`);
        skippedConfigurationKeys.push(`${configurationSection}.${key}`);
        return undefined;
    }
    return Promise.resolve(config.update(key, value, target)).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[faah] Skipping configuration update for ${configurationSection}.${key}: ${message}`);
        skippedConfigurationKeys.push(`${configurationSection}.${key}`);
    });
}
function resolveConfigurationTarget(target) {
    const hasWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
    if (target === "workspace" && hasWorkspace)
        return vscode.ConfigurationTarget.Workspace;
    if (target === "workspace" && !hasWorkspace)
        return vscode.ConfigurationTarget.Global;
    return vscode.ConfigurationTarget.Global;
}
function normalizeStoredSettings(input) {
    const source = input ?? {};
    const fallbackCooldownMs = Math.max(typeof source.cooldownMs === "number"
        ? source.cooldownMs
        : exports.defaultStoredSettings.cooldownMs, minCooldownMs);
    const rawPatterns = Array.isArray(source.patterns)
        ? source.patterns.filter((item) => typeof item === "string")
        : [...defaultPatterns];
    const rawExcludePatterns = Array.isArray(source.excludePatterns)
        ? source.excludePatterns.filter((item) => typeof item === "string")
        : [...defaultExcludePatterns];
    return {
        enabled: typeof source.enabled === "boolean"
            ? source.enabled
            : exports.defaultStoredSettings.enabled,
        monitorTerminal: typeof source.monitorTerminal === "boolean"
            ? source.monitorTerminal
            : exports.defaultStoredSettings.monitorTerminal,
        monitorDiagnostics: typeof source.monitorDiagnostics === "boolean"
            ? source.monitorDiagnostics
            : exports.defaultStoredSettings.monitorDiagnostics,
        diagnosticsSeverity: parseEnum(source.diagnosticsSeverity, diagnosticsSeverityModes, exports.defaultStoredSettings.diagnosticsSeverity),
        terminalDetectionMode: parseEnum(source.terminalDetectionMode, terminalDetectionModes, exports.defaultStoredSettings.terminalDetectionMode),
        cooldownMs: fallbackCooldownMs,
        terminalCooldownMs: Math.max(typeof source.terminalCooldownMs === "number"
            ? source.terminalCooldownMs
            : fallbackCooldownMs, minCooldownMs),
        diagnosticsCooldownMs: Math.max(typeof source.diagnosticsCooldownMs === "number"
            ? source.diagnosticsCooldownMs
            : fallbackCooldownMs, minCooldownMs),
        patternMode: parseEnum(source.patternMode, patternModes, exports.defaultStoredSettings.patternMode),
        volumePercent: clamp(typeof source.volumePercent === "number"
            ? source.volumePercent
            : exports.defaultStoredSettings.volumePercent, 0, 100),
        showVisualNotifications: typeof source.showVisualNotifications === "boolean"
            ? source.showVisualNotifications
            : exports.defaultStoredSettings.showVisualNotifications,
        customSoundPath: typeof source.customSoundPath === "string"
            ? source.customSoundPath.trim()
            : exports.defaultStoredSettings.customSoundPath,
        quietHoursEnabled: typeof source.quietHoursEnabled === "boolean"
            ? source.quietHoursEnabled
            : exports.defaultStoredSettings.quietHoursEnabled,
        quietHoursStart: normalizeQuietHoursTime(source.quietHoursStart, exports.defaultStoredSettings.quietHoursStart),
        quietHoursEnd: normalizeQuietHoursTime(source.quietHoursEnd, exports.defaultStoredSettings.quietHoursEnd),
        excludePresetIds: Array.isArray(source.excludePresetIds)
            ? source.excludePresetIds.filter((item) => excludePresetIds.includes(String(item)))
            : [...exports.defaultStoredSettings.excludePresetIds],
        patterns: rawPatterns
            .map((pattern) => pattern.trim())
            .filter((pattern) => pattern.length > 0),
        excludePatterns: rawExcludePatterns
            .map((pattern) => pattern.trim())
            .filter((pattern) => pattern.length > 0),
    };
}
function toRuntimeSettings(stored) {
    const cacheKey = JSON.stringify({
        patternMode: stored.patternMode,
        excludePresetIds: stored.excludePresetIds,
        patterns: stored.patterns,
        excludePatterns: stored.excludePatterns,
    });
    if (!compiledRegexCache || compiledRegexCache.key !== cacheKey) {
        const userPatterns = compileRegexList(stored.patterns, "pattern");
        const presetExcludePatterns = getExcludePresetPatterns(stored.excludePresetIds);
        const excludePatterns = compileRegexList([...presetExcludePatterns, ...stored.excludePatterns], "exclude");
        const patterns = stored.patternMode === "append"
            ? [...defaultCompiledPatterns, ...userPatterns]
            : userPatterns.length > 0
                ? userPatterns
                : defaultCompiledPatterns;
        compiledRegexCache = {
            key: cacheKey,
            patterns,
            excludePatterns,
        };
    }
    return {
        enabled: stored.enabled,
        monitorTerminal: stored.monitorTerminal,
        monitorDiagnostics: stored.monitorDiagnostics,
        diagnosticsSeverity: stored.diagnosticsSeverity,
        terminalDetectionMode: stored.terminalDetectionMode,
        cooldownMs: stored.cooldownMs,
        terminalCooldownMs: stored.terminalCooldownMs,
        diagnosticsCooldownMs: stored.diagnosticsCooldownMs,
        volumePercent: stored.volumePercent,
        showVisualNotifications: stored.showVisualNotifications,
        customSoundPath: stored.customSoundPath,
        quietHoursEnabled: stored.quietHoursEnabled,
        quietHoursStart: stored.quietHoursStart,
        quietHoursEnd: stored.quietHoursEnd,
        excludePresetIds: stored.excludePresetIds,
        patterns: compiledRegexCache.patterns,
        excludePatterns: compiledRegexCache.excludePatterns,
    };
}
function loadStoredSettings(context) {
    const legacySaved = context.globalState.get(settingsStorageKey);
    const config = vscode.workspace.getConfiguration(configurationSection);
    const configOverrides = {};
    const enabled = readConfigurationOverride(config, "enabled");
    if (enabled !== undefined)
        configOverrides.enabled = enabled;
    const monitorTerminal = readConfigurationOverride(config, "monitorTerminal");
    if (monitorTerminal !== undefined)
        configOverrides.monitorTerminal = monitorTerminal;
    const monitorDiagnostics = readConfigurationOverride(config, "monitorDiagnostics");
    if (monitorDiagnostics !== undefined)
        configOverrides.monitorDiagnostics = monitorDiagnostics;
    const diagnosticsSeverity = readConfigurationOverride(config, "diagnosticsSeverity");
    if (diagnosticsSeverity !== undefined)
        configOverrides.diagnosticsSeverity = diagnosticsSeverity;
    const terminalDetectionMode = readConfigurationOverride(config, "terminalDetectionMode");
    if (terminalDetectionMode !== undefined) {
        configOverrides.terminalDetectionMode = terminalDetectionMode;
    }
    const cooldownMs = readConfigurationOverride(config, "cooldownMs");
    if (cooldownMs !== undefined)
        configOverrides.cooldownMs = cooldownMs;
    const terminalCooldownMs = readConfigurationOverride(config, "terminalCooldownMs");
    if (terminalCooldownMs !== undefined)
        configOverrides.terminalCooldownMs = terminalCooldownMs;
    const diagnosticsCooldownMs = readConfigurationOverride(config, "diagnosticsCooldownMs");
    if (diagnosticsCooldownMs !== undefined)
        configOverrides.diagnosticsCooldownMs = diagnosticsCooldownMs;
    const patternMode = readConfigurationOverride(config, "patternMode");
    if (patternMode !== undefined)
        configOverrides.patternMode = patternMode;
    const volumePercent = readConfigurationOverride(config, "volumePercent");
    if (volumePercent !== undefined)
        configOverrides.volumePercent = volumePercent;
    const showVisualNotifications = readConfigurationOverride(config, "showVisualNotifications");
    if (showVisualNotifications !== undefined) {
        configOverrides.showVisualNotifications = showVisualNotifications;
    }
    const customSoundPath = readConfigurationOverride(config, "customSoundPath");
    if (customSoundPath !== undefined)
        configOverrides.customSoundPath = customSoundPath;
    const quietHoursEnabled = readConfigurationOverride(config, "quietHoursEnabled");
    if (quietHoursEnabled !== undefined)
        configOverrides.quietHoursEnabled = quietHoursEnabled;
    const quietHoursStart = readConfigurationOverride(config, "quietHoursStart");
    if (quietHoursStart !== undefined)
        configOverrides.quietHoursStart = quietHoursStart;
    const quietHoursEnd = readConfigurationOverride(config, "quietHoursEnd");
    if (quietHoursEnd !== undefined)
        configOverrides.quietHoursEnd = quietHoursEnd;
    const excludePresetIdsValue = readConfigurationOverride(config, "excludePresetIds");
    if (excludePresetIdsValue !== undefined) {
        configOverrides.excludePresetIds = excludePresetIdsValue;
    }
    const patterns = readConfigurationOverride(config, "patterns");
    if (patterns !== undefined)
        configOverrides.patterns = patterns;
    const excludePatterns = readConfigurationOverride(config, "excludePatterns");
    if (excludePatterns !== undefined)
        configOverrides.excludePatterns = excludePatterns;
    const hasConfigOverrides = Object.keys(configOverrides).length > 0;
    if (!hasConfigOverrides)
        return normalizeStoredSettings(legacySaved);
    return normalizeStoredSettings({
        ...(legacySaved ?? {}),
        ...configOverrides,
    });
}
async function persistStoredSettings(context, settings, target = "global") {
    const config = vscode.workspace.getConfiguration(configurationSection);
    const configurationTarget = resolveConfigurationTarget(target);
    const skippedConfigurationKeys = [];
    await Promise.all([
        updateConfigurationValue(config, "enabled", settings.enabled, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "monitorTerminal", settings.monitorTerminal, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "monitorDiagnostics", settings.monitorDiagnostics, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "diagnosticsSeverity", settings.diagnosticsSeverity, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "terminalDetectionMode", settings.terminalDetectionMode, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "cooldownMs", settings.cooldownMs, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "terminalCooldownMs", settings.terminalCooldownMs, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "diagnosticsCooldownMs", settings.diagnosticsCooldownMs, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "patternMode", settings.patternMode, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "volumePercent", settings.volumePercent, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "showVisualNotifications", settings.showVisualNotifications, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "customSoundPath", settings.customSoundPath, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "quietHoursEnabled", settings.quietHoursEnabled, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "quietHoursStart", settings.quietHoursStart, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "quietHoursEnd", settings.quietHoursEnd, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "excludePresetIds", settings.excludePresetIds, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "patterns", settings.patterns, configurationTarget, skippedConfigurationKeys),
        updateConfigurationValue(config, "excludePatterns", settings.excludePatterns, configurationTarget, skippedConfigurationKeys),
    ]);
    await context.globalState.update(settingsStorageKey, settings);
    return { skippedConfigurationKeys };
}
function createPresetSettings(baseSettings, presetId, terminalMonitoringSupported = true) {
    const base = normalizeStoredSettings(baseSettings);
    const monitorTerminal = terminalMonitoringSupported;
    switch (presetId) {
        case "quiet":
            return {
                ...base,
                enabled: true,
                monitorTerminal,
                monitorDiagnostics: true,
                diagnosticsSeverity: "error",
                terminalDetectionMode: "either",
                cooldownMs: 5000,
                terminalCooldownMs: 4500,
                diagnosticsCooldownMs: 5000,
                volumePercent: 45,
                showVisualNotifications: true,
                quietHoursEnabled: true,
                quietHoursStart: "22:00",
                quietHoursEnd: "07:00",
            };
        case "aggressive":
            return {
                ...base,
                enabled: true,
                monitorTerminal,
                monitorDiagnostics: true,
                diagnosticsSeverity: "warningAndError",
                terminalDetectionMode: "either",
                cooldownMs: 700,
                terminalCooldownMs: 700,
                diagnosticsCooldownMs: 700,
                volumePercent: 90,
                showVisualNotifications: true,
                quietHoursEnabled: false,
            };
        case "balanced":
        default:
            return {
                ...base,
                enabled: true,
                monitorTerminal,
                monitorDiagnostics: true,
                diagnosticsSeverity: "error",
                terminalDetectionMode: "either",
                cooldownMs: 1500,
                terminalCooldownMs: 1500,
                diagnosticsCooldownMs: 1500,
                volumePercent: 70,
                showVisualNotifications: false,
                quietHoursEnabled: false,
                quietHoursStart: "22:00",
                quietHoursEnd: "07:00",
            };
    }
}
//# sourceMappingURL=settings.js.map