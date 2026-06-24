import bcrypt from 'bcryptjs';
import AbacusSchool from '../models/AbacusSchool.js';
import AbacusTeacher from '../models/AbacusTeacher.js';
import AbacusStudent from '../models/AbacusStudent.js';
import AbacusCatalog from '../models/AbacusCatalog.js';
import {
  DEFAULT_ABACUS_CATEGORIES,
  formatAllowedAccessSummary,
  getGlobalRank,
  isInvalidCatalogLevel,
  isValidAbacusLogin,
  isWithinRankCeiling,
  normalizeAbacusLogin,
  sanitizeCatalogCategories,
  validateCategoryLevel,
} from '../constants/abacusCatalog.js';
import {
  allocateStudentUsername,
  allocateTeacherUsername,
  assertAbacusLoginAvailable,
  emailToUsername,
  normalizeAbacusIdentityFields,
  previewStudentUsername,
  previewTeacherUsername,
  releaseAbacusLoginIdentity,
  usernameToEmail,
} from './abacusUsername.js';

const CATALOG_ID = 'default';

function applyCatalogSanitize(doc) {
  const before = JSON.stringify(
    doc.categories.map((c) => ({ name: c.name, levels: [...(c.levels || [])] })),
  );
  const sanitized = sanitizeCatalogCategories(
    doc.categories.map((c) => ({ name: c.name, levels: [...(c.levels || [])] })),
  );
  const after = JSON.stringify(sanitized);
  if (before === after) return false;
  doc.categories = sanitized;
  return true;
}

export async function ensureAbacusCatalog() {
  let doc = await AbacusCatalog.findById(CATALOG_ID);
  if (!doc) {
    doc = await AbacusCatalog.create({
      _id: CATALOG_ID,
      categories: DEFAULT_ABACUS_CATEGORIES.map((c) => ({
        name: c.name,
        levels: [...c.levels],
      })),
    });
  } else if (!doc.categories?.length) {
    doc.categories = DEFAULT_ABACUS_CATEGORIES.map((c) => ({
      name: c.name,
      levels: [...c.levels],
    }));
    await doc.save();
  } else {
    const vmPreset = DEFAULT_ABACUS_CATEGORIES.find((c) => c.name === 'Volumes');
    const hasVolumes = doc.categories.some(
      (c) => String(c.name || '').trim().toLowerCase() === 'volumes',
    );
    if (vmPreset && !hasVolumes) {
      doc.categories.push({
        name: vmPreset.name,
        levels: [...vmPreset.levels],
      });
      await doc.save();
    }
  }
  if (applyCatalogSanitize(doc)) {
    await doc.save();
  }
  return doc;
}

export async function getCatalogCategories() {
  const doc = await ensureAbacusCatalog();
  return sanitizeCatalogCategories(
    doc.categories.map((c) => ({
      name: c.name,
      levels: [...(c.levels || [])],
    })),
  );
}

export async function addCatalogCategory(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Category name is required');
  const doc = await ensureAbacusCatalog();
  if (doc.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('Category already exists');
  }
  doc.categories.push({ name: trimmed, levels: [] });
  await doc.save();
  return getCatalogCategories();
}

export async function addCatalogLevel(categoryName, levelName) {
  const catName = String(categoryName || '').trim();
  const level = String(levelName || '').trim();
  if (!catName || !level) throw new Error('Category and level are required');
  const doc = await ensureAbacusCatalog();
  const cat = doc.categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
  if (!cat) throw new Error('Category not found');
  const categoryNames = new Set(doc.categories.map((c) => c.name.toLowerCase()));
  if (isInvalidCatalogLevel(level, categoryNames)) {
    throw new Error('Invalid level name');
  }
  if (cat.levels.some((l) => l.toLowerCase() === level.toLowerCase())) {
    throw new Error('Level already exists in this category');
  }
  cat.levels.push(level);
  await doc.save();
  return getCatalogCategories();
}

