import jwt from 'jsonwebtoken';
import { normalizeAbacusLogin } from '../constants/abacusCatalog.js';
import { SUPER_ADMIN_CREDENTIALS_LIST } from '../constants/superAdminConstants.js';
import {
  findAbacusTeacherForLogin,
  findAbacusStudentForLogin,
} from '../services/abacusCsvImport.js';
import { emailToUsername } from '../services/abacusUsername.js';

function publicAbacusUser(doc, role, extra = {}) {
  const id = doc._id.toString();
  const login = normalizeAbacusLogin(doc.email);
  return {
    id,
    username: doc.username || emailToUsername(doc.email),
    email: login,
    fullName: doc.fullName,
    role,
    productLine: 'ABACUS',
    category: doc.category,
    level: doc.level,
    ...extra,
  };
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
}

export async function loginHandler(req, res) {
  try {
    const { email, password: rawPassword } = req.body || {};
    const loginId = req.body?.username || email;
    const password = String(rawPassword || '').trim();
    if (!loginId || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const superCred = SUPER_ADMIN_CREDENTIALS_LIST.find((c) => {
      const id = String(loginId).trim().toLowerCase();
      const credUser = String(c.username || c.email || '').trim().toLowerCase();
      const credEmail = String(c.email || '').trim().toLowerCase();
      return (credUser === id || credEmail === id) && c.password === password;
    });
    if (superCred) {
      const token = signToken({
        id: 'super-admin-001',
        userId: 'super-admin-001',
        email: superCred.email,
        role: 'super-admin',
      });
      return res.json({
        success: true,
        token,
        user: {
          id: 'super-admin-001',
          email: superCred.email,
          fullName: superCred.fullName,
          role: 'super-admin',
        },
      });
    }

    const teacher = await findAbacusTeacherForLogin(loginId, password);
    if (teacher) {
      const id = teacher._id.toString();
      const login = normalizeAbacusLogin(teacher.email);
      const token = signToken({
        userId: id,
        id,
        email: login,
        role: 'teacher',
        productLine: 'ABACUS',
        abacusSchoolId: teacher.schoolId.toString(),
      });
      return res.json({
        success: true,
        token,
        user: publicAbacusUser(teacher, 'teacher'),
      });
    }

    const student = await findAbacusStudentForLogin(loginId, password);
    if (student) {
      const id = student._id.toString();
      const login = normalizeAbacusLogin(student.email);
      const token = signToken({
        userId: id,
        id,
        email: login,
        role: 'student',
        productLine: 'ABACUS',
        abacusSchoolId: student.schoolId.toString(),
      });
      return res.json({
        success: true,
        token,
        user: publicAbacusUser(student, 'student', { className: student.className }),
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid username or password. Use the login and password set in Abacus Management.',
    });
  } catch (err) {
    console.error('Abacus login error:', err);
    res.status(500).json({ success: false, message: err.message || 'Login failed' });
  }
}
