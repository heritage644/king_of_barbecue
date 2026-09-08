import { z } from 'zod';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

function loadDotEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 4; i += 1) {
    const file = path.join(dir, '.env');
    if (fs.existsSync(file)) {
      dotenv.config({ path: file });
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().startsWith('redis://').default('redis://127.0.0.1:6379'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z.string().default('false').transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('King of Barbecue <orders@kingofbarbecue.local>'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  loadDotEnv();
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid worker env: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  cached = parsed.data;
  return cached;
}
