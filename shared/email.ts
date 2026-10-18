export type EmailCampaign = {
  id: string; subject: string; body: string;
  status: 'draft' | 'queued' | 'completed' | 'cancelled';
  created_at: string;
  pending: number; accepted: number; failed: number; unknown: number; skipped: number;
  test_status: string | null;
};
export type EmailDashboard = { campaigns: EmailCampaign[]; subscribers: number; ready: boolean; limit: number; used: number };
export const EMAIL_CONSENT_VERSION = 'updates-v1';
