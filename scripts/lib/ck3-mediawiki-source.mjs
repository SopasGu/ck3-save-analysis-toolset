import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEFAULT_CK3_WIKI_API = 'https://ck3.paradoxwikis.com/api.php';
export const DEFAULT_USER_AGENT =
  'ck3-save-analysis-toolset/0.1 (local documentation research; https://github.com/SopasGu/ck3-save-analysis-toolset)';
export const DEFAULT_MIN_DELAY_MS = 1200;

export function sourceIdForMediaWikiPage(siteKey, title) {
  return `source:${slug(siteKey)}:${slug(title)}`;
}

export async function fetchMediaWikiPageSource({
  apiUrl = DEFAULT_CK3_WIKI_API,
  title,
  cacheDir,
  userAgent = DEFAULT_USER_AGENT,
  minDelayMs = DEFAULT_MIN_DELAY_MS,
} = {}) {
  if (!title) throw new Error('title is required');
  const client = new MediaWikiClient({ apiUrl, cacheDir, userAgent, minDelayMs });
  const siteInfo = await client.get({
    action: 'query',
    meta: 'siteinfo',
    siprop: 'general|rightsinfo',
    format: 'json',
    formatversion: '2',
  });
  const pageQuery = await client.get({
    action: 'query',
    titles: title,
    prop: 'info|revisions|links',
    inprop: 'url',
    rvprop: 'ids|timestamp|sha1|user|comment',
    pllimit: 'max',
    redirects: '1',
    format: 'json',
    formatversion: '2',
  }, { continueParam: 'plcontinue' });

  const page = pageQuery.query?.pages?.[0];
  if (!page || page.missing) {
    throw new Error(`MediaWiki page not found: ${title}`);
  }
  const revision = page.revisions?.[0] ?? null;
  const canonicalUrl = page.canonicalurl ?? page.fullurl ?? `${siteInfo.query.general.server}${siteInfo.query.general.articlepath.replace('$1', encodeURIComponent(page.title))}`;
  const links = (page.links ?? [])
    .filter((link) => link.ns === 0)
    .map((link) => ({
      title: link.title,
      url: `${siteInfo.query.general.server}${siteInfo.query.general.articlepath.replace('$1', encodeTitle(link.title))}`,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
  const siteKey = new URL(apiUrl).hostname.replace(/^www\./, '');

  return {
    sourceId: sourceIdForMediaWikiPage(siteKey, page.title),
    kind: 'mediawiki_page',
    site: {
      key: siteKey,
      sitename: siteInfo.query.general.sitename,
      generator: siteInfo.query.general.generator,
      apiUrl,
      server: siteInfo.query.general.server,
      articlePath: siteInfo.query.general.articlepath,
      rights: siteInfo.query.rightsinfo ?? null,
    },
    page: {
      title: page.title,
      pageId: page.pageid,
      canonicalUrl,
      revisionId: revision?.revid ?? null,
      parentRevisionId: revision?.parentid ?? null,
      touched: page.touched ?? null,
      revisionTimestamp: revision?.timestamp ?? null,
      revisionSha1: revision?.sha1 ?? null,
      oldidUrl: revision?.revid ? `${canonicalUrl}?oldid=${revision.revid}` : canonicalUrl,
    },
    links,
    requestPolicy: {
      userAgent,
      minDelayMs,
      concurrency: 1,
      cacheDir: cacheDir ? displayPath(cacheDir) : null,
      retryAfterHonored: true,
    },
  };
}

export function summarizeMediaWikiLinks(source) {
  const groups = {
    gettingStarted: [
      "Beginner's guide",
      'Mechanics',
      'Game rules',
      'Console commands',
      'Interesting characters',
    ],
    characterSystems: [
      'Characters',
      'Attributes',
      'Traits',
      'Resources',
      'Lifestyle',
      'Dynasty',
      'Schemes',
      'Hooks',
      'Artifacts',
      'Modifiers',
    ],
    governance: [
      'Council',
      'Court',
      'Government',
      'Laws',
      'Prisoners',
      'Activity',
      'Decisions',
      'Power sharing',
      'Royal court',
      'Adventurer',
    ],
    realm: [
      'Titles',
      'Subjects',
      'Building',
      'Domicile',
      'Great projects',
      'Situation',
      'Barony',
      'County',
      'Travel',
    ],
    warfare: [
      'Warfare',
      'Army',
      'Knight',
      'Hired forces',
      'Casus belli',
      'Alliance',
      'Duel',
    ],
    cultureFaith: [
      'Faith',
      'Doctrines',
      'Tenets',
      'Holy sites',
      'Culture',
      'Traditions',
      'Innovation',
    ],
    documentationMeta: [
      'Modding',
      'Jargon',
      'Achievements',
      'Developer diaries',
      'Patches',
      'Downloadable content',
    ],
  };
  const linksByTitle = new Map(source.links.map((link) => [link.title, link]));
  return Object.fromEntries(
    Object.entries(groups).map(([group, titles]) => [
      group,
      titles.filter((title) => linksByTitle.has(title)).map((title) => linksByTitle.get(title)),
    ]),
  );
}

export function buildMediaWikiRegistryEntry(source, options = {}) {
  const summary = summarizeMediaWikiLinks(source);
  const contentHash = hashStableJson({
    site: source.site.key,
    title: source.page.title,
    revisionId: source.page.revisionId,
    revisionSha1: source.page.revisionSha1,
    links: source.links.map((link) => link.title),
  });
  return {
    sourceId: source.sourceId,
    kind: 'documentation_mediawiki_page',
    label: options.label ?? `${source.site.sitename}: ${source.page.title}`,
    acquiredAt: options.acquiredAt ?? new Date().toISOString(),
    publisher: source.site.sitename,
    documentType: 'mediawiki_page',
    title: source.page.title,
    canonicalUrl: source.page.canonicalUrl,
    oldidUrl: source.page.oldidUrl,
    revision: {
      pageId: source.page.pageId,
      revisionId: source.page.revisionId,
      parentRevisionId: source.page.parentRevisionId,
      timestamp: source.page.revisionTimestamp,
      sha1: source.page.revisionSha1,
    },
    content: {
      hashAlgorithm: 'sha256',
      structuralSummarySha256: contentHash,
      copiedContent: 'metadata_and_link_titles_only',
    },
    scope: {
      gameVersions: options.gameVersions ?? [],
      dlc: options.allDlcActive ? ['ALL_ACTIVE_ASSUMPTION'] : (options.dlc ?? []),
      mods: options.mods ?? [],
      allDlcActive: Boolean(options.allDlcActive),
    },
    licensing: {
      rights: source.site.rights,
      redistribution: 'Do not copy whole wiki pages into this repository; store citations, page metadata, and short summaries only unless license review permits more.',
    },
    requestPolicy: source.requestPolicy,
    extracted: {
      linkCount: source.links.length,
      topicGroups: Object.fromEntries(
        Object.entries(summary).map(([group, links]) => [group, links.map((link) => link.title)]),
      ),
    },
    visibility: {
      classification: 'external',
      rawArtifactCommitted: false,
      rationale: 'External CK3 wiki documentation source. Durable knowledge should cite this page/revision and store only compliant summaries.',
    },
    notes: options.notes ?? [],
  };
}

class MediaWikiClient {
  constructor({ apiUrl, cacheDir, userAgent, minDelayMs }) {
    this.apiUrl = apiUrl;
    this.cacheDir = cacheDir;
    this.userAgent = userAgent;
    this.minDelayMs = minDelayMs;
    this.lastRequestAt = 0;
  }

  async get(params, options = {}) {
    const combined = [];
    let nextParams = { ...params };
    let merged = null;
    while (true) {
      const data = await this.getOnce(nextParams);
      combined.push(data);
      merged = mergeQueryResult(merged, data);
      const cont = data.continue?.[options.continueParam] ?? data.continue?.continue;
      if (!cont || !options.continueParam) break;
      nextParams = {
        ...params,
        [options.continueParam]: cont,
        continue: data.continue.continue ?? '',
      };
    }
    return merged ?? combined[0];
  }

  async getOnce(params) {
    const url = new URL(this.apiUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const cachePath = this.cachePath(url.href);
    if (cachePath && fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }
    await this.waitForRateLimit();
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Api-User-Agent': this.userAgent,
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
      },
    });
    if (response.status === 429 || response.status === 503) {
      const retryAfter = parseInt(response.headers.get('retry-after') ?? '5', 10);
      await sleep(Math.max(retryAfter, 5) * 1000);
      return this.getOnce(params);
    }
    if (!response.ok) {
      throw new Error(`MediaWiki request failed ${response.status}: ${url.href}`);
    }
    const data = await response.json();
    if (cachePath) {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(data, null, 2) + '\n');
    }
    return data;
  }

  async waitForRateLimit() {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minDelayMs) {
      await sleep(this.minDelayMs - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  cachePath(url) {
    if (!this.cacheDir) return null;
    return path.join(this.cacheDir, `${hash(url)}.json`);
  }
}

function mergeQueryResult(acc, data) {
  if (!acc) return JSON.parse(JSON.stringify(data));
  const accPage = acc.query?.pages?.[0];
  const dataPage = data.query?.pages?.[0];
  if (accPage && dataPage?.links) {
    accPage.links = [...(accPage.links ?? []), ...dataPage.links];
  }
  return acc;
}

function encodeTitle(title) {
  return encodeURIComponent(title.replace(/ /g, '_'));
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function hashStableJson(value) {
  return hash(JSON.stringify(sortObject(value)));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, sortObject(v)]),
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function displayPath(filePath) {
  const resolved = path.resolve(filePath);
  const relative = path.relative(process.cwd(), resolved);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) return relative;
  return path.basename(resolved);
}
