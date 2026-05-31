export function requireAbacusTeacher(req, res, next) {
  if (req.user?.role !== 'teacher' || req.user?.productLine !== 'ABACUS') {
    return res.status(403).json({ success: false, message: 'Abacus teacher access required' });
  }
  next();
}

export function requireAbacusStudent(req, res, next) {
  if (req.user?.role !== 'student' || req.user?.productLine !== 'ABACUS') {
    return res.status(403).json({ success: false, message: 'Abacus student access required' });
  }
  next();
}

/** Student or teacher on Abacus product line. */
export function requireAbacusPortalUser(req, res, next) {
  const role = req.user?.role;
  if (req.user?.productLine !== 'ABACUS' || !['student', 'teacher'].includes(role)) {
    return res.status(403).json({ success: false, message: 'Abacus student or teacher required' });
  }
  next();
}
