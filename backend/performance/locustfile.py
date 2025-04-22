from locust import HttpUser, task, between

TOKEN = ""
ORGANIZATION_ID = 1
REPORT_ID = 1


class QuickstartUser(HttpUser):
    wait_time = between(1, 3)
    notional_transfers = []
    fuels_for_other_use = []
    export_fuels = []
    fse = []

    def on_start(self):
        token = f"Bearer {TOKEN}"
        self.client.headers.update({f"Authorization": token})

    @task(10)
    def get_user(self):
        self.client.get(f"/users/current", name="Load User")

    @task(10)
    def get_notification_count(self):
        self.client.get(f"/notifications/count", name="Load Notification Count")

    @task(5)
    def view_reports(self):
        self.client.post(
            f"/organization/{ORGANIZATION_ID}/reports/list",
            name="Load Reports",
            json={"page": 1, "size": 10, "sortOrders": [], "filters": []},
        )

    @task(5)
    def load_organization(self):
        self.client.get(f"/organizations/{ORGANIZATION_ID}", name="Load Organization")

    @task(5)
    def view_report(self):
        self.client.get(
            f"/organization/{ORGANIZATION_ID}/reports/{REPORT_ID}",
            name="Load Report",
        )

    @task(5)
    def view_summary(self):
        self.client.get(
            f"/reports/{REPORT_ID}/summary",
            name="Load Summary",
        )

    @task(1)
    def export_report(self):
        self.client.get(
            f"/reports/{REPORT_ID}/export",
            name="Export Report",
        )

    @task(5)
    def list_reports_records(self):
        self.client.post(
            f"/fuel-supply/list-all",
            json={"complianceReportId": REPORT_ID, "changelog": True},
            name="List Fuel Supplies",
        )

        self.client.post(
            f"/final-supply-equipments/list-all",
            json={"complianceReportId": REPORT_ID, "changelog": True},
            name="List FSEs",
        )

        self.client.post(
            f"/allocation-agreement/list-all",
            json={"complianceReportId": REPORT_ID, "changelog": True},
            name="List Allocation Agreements",
        )

        self.client.post(
            f"/notional-transfers/list-all",
            json={"complianceReportId": REPORT_ID, "changelog": True},
            name="List Notional Transfers",
        )

        self.client.post(
            f"/other-uses/list-all",
            json={"complianceReportId": REPORT_ID, "changelog": True},
            name="List Other Uses",
        )

        self.client.post(
            f"/fuel-exports/list-all",
            json={"complianceReportId": REPORT_ID, "changelog": True},
            name="List Fuel Exports",
        )

    @task(5)
    def create_delete_fuel_supply(self):
        response = self.client.post(
            f"/fuel-supply/save",
            json={
                "complianceReportId": REPORT_ID,
                "fuelTypeId": 2,
                "fuelCategoryId": 2,
                "endUseId": 24,
                "provisionOfTheActId": 3,
                "quantity": 1000,
                "units": "m³",
            },
            name="Create Fuel Supply",
        )

        created_id = response.json()["fuelSupplyId"]
        group_uuid = response.json()["groupUuid"]

        self.client.post(
            f"/fuel-supply/save",
            json={
                "fuelSupplyId": created_id,
                "groupUuid": group_uuid,
                "complianceReportId": REPORT_ID,
                "fuelTypeId": 2,
                "fuelCategoryId": 2,
                "endUseId": 24,
                "provisionOfTheActId": 3,
                "quantity": 1000,
                "units": "m³",
                "deleted": True,
            },
            name="Delete Fuel Supply",
        )

    @task(5)
    def create_notional_transfer(self):
        response = self.client.post(
            f"/notional-transfers/save",
            json={
                "complianceReportId": REPORT_ID,
                "legalName": "Partner",
                "validationStatus": "pending",
                "addressForService": "Address",
                "fuelCategory": "Gasoline",
                "receivedOrTransferred": "Received",
                "quantity": 1000,
            },
            name="Create Notional Transfer",
        )

        created_id = response.json()["notionalTransferId"]
        group_uuid = response.json()["groupUuid"]
        self.notional_transfers.append([created_id, group_uuid])

    @task(5)
    def delete_notional_transfer(self):
        if len(self.notional_transfers) > 0:
            created_id, group_uuid = self.notional_transfers.pop()
            self.client.post(
                f"/notional-transfers/save",
                json={
                    "legalName": "Partner",
                    "addressForService": "Address",
                    "fuelCategory": "Gasoline",
                    "receivedOrTransferred": "Received",
                    "quantity": 1000,
                    "notionalTransferId": created_id,
                    "complianceReportId": REPORT_ID,
                    "deleted": True,
                    "groupUuid": group_uuid,
                    "version": 0,
                    "actionType": "CREATE",
                    "isNewSupplementalEntry": False,
                },
                name="Delete Notional Transfer",
            )

    @task(5)
    def create_fuel_for_other_use(self):
        response = self.client.post(
            f"/other-uses/save",
            json={
                "complianceReportId": REPORT_ID,
                "fuelType": "Biodiesel",
                "ciOfFuel": 100.21,
                "units": "L",
                "fuelCategory": "Diesel",
                "provisionOfTheAct": "Default carbon intensity - section 19 (b) (ii)",
                "validationStatus": "pending",
                "quantitySupplied": 1000,
                "expectedUse": "Heating oil",
            },
            name="Create Fuel for Other Use",
        )

        created_id = response.json()["otherUsesId"]
        group_uuid = response.json()["groupUuid"]
        self.fuels_for_other_use.append([created_id, group_uuid])

    @task(5)
    def delete_fuel_for_other_use(self):
        if len(self.fuels_for_other_use) > 0:
            created_id, group_uuid = self.fuels_for_other_use.pop()
            self.client.post(
                f"/other-uses/save",
                json={
                    "complianceReportId": REPORT_ID,
                    "otherUsesId": created_id,
                    "groupUuid": group_uuid,
                    "fuelType": "Biodiesel",
                    "ciOfFuel": 100.21,
                    "units": "L",
                    "fuelCategory": "Diesel",
                    "provisionOfTheAct": "Default carbon intensity - section 19 (b) (ii)",
                    "validationStatus": "pending",
                    "quantitySupplied": 1000,
                    "expectedUse": "Heating oil",
                    "deleted": True,
                },
                name="Delete Fuel for Other Use",
            )

    @task(5)
    def create_export_fuel(self):
        response = self.client.post(
            f"/fuel-exports/save",
            json={
                "complianceReportId": REPORT_ID,
                "fuelType": "CNG",
                "fuelTypeId": 2,
                "fuelCategory": "Diesel",
                "fuelCategoryId": 2,
                "endUseId": 24,
                "provisionOfTheActId": 3,
                "units": "m³",
                "quantity": 1000,
            },
            name="Create Fuel Export",
        )

        created_id = response.json()["fuelExportId"]
        group_uuid = response.json()["groupUuid"]
        self.export_fuels.append([created_id, group_uuid])

    @task(5)
    def delete_fuel_export(self):
        if len(self.export_fuels) > 0:
            created_id, group_uuid = self.export_fuels.pop()
            self.client.post(
                f"/fuel-exports/save",
                json={
                    "complianceReportId": REPORT_ID,
                    "fuelExportId": created_id,
                    "groupUuid": group_uuid,
                    "fuelType": "CNG",
                    "fuelTypeId": 2,
                    "fuelCategory": "Diesel",
                    "fuelCategoryId": 2,
                    "endUseId": 24,
                    "provisionOfTheActId": 3,
                    "units": "m³",
                    "quantity": 1000,
                },
                name="Delete Fuel Export",
            )
