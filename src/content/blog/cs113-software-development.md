---
title: 'CS113: Software Development Practices'
description: 'Version control, testing, build tooling, debugging, REST API design, and JPA across the bathroom, S3 uploads, groups, and chat modules.'
pubDate: 'May 28 2026 09:00'
---

Software development concepts demonstrated across `bathroom/`, `S3uploads/`, `groups/`, and `chat/`.

## 1. Version Control — Git History and Commit Organization

Running `git log --oneline` scoped to these directories shows a clean feature timeline with focused commits.

```text
483193c0 Websocket for delete
49ccde5c Updating group message schema
2c40a730 Groups messaging delete API method
fa760c31 Adding documentation on Hall Pass Controller API File
3ade7e7e Adding documentation on Bathroom Queue API File
1bfc3b73 Modifying bathroom queue controller for OCS analytics
1852cb71 add javadoc comments on websocket chat
14336180 Username is automatically added to chat messages
401d213e works on my machine! ws chat
193cb0f2 ws on port 8589 with presence and typing indicators
9bbf9b1d Logic for bathroom pass finally works!
```

### Version Control Practices Demonstrated

#### Feature Branch Workflow

```text
7cb0f03d Merge branch 'Open-Coding-Society:master' into master
```

This demonstrates:

* feature branch development
* pull request merges
* upstream synchronization workflows

#### Separation of Concerns in Commits

Documentation commits are isolated from logic changes:

```text
Adding documentation on Bathroom Queue API File
```

Benefits:

* cleaner code reviews
* easier rollback
* reduced merge conflicts

#### Isolated Schema Changes

```text
Updating group message schema
```

Schema modifications are separated into dedicated commits so reviewers can identify database migration risks independently.

#### File-Level Git History

Example command:

```bash
git log -p src/main/java/com/open/spring/mvc/groups/GroupChatService.java
```

This enables:

* line-by-line blame analysis
* code review history
* contributor tracking
* regression debugging

---

## 2. Testing — JUnit, Integration Testing, and API Validation

The project test structure mirrors the production structure under:

```text
src/test/java/com/open/spring/mvc/chat/
```

This provides locations for:

* unit tests
* service tests
* controller tests
* integration tests

### Example Unit Tests — `BathroomQueue`

The `BathroomQueue` class is highly testable because queue logic is isolated into pure state-transition methods.

```java run
// Distilled from BathroomQueueTest — the queue + a tiny assert harness so the
// same assertions run here without JUnit on the classpath.
import java.util.*;

public class Main {
    // --- class under test (pure state-transition logic) ---
    static class BathroomQueue {
        private String peopleQueue;
        private int away = 0;
        private int maxOccupancy = 1;
        BathroomQueue(String email, String queue) { this.peopleQueue = queue; }
        void addStudent(String name) {
            peopleQueue = (peopleQueue == null || peopleQueue.isEmpty())
                ? name : peopleQueue + "," + name;
        }
        String getPeopleQueue() { return peopleQueue; }
        String getFrontStudent() { return peopleQueue.split(",")[0]; }
        int getStudentIndex(String name) {
            return Arrays.asList(peopleQueue.split(",")).indexOf(name);
        }
        void setMaxOccupancy(int m) { maxOccupancy = m; }
        void approveStudent() { if (away < maxOccupancy) away++; }
        int getAway() { return away; }
    }

    // --- minimal test harness ---
    static int passed = 0, failed = 0;
    static void assertEquals(Object expected, Object actual) {
        if (Objects.equals(expected, actual)) { passed++; }
        else { failed++; System.out.println("  FAIL: expected " + expected + " but got " + actual); }
    }

    static void addStudent_appendsToCommaSeparatedQueue() {
        BathroomQueue q = new BathroomQueue("t@x.com", "");
        q.addStudent("Alice");
        q.addStudent("Bob");
        assertEquals("Alice,Bob", q.getPeopleQueue());
        assertEquals("Alice", q.getFrontStudent());   // FIFO peek
        assertEquals(0, q.getStudentIndex("Alice"));   // search hit
        assertEquals(-1, q.getStudentIndex("Zoe"));    // search miss
    }

    static void approveStudent_respectsMaxOccupancy() {
        BathroomQueue q = new BathroomQueue("t@x.com", "Alice,Bob");
        q.setMaxOccupancy(1);
        q.approveStudent();
        q.approveStudent();
        assertEquals(1, q.getAway());                  // must not exceed max occupancy
    }

    public static void main(String[] args) {
        addStudent_appendsToCommaSeparatedQueue();
        approveStudent_respectsMaxOccupancy();
        System.out.println(passed + " passed, " + failed + " failed");
    }
}
```

### API / Integration Testing

Controllers consistently return `ResponseEntity`, making them easy to validate using:

* Postman
* MockMvc
* integration tests

Example:

