// admin.audit.service.ts
import { AuditModel } from "@/modules/audit/audit.model";

class AdminAuditService {
  public listLogs = async (query: {
    search?: string;
    action?: string;
    status?: string;
    severity?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number | string;
    limit?: number | string;
  }) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    const filter: Record<string, any> = {};

    if (query.action) filter.action = query.action;
    if (query.status) filter.status = query.status;
    if (query.severity) filter.severity = query.severity;
    if (query.userId) filter.userId = query.userId;

    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
    }

    const search = (query.search ?? "").trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      filter.$or = [
        { trackedEmail: rx },
        { action: rx },
        { ip: rx },
        { requestId: rx },
      ];
    }

    const [docs, total] = await Promise.all([
      AuditModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditModel.countDocuments(filter),
    ]);

    return {
      logs: docs.map((d: any) => ({
        id: String(d._id),
        action: d.action,
        status: d.status,
        severity: d.severity,
        trackedEmail: d.trackedEmail,
        userId: d.userId,
        ip: d.ip,
        userAgent: d.userAgent,
        attemptCount: d.attemptCount,
        metadata: d.metadata,
        createdAt: d.createdAt,
        lastAttempt: d.lastAttempt,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  };
}

export default AdminAuditService;
