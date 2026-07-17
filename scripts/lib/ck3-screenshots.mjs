// Steam screenshot discovery and indexing for CK3 analysis.
//
// Steam saves CK3 screenshots to:
//   ~/.steam/debian-installation/userdata/<uid>/760/remote/<appid>/screenshots/<YYYYMMDDhhmmss>_N.jpg
//
// For Crusader Kings III the appid is 1158310. The CK3 INGEST manifest records the
// wall-clock mtime of each save, so we can map screenshots to the most recent save
// that was written at or before the screenshot was taken.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const CK3_APP_ID = 1158310;
const SCREENSHOT_RE = /^(\d{8})(\d{6})_\d+\.(?:jpg|png)$/i;

function candidateSteamRoots(home) {
  return [
    path.join(home, '.steam', 'debian-installation'),
    path.join(home, '.local', 'share', 'Steam'),
  ].filter((root) => fs.existsSync(root));
}

export function discoverScreenshotDirs(home = process.env.HOME ?? '') {
  const dirs = [];
  for (const root of candidateSteamRoots(home)) {
    const userdata = path.join(root, 'userdata');
    if (!fs.existsSync(userdata)) continue;
    for (const uid of fs.readdirSync(userdata)) {
      const full = path.join(userdata, uid, '760', 'remote', String(CK3_APP_ID), 'screenshots');
      if (fs.existsSync(full)) {
        dirs.push({ root, uid, screenshotsDir: full });
      }
    }
  }
  return dirs;
}

export function discoverScreenshots(home = process.env.HOME ?? '') {
  const results = [];
  for (const { screenshotsDir } of discoverScreenshotDirs(home)) {
    for (const entry of fs.readdirSync(screenshotsDir)) {
      const fullPath = path.join(screenshotsDir, entry);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      const m = entry.match(SCREENSHOT_RE);
      if (!m) continue;
      // Filename timestamp = YYYYMMDDhhmmss (local Steam timestamp, UTC in en-US installs)
      // Use it as `takenAtIso` based on local time. Steam stores filename as local time.
      const stamp = m[1] + m[2];
      const takenAtIso = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12, 14)}`;
      const base = path.basename(entry, path.extname(entry));
      const hash = crypto.createHash('sha1').update(fullPath + ':' + stat.size + ':' + stat.mtimeMs).digest('hex').slice(0, 12);
      results.push({
        path: fullPath,
        filename: entry,
        takenAtIso,
        takenAtMs: stat.mtimeMs,
        statMtimeIso: stat.mtime.toISOString(),
        statMtimeMs: stat.mtimeMs,
        size: stat.size,
        archiveBase: `${stamp}_${hash}`,
      });
    }
  }
  return results.sort((a, b) => a.takenAtMs - b.takenAtMs);
}

export function indexWithSaves(screenshots, manifests) {
  // manifests: array of { path, jsonPath, mtimeMs, mtimeIso, date }
  // For each screenshot, attach the latest manifest whose mtimeMs <= screenshot.takenAtMs.
  const sorted = [...manifests].sort((a, b) => a.mtimeMs - b.mtimeMs);

  const entries = screenshots.map((shot) => {
    let associated = null;
    for (const m of sorted) {
      if (m.mtimeMs <= shot.takenAtMs) associated = m;
    }
    return {
      ...shot,
      associatedManifest: associated ? associated.path : null,
      associatedDate: associated ? associated.date ?? null : null,
      associatedManifestPath: associated ? associated.manifestPath ?? null : null,
    };
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    screenshotCount: entries.length,
    entries,
  };
}

export function writeIndex(indexObj, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(indexObj, null, 2)}\n`);
  return outPath;
}

export function loadIndex(indexPath) {
  if (!fs.existsSync(indexPath)) return null;
  return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
}

export function loadAnalysis(analysisPath) {
  if (!fs.existsSync(analysisPath)) return null;
  return JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
}

export function gameTimeAssociation(entries, saves) {
  // saves: [{ manifestPath, date, sourceMtimeMs }] sorted by in-game date ascending
  // For each entry, attach `gameTimeAssociated` = the closest save by in-game date
  // where the save's date is >= entry.inGameDate. If no such save, fall back to the
  // largest save with date < entry.inGameDate (the next-previous save).
  const sortedSaves = [...saves].sort((a, b) => compareCk3Date(a.date, b.date));
  return entries.map((e) => {
    const inGameDate = e.inGameDate ?? e.associatedDate ?? null;
    if (!inGameDate) return { ...e, gameTimeAssociated: null, gameTimeAssociatedType: null };
    const target = parseCk3Date(inGameDate);
    let postSave = null;
    let preSave = null;
    for (const s of sortedSaves) {
      if (!s.date) continue;
      const cmp = compareCk3Date(s.date, inGameDate);
      if (cmp >= 0 && !postSave) postSave = s;
      if (cmp <= 0) preSave = s;
    }
    const chosen = postSave ?? preSave;
    const type = postSave ? 'forward' : (preSave ? 'backward' : null);
    return {
      ...e,
      gameTimeAssociated: chosen ? chosen.manifestPath : null,
      gameTimeAssociatedDate: chosen ? chosen.date : null,
      gameTimeAssociatedType: type,
    };
  });
}

function parseCk3Date(value) {
  if (typeof value !== 'string') return [0, 0, 0];
  const [y, m, d] = value.split('.').map((part) => Number(part));
  return [y || 0, m || 0, d || 0];
}

function compareCk3Date(a, b) {
  const ap = parseCk3Date(a);
  const bp = parseCk3Date(b);
  for (let i = 0; i < 3; i += 1) {
    if (ap[i] !== bp[i]) return ap[i] - bp[i];
  }
  return 0;
}

export function mergeAnalysis(entries, analysis) {
  if (!analysis || !Array.isArray(analysis.entries)) return entries;
  const byArchive = new Map();
  for (const a of analysis.entries) byArchive.set(a.archivePath, a);
  return entries.map((e) => {
    const a = byArchive.get(e.archivePath);
    if (!a) return e;
    return {
      ...e,
      inGameDate: a.inGameDate ?? e.associatedDate ?? null,
      eventSummary: a.eventSummary ?? null,
      player: a.player !== 'unknown' ? a.player : (e.player ?? null),
      location: a.location !== 'unknown' ? a.location : (e.location ?? null),
      keywords: a.keywords ?? null,
      analysisSource: analysis.model ?? null,
    };
  });
}

export function copyScreenshotsIntoArchive(screenshots, archiveDir) {
  fs.mkdirSync(archiveDir, { recursive: true });
  const copied = [];
  for (const shot of screenshots) {
    const dest = path.join(archiveDir, `${shot.archiveBase}.jpg`);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(shot.path, dest);
    }
    copied.push({ ...shot, archivePath: dest });
  }
  return copied;
}
