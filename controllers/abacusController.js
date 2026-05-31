import {
  getCatalogCategories,
  addCatalogCategory,
  addCatalogLevel,
  listSchools,
  getSchoolById,
  createSchool,
  updateSchool,
  deleteSchool,
  listTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  assignStudentsToTeacher,
  listStudentsForTeacher,
} from '../services/abacusService.js';
import {
  importAbacusTeachersCsv,
  importAbacusStudentsCsv,
} from '../services/abacusCsvImport.js';
import AbacusTeacher from '../models/AbacusTeacher.js';
import AbacusStudent from '../models/AbacusStudent.js';

export async function getCatalogHandler(_req, res) {
  try {
    const categories = await getCatalogCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load catalog' });
  }
}

export async function addCategoryHandler(req, res) {
  try {
    const categories = await addCatalogCategory(req.body.name);
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function addLevelHandler(req, res) {
  try {
    const categories = await addCatalogLevel(req.body.category, req.body.level);
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function listSchoolsHandler(_req, res) {
  try {
    const schools = await listSchools();
    res.json({ success: true, data: schools });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getSchoolHandler(req, res) {
  try {
    const school = await getSchoolById(req.params.id);
    res.json({ success: true, data: school });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
}

export async function createSchoolHandler(req, res) {
  try {
    const school = await createSchool(req.body);
    res.status(201).json({ success: true, data: school });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function updateSchoolHandler(req, res) {
  try {
    const school = await updateSchool(req.params.id, req.body);
    res.json({ success: true, data: school });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function deleteSchoolHandler(req, res) {
  try {
    await deleteSchool(req.params.id);
    res.json({ success: true, message: 'School deactivated' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function listTeachersHandler(req, res) {
  try {
    const teachers = await listTeachers(req.params.schoolId);
    res.json({ success: true, data: teachers });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function createTeacherHandler(req, res) {
  try {
    const teacher = await createTeacher(req.params.schoolId, req.body);
    res.status(201).json({ success: true, data: teacher });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function updateTeacherHandler(req, res) {
  try {
    const teacher = await updateTeacher(req.params.id, req.body);
    res.json({ success: true, data: teacher });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function deleteTeacherHandler(req, res) {
  try {
    await deleteTeacher(req.params.id);
    res.json({ success: true, message: 'Teacher removed' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function importTeachersCsvHandler(req, res) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: 'CSV file is required' });
    }
    const result = await importAbacusTeachersCsv(
      req.params.schoolId,
      req.file.buffer,
      req.file.originalname || 'teachers.csv',
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function listStudentsHandler(req, res) {
  try {
    const students = await listStudents(req.params.schoolId);
    res.json({ success: true, data: students });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function createStudentHandler(req, res) {
  try {
    const student = await createStudent(req.params.schoolId, req.body);
    res.status(201).json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function updateStudentHandler(req, res) {
  try {
    const student = await updateStudent(req.params.id, req.body);
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function deleteStudentHandler(req, res) {
  try {
    await deleteStudent(req.params.id);
    res.json({ success: true, message: 'Student removed' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function importStudentsCsvHandler(req, res) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: 'CSV file is required' });
    }
    const result = await importAbacusStudentsCsv(
      req.params.schoolId,
      req.file.buffer,
      req.file.originalname || 'students.csv',
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function assignTeacherStudentsHandler(req, res) {
  try {
    const { studentIds = [] } = req.body || {};
    const students = await assignStudentsToTeacher(req.params.id, studentIds);
    res.json({ success: true, data: students });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function listTeacherStudentsHandler(req, res) {
  try {
    const teacher = await AbacusTeacher.findById(req.params.id).lean();
    if (!teacher || teacher.isActive === false) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }
    const rows = await AbacusStudent.find({
      schoolId: teacher.schoolId,
      category: teacher.category,
      level: teacher.level,
      isActive: { $ne: false },
    })
      .select('fullName email className category level teacherId')
      .sort({ fullName: 1 })
      .lean();

    const teacherIds = [...new Set(rows.map((r) => r.teacherId?.toString()).filter(Boolean))];
    const teachers = teacherIds.length
      ? await AbacusTeacher.find({ _id: { $in: teacherIds } }).select('fullName').lean()
      : [];
    const teacherMap = Object.fromEntries(teachers.map((t) => [t._id.toString(), t]));

    res.json({
      success: true,
      data: rows.map((s) => {
        const tid = s.teacherId?.toString?.() || null;
        return {
          id: s._id.toString(),
          fullName: s.fullName,
          email: s.email,
          className: s.className || '',
          category: s.category,
          level: s.level,
          assigned: tid === String(teacher._id),
          teacherId: tid,
          teacherName: tid ? teacherMap[tid]?.fullName || '' : '',
        };
      }),
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}
