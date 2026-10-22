function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `Only ${role}s can perform this action`,
      });
    }
    return next();
  };
}

module.exports = requireRole;
