export function paginateBalanced<T>(items: T[], maximumPerPage: number): T[][] {
  if (!items.length) return [];
  if (!Number.isInteger(maximumPerPage) || maximumPerPage < 1) {
    throw new Error('O limite por página deve ser um número inteiro positivo.');
  }

  const pageCount = Math.ceil(items.length / maximumPerPage);
  const baseSize = Math.floor(items.length / pageCount);
  const pagesWithExtraItem = items.length % pageCount;
  let cursor = 0;

  return Array.from({ length: pageCount }, (_, index) => {
    const pageSize = baseSize + (index < pagesWithExtraItem ? 1 : 0);
    const page = items.slice(cursor, cursor + pageSize);
    cursor += pageSize;
    return page;
  });
}
