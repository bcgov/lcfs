# ETL Overview
This project sets up Apache NiFi along with two PostgreSQL databases, TFRS and LCFS, using Docker. It enables data migration between these databases via NiFi.

## How to Use

**1. Run Containers:**

```bash
$ docker-compose up -d
```

Starts three containers: NiFi, TFRS, and LCFS databases.

**2. Access NiFi:**

Go to http://localhost:8080/nifi/


**3. Load NiFi Template:**

In the NiFi UI, upload your template via the Upload Template button in the Operate section.

You can find the template under `templates` directory.

Drag the template onto the canvas.

**4. Configure Databases:**

* In NiFi, click on the Configuration gear in the Operate Box
* Switch to the Controller Services Tab
* Click the configure button on the LCFS and TFRS Databasepool rows to Edit them
* Switch to the properties tab and set "pass" as the password

**5. Enable Services:**

Click the lignting bolt next to all services to Enable them

**6. Import Databases:**

Import LCFS and TFRS databases into their respective containers using your preferred tool.


**7. Start NiFi Flow:**

Click the Start icon to begin the data flow.

## NiFi Monitoring

To monitor your NiFi data flow:

**1. View Flow Status:**
   - Check each processor and connection for real-time data on processed, queued, or penalized FlowFiles.
   - Click on components for detailed stats and performance metrics.

**2. Enable Bulletins:**
   - Configure bulletins to receive alerts (INFO, WARN, ERROR) for any issues that require attention.

**3. Use Data Provenance:**
   - Track the lineage of each FlowFile to see its origin, processing steps, and final destination.

**4. Monitor System Health:**
   - Use the **Summary** tab to check overall system health, including memory usage, thread activity, and performance.

## Error Handling
If any records cannot be added to the databases, they will be logged and stored in the `nifi_output` directory.

You can access these failed records for further inspection or troubleshooting.