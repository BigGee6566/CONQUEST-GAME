import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Country code must be two letters');

export const searchText = z.string().trim().max(60, 'Search is too long').optional();

export const pageParams = {
  page: z.coerce.number().int().min(1).default(1),
};

export const idParams = z.object({ id: objectId });
