import express from 'express';
import multer from 'multer';
import { verifyToken, verifySuperAdmin } from '../middleware/auth.js';
import {
  getCatalogHandler,
  addCategoryHandler,
  addLevelHandler,
  listSchoolsHandler,
  getSchoolHandler,
  createSchoolHandler,
  updateSchoolHandler,
  deleteSchoolHandler,
  listTeachersHandler,
  suggestUsernameHandler,
  createTeacherHandler,
  updateTeacherHandler,
  deleteTeacherHandler,
  importTeachersCsvHandler,
  listStudentsHandler,
  createStudentHandler,
  updateStudentHandler,
  deleteStudentHandler,
  importStudentsCsvHandler,
  assignTeacherStudentsHandler,
  listTeacherStudentsHandler,
  previewLoginUsernameHandler,
} from '../controllers/abacusController.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(verifyToken, verifySuperAdmin);

router.get('/catalog', getCatalogHandler);
router.post('/catalog/categories', addCategoryHandler);
router.post('/catalog/levels', addLevelHandler);

router.get('/schools', listSchoolsHandler);
router.get('/preview-login-username', previewLoginUsernameHandler);
router.post('/schools', createSchoolHandler);
router.get('/schools/:id', getSchoolHandler);
router.put('/schools/:id', updateSchoolHandler);
router.delete('/schools/:id', deleteSchoolHandler);

router.get('/schools/:schoolId/teachers', listTeachersHandler);
router.get('/schools/:schoolId/next-username', suggestUsernameHandler);
router.post('/schools/:schoolId/teachers', createTeacherHandler);
router.post('/schools/:schoolId/teachers/csv', upload.single('file'), importTeachersCsvHandler);
router.put('/teachers/:id', updateTeacherHandler);
router.delete('/teachers/:id', deleteTeacherHandler);
router.get('/teachers/:id/students', listTeacherStudentsHandler);
router.put('/teachers/:id/students', assignTeacherStudentsHandler);

router.get('/schools/:schoolId/students', listStudentsHandler);
router.post('/schools/:schoolId/students', createStudentHandler);
router.post('/schools/:schoolId/students/csv', upload.single('file'), importStudentsCsvHandler);
router.put('/students/:id', updateStudentHandler);
router.delete('/students/:id', deleteStudentHandler);

router.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Abacus admin route not found' });
});

export default router;
