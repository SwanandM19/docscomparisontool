import { connectToDatabase } from "@/lib/db/mongodb";
import { InvoiceModel } from "@/lib/models/Invoice";
import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { invoiceSaveSchema } from "@/lib/api-utils/validation";
import { calculateInvoice } from "@/lib/invoice/calculate";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { InvoiceDoc } from "@/lib/models/Invoice";

function serialize(record: InvoiceDoc) {
  return {
    _id: record._id.toString(),
    data: record.data,
    totals: record.totals,
    status: record.status,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Loads one invoice. Scoped to the owner — an invoice is only visible to the
 * account that created it.
 */
export const GET = withErrorHandling(
  async (_req: Request, context: { params: Promise<{ id: string }> }) => {
    const session = await getCurrentUser();
    if (!session) throw ApiError.unauthorized();

    const { id } = await context.params;

    await connectToDatabase();

    const record = await InvoiceModel.findById(id);
    if (!record) throw ApiError.notFound(`Invoice ${id} not found.`);
    if (record.createdBy !== session.email) throw ApiError.forbidden();

    return apiSuccess(serialize(record));
  }
);

/** Replaces a saved invoice with an edited version. */
export const PUT = withErrorHandling(
  async (req: Request, context: { params: Promise<{ id: string }> }) => {
    const session = await getCurrentUser();
    if (!session) throw ApiError.unauthorized();

    const { id } = await context.params;
    const body = invoiceSaveSchema.parse(await req.json());

    await connectToDatabase();

    const record = await InvoiceModel.findById(id);
    if (!record) throw ApiError.notFound(`Invoice ${id} not found.`);
    if (record.createdBy !== session.email) throw ApiError.forbidden();

    record.data = body.data;
    record.totals = calculateInvoice(body.data);
    record.status = body.status;
    await record.save();

    await logAudit({
      action: "Invoice Updated",
      documentName: `Invoice ${body.data.invoiceNumber}`,
      user: session.email,
      status: "completed",
      details: `Invoice updated · total ${body.data.currency} ${record.totals.grandTotal.toFixed(2)}`,
    });

    return apiSuccess(serialize(record));
  }
);

/** Deletes a saved invoice. */
export const DELETE = withErrorHandling(
  async (_req: Request, context: { params: Promise<{ id: string }> }) => {
    const session = await getCurrentUser();
    if (!session) throw ApiError.unauthorized();

    const { id } = await context.params;

    await connectToDatabase();

    const record = await InvoiceModel.findById(id);
    if (!record) throw ApiError.notFound(`Invoice ${id} not found.`);
    if (record.createdBy !== session.email) throw ApiError.forbidden();

    const invoiceNumber = record.data.invoiceNumber;
    await record.deleteOne();

    await logAudit({
      action: "Invoice Deleted",
      documentName: `Invoice ${invoiceNumber}`,
      user: session.email,
      status: "warning",
      details: "Saved invoice removed.",
    });

    return apiSuccess({ id });
  }
);
