export interface JwtPayload {
  sub: number; // User ID
  email: string;
  role: string;
  roleId: number;
  iat?: number;
  exp?: number;
}
