export const REPORT_REASONS = {
  copyright: "著作権などの権利侵害",
  harmful: "不適切な内容・嫌がらせ",
  spam: "迷惑な宣伝・スパム",
  inaccurate: "単語や例文の誤り",
  other: "その他",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export type ReportStatus = "pending" | "resolved" | "dismissed";
export type DeckReport = {
  id: string; deck_id: string; deck_title: string; reason: ReportReason; details: string;
  status: ReportStatus; created_at: string; updated_at: string; admin_note: string;
  current_visibility: "public" | "private" | null;
};
