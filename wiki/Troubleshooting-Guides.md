# Troubleshooting Guides

This page provides troubleshooting tips for common issues encountered during development, deployment, or operation of the LCFS system. This is part of the requirements for tickets #2409 and #2410.

## 1. Development Environment Setup Issues

### Docker / Docker Compose
*   **Issue**: `docker-compose up` fails with errors related to port conflicts.
    *   **Solution**: Check if another service on your machine is using the required ports (e.g., 3000, 8000, 5432, 6379). Stop the conflicting service or change the port mappings in the `docker-compose.yml` for local development (remember to change it back or use environment variables if committing).
*   **Issue**: Docker images fail to build.
    *   **Solution**: 
        *   Check Dockerfile syntax.
        *   Ensure base images are accessible.
        *   Look for errors in `apt-get install`, `npm install`, or `poetry install` steps within the Docker build process.
        *   Try `docker-compose build --no-cache` to rebuild without using cached layers.
*   **Issue**: Containers start but application is not accessible (e.g., `localhost:3000` or `localhost:8000` not responding).
    *   **Solution**: 
        *   Check container logs: `docker-compose logs frontend` or `docker-compose logs backend`.
        *   Ensure correct port mappings in `docker-compose.yml`.
        *   Verify the application inside the container started correctly (e.g., Vite dev server, Uvicorn).

### Backend (Poetry)
*   **Issue**: `poetry install` fails.
    *   **Solution**: 
        *   Ensure Python version matches `backend/.python-version`.
        *   Check `pyproject.toml` for syntax errors or incompatible dependencies.
        *   Try deleting `poetry.lock` and `backend/.venv` (if it exists) and running `poetry install` again.
        *   Look for specific error messages related to package compilation (might need system-level build dependencies).
*   **Issue**: Pre-commit hooks fail.
    *   **Solution**: Read the output from the failing hook. It usually indicates the file and the issue (e.g., formatting error from Black, linting error from Flake8). Fix the issue and try committing again.

### Frontend (npm/Vite)
*   **Issue**: `npm install` fails.
    *   **Solution**: 
        *   Check Node.js and npm versions.
        *   Delete `node_modules/` and `package-lock.json` and try `npm install` again.
        *   Look for network issues or specific package errors.
*   **Issue**: `npm run dev` fails or frontend doesn't load correctly.
    *   **Solution**: 
        *   Check the browser console for JavaScript errors.
        *   Check the Vite dev server output in your terminal for errors.
        *   Ensure environment variables (if any, via `.env` files) are correctly set.

## 2. Application Runtime Issues

### API Errors (4xx, 5xx)
*   **Solution**: 
    *   Check backend logs (`docker-compose logs backend` or OpenShift pod logs) for detailed error messages and stack traces.
    *   For 401/403 errors, verify JWTs and Keycloak integration.
    *   For 400/422 errors, check request payloads against Pydantic models and API expectations.
    *   For 5xx errors, this usually indicates an unhandled exception in the backend.

### Database Issues
*   **Issue**: Cannot connect to database.
    *   **Solution**: Verify database container is running, connection strings are correct (host, port, user, password, dbname), and network connectivity (e.g., Docker networks, OpenShift services).
*   **Issue**: Alembic migration errors.
    *   **Solution**: Carefully read the Alembic error. You might need to resolve conflicts in migration scripts or manually adjust the database schema in dev environments (use with caution).

### ETL Process Failures (NiFi)
*   **Solution**: 
    *   Check the NiFi UI for processor status, bulletins, and error messages.
    *   Inspect logs in `etl/nifi_output/` for failed records.
    *   Verify database connections for TFRS and LCFS within NiFi controller services.
    *   Consult `etl/readme.md` and `etl/data-migration.sh` logs if using the script.

## 3. OpenShift Deployment Issues

*   **Issue**: Pods are not starting (CrashLoopBackOff, ImagePullBackOff).
    *   **Solution**: 
        *   `oc describe pod <pod_name>` to get events and details.
        *   `oc logs <pod_name>` (and `oc logs <pod_name> -p` for previous container) to check for application errors.
        *   For `ImagePullBackOff`, verify image registry, image name/tag, and pull secrets.
*   **Issue**: Application not accessible via Route.
    *   **Solution**: Check Route configuration, Service selectors, and ensure target pods are running and healthy.
*   **Issue**: Database migration job fails in OpenShift.
    *   **Solution**: Check logs of the migration Job/Pod. Ensure it has correct database credentials (via Secrets) and network access.

## 4. General Debugging Tips

*   **Check Logs First**: Backend logs, frontend browser console, NiFi logs, OpenShift pod logs are your first stop.
*   **Reproduce Consistently**: Try to find a minimal set of steps to reproduce the issue.
*   **Divide and Conquer**: Isolate the problem. Is it frontend, backend, database, Keycloak, NiFi, or infrastructure?
*   **Use Debuggers**: Python debugger for backend, browser dev tools for frontend.
*   **Consult Documentation**: Refer to the relevant pages in this wiki or official documentation for the tools/libraries involved.
*   **Ask for Help**: If you're stuck, ask a teammate. Describe the problem, what you've tried, and any relevant logs or error messages.

---
*This guide is a living document. Please add new common issues and solutions as they are discovered.* 