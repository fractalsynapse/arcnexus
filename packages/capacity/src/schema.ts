export const capacityMigration = {
  id: 'capacity/registration',
  sql: `
    CREATE SCHEMA arcnexus_capacity;
    CREATE TABLE arcnexus_capacity.registration_codes (
      digest text PRIMARY KEY, operator text NOT NULL
    );
    CREATE TABLE arcnexus_capacity.providers (
      id uuid PRIMARY KEY, operator text NOT NULL, name text NOT NULL,
      platform text NOT NULL, digest text NOT NULL UNIQUE,
      state text NOT NULL CHECK (state IN ('pending', 'admitted', 'revoked'))
    );
  `,
};
