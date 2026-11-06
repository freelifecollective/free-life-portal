import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/** Set only while a locked page is being drawn for Lacey's downline: the real page is shown (washed out) as if a member opened it. The database still treats them as a downline, so they only ever see what they are allowed to. */
export const previewStore = new AsyncLocalStorage<boolean>();
