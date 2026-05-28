---
title: 'CS113 Blog'
description: 'Documentation & Social & Ethics'
pubDate: 'May 28 2026'
---

# Documentation and Personal/Social Relevance Demonstrated Across `bathroom/`, `S3uploads/`, and `groups/chat/`

# 1. Code Comments — JavaDoc for Classes, Methods, and Complex Logic

## Class-Level JavaDoc with Swagger Context

`BathroomQueueApiController.java:36-46`

```java id="3fxjlwm"
/**
 * This class provides RESTful API endpoints for managing BathroomQueue
 * entities.
 * It includes endpoints for creating, retrieving, updating, and managing
 * bathroom queue operations for classroom management.
 */
@RestController
@RequestMapping("/api/bathroom")
@CrossOrigin(origins = {
    "http://localhost:8585",
    "https://pages.opencodingsociety.com/"
})
@Tag(
    name = "Bathroom Queue API",
    description = "Endpoints for managing the bathroom queue"
)
public class BathroomQueueApiController { ... }
```

This documents:

* controller purpose
* endpoint scope
* classroom management functionality
* API grouping for Swagger/OpenAPI

---

## Method-Level JavaDoc with `@param`

`BathroomQueue.java:36-46`

```java id="2yq0k2"
/**
 * Constructor which creates each element in the queue
 *
 * @param teacherEmail - the teacher's email for what class they are from
 * @param peopleQueue  - the people in the queue
 */
public BathroomQueue(String teacherEmail, String peopleQueue) { ... }
```

`BathroomQueue.java:48-59`

```java id="8p3i9d"
/**
 * Function to add a student to the queue
 *
 * @param studentName - the name you want to add to the queue
 */
public void addStudent(String studentName) { ... }
```

These comments improve:

* API readability
* IDE autocomplete help
* onboarding for contributors
* generated documentation quality

---

## Complex Logic Comments

`BathroomQueue.java:102-107`

```java id="ybx0xn"
// ONLY decrease away if the student was actually
// in the "away" portion
if (studentIndex < this.away) {

    if (this.away > 0) {
        this.away--;
    }
}
```

This explains a non-obvious invariant:

* only students currently marked as “away”
  can decrement occupancy counts

Without this comment, the queue logic is harder to reason about.

---

## Service-Level JavaDoc

`GroupChatPresenceService.java:14-19`

```java id="0ffn5q"
/**
 * Service managing user presence within specific chat groups.
 * Enables tracking the real-time participation of group members connected
 * via WebSocket by retaining active session identifiers mapped to the
 * corresponding usernames and actively joined groups.
 */
@Service
public class GroupChatPresenceService { ... }
```

Documents:

* WebSocket session tracking
* real-time presence architecture
* group membership state management

---

## Annotation Explainer Comments

`Teacher.java:26-32`

```java id="8d1ghh"
/**
 * Teacher is a POJO, Plain Old Java Object.
 * --- @Data is Lombok annotation for
 *     @Getter @Setter @ToString @EqualsAndHashCode
 *     @RequiredArgsConstructor
 * --- @AllArgsConstructor is Lombok annotation
 *     for a constructor with all arguments
 * --- @NoArgsConstructor is Lombok annotation
 *     for a constructor with no arguments
 * --- @Entity annotation is used to mark the class
 *     as a persistent Java class.
 */
```

This helps newer developers understand:

* Lombok annotations
* JPA persistence annotations
* generated boilerplate behavior

---

## Interface Contract Documentation

`FileHandler.java:1-47`

```java id="cbm8vq"
/**
 * Uploads a file (base64 encoded) to the storage system.
 *
 * @param base64Data Base64 encoded file content
 * @param filename   User provided filename
 * @param uid        User ID
 * @return The saved filename or null if failed
 */
String uploadFile(
    String base64Data,
    String filename,
    String uid
);
```

Documents:

* input format
* storage semantics
* expected return values
* failure behavior

---

# 2. API Documentation — Swagger, DTOs, and Endpoint Contracts

## Swagger/OpenAPI Controller Documentation

`BathroomQueueApiController.java:46-97`

