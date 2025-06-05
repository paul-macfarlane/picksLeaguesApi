# Picks League API

A TypeScript-based Express.js backend API for managing picks leagues.

## Prerequisites

- Node.js (v14 or higher)
- npm
- Docker and Docker Compose

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd picksLeagueAPI
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Update the `.env` file with your configuration values. The PostgreSQL configuration can be customized using these variables:

```env
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=picks_league
POSTGRES_PORT=5432
```

The `DATABASE_URL` will be automatically constructed using these values.

4. Start the PostgreSQL database:

```bash
docker-compose up -d
```

This will start a PostgreSQL instance using the configuration from your `.env` file. If no values are specified, it will use these defaults:
- Host: localhost
- Port: 5432
- Database: picks_league
- Username: user
- Password: password

The database data will persist in a Docker volume named `postgres_data`.

## Development

1. Start the database if it's not running:

```bash
docker-compose up -d
```

2. Start the development server:

```bash
npm run dev
```

The server will start on port 3000 by default (http://localhost:3000).

### Managing the Database

- To stop the database:
```bash
docker-compose down
```

- To view database logs:
```bash
docker-compose logs db
```

- To remove the database and its data:
```bash
docker-compose down -v
```

## Build

To build the project:

```bash
npm run build
```

## Production

To start the production server:

```bash
npm start
```
