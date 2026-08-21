"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Input from "./ui/Input";
import TextArea from "./ui/TextArea";
import CSVUploader from "./CSVUploader";
import { getSenders, scheduleEmails, createSender } from "@/lib/api-client";
import { SenderDTO } from "@/lib/types";

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export default function ComposeModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
}: ComposeModalProps) {
  const [senders, setSenders] = useState<SenderDTO[]>([]);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatingSender, setCreatingSender] = useState(false);

  // Form state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [senderId, setSenderId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [delayMs, setDelayMs] = useState("500");
  const [hourlyLimit, setHourlyLimit] = useState("");

  // Fetch senders on open
  useEffect(() => {
    if (isOpen) {
      loadSenders();
      // Default start time to 1 minute from now
      const now = new Date(Date.now() + 60000);
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setStartTime(local);
    }
  }, [isOpen]);

  const loadSenders = async () => {
    setLoadingSenders(true);
    try {
      const data = await getSenders();
      setSenders(data);
      if (data.length > 0 && !senderId) {
        setSenderId(data[0].id);
      }
    } catch (err) {
      onError("Failed to load senders");
    } finally {
      setLoadingSenders(false);
    }
  };

  const handleCreateSender = async () => {
    setCreatingSender(true);
    try {
      const newSender = await createSender("Sender " + (senders.length + 1));
      setSenders((prev) => [newSender, ...prev]);
      setSenderId(newSender.id);
    } catch (err) {
      onError("Failed to create sender");
    } finally {
      setCreatingSender(false);
    }
  };

  const resetForm = () => {
    setSubject("");
    setBody("");
    setRecipients([]);
    setDelayMs("500");
    setHourlyLimit("");
  };

  const handleSubmit = async () => {
    // Validation
    if (!subject.trim()) return onError("Subject is required");
    if (!body.trim()) return onError("Body is required");
    if (recipients.length === 0) return onError("At least one recipient is required");
    if (!senderId) return onError("Please select a sender");
    if (!startTime) return onError("Start time is required");

    setSubmitting(true);
    try {
      await scheduleEmails({
        subject: subject.trim(),
        body: body.trim(),
        recipients,
        startTime: new Date(startTime).toISOString(),
        delayMs: parseInt(delayMs) || 0,
        hourlyLimit: hourlyLimit ? parseInt(hourlyLimit) : undefined,
        senderId,
      });

      resetForm();
      onClose();
      onSuccess();
    } catch (err: any) {
      onError(err.message || "Failed to schedule emails");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compose Campaign" maxWidth="max-w-3xl">
      <div className="space-y-5">
        {/* Sender selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Sender Account
          </label>
          <div className="flex gap-2">
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-200"
            >
              {loadingSenders ? (
                <option>Loading senders...</option>
              ) : senders.length === 0 ? (
                <option value="">No senders — create one →</option>
              ) : (
                senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </option>
                ))
              )}
            </select>
            <Button
              variant="secondary"
              size="md"
              onClick={handleCreateSender}
              loading={creatingSender}
            >
              + New
            </Button>
          </div>
        </div>

        {/* Subject */}
        <Input
          label="Subject"
          placeholder="Your email subject line..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />

        {/* Body */}
        <TextArea
          label="Body (HTML supported)"
          placeholder="<h1>Hello!</h1><p>Your email content here...</p>"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
        />

        {/* Recipients */}
        <CSVUploader emails={recipients} onEmailsParsed={setRecipients} />

        {/* Scheduling options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Start Time
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-200"
            />
          </div>

          <Input
            label="Delay Between Emails (ms)"
            type="number"
            placeholder="500"
            value={delayMs}
            onChange={(e) => setDelayMs(e.target.value)}
          />

          <Input
            label="Hourly Limit (optional)"
            type="number"
            placeholder="e.g. 50"
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(e.target.value)}
          />
        </div>

        {/* Summary */}
        {recipients.length > 0 && (
          <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
            <p className="text-sm text-violet-300">
              📧 <span className="font-semibold">{recipients.length}</span> email
              {recipients.length !== 1 ? "s" : ""} will be scheduled starting at{" "}
              <span className="font-semibold">
                {startTime ? new Date(startTime).toLocaleString() : "..."}
              </span>
              {parseInt(delayMs) > 0 && (
                <span>
                  {" "}with <span className="font-semibold">{delayMs}ms</span> delay between each
                </span>
              )}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-700/50">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            loading={submitting}
            disabled={recipients.length === 0 || !subject || !body || !senderId}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Schedule {recipients.length > 0 ? `${recipients.length} Email${recipients.length !== 1 ? "s" : ""}` : "Emails"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
