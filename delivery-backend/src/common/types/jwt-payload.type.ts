export interface JwtPayload {
  sub: string; // userId
  role: string; // UserRole enum value
  restaurantId?: string; // set for RESTAURANT_OWNER and RESTAURANT_STAFF
  iat?: number;
  exp?: number;
}
