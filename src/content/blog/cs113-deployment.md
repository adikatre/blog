---
title: 'CS113: Deployment, Docker, DNS & nginx'
description: 'How the Spring backend is packaged with Docker, exposed through nginx with TLS and WebSocket routing, and the GitHub Actions pipeline that builds and deploys the Jekyll frontend.'
pubDate: 'May 28 2026 12:00'
heroImage: '../../assets/cs113-deployment.jpg'
---

Deployment concepts demonstrated across `bathroom/`, `S3uploads/`, and `groups/chat/`.

**Source:** [Pirna-spring](https://github.com/adikatre/Pirna-spring) (Spring backend) · [Pirna-pages](https://github.com/adikatre/Pirna-pages) (frontend)

## 1. Docker — `Dockerfile` and `docker-compose.yml`

### Dockerfile

The project uses a minimal Docker image that builds the Spring Boot JAR inside the container and exposes both REST and WebSocket ports.

```dockerfile
## syntax=docker/dockerfile:1

FROM eclipse-temurin:21-jdk-alpine

WORKDIR /app

RUN apk update && apk upgrade && \
    apk add --no-cache git && \
    rm -rf /var/cache/apk/*

COPY . /app

RUN ./mvnw package

CMD ["java", "-jar", "target/spring-0.0.1-SNAPSHOT.jar"]

EXPOSE 8585
EXPOSE 8589
```

### Port Usage

#### `EXPOSE 8585`

Used by:

* `BathroomQueueApiController`
* `HallPassController`
* `S3FileApiController`
* REST endpoints in `GroupChatApiController`

#### `EXPOSE 8589`

Dedicated WebSocket port configured by:

* `ChatWebSocketPortConfig.java`
* `ChatWebSocketPortFilter.java`

Used for:

* STOMP/SockJS traffic
* `GroupChatWebSocketController`
* presence updates in `GroupChatPresenceService`

### Maven Build Inside Docker

```dockerfile
RUN ./mvnw package
```

Compiles:

* JPA repositories
* REST controllers
* WebSocket handlers
* service layers
* Hibernate entities

into a runnable Spring Boot JAR.

### Image Characteristics

The image intentionally remains minimal:

* no `HEALTHCHECK`
* no `VOLUME`
* no `ARG`

---

### `docker-compose.yml`

```yaml
version: '3'

services:
  web:
    image: java_springv1
    build: .

    ports:
      - "8585:8585"
      - "8589:8589"

    volumes:
      - ./volumes:/app/volumes

    restart: unless-stopped
```

### Compose Networking

#### `8585:8585`

Exposes:

* bathroom REST APIs
* S3 upload/download APIs
* groups REST APIs

#### `8589:8589`

Exposes:

* WebSocket traffic
* STOMP/SockJS connections
* live chat presence updates

### Persistent Volume Mapping

```yaml
./volumes:/app/volumes
```

Provides persistence for:

* local fallback uploads
* cached file storage
* `FileHandler` disk-backed operations

across container restarts.

### Environment Variables

No `environment:` block exists in the compose file. Instead, configuration lives in a `.env` file at the project root, which is **gitignored** so credentials never reach the repository.

Values such as:

* `AWS_ACCESS_KEY_ID`
* `AWS_SECRET_ACCESS_KEY`
* `AWS_REGION`
* `AWS_S3_BUCKET`

are loaded from that gitignored `.env` file, and can also be supplied through:

* host environment variables
* CI/CD secrets
* container runtime injection

They are consumed by `S3FileHandler` via `@Value`.

---

## 2. DNS Configuration

DNS is managed through **AWS Route 53**, with **S3** backing the static-hosting side of the deployment:

* a Route 53 hosted zone resolves `opencodingsociety.com` and its subdomains
* S3 bucket configuration serves/stores the static content and uploads

These are configured in the AWS console rather than committed as infrastructure files, so the repository itself contains no Terraform, Kubernetes ingress, or static DNS manifests — the topology below reflects the live Route 53 + S3 setup.

---

### Production Hostnames

`README.md`

```text
- Runtime link: https://spring.opencodingsociety.com/
- Jokes endpoint: https://spring.opencodingsociety.com/api/jokes/
- JWT Login:     https://pages.opencodingsociety.com/login
```

### Domain Responsibilities

#### `spring.opencodingsociety.com`

Hosts the Spring backend:

* bathroom APIs
* groups APIs
* S3 APIs
* WebSocket endpoints

#### `pages.opencodingsociety.com`

Hosts the frontend:

* GitHub Pages site
* browser SPA
* frontend authentication flow

---

### Cross-Origin Configuration

#### Bathroom Queue API

```java
@CrossOrigin(origins = {
    "http://localhost:8585",
    "https://pages.opencodingsociety.com/"
})
```

Allows:

* local frontend development
* production frontend access

---

#### S3 File API

```java
@RestController
@RequestMapping("/api/files")
public class S3FileApiController { ... }
```

No local `@CrossOrigin` annotation exists, so it inherits global CORS configuration.

---

#### Group Chat API

```java
@RestController
@RequestMapping("/api/groups/chat")
@CrossOrigin
```

Uses global CORS rules as well.

---

### JWT Cookie Domain Sharing

```java
cookieBuilder.domain(".opencodingsociety.com");
```

This enables authentication sharing across:

* `spring.opencodingsociety.com`
* `pages.opencodingsociety.com`

so browser sessions can authenticate API calls across subdomains.

---

### DNS Topology Summary

```text
opencodingsociety.com
├── spring.opencodingsociety.com  -> Spring backend
└── pages.opencodingsociety.com   -> GitHub Pages frontend
```

The topology is encoded through:

* CORS rules
* JWT cookie domain settings
* nginx routing
* frontend API calls

---

## 3. nginx — `nginx_spring_8585_8589.conf`

The repository contains a single nginx configuration file with approximately 315 lines.

---

### Server Name and Upload Limits

```nginx
server_name spring.opencodingsociety.com;

client_max_body_size 50M;
```

### Upload Limit Behavior

`client_max_body_size 50M` sets the maximum upload size for:

* multipart uploads
* base64 payloads
* S3 upload requests

Anything larger receives:

```text
413 Payload Too Large
```

before reaching `S3FileHandler`.

---

### REST Proxy Routing

```nginx
location / {

    proxy_pass http://localhost:8585;

    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;
    proxy_set_header X-Real-IP $remote_addr;
}
```

All REST traffic routes through port `8585`, including:

* `/api/bathroom/**`
* `/api/files/**`
* `/api/groups/**`

### Forwarded Headers

`X-Forwarded-*` headers preserve:

* real client IP
* original protocol
* host identity
* upstream request metadata

This is important for:

* audit logging
* authentication
* analytics
* rate limiting

---

### Dedicated WebSocket Proxy

```nginx
location /ws-chat {

    proxy_pass http://localhost:8589;

    proxy_http_version 1.1;

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";

    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_read_timeout 86400;
    proxy_send_timeout 86400;

    proxy_buffering off;
}
```

### WebSocket Features Enabled

#### Upgrade Headers

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "Upgrade";
```

Enable:

* WebSocket handshakes
* STOMP upgrades
* SockJS communication

#### Long-Lived Connections

```nginx
proxy_read_timeout 86400;
proxy_send_timeout 86400;
```

Allow:

* idle chat sessions
* presence tracking
* persistent subscriptions

#### Disabled Proxy Buffering

```nginx
proxy_buffering off;
```

Improves:

* low-latency message delivery
* real-time event propagation

---

### TLS Termination

```nginx
listen [::]:443 ssl;
listen 443 ssl;

ssl_certificate /etc/letsencrypt/live/spring.opencodingsociety.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/spring.opencodingsociety.com/privkey.pem;

include /etc/letsencrypt/options-ssl-nginx.conf;
ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
```

### HTTPS Responsibilities

nginx terminates TLS for:

* bathroom APIs
* groups APIs
* S3 uploads
* WebSocket traffic

Backend ports `8585` and `8589` remain internal and unencrypted.

Certificates are managed using:

```text
Let's Encrypt
```

---

### HTTP → HTTPS Redirect

```nginx
server {

    if ($host = spring.opencodingsociety.com) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    listen [::]:80;

    server_name spring.opencodingsociety.com;

    return 404;
}
```

Guarantees that:

* authentication traffic
* JWT cookies
* upload payloads
* bathroom queue actions

never travel over plaintext HTTP.

---

## 4. CI/CD — GitHub Actions

The frontend (`pages.opencodingsociety.com`, a Jekyll site) is built and deployed automatically by a GitHub Actions workflow under `.github/workflows/`. On every push to `main` — and on manual `workflow_dispatch` — it:

* sets up Ruby + Bundler (cached) and a Python virtual environment
* distributes registered project and documentation files into Jekyll locations (`make build-registered-projects`, `make build-registered-docs`)
* converts Jupyter notebooks and DOCX files to Markdown (`scripts/convert_notebooks.py`, `scripts/convert_docx.py`)
* splits multi-course files (`scripts/split_multi_course_files.py`)
* computes and applies the correct `baseurl` for the repository
* builds the site with Jekyll and uploads the artifact
* deploys to GitHub Pages via `actions/deploy-pages`

```yaml
# .github/workflows/ — Deploy Jekyll site to GitHub Pages
name: Deploy Jekyll with GitHub Pages dependencies preinstalled

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5
      - name: Set up Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.1'
          bundler-cache: true
      - name: Install Jekyll and dependencies
        run: |
          gem install bundler
          bundle install
      - name: Install Python dependencies
        run: |
          python -m venv venv
          source venv/bin/activate
          pip install -r requirements.txt
      - name: Build registered projects
        run: |
          make build-registered-projects
          make build-registered-docs
      - name: Execute notebook conversion script
        run: |
          source venv/bin/activate
          python scripts/convert_notebooks.py
      - name: Execute DOCX conversion script
        run: |
          source venv/bin/activate
          if [ -d "_docx" ] && [ "$(ls -A _docx 2>/dev/null)" ]; then
            python scripts/convert_docx.py
          else
            echo "No DOCX files found, skipping conversion"
          fi
      - name: Split multi-course files
        run: |
          source venv/bin/activate
          python scripts/split_multi_course_files.py
      - name: Compute and apply baseurl
        run: |
          REPO="${{ github.repository }}"
          OWNER=$(echo "$REPO" | cut -d'/' -f1)
          NAME=$(echo "$REPO" | cut -d'/' -f2)
          if [[ "$NAME" == "$OWNER.github.io" ]]; then
            BASEURL=""
          elif [[ "$REPO" = "Open-Coding-Society/pages" ]]; then
            BASEURL=""
          else
            BASEURL="/$NAME"
          fi
          echo "baseurl: \"$BASEURL\"" > _config.override.yml
      - name: Build with Jekyll
        run: bundle exec jekyll build --config _config.yml,_config.override.yml
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v5
        with:
          path: _site

  deploy:
    environment:
      name: github-pages-deployment
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

---

## Minimal Backend CI/CD Pipeline Recommendation

The Spring backend (`spring.opencodingsociety.com`) is still deployed by hand. A minimal GitHub Actions workflow for the backend could:

1. Install Java 21

```yaml
setup-java@v4
```

2. Build and test the application

```bash
mvn -B package
mvn test
```

3. Build and push Docker image

```bash
docker build .
docker push
```

4. SSH into the production host

5. Restart containers behind nginx

This would automate deployment for all:

* REST controllers
* WebSocket services
* JPA repositories
* S3 integrations
