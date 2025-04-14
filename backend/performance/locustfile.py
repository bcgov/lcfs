from locust import HttpUser, task, between

TOKEN = ""
ORGANIZATION_ID = 1
REPORT_ID = 7


class QuickstartUser(HttpUser):
    wait_time = between(1, 5)

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
    def load_summary(self):
        self.client.get(
            f"/reports/{REPORT_ID}/summary",
            name="Load Summary",
        )
