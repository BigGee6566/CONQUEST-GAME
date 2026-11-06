import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

let supportsTransactions;

// Runs work(session) inside a multi-document transaction so a game turn, its battle and its events
// are saved together or not at all. Atlas clusters are replica sets and support this; a standalone
// local mongod does not, in which case work runs without a session.
export async function withTransaction(work) {
  if (supportsTransactions === undefined) {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    supportsTransactions = Boolean(hello.setName || hello.msg === 'isdbgrid');
    if (!supportsTransactions) logger.warn('MongoDB is a standalone server; saving without transactions');
  }
  if (!supportsTransactions) return work(null);
  return mongoose.connection.transaction((session) => work(session));
}
