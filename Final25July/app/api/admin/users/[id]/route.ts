// [ADMIN-APPROVAL] This entire file is part of the admin-approval feature.
// Delete it (and the sibling app/api/admin/users/route.ts) to retire it.
import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/lib/models/User";
import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { requireAdmin } from "@/lib/auth/require-admin";

// Approves a pending user.
export const POST = withErrorHandling(
  async (_req: Request, context: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin();
    const { id } = await context.params;

    await connectToDatabase();

    const user = await UserModel.findById(id);
    if (!user) throw ApiError.notFound(`User ${id} not found.`);

    // [SEAT-LIMIT] Licensing control — NOT part of the admin-approval
    // feature and NOT removable alongside it. This is the actual technical
    // ceiling on how many accounts this deployment's license covers.
    const seatLimit = Number(process.env.MAX_APPROVED_USERS ?? Infinity);
    const approvedCount = await UserModel.countDocuments({ approved: true });
    if (approvedCount >= seatLimit) {
      throw ApiError.conflict(
        `Seat limit reached (${seatLimit} approved user${seatLimit === 1 ? "" : "s"}). Contact your account manager to increase your plan before approving more users.`
      );
    }

    user.approved = true;
    await user.save();

    await logAudit({
      action: "User Approved",
      documentName: user.email,
      user: admin.email,
      status: "completed",
      details: `Account ${user.email} approved and can now sign in.`,
    });

    return apiSuccess({ id, approved: true });
  }
);

// Rejects a pending user — since a pending account never had access to
// anything, rejection just removes the account outright rather than
// leaving a permanent "rejected" record.
export const DELETE = withErrorHandling(
  async (_req: Request, context: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin();
    const { id } = await context.params;

    await connectToDatabase();

    const user = await UserModel.findById(id);
    if (!user) throw ApiError.notFound(`User ${id} not found.`);
    if (user.approved) {
      throw ApiError.badRequest("Cannot reject an account that's already approved.");
    }

    await user.deleteOne();

    await logAudit({
      action: "User Rejected",
      documentName: user.email,
      user: admin.email,
      status: "warning",
      details: `Pending account ${user.email} was rejected and removed.`,
    });

    return apiSuccess({ id, rejected: true });
  }
);
