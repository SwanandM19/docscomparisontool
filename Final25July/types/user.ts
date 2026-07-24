export type UserRole = "admin" | "user";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface UserRecord extends SessionUser {
  department: string | null;
  organization: string | null;
  phone: string | null;
  createdAt: string;
}
