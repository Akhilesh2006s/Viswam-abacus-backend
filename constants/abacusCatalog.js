/** VM product line: Volume 1–6 + Fusion (not class 1–10). */
export const DEFAULT_ABACUS_VM_VOLUMES = [
  'Volume 1',
  'Volume 2',
  'Volume 3',
  'Volume 4',
  'Volume 5',
  'Volume 6',
  'Fusion',
];

/** Default Abacus category → level mapping (Super Admin can extend via API). */
export const DEFAULT_ABACUS_CATEGORIES = [
  {
    name: 'Star Juniors',
    levels: ['SJ1', 'SJ2', 'SJ3', 'SJ4'],
  },
  {
    name: 'Juniors',
    levels: ['J1', 'J2', 'J3', 'J4'],
  },
  {
    name: 'Seniors',
    levels: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'],
  },
  {
    name: 'Volumes',
    levels: [...DEFAULT_ABACUS_VM_VOLUMES],
  },
];

/** Bare login id (no domain). Strips legacy `@abacus.com` suffixes. */
export function normalizeAbacusLogin(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  const at = s.indexOf('@');
  if (at < 0) return s;
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  if (domain === 'abacus.com') return local;
  return local || s;
}

/** @deprecated Use normalizeAbacusLogin */
export const normalizeAbacusEmail = normalizeAbacusLogin;

export function legacyAbacusEmail(login) {
  const id = normalizeAbacusLogin(login);
  return id ? `${id}@abacus.com` : '';
}

export function isValidAbacusLogin(login) {
  const u = normalizeAbacusLogin(login);
  return /^[a-z0-9]{4,40}$/.test(u);
}

/** @deprecated Use isValidAbacusLogin */
export function isValidAbacusEmail(login) {
  return isValidAbacusLogin(login);
}

export function slugFromName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

const INVALID_CATALOG_LEVELS = new Set(['l1']);

/** Drop mistaken levels (e.g. category names or legacy L1) from catalog rows. */
export function sanitizeCatalogCategories(categories = []) {
  const categoryNames = new Set(
    categories
      .map((c) => String(c.name || '').trim().toLowerCase())
      .filter(Boolean),
  );
  return categories.map((c) => ({
    name: c.name,
    levels: (c.levels || []).filter((level) => {
      const norm = String(level || '').trim();
      if (!norm) return false;
      const lower = norm.toLowerCase();
      if (categoryNames.has(lower)) return false;
      if (INVALID_CATALOG_LEVELS.has(lower)) return false;
      return true;
    }),
  }));
}

export function isInvalidCatalogLevel(level, categoryNames = new Set()) {
  const norm = String(level || '').trim();
  if (!norm) return true;
  const lower = norm.toLowerCase();
  return categoryNames.has(lower) || INVALID_CATALOG_LEVELS.has(lower);
}

export function findLevelsForCategory(categories, categoryName) {
  const cat = categories.find(
    (c) => c.name.toLowerCase() === String(categoryName || '').trim().toLowerCase(),
  );
  return cat?.levels || [];
}

export function validateCategoryLevel(categories, category, level) {
  const levels = findLevelsForCategory(categories, category);
  if (!levels.length) {
    return { ok: false, message: `Unknown category "${category}"` };
  }
  const levelNorm = String(level || '').trim();
  const match = levels.find((l) => l.toLowerCase() === levelNorm.toLowerCase());
  if (!match) {
    return { ok: false, message: `Level "${level}" is not valid for category "${category}"` };
  }
  return { ok: true, category: categories.find((c) => c.name.toLowerCase() === category.toLowerCase())?.name || category, level: match };
}

/** Flat ordered list for rank-based access (legacy practice UI). */
export function buildLevelRankIndex(categories = DEFAULT_ABACUS_CATEGORIES) {
  const index = [];
  let rank = 0;
  for (const cat of categories) {
    for (const level of cat.levels || []) {
      rank += 1;
      index.push({
        category: cat.name,
        level,
        rank,
        label: level,
      });
    }
  }
  return index;
}

export function getGlobalRank(category, level, categories = DEFAULT_ABACUS_CATEGORIES) {
  const idx = buildLevelRankIndex(categories);
  const row = idx.find(
    (r) => r.category.toLowerCase() === String(category).toLowerCase() && r.level.toLowerCase() === String(level).toLowerCase(),
  );
  return row?.rank || 0;
}

export function catalogForUserRank(userRank, categories) {
  const idx = buildLevelRankIndex(categories);
  const allowed = idx.filter((r) => r.rank <= userRank);
  const byCat = new Map();
  for (const row of allowed) {
    if (!byCat.has(row.category)) byCat.set(row.category, new Map());
    const levelMap = byCat.get(row.category);
    const key = String(row.level || '').toLowerCase();
    if (!key || levelMap.has(key)) continue;
    levelMap.set(key, {
      level_name: row.level,
      Dropdown_names: row.label,
      rank: row.rank,
    });
  }
  return [...byCat.entries()].map(([category, levelMap]) => ({
    category,
    levels: [...levelMap.values()],
  }));
}

/** True when person's assigned level is at or below the ceiling (same or lower global rank). */
export function isWithinRankCeiling(category, level, ceilingCategory, ceilingLevel, categories) {
  const personRank = getGlobalRank(category, level, categories);
  const ceilingRank = getGlobalRank(ceilingCategory, ceilingLevel, categories);
  if (!ceilingRank) return false;
  if (!personRank) return false;
  return personRank <= ceilingRank;
}

/** Human-readable list of all categories/levels unlocked up to userRank. */
export function formatAllowedAccessSummary(userRank, categories = DEFAULT_ABACUS_CATEGORIES) {
  const allowed = catalogForUserRank(userRank, categories);
  if (!allowed.length) return '';
  return allowed
    .map((cat) => {
      const levels = (cat.levels || []).map((l) => l.level_name);
      if (!levels.length) return cat.category;
      const first = levels[0];
      const last = levels[levels.length - 1];
      const range = first === last ? first : `${first}–${last}`;
      return `${cat.category} (${range})`;
    })
    .join(', ');
}
