import AbacusTeacher from '../models/AbacusTeacher.js';
import AbacusStudent from '../models/AbacusStudent.js';
import AbacusSchool from '../models/AbacusSchool.js';
import { listStudentsForTeacher } from '../services/abacusService.js';

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

    res.json({
      success: true,
      data: {
        teacher: {
          id: teacher._id.toString(),
          fullName: teacher.fullName,
          email: teacher.email,
          phone: teacher.phone || '',
          category: teacher.category,
          level: teacher.level,
        },
        school,
        students: students.map((s) => ({
          id: s._id.toString(),
          fullName: s.fullName,
          email: s.email,
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

    res.json({
      success: true,
      data: {
        student: {
          id: student._id.toString(),
          fullName: student.fullName,
          email: student.email,
          className: student.className || '',
          category: student.category,
          level: student.level,
        },
        school,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load dashboard' });
  }
}
