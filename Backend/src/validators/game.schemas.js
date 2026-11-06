import { z } from 'zod';
import { GAME_STATUS } from '../config/gameRules.js';
import { countryCode, objectId, pageParams, searchText } from './common.js';

const soldiers = z.number().int('Soldiers must be a whole number').min(1).max(100_000);

export const createGameSchema = z.strictObject({
  homeCountry: countryCode,
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(80).optional(),
  visibility: z.enum(['public', 'private']).default('public'),
});

export const listGamesQuery = z.object({
  scope: z.enum(['mine', 'public']).default('public'),
  status: z.enum(Object.values(GAME_STATUS)).optional(),
  search: searchText,
  ...pageParams,
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const gameActionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('reinforce'),
    allocation: z.array(z.strictObject({ country: countryCode, soldiers })).min(1).max(10),
  }),
  z.strictObject({ type: z.literal('transfer'), from: countryCode, to: countryCode, soldiers }),
  z.strictObject({ type: z.literal('attack'), from: countryCode, to: countryCode }),
  z.strictObject({ type: z.literal('roll') }),
  z.strictObject({ type: z.literal('stop') }),
  z.strictObject({ type: z.literal('endTurn') }),
]);

export const npcStepSchema = z.strictObject({
  fastForward: z.boolean().default(false),
});

export const eventsQuery = z.object({
  after: z.coerce.number().int().min(0).default(0),
  // When set, returns only the most recent N events (initial page load).
  tail: z.coerce.number().int().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const battlesQuery = z.object({
  ...pageParams,
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const battleParams = z.object({ id: objectId, battleId: objectId });
