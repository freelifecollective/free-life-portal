export const ROLES = ["lead", "member", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** lead < member < admin. Mirrors public.role_rank() in the database. */
export function roleRank(r: Role): number {
  return ROLES.indexOf(r) + 1;
}

/** True when `role` is allowed to see something whose lowest visible role is `min`. */
export function canSee(role: Role | null | undefined, min: Role): boolean {
  return !!role && roleRank(role) >= roleRank(min);
}
