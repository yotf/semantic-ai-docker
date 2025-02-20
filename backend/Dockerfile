FROM python:3.12-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first (for better caching)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY ./src ./src

EXPOSE 8000

# Run the application
CMD ["uvicorn", "src.backend.main:app", "--host", "0.0.0.0", "--port", "8000"]