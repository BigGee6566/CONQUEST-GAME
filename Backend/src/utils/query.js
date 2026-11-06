// Escapes user search text so it is matched literally inside a MongoDB $regex.
export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function paginate(query, countQuery, { page, limit }) {
  const [items, total] = await Promise.all([
    query.skip((page - 1) * limit).limit(limit),
    countQuery,
  ]);
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
