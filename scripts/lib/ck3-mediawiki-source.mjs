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
  fetchSections = false,
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
  const sectionAnchors = fetchSections
    ? await fetchMediaWikiPageSections({
        client,
        apiUrl,
        title: page.title,
      })
    : [];

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
      length: page.length ?? null,
    },
    links,
    sectionAnchors,
    requestPolicy: {
      userAgent,
      minDelayMs,
      concurrency: 1,
      cacheDir: cacheDir ? displayPath(cacheDir) : null,
      retryAfterHonored: true,
    },
  };
}

export async function fetchMediaWikiPageSections({ client, title }) {
  const data = await client.get({
    action: 'parse',
    page: title,
    redirects: '1',
    prop: 'sections',
    format: 'json',
    formatversion: '2',
  });
  const sections = data.parse?.sections ?? [];
  return sections
    .map((section, idx) => ({
      index: section.index ?? idx,
      toplevel: section.toclevel ?? null,
      anchor: String(section.anchor ?? '').trim(),
      line: String(section.line ?? '').trim(),
    }))
    .filter((section) => section.line.length > 0)
    .sort((a, b) => Number(a.index) - Number(b.index));
}

export async function fetchMediaWikiPageContentSource({
  apiUrl = DEFAULT_CK3_WIKI_API,
  title,
  source = null,
  cacheDir,
  userAgent = DEFAULT_USER_AGENT,
  minDelayMs = DEFAULT_MIN_DELAY_MS,
} = {}) {
  if (!title && !source) throw new Error('title or source is required');
  const client = new MediaWikiClient({ apiUrl, cacheDir, userAgent, minDelayMs });
  const pageSource = source ?? await fetchMediaWikiPageSource({
    apiUrl,
    title,
    cacheDir,
    userAgent,
    minDelayMs,
    fetchSections: true,
  });
  const parseParams = {
    action: 'parse',
    prop: 'wikitext|sections',
    redirects: '1',
    format: 'json',
    formatversion: '2',
  };
  if (pageSource.page.revisionId) {
    parseParams.oldid = String(pageSource.page.revisionId);
  } else {
    parseParams.page = pageSource.page.title;
  }
  const parsed = await client.get(parseParams);
  const wikitext = parsed.parse?.wikitext;
  if (typeof wikitext !== 'string') {
    throw new Error(`MediaWiki content response did not include wikitext for ${title}`);
  }
  return {
    schemaVersion: 1,
    source: pageSource,
    content: {
      pageTitle: parsed.parse?.title ?? pageSource.page.title,
      pageId: parsed.parse?.pageid ?? pageSource.page.pageId,
      revisionId: pageSource.page.revisionId,
      wikitextSha256: hash(wikitext),
      sections: extractMediaWikiMechanicsNotes(wikitext),
    },
  };
}

export function extractMediaWikiMechanicsNotes(wikitext, options = {}) {
  const maxSections = options.maxSections ?? 18;
  const maxNotesPerSection = options.maxNotesPerSection ?? 5;
  const sectionBlocks = splitWikitextSections(wikitext);
  const sections = [];
  for (const block of sectionBlocks) {
    const notes = extractNotesFromSection(block.body, maxNotesPerSection);
    if (notes.length === 0) continue;
    sections.push({
      title: block.title,
      level: block.level,
      anchor: slug(block.title).replace(/-/g, '_'),
      notes,
    });
    if (sections.length >= maxSections) break;
  }
  return sections;
}

