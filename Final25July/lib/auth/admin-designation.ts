/**
 * The account matching ADMIN_EMAIL (if set) is always treated as the
 * workspace admin — checked on both signup and login so changing this env
 * var and having that person sign up/log in is all it takes to change who's
 * admin, no database editing required.
 */
export function isDesignatedAdminEmail(email: string): boolean {
  const designated = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!designated) return false;
  return email.trim().toLowerCase() === designated;
}
