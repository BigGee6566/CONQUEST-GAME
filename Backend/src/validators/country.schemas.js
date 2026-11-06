import { z } from 'zod';
import { MAX_SOLDIER_VALUE, REGIONS } from '../config/gameRules.js';
import { countryCode, pageParams, searchText } from './common.js';

const soldierValue = z.coerce.number().int().min(1).max(MAX_SOLDIER_VALUE);

export const listCountriesQuery = z
  .object({
    search: searchText,
    region: z.enum(REGIONS).optional(),
    minSoldiers: soldierValue.optional(),
    maxSoldiers: soldierValue.optional(),
    sort: z.enum(['name', '-name', 'population', '-population', 'soldierValue', '-soldierValue']).default('name'),
    ...pageParams,
    limit: z.coerce.number().int().min(1).max(200).default(200),
  })
  .refine((q) => !q.minSoldiers || !q.maxSoldiers || q.minSoldiers <= q.maxSoldiers, {
    message: 'minSoldiers cannot be greater than maxSoldiers',
    path: ['minSoldiers'],
  });

export const countryParams = z.object({ code: countryCode });
