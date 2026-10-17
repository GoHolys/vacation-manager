export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface PageMeta extends PageRequest {
  totalItems: number;
  totalPages: number;
}

export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

export const toOffset = ({ page, pageSize }: PageRequest): number => (page - 1) * pageSize;

export function buildPage<T>(data: T[], totalItems: number, request: PageRequest): Page<T> {
  return {
    data,
    meta: {
      ...request,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / request.pageSize),
    },
  };
}
