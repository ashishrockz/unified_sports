/**
 * RBAC Permission Configuration
 * Single source of truth for role-based access control.
 *
 * Permission format: "resource.action"
 * Roles: super_admin, admin, manager, editor, viewer
 */

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  EDITOR: 'editor',
  VIEWER: 'viewer',
};

// All staff roles (non-user)
const STAFF_ROLES = ['super_admin', 'admin', 'manager', 'editor', 'viewer'];

const ROLE_PERMISSIONS = {
  super_admin: ['*'],  // wildcard — everything

  admin: [
    'dashboard.read',
    'users.read', 'users.create', 'users.update', 'users.delete',
    'content.read', 'content.create', 'content.update', 'content.delete',
    'reports.read',
    'settings.read', 'settings.update',
    'audit_logs.read',
    'admins.read',
    'matches.read', 'matches.update', 'matches.delete',
    'rooms.read', 'rooms.update', 'rooms.delete',
    'sport_types.read', 'sport_types.create', 'sport_types.update', 'sport_types.delete',
    'notifications.read', 'notifications.delete',
    'plans.read', 'plans.update',
  ],

  manager: [
    'dashboard.read',
    'content.read', 'content.create', 'content.update',
    'reports.read', 'reports.create',
    'matches.read',
    'rooms.read',
    'sport_types.read',
  ],

  editor: [
    'dashboard.read',
    'content.read', 'content.create', 'content.update',
    'matches.read',
    'rooms.read',
    'sport_types.read',
  ],

  viewer: [
    'dashboard.read',
    'content.read',
    'reports.read',
    'matches.read',
    'rooms.read',
    'sport_types.read',
  ],
};

/**
 * Check if a role has a specific permission.
 */
function hasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

/**
 * Check if a role has ANY of the given permissions.
 */
function hasAnyPermission(role, permissions) {
  return permissions.some((p) => hasPermission(role, p));
}

module.exports = {
  ROLES,
  STAFF_ROLES,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
};
