# Low Carbon Fuel Services (LCFS)

An official online application designed for fuel suppliers in British Columbia to manage compliance obligations under the Low Carbon Fuels Act. This tool streamlines the process, ensuring efficiency and adherence to regulations.

## Project Components

- **Frontend**: Developed with React.js and Material-UI for base components, providing a modern and intuitive user interface.
- **Backend**: Built on FastAPI, the backend handles API requests, business logic, and data management.
- **Database**: Utilizes PostgreSQL for secure and reliable data storage.
- **Authentication**: Implements Keycloak for robust identity and access management.
- **Migrations**: Manages database changes over time with Alembic.
- **ORM**: Employs SQLAlchemy for database entity mapping.
- **Validation**: Utilizes Pydantic for data validation within FastAPI.
- **Bundling**: Leverages Webpack for optimizing frontend assets.
- **Testing**: Uses Jest for frontend unit tests and Cypress for end-to-end testing.

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js and npm (for frontend)
- Python 3.8+ and Poetry (for backend)

### Environment Setup

```bash
git clone https://github.com/bcgov/lcfs.git
cd lcfs
```

### Running with Docker

```bash
docker-compose up --build
```

This command will build and start the services defined in docker-compose.yml, setting up the frontend, backend, and the database.

### Frontend Development

The frontend application is bootstrapped with Create React App and interacts with the backend for data operations. 
The project utilizes government hosted authentication via Keycloak.

To start the frontend separately:

```bash
cd frontend
npm install
npm start
```

Access the UI at [http://localhost:3000](http://localhost:3000).

### Backend Development

The backend API is built using FastAPI and manages interactions with the database.

To run the backend locally with Poetry:

```bash
cd backend
poetry install
poetry run python -m lcfs
```

The API documentation is available at `/api/docs` once the server is running.

### Database Migrations with Alembic

```bash
alembic revision --autogenerate -m "Your message"
alembic upgrade head
```

Ensure the database service is active before running migrations.

## Testing

### Jest Tests

```bash
cd frontend
npm test
```

### Cypress End-to-End Tests

```bash
cd frontend
npx cypress open
```

### Backend Tests

```bash
cd backend
poetry run pytest
```

## Deployment

Refer to the provided deployment scripts and guidelines for moving to production.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

This project is under the Apache License 2.0 - see [LICENSE.md](LICENSE.md).

## Acknowledgements

- BC Government for the initiative to simplify compliance through technology.
- Contributors and maintainers of this project.
