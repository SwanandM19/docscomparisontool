import { v4 as uuid } from "uuid";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ComparisonModel } from "@/lib/models/Comparison";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { chatRequestSchema } from "@/lib/api-utils/validation";
import { generateChatReply } from "@/lib/ai/chat";
import { getCurrentUser } from "@/lib/auth/current-user";

export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = chatRequestSchema.parse(await req.json());

  await connectToDatabase();

  const comparison = await ComparisonModel.findById(body.comparisonId);
  if (!comparison) {
    throw ApiError.notFound(`Comparison ${body.comparisonId} not found.`);
  }

  const userMessage = {
    id: uuid(),
    sender: "user" as const,
    text: body.message,
    timestamp: new Date().toISOString(),
  };
  comparison.chatHistory.push(userMessage);

  const replyText = await generateChatReply(comparison, comparison.chatHistory, body.message);

  const aiMessage = {
    id: uuid(),
    sender: "ai" as const,
    text: replyText,
    timestamp: new Date().toISOString(),
  };
  comparison.chatHistory.push(aiMessage);

  await comparison.save();

  return apiSuccess({
    comparisonId: comparison._id.toString(),
    message: aiMessage,
    chatHistory: comparison.chatHistory,
  });
});
