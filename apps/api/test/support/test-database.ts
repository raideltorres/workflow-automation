import mongoose from 'mongoose';

const ISOLATED_DB_PATTERN = /-(integration|e2e)$/;
const SERVER_SELECTION_TIMEOUT_MS = 5000;

export const TEST_MONGODB_URI = process.env['MONGODB_TEST_URI'] ?? 'mongodb://127.0.0.1:27017';

/** Refuses anything that is not a dedicated test database, so tests can never wipe development data. */
export function assertIsolatedDatabase(dbName: string): void {
  if (!ISOLATED_DB_PATTERN.test(dbName)) {
    throw new Error(`Refusing to use "${dbName}": test databases must end in -integration or -e2e`);
  }
}

export async function connectTestDatabase(dbName: string): Promise<typeof mongoose> {
  assertIsolatedDatabase(dbName);
  try {
    await mongoose.connect(TEST_MONGODB_URI, { dbName, serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
  } catch (error) {
    throw new Error(`MongoDB is not reachable at ${TEST_MONGODB_URI}. Start it with \`npm run db\`.`, {
      cause: error,
    });
  }
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  return mongoose;
}

export async function clearDatabase(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Test database is not connected');
  assertIsolatedDatabase(db.databaseName);
  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export async function disconnectTestDatabase(): Promise<void> {
  await mongoose.disconnect();
}
