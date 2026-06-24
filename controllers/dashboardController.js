import AbacusTeacher from '../models/AbacusTeacher.js';
import AbacusStudent from '../models/AbacusStudent.js';
import AbacusSchool from '../models/AbacusSchool.js';
import { normalizeAbacusLogin } from '../constants/abacusCatalog.js';
import { getPortalAccessMeta, listStudentsForTeacher } from '../services/abacusService.js';
import { emailToUsername } from '../services/abacusUsername.js';

async function loadSchool(schoolId) {
  const school = await AbacusSchool.findById(schoolId).lean();
  if (!school || school.isActive === false) return null;
  return {
    id: school._id.toString(),
    name: school.name,
    schoolCode: school.schoolCode,
    place: school.place || '',
  };
}

export async function teacherDashboardHandler(req, res) {
  try {
    const teacher = await AbacusTeacher.findById(req.userId).lean();
    if (!teacher || teacher.isActive === false) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const school = await loadSchool(teacher.schoolId);
    const students = await listStudentsForTeacher(teacher);
    const access = await getPortalAccessMeta(teacher.category, teacher.level);

    res.json({
      success: true,
      data: {
        teacher: {
          id: teacher._id.toString(),
          fullName: teacher.fullName,
          email: normalizeAbacusLogin(teacher.email),
          username: teacher.username || emailToUsername(teacher.email),
          phone: teacher.phone || '',
          category: teacher.category,
          level: teacher.level,
          userRank: access.userRank,
          accessSummary: access.accessSummary,
        },
        school,
        students: students.map((s) => ({
          id: s._id.toString(),
          fullName: s.fullName,
          email: normalizeAbacusLogin(s.email),
          className: s.className || '',
          category: s.category,
          level: s.level,
        })),
        stats: {
          students: students.length,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load dashboard' });
  }
}

export async function studentDashboardHandler(req, res) {
  try {
    const student = await AbacusStudent.findById(req.userId).lean();
    if (!student || student.isActive === false) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const school = await loadSchool(student.schoolId);
    const access = await getPortalAccessMeta(student.category, student.level);

    res.json({
      success: true,
      data: {
        student: {
          id: student._id.toString(),
          fullName: student.fullName,
          email: normalizeAbacusLogin(student.email),
          username: student.username || emailToUsername(student.email),
          className: student.className || '',
          category: student.category,
          level: student.level,
          userRank: access.userRank,
          accessSummary: access.accessSummary,
        },
        school,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load dashboard' });
  }
}
