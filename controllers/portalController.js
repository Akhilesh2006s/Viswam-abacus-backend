import bcrypt from 'bcryptjs';
import AbacusTeacher from '../models/AbacusTeacher.js';
import AbacusStudent from '../models/AbacusStudent.js';
import AbacusPracticeResult from '../models/AbacusPracticeResult.js';
import { linkQuestionSetToResult } from '../controllers/questionController.js';
import AbacusSchool from '../models/AbacusSchool.js';
import {
  getCatalogCategories,
  getPortalAccessMeta,
  listStudentsForTeacher,
} from '../services/abacusService.js';
import {
  buildLevelRankIndex,
  getGlobalRank,
  catalogForUserRank,
  legacyAbacusEmail,
  normalizeAbacusLogin,
} from '../constants/abacusCatalog.js';
import { emailToUsername } from '../services/abacusUsername.js';

function legacyUsername(userOrEmail) {
  if (userOrEmail && typeof userOrEmail === 'object' && userOrEmail.username) {
    return userOrEmail.username;
  }
  const raw =
    typeof userOrEmail === 'string' ? userOrEmail : String(userOrEmail?.email || '');
  return emailToUsername(raw) || normalizeAbacusLogin(raw);
}

function practiceEmailFilter(user) {
  const login = normalizeAbacusLogin(user.email);
  const legacy = legacyAbacusEmail(login);
  return { $or: [{ email: login }, { email: legacy }, { email: user.email }] };
}

async function findPortalUser(userId, role) {
  if (role === 'teacher') {
    return AbacusTeacher.findById(userId).lean();
  }
  if (role === 'student') {
    return AbacusStudent.findById(userId).lean();
  }
  return null;
}

function toLegacyStudent(user, role) {
  const rank = getGlobalRank(user.category, user.level);
  return {
    id: user._id.toString(),
    username: legacyUsername(user),
    name: user.fullName,
    email: normalizeAbacusLogin(user.email),
    category: user.category,
    level: user.level,
    rank: rank || 1,
    role,
  };
}

export async function portalMeHandler(req, res) {
  try {
    const role = req.user?.role;
    const userId = req.userId;
    if (!['student', 'teacher'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Abacus portal access only' });
    }

    const user = await findPortalUser(userId, role);
    if (!user || user.isActive === false) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let school = null;
    if (user.schoolId) {
      const s = await AbacusSchool.findById(user.schoolId).lean();
      if (s) school = { id: s._id.toString(), name: s.name, schoolCode: s.schoolCode };
    }

    const student = toLegacyStudent(user, role);
    const access = await getPortalAccessMeta(user.category, user.level);

    let students = [];
    let stats = undefined;
    if (role === 'teacher') {
      const rows = await listStudentsForTeacher(user);
      students = rows.map((s) => ({
        id: s._id.toString(),
        fullName: s.fullName,
        email: normalizeAbacusLogin(s.email),
        className: s.className || '',
        category: s.category,
        level: s.level,
      }));
      stats = { students: students.length };
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          fullName: user.fullName,
          email: normalizeAbacusLogin(user.email),
          username: user.username || emailToUsername(user.email),
          role,
          category: user.category,
          level: user.level,
          className: user.className || '',
          phone: user.phone || '',
          userRank: access.userRank,
          accessSummary: access.accessSummary,
        },
        school,
        student: { ...student, accessSummary: access.accessSummary },
        ...(role === 'teacher' ? { students, stats } : {}),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function portalCatalogHandler(req, res) {
  try {
    const role = req.user?.role;
    if (!['student', 'teacher'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Abacus portal access only' });
    }
    const user = await findPortalUser(req.userId, role);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const categories = await getCatalogCategories();
    const userRank = getGlobalRank(user.category, user.level, categories) || 1;
    const filtered = catalogForUserRank(userRank, categories);

    res.json({
      success: true,
      data: {
        userRank,
        categories: filtered,
        allLevels: buildLevelRankIndex(categories),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listPracticeResultsHandler(req, res) {
  try {
    const user = await findPortalUser(req.userId, req.user?.role);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const rows = await AbacusPracticeResult.find(practiceEmailFilter(user))
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r._id.toString(),
        username: legacyUsername(r.email),
        mode: r.mode,
        category: r.category,
        level_name: r.levelName,
        level_rank: r.levelRank,
        score: r.score,
        total: r.total,
        time_taken: r.timeTaken,
        created_at: r.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function savePracticeResultHandler(req, res) {
  try {
    const role = req.user?.role;
    const user = await findPortalUser(req.userId, role);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const {
      mode = 'practice',
      category,
      level_name: levelName,
      level_rank: levelRank,
      score = 0,
      total = 0,
      time_taken: timeTaken,
      question_set_id: questionSetId,
    } = req.body || {};

    const doc = await AbacusPracticeResult.create({
      userId: user._id,
      userRole: role,
      email: normalizeAbacusLogin(user.email),
      mode: String(mode || 'practice'),
      category: String(category || user.category || ''),
      levelName: String(levelName || user.level || ''),
      levelRank: Number(levelRank) || getGlobalRank(user.category, user.level),
      questionSetId: questionSetId || null,
      score: Number(score) || 0,
      total: Number(total) || 0,
      timeTaken: timeTaken != null ? Number(timeTaken) : null,
    });

    if (questionSetId) {
      await linkQuestionSetToResult(questionSetId, doc._id);
    }

    res.status(201).json({ success: true, data: { id: doc._id.toString() } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function changePasswordHandler(req, res) {
  try {
    const role = req.user?.role;
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'Valid old and new password required (min 6 chars)' });
    }

    const Model = role === 'teacher' ? AbacusTeacher : AbacusStudent;
    const user = await Model.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const ok = await bcrypt.compare(String(oldPassword), user.password || '');
    if (!ok) return res.status(401).json({ success: false, message: 'Old password is incorrect' });

    user.password = await bcrypt.hash(String(newPassword), 12);
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
