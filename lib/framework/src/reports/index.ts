/**
 * Reports.
 *
 * Reports are the audit-friendly synthesis layer. Every report carries the
 * full chain of signals + provenance that led to its conclusions so a human
 * reviewer can trace any claim back to its source.
 */

import type { Confidence, Signal } from "../shared/index.js";

export type ReportKind = "candidate" | "role" | "organization" | "system";

export interface Report {
  id: string;
  title: string;
  kind: ReportKind;
  createdAt: string;
  summary: string;
  confidence?: Confidence;
  /** Ordered narrative sections (markdown). */
  sections: Array<{ heading: string; body: string }>;
  /** Signals that back the conclusions in this report. */
  evidence: Signal[];
}

export interface ReportStore {
  put(report: Report): Promise<void>;
  get(id: string): Promise<Report | null>;
  list(): Promise<Report[]>;
}

export class InMemoryReportStore implements ReportStore {
  private readonly reports = new Map<string, Report>();

  async put(report: Report): Promise<void> {
    this.reports.set(report.id, report);
  }

  async get(id: string): Promise<Report | null> {
    return this.reports.get(id) ?? null;
  }

  async list(): Promise<Report[]> {
    return Array.from(this.reports.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }
}
