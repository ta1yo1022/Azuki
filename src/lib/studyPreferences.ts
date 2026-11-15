export type StudyPreferences = { order: "ordered" | "shuffle"; direction: "ja-en" | "en-ja"; exampleDirection?: "ja-en" | "en-ja"; skipSetup: boolean; repeatMissed: boolean; useReviewSchedule:boolean; showRecall:boolean };
export const STUDY_PREFERENCES_KEY = "azuki.study-preferences.v1";
export function readStudyPreferences(): StudyPreferences {
  const defaults: StudyPreferences = { order: "ordered", direction: "ja-en", skipSetup: false, repeatMissed:true,useReviewSchedule:true,showRecall:true };
  try {
    const value = JSON.parse(localStorage.getItem(STUDY_PREFERENCES_KEY) ?? "null");
    if (!value || typeof value !== "object") return defaults;
    return {...(value.exampleDirection ? {exampleDirection: value.exampleDirection === "ja-en" ? "ja-en" as const : "en-ja" as const} : {}),order:value.order === "shuffle" ? "shuffle" : "ordered",direction:value.direction === "en-ja" ? "en-ja" : "ja-en",skipSetup:value.skipSetup === true,repeatMissed:value.repeatMissed!==false,useReviewSchedule:value.useReviewSchedule!==false,showRecall:value.showRecall!==false};
  } catch { return defaults; }
}
export function saveStudyPreferences(value: StudyPreferences) {
  try { localStorage.setItem(STUDY_PREFERENCES_KEY, JSON.stringify(value)); return true; }
  catch { return false; }
}