function formatSchool(row) {
  return {
    id: row._id.toString(),
    name: row.name,
    schoolCode: row.schoolCode,
    contactPerson: row.contactPerson || '',
    phone: row.phone || '',
    place: row.place || '',
    pin: row.pin || '',
    schoolDetails: row.schoolDetails || {},
    notes: row.notes || '',
    category: row.category || '',
    level: row.level || '',
    isActive: row.isActive !== false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function formatTeacher(row) {
  const username = row.username || emailToUsername(row.email);
  const login = normalizeAbacusLogin(row.email);
  return {
    id: row._id.toString(),
    fullName: row.fullName,
    username,
    email: login,
    phone: row.phone || '',
    category: row.category,
    level: row.level,
    schoolId: row.schoolId?.toString?.() || String(row.schoolId),
    isActive: row.isActive !== false,
    createdAt: row.createdAt,
  };
}

function formatStudent(row, teacherMap = {}) {
  const teacherId = row.teacherId?.toString?.() || (row.teacherId ? String(row.teacherId) : null);
  const teacher = teacherId ? teacherMap[teacherId] : null;
  const username = row.username || emailToUsername(row.email);
  const login = normalizeAbacusLogin(row.email);
  return {
    id: row._id.toString(),
    fullName: row.fullName,
    username,
    email: login,
    className: row.className || '',
    category: row.category,
    level: row.level,
    schoolId: row.schoolId?.toString?.() || String(row.schoolId),
    teacherId: teacherId || null,
    teacherName: teacher?.fullName || '',
    isActive: row.isActive !== false,
    createdAt: row.createdAt,
  };
}

export async function listSchools() {
  const schools = await AbacusSchool.find({ isActive: { $ne: false } })
    .sort({ name: 1 })
    .lean();
  const counts = await Promise.all(
    schools.map(async (s) => {
      const [teachers, students] = await Promise.all([
        AbacusTeacher.countDocuments({ schoolId: s._id, isActive: { $ne: false } }),
        AbacusStudent.countDocuments({ schoolId: s._id, isActive: { $ne: false } }),
      ]);
      return { teachers, students };
    }),
  );
  return schools.map((s, i) => ({
    ...formatSchool(s),
    stats: counts[i],
    loginReady: (counts[i]?.teachers || 0) > 0,
  }));
}

export async function getSchoolById(id) {
  const school = await AbacusSchool.findById(id).lean();
  if (!school) throw new Error('School not found');
  const [teachers, students] = await Promise.all([
    AbacusTeacher.countDocuments({ schoolId: school._id, isActive: { $ne: false } }),
    AbacusStudent.countDocuments({ schoolId: school._id, isActive: { $ne: false } }),
  ]);
  return { ...formatSchool(school), stats: { teachers, students } };
}

async function resolveSchoolTeacherIdentity(school, body) {
  const loginRaw = String(body.username || body.email || '').trim();
  if (loginRaw) {
    const identity = normalizeAbacusIdentityFields(loginRaw, body.username || loginRaw);
    if (!isValidAbacusLogin(identity.email)) throw new Error('Invalid username format');
    await assertAbacusLoginAvailable(identity.email);
    return identity;
  }

  const username = await allocateTeacherUsername(school);
  const email = usernameToEmail(username);
  return { username, email };
}

export async function previewLoginUsername({ name, schoolCode, role }) {
  const stub = {
    name: String(name || '').trim(),
    schoolCode: String(schoolCode || '').trim().toUpperCase(),
  };
  if (!stub.name) throw new Error('School name is required');
  if (!stub.schoolCode) throw new Error('School code is required');
  const kind = String(role || '').trim().toLowerCase();
  if (kind === 'teacher') return previewTeacherUsername(stub);
  if (kind === 'student') return previewStudentUsername(stub);
  throw new Error('role must be student or teacher');
}

export async function createSchool(body) {
  const name = String(body.name || body.schoolName || '').trim();
  if (!name) throw new Error('School name is required');

  const schoolCode = String(body.schoolCode || '').trim().toUpperCase();
  if (!schoolCode) throw new Error('School code is required');

  const password = String(body.password || '').trim();
  if (!password || password.length < 6) {
    throw new Error('Password is required (min 6 characters)');
  }

  const categories = await getCatalogCategories();
  const catCheck = validateCategoryLevel(
    categories,
    String(body.category || '').trim(),
    String(body.level || '').trim(),
  );
  if (!catCheck.ok) throw new Error(catCheck.message);

  const existing = await AbacusSchool.findOne({ schoolCode });
  if (existing) throw new Error('School code already exists');

  const school = await AbacusSchool.create({
    name,
    schoolCode,
    category: catCheck.category,
    level: catCheck.level,
    contactPerson: String(body.contactPerson || '').trim(),
    phone: String(body.phone || '').trim(),
    place: String(body.place || '').trim(),
    pin: String(body.pin || '').trim(),
    notes: String(body.notes || '').trim(),
    schoolDetails: body.schoolDetails || {},
    isActive: true,
  });

  let teacherIdentity;
  let createdTeacherId = null;
  try {
    teacherIdentity = await resolveSchoolTeacherIdentity(school, body);
    const hash = await bcrypt.hash(password, 12);
    const teacher = await AbacusTeacher.create({
      fullName: name,
      username: teacherIdentity.username,
      email: teacherIdentity.email,
      password: hash,
      phone: '',
      category: catCheck.category,
      level: catCheck.level,
      schoolId: school._id,
      isActive: true,
    });
    createdTeacherId = teacher._id;
  } catch (err) {
    await AbacusSchool.findByIdAndDelete(school._id);
    if (createdTeacherId) await AbacusTeacher.findByIdAndDelete(createdTeacherId);
    throw err;
  }

  return {
    ...formatSchool(school.toObject()),
    stats: { teachers: 1, students: 0 },
    teacherLogin: {
      username: emailToUsername(teacherIdentity.email) || teacherIdentity.username,
      email: teacherIdentity.email,
    },
  };
}

export async function updateSchool(id, body) {
  const school = await AbacusSchool.findById(id);
  if (!school) throw new Error('School not found');

  if (body.name !== undefined) school.name = String(body.name).trim();
  if (body.contactPerson !== undefined) school.contactPerson = String(body.contactPerson).trim();
  if (body.phone !== undefined) school.phone = String(body.phone).trim();
  if (body.place !== undefined) school.place = String(body.place).trim();
  if (body.pin !== undefined) school.pin = String(body.pin).trim();
  if (body.notes !== undefined) school.notes = String(body.notes).trim();
  if (body.category !== undefined) school.category = String(body.category).trim();
  if (body.level !== undefined) school.level = String(body.level).trim();
  if (body.schoolDetails !== undefined) {
    school.schoolDetails = { ...(school.schoolDetails?.toObject?.() || school.schoolDetails || {}), ...body.schoolDetails };
  }
  await school.save();
  return formatSchool(school.toObject());
}

export async function deleteSchool(id) {
  const school = await AbacusSchool.findById(id);
  if (!school) throw new Error('School not found');
  school.isActive = false;
  await school.save();

  const teachers = await AbacusTeacher.find({ schoolId: id, isActive: { $ne: false } });
  for (const teacher of teachers) {
    teacher.isActive = false;
    releaseAbacusLoginIdentity(teacher);
    await teacher.save();
  }

  const students = await AbacusStudent.find({ schoolId: id, isActive: { $ne: false } });
  for (const student of students) {
    student.isActive = false;
    releaseAbacusLoginIdentity(student);
    await student.save();
  }

  return { success: true };
}

async function assertSchoolExists(schoolId) {
  const school = await AbacusSchool.findById(schoolId);
  if (!school || school.isActive === false) throw new Error('School not found');
  return school;
}

async function validatePersonFields(body, categories, { requirePassword = true, isUpdate = false } = {}) {
  const fullName = String(body.fullName || body.name || '').trim();
  const password = String(body.password || '').trim();
  const category = String(body.category || '').trim();
  const level = String(body.level || '').trim();

  if (!fullName) throw new Error('Name is required');

  let email = '';
  if (isUpdate) {
    const rawLogin = String(body.email || body.username || '').trim();
    if (rawLogin) {
      email = normalizeAbacusLogin(rawLogin);
      if (!isValidAbacusLogin(email)) {
        throw new Error('Invalid username format');
      }
    }
  } else {
    const rawEmail = String(body.email || body.username || '').trim();
    if (rawEmail) {
      email = normalizeAbacusLogin(rawEmail);
      if (!isValidAbacusLogin(email)) {
        throw new Error('Invalid username format');
      }
    }
  }

  if (requirePassword) {
    if (!password || password.length < 6) throw new Error('Password is required (min 6 characters)');
  } else if (password && password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const catCheck = validateCategoryLevel(categories, category, level);
  if (!catCheck.ok) throw new Error(catCheck.message);

  const phoneRaw = String(body.phone || '').trim();
  let phone = '';
  if (phoneRaw) {
    const digits = phoneRaw.replace(/\D/g, '');
    const normalized =
      digits.length === 12 && digits.startsWith('91')
        ? digits.slice(2)
        : digits.length === 11 && digits.startsWith('0')
          ? digits.slice(1)
          : digits;
    if (normalized.length !== 10) {
      throw new Error('Phone must be exactly 10 digits');
    }
    phone = normalized;
  }

  return {
    fullName,
    email,
    password,
    category: catCheck.category,
    level: catCheck.level,
    phone,
    className: String(body.className || body.class || '').trim(),
  };
}

export async function suggestNextUsername(schoolId, role) {
  const school = await assertSchoolExists(schoolId);
  if (role === 'teacher') return previewTeacherUsername(school);
  if (role === 'student') return previewStudentUsername(school);
  throw new Error('role must be student or teacher');
}

export async function listTeachers(schoolId) {
  await assertSchoolExists(schoolId);
  const rows = await AbacusTeacher.find({ schoolId, isActive: { $ne: false } })
    .sort({ fullName: 1 })
    .lean();
  return rows.map(formatTeacher);
}

async function resolveNewTeacherIdentity(school, fields, body) {
  if (fields.email) {
    return normalizeAbacusIdentityFields(fields.email, body.username || body.email || fields.email);
  }
  const username = await allocateTeacherUsername(school);
  return { username, email: usernameToEmail(username) };
}

async function resolveNewStudentIdentity(school, fields, body) {
  if (fields.email) {
    return normalizeAbacusIdentityFields(fields.email, body.username || body.email || fields.email);
  }
  const username = await allocateStudentUsername(school);
  return { username, email: usernameToEmail(username) };
}

export async function createTeacher(schoolId, body) {
  const school = await assertSchoolExists(schoolId);
  const categories = await getCatalogCategories();
  const fields = await validatePersonFields(body, categories);

  const { username, email } = await resolveNewTeacherIdentity(school, fields, body);

  await assertAbacusLoginAvailable(email);

  const hash = await bcrypt.hash(fields.password, 12);
  const teacher = await AbacusTeacher.create({
    fullName: fields.fullName,
    username,
    email,
    password: hash,
    phone: fields.phone,
    category: fields.category,
    level: fields.level,
    schoolId,
    isActive: true,
  });
  return formatTeacher(teacher.toObject());
}

export async function updateTeacher(id, body) {
  const teacher = await AbacusTeacher.findById(id);
  if (!teacher || teacher.isActive === false) throw new Error('Teacher not found');

  const categories = await getCatalogCategories();
  const fields = await validatePersonFields(body, categories, { requirePassword: false, isUpdate: true });

    if (fields.email && normalizeAbacusLogin(fields.email) !== normalizeAbacusLogin(teacher.email)) {
      const identity = normalizeAbacusIdentityFields(fields.email, fields.email);
      await assertAbacusLoginAvailable(identity.email, { excludeTeacherId: id });
      teacher.email = identity.email;
      teacher.username = identity.username;
    }

  teacher.fullName = fields.fullName;
  teacher.phone = fields.phone;
  teacher.category = fields.category;
  teacher.level = fields.level;
  if (fields.password) {
    teacher.password = await bcrypt.hash(fields.password, 12);
  }
  await teacher.save();
  return formatTeacher(teacher.toObject());
}

export async function deleteTeacher(id) {
  const teacher = await AbacusTeacher.findById(id);
  if (!teacher) throw new Error('Teacher not found');
  teacher.isActive = false;
  releaseAbacusLoginIdentity(teacher);
  await teacher.save();
  return { success: true };
}

export async function listStudents(schoolId) {
  await assertSchoolExists(schoolId);
  const rows = await AbacusStudent.find({ schoolId, isActive: { $ne: false } })
    .sort({ fullName: 1 })
    .lean();
  const teacherIds = [...new Set(rows.map((r) => r.teacherId?.toString()).filter(Boolean))];
  const teachers = teacherIds.length
    ? await AbacusTeacher.find({ _id: { $in: teacherIds } }).select('fullName').lean()
    : [];
  const teacherMap = Object.fromEntries(teachers.map((t) => [t._id.toString(), t]));
  return rows.map((row) => formatStudent(row, teacherMap));
}

export async function createStudent(schoolId, body) {
  const school = await assertSchoolExists(schoolId);
  const categories = await getCatalogCategories();
  const fields = await validatePersonFields(body, categories);

  const { username, email } = await resolveNewStudentIdentity(school, fields, body);

  await assertAbacusLoginAvailable(email);

  const hash = await bcrypt.hash(fields.password, 12);
  const student = await AbacusStudent.create({
    fullName: fields.fullName,
    username,
    email,
    password: hash,
    className: fields.className,
    category: fields.category,
    level: fields.level,
    schoolId,
    isActive: true,
  });
  return formatStudent(student.toObject());
}

export async function updateStudent(id, body) {
  const student = await AbacusStudent.findById(id);
  if (!student || student.isActive === false) throw new Error('Student not found');

  const categories = await getCatalogCategories();
  const fields = await validatePersonFields(body, categories, { requirePassword: false, isUpdate: true });

  if (fields.email && normalizeAbacusLogin(fields.email) !== normalizeAbacusLogin(student.email)) {
    const identity = normalizeAbacusIdentityFields(fields.email, fields.email);
    await assertAbacusLoginAvailable(identity.email, { excludeStudentId: id });
    student.email = identity.email;
    student.username = identity.username;
  }

  const categoryOrLevelChanged =
    fields.category !== student.category || fields.level !== student.level;

  student.fullName = fields.fullName;
  student.className = fields.className;
  student.category = fields.category;
  student.level = fields.level;
  if (fields.password) {
    student.password = await bcrypt.hash(fields.password, 12);
  }

  if (categoryOrLevelChanged && student.teacherId) {
    const assignedTeacher = await AbacusTeacher.findById(student.teacherId).lean();
    if (
      !assignedTeacher
      || assignedTeacher.category !== fields.category
      || assignedTeacher.level !== fields.level
    ) {
      student.teacherId = null;
    }
  }

  await student.save();

  let teacherMap = {};
  if (student.teacherId) {
    const assignedTeacher = await AbacusTeacher.findById(student.teacherId).select('fullName').lean();
    if (assignedTeacher) {
      teacherMap = { [assignedTeacher._id.toString()]: assignedTeacher };
    }
  }
  return formatStudent(student.toObject(), teacherMap);
}

export async function deleteStudent(id) {
  const student = await AbacusStudent.findById(id);
  if (!student) throw new Error('Student not found');
  student.isActive = false;
  releaseAbacusLoginIdentity(student);
  await student.save();
  return { success: true };
}

/** Students assignable to a teacher: same school, rank at or below teacher's ceiling. */
export async function listStudentCandidatesForTeacher(teacher) {
  const categories = await getCatalogCategories();
  const rows = await AbacusStudent.find({
    schoolId: teacher.schoolId,
    isActive: { $ne: false },
  })
    .select('fullName email className category level teacherId')
    .sort({ fullName: 1 })
    .lean();

  return rows.filter((s) =>
    isWithinRankCeiling(s.category, s.level, teacher.category, teacher.level, categories),
  );
}

/** Students visible to a teacher: explicitly assigned, or unassigned within rank ceiling. */
export async function listStudentsForTeacher(teacher) {
  const categories = await getCatalogCategories();
  const teacherId = teacher._id.toString();
  const rows = await AbacusStudent.find({
    schoolId: teacher.schoolId,
    isActive: { $ne: false },
    $or: [
      { teacherId: teacher._id },
      { $or: [{ teacherId: null }, { teacherId: { $exists: false } }] },
    ],
  })
    .select('fullName email className category level teacherId')
    .sort({ fullName: 1 })
    .lean();

  return rows.filter((s) => {
    if (s.teacherId?.toString() === teacherId) return true;
    if (s.teacherId) return false;
    return isWithinRankCeiling(s.category, s.level, teacher.category, teacher.level, categories);
  });
}

export async function getPortalAccessMeta(category, level) {
  const categories = await getCatalogCategories();
  const userRank = getGlobalRank(category, level, categories) || 1;
  return {
    userRank,
    accessSummary: formatAllowedAccessSummary(userRank, categories),
  };
}

export async function assignStudentsToTeacher(teacherId, studentIds = []) {
  const teacher = await AbacusTeacher.findById(teacherId);
  if (!teacher || teacher.isActive === false) throw new Error('Teacher not found');

  const ids = Array.from(new Set((studentIds || []).map(String).filter(Boolean)));
  const students = ids.length
    ? await AbacusStudent.find({ _id: { $in: ids }, schoolId: teacher.schoolId, isActive: { $ne: false } })
    : [];

  if (ids.length && students.length !== ids.length) {
    throw new Error('One or more students were not found in this school');
  }

  const categories = await getCatalogCategories();
  for (const s of students) {
    if (!isWithinRankCeiling(s.category, s.level, teacher.category, teacher.level, categories)) {
      throw new Error(
        `Student "${s.fullName}" (${s.category} ${s.level}) is above teacher level (${teacher.category} ${teacher.level})`,
      );
    }
  }

  await AbacusStudent.updateMany(
    { teacherId: teacher._id, schoolId: teacher.schoolId },
    { $set: { teacherId: null } },
  );

  if (students.length) {
    await AbacusStudent.updateMany(
      { _id: { $in: students.map((s) => s._id) } },
      { $set: { teacherId: teacher._id } },
    );
  }

  const rows = await listStudentsForTeacher(teacher);
  return rows.map(formatStudent);
}

export { formatTeacher, formatStudent };
