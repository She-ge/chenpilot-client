import { z } from 'zod';

// Email validation schema
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address');

// Password validation schema
export const passwordSchema = z
  .string()
  .min(1, 'Password is required')
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number');

// Name validation schema
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be less than 50 characters');

// Stellar address validation schema
export const stellarAddressSchema = z
  .string()
  .min(1, 'Address is required')
  .regex(/^G[A-Z0-9]{55}$/, 'Please enter a valid Stellar address');

// Keep for backward compatibility
export const starknetAddressSchema = stellarAddressSchema;

// Token amount validation schema
export const tokenAmountSchema = z
  .string()
  .min(1, 'Amount is required')
  .regex(/^\d+(\.\d+)?$/, 'Please enter a valid amount')
  .refine((val) => parseFloat(val) > 0, 'Amount must be greater than 0');

// Contact validation schemas
export const createContactSchema = z.object({
  name: nameSchema,
  address: stellarAddressSchema,
  tokenType: z.enum(['XLM', 'USDC', 'USDT', 'BTC', 'ETH'], {
    required_error: 'Please select a token type',
  }),
});

export const updateContactSchema = z.object({
  name: nameSchema.optional(),
  address: stellarAddressSchema.optional(),
  tokenType: z.enum(['XLM', 'USDC', 'USDT', 'BTC', 'ETH']).optional(),
});

// Authentication schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema.optional(),
}).refine((data) => {
  // Additional validation to ensure all required fields are present
  return data.email && data.password && typeof data.email === 'string' && typeof data.password === 'string';
}, {
  message: "All required fields must be provided",
  path: ["email"]
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Agent query validation
export const agentQuerySchema = z.object({
  query: z.string().min(1, 'Please enter a message').max(1000, 'Message is too long'),
});

// Utility functions for validation
export const validateEmail = (email: string): boolean => {
  try {
    emailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
};

export const validatePassword = (password: string): boolean => {
  try {
    passwordSchema.parse(password);
    return true;
  } catch {
    return false;
  }
};

export const validateStellarAddress = (address: string): boolean => {
  try {
    stellarAddressSchema.parse(address);
    return true;
  } catch {
    return false;
  }
};

// Keep for backward compatibility
export const validateStarknetAddress = validateStellarAddress;

export const validateTokenAmount = (amount: string): boolean => {
  try {
    tokenAmountSchema.parse(amount);
    return true;
  } catch {
    return false;
  }
};