```java
// BathroomQueueApiController.java:103-115

Optional<BathroomQueue> existingQueue =
        repository.findByTeacherEmail(request.getTeacherEmail());

if (existingQueue.isPresent())
    return ResponseEntity.status(HttpStatus.CONFLICT)
            .body("Queue already exists for this teacher.");

repository.save(
        new BathroomQueue(
                request.getTeacherEmail(),
                request.getPeopleQueue()
        )
);

return ResponseEntity.ok("Queue added successfully!");
```

### Example API Assertions

#### First Request

```text
POST /api/bathroom/addQueue
→ 200 OK
```

#### Duplicate Queue

```text
POST /api/bathroom/addQueue
→ 409 CONFLICT
```

### Maven Test Stack

`pom.xml` includes:

```xml
<dependency>
    <artifactId>spring-boot-starter-test</artifactId>
</dependency>
```

This provides:

* JUnit 5
* MockMvc
* AssertJ
* Spring test utilities

Run tests with:

```bash
mvn test
```

---

## 3. Build Tools — Maven and Dependency Management

The project uses Maven for dependency management and application builds.

### Spring Web

Used for REST controllers such as:

* `BathroomQueueApiController`
* `GroupsApiController`
* `S3FileApiController`

```xml
<dependency>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

### WebSocket Support

Used by:

* `GroupChatWebSocketController`
* `WebSocketBrokerConfig`

```xml
<dependency>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

### JPA / Hibernate

Used by repositories such as:

* `BathroomQueueJPARepository`
* `GroupsJpaRepository`
* `TeacherJpaRepository`

```xml
<dependency>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
```

### AWS SDK v2

Used by `S3FileHandler`.

```xml
<dependency>
    <groupId>software.amazon.awssdk</groupId>
    <artifactId>s3</artifactId>
</dependency>
```

### Swagger / OpenAPI

Supports API documentation annotations.

```xml
<dependency>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
</dependency>
```

### Testing Dependencies

```xml
<dependency>
    <artifactId>spring-boot-starter-test</artifactId>
</dependency>
```

### Maven Commands

#### Start Application

```bash
mvn spring-boot:run
```

#### Run Tests

```bash
mvn test
```

---

## 4. Debugging — Logging, Breakpoints, and Exception Tracing

The project uses Lombok's `@Slf4j` for structured logging.

### S3 Upload Debugging

```java
@Slf4j
public class S3FileHandler implements FileHandler {

    public String uploadFile(String base64Data,
                             String filename,
                             String uid) {

        if (s3Client == null) {

            log.warn("S3 upload attempted but S3 client is not configured.");

            return null; // breakpoint target
        }

        String key = generateKey(uid, filename);

        System.out.println("S3 Upload: " + key);

        try {

            byte[] fileData =
                    Base64.getDecoder().decode(base64Data);

            ...

        } catch (Exception e) {

            e.printStackTrace();

            return null;
        }
    }
}
```

### Localized Failure Handling

`GroupChatService` isolates malformed JSONL rows instead of failing the entire conversation.

```java
} catch (Exception e) {
    log.warn(
        "Skipping invalid message line for group {}: {}",
        groupName,
        line,
        e
    );
}
```

### Parse Failure Diagnostics

```java
} catch (Exception e) {
    System.out.println("⚠️ Failed to parse time: " + pair);
}
```

### Example IDE Debugging Workflow

1. Place breakpoint at:

```text
BathroomQueue.java:127
```

2. Send request:

```text
POST /api/bathroom/approveQueue
```

3. Step through:

* `away`
* `maxOccupancy`
* queue invariants

---

## 5. API Development — RESTful Endpoints and HTTP Semantics

### Bathroom Queue API

```java
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
public class BathroomQueueApiController {

    @PostMapping("/addQueue")
    @Operation(summary = "Create a new bathroom queue")
    public ResponseEntity<String> addQueue(
            @RequestBody QueueAddReq request) {

        Optional<BathroomQueue> existingQueue =
                repository.findByTeacherEmail(
                        request.getTeacherEmail()
                );

        if (existingQueue.isPresent())
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Queue already exists for this teacher.");

        repository.save(
                new BathroomQueue(
                        request.getTeacherEmail(),
                        request.getPeopleQueue()
                )
        );

        return ResponseEntity.ok("Queue added successfully!");
    }
}
```

### Status Codes Used

* `200 OK`
* `409 CONFLICT`
* `500 INTERNAL_SERVER_ERROR`

---

### S3 File API

```java
@RestController
@RequestMapping("/api/files")
public class S3FileApiController {

    @PostMapping("/upload/{uid}")          // create

    @GetMapping("/download/{uid}/{filename}") // read

    @DeleteMapping("/delete/{uid}")        // delete
}
```

### Response Semantics

