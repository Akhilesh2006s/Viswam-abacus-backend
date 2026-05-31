import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { requireAbacusPortalUser } from '../middleware/abacusRoles.js';
import {
  portalMeHandler,
  portalCatalogHandler,
  listPracticeResultsHandler,
  savePracticeResultHandler,
  changePasswordHandler,
} from '../controllers/portalController.js';
import {
  teacherDashboardHandler,
  studentDashboardHandler,
} from '../controllers/dashboardController.js';
import {
  generateQuestionsHandler,
  getQuestionSetHandler,
  listQuestionSetsHandler,
} from '../controllers/questionController.js';
import { requireAbacusTeacher, requireAbacusStudent } from '../middleware/abacusRoles.js';

const router = express.Router();

router.use(verifyToken, requireAbacusPortalUser);

router.get('/portal/me', portalMeHandler);
router.get('/portal/catalog', portalCatalogHandler);
router.get('/portal/results', listPracticeResultsHandler);
router.post('/portal/results', savePracticeResultHandler);
router.post('/portal/change-password', changePasswordHandler);
router.post('/portal/questions/generate', generateQuestionsHandler);
router.get('/portal/questions', listQuestionSetsHandler);
router.get('/portal/questions/:id', getQuestionSetHandler);
router.get('/portal/teacher/dashboard', requireAbacusTeacher, teacherDashboardHandler);
router.get('/teacher/dashboard', requireAbacusTeacher, teacherDashboardHandler);
router.get('/student/dashboard', requireAbacusStudent, studentDashboardHandler);

export default router;
