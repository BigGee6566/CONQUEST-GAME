// Loads the world-country catalogue into MongoDB and builds every model's indexes.
// Idempotent: re-running updates existing countries instead of duplicating them.
//   npm run seed
import { env } from '../src/config/env.js';
import { soldierValueForPopulation } from '../src/config/gameRules.js';
import { WORLD_COUNTRIES } from '../src/data/worldCountries.js';
import { connectDB, disconnectDB } from '../src/database/connection.js';
import * as models from '../src/models/index.js';
import { logger } from '../src/utils/logger.js';

async function seed() {
  await connectDB();

  const operations = WORLD_COUNTRIES.map((country) => ({
    updateOne: {
      filter: { code: country.code },
      update: { $set: { ...country, soldierValue: soldierValueForPopulation(country.population) } },
      upsert: true,
    },
  }));
  const result = await models.WorldCountry.bulkWrite(operations);
  logger.info(
    `Seeded ${WORLD_COUNTRIES.length} countries (${result.upsertedCount} new, ${result.modifiedCount} updated)`,
  );

  const indexed = Object.values(models).filter((value) => typeof value?.createIndexes === 'function');
  await Promise.all(indexed.map((Model) => Model.createIndexes()));
  logger.info(`Indexes ensured for ${indexed.map((Model) => Model.modelName).join(', ')}`);

  await seedDemoUser();
}

// Creates the examiners' login (or resets its password) when DEMO_* variables are set.
async function seedDemoUser() {
  const { DEMO_USERNAME, DEMO_EMAIL, DEMO_PASSWORD } = env;
  if (!DEMO_USERNAME || !DEMO_EMAIL || !DEMO_PASSWORD) {
    logger.info('DEMO_USERNAME/DEMO_EMAIL/DEMO_PASSWORD not set; skipping demo account');
    return;
  }
  const user = (await models.User.findOne({ email: DEMO_EMAIL.toLowerCase() }))
    ?? new models.User({ username: DEMO_USERNAME, email: DEMO_EMAIL });
  await user.setPassword(DEMO_PASSWORD);
  await user.save();
  logger.info(`Demo account ready: ${user.username} / ${user.email}`);
}

seed()
  .catch((err) => {
    logger.error(`Seeding failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
