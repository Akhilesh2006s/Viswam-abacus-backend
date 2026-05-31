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
];

export const ABACUS_EMAIL_DOMAIN = 'abacus.com';

export function normalizeAbacusEmail(raw) {
  const email = String(raw || '')
    .trim()
    .toLowerCase();
  if (!email) return '';
  if (email.includes('@')) return email;
  return `${email}@${ABACUS_EMAIL_DOMAIN}`;
}

export function isValidAbacusEmail(email) {
  const normalized = normalizeAbacusEmail(email);
  return /^[^\s@]+@abacus\.com$/.test(normalized);
}

export function slugFromName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
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
    if (!byCat.has(row.category)) byCat.set(row.category, []);
    byCat.get(row.category).push({ level_name: row.level, Dropdown_names: row.label, rank: row.rank });
  }
  return [...byCat.entries()].map(([category, levels]) => ({ category, levels }));
}
