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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPrewarmState = resetPrewarmState;
exports.resolveSoundPath = resolveSoundPath;
exports.prewarmAudioBackend = prewarmAudioBackend;
exports.playAlert = playAlert;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const play_sound_1 = __importDefault(require("play-sound"));
const vscode = __importStar(require("vscode"));
const fixedSoundFile = "faah.wav";
const isWindows = process.platform === "win32";
const isLinux = process.platform === "linux";
const linuxPreferredPlayers = [
    "paplay",
    "ffplay",
    "mpv",
    "cvlc",
    "mplayer",
    "mpg123",
    "mpg321",
    "play",
    "aplay",
];
const player = (0, play_sound_1.default)(isLinux ? { players: linuxPreferredPlayers } : {});
let hasWarnedVolumeFallback = false;
let hasWarnedWindowsFallback = false;
let hasWarnedLinuxMissingPlayer = false;
let lastMissingSoundWarningPath = null;
let lastInvalidCustomSoundWarningPath = null;
let hasAttemptedWindowsPrewarm = false;
let hasCompletedWindowsPrewarm = false;
function resetPrewarmState() {
    hasAttemptedWindowsPrewarm = false;
    hasCompletedWindowsPrewarm = false;
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function getHomeDirectory() {
    return process.env.HOME ?? process.env.USERPROFILE;
}
function getWorkspaceFolderCandidates() {
    const candidates = [];
    const activeEditorUri = vscode.window.activeTextEditor?.document.uri;
    const activeWorkspaceFolder = activeEditorUri && typeof vscode.workspace.getWorkspaceFolder === "function"
        ? vscode.workspace.getWorkspaceFolder(activeEditorUri)?.uri.fsPath
        : undefined;
    if (activeWorkspaceFolder) {
        candidates.push(activeWorkspaceFolder);
    }
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        const folderPath = folder.uri.fsPath;
        if (!candidates.includes(folderPath)) {
            candidates.push(folderPath);
        }
    }
    return candidates;
}
function showMissingSoundFileWarning(soundPath) {
    if (lastMissingSoundWarningPath === soundPath)
        return;
    lastMissingSoundWarningPath = soundPath;
    if (path.basename(soundPath) === fixedSoundFile) {
        vscode.window.showWarningMessage(`Faah could not find audio file: ${fixedSoundFile} in media/.`);
        return;
    }
    vscode.window.showWarningMessage(`Faah could not find audio file at: ${soundPath}`);
}
function showInvalidCustomSoundFallbackWarning(rawCustomSoundPath, resolvedCustomSoundPath) {
    if (lastInvalidCustomSoundWarningPath === resolvedCustomSoundPath)
        return;
    lastInvalidCustomSoundWarningPath = resolvedCustomSoundPath;
    vscode.window.showWarningMessage(`Faah custom sound not found: ${rawCustomSoundPath}. Using default ${fixedSoundFile}.`);
}
function clearMissingSoundWarningPath(soundPath) {
    if (lastMissingSoundWarningPath === soundPath) {
        lastMissingSoundWarningPath = null;
    }
}
function clearInvalidCustomSoundWarningPath(resolvedCustomSoundPath) {
    if (lastInvalidCustomSoundWarningPath === resolvedCustomSoundPath) {
        lastInvalidCustomSoundWarningPath = null;
    }
}
function warnWindowsFallbackOnce(message) {
    if (hasWarnedWindowsFallback)
        return;
    hasWarnedWindowsFallback = true;
    console.warn(message);
}
function warnLinuxPlayerMissingOnce(errorText) {
    if (!isLinux || hasWarnedLinuxMissingPlayer)
        return;
    if (!errorText.toLowerCase().includes("couldn't find a suitable audio player"))
        return;
    hasWarnedLinuxMissingPlayer = true;
    vscode.window.showWarningMessage("Faah could not find a Linux audio player. Install one of: ffmpeg (ffplay), mpv, mpg123, vlc, or sox.");
}
function resolveCustomSoundPath(input) {
    const trimmed = input.trim();
    if (!trimmed)
        return "";
    const pathApi = isWindows ? path.win32 : path;
    const withExpandedHome = trimmed === "~"
        ? (getHomeDirectory() ?? trimmed)
        : trimmed.startsWith("~/") || (isWindows && trimmed.startsWith("~\\"))
            ? pathApi.join(getHomeDirectory() ?? "~", trimmed.slice(2))
            : trimmed;
    if (pathApi.isAbsolute(withExpandedHome))
        return withExpandedHome;
    const workspaceFolders = getWorkspaceFolderCandidates();
    if (workspaceFolders.length > 0) {
        const resolvedCandidates = workspaceFolders.map((workspaceFolder) => pathApi.resolve(workspaceFolder, withExpandedHome));
        const existingCandidate = resolvedCandidates.find((candidate) => fs.existsSync(candidate));
        return existingCandidate ?? resolvedCandidates[0];
    }
    return pathApi.resolve(withExpandedHome);
}
function resolveSoundPath(context, settings) {
    const defaultSoundPath = context.asAbsolutePath(path.join("media", fixedSoundFile));
    const rawCustomSoundPath = settings?.customSoundPath?.trim() ?? "";
    if (rawCustomSoundPath.length > 0) {
        const resolvedCustomSoundPath = resolveCustomSoundPath(rawCustomSoundPath);
        if (resolvedCustomSoundPath && fs.existsSync(resolvedCustomSoundPath)) {
            clearInvalidCustomSoundWarningPath(resolvedCustomSoundPath);
            clearMissingSoundWarningPath(defaultSoundPath);
            return resolvedCustomSoundPath;
        }
        showInvalidCustomSoundFallbackWarning(rawCustomSoundPath, resolvedCustomSoundPath);
    }
    if (!fs.existsSync(defaultSoundPath)) {
        showMissingSoundFileWarning(defaultSoundPath);
        return defaultSoundPath;
    }
    clearMissingSoundWarningPath(defaultSoundPath);
    return defaultSoundPath;
}
function playWithoutVolume(soundPath) {
    player.play(soundPath, (err) => {
        if (!err)
            return;
        const errText = err.message ?? String(err);
        warnLinuxPlayerMissingOnce(errText);
        if (isWindows) {
            warnWindowsFallbackOnce(`Failed to play sound with system audio player. Falling back to console beep. Error: ${errText}`);
            playWindowsBeepFallback(100);
        }
        console.warn(`Failed to play sound: ${errText}`);
    });
}
function escapePowerShellSingleQuoted(value) {
    return value.replace(/'/g, "''");
}
function playWindowsBeepFallback(volumePercent) {
    if (volumePercent <= 0)
        return;
    const frequency = 880;
    const duration = 180;
    const script = `[console]::Beep(${frequency}, ${duration})`;
    const fallbackProcess = (0, child_process_1.spawn)("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
    ], {
        stdio: "ignore",
        windowsHide: true,
    });
    fallbackProcess.on("error", (err) => {
        warnWindowsFallbackOnce(`Windows fallback beep failed: ${err.message}`);
    });
}
function prewarmAudioBackend(soundPath) {
    if (!isWindows)
        return;
    if (hasCompletedWindowsPrewarm || hasAttemptedWindowsPrewarm)
        return;
    if (!fs.existsSync(soundPath))
        return;
    hasAttemptedWindowsPrewarm = true;
    const escapedSoundPath = escapePowerShellSingleQuoted(soundPath);
    // Full exercise: load assembly, open file, play briefly, stop — warms codec cache
    const warmupScript = [
        "$ErrorActionPreference = 'SilentlyContinue'",
        "Add-Type -AssemblyName PresentationCore",
        "$mp = New-Object System.Windows.Media.MediaPlayer",
        "$mp.Volume = 0",
        `$mp.Open([Uri]::new('${escapedSoundPath}'))`,
        "$deadline = (Get-Date).AddMilliseconds(600)",
        "while (-not $mp.NaturalDuration.HasTimeSpan -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 10 }",
        "$mp.Play()",
        "Start-Sleep -Milliseconds 80",
        "$mp.Stop()",
        "$mp.Close()",
    ].join("; ");
    const warmupProcess = (0, child_process_1.spawn)("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        warmupScript,
    ], {
        stdio: "ignore",
        windowsHide: true,
    });
    warmupProcess.on("close", () => {
        hasCompletedWindowsPrewarm = true;
    });
    warmupProcess.on("error", () => {
        hasCompletedWindowsPrewarm = false;
    });
}
function playOnWindowsWithSoundPlayer(soundPath, settings) {
    const escapedSoundPath = escapePowerShellSingleQuoted(soundPath);
    const script = [
        "$ErrorActionPreference = 'Stop'",
        `$sp = New-Object System.Media.SoundPlayer '${escapedSoundPath}'`,
        "$sp.PlaySync()",
    ].join("; ");
    const playbackProcess = (0, child_process_1.spawn)("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
    ], {
        stdio: "ignore",
        windowsHide: true,
    });
    playbackProcess.on("error", (err) => {
        warnWindowsFallbackOnce(`Failed to play sound with Windows SoundPlayer. Falling back to console beep. Error: ${err.message}`);
        playWindowsBeepFallback(settings.volumePercent);
    });
    playbackProcess.on("close", (code) => {
        if (code === 0 || code === null)
            return;
        warnWindowsFallbackOnce(`Windows SoundPlayer exited with code ${code}. Falling back to console beep.`);
        playWindowsBeepFallback(settings.volumePercent);
    });
}
function playOnWindows(soundPath, settings) {
    const escapedSoundPath = escapePowerShellSingleQuoted(soundPath);
    const volumeRatio = clamp(settings.volumePercent, 0, 100) / 100;
    const script = [
        "$ErrorActionPreference = 'Stop'",
        "Add-Type -AssemblyName PresentationCore",
        `$path = '${escapedSoundPath}'`,
        "$player = New-Object System.Windows.Media.MediaPlayer",
        `$player.Volume = ${volumeRatio.toFixed(2)}`,
        "$player.Open([Uri]::new($path))",
        "$player.Play()",
        "$durationDeadline = (Get-Date).AddMilliseconds(100)",
        "while (-not $player.NaturalDuration.HasTimeSpan -and (Get-Date) -lt $durationDeadline) { Start-Sleep -Milliseconds 10 }",
        "$waitMs = 2000",
        "if ($player.NaturalDuration.HasTimeSpan) {",
        "  $waitMs = [Math]::Min(15000, [Math]::Max(200, [int]([Math]::Ceiling($player.NaturalDuration.TimeSpan.TotalMilliseconds) + 80)))",
        "}",
        "Start-Sleep -Milliseconds $waitMs",
        "$player.Stop()",
        "$player.Close()",
    ].join("; ");
    const playbackProcess = (0, child_process_1.spawn)("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
    ], {
        stdio: "ignore",
        windowsHide: true,
    });
    playbackProcess.on("error", (err) => {
        warnWindowsFallbackOnce(`Failed to play sound with hidden Windows player. Falling back to console beep. Error: ${err.message}`);
        playWindowsBeepFallback(settings.volumePercent);
    });
    playbackProcess.on("close", (code) => {
        if (code === 0 || code === null)
            return;
        warnWindowsFallbackOnce(`Windows inline audio playback exited with code ${code}. Falling back to console beep.`);
        playWindowsBeepFallback(settings.volumePercent);
    });
}
function playUsingSystemPlayer(soundPath, settings) {
    if (settings.volumePercent === 100) {
        playWithoutVolume(soundPath);
        return;
    }
    const options = buildCustomVolumeOptions(settings.volumePercent);
    player.play(soundPath, options, (err) => {
        if (!err)
            return;
        const errText = err.message ?? String(err);
        warnLinuxPlayerMissingOnce(errText);
        if (!hasWarnedVolumeFallback) {
            hasWarnedVolumeFallback = true;
            console.warn(`Custom volume options failed with current audio player. Falling back to default volume. Error: ${errText}`);
        }
        playWithoutVolume(soundPath);
    });
}
function buildCustomVolumeOptions(volumePercent) {
    const ratio = clamp(volumePercent, 0, 100) / 100;
    return {
        afplay: ["-v", ratio],
        mplayer: ["-volume", Math.round(ratio * 100)],
        mpg123: ["-f", Math.round(ratio * 32768)],
        play: ["vol", ratio],
        cvlc: ["--gain", ratio],
    };
}
function playCustomFileWithVolume(soundPath, settings) {
    if (settings.volumePercent <= 0)
        return;
    if (isWindows) {
        if (settings.volumePercent === 100) {
            playOnWindowsWithSoundPlayer(soundPath, settings);
            return;
        }
        playOnWindows(soundPath, settings);
        return;
    }
    playUsingSystemPlayer(soundPath, settings);
}
function playAlert(settings, soundPath) {
    if (!fs.existsSync(soundPath)) {
        showMissingSoundFileWarning(soundPath);
        return;
    }
    playCustomFileWithVolume(soundPath, settings);
}
//# sourceMappingURL=audio.js.map