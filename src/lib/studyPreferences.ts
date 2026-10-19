export type StudyPreferences = { order: "ordered" | "shuffle"; direction: "ja-en" | "en-ja"; exampleDirection?: "ja-en" | "en-ja"; skipSetup: boolean };
export const STUDY_PREFERENCES_KEY = "azuki.study-preferences.v1";
export function readStudyPreferences(): StudyPreferences {
  const defaults: StudyPreferences = { order: "ordered", direction: "ja-en", skipSetup: false };
  try {
    const value = JSON.parse(localStorage.getItem(STUDY_PREFERENCES_KEY) ?? "null");
    if (!value || typeof value !== "object") return defaults;
    return {...(value.exampleDirection ? {exampleDirection: value.exampleDirection === "ja-en" ? "ja-en" as const : "en-ja" as const} : {}),order:value.order === "shuffle" ? "shuffle" : "ordered",direction:value.direction === "en-ja" ? "en-ja" : "ja-en",skipSetup:value.skipSetup === true};
  } catch { return defaults; }
}
export function saveStudyPreferences(value: StudyPreferences) {
  try { localStorage.setItem(STUDY_PREFERENCES_KEY, JSON.stringify(value)); return true; }
  catch { return false; }
}
