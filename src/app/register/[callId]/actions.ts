"use server";

import { submitRegistration, type RegisterState } from "@/lib/registration";

/** Public: no account needed. */
export async function registerForCall(callId: string, _prev: RegisterState, form: FormData): Promise<RegisterState> {
  return submitRegistration({ callId, form });
}
