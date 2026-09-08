/**
 * Types for the standalone Assistant — a general DocIntel chatbot that is
 * NOT tied to a single comparison (unlike the grounded chat in the AI
 * Workspace). It can answer questions about how the app works and about the
 * signed-in user's own recent activity.
 */

export interface AssistantMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string; // ISO string
}

export interface AssistantConversationRecord {
  messages: AssistantMessage[];
  updatedAt: string;
}
