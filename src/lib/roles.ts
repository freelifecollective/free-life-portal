export const ROLES = ["downline", "lead", "member", "admin"] as const;
export type Role = (typeof ROLES)[number];

/**
 * downline < lead < member < admin. Mirrors public.role_rank() in the database.
 * A downline account (Lacey's downline) sits below leads: it passes none of the lead or affiliate checks.
 */
export function roleRank(r: Role): number {
  return ROLES.indexOf(r);
}

/** True when `role` is allowed to see something whose lowest visible role is `min`. "downline" as the minimum means the downline and affiliates, not leads. */
export function canSee(role: Role | null | undefined, min: Role): boolean {
  if (!role) return false;
  if (min === "downline") return role === "downline" || role === "member" || role === "admin";
  return roleRank(role) >= roleRank(min);
}

/** A member or an admin: the people who pay and have the full portal. Leads and the downline are not affiliates. */
export function isAffiliate(role: Role | null | undefined): boolean {
  return role === "member" || role === "admin";
}
