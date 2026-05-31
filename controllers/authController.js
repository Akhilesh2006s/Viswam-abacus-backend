import jwt from 'jsonwebtoken';
import { SUPER_ADMIN_CREDENTIALS_LIST } from '../constants/superAdminConstants.js';
import {
  findAbacusTeacherForLogin,
  findAbacusStudentForLogin,
} from '../services/abacusCsvImport.js';

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
}

export async function loginHandler(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const superCred = SUPER_ADMIN_CREDENTIALS_LIST.find(
      (c) => c.email.toLowerCase() === email.toLowerCase() && c.password === password,
    );
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

    const teacher = await findAbacusTeacherForLogin(email, password);
    if (teacher) {
      const id = teacher._id.toString();
      const token = signToken({
        userId: id,
        id,
        email: teacher.email,
        role: 'teacher',
        productLine: 'ABACUS',
        abacusSchoolId: teacher.schoolId.toString(),
      });
      return res.json({
        success: true,
        token,
        user: {
          id,
          email: teacher.email,
          fullName: teacher.fullName,
          role: 'teacher',
          productLine: 'ABACUS',
          category: teacher.category,
          level: teacher.level,
        },
      });
    }

    const student = await findAbacusStudentForLogin(email, password);
    if (student) {
      const id = student._id.toString();
      const token = signToken({
        userId: id,
        id,
        email: student.email,
        role: 'student',
        productLine: 'ABACUS',
        abacusSchoolId: student.schoolId.toString(),
      });
      return res.json({
        success: true,
        token,
        user: {
          id,
          email: student.email,
          fullName: student.fullName,
          role: 'student',
          productLine: 'ABACUS',
          category: student.category,
          level: student.level,
          className: student.className,
        },
      });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (err) {
    console.error('Abacus login error:', err);
    res.status(500).json({ success: false, message: err.message || 'Login failed' });
  }
}
