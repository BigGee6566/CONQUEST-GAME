import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// or mongodb+srv:// connection string'),
  MONGODB_DB_NAME: z.string().min(1).default('conquest'),
  // Public DNS used only if the local DNS server cannot resolve the Atlas mongodb+srv record.
  DNS_FALLBACK_SERVERS: z.string().default('1.1.1.1,8.8.8.8'),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  GROQ_API_KEY: z.string().optional(),
  // Groq retired the Llama 3.x chat models for free/developer plans on 16 Aug 2026 and recommends
  // gpt-oss as the replacement. Fallbacks are tried in order if a model is retired or missing.
  GROQ_MODEL: z.string().min(1).default('openai/gpt-oss-20b'),
  GROQ_FALLBACK_MODELS: z.string().default('openai/gpt-oss-120b'),
  // Optional demo account created by `npm run seed` for the examiners.
  DEMO_USERNAME: z.string().optional(),
  DEMO_EMAIL: z.string().optional(),
  DEMO_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;

export const env = Object.freeze({
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  dnsFallbackServers: raw.DNS_FALLBACK_SERVERS.split(',')
    .map((server) => server.trim())
    .filter(Boolean),
  hasGroq: Boolean(raw.GROQ_API_KEY?.trim()),
  groqFallbackModels: raw.GROQ_FALLBACK_MODELS.split(',')
    .map((model) => model.trim())
    .filter(Boolean),
});
