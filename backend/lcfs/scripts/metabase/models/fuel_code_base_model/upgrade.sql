-- Create Fuel Code Base View
CREATE OR REPLACE VIEW public.v_fuel_code_base AS
SELECT
    fuel_code.fuel_code_id AS "ID",
    fuel_code_prefix.prefix AS "Prefix",
    fuel_code.fuel_suffix AS "Suffix",
    fuel_code_status.status AS "Status",
    fuel_type.fuel_type AS "Fuel Type",
    fuel_code.company AS "Company",
    fuel_code.contact_name AS "Contact Name",
    fuel_code.contact_email AS "Contact Email",
    fuel_code.carbon_intensity AS "Carbon Intensity",
    fuel_code.edrms AS "EDRMS",
    fuel_code.last_updated AS "Last Updated",
    fuel_code.application_date AS "Application Date",
    fuel_code.approval_date AS "Approval Date",
    fuel_code.feedstock AS "Feedstock",
    fuel_code.feedstock_location AS "Feedstock Location",
    fuel_code.feedstock_misc AS "Feedstock Misc",
    fuel_code.fuel_production_facility_city AS "Facility City",
    fuel_code.fuel_production_facility_province_state AS "Facility State",
    fuel_code.fuel_production_facility_country AS "Facility Country",
    fuel_code.facility_nameplate_capacity AS "Facility Capacity",
    fuel_code.facility_nameplate_capacity_unit AS "Capacity Unit",
    fuel_code.former_company AS "Former Company",
    fuel_code.notes AS "Notes"
FROM
    fuel_code
    JOIN fuel_code_prefix ON fuel_code.prefix_id = fuel_code_prefix.fuel_code_prefix_id
    JOIN fuel_code_status ON fuel_code.fuel_status_id = fuel_code_status.fuel_code_status_id
    JOIN fuel_type ON fuel_code.fuel_type_id = fuel_type.fuel_type_id
WHERE
    fuel_code_status.status != 'Deleted';

-- Grant permissions
GRANT SELECT ON public.v_fuel_code_base TO basic_lcfs_reporting_role;

GRANT SELECT ON 
    public.fuel_code, 
    public.fuel_code_prefix, 
    public.fuel_code_status, 
    public.fuel_type 
TO basic_lcfs_reporting_role;