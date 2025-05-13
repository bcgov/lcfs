# Security Guidelines for Developers

This document provides essential security guidelines and best practices for developers working on the LCFS project. Adhering to these guidelines is crucial for building and maintaining a secure application. This is part of the requirements for ticket #2410 and complements the main [Security Architecture](Security-Architecture.md) document.

## 1. General Principles

*   **Principle of Least Privilege**: Grant users and services only the permissions necessary to perform their tasks.
*   **Defense in Depth**: Implement multiple layers of security controls.
*   **Secure by Design**: Consider security implications at all stages of the development lifecycle.
*   **Keep Dependencies Updated**: Regularly update libraries and frameworks to patch known vulnerabilities.
*   **Never Trust User Input**: Validate and sanitize all data received from users or external systems.

## 2. Input Validation and Sanitization

*   **Backend (FastAPI with Pydantic)**:
    *   Utilize Pydantic models for rigorous request body validation. Define types, constraints (e.g., string lengths, numerical ranges), and custom validators.
    *   Sanitize any data that will be used in database queries (SQLAlchemy generally handles this for ORM usage, but be cautious with raw SQL), reflected in HTML (though the backend is primarily an API), or passed to shell commands.
*   **Frontend (React)**:
    *   Perform client-side validation for better UX, but **always** rely on backend validation as the authoritative source of truth.
    *   When rendering user-supplied content, ensure it is properly encoded/sanitized to prevent Cross-Site Scripting (XSS). React generally does a good job of escaping data rendered in JSX, but be careful when using `dangerouslySetInnerHTML` (avoid if possible) or injecting content into non-React parts of the DOM.

## 3. Authentication and Authorization

*   **Keycloak Integration**: Understand the OIDC flow and how JWTs (Access Tokens, ID Tokens) are used. See [Security Architecture](Security-Architecture.md).
*   **Backend API Endpoints**: Secure all sensitive endpoints. FastAPI dependencies can be used to enforce authentication (valid JWT) and authorization (checking roles/permissions from JWT claims).
*   **Frontend Route Protection**: Protect client-side routes that require authentication.
*   **Role-Based Access Control (RBAC)**: Implement RBAC based on roles defined in Keycloak and present in the JWT.
*   **Secure Token Handling**: 
    *   Frontend: Store tokens securely (Keycloak JS adapter handles this). Avoid storing tokens in `localStorage` if possible due to XSS risks.
    *   Backend: Do not log entire JWTs unless strictly necessary for debugging in a secure, controlled environment.

## 4. Secrets Management

*   **Never Hardcode Secrets**: Do not commit passwords, API keys, JWT signing keys, or other secrets directly into the codebase.
*   **Development**: Use environment variables (e.g., via `.env` files loaded by Pydantic settings in backend, Vite in frontend, or `docker-compose.yml`). Ensure `.env` files are in `.gitignore`.
*   **Production (OpenShift)**: Utilize OpenShift Secrets for managing all sensitive data. Access these secrets as environment variables in pods.
*   **Access to Secrets**: Limit access to production secrets to authorized personnel only.

## 5. Secure Coding Practices

*   **Prevent SQL Injection**: Primarily use SQLAlchemy ORM methods. If raw SQL is absolutely necessary, use parameterized queries or ensure all inputs are strictly validated and sanitized.
*   **Prevent Cross-Site Scripting (XSS)**:
    *   Backend (API): Ensure API responses that might be rendered as HTML by any client are appropriately encoded (though this is less common for JSON APIs).
    *   Frontend (React): React auto-escapes most data. Avoid `dangerouslySetInnerHTML`. Sanitize HTML from rich text editors if stored and re-rendered.
*   **Prevent Cross-Site Request Forgery (CSRF)**: JWTs in `Authorization` headers are generally not susceptible to traditional CSRF if cookies are not used for session management. If using cookies for any session-like purpose, implement CSRF token protection.
*   **Error Handling**: 
    *   Catch exceptions gracefully.
    *   Do not expose sensitive system information or stack traces in error messages to end-users (especially in production).
    *   Log detailed error information on the backend for debugging (see [Backend Logging Guide](Backend-Logging-Guide.md)).
*   **File Uploads**:
    *   Validate file types, sizes, and names.
    *   Scan uploaded files for malware (the `clamav` service is commented out in `docker-compose.yml` but indicates this consideration).
    *   Store uploaded files in a secure location (e.g., MinIO) outside the webroot, with appropriate access controls.
*   **Regular Expression (ReDoS)**: Be cautious with complex regular expressions on user-supplied input, as they can be vulnerable to ReDoS attacks. Test regexes for catastrophic backtracking.

## 6. Dependency Management

*   **Backend (Poetry)**: Regularly run `poetry show --outdated` and `poetry update` (cautiously) to update dependencies. Consider tools like `safety` or `pip-audit` for vulnerability scanning.
*   **Frontend (npm)**: Regularly run `npm outdated` and `npm update` (cautiously). Use `npm audit` to check for vulnerabilities.
*   **CI/CD Integration**: Incorporate automated dependency vulnerability scans into the [CI/CD Pipeline](CI-CD-Pipeline.md).

## 7. HTTPS

*   Always use HTTPS for all external communication (frontend to backend, browser to frontend, backend to external services). This is typically enforced at the OpenShift router/ingress level.

## 8. Security Headers

*   Ensure the web server (Nginx for frontend, Uvicorn/FastAPI for backend) is configured to send appropriate security headers:
    *   `Strict-Transport-Security (HSTS)`
    *   `Content-Security-Policy (CSP)` (can be complex to implement fully)
    *   `X-Content-Type-Options: nosniff`
    *   `X-Frame-Options: DENY` or `SAMEORIGIN`
    *   `Referrer-Policy`

## 9. OpenShift Security

*   Follow BC Gov OpenShift security best practices.
*   Use Network Policies to restrict pod-to-pod communication.
*   Define resource requests and limits for pods.
*   Minimize container privileges (run as non-root where possible).

## 10. Code Reviews

*   Security should be a key consideration during the [Code Review Process](Code-Review-Process.md). Reviewers should look for potential security flaws.

---
*Security is an ongoing effort. Stay informed about common vulnerabilities (e.g., OWASP Top 10) and best practices. If you discover a potential security vulnerability, report it responsibly according to team procedures.* 