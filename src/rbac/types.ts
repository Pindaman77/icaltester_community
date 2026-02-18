export type AppRole = 'tester';

export type RoleRecord = {
  user_id: string;
  role: AppRole;
};

export function normalizeRole(value: string | null | undefined): AppRole {
  void value;
  return 'tester';
}

