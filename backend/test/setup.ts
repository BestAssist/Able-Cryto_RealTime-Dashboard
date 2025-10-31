// Test setup file
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/test_db';
process.env.LOG_LEVEL = 'silent'; // Suppress logs during tests

