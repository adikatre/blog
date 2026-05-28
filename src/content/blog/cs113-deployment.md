---
title: 'CS113: Deployment, Docker, DNS & nginx'
description: 'How the Spring backend is packaged with Docker, exposed through nginx with TLS and WebSocket routing, and the gaps in the current CI/CD pipeline.'
pubDate: 'May 28 2026 12:00'
---

Deployment concepts demonstrated across `bathroom/`, `S3uploads/`, and `groups/chat/`.

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

No `environment:` block exists.

Therefore, values such as:

* `AWS_ACCESS_KEY_ID`
* `AWS_SECRET_ACCESS_KEY`
* `AWS_REGION`
* `AWS_S3_BUCKET`

must be provided externally through:

* host environment variables
* CI/CD secrets
* container runtime injection

used by `S3FileHandler` via `@Value`.

---

## 2. DNS Configuration

No DNS infrastructure files exist in the repository:

* no Route 53 configuration
* no Terraform
* no Kubernetes ingress
* no static DNS manifests

The deployment topology is inferred from code and documentation.

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

## 4. CI/CD — Currently Not Present

The repository does not contain:

* `.github/workflows/`
* `Jenkinsfile`
* `.gitlab-ci.yml`
* `.circleci/config.yml`

The only YAML file present is:

```text
docker-compose.yml
```

which handles local orchestration, not automation pipelines.

---

### Missing Pipeline Features

#### No Automated Build Step

Missing:

```bash
mvn -B package
```

Consequences:

* no automatic verification
* no compile validation on PRs
* no regression prevention

---

#### No Automated Test Execution

JUnit tests under:

```text
src/test/java/com/open/spring/mvc/chat/
```

are never automatically run on:

* pull requests
* pushes
* merges

---

#### No Docker Build/Push Automation

The Docker image exposing:

* `8585`
* `8589`

must be manually built and deployed.

---

#### No Secret Management Pipeline

No CI secret injection exists for:

* `AWS_ACCESS_KEY_ID`
* `AWS_SECRET_ACCESS_KEY`
* `AWS_REGION`
* `AWS_S3_BUCKET`

Therefore, `S3FileHandler` only works when operators manually inject environment variables.

---

#### No Automated Deployment

Deployments to:

```text
spring.opencodingsociety.com
```

must be performed manually.

This affects releases for:

* bathroom queue APIs
* group chat APIs
* S3 upload services

---

## Minimal CI/CD Pipeline Recommendation

A minimal GitHub Actions workflow could:

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
