import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const BCRYPT_ROUNDS = 12;
const CASE_INSENSITIVE = Object.freeze({ locale: 'en', strength: 2 });

const statsSchema = new Schema(
  {
    gamesPlayed: { type: Number, default: 0, min: 0 },
    gamesWon: { type: Number, default: 0, min: 0 },
    gamesLost: { type: Number, default: 0, min: 0 },
    battlesFought: { type: Number, default: 0, min: 0 },
    battlesWon: { type: Number, default: 0, min: 0 },
    countriesConquered: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username must be at most 20 characters'],
      match: [/^[A-Za-z0-9_]+$/, 'Username may only contain letters, numbers and underscores'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email address is invalid'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['player', 'admin'], default: 'player' },
    stats: { type: statsSchema, default: () => ({}) },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        delete ret._id;
        return ret;
      },
    },
  },
);

userSchema.index({ username: 1 }, { unique: true, collation: CASE_INSENSITIVE });
userSchema.index({ email: 1 }, { unique: true });

userSchema.virtual('winRate').get(function winRate() {
  const { gamesPlayed, gamesWon } = this.stats ?? {};
  return gamesPlayed ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
});

userSchema.methods.setPassword = async function setPassword(plainPassword) {
  this.passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
};

userSchema.methods.comparePassword = function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// Accepts either a username or an email; usernames match case-insensitively via the index collation.
userSchema.statics.findByLogin = function findByLogin(identifier) {
  const filter = identifier.includes('@')
    ? { email: identifier.trim().toLowerCase() }
    : { username: identifier.trim() };
  return this.findOne(filter).collation(CASE_INSENSITIVE).select('+passwordHash');
};

export const User = model('User', userSchema);
