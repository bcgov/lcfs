# Security Architecture

This document outlines the security architecture of the LCFS system, covering authentication, authorization, data protection, and other relevant aspects.

## 1. Identity and Access Management (IAM) - Keycloak

*   **Provider**: The LCFS application utilizes **Keycloak** for identity and access management. This is evidenced by the `keycloak-js` and `@react-keycloak/web` dependencies in the frontend application.
*   **Functionality**: Keycloak handles user registration, login (authentication), user management, and can provide fine-grained authorization services.
*   **Integration**: The frontend application integrates with Keycloak using OpenID Connect (OIDC) or SAML protocols (OIDC is more common for SPAs). The `keycloak-js` library allows the React frontend to:
    *   Redirect users to Keycloak for login.
    *   Receive and manage tokens (ID token, access token, refresh token) issued by Keycloak upon successful authentication.
    *   Initiate logout requests.
    *   Refresh access tokens silently.
*   **Single Sign-On (SSO)**: Keycloak enables SSO capabilities, allowing users to authenticate once and access multiple applications (if configured within the same Keycloak realm).

## 2. API Authentication & Authorization

*   **Mechanism**: The backend APIs (FastAPI) are secured using **JSON Web Tokens (JWT)**. These JWTs are typically **issued by Keycloak** after successful user authentication and then relayed by the frontend to the backend.
*   **Backend Validation**: The backend (`pyjwt` library) validates the JWTs received from the client. This involves:
    *   Verifying the token's signature against Keycloak's public keys (or a shared secret if symmetrically signed, though public key is more common for Keycloak).
    *   Checking standard claims like issuer (`iss`), audience (`aud`), and expiration time (`exp`).
*   **Flow**:
    1.  **Frontend Initiates Login**: The React frontend, using `@react-keycloak/web`, redirects the user to the Keycloak login page.
    2.  **User Authenticates with Keycloak**: The user provides credentials directly to Keycloak.
    3.  **Tokens Issued to Frontend**: Keycloak issues an ID token and an access token (JWT) to the frontend.
    4.  **Frontend Makes Authenticated Requests**: The React frontend includes the Keycloak-issued access token in the `Authorization` header (as a Bearer token) when making requests to the LCFS backend API.
    5.  **Backend Validates Token**: The FastAPI backend validates the access token (as described above).
    6.  **Authorization**: Upon successful token validation, the backend uses the claims within the JWT (e.g., user ID, roles like `realm_access.roles` or `resource_access.<client_id>.roles`) to perform authorization checks for the requested resource or operation. FastAPI's dependency injection can be used to enforce these checks.

## 3. Data Protection

*   **Data in Transit**: 
    *   Communication between the client (browser) and the frontend, and between the frontend and backend, should be secured using **HTTPS** (TLS/SSL). This is standard practice and typically configured at the load balancer or reverse proxy level in a production OpenShift environment.
    *   Internal communication between services (e.g., backend to database, backend to Redis) within the Docker/OpenShift network might be unencrypted by default in development (`docker-compose.yml`) but should be secured in production environments where possible (e.g., using SSL for database connections, Redis AUTH).
*   **Data at Rest**:
    *   **Database**: PostgreSQL offers various encryption options. It needs to be verified if features like Transparent Data Encryption (TDE) or column-level encryption are used. Passwords and other sensitive data within the database should be hashed (e.g., using `bcrypt` or `argon2`, though the specific library isn't yet identified).
    *   **Object Storage (MinIO)**: MinIO supports server-side encryption. Configuration should be checked.
    *   **Secrets Management**: Sensitive information like API keys, database passwords, JWT secret keys should be managed securely:
        *   In `docker-compose.yml` for local development, these are often plain text (e.g., `POSTGRES_PASSWORD: development_only`). This is acceptable for local dev but **not for production**.
        *   In OpenShift, secrets should be managed using OpenShift Secrets or a dedicated secrets management tool (e.g., HashiCorp Vault).

## 4. Component Security

*   **`db` (PostgreSQL)**: Access is controlled by username/password. Network access might be restricted.
*   **`redis`**: Access is controlled by a password (`REDIS_PASSWORD: development_only` in dev). Redis AUTH.
*   **`rabbitmq`**: Access is controlled by username/password.
*   **`minio`**: Access is controlled by root user/password (access key/secret key).

## 5. Input Validation

*   The use of `pydantic` in the FastAPI backend ensures strong input validation for API requests. This helps prevent common vulnerabilities like injection attacks (e.g., SQL injection, NoSQL injection) by ensuring that data conforms to expected schemas before being processed.

## 6. Potential Vulnerabilities / Areas for Further Investigation

*   **Cross-Site Scripting (XSS)**: Review frontend code to ensure proper output encoding and sanitization of user-supplied data.
*   **Cross-Site Request Forgery (CSRF)**: Check if CSRF protection mechanisms are implemented, especially if the frontend uses session cookies for authentication (though JWTs in headers are generally less susceptible if not mixed with cookies for auth).
*   **SQL Injection (SQLi)**: SQLAlchemy, when used correctly (avoiding raw SQL queries with unescaped user input), provides good protection. However, review code for any raw SQL usage.
*   **Dependency Vulnerabilities**: Regularly scan project dependencies (both frontend and backend) for known vulnerabilities using tools like `npm audit` (for frontend) and `safety` or `pip-audit` (for Python).
*   **Security Headers**: Ensure appropriate security headers (e.g., `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`) are set by the web server.
*   **Rate Limiting**: Consider implementing rate limiting on APIs to prevent abuse.
*   **OpenShift Security**: Review OpenShift configurations for network policies, pod security policies, and RBAC.

## 7. File Uploads (`clamav`)

*   The `docker-compose.yml` includes a commented-out `clamav` service. If used (e.g., in production), this would provide antivirus scanning for file uploads, adding a layer of security against malware.

---
*This section requires ongoing review and updates as the system evolves. Specific implementation details within the `backend/` and `frontend/` codebases, as well as OpenShift configurations, will provide more definitive information.* 