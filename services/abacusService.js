import bcrypt from 'bcryptjs';
import AbacusSchool from '../models/AbacusSchool.js';
import AbacusTeacher from '../models/AbacusTeacher.js';
import AbacusStudent from '../models/AbacusStudent.js';
import AbacusCatalog from '../models/AbacusCatalog.js';
import {
  DEFAULT_ABACUS_CATEGORIES,
  isValidAbacusEmail,
  normalizeAbacusEmail,
  validateCategoryLevel,
} from '../constants/abacusCatalog.js';

const CATALOG_ID = 'default';

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
  }
  return doc;
}

export async function getCatalogCategories() {
  const doc = await ensureAbacusCatalog();
  return doc.categories.map((c) => ({
    name: c.name,
    levels: [...(c.levels || [])],
  }));
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
  if (cat.levels.some((l) => l.toLowerCase() === level.toLowerCase())) {
    throw new Error('Level already exists in this category');
  }
  cat.levels.push(level);
  await doc.save();
  return getCatalogCategories();
}

async function generateSchoolCode(name) {
  const base = String(name || 'SCHOOL')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 8) || 'ABACUS';
  let code = base;
  let n = 1;
  while (await AbacusSchool.findOne({ schoolCode: code })) {
    code = `${base}${n}`;
    n += 1;
  }
  return code;
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
    isActive: row.isActive !== false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function formatTeacher(row) {
  return {
    id: row._id.toString(),
    fullName: row.fullName,
    email: row.email,
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
  return {
    id: row._id.toString(),
    fullName: row.fullName,
    email: row.email,
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

export async function createSchool(body) {
  const name = String(body.name || body.schoolName || '').trim();
  if (!name) throw new Error('School name is required');

  const schoolCode = body.schoolCode
    ? String(body.schoolCode).trim().toUpperCase()
    : await generateSchoolCode(name);

  const existing = await AbacusSchool.findOne({ schoolCode });
  if (existing) throw new Error('School code already exists');

  const school = await AbacusSchool.create({
    name,
    schoolCode,
    contactPerson: String(body.contactPerson || '').trim(),
    phone: String(body.phone || '').trim(),
    place: String(body.place || '').trim(),
    pin: String(body.pin || '').trim(),
    notes: String(body.notes || '').trim(),
    schoolDetails: body.schoolDetails || {},
    isActive: true,
  });

  return formatSchool(school.toObject());
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
  await AbacusTeacher.updateMany({ schoolId: id }, { isActive: false });
  await AbacusStudent.updateMany({ schoolId: id }, { isActive: false });
  return { success: true };
}

async function assertSchoolExists(schoolId) {
  const school = await AbacusSchool.findById(schoolId);
  if (!school || school.isActive === false) throw new Error('School not found');
  return school;
}

async function validatePersonFields(body, categories, { requirePassword = true } = {}) {
  const fullName = String(body.fullName || body.name || '').trim();
  const email = normalizeAbacusEmail(body.email);
  const password = String(body.password || '').trim();
  const category = String(body.category || '').trim();
  const level = String(body.level || '').trim();

  if (!fullName) throw new Error('Name is required');
  if (!isValidAbacusEmail(email)) throw new Error('Email must be a valid @abacus.com address');
  if (requirePassword) {
    if (!password || password.length < 6) throw new Error('Password is required (min 6 characters)');
  } else if (password && password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const catCheck = validateCategoryLevel(categories, category, level);
  if (!catCheck.ok) throw new Error(catCheck.message);

  return {
    fullName,
    email,
    password,
    category: catCheck.category,
    level: catCheck.level,
    phone: String(body.phone || '').trim(),
    className: String(body.className || body.class || '').trim(),
  };
}

export async function listTeachers(schoolId) {
  await assertSchoolExists(schoolId);
  const rows = await AbacusTeacher.find({ schoolId, isActive: { $ne: false } })
    .sort({ fullName: 1 })
    .lean();
  return rows.map(formatTeacher);
}

export async function createTeacher(schoolId, body) {
  await assertSchoolExists(schoolId);
  const categories = await getCatalogCategories();
  const fields = await validatePersonFields(body, categories);

  const existing = await AbacusTeacher.findOne({ email: fields.email });
  if (existing) throw new Error('Teacher with this email already exists');

  const dupUser = await AbacusStudent.findOne({ email: fields.email });
  if (dupUser) throw new Error('This email is already used by a student');

  const hash = await bcrypt.hash(fields.password, 12);
  const teacher = await AbacusTeacher.create({
    fullName: fields.fullName,
    email: fields.email,
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
  const fields = await validatePersonFields(body, categories, { requirePassword: false });

  if (fields.email !== teacher.email) {
    const existing = await AbacusTeacher.findOne({ email: fields.email, _id: { $ne: id } });
    if (existing) throw new Error('Teacher with this email already exists');
    const dupUser = await AbacusStudent.findOne({ email: fields.email });
    if (dupUser) throw new Error('This email is already used by a student');
  }

  teacher.fullName = fields.fullName;
  teacher.email = fields.email;
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
  await assertSchoolExists(schoolId);
  const categories = await getCatalogCategories();
  const fields = await validatePersonFields(body, categories);

  const existing = await AbacusStudent.findOne({ email: fields.email });
  if (existing) throw new Error('Student with this email already exists');

  const dupTeacher = await AbacusTeacher.findOne({ email: fields.email });
  if (dupTeacher) throw new Error('This email is already used by a teacher');

  const hash = await bcrypt.hash(fields.password, 12);
  const student = await AbacusStudent.create({
    fullName: fields.fullName,
    email: fields.email,
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
  const fields = await validatePersonFields(body, categories, { requirePassword: false });

  if (fields.email !== student.email) {
    const existing = await AbacusStudent.findOne({ email: fields.email, _id: { $ne: id } });
    if (existing) throw new Error('Student with this email already exists');
    const dupTeacher = await AbacusTeacher.findOne({ email: fields.email });
    if (dupTeacher) throw new Error('This email is already used by a teacher');
  }

  const categoryOrLevelChanged =
    fields.category !== student.category || fields.level !== student.level;

  student.fullName = fields.fullName;
  student.email = fields.email;
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
  await student.save();
  return { success: true };
}

/** Students visible to a teacher: explicitly assigned, or unassigned with same category/level. */
export async function listStudentsForTeacher(teacher) {
  return AbacusStudent.find({
    schoolId: teacher.schoolId,
    isActive: { $ne: false },
    $or: [
      { teacherId: teacher._id },
      {
        $and: [
          { $or: [{ teacherId: null }, { teacherId: { $exists: false } }] },
          { category: teacher.category },
          { level: teacher.level },
        ],
      },
    ],
  })
    .select('fullName email className category level teacherId')
    .sort({ fullName: 1 })
    .lean();
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
