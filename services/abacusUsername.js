import AbacusStudent from '../models/AbacusStudent.js';
import AbacusTeacher from '../models/AbacusTeacher.js';
import { legacyAbacusEmail, normalizeAbacusLogin } from '../constants/abacusCatalog.js';

/** First 4 letters of school name (uppercase, letters only). */
export function getSchoolLetterPrefix(school) {
  const name = String(school?.name || '').trim();
  const code = String(school?.schoolCode || '').trim();
  const fromName = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (fromName.length >= 4) return fromName.slice(0, 4);
  const fromCode = code.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (fromCode.length >= 4) return fromCode.slice(0, 4);
  return `${fromName}${fromCode}`.slice(0, 4).padEnd(4, 'X');
}

/** Student: {SCHOOL4}ABS + 5 digits — e.g. DEMOABS00001 */
export function getStudentUsernameBase(school) {
  return `${getSchoolLetterPrefix(school)}ABS`;
}

/** Teacher: {SCHOOL4}ABS + tech + 3 digits — e.g. DEMOABStech001 */
export function getTeacherUsernameBase(school) {
  return `${getSchoolLetterPrefix(school)}ABStech`;
}

/** Stored login id for the email field (bare username, lowercase). */
export function usernameToEmail(username) {
  return normalizeAbacusLogin(username);
}

export function emailToUsername(email) {
  const login = normalizeAbacusLogin(email);
  return login ? login.toUpperCase() : '';
}

export function abacusLoginLookupFilter(loginId) {
  const login = normalizeAbacusLogin(loginId);
  if (!login) return null;
  const legacy = legacyAbacusEmail(login);
  const escaped = login.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const caseInsensitive = { $regex: new RegExp(`^${escaped}$`, 'i') };
  return {
    $or: [
      { email: login },
      { email: legacy },
      { email: caseInsensitive },
      { username: caseInsensitive },
    ],
  };
}

const ACTIVE_ONLY = { isActive: { $ne: false } };

/** Free unique email/username slots when an Abacus account is deactivated. */
export function releaseAbacusLoginIdentity(doc) {
  const stamp = Date.now().toString(36);
  const login = normalizeAbacusLogin(doc.email) || 'user';
  const display = String(doc.username || emailToUsername(login) || login).trim() || login;
  doc.email = `__released.${stamp}.${login}`.toLowerCase().slice(0, 200);
  doc.username = `__released.${stamp}.${display}`.slice(0, 200);
}

export function isReleasedAbacusLogin(email) {
  return String(email || '').startsWith('__released.');
}

function prefixRegexForBase(base) {
  const escaped = String(base || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}`, 'i');
}

async function findActiveTeacherByLogin(loginId) {
  const lookup = abacusLoginLookupFilter(loginId);
  if (!lookup) return null;
  return AbacusTeacher.findOne({ ...lookup, ...ACTIVE_ONLY }).lean();
}

async function findActiveStudentByLogin(loginId) {
  const lookup = abacusLoginLookupFilter(loginId);
  if (!lookup) return null;
  return AbacusStudent.findOne({ ...lookup, ...ACTIVE_ONLY }).lean();
}

export async function assertAbacusLoginAvailable(loginId, { excludeTeacherId, excludeStudentId } = {}) {
  const lookup = abacusLoginLookupFilter(loginId);
  if (!lookup) throw new Error('Invalid username format');

  const teacherFilter = { ...lookup, ...ACTIVE_ONLY };
  const studentFilter = { ...lookup, ...ACTIVE_ONLY };
  if (excludeTeacherId) teacherFilter._id = { $ne: excludeTeacherId };
  if (excludeStudentId) studentFilter._id = { $ne: excludeStudentId };

  const existingTeacher = await AbacusTeacher.findOne(teacherFilter).lean();
  if (existingTeacher) throw new Error('Username is already in use');

  const existingStudent = await AbacusStudent.findOne(studentFilter).lean();
  if (existingStudent) throw new Error('Username is already in use');
}

/** Repair legacy soft-deletes that still hold unique login slots in MongoDB. */
export async function repairReleasedInactiveAbacusLogins() {
  const inactiveTeachers = await AbacusTeacher.find({
    isActive: false,
    email: { $not: /^__released\./ },
  });
  for (const row of inactiveTeachers) {
    releaseAbacusLoginIdentity(row);
    await row.save();
  }

  const inactiveStudents = await AbacusStudent.find({
    isActive: false,
    email: { $not: /^__released\./ },
  });
  for (const row of inactiveStudents) {
    releaseAbacusLoginIdentity(row);
    await row.save();
  }

  return {
    teachers: inactiveTeachers.length,
    students: inactiveStudents.length,
  };
}

/** Normalize stored login fields after lookup (email bare lowercase, username display form). */
export function normalizeAbacusIdentityFields(email, username) {
  const normalizedEmail = normalizeAbacusLogin(email || username);
  const displayUsername =
    String(username || '').trim() || emailToUsername(normalizedEmail) || normalizedEmail;
  return {
    email: normalizedEmail,
    username: emailToUsername(normalizedEmail) || displayUsername,
  };
}

function parseStudentSuffix(base, value) {
  const re = new RegExp(`^${base}(\\d{5})$`, 'i');
  const m = String(value || '').trim().match(re);
  return m ? parseInt(m[1], 10) : 0;
}

function parseTeacherSuffix(base, value) {
  const re = new RegExp(`^${base}(\\d{3})$`, 'i');
  const m = String(value || '').trim().match(re);
  return m ? parseInt(m[1], 10) : 0;
}

async function nextAvailableStudentUsername(school) {
  const base = getStudentUsernameBase(school);
  const prefix = prefixRegexForBase(base);
  const rows = await AbacusStudent.find({
    ...ACTIVE_ONLY,
    $or: [{ username: prefix }, { email: prefix }],
  })
    .select('username email')
    .lean();

  let max = 0;
  for (const row of rows) {
    const id = row.username || emailToUsername(row.email);
    max = Math.max(max, parseStudentSuffix(base, id));
  }

  for (let next = max + 1; next <= max + 99999; next++) {
    const username = `${base}${String(next).padStart(5, '0')}`;
    const teacher = await findActiveTeacherByLogin(username);
    const student = await findActiveStudentByLogin(username);
    if (!teacher && !student) return username;
  }
  throw new Error('Student username limit reached');
}

async function nextAvailableTeacherUsername(school) {
  const base = getTeacherUsernameBase(school);
  const prefix = prefixRegexForBase(base);
  const rows = await AbacusTeacher.find({
    ...ACTIVE_ONLY,
    $or: [{ username: prefix }, { email: prefix }],
  })
    .select('username email')
    .lean();

  let max = 0;
  for (const row of rows) {
    const id = row.username || emailToUsername(row.email);
    max = Math.max(max, parseTeacherSuffix(base, id));
  }

  for (let next = max + 1; next <= max + 999; next++) {
    const username = `${base}${String(next).padStart(3, '0')}`;
    const teacher = await findActiveTeacherByLogin(username);
    const student = await findActiveStudentByLogin(username);
    if (!teacher && !student) return username;
  }
  throw new Error('Teacher username limit reached');
}

export async function previewStudentUsername(school) {
  return nextAvailableStudentUsername(school);
}

export async function previewTeacherUsername(school) {
  return nextAvailableTeacherUsername(school);
}

export async function allocateStudentUsername(school) {
  return nextAvailableStudentUsername(school);
}

export async function allocateTeacherUsername(school) {
  return nextAvailableTeacherUsername(school);
}
