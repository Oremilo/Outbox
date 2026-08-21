// ── Frontend API types ──────────────────────────────────
// Mirrors the backend types for type-safe API calls.

export interface SenderDTO {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface CampaignDTO {
  id: string;
  subject: string;
  body: string;
  createdBy: string | null;
  startTime: string;
  delayMs: number;
  hourlyLimit: number | null;
  totalRecipients: number;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  sentCount?: number;
  failedCount?: number;
  pendingCount?: number;
}

export interface EmailDTO {
  id: string;
  campaignId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledTime: string;
  sentTime: string | null;
  attemptCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  senderEmail?: string;
  senderName?: string;
}

export type EmailStatus = "PENDING" | "SCHEDULED" | "SENDING" | "SENT" | "FAILED";
export type CampaignStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ScheduleRequest {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayMs?: number;
  hourlyLimit?: number;
  senderId: string;
}

export interface ScheduleResponse {
  message: string;
  campaignId: string;
  emailCount: number;
}
