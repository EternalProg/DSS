# DSS: Distance Learning Platform Selection

Baseline decision support system for storing alternatives, criteria, and evaluations. The analytics block is not implemented yet, but a placeholder API endpoint `/api/analytics` is provided.

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Ensure MongoDB is running (default `mongodb://127.0.0.1:27017`, database `dss_platform_selection`).

3. Seed the database:
   ```bash
   npm run seed
   ```

4. Start the server:
   ```bash
   npm start
   ```

5. Open in a browser:
   ```
   http://localhost:3000
   ```

## Project structure

- `server.js` - Express server entrypoint.
- `services/db.js` - MongoDB connection and indexes.
- `routes/` - REST API for alternatives, criteria, evaluations, and matrix.
- `public/` - UI assets.
- `scripts/seed.js` - Demo data.
- `docs/` - Architecture, ER diagram, and sample data.

## Documentation

- Architecture: `docs/architecture.md`
- ER diagram: `docs/er-diagram.mmd`
- Sample data: `docs/sample-data.md`
