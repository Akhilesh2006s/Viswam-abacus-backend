import AbacusQuestionSet from '../models/AbacusQuestionSet.js';
import AbacusPracticeResult from '../models/AbacusPracticeResult.js';
import { generateQuestionSet } from '../services/abacusQuestionGenerator.js';
import { getCatalogCategories } from '../services/abacusService.js';
import {
  getGlobalRank,
  legacyAbacusEmail,
  normalizeAbacusLogin,
  validateCategoryLevel,
  catalogForUserRank,
} from '../constants/abacusCatalog.js';

function questionEmailFilter(user) {
  const login = normalizeAbacusLogin(user.email);
  const legacy = legacyAbacusEmail(login);
  return { $or: [{ email: login }, { email: legacy }, { email: user.email }] };
}

function userOwnsRecord(user, doc) {
  const login = normalizeAbacusLogin(user.email);
  const docLogin = normalizeAbacusLogin(doc.email);
  return docLogin === login;
}
import AbacusTeacher from '../models/AbacusTeacher.js';
import AbacusStudent from '../models/AbacusStudent.js';

async function findPortalUser(userId, role) {
  if (role === 'teacher') return AbacusTeacher.findById(userId).lean();
  if (role === 'student') return AbacusStudent.findById(userId).lean();
  return null;
}

function userCanAccessLevel(user, category, level, categories) {
  const userRank = getGlobalRank(user.category, user.level, categories) || 1;
  const targetRank = getGlobalRank(category, level, categories);
  if (!targetRank) return { ok: false, message: `Unknown level "${level}" for category "${category}"` };

  const allowed = catalogForUserRank(userRank, categories);
  const allowedCat = allowed.find((c) => c.category.toLowerCase() === category.toLowerCase());
  const allowedLevel = allowedCat?.levels?.find(
    (l) => l.level_name.toLowerCase() === level.toLowerCase(),
  );
  if (!allowedLevel) {
    return { ok: false, message: 'You can only generate questions for your level or below' };
  }
  return { ok: true, levelRank: targetRank };
}

export async function generateQuestionsHandler(req, res) {
  try {
    const role = req.user?.role;
    const user = await findPortalUser(req.userId, role);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const {
      category,
      level,
      mode = 'practice',
      count = 25,
    } = req.body || {};

    if (!category || !level) {
      return res.status(400).json({ success: false, message: 'Category and level are required' });
    }

    const categories = await getCatalogCategories();
    const validated = validateCategoryLevel(categories, category, level);
    if (!validated.ok) {
      return res.status(400).json({ success: false, message: validated.message });
    }

    const access = userCanAccessLevel(user, validated.category, validated.level, categories);
    if (!access.ok) {
      return res.status(403).json({ success: false, message: access.message });
    }

    const questionCount = Math.min(Math.max(Number(count) || 25, 1), 50);
    const questions = generateQuestionSet(validated.category, validated.level, questionCount);

    const doc = await AbacusQuestionSet.create({
      userId: user._id,
      userRole: role,
      email: normalizeAbacusLogin(user.email),
      mode: String(mode || 'practice'),
      category: validated.category,
      levelName: validated.level,
      levelRank: access.levelRank,
      questions,
    });

    res.status(201).json({
      success: true,
      data: {
        id: doc._id.toString(),
        category: doc.category,
        levelName: doc.levelName,
        levelRank: doc.levelRank,
        mode: doc.mode,
        questions: doc.questions,
        createdAt: doc.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to generate questions' });
  }
}

export async function getQuestionSetHandler(req, res) {
  try {
    const user = await findPortalUser(req.userId, req.user?.role);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const doc = await AbacusQuestionSet.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Question set not found' });
    if (!userOwnsRecord(user, doc)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({
      success: true,
      data: {
        id: doc._id.toString(),
        category: doc.category,
        levelName: doc.levelName,
        levelRank: doc.levelRank,
        mode: doc.mode,
        questions: doc.questions,
        resultId: doc.resultId?.toString() || null,
        createdAt: doc.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load question set' });
  }
}

export async function listQuestionSetsHandler(req, res) {
  try {
    const user = await findPortalUser(req.userId, req.user?.role);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const rows = await AbacusQuestionSet.find(questionEmailFilter(user))
      .sort({ createdAt: -1 })
      .limit(50)
      .select('category levelName levelRank mode questions createdAt resultId')
      .lean();

    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r._id.toString(),
        category: r.category,
        level_name: r.levelName,
        level_rank: r.levelRank,
        mode: r.mode,
        question_count: r.questions?.length || 0,
        result_id: r.resultId?.toString() || null,
        created_at: r.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to list question sets' });
  }
}

export async function linkQuestionSetToResult(questionSetId, resultId) {
  if (!questionSetId || !resultId) return;
  await AbacusQuestionSet.findByIdAndUpdate(questionSetId, { resultId });
}
