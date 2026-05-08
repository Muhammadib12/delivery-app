import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

// Defines which transitions are allowed and by whom
const TRANSITIONS: Record<string, { from: OrderStatus[]; roles: string[] }> = {
  ACCEPTED_BY_RESTAURANT: {
    from: ['PENDING_RESTAURANT'],
    roles: ['RESTAURANT_OWNER', 'RESTAURANT_STAFF'],
  },
  REJECTED_BY_RESTAURANT: {
    from: ['PENDING_RESTAURANT'],
    roles: ['RESTAURANT_OWNER', 'RESTAURANT_STAFF'],
  },
  PREPARING: {
    from: ['ACCEPTED_BY_RESTAURANT'],
    roles: ['RESTAURANT_OWNER', 'RESTAURANT_STAFF'],
  },
  LOOKING_FOR_DRIVER: {
    from: ['ACCEPTED_BY_RESTAURANT', 'PREPARING'],
    roles: ['RESTAURANT_OWNER', 'RESTAURANT_STAFF'],
  },
  DRIVER_ASSIGNED: {
    from: ['DRIVER_OFFERED', 'LOOKING_FOR_DRIVER'],
    roles: ['DRIVER'],
  },
  DRIVER_ARRIVED_RESTAURANT: {
    from: ['DRIVER_ASSIGNED'],
    roles: ['DRIVER'],
  },
  PICKED_UP: {
    from: ['DRIVER_ARRIVED_RESTAURANT'],
    roles: ['DRIVER'],
  },
  ON_THE_WAY: {
    from: ['PICKED_UP'],
    roles: ['DRIVER'],
  },
  ARRIVED_CUSTOMER: {
    from: ['ON_THE_WAY'],
    roles: ['DRIVER'],
  },
  DELIVERED: {
    from: ['ARRIVED_CUSTOMER', 'ON_THE_WAY'],
    roles: ['DRIVER'],
  },
  CANCELLED: {
    from: ['PENDING_RESTAURANT'],
    roles: ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN'],
  },
};

export function assertValidTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
  role: string,
): void {
  const rule = TRANSITIONS[targetStatus];
  if (!rule) throw new BadRequestException(`ORDER_INVALID_STATUS`);
  if (!rule.from.includes(currentStatus))
    throw new BadRequestException(`ORDER_INVALID_STATUS`);
  if (!rule.roles.includes(role))
    throw new BadRequestException(`ORDER_INVALID_STATUS`);
}
