\set ON_ERROR_STOP on

-- Required psql variables:
--   target_env
--   salt_phrase
--   first_names_json
--   last_names_json
--   org_prefixes_json
--   org_focuses_json
--   org_suffixes_json
--   street_names_json
--   street_types_json
--   cities_json
--   execute_changes (on|off)

BEGIN;

CREATE TABLE IF NOT EXISTS anonymizer_original_values (
    table_name text NOT NULL,
    record_id integer NOT NULL,
    column_name text NOT NULL,
    original_value text,
    create_date timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (table_name, record_id, column_name)
);

DO $$
DECLARE
    v_db_name text := current_database();
BEGIN
    -- Extra safety check against obvious production DB naming.
    IF v_db_name ILIKE '%prod%' THEN
        RAISE EXCEPTION 'Refusing to run anonymizer on database "%" because name appears production-like.', v_db_name;
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.mask_phone(seed integer, area text DEFAULT '250')
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT area || '-' || substr(num, 1, 3) || '-' || substr(num, 4, 4)
    FROM (
        SELECT lpad((seed % 10000000)::text, 7, '0') AS num
    ) s;
$$;

CREATE OR REPLACE FUNCTION pg_temp.org_name_hash(
    original_name text,
    salt_phrase text,
    org_id integer
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT substr(
        md5(lower(coalesce(original_name, '')) || ':' || coalesce(salt_phrase, '') || ':' || org_id::text),
        1,
        10
    );
$$;

INSERT INTO anonymizer_original_values (table_name, record_id, column_name, original_value)
SELECT 'organization', o.organization_id, v.col_name, v.col_value
FROM organization o
CROSS JOIN LATERAL (VALUES
    ('name', o.name),
    ('operating_name', o.operating_name),
    ('email', o.email),
    ('phone', o.phone),
    ('records_address', o.records_address),
    ('credit_market_contact_name', o.credit_market_contact_name),
    ('credit_market_contact_email', o.credit_market_contact_email),
    ('credit_market_contact_phone', o.credit_market_contact_phone)
) AS v(col_name, col_value)
ON CONFLICT (table_name, record_id, column_name) DO NOTHING;

INSERT INTO anonymizer_original_values (table_name, record_id, column_name, original_value)
SELECT 'organization_address', oa.organization_address_id, v.col_name, v.col_value
FROM organization_address oa
CROSS JOIN LATERAL (VALUES
    ('name', oa.name),
    ('street_address', oa.street_address),
    ('address_other', oa.address_other),
    ('city', oa.city),
    ('province_state', oa.province_state),
    ('country', oa.country),
    ('postalCode_zipCode', oa."postalCode_zipCode")
) AS v(col_name, col_value)
ON CONFLICT (table_name, record_id, column_name) DO NOTHING;

INSERT INTO anonymizer_original_values (table_name, record_id, column_name, original_value)
SELECT 'organization_attorney_address', oaa.organization_attorney_address_id, v.col_name, v.col_value
FROM organization_attorney_address oaa
CROSS JOIN LATERAL (VALUES
    ('name', oaa.name),
    ('street_address', oaa.street_address),
    ('address_other', oaa.address_other),
    ('city', oaa.city),
    ('province_state', oaa.province_state),
    ('country', oaa.country),
    ('postalCode_zipCode', oaa."postalCode_zipCode")
) AS v(col_name, col_value)
ON CONFLICT (table_name, record_id, column_name) DO NOTHING;

INSERT INTO anonymizer_original_values (table_name, record_id, column_name, original_value)
SELECT 'user_profile', up.user_profile_id, v.col_name, v.col_value
FROM user_profile up
CROSS JOIN LATERAL (VALUES
    ('keycloak_username', up.keycloak_username),
    ('keycloak_email', up.keycloak_email),
    ('email', up.email),
    ('phone', up.phone),
    ('mobile_phone', up.mobile_phone),
    ('first_name', up.first_name),
    ('last_name', up.last_name)
) AS v(col_name, col_value)
ON CONFLICT (table_name, record_id, column_name) DO NOTHING;

CREATE TEMP TABLE _dict_first_names AS
SELECT row_number() OVER ()::integer AS idx, value AS name
FROM jsonb_array_elements_text((:'first_names_json')::jsonb) AS t(value);

CREATE TEMP TABLE _dict_last_names AS
SELECT row_number() OVER ()::integer AS idx, value AS name
FROM jsonb_array_elements_text((:'last_names_json')::jsonb) AS t(value);

CREATE TEMP TABLE _dict_org_prefixes AS
SELECT row_number() OVER ()::integer AS idx, value AS name
FROM jsonb_array_elements_text((:'org_prefixes_json')::jsonb) AS t(value);

CREATE TEMP TABLE _dict_org_focuses AS
SELECT row_number() OVER ()::integer AS idx, value AS name
FROM jsonb_array_elements_text((:'org_focuses_json')::jsonb) AS t(value);

CREATE TEMP TABLE _dict_org_suffixes AS
SELECT row_number() OVER ()::integer AS idx, value AS name
FROM jsonb_array_elements_text((:'org_suffixes_json')::jsonb) AS t(value);

CREATE TEMP TABLE _dict_street_names AS
SELECT row_number() OVER ()::integer AS idx, value AS name
FROM jsonb_array_elements_text((:'street_names_json')::jsonb) AS t(value);

CREATE TEMP TABLE _dict_street_types AS
SELECT row_number() OVER ()::integer AS idx, value AS name
FROM jsonb_array_elements_text((:'street_types_json')::jsonb) AS t(value);

CREATE TEMP TABLE _dict_cities AS
SELECT row_number() OVER ()::integer AS idx, value AS name
FROM jsonb_array_elements_text((:'cities_json')::jsonb) AS t(value);

CREATE TEMP TABLE _dict_counts AS
SELECT 'first_names'::text AS dict_name, COUNT(*)::integer AS count FROM _dict_first_names
UNION ALL SELECT 'last_names', COUNT(*)::integer FROM _dict_last_names
UNION ALL SELECT 'org_prefixes', COUNT(*)::integer FROM _dict_org_prefixes
UNION ALL SELECT 'org_focuses', COUNT(*)::integer FROM _dict_org_focuses
UNION ALL SELECT 'org_suffixes', COUNT(*)::integer FROM _dict_org_suffixes
UNION ALL SELECT 'street_names', COUNT(*)::integer FROM _dict_street_names
UNION ALL SELECT 'street_types', COUNT(*)::integer FROM _dict_street_types
UNION ALL SELECT 'cities', COUNT(*)::integer FROM _dict_cities;

-- Organizations and organization-level contact information.
WITH org_dict AS (
    SELECT
        src.organization_id,
        op.name || ' ' || ofc.name || ' ' || os.name AS org_name,
        op2.name || ' ' || ofc2.name || ' ' || os2.name AS operating_name,
        fn.name || ' ' || ln.name AS contact_name,
        a.original_value AS original_name
    FROM organization src
    JOIN _dict_org_prefixes op
      ON op.idx = ((src.organization_id - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'org_prefixes')) + 1
    JOIN _dict_org_focuses ofc
      ON ofc.idx = (((src.organization_id * 3) - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'org_focuses')) + 1
    JOIN _dict_org_suffixes os
      ON os.idx = (((src.organization_id * 5) - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'org_suffixes')) + 1
    JOIN _dict_org_prefixes op2
      ON op2.idx = (((src.organization_id * 7) - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'org_prefixes')) + 1
    JOIN _dict_org_focuses ofc2
      ON ofc2.idx = (((src.organization_id * 11) - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'org_focuses')) + 1
    JOIN _dict_org_suffixes os2
      ON os2.idx = (((src.organization_id * 13) - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'org_suffixes')) + 1
    JOIN _dict_first_names fn
      ON fn.idx = (((src.organization_id * 17) - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'first_names')) + 1
    JOIN _dict_last_names ln
      ON ln.idx = (((src.organization_id * 19) - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'last_names')) + 1
    LEFT JOIN anonymizer_original_values a
      ON a.table_name = 'organization'
     AND a.column_name = 'name'
     AND a.record_id = src.organization_id
)
UPDATE organization o
SET
    name = CASE
        WHEN o.name IS NULL THEN NULL
        ELSE d.org_name || ' #' || pg_temp.org_name_hash(d.original_name, :'salt_phrase', o.organization_id)
    END,
    operating_name = CASE
        WHEN o.operating_name IS NULL THEN NULL
        ELSE d.operating_name
    END,
    email = CASE
        WHEN o.email IS NULL THEN NULL
        ELSE 'org' || o.organization_id::text || '@example.com'
    END,
    phone = CASE
        WHEN o.phone IS NULL THEN NULL
        ELSE pg_temp.mask_phone(o.organization_id, '250')
    END,
    records_address = CASE
        WHEN o.records_address IS NULL THEN NULL
        ELSE 'Records Address ' || lpad(o.organization_id::text, 4, '0')
    END,
    credit_market_contact_name = CASE
        WHEN o.credit_market_contact_name IS NULL THEN NULL
        ELSE d.contact_name
    END,
    credit_market_contact_email = CASE
        WHEN o.credit_market_contact_email IS NULL THEN NULL
        ELSE 'org-contact' || o.organization_id::text || '@example.com'
    END,
    credit_market_contact_phone = CASE
        WHEN o.credit_market_contact_phone IS NULL THEN NULL
        ELSE pg_temp.mask_phone(o.organization_id + 10000, '236')
    END,
    update_user = 'ANONYMIZER',
    update_date = now()
FROM org_dict d
WHERE d.organization_id = o.organization_id;

-- Organization addresses.
WITH oa_dict AS (
    SELECT
        src.organization_address_id,
        (100 + (src.organization_address_id % 900))::text || ' ' || sn.name || ' ' || st.name AS street_address,
        c.name AS city_name
    FROM organization_address src
    JOIN _dict_street_names sn
      ON sn.idx = ((src.organization_address_id - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'street_names')) + 1
    JOIN _dict_street_types st
      ON st.idx = (((src.organization_address_id * 3) - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'street_types')) + 1
    JOIN _dict_cities c
      ON c.idx = (((src.organization_address_id * 5) - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'cities')) + 1
)
UPDATE organization_address oa
SET
    name = CASE
        WHEN oa.name IS NULL THEN NULL
        ELSE 'Org Address ' || lpad(oa.organization_address_id::text, 4, '0')
    END,
    street_address = CASE
        WHEN oa.street_address IS NULL THEN NULL
        ELSE d.street_address
    END,
    address_other = CASE
        WHEN oa.address_other IS NULL THEN NULL
        ELSE 'Suite ' || (oa.organization_address_id % 100)::text
    END,
    city = CASE
        WHEN oa.city IS NULL THEN NULL
        ELSE d.city_name
    END,
    province_state = CASE
        WHEN oa.province_state IS NULL THEN NULL
        ELSE 'BC'
    END,
    country = CASE
        WHEN oa.country IS NULL THEN NULL
        ELSE 'Canada'
    END,
    "postalCode_zipCode" = CASE
        WHEN oa."postalCode_zipCode" IS NULL THEN NULL
        ELSE 'V0V 0V0'
    END,
    update_user = 'ANONYMIZER',
    update_date = now()
FROM oa_dict d
WHERE d.organization_address_id = oa.organization_address_id;

-- Organization attorney addresses.
WITH oaa_dict AS (
    SELECT
        src.organization_attorney_address_id,
        (200 + (src.organization_attorney_address_id % 800))::text || ' ' || sn.name || ' ' || st.name AS street_address,
        c.name AS city_name
    FROM organization_attorney_address src
    JOIN _dict_street_names sn
      ON sn.idx = ((src.organization_attorney_address_id - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'street_names')) + 1
    JOIN _dict_street_types st
      ON st.idx = (((src.organization_attorney_address_id * 7) - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'street_types')) + 1
    JOIN _dict_cities c
      ON c.idx = (((src.organization_attorney_address_id * 11) - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'cities')) + 1
)
UPDATE organization_attorney_address oaa
SET
    name = CASE
        WHEN oaa.name IS NULL THEN NULL
        ELSE 'Attorney Address ' || lpad(oaa.organization_attorney_address_id::text, 4, '0')
    END,
    street_address = CASE
        WHEN oaa.street_address IS NULL THEN NULL
        ELSE d.street_address
    END,
    address_other = CASE
        WHEN oaa.address_other IS NULL THEN NULL
        ELSE 'Unit ' || (oaa.organization_attorney_address_id % 100)::text
    END,
    city = CASE
        WHEN oaa.city IS NULL THEN NULL
        ELSE d.city_name
    END,
    province_state = CASE
        WHEN oaa.province_state IS NULL THEN NULL
        ELSE 'BC'
    END,
    country = CASE
        WHEN oaa.country IS NULL THEN NULL
        ELSE 'Canada'
    END,
    "postalCode_zipCode" = CASE
        WHEN oaa."postalCode_zipCode" IS NULL THEN NULL
        ELSE 'V0V 0V0'
    END,
    update_user = 'ANONYMIZER',
    update_date = now()
FROM oaa_dict d
WHERE d.organization_attorney_address_id = oaa.organization_attorney_address_id;

-- User identity and contact fields.
WITH up_dict AS (
    SELECT
        src.user_profile_id,
        fn.name AS first_name,
        ln.name AS last_name,
        regexp_replace(
            lower(fn.name || '.' || ln.name || '.' || lpad(src.user_profile_id::text, 4, '0')),
            '[^a-z0-9.]',
            '',
            'g'
        ) AS username_base
    FROM user_profile src
    JOIN _dict_first_names fn
      ON fn.idx = ((src.user_profile_id - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'first_names')) + 1
    JOIN _dict_last_names ln
      ON ln.idx = (((src.user_profile_id * 3) - 1) % (SELECT count FROM _dict_counts WHERE dict_name = 'last_names')) + 1
)
UPDATE user_profile up
SET
    keycloak_username = 'bceid.' || d.username_base,
    keycloak_email = CASE
        WHEN up.keycloak_email IS NULL THEN NULL
        ELSE d.username_base || '@example.com'
    END,
    email = CASE
        WHEN up.email IS NULL THEN NULL
        ELSE 'notify.' || d.username_base || '@example.com'
    END,
    phone = CASE
        WHEN up.phone IS NULL THEN NULL
        ELSE pg_temp.mask_phone(up.user_profile_id, '250')
    END,
    mobile_phone = CASE
        WHEN up.mobile_phone IS NULL THEN NULL
        ELSE pg_temp.mask_phone(up.user_profile_id + 50000, '236')
    END,
    first_name = CASE
        WHEN up.first_name IS NULL THEN NULL
        ELSE d.first_name
    END,
    last_name = CASE
        WHEN up.last_name IS NULL THEN NULL
        ELSE d.last_name
    END,
    update_user = 'ANONYMIZER',
    update_date = now()
FROM up_dict d
WHERE d.user_profile_id = up.user_profile_id;

-- Execution summary for logs.
SELECT
    (SELECT COUNT(*) FROM organization) AS organizations_processed,
    (SELECT COUNT(*) FROM organization_address) AS organization_addresses_processed,
    (SELECT COUNT(*) FROM organization_attorney_address) AS attorney_addresses_processed,
    (SELECT COUNT(*) FROM user_profile) AS users_processed,
    (SELECT COUNT(*) FROM anonymizer_original_values) AS backup_values_stored;

\if :execute_changes
COMMIT;
\else
ROLLBACK;
\echo 'Dry run complete. Changes were rolled back.'
\endif
