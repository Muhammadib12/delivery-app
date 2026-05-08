export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PrismaPagination {
  skip: number;
  take: number;
}

export function toPrismaPagination(query: PaginationQuery): PrismaPagination {
  const page = Math.max(1, query.page ?? 1);
  const take = Math.min(100, Math.max(1, query.limit ?? 20));
  return { skip: (page - 1) * take, take };
}

export function buildMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
