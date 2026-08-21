import {
  SenderDTO,
  EmailDTO,
  PaginatedResponse,
  ScheduleRequest,
  ScheduleResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

class ApiError extends Error {
  public status: number;
  public details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorData: any;
    try {
      errorData = await res.json();
    } catch {
      errorData = { message: res.statusText };
    }
    throw new ApiError(
      res.status,
      errorData.message || "An error occurred",
      errorData.details
    );
  }

  return res.json();
}

// ── Senders ─────────────────────────────────────────────

export async function getSenders(): Promise<SenderDTO[]> {
  return request<SenderDTO[]>("/api/senders");
}

export async function createSender(name: string): Promise<SenderDTO> {
  return request<SenderDTO>("/api/senders", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

// ── Schedule ────────────────────────────────────────────

export async function scheduleEmails(
  data: ScheduleRequest
): Promise<ScheduleResponse> {
  return request<ScheduleResponse>("/api/schedule", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Emails ──────────────────────────────────────────────

export async function getScheduledEmails(
  page = 1,
  pageSize = 20
): Promise<PaginatedResponse<EmailDTO>> {
  return request<PaginatedResponse<EmailDTO>>(
    `/api/emails/scheduled?page=${page}&pageSize=${pageSize}`
  );
}

export async function getSentEmails(
  page = 1,
  pageSize = 20
): Promise<PaginatedResponse<EmailDTO>> {
  return request<PaginatedResponse<EmailDTO>>(
    `/api/emails/sent?page=${page}&pageSize=${pageSize}`
  );
}

export { ApiError };
