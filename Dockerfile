# Small image: app uses only Python stdlib (see serve.py).
FROM python:3.12-alpine
WORKDIR /app
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["python", "serve.py"]
