import { connectToDatabase } from "@/lib/db/mongodb";
import { ToleranceRuleModel, DEFAULT_TOLERANCE_RULES } from "@/lib/models/ToleranceRule";
import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { toleranceUpdateSchema } from "@/lib/api-utils/validation";
import { getCurrentUser } from "@/lib/auth/current-user";

function serialize(rule: {
  _id: unknown;
  field: string;
  type: string;
  value: number;
  unit: string;
  enabled: boolean;
  category: string;
  description: string;
}) {
  return {
    id: String(rule._id),
    field: rule.field,
    type: rule.type,
    value: rule.value,
    unit: rule.unit,
    enabled: rule.enabled,
    category: rule.category,
    description: rule.description,
  };
}

export const GET = withErrorHandling(async () => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  await connectToDatabase();

  let rules = await ToleranceRuleModel.find({}).sort({ createdAt: 1 });
  if (rules.length === 0) {
    rules = await ToleranceRuleModel.insertMany(DEFAULT_TOLERANCE_RULES);
  }

  return apiSuccess({ rules: rules.map(serialize) });
});

export const PUT = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = toleranceUpdateSchema.parse(await req.json());

  await connectToDatabase();

  const updated = await Promise.all(
    body.rules.map(async (rule) => {
      if (rule.id) {
        const doc = await ToleranceRuleModel.findByIdAndUpdate(
          rule.id,
          {
            field: rule.field,
            type: rule.type,
            value: rule.value,
            unit: rule.unit,
            enabled: rule.enabled,
            category: rule.category,
            description: rule.description ?? "",
          },
          { new: true, upsert: false }
        );
        if (doc) return doc;
      }
      return ToleranceRuleModel.create({
        field: rule.field,
        type: rule.type,
        value: rule.value,
        unit: rule.unit,
        enabled: rule.enabled,
        category: rule.category,
        description: rule.description ?? "",
      });
    })
  );

  await logAudit({
    action: "Tolerance Override",
    documentName: "Global Tolerance Rules",
    user: session.email,
    status: "warning",
    details: `${updated.length} tolerance rule(s) updated.`,
  });

  return apiSuccess({ rules: updated.map(serialize) });
});

export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const rule = toleranceUpdateSchema.shape.rules.element.parse(await req.json());

  await connectToDatabase();

  const created = await ToleranceRuleModel.create({
    field: rule.field,
    type: rule.type,
    value: rule.value,
    unit: rule.unit,
    enabled: rule.enabled,
    category: rule.category,
    description: rule.description ?? "",
  });

  await logAudit({
    action: "Tolerance Rule Created",
    documentName: "Global Tolerance Rules",
    user: session.email,
    status: "completed",
    details: `New rule added: ${created.field} (±${created.value}${created.unit}).`,
  });

  return apiSuccess({ rule: serialize(created) }, 201);
});

export const DELETE = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    throw ApiError.badRequest("A rule `id` query parameter is required.");
  }

  await connectToDatabase();

  const deleted = await ToleranceRuleModel.findByIdAndDelete(id);
  if (!deleted) {
    throw ApiError.notFound(`Tolerance rule ${id} not found.`);
  }

  await logAudit({
    action: "Tolerance Rule Deleted",
    documentName: "Global Tolerance Rules",
    user: session.email,
    status: "warning",
    details: `Rule removed: ${deleted.field}.`,
  });

  return apiSuccess({ id });
});
