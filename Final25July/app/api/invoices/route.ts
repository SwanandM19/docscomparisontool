import { connectToDatabase } from "@/lib/db/mongodb";
import { InvoiceModel } from "@/lib/models/Invoice";
import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { invoiceSaveSchema } from "@/lib/api-utils/validation";
import { calculateInvoice } from "@/lib/invoice/calculate";
import { getCurrentUser } from "@/lib/auth/current-user";

/** Lists the signed-in user's saved invoices, newest first. */
export const GET = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 25) || 25, 100);

  await connectToDatabase();

  const records = await InvoiceModel.find({ createdBy: session.email })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return apiSuccess({
    invoices: records.map((r) => ({
      _id: String(r._id),
      data: r.data,
      totals: r.totals,
      status: r.status,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
});

/**
 * Saves a new invoice. Totals are recomputed server-side from the line items
 * rather than trusted from the client, so a saved invoice's figures always
 * agree with its own data.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = invoiceSaveSchema.parse(await req.json());

  await connectToDatabase();

  const totals = calculateInvoice(body.data);

  const record = await InvoiceModel.create({
    data: body.data,
    totals,
    status: body.status,
    createdBy: session.email,
  });

  await logAudit({
    action: "Invoice Created",
    documentName: `Invoice ${body.data.invoiceNumber}`,
    user: session.email,
    status: "completed",
    details: `${body.status === "final" ? "Finalized" : "Draft"} invoice for ${
      body.data.buyer.name || "unnamed buyer"
    } · ${body.data.lineItems.length} line item(s) · total ${body.data.currency} ${totals.grandTotal.toFixed(2)}`,
  });

  return apiSuccess(
    {
      _id: record._id.toString(),
      data: record.data,
      totals: record.totals,
      status: record.status,
      createdBy: record.createdBy,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    },
    201
  );
});
