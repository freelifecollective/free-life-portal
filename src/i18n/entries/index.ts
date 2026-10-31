import type { Entry } from "../match";
import { menu, messages } from "./menu";
import { screens1 } from "./screens1";
import { screens2 } from "./screens2";
import { screens3 } from "./screens3";
import { screens4 } from "./screens4";
import { screens5 } from "./screens5";
import { screens6 } from "./screens6";
import { screens7 } from "./screens7";
import { quotes1 } from "./quotes1";
import { quotes2 } from "./quotes2";
import { quotes3 } from "./quotes3";
import { questionnaire } from "./questionnaire";

/** Every translation. More areas are added to this list as they are written. */
export const ENTRIES: readonly Entry[] = [...menu, ...messages, ...screens1, ...screens2, ...screens3, ...screens4, ...screens5, ...screens6, ...screens7, ...questionnaire, ...quotes1, ...quotes2, ...quotes3];
