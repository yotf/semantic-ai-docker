# Scholar Search

A web application that searches and compares results from PubMed and Semantic Scholar.

## Local Development with Docker

### Prerequisites

- Docker
- Docker Compose

### Running the Application

1. Clone the repository

```bash
git clone <repository-url>
cd semantic-ai-docker
```

2. Start the containers

```bash
docker-compose up --build
```

3. Access the application:

- Frontend UI: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

4. To stop the application:

```bash
docker-compose down
```

### Local Development Without Docker

Backend:

```bash
cd backend
rye sync
rye run uvicorn src.backend.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000
```

### Backend

No environment variables required for local development.

## API Endpoints

### Search Papers

```http
POST /api/search
```

Request body:

```json
{
  "pubmed_query": "string",
  "semantic_query": "string",
  "date_start": "YYYY-MM-DD",
  "date_end": "YYYY-MM-DD"
}
```

### Export Results

```http
GET /api/export/{search_id}
```

## Architecture

- Frontend:
  - React + Vite
  - TypeScript
  - TailwindCSS
  - shadcn/ui components
  - React Query
- Backend:
  - FastAPI
  - Python
  - PubMed API integration
  - Semantic Scholar API integration
- Deployment:
  - Docker
  - Nginx

## Project Structure

```
scholar-search/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── requirements.txt
│   └── src/
│       └── backend/
│           ├── __init__.py
│           └── main.py
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    └── src/
```

## Troubleshooting

### Common Issues

1. Port Conflicts

```bash
# Check if ports are in use
lsof -i :3000
lsof -i :8000

# Change ports in docker-compose.yml if needed
```

2. Docker Build Issues

```bash
# Clean Docker cache
docker system prune -a

# Rebuild containers
docker-compose up --build
```

3. API Connection Issues

- Verify backend is running (`http://localhost:8000/docs`)
- Check frontend environment variables
- Ensure CORS settings are correct in backend

### Development Tips

1. Backend Development

- Use FastAPI's automatic documentation at `/docs`
- Enable debug mode for more detailed errors
- Check logs with `docker-compose logs backend`

2. Frontend Development

- React Developer Tools for component debugging
- Network tab in browser dev tools for API calls
- Use React Query devtools for cache inspection
