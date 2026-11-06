import { REGIONS, soldierValueForPopulation } from '../config/gameRules.js';
import { WORLD_COUNTRIES } from '../data/worldCountries.js';
import { WorldCountry } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { escapeRegex, paginate } from '../utils/query.js';

const SORTS = {
  name: { name: 1 },
  '-name': { name: -1 },
  population: { population: 1 },
  '-population': { population: -1 },
  soldierValue: { soldierValue: 1, name: 1 },
  '-soldierValue': { soldierValue: -1, name: 1 },
};

// Shared across requests on a warm instance so the empty-collection check runs once.
let catalogReady = null;

// Loads the bundled country list the first time the collection is found empty, so a fresh
// database (local, Vercel, the examiners') works without anyone remembering `npm run seed`.
// $setOnInsert only adds missing countries; it never overwrites existing ones.
export function ensureCountryCatalog() {
  catalogReady ??= (async () => {
    if ((await WorldCountry.estimatedDocumentCount()) > 0) return;
    logger.warn(`worldcountries is empty; loading the bundled list of ${WORLD_COUNTRIES.length} countries`);
    await WorldCountry.bulkWrite(WORLD_COUNTRIES.map((country) => ({
      updateOne: {
        filter: { code: country.code },
        update: { $setOnInsert: { ...country, soldierValue: soldierValueForPopulation(country.population) } },
        upsert: true,
      },
    })));
  })().catch((err) => {
    catalogReady = null;
    throw err;
  });
  return catalogReady;
}

export async function listCountries({ search, region, minSoldiers, maxSoldiers, sort, page, limit }) {
  await ensureCountryCatalog();
  const filter = {};
  if (region) filter.region = region;
  if (minSoldiers || maxSoldiers) {
    filter.soldierValue = {
      ...(minSoldiers && { $gte: minSoldiers }),
      ...(maxSoldiers && { $lte: maxSoldiers }),
    };
  }
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { code: search.toUpperCase() }];
  }

  const result = await paginate(
    WorldCountry.find(filter).sort(SORTS[sort]),
    WorldCountry.countDocuments(filter),
    { page, limit },
  );
  return { ...result, items: result.items.map((c) => c.toJSON()), regions: REGIONS };
}

export async function getCountry(code) {
  await ensureCountryCatalog();
  const country = await WorldCountry.findOne({ code });
  if (!country) throw ApiError.notFound(`No country with code ${code}`);
  return country.toJSON();
}

// The pool new games draw from.
export async function loadCatalog() {
  await ensureCountryCatalog();
  return WorldCountry.find({}, 'code name region population soldierValue').lean();
}