* `200 OK` → successful upload/download
* `404 NOT_FOUND` → missing file
* `400 BAD_REQUEST` → invalid input
* `500 INTERNAL_SERVER_ERROR` → backend failure

---

### Groups CRUD API

```java
@RestController
@RequestMapping("/api/groups")
public class GroupsApiController {

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getAllGroups() {

        try {

            List<Groups> groups = groupsRepository.findAll();

            ...

            return new ResponseEntity<>(result, HttpStatus.OK);

        } catch (Exception e) {

            return new ResponseEntity<>(
                    HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
```

---

### Nested Group Chat Resources

```java
@RestController
@RequestMapping("/api/groups/chat")
@CrossOrigin
public class GroupChatApiController {

    @GetMapping("/analytics/{personId}") ...

    @GetMapping("/{groupId}/messages") ...
}
```

Uses proper REST semantics such as:

```text
404 NOT_FOUND
```

when resources are missing.

---

## 6. Database Integration — JPA, Hibernate, and Query Design

### `@OneToOne` Relationship

`Tinkle ↔ Person`

```java
@OneToOne
@JoinColumn(name = "person_id", unique = true)
@OnDelete(action = OnDeleteAction.CASCADE)
@JsonBackReference
private Person person;
```

---

### `@ManyToMany` Relationship

`Groups ↔ Person`

```java
@ManyToMany(
    fetch = FetchType.LAZY,
    cascade = {
        CascadeType.PERSIST,
        CascadeType.MERGE
    }
)

@JoinTable(
    name = "group_members",
    joinColumns =
        @JoinColumn(name = "group_id"),
    inverseJoinColumns =
        @JoinColumn(name = "person_id")
)

@JsonIgnore
private List<Person> groupMembers =
        new ArrayList<>();
```

---

### `@OneToMany` with Orphan Removal

`Submitter ↔ AssignmentSubmission`

```java
@OneToMany(
    mappedBy = "submitter",
    cascade = CascadeType.ALL,
    orphanRemoval = true
)

@JsonBackReference(value = "submitter-submissions")

private List<AssignmentSubmission> submissions;
```

---

### Polymorphic Persistence with `@Inheritance`

```java
@Entity
@Inheritance(strategy = InheritanceType.JOINED)

@JsonSubTypes({
    @JsonSubTypes.Type(
        value = Person.class,
        name = "person"
    ),
    @JsonSubTypes.Type(
        value = Groups.class,
        name = "group"
    )
})

public abstract class Submitter { ... }
```

---

### Repository Queries

```java
public interface GroupsJpaRepository
        extends JpaRepository<Groups, Long> {

    Optional<Groups> findById(Long id);

    List<Groups> findAllByOrderByNameAsc();

    @Query(
        "SELECT DISTINCT g FROM Groups g " +
        "LEFT JOIN FETCH g.groupMembers gm " +
        "ORDER BY g.id"
    )
    List<Groups> findAllWithMembers();

    @Query(
        "SELECT g FROM Groups g " +
        "JOIN g.groupMembers p " +
        "WHERE p.id = :personId"
    )
    List<Groups> findGroupsByPersonId(
            @Param("personId") Long personId
    );

    @Query(
        value =
            "SELECT p.id, p.uid, p.name, p.email " +
            "FROM group_members gm " +
            "JOIN person p ON gm.person_id = p.id " +
            "WHERE gm.group_id = :groupId " +
            "ORDER BY p.id",
        nativeQuery = true
    )
    List<Object[]> findGroupMembersRaw(
            @Param("groupId") Long groupId
    );

    @Query(
        "SELECT g FROM Groups g " +
        "WHERE LOWER(g.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
        "ORDER BY g.name"
    )
    List<Groups> searchByName(
            @Param("searchTerm") String searchTerm
    );
}
```

### Features Demonstrated

* derived queries
* JPQL
* JOIN FETCH
* native SQL
* case-insensitive search
* relationship traversal

---

### Bulk Modification Queries

```java
public interface BathroomQueueJPARepository
        extends JpaRepository<BathroomQueue, Long> {

    Optional<BathroomQueue> findByTeacherEmail(
            String teacherEmail
    );

    @Modifying
    @Transactional
    @Query("DELETE FROM BathroomQueue")
    void deleteAllRowsInBulk();
}
```

---

### JSON Column Mapping

```java
@JdbcTypeCode(SqlTypes.JSON)

@Column(columnDefinition = "json")

private Map<String, Map<String, Object>> stats =
        new HashMap<>();
```

---

### Transactional Lazy Loading

```java
@GetMapping
@Transactional(readOnly = true)
public ResponseEntity<List<Map<String, Object>>> getAllGroups() { ... }
```

---

## Relationship Types Covered

This project demonstrates all major relationship types required by the rubric:

* `@OneToOne`
* `@OneToMany`
* `@ManyToMany`
* `@Inheritance`
* JSON column persistence