export function buildMechanicsContentPage({
  source,
  content,
  topic,
  topicGroup,
  linkedTopics = [],
  generatedAt = new Date().toISOString(),
} = {}) {
  if (!source) throw new Error('source is required');
  if (!content) throw new Error('content is required');
  const title = topic ?? source.page.title;
  const slugTitle = slug(title);
  const sourceId = source.sourceId;
  const oldidUrl = source.page.oldidUrl;
  const sections = content.sections ?? [];
  const outbound = linkedTopics.slice(0, 20);
  const lines = [
    '---',
    'pageType: mechanics_content',
    `title: ${JSON.stringify(title)}`,
    `topicGroup: ${JSON.stringify(topicGroup ?? null)}`,
    `sourceId: ${JSON.stringify(sourceId)}`,
    `sourceRevisionId: ${JSON.stringify(source.page.revisionId)}`,
    `sourceOldidUrl: ${JSON.stringify(oldidUrl)}`,
    `license: ${JSON.stringify('CC BY-SA 3.0')}`,
    `generatedAt: ${JSON.stringify(generatedAt)}`,
    `contentHash: ${JSON.stringify(content.wikitextSha256)}`,
    '---',
    '',
    `# ${title}`,
    '',
    '## Source And Attribution',
    '',
    `- Source: \`${sourceId}\``,
    `- Revision: <${oldidUrl}>`,
    '- License: Creative Commons Attribution-ShareAlike 3.0 (`https://creativecommons.org/licenses/by-sa/3.0/`)',
    '- Scope: official CK3 Wiki mechanics documentation; all DLC is assumed active for this project unless a cited source says otherwise.',
    '- Content basis: bounded section notes derived from revision-pinned wiki text. This page is not a full copy of the source article.',
    '',
    '## Advisor Use',
    '',
    `Use this page when a question needs CK3 mechanics context for ${title}. Combine these mechanics notes with current-save evidence paths and advisor models before giving player advice.`,
    '',
    '## Mechanics Notes',
    '',
  ];
  for (const section of sections) {
    lines.push(`### ${section.title}`, '');
    for (const note of section.notes) {
      lines.push(`- ${linkMechanicsTerms(note, { currentSlug: slugTitle })}`);
    }
    lines.push('');
  }
  if (outbound.length > 0) {
    lines.push('## Related Wiki Topics', '');
    for (const link of outbound) {
      lines.push(`- [[mechanics-content/${link.slug}|${link.title}]]`);
    }
    lines.push('');
  }
  lines.push('## Machine Reference', '');
  lines.push(`- Mechanics content slug: \`${slugTitle}\``);
  lines.push(`- Source title: \`${source.page.title}\``);
  lines.push(`- Source page length: \`${source.page.length ?? 'unknown'}\``);
  lines.push('');
  return lines.join('\n');
}

export function linkMechanicsTerms(value, options = {}) {
  let text = String(value);
  const currentSlug = options.currentSlug ?? null;
  const linkedTargets = new Set();
  for (const alias of MECHANICS_LINK_ALIASES) {
    if (alias.slug === currentSlug && !alias.anchor) continue;
    if (linkedTargets.has(alias.target)) continue;
    const next = replaceFirstUnlinked(text, alias, currentSlug);
    if (next !== text) {
      text = next;
      linkedTargets.add(alias.target);
    }
  }
  return text;
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
    sectionAnchors: (source.sectionAnchors ?? []).map((s) => s.line),
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
      sectionAnchorCount: (source.sectionAnchors ?? []).length,
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

export function summarizeMediaWikiTopicPage(source) {
  const sectionAnchors = (source.sectionAnchors ?? []).map((section) => ({
    index: section.index,
    toplevel: section.toplevel,
    anchor: section.anchor,
    line: section.line,
  }));
  const sectionLines = sectionAnchors.map((section) => section.line);
  const hash = hashStableJson({
    site: source.site.key,
    title: source.page.title,
    revisionId: source.page.revisionId,
    revisionSha1: source.page.revisionSha1,
    sectionLines,
  });
  return {
    siteKey: source.site.key,
    pageTitle: source.page.title,
    pageId: source.page.pageId,
    revisionId: source.page.revisionId,
    revisionSha1: source.page.revisionSha1,
    revisionTimestamp: source.page.revisionTimestamp,
    canonicalUrl: source.page.canonicalUrl,
    oldidUrl: source.page.oldidUrl,
    pageLength: source.page.length ?? null,
    sectionAnchors,
    structuralSummaryHash: hash,
  };
}

export function buildMediaWikiTopicRegistryEntry(source, options = {}) {
  if (!options.topic) throw new Error('buildMediaWikiTopicRegistryEntry requires options.topic');
  const summary = summarizeMediaWikiTopicPage(source);
  return {
    sourceId: source.sourceId,
    kind: 'documentation_mediawiki_page',
    label: options.label ?? `${source.site.sitename}: ${source.page.title}`,
    acquiredAt: options.acquiredAt ?? new Date().toISOString(),
    publisher: source.site.sitename,
    documentType: 'mediawiki_page',
    topic: options.topic,
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
      structuralSummarySha256: summary.structuralSummaryHash,
      copiedContent: 'metadata_and_section_anchors_only',
    },
    scope: {
      gameVersions: options.gameVersions ?? [],
      dlc: options.allDlcActive ? ['ALL_ACTIVE_ASSUMPTION'] : (options.dlc ?? []),
      mods: options.mods ?? [],
      allDlcActive: Boolean(options.allDlcActive),
    },
    licensing: {
      rights: source.site.rights,
      redistribution: 'Do not copy whole wiki pages into this repository; store citations, page metadata, and short section anchor titles only.',
    },
    requestPolicy: source.requestPolicy,
    extracted: {
      sectionAnchorCount: summary.sectionAnchors.length,
      sectionAnchors: summary.sectionAnchors,
      pageLength: summary.pageLength,
    },
    visibility: {
      classification: 'external',
      rawArtifactCommitted: false,
      rationale: `External CK3 wiki documentation source for the '${options.topic}' mechanics topic. Durable knowledge should cite this page/revision; only metadata + section anchor titles are stored.`,
    },
    notes: options.notes ?? [],
  };
}

