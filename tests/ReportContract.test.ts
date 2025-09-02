import { describe, expect, it, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface Report {
  owner: string;
  timestamp: number;
  title: string;
  description: string;
  category: string;
  tags: string[];
  status: string;
  ecoImpactEstimate: number;
  visibility: boolean;
}

interface Collaborator {
  role: string;
  permissions: string[];
  addedAt: number;
}

interface HistoryEntry {
  updatedBy: string;
  changes: string;
  timestamp: number;
}

interface Attachment {
  hash: Uint8Array; // buff 32
  description: string;
  addedBy: string;
  timestamp: number;
}

interface Metrics {
  views: number;
  upvotes: number;
  downvotes: number;
  resolutionAttempts: number;
}

interface ContractState {
  reports: Map<number, Report>;
  reportCounter: Map<string, number>;
  reportCollaborators: Map<string, Collaborator>; // Key: `${reportId}-${collaborator}`
  reportHistory: Map<string, HistoryEntry>; // Key: `${reportId}-${version}`
  reportAttachments: Map<string, Attachment>; // Key: `${reportId}-${attachmentId}`
  reportMetrics: Map<number, Metrics>;
  blockHeight: number;
}

// Mock contract implementation
class ReportContractMock {
  private state: ContractState = {
    reports: new Map(),
    reportCounter: new Map(),
    reportCollaborators: new Map(),
    reportHistory: new Map(),
    reportAttachments: new Map(),
    reportMetrics: new Map(),
    blockHeight: 100,
  };

  private ERR_ALREADY_REGISTERED = 1;
  private ERR_UNAUTHORIZED = 2;
  private ERR_INVALID_PARAM = 3;
  private ERR_NOT_FOUND = 4;
  private MAX_TITLE_LEN = 100;
  private MAX_DESCRIPTION_LEN = 1000;
  private MAX_CATEGORY_LEN = 50;
  private MAX_TAGS = 10;
  private MAX_TAG_LEN = 20;

  private generateReportId(owner: string): number {
    const currentCount = this.state.reportCounter.get(owner) ?? 0;
    this.state.reportCounter.set(owner, currentCount + 1);
    return currentCount + 1; // Simplified for mock
  }

  private validateStringLen(s: string, maxLen: number): boolean {
    return s.length <= maxLen;
  }

  private isOwnerOrCollaborator(reportId: number, user: string, permission: string): boolean {
    const report = this.state.reports.get(reportId);
    if (!report) return false;
    if (user === report.owner) return true;
    const collabKey = `${reportId}-${user}`;
    const collab = this.state.reportCollaborators.get(collabKey);
    return collab ? collab.permissions.includes(permission) : false;
  }

  submitReport(
    owner: string,
    title: string,
    description: string,
    category: string,
    tags: string[],
    ecoImpactEstimate: number,
    visibility: boolean
  ): ClarityResponse<number> {
    if (!this.validateStringLen(title, this.MAX_TITLE_LEN)) return { ok: false, value: this.ERR_INVALID_PARAM };
    if (!this.validateStringLen(description, this.MAX_DESCRIPTION_LEN)) return { ok: false, value: this.ERR_INVALID_PARAM };
    if (!this.validateStringLen(category, this.MAX_CATEGORY_LEN)) return { ok: false, value: this.ERR_INVALID_PARAM };
    if (tags.length > this.MAX_TAGS) return { ok: false, value: this.ERR_INVALID_PARAM };
    if (!tags.every(tag => this.validateStringLen(tag, this.MAX_TAG_LEN))) return { ok: false, value: this.ERR_INVALID_PARAM };

    const reportId = this.generateReportId(owner);
    if (this.state.reports.has(reportId)) return { ok: false, value: this.ERR_ALREADY_REGISTERED };

    this.state.reports.set(reportId, {
      owner,
      timestamp: this.state.blockHeight,
      title,
      description,
      category,
      tags,
      status: "open",
      ecoImpactEstimate,
      visibility,
    });
    this.state.reportMetrics.set(reportId, { views: 0, upvotes: 0, downvotes: 0, resolutionAttempts: 0 });
    return { ok: true, value: reportId };
  }

  addCollaborator(
    owner: string,
    reportId: number,
    collaborator: string,
    role: string,
    permissions: string[]
  ): ClarityResponse<boolean> {
    const report = this.state.reports.get(reportId);
    if (!report) return { ok: false, value: this.ERR_NOT_FOUND };
    if (owner !== report.owner) return { ok: false, value: this.ERR_UNAUTHORIZED };
    if (permissions.length > 5) return { ok: false, value: this.ERR_INVALID_PARAM };
    const collabKey = `${reportId}-${collaborator}`;
    if (this.state.reportCollaborators.has(collabKey)) return { ok: false, value: this.ERR_ALREADY_REGISTERED };

    this.state.reportCollaborators.set(collabKey, {
      role,
      permissions,
      addedAt: this.state.blockHeight,
    });
    return { ok: true, value: true };
  }

  updateStatus(user: string, reportId: number, newStatus: string): ClarityResponse<boolean> {
    const report = this.state.reports.get(reportId);
    if (!report) return { ok: false, value: this.ERR_NOT_FOUND };
    if (!this.isOwnerOrCollaborator(reportId, user, "update-status")) return { ok: false, value: this.ERR_UNAUTHORIZED };

    this.state.reports.set(reportId, { ...report, status: newStatus });
    return { ok: true, value: true };
  }

  addAttachment(
    user: string,
    reportId: number,
    hash: Uint8Array,
    description: string
  ): ClarityResponse<number> {
    if (!this.state.reports.has(reportId)) return { ok: false, value: this.ERR_NOT_FOUND };
    if (!this.isOwnerOrCollaborator(reportId, user, "add-attachment")) return { ok: false, value: this.ERR_UNAUTHORIZED };

    const attachmentId = (this.state.reportCounter.get(user) ?? 0) + 1; // Reuse counter
    const attachKey = `${reportId}-${attachmentId}`;
    this.state.reportAttachments.set(attachKey, {
      hash,
      description,
      addedBy: user,
      timestamp: this.state.blockHeight,
    });
    return { ok: true, value: attachmentId };
  }

  recordHistory(
    user: string,
    reportId: number,
    changes: string,
    version: number
  ): ClarityResponse<boolean> {
    if (!this.state.reports.has(reportId)) return { ok: false, value: this.ERR_NOT_FOUND };
    if (!this.isOwnerOrCollaborator(reportId, user, "record-history")) return { ok: false, value: this.ERR_UNAUTHORIZED };

    const historyKey = `${reportId}-${version}`;
    this.state.reportHistory.set(historyKey, {
      updatedBy: user,
      changes,
      timestamp: this.state.blockHeight,
    });
    return { ok: true, value: true };
  }

  upvoteReport(reportId: number): ClarityResponse<boolean> {
    const metrics = this.state.reportMetrics.get(reportId);
    if (!metrics) return { ok: false, value: this.ERR_NOT_FOUND };
    const report = this.state.reports.get(reportId);
    if (!report?.visibility) return { ok: false, value: this.ERR_UNAUTHORIZED };

    this.state.reportMetrics.set(reportId, { ...metrics, upvotes: metrics.upvotes + 1 });
    return { ok: true, value: true };
  }

  downvoteReport(reportId: number): ClarityResponse<boolean> {
    const metrics = this.state.reportMetrics.get(reportId);
    if (!metrics) return { ok: false, value: this.ERR_NOT_FOUND };
    const report = this.state.reports.get(reportId);
    if (!report?.visibility) return { ok: false, value: this.ERR_UNAUTHORIZED };

    this.state.reportMetrics.set(reportId, { ...metrics, downvotes: metrics.downvotes + 1 });
    return { ok: true, value: true };
  }

  incrementView(user: string, reportId: number): ClarityResponse<boolean> {
    const metrics = this.state.reportMetrics.get(reportId);
    if (!metrics) return { ok: false, value: this.ERR_NOT_FOUND };
    const report = this.state.reports.get(reportId);
    if (!report) return { ok: false, value: this.ERR_NOT_FOUND };
    if (!this.isOwnerOrCollaborator(reportId, user, "view") && !report.visibility) return { ok: false, value: this.ERR_UNAUTHORIZED };

    this.state.reportMetrics.set(reportId, { ...metrics, views: metrics.views + 1 });
    return { ok: true, value: true };
  }

  incrementResolutionAttempt(user: string, reportId: number): ClarityResponse<boolean> {
    const metrics = this.state.reportMetrics.get(reportId);
    if (!metrics) return { ok: false, value: this.ERR_NOT_FOUND };
    if (!this.isOwnerOrCollaborator(reportId, user, "update-metrics")) return { ok: false, value: this.ERR_UNAUTHORIZED };

    this.state.reportMetrics.set(reportId, { ...metrics, resolutionAttempts: metrics.resolutionAttempts + 1 });
    return { ok: true, value: true };
  }

  getReport(reportId: number): ClarityResponse<Report | null> {
    return { ok: true, value: this.state.reports.get(reportId) ?? null };
  }

  getReportMetrics(reportId: number): ClarityResponse<Metrics | null> {
    return { ok: true, value: this.state.reportMetrics.get(reportId) ?? null };
  }

  getReportCollaborator(reportId: number, collaborator: string): ClarityResponse<Collaborator | null> {
    const key = `${reportId}-${collaborator}`;
    return { ok: true, value: this.state.reportCollaborators.get(key) ?? null };
  }

  getReportHistory(reportId: number, version: number): ClarityResponse<HistoryEntry | null> {
    const key = `${reportId}-${version}`;
    return { ok: true, value: this.state.reportHistory.get(key) ?? null };
  }

  getReportAttachment(reportId: number, attachmentId: number): ClarityResponse<Attachment | null> {
    const key = `${reportId}-${attachmentId}`;
    return { ok: true, value: this.state.reportAttachments.get(key) ?? null };
  }

  getUserReportCount(user: string): ClarityResponse<number> {
    return { ok: true, value: this.state.reportCounter.get(user) ?? 0 };
  }

  // Mock block height increment for testing
  incrementBlockHeight() {
    this.state.blockHeight += 1;
  }
}

// Test setup
const accounts = {
  owner: "owner",
  collaborator: "collaborator",
  user: "user",
};

describe("ReportContract", () => {
  let contract: ReportContractMock;

  beforeEach(() => {
    contract = new ReportContractMock();
  });

  it("should submit a new report successfully", () => {
    const result = contract.submitReport(
      accounts.owner,
      "Test Title",
      "Test Description",
      "e-waste",
      ["tag1", "tag2"],
      100,
      true
    );
    expect(result).toEqual({ ok: true, value: 1 });

    const report = contract.getReport(1);
    expect(report.value).toEqual(expect.objectContaining({
      owner: accounts.owner,
      title: "Test Title",
      status: "open",
      visibility: true,
    }));

    const metrics = contract.getReportMetrics(1);
    expect(metrics.value).toEqual({ views: 0, upvotes: 0, downvotes: 0, resolutionAttempts: 0 });
  });

  it("should prevent submission with invalid parameters", () => {
    const longTitle = "a".repeat(101);
    const result = contract.submitReport(
      accounts.owner,
      longTitle,
      "Desc",
      "Cat",
      [],
      0,
      true
    );
    expect(result).toEqual({ ok: false, value: 3 });
  });

  it("should add a collaborator", () => {
    contract.submitReport(accounts.owner, "Title", "Desc", "Cat", [], 0, true);
    const result = contract.addCollaborator(
      accounts.owner,
      1,
      accounts.collaborator,
      "editor",
      ["view", "update-status"]
    );
    expect(result).toEqual({ ok: true, value: true });

    const collab = contract.getReportCollaborator(1, accounts.collaborator);
    expect(collab.value).toEqual(expect.objectContaining({
      role: "editor",
      permissions: ["view", "update-status"],
    }));
  });

  it("should prevent non-owner from adding collaborator", () => {
    contract.submitReport(accounts.owner, "Title", "Desc", "Cat", [], 0, true);
    const result = contract.addCollaborator(
      accounts.user,
      1,
      accounts.collaborator,
      "editor",
      ["view"]
    );
    expect(result).toEqual({ ok: false, value: 2 });
  });

  it("should update status by owner or collaborator", () => {
    contract.submitReport(accounts.owner, "Title", "Desc", "Cat", [], 0, true);
    contract.addCollaborator(accounts.owner, 1, accounts.collaborator, "editor", ["update-status"]);

    let result = contract.updateStatus(accounts.collaborator, 1, "in-progress");
    expect(result).toEqual({ ok: true, value: true });

    const report = contract.getReport(1);
    expect(report.ok && typeof report.value !== "number" && report.value !== null && report.value.status).toBe("in-progress");

    result = contract.updateStatus(accounts.user, 1, "resolved");
    expect(result).toEqual({ ok: false, value: 2 });
  });

  it("should add attachment", () => {
    contract.submitReport(accounts.owner, "Title", "Desc", "Cat", [], 0, true);
    contract.addCollaborator(accounts.owner, 1, accounts.collaborator, "contributor", ["add-attachment"]);

    const hash = new Uint8Array(32);
    const result = contract.addAttachment(accounts.collaborator, 1, hash, "Photo of device");
    expect(result).toEqual({ ok: true, value: 1 });

    const attach = contract.getReportAttachment(1, 1);
    expect(attach.value).toEqual(expect.objectContaining({
      description: "Photo of device",
      addedBy: accounts.collaborator,
    }));
  });

  it("should record history", () => {
    contract.submitReport(accounts.owner, "Title", "Desc", "Cat", [], 0, true);
    const result = contract.recordHistory(accounts.owner, 1, "Updated description", 1);
    expect(result).toEqual({ ok: true, value: true });

    const history = contract.getReportHistory(1, 1);
    expect(history.value).toEqual(expect.objectContaining({
      updatedBy: accounts.owner,
      changes: "Updated description",
    }));
  });

  it("should handle upvotes and downvotes for public reports", () => {
    contract.submitReport(accounts.owner, "Title", "Desc", "Cat", [], 0, true);
    let result = contract.upvoteReport(1);
    expect(result).toEqual({ ok: true, value: true });

    let metrics = contract.getReportMetrics(1);
    expect(metrics.ok && typeof metrics.value !== "number" && metrics.value !== null && metrics.value.upvotes).toBe(1);

    result = contract.downvoteReport(1);
    expect(result).toEqual({ ok: true, value: true });
    metrics = contract.getReportMetrics(1);
    expect(metrics.ok && typeof metrics.value !== "number" && metrics.value !== null && metrics.value.downvotes).toBe(1);
  });

  it("should prevent votes on private reports", () => {
    contract.submitReport(accounts.owner, "Title", "Desc", "Cat", [], 0, false);
    const result = contract.upvoteReport(1);
    expect(result).toEqual({ ok: false, value: 2 });
  });

  it("should increment views for authorized users", () => {
    contract.submitReport(accounts.owner, "Title", "Desc", "Cat", [], 0, false);
    contract.addCollaborator(accounts.owner, 1, accounts.collaborator, "viewer", ["view"]);

    let result = contract.incrementView(accounts.collaborator, 1);
    expect(result).toEqual({ ok: true, value: true });
    let metrics = contract.getReportMetrics(1);
    expect(metrics.ok && typeof metrics.value !== "number" && metrics.value !== null && metrics.value.views).toBe(1);

    result = contract.incrementView(accounts.user, 1);
    expect(result).toEqual({ ok: false, value: 2 });
  });

  it("should increment resolution attempts by authorized users", () => {
    contract.submitReport(accounts.owner, "Title", "Desc", "Cat", [], 0, true);
    contract.addCollaborator(accounts.owner, 1, accounts.collaborator, "resolver", ["update-metrics"]);

    const result = contract.incrementResolutionAttempt(accounts.collaborator, 1);
    expect(result).toEqual({ ok: true, value: true });
    const metrics = contract.getReportMetrics(1);
    expect(metrics.ok && typeof metrics.value !== "number" && metrics.value !== null && metrics.value.resolutionAttempts).toBe(1);
  });

  it("should get user report count", () => {
    contract.submitReport(accounts.owner, "Title1", "Desc", "Cat", [], 0, true);
    contract.submitReport(accounts.owner, "Title2", "Desc", "Cat", [], 0, true);
    const count = contract.getUserReportCount(accounts.owner);
    expect(count).toEqual({ ok: true, value: 2 });
  });
});