/**
 * Capability checks that role alone cannot answer.
 *
 * `authorize('school')` asks *who* you are. Some things depend on what you have
 * been granted: a school administrator can hand a teacher write access to the
 * school's tablet inventory and take it back when that teacher's turn is over.
 * The grant lives on `teachers.can_manage_inventory` and is loaded into
 * `req.user` by `authenticate()`.
 */

/** Roles that may write inventory purely by virtue of their role. */
const INVENTORY_WRITE_ROLES = ['admin', 'subadmin', 'school'];

/**
 * May this user create/edit devices?
 *
 * A delegate never outranks the delegator: a granted teacher gets exactly what
 * a school administrator has — add, edit, assign, change status, import.
 * Deleting a device stays with head office (a school admin cannot do it
 * either), which is why DELETE keeps its own role check.
 */
function canWriteInventory(user) {
  if (!user) return false;
  if (INVENTORY_WRITE_ROLES.includes(user.role)) return true;
  return user.role === 'teacher' && !!Number(user.can_manage_inventory);
}

/**
 * 403 with a reason the person can act on. A teacher who has not been granted
 * access is told who can grant it, rather than "Forbidden".
 */
function requireInventoryWrite(req, res, next) {
  if (canWriteInventory(req.user)) return next();
  if (req.user && req.user.role === 'teacher') {
    return res.status(403).json({
      error: 'Inventory is read-only for your account. Your school administrator can give you edit access.',
      code: 'INVENTORY_READ_ONLY'
    });
  }
  return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
}

module.exports = { canWriteInventory, requireInventoryWrite, INVENTORY_WRITE_ROLES };
