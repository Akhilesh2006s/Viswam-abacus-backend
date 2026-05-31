import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    req.userId = decoded.userId || decoded.id;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

/** Super Admin token from main LMS login (shared JWT_SECRET). */
export const verifySuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'super-admin') {
    return res.status(403).json({ success: false, message: 'Super admin required.' });
  }
  next();
};