```java id="g9skvx"
@Tag(
    name = "Bathroom Queue API",
    description = "Endpoints for managing the bathroom queue"
)
public class BathroomQueueApiController {

    @PostMapping("/addQueue")

    @Operation(summary = "Create a new bathroom queue")

    public ResponseEntity<String> addQueue(
            @RequestBody QueueAddReq request) { ... }
}
```

Using:

```xml id="r40xql"
springdoc-openapi-starter-webmvc-ui
```

automatically generates:

* `/swagger-ui.html`
* OpenAPI JSON specifications
* importable Postman collections

---

## DTO Documentation

`BathroomQueueApiController.java:63-83`

```java id="4j14pt"
/**
 * DTO (Data Transfer Object) to support request
 * operations for queue management.
 * Contains necessary information for student queue operations.
 */
@Getter
public static class QueueDto {

    private String teacherEmail;

    // Name of the student to be added/removed/approved
    private String studentName;

    // URI for constructing approval links
    private String uri;
}

/**
 * DTO (Data Transfer Object) to support POST request
 * for addQueue method.
 * Represents the data required to create a new bathroom queue.
 */
@Getter
public static class QueueAddReq {

    private String teacherEmail;

    // Initial student(s) to add to the queue
    private String peopleQueue;
}
```

Documents:

* request payload structure
* required fields
* queue semantics
* frontend/backend contracts

---

## Endpoint Contract Documentation

`BathroomQueueApiController.java:85-94`

```java id="4ahpnx"
/**
 * Create a new BathroomQueue entity for a teacher.
 *
 * @param request The QueueAddReq object containing
 *                teacher email and initial queue data
 *
 * @return A ResponseEntity containing a success message
 *         if the queue is created,
 *         or a CONFLICT status if queue already exists,
 *         or INTERNAL_SERVER_ERROR if creation fails
 */
```

Documents:

* request structure
* possible outcomes
* HTTP status codes
* controller behavior

---

## REST Endpoint JavaDoc

`S3FileApiController.java:25-31`

```java id="8rshyf"
/**
 * Upload a file to S3
 *
 * @param uid User ID
 * @param filename Name of the file
 * @param base64Data Base64 encoded file content
 *
 * @return Response with filename or error
 */
@PostMapping("/upload/{uid}")
public ResponseEntity<?> uploadFile(...) { ... }
```

This clearly explains:

* upload semantics
* parameter expectations
* encoding requirements
* response structure

---

# 3. Help System — Validation Messages and User Guidance

## User-Facing API Responses

`BathroomQueueApiController.java:105-114`

```java id="1h1l3h"
return ResponseEntity
        .status(HttpStatus.CONFLICT)
        .body("Queue already exists for this teacher.");

...

return ResponseEntity.ok(
        "Queue added successfully!"
);

...

.body("Failed to add queue: " + e.getMessage());
```

These responses provide:

* actionable feedback
* validation guidance
* frontend-readable errors

---

## Queue-State Guidance

`BathroomQueue.java:136-142`

```java id="v4dykh"
} else {

    // If already at max occupancy,
    // we don't increment away.
    // The frontend should handle showing
    // they are in the waiting list.

}

} else {

    throw new IllegalStateException("Queue is empty");
}
```

Documents:

* queue invariants
* frontend responsibilities
* waiting-list behavior

---

## Validation Messages

`Teacher.java:55-61`

```java id="n5eh4r"
@NonNull
@Size(
    min = 2,
    max = 30,
    message = "First Name (2 to 30 chars)"
)
private String firstname;

@NonNull
@Size(
    min = 2,
    max = 30,
    message = "Last Name (2 to 30 chars)"
)
private String lastname;
```

These messages act as:

* validation rules
* accessibility guidance
* user-facing help text

---

## Operational Help Messages

`S3FileHandler.java:51-55`

```java id="p7ij4n"
if (isBlank(accessKey)
        || isBlank(secretKey)
        || isBlank(region)
        || isBlank(bucketName)) {

    log.warn(
        "S3 is disabled: missing AWS credentials/region/bucket. " +
        "Upload API will return errors until configured."
    );

    return;
}
```

This gives operators:

* root-cause visibility
* configuration guidance
* deployment troubleshooting hints

---