export function selectMediaWikiTopicGroup(title) {
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
  for (const [group, titles] of Object.entries(groups)) {
    if (titles.includes(title)) return group;
  }
  return null;
}

function splitWikitextSections(wikitext) {
  const lines = String(wikitext).replace(/\r\n/g, '\n').split('\n');
  const sections = [{ title: 'Overview', level: 1, body: [] }];
  for (const line of lines) {
    const heading = line.match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
    if (heading) {
      sections.push({
        title: cleanInlineWikitext(heading[2]).trim() || 'Untitled',
        level: heading[1].length,
        body: [],
      });
      continue;
    }
    sections[sections.length - 1].body.push(line);
  }
  return sections.map((section) => ({
    ...section,
    body: section.body.join('\n'),
  }));
}

function extractNotesFromSection(body, maxNotes) {
  const normalized = stripBlockWikitext(body)
    .split('\n')
    .map((line) => cleanInlineWikitext(line).trim())
    .filter((line) => shouldKeepContentLine(line));
  const blocks = [];
  let paragraph = [];
  for (const line of normalized) {
    const bullet = line.match(/^[-*#;:]+\s*(.+)$/);
    if (bullet) {
      flushParagraph(blocks, paragraph);
      paragraph = [];
      blocks.push(bullet[1].trim());
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph(blocks, paragraph);
  return blocks
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter((block) => block.length >= 45)
    .filter((block, idx, all) => all.indexOf(block) === idx)
    .slice(0, maxNotes)
    .map((block) => truncateSentence(block, 420));
}

function flushParagraph(blocks, paragraph) {
  if (paragraph.length === 0) return;
  blocks.push(paragraph.join(' '));
}

function stripBlockWikitext(value) {
  let text = String(value);
  text = text.replace(/<!--[\s\S]*?-->/g, '\n');
  text = text.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '');
  text = text.replace(/<ref\b[^/]*\/>/gi, '');
  text = text.replace(/\{\|[\s\S]*?\|\}/g, '\n');
  text = text.replace(/\[\[(?:File|Image|Category):[^\]]+\]\]/gi, '\n');
  text = renderSimpleTemplates(text);
  text = removeBalanced(text, '{{', '}}');
  return text;
}

function renderSimpleTemplates(text) {
  let current = String(text);
  for (let pass = 0; pass < 6; pass++) {
    const next = current.replace(/\{\{([^{}]+)\}\}/g, (_match, body) => renderTemplate(body));
    if (next === current) break;
    current = next;
  }
  return current;
}

function renderTemplate(body) {
  const parts = String(body)
    .split('|')
    .map((part) => cleanInlineWikitext(part).trim())
    .filter(Boolean);
  if (parts.length === 0) return '';
  const name = parts[0].toLowerCase().replace(/[_\s]+/g, ' ');
  const args = parts.slice(1).filter((part) => !/^[a-z0-9 _-]+\s*=/.test(part));
  const ignored = new Set([
    'version',
    'sversion',
    'expansion',
    'main',
    'see also',
    'clear',
    'mechanics navbox',
  ]);
  if (ignored.has(name)) return '';
  if (name === 'icon' || name === 'iconify') return args[0] ?? '';
  if (name === 'green' || name === 'red' || name === 'yellow') return args[0] ?? '';
  if (name === 'ruby' || name === 'hover box' || name === 'tooltip') return args[0] ?? args[1] ?? '';
  if (name === 'plainlist' || name === 'unbulleted list') return args.join('; ');
  if (args.length === 0) return '';
  return args.find((arg) => /[a-zA-Z0-9]/.test(arg)) ?? '';
}

function cleanInlineWikitext(value) {
  let text = String(value);
  text = text.replace(/'''?/g, '');
  text = text.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2');
  text = text.replace(/\[\[([^\]]+)\]\]/g, '$1');
  text = text.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1');
  text = text.replace(/\[https?:\/\/[^\s\]]+\]/g, '');
  text = text.replace(/<[^>]+>/g, '');
  text = decodeBasicEntities(text);
  return text.replace(/\s+/g, ' ');
}

function shouldKeepContentLine(line) {
  if (!line) return false;
  if (/^(__TOC__|__NOTOC__)$/i.test(line)) return false;
  if (/^[-*#;:]*\s*$/.test(line)) return false;
  if (/^\s*[|!{}]/.test(line)) return false;
  if (/^Retrieved from /i.test(line)) return false;
  if (/^This article (has been verified|is timeless)/i.test(line)) return false;
  if (/^\w+\s*=\s*/.test(line)) return false;
  return true;
}

function removeBalanced(text, open, close) {
  let result = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith(open, i)) {
      depth++;
      i += open.length - 1;
      continue;
    }
    if (depth > 0 && text.startsWith(close, i)) {
      depth--;
      i += close.length - 1;
      continue;
    }
    if (depth === 0) result += text[i];
  }
  return result;
}

function decodeBasicEntities(value) {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function truncateSentence(value, limit) {
  if (value.length <= limit) return value;
  const clipped = value.slice(0, limit + 1);
  const sentenceEnd = Math.max(clipped.lastIndexOf('.'), clipped.lastIndexOf(';'), clipped.lastIndexOf(':'));
  if (sentenceEnd >= Math.floor(limit * 0.55)) {
    return clipped.slice(0, sentenceEnd + 1);
  }
  const space = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, space > 0 ? space : limit).trim()}...`;
}

const MECHANICS_LINK_ALIASES = [
  ['men-at-arms regiments', 'Men-at-Arms regiments', 'army', 'Men-at-Arms'],
  ['men-at-arms regiment', 'Men-at-Arms regiment', 'army', 'Men-at-Arms'],
  ['men-at-arms', 'Men-at-Arms', 'army', 'Men-at-Arms'],
  ['casus belli', 'Casus Belli', 'casus-belli'],
  ['great holy wars', 'Great Holy Wars', 'warfare'],
  ['holy wars', 'Holy Wars', 'warfare'],
  ['head of faith', 'Head of Faith', 'faith'],
  ['heads of faith', 'Heads of Faith', 'faith'],
  ['holy sites', 'Holy sites', 'holy-sites'],
  ['holy site', 'Holy site', 'holy-sites'],
  ['game rules', 'game rules', 'game-rules'],
  ['royal court', 'Royal Court', 'royal-court'],
  ['power sharing', 'Power sharing', 'power-sharing'],
  ['hired forces', 'Hired forces', 'hired-forces'],
  ['great projects', 'Great projects', 'great-projects'],
  ['interesting characters', 'Interesting characters', 'interesting-characters'],
  ['rally point', 'Rally Point', 'army'],
  ['rally points', 'Rally Points', 'army'],
  ['war score', 'War Score', 'warfare'],
  ['war contribution', 'War Contribution', 'warfare'],
  ['commander traits', 'Commander traits', 'traits'],
  ['commander trait', 'Commander trait', 'traits'],
  ['commander', 'Commander', 'army'],
  ['commanders', 'Commanders', 'army'],
  ['knights', 'Knights', 'knight'],
  ['knight', 'Knight', 'knight'],
  ['accolades', 'Accolades', 'knight', 'Accolades'],
  ['accolade', 'Accolade', 'knight', 'Accolades'],
  ['armies', 'armies', 'army'],
  ['army', 'army', 'army'],
  ['warfare', 'Warfare', 'warfare'],
  ['war', 'war', 'warfare'],
  ['wars', 'wars', 'warfare'],
  ['alliance', 'Alliance', 'alliance'],
  ['alliances', 'Alliances', 'alliance'],
  ['duels', 'Duels', 'duel'],
  ['duel', 'Duel', 'duel'],
  ['travel options', 'Travel options', 'travel', 'Travel options'],
  ['traveling', 'Traveling', 'travel'],
  ['travel', 'Travel', 'travel'],
  ['adventurers', 'Adventurers', 'adventurer'],
  ['adventurer', 'Adventurer', 'adventurer'],
  ['contracts', 'Contracts', 'adventurer', 'Contracts'],
  ['contract', 'Contract', 'adventurer', 'Contracts'],
  ['camp purpose', 'camp purpose', 'adventurer', 'Camp purpose'],
  ['camp temperament', 'camp temperament', 'adventurer', 'Camp temperament'],
  ['provisions', 'Provisions', 'adventurer'],
  ['domicile', 'Domicile', 'domicile'],
  ['court grandeur', 'Court grandeur', 'royal-court'],
  ['court', 'Court', 'court'],
  ['council', 'Council', 'council'],
  ['councillor', 'Councillor', 'council'],
  ['councillors', 'Councillors', 'council'],
  ['governments', 'Governments', 'government'],
  ['government', 'Government', 'government'],
  ['laws', 'Laws', 'laws'],
  ['law', 'Law', 'laws'],
  ['prisoners', 'Prisoners', 'prisoners'],
  ['prisoner', 'Prisoner', 'prisoners'],
  ['activities', 'Activities', 'activity'],
  ['activity', 'Activity', 'activity'],
  ['decisions', 'Decisions', 'decisions'],
  ['decision', 'Decision', 'decisions'],
  ['titles', 'Titles', 'titles'],
  ['title', 'Title', 'titles'],
  ['subjects', 'Subjects', 'subjects'],
  ['subject', 'Subject', 'subjects'],
  ['counties', 'counties', 'county'],
  ['county', 'county', 'county'],
  ['baronies', 'baronies', 'barony'],
  ['barony', 'barony', 'barony'],
  ['holdings', 'holdings', 'barony'],
  ['holding', 'holding', 'barony'],
  ['buildings', 'Buildings', 'building'],
  ['building', 'Building', 'building'],
  ['dynasty legacies', 'Dynasty Legacies', 'dynasty'],
  ['dynasty legacy', 'Dynasty Legacy', 'dynasty'],
  ['dynasties', 'Dynasties', 'dynasty'],
  ['dynasty', 'Dynasty', 'dynasty'],
  ['culture head', 'Culture Head', 'culture', 'Culture head'],
  ['cultural acceptance', 'Cultural Acceptance', 'culture', 'Cultural acceptance'],
  ['hybrid cultures', 'Hybrid cultures', 'culture', 'Hybrid cultures'],
  ['hybrid culture', 'Hybrid culture', 'culture', 'Hybrid cultures'],
  ['divergent cultures', 'Divergent cultures', 'culture', 'Divergent cultures'],
  ['divergent culture', 'Divergent culture', 'culture', 'Divergent cultures'],
  ['traditions', 'Traditions', 'traditions'],
  ['tradition', 'Tradition', 'traditions'],
  ['innovations', 'Innovations', 'innovation'],
  ['innovation', 'Innovation', 'innovation'],
  ['cultures', 'cultures', 'culture'],
  ['culture', 'Culture', 'culture'],
  ['faith hostility', 'Faith Hostility', 'characters', 'Faith Hostility'],
  ['faiths', 'Faiths', 'faith'],
  ['faith', 'Faith', 'faith'],
  ['doctrines', 'Doctrines', 'doctrines'],
  ['doctrine', 'Doctrine', 'doctrines'],
  ['tenets', 'Tenets', 'tenets'],
  ['tenet', 'Tenet', 'tenets'],
  ['traits', 'Traits', 'traits'],
  ['trait', 'Trait', 'traits'],
  ['attributes', 'Attributes', 'attributes'],
  ['attribute', 'Attribute', 'attributes'],
  ['prowess', 'Prowess', 'attributes'],
  ['martial', 'Martial', 'attributes'],
  ['diplomacy', 'Diplomacy', 'attributes'],
  ['stewardship', 'Stewardship', 'attributes'],
  ['intrigue', 'Intrigue', 'attributes'],
  ['learning', 'Learning', 'attributes'],
  ['resources', 'Resources', 'resources'],
  ['prestige', 'Prestige', 'resources'],
  ['piety', 'Piety', 'resources'],
  ['gold', 'Gold', 'resources'],
  ['stress', 'Stress', 'resources'],
  ['legitimacy', 'Legitimacy', 'resources'],
  ['renown', 'Renown', 'resources'],
  ['treasury', 'Treasury', 'resources'],
  ['herd', 'Herd', 'resources'],
  ['schemes', 'Schemes', 'schemes'],
  ['scheme', 'Scheme', 'schemes'],
  ['hooks', 'Hooks', 'hooks'],
  ['hook', 'Hook', 'hooks'],
  ['modifiers', 'Modifiers', 'modifiers'],
  ['modifier', 'Modifier', 'modifiers'],
  ['artifacts', 'Artifacts', 'artifacts'],
  ['artifact', 'Artifact', 'artifacts'],
  ['lifestyles', 'Lifestyles', 'lifestyle'],
  ['lifestyle', 'Lifestyle', 'lifestyle'],
].map(([term, label, slugValue, anchor]) => ({
  term,
  label,
  slug: slugValue,
  anchor,
  target: `mechanics-content/${slugValue}${anchor ? `#${slug(anchor)}` : ''}`,
  pattern: new RegExp(`(^|[^A-Za-z0-9_\\]])(${escapeRegExp(term)})(?=$|[^A-Za-z0-9_])`, 'gi'),
}));

function replaceFirstUnlinked(text, alias) {
  let match;
  alias.pattern.lastIndex = 0;
  while ((match = alias.pattern.exec(text)) !== null) {
    const start = match.index + match[1].length;
    const end = start + match[2].length;
    if (isInsideMarkdownLink(text, start) || isInsideCodeSpan(text, start)) {
      alias.pattern.lastIndex = end;
      continue;
    }
    const linked = `[[${alias.target}|${match[2]}]]`;
    return `${text.slice(0, start)}${linked}${text.slice(end)}`;
  }
  return text;
}

function isInsideMarkdownLink(text, index) {
  const open = text.lastIndexOf('[[', index);
  const close = text.lastIndexOf(']]', index);
  return open > close;
}

function isInsideCodeSpan(text, index) {
  const before = text.slice(0, index);
  return (before.match(/`/g) ?? []).length % 2 === 1;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent,
          'Api-User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`MediaWiki request timed out after 30000ms: ${url.href}`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
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
