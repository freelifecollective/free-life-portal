"use client";

import { useRouter } from "next/navigation";
import { Questionnaire } from "./Questionnaire";
import type { Answers } from "@/lib/buddy/validate";

export function BuddyQuestionnaire({ initial }: { initial: Answers }) {
  const router = useRouter();
  return <Questionnaire initial={initial} onFinished={() => { router.replace("/buddy"); router.refresh(); }} />;
}
