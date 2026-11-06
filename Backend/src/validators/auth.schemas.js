import { z } from 'zod';

export const registerSchema = z.strictObject({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[A-Za-z0-9_]+$/, 'Username may only contain letters, numbers and underscores'),
  email: z.string().trim().toLowerCase().max(254).email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    // bcrypt only uses the first 72 bytes.
    .max(72, 'Password must be at most 72 characters')
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a number'),
});

export const loginSchema = z.strictObject({
  identifier: z.string().trim().min(3, 'Enter your username or email').max(254),
  password: z.string().min(1, 'Enter your password').max(72),
});
