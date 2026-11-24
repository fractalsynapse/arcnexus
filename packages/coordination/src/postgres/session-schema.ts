/** Make scoped journal views writable while preserving explicit imported identifiers. */
export const hostSessionMigration = {
  id: 'coordination/host-session',
  sql: `
    CREATE FUNCTION arcnexus_coordination.json_extract(content text, path text) RETURNS text
    LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
    RETURN jsonb_path_query_first(content::jsonb, path::jsonpath) #>> '{}';
    CREATE FUNCTION arcnexus_coordination.json_type(content text, path text) RETURNS text
    LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
    RETURN (
      SELECT CASE jsonb_typeof(v)
        WHEN 'string' THEN 'text'
        WHEN 'boolean' THEN v #>> '{}'
        ELSE jsonb_typeof(v)
      END FROM jsonb_path_query_first(content::jsonb, path::jsonpath) AS v
    );
    CREATE FUNCTION arcnexus_coordination.assign_sequence() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog AS $$
    BEGIN
      IF NEW.id IS NULL THEN
        EXECUTE format('SELECT COALESCE(MAX(id),0)+1 FROM arcnexus_coordination.%I WHERE project=$1', TG_TABLE_NAME)
          INTO NEW.id USING NEW.project;
      END IF;
      RETURN NEW;
    END
    $$;
    ALTER TABLE arcnexus_coordination.runs ALTER project SET DEFAULT current_setting('arcnexus.project', true);
    ALTER TABLE arcnexus_coordination.rounds ALTER project SET DEFAULT current_setting('arcnexus.project', true),
      ALTER finished SET DEFAULT 0;
    ALTER TABLE arcnexus_coordination.events ALTER project SET DEFAULT current_setting('arcnexus.project', true);
    CREATE TRIGGER assign_sequence BEFORE INSERT ON arcnexus_coordination.runs
      FOR EACH ROW EXECUTE FUNCTION arcnexus_coordination.assign_sequence();
    CREATE TRIGGER assign_sequence BEFORE INSERT ON arcnexus_coordination.rounds
      FOR EACH ROW EXECUTE FUNCTION arcnexus_coordination.assign_sequence();
    CREATE TRIGGER assign_sequence BEFORE INSERT ON arcnexus_coordination.events
      FOR EACH ROW EXECUTE FUNCTION arcnexus_coordination.assign_sequence();
  `,
};

export const lockHostedProject =
  "SELECT pg_advisory_xact_lock(hashtextextended('arcnexus/host/' || $1, 0))";
