FROM python:3.12-slim

# System dependencies:
#   gcc/g++     — needed by psycopg and other C-extension packages
#   libpq-dev   — needed by psycopg (PostgreSQL client library)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
