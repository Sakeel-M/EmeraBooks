/**
 * Fetches all rows from a Supabase query by paginating with .range().
 * This bypasses the default 1,000-row limit.
 */
export async function fetchAllRows<T = any>(
  queryBuilder: any
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const allRows: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await queryBuilder.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allRows;
}