# 4. Blog Portfolio — Architecture and Design Artifacts

The repository already contains strong material for technical blog posts.

---

## WebSocket Port Separation

Relevant files:

* `ChatWebSocketPortConfig.java`
* `ChatWebSocketPortFilter.java`
* nginx `/ws-chat` configuration

Interesting topics:

* dedicated WebSocket connectors
* SockJS routing
* separating REST and realtime traffic

---

## JSONL-Based Chat Storage

Relevant files:

* `GroupChatService.java`
* `ChatService.java`

Interesting tradeoffs:

* append-only message logs
* zero schema migration cost
* simpler deployment
* O(n) append/read complexity

---

## Bathroom Queue Domain Modeling

Relevant file:

* `BathroomQueue.java`

Interesting topics:

* enforcing `maxOccupancy`
* domain invariants
* moving business logic into entities
* queue synchronization logic

---

## Polymorphic Submitter Design

Relevant file:

* `Submitter.java`

Interesting topics:

* `@Inheritance(strategy = JOINED)`
* polymorphic persistence
* shared assignment submission models

---

## Git History for Portfolio Evidence

Example commits:

```text id="r7hxsi"
1852cb71 add javadoc comments on websocket chat
483193c0 Websocket for delete
9bbf9b1d Logic for bathroom pass finally works!
```

Useful for:

* portfolio writeups
* contribution tracking
* design evolution documentation
* PR references

---

# 5. Project Impact — Real-World Problem Solving

The domain model directly reflects real operational problems in schools.

---

## Bathroom Queue Management

`BathroomQueue.java:21-46`

```java id="4j1cyl"
@Column(columnDefinition = "int default 1")
private int maxOccupancy = 1;
```

Solves:

* classroom disruption
* hallway congestion
* teacher tracking difficulties
* occupancy management

---

## Hall Pass Tracking

`HallPass.java:80-86`

```java id="o9u6y4"
private String personId;
private long teacher_id;
private int period;
private String activity;

private Date checkout;
private Date checkin;
```

Enables:

* audit trails
* accountability
* time tracking
* administrative oversight

---

## Bathroom Infrastructure Reporting

`Issue.java:43-65`

```java id="6h90n5"
issues.add(
    new Issue(
        "D Building Bathroom",
        "No Door Lock",
        0,
        0.47f,
        0.235f
    )
);

issues.add(
    new Issue(
        "Locker Room Bathroom",
        "No Toilet Paper",
        0,
        0.67f,
        0.71f
    )
);
```

Supports:

* maintenance reporting
* infrastructure awareness
* student safety
* facility accessibility

---

## Group Collaboration and File Sharing

Relevant files:

* `Groups.java`
* `GroupChatService.java`

Provides:

* group communication
* shared file uploads
* collaborative workflows
* assignment coordination

---

# 6. Ethical Considerations — Privacy, Security, Equity, Accessibility

## Privacy and Data Deletion

`S3FileHandler.java:117-155`

```java id="hl0jrl"
public boolean deleteFiles(String uid) {

    String prefix = uid + "/";

    ListObjectsV2Response listRes =
            s3Client.listObjectsV2(...);

    List<ObjectIdentifier> objectsToDelete =
            listRes.contents().stream()

            .map(s3Object ->
                    ObjectIdentifier.builder()
                        .key(s3Object.key())
                        .build()
            )

            .collect(Collectors.toList());

    s3Client.deleteObjects(
            DeleteObjectsRequest.builder()
                .bucket(bucketName)
                .delete(
                    Delete.builder()
                        .objects(objectsToDelete)
                        .build()
                )
                .build()
    );

    return true;
}
```

Supports:

* user data deletion
* storage cleanup
* privacy compliance
* “right to be forgotten” behavior

---

## Credential Hygiene

`S3FileHandler.java:36-46`

```java id="39i4c5"
@Value("${aws.s3.bucket-name}")
private String bucketName;

@Value("${aws.s3.access-key-id}")
private String accessKey;

@Value("${aws.s3.secret-access-key}")
private String secretKey;

@Value("${aws.s3.region}")
private String region;
```

Security benefits:

* no hardcoded secrets
* environment-based configuration
* safer deployments
* separation of code and credentials
