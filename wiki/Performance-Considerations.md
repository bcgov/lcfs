# Performance Considerations

This document outlines performance considerations for the LCFS system and strategies employed or to be considered for optimization.

## 1. Backend Performance

*   **Framework**: FastAPI is a high-performance Python web framework, built on Starlette and Pydantic, designed for speed and efficiency.
*   **Asynchronous Operations**: The backend utilizes `asyncio` with `SQLAlchemy` (via `asyncpg`) and `aio-pika` (for RabbitMQ). This allows for non-blocking I/O operations, significantly improving throughput for I/O-bound tasks by handling many concurrent requests efficiently.
*   **Caching**: Redis is used as a caching layer (via `fastapi-cache2`) to store frequently accessed data and reduce database load. See [Caching Strategy](Caching-Strategy.md) for more details.
*   **Load Testing**: The `backend/performance/` directory contains a `locustfile.py`, indicating that Locust is used for load testing the backend APIs. This helps identify bottlenecks and validate performance under concurrent user load.
    *   **Further Investigation**: Review the `locustfile.py` and associated `readme.md` in `backend/performance/` to understand the specific scenarios tested and performance benchmarks.
*   **Database Optimization**:
    *   **Query Efficiency**: Ensure SQLAlchemy queries are optimized. Use `EXPLAIN ANALYZE` for complex queries to understand their execution plans.
    *   **Indexing**: Proper database indexing on frequently queried columns is crucial. This should be reviewed based on query patterns.
    *   **Connection Pooling**: SQLAlchemy uses connection pooling by default, which is efficient.
    *   **Eager-loading conventions** (repository layer, see [#4099](https://github.com/bcgov/lcfs/issues/4099) and [#4101](https://github.com/bcgov/lcfs/issues/4101)):
        *   `joinedload()` only for many-to-one / one-to-one relationships (organization, period, status, summary, fuel type, fuel code, ...). These cannot multiply the parent rows.
        *   Collections (`ComplianceReport.history`, the schedule collections, `FuelCode.*_transport_modes`) are loaded with `selectinload()`. Joining a collection repeats every parent column once per child row; joining two collections on the same query produces a cartesian product. `ComplianceReportRepository._get_history_load_option()` is the shared history loader.
        *   When a query already joins a table for its `WHERE`/`ORDER BY`, load the relationship from that join with `contains_eager()` instead of letting `joinedload()` add a second aliased copy (see `get_assessed_compliance_report_by_period`, `get_organization_fuel_supply_paginated`).
        *   Filtering on a related table without joining it makes SQLAlchemy add the table as a bare `FROM` entry (a cross join). `get_fuel_code_by_code_prefix` had this bug; always add the explicit `join()`.
        *   The reference-data collections on `FuelType` / `FuelCategory` (energy density, EER, additional and target CI) are served to forms by `get_fuel_supply_table_options` and are not loaded on `FuelSupply` rows. Loading a single fuel supply with those collections joined produced ~11.6 million rows on a development database.
    *   **Measured effect of the above** (development database: 1,496 compliance reports, 4,256 fuel supply rows; "cells" = rows x columns the driver transferred):

        | Query | Before | After |
        | --- | --- | --- |
        | `get_fuel_supply_by_id` | timed out (> 20 s), 6 collections joined | 7 ms, 768 cells |
        | `get_effective_fuel_supplies` (99 rows) | 440 ms, 25,501 rows / 2.36 M cells | 21 ms, 99 rows / 18 k cells |
        | `get_changelog_data` (fuel supplies) | 39 ms, 107 k cells | 26 ms, 21 k cells |
        | `get_compliance_report_chain` (10 versions) | 6,003 cells | 3,663 cells |
        | `get_compliance_report_by_id` | 1,305 cells | 585 cells |
        | `get_assessed_compliance_report_by_period` | 9 joins (period, org, summary joined twice) | 7 joins |

        Single-report fetches now issue one extra `SELECT ... IN` for history, so their wall time on a tiny local database is unchanged to slightly higher; the saving is proportional to history length x report width and grows with real data.
    *   **Indexes**: `compliance_report` has single-column indexes on `organization_id`, `compliance_period_id`, `current_status_id`, `transaction_id`, `assigned_analyst_id` and `compliance_report_group_uuid`, plus composites `(compliance_report_group_uuid, version, compliance_report_id)` and `(organization_id, compliance_period_id, version DESC)` (the latter covers the "latest assessed report for an org/period" lookups in one index scan instead of a BitmapAnd over two indexes).
*   **Efficient Data Structures**: Using Pydantic for data validation and serialization is generally efficient.

## 2. Frontend Performance

*   **Build Tool**: Vite provides fast cold starts and Hot Module Replacement (HMR) during development, and optimized builds for production (code splitting, tree shaking, asset optimization).
*   **Component Rendering (React)**:
    *   **Memoization**: Use `React.memo` for functional components and `shouldComponentUpdate` or `PureComponent` for class components to prevent unnecessary re-renders.
    *   **Virtualization**: For long lists or large tables, consider using windowing libraries (e.g., `react-window` or `react-virtualized`) if AG Grid's built-in virtualization isn't sufficient or applicable elsewhere.
    *   **Lazy Loading**: Use `React.lazy` and Suspense to code-split components and load them on demand, improving initial page load time.
*   **State Management**: Efficient use of Zustand and React Query. React Query helps avoid redundant data fetching and manages server state effectively.
*   **Bundle Size**: Regularly analyze the production bundle size (e.g., using `vite-plugin-inspect` or `rollup-plugin-visualizer`) to identify and optimize large dependencies.
*   **Browser Caching**: Ensure appropriate HTTP caching headers are set for static assets.
*   **Image Optimization**: Serve images in optimized formats (e.g., WebP) and sizes.
*   **Debouncing/Throttling**: For user inputs that trigger expensive operations (e.g., API calls in typeaheads), use debouncing or throttling.

## 3. ETL Performance (Apache NiFi)

*   **Flow Design**: Efficient NiFi flow design is critical. Avoid unnecessary processing, use appropriate processors, and optimize processor configurations.
*   **Back Pressure**: NiFi has built-in back-pressure mechanisms to prevent overwhelming downstream components or systems. Configure these appropriately.
*   **Concurrent Tasks**: Configure the number of concurrent tasks for processors based on available resources and the nature of the task.
*   **Resource Allocation**: Ensure NiFi, Zookeeper, and the source/target databases have adequate CPU, memory, and disk I/O resources.
*   **Batching**: Process data in batches where appropriate to reduce overhead.

## 4. Infrastructure & Network

*   **OpenShift Resource Requests/Limits**: Properly configure CPU and memory requests and limits for pods in OpenShift to ensure stable performance and efficient resource utilization.
*   **Network Latency**: Consider network latency between services, especially between the application and external services like Keycloak or remote databases.
*   **CDN**: For frontend static assets, using a Content Delivery Network (CDN) can significantly improve load times for geographically distributed users (though this depends on the OpenShift setup and if it's fronted by a CDN).

## General Considerations

*   **Monitoring**: Implement comprehensive monitoring (e.g., using Prometheus, Grafana, or OpenShift's built-in monitoring) to track key performance indicators (KPIs) like response times, error rates, resource utilization, and queue lengths. The presence of `prometheus-fastapi-instrumentator` in the backend suggests Prometheus metrics are available.
*   **Scalability**: Design components to be scalable, particularly the backend and database, to handle increasing load. OpenShift provides mechanisms for horizontal pod autoscaling.

---
*Performance is an ongoing concern. Regular testing, monitoring, and profiling are essential to identify and address bottlenecks as the system evolves and load changes.* 