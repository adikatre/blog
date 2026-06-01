---
title: 'CS113: Deployment, Docker, DNS & nginx'
description: 'How the Spring backend is packaged with Docker, exposed through nginx with TLS and WebSocket routing, and the GitHub Actions pipeline that builds and deploys the Jekyll frontend.'
pubDate: 'May 28 2026 12:00'
heroImage: '../../assets/cs113-deployment.jpg'
---

Deployment concepts demonstrated across `bathroom/`, `S3uploads/`, and `groups/chat/`.

**Source:** [Pirna-spring](https://github.com/adikatre/Pirna-spring) (Spring backend) · [Pirna-pages](https://github.com/adikatre/Pirna-pages) (frontend)

## Course alignment

| Learning Objective | Evidence Required | Assessment Method |
| --- | --- | --- |
| Docker | Create Dockerfile and docker-compose for containerization | Code review: Dockerfile, docker-compose.yml configuration |
| DNS Configuration | Configure custom domain with proper DNS records | Deployment review: Live site accessible via custom domain |
| nginx | Set up nginx as reverse proxy for backend services | Code review: nginx.conf configuration |
| CI/CD | Implement automated deployment pipeline | GitHub Actions: Workflow files, successful deployments |

---

## Deployment

### Docker

*Evidence required — Create Dockerfile and docker-compose for containerization.*  
*Assessment — Code review: Dockerfile, docker-compose.yml configuration.*

**Dockerfile.** The project uses a minimal Docker image that builds the Spring Boot JAR inside the container and exposes both REST and WebSocket ports.

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

**Port usage.** `EXPOSE 8585` is used by `BathroomQueueApiController`, `HallPassController`, `S3FileApiController`, and the REST endpoints in `GroupChatApiController`. `EXPOSE 8589` is a dedicated WebSocket port configured by `ChatWebSocketPortConfig.java` and `ChatWebSocketPortFilter.java`, and it carries STOMP/SockJS traffic for `GroupChatWebSocketController` along with presence updates in `GroupChatPresenceService`.

**Maven build inside Docker.** The image compiles everything into a runnable Spring Boot JAR during the build step:

```dockerfile
RUN ./mvnw package
```

This compiles the JPA repositories, REST controllers, WebSocket handlers, service layers, and Hibernate entities into a single runnable artifact. The image intentionally remains minimal, with no `HEALTHCHECK`, no `VOLUME`, and no `ARG`.

**docker-compose.yml.** The compose file builds the image and maps both ports plus a persistent volume.

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

**Compose networking.** The `8585:8585` mapping exposes the bathroom REST APIs, S3 upload/download APIs, and groups REST APIs, while `8589:8589` exposes WebSocket traffic, STOMP/SockJS connections, and live chat presence updates.

**Persistent volume mapping.** The `./volumes:/app/volumes` mapping provides persistence for local fallback uploads, cached file storage, and `FileHandler` disk-backed operations across container restarts.

**Environment variables.** No `environment:` block exists in the compose file. Instead, configuration lives in a `.env` file at the project root, which is **gitignored** so credentials never reach the repository. Values such as `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and `AWS_S3_BUCKET` are loaded from that gitignored `.env` file, and can also be supplied through host environment variables, CI/CD secrets, or container runtime injection. They are consumed by `S3FileHandler` via `@Value`.

---

### DNS Configuration

*Evidence required — Configure custom domain with proper DNS records.*  
*Assessment — Deployment review: Live site accessible via custom domain.*

DNS is managed through **AWS Route 53**, with **S3** backing the static-hosting side of the deployment: a Route 53 hosted zone resolves `opencodingsociety.com` and its subdomains, and S3 bucket configuration serves/stores the static content and uploads. These are configured in the AWS console rather than committed as infrastructure files, so the repository itself contains no Terraform, Kubernetes ingress, or static DNS manifests — the topology below reflects the live Route 53 + S3 setup.

**Production hostnames.** The hostnames are documented in `README.md`:

```text
- Runtime link: https://spring.opencodingsociety.com/
- Jokes endpoint: https://spring.opencodingsociety.com/api/jokes/
- JWT Login:     https://pages.opencodingsociety.com/login
```

**Domain responsibilities.** `spring.opencodingsociety.com` hosts the Spring backend (bathroom APIs, groups APIs, S3 APIs, and WebSocket endpoints), while `pages.opencodingsociety.com` hosts the frontend (the GitHub Pages site, the browser SPA, and the frontend authentication flow).

**Cross-origin configuration.** The Bathroom Queue API explicitly allows local frontend development and production frontend access:

```java
@CrossOrigin(origins = {
    "http://localhost:8585",
    "https://pages.opencodingsociety.com/"
})
```

The S3 File API has no local `@CrossOrigin` annotation, so it inherits the global CORS configuration:

```java
@RestController
@RequestMapping("/api/files")
public class S3FileApiController { ... }
```

The Group Chat API likewise relies on the global CORS rules:

```java
@RestController
@RequestMapping("/api/groups/chat")
@CrossOrigin
```

**JWT cookie domain sharing.** Setting the cookie domain to the parent zone enables authentication sharing across subdomains:

```java
cookieBuilder.domain(".opencodingsociety.com");
```

This lets browser sessions authenticate API calls across both `spring.opencodingsociety.com` and `pages.opencodingsociety.com`.

**DNS topology summary.** The overall topology is:

```text
opencodingsociety.com
├── spring.opencodingsociety.com  -> Spring backend
└── pages.opencodingsociety.com   -> GitHub Pages frontend
```

This topology is encoded through CORS rules, JWT cookie domain settings, nginx routing, and frontend API calls.

---

### nginx

*Evidence required — Set up nginx as reverse proxy for backend services.*  
*Assessment — Code review: nginx.conf configuration.*

The repository contains a single nginx configuration file (`nginx_spring_8585_8589.conf`) with approximately 315 lines.

**Server name and upload limits.** The server block names the backend host and caps upload sizes:

```nginx
server_name spring.opencodingsociety.com;

client_max_body_size 50M;
```

`client_max_body_size 50M` sets the maximum upload size for multipart uploads, base64 payloads, and S3 upload requests. Anything larger receives a `413 Payload Too Large` before reaching `S3FileHandler`:

```text
413 Payload Too Large
```

**REST proxy routing.** All REST traffic routes through port `8585`:

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

This covers `/api/bathroom/**`, `/api/files/**`, and `/api/groups/**`. The forwarded `X-Forwarded-*` headers preserve the real client IP, original protocol, host identity, and upstream request metadata, which matters for audit logging, authentication, analytics, and rate limiting.

**Dedicated WebSocket proxy.** A separate location upgrades and proxies WebSocket traffic to port `8589`:

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

**WebSocket features enabled.** The upgrade headers enable WebSocket handshakes, STOMP upgrades, and SockJS communication:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "Upgrade";
```

The long timeouts keep idle chat sessions, presence tracking, and persistent subscriptions alive:

```nginx
proxy_read_timeout 86400;
proxy_send_timeout 86400;
```

Disabling proxy buffering improves low-latency message delivery and real-time event propagation:

```nginx
proxy_buffering off;
```

**TLS termination.** nginx listens on 443 with certificates from Let's Encrypt:

```nginx
listen [::]:443 ssl;
listen 443 ssl;

ssl_certificate /etc/letsencrypt/live/spring.opencodingsociety.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/spring.opencodingsociety.com/privkey.pem;

include /etc/letsencrypt/options-ssl-nginx.conf;
ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
```

nginx terminates TLS for the bathroom APIs, groups APIs, S3 uploads, and WebSocket traffic, while backend ports `8585` and `8589` remain internal and unencrypted. Certificates are managed using:

```text
Let's Encrypt
```

**HTTP → HTTPS redirect.** A dedicated port-80 server block forces every request to HTTPS:

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

This guarantees that authentication traffic, JWT cookies, upload payloads, and bathroom queue actions never travel over plaintext HTTP.

---

### CI/CD

*Evidence required — Implement automated deployment pipeline.*  
*Assessment — GitHub Actions: Workflow files, successful deployments.*

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
