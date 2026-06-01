---
title: 'CS113: Software Development Practices'
description: 'Version control, testing, build tooling, debugging, REST API design, and JPA across the bathroom, S3 uploads, groups, and chat modules.'
pubDate: 'May 28 2026 11:00'
heroImage: '../../assets/cs113-software-development.jpg'
---

Software development concepts demonstrated across `bathroom/`, `S3uploads/`, `groups/`, and `chat/`.

**Source:** [Pirna-spring](https://github.com/adikatre/Pirna-spring) (Spring backend) · [Pirna-pages](https://github.com/adikatre/Pirna-pages) (frontend)

## Course alignment

| Learning Objective | Evidence Required | Assessment Method |
| --- | --- | --- |
| Version Control | Use Git for branching, committing, pull requests, code reviews | GitHub: Commit history, PR descriptions, branch strategy |
| Testing | Write unit tests, integration tests, API tests | Code review: JUnit tests, Postman collections |
| Build Tools | Use Maven/Gradle for dependency management and builds | Code review: pom.xml/build.gradle configuration |
| Debugging | Use IDE debugger, logging, breakpoints to troubleshoot issues | Documentation: Debug process in blog, console logging |
| API Development | Design RESTful APIs with proper HTTP methods and status codes | Code review: Controller endpoints, ResponseEntity usage |
| Database Integration | Implement JPA/Hibernate with proper relationships (OneToMany, ManyToMany) | Code review: Entity models, repository interfaces, SQL queries |

---

## Software Development

### Version Control

*Evidence required — Use Git for branching, committing, pull requests, code reviews.*  
*Assessment — GitHub: Commit history, PR descriptions, branch strategy.*

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

**Feature branch workflow.** Merge commits show feature branches integrating through pull requests with upstream synchronization, for example:

```text
7cb0f03d Merge branch 'Open-Coding-Society:master' into master
```

This pattern demonstrates feature branch development, pull request merges, and upstream synchronization workflows.

**Separation of concerns in commits.** Documentation commits are isolated from logic changes — a commit like `Adding documentation on Bathroom Queue API File` carries no code edits. Keeping documentation, schema, and logic in separate commits yields cleaner code reviews, easier rollback, and reduced merge conflicts.

**Isolated schema changes.** Schema modifications are separated into dedicated commits such as `Updating group message schema` so reviewers can identify database migration risks independently.

**File-level git history.** Scoping the log to a single file enables line-by-line blame analysis, code review history, contributor tracking, and regression debugging:

```bash
git log -p src/main/java/com/open/spring/mvc/groups/GroupChatService.java
```

---

### Testing

*Evidence required — Write unit tests, integration tests, API tests.*  
*Assessment — Code review: JUnit tests, Postman collections.*

The project test structure mirrors the production structure under `src/test/java/com/open/spring/mvc/chat/`, providing locations for unit tests, service tests, controller tests, and integration tests.

**Example unit tests — `BathroomQueue`.** The `BathroomQueue` class is highly testable because queue logic is isolated into pure state-transition methods.

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

**API / integration testing.** Controllers consistently return `ResponseEntity`, making them easy to validate using Postman, MockMvc, or integration tests. For example, the add-queue endpoint distinguishes a successful creation from a conflict:

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

**Example API assertions.** The first `POST /api/bathroom/addQueue` returns `200 OK`, while a duplicate `POST /api/bathroom/addQueue` returns `409 CONFLICT`.

**Maven test stack.** `pom.xml` includes the Spring Boot test starter, which brings in JUnit 5, MockMvc, AssertJ, and Spring test utilities:

```xml
<dependency>
    <artifactId>spring-boot-starter-test</artifactId>
</dependency>
```

Run tests with `mvn test`.

---

### Build Tools

*Evidence required — Use Maven/Gradle for dependency management and builds.*  
*Assessment — Code review: pom.xml/build.gradle configuration.*

The project uses Maven for dependency management and application builds.

**Spring Web.** Used for REST controllers such as `BathroomQueueApiController`, `GroupsApiController`, and `S3FileApiController`:

```xml
<dependency>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

**WebSocket support.** Used by `GroupChatWebSocketController` and `WebSocketBrokerConfig`:

```xml
<dependency>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

**JPA / Hibernate.** Used by repositories such as `BathroomQueueJPARepository`, `GroupsJpaRepository`, and `TeacherJpaRepository`:

```xml
<dependency>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
```

**AWS SDK v2.** Used by `S3FileHandler`:

```xml
<dependency>
    <groupId>software.amazon.awssdk</groupId>
    <artifactId>s3</artifactId>
</dependency>
```

**Swagger / OpenAPI.** Supports API documentation annotations:

```xml
<dependency>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
</dependency>
```

**Testing dependencies.** The test starter underpins the JUnit/MockMvc stack:

```xml
<dependency>
    <artifactId>spring-boot-starter-test</artifactId>
</dependency>
```

**Maven commands.** Start the application with `mvn spring-boot:run` and run the test suite with `mvn test`.

---

### Debugging

*Evidence required — Use IDE debugger, logging, breakpoints to troubleshoot issues.*  
*Assessment — Documentation: Debug process in blog, console logging.*

The project uses Lombok's `@Slf4j` for structured logging.

**S3 upload debugging.** Logging plus a `null`-client guard gives a clear breakpoint target when uploads fail:

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

**Localized failure handling.** `GroupChatService` isolates malformed JSONL rows instead of failing the entire conversation:

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

**Parse failure diagnostics.** A targeted catch surfaces the offending value when time parsing fails:

```java
} catch (Exception e) {
    System.out.println("⚠️ Failed to parse time: " + pair);
}
```

**Example IDE debugging workflow.** Place a breakpoint at `BathroomQueue.java:127`, send a `POST /api/bathroom/approveQueue` request, then step through `away`, `maxOccupancy`, and the queue invariants.

---

### API Development

*Evidence required — Design RESTful APIs with proper HTTP methods and status codes.*  
*Assessment — Code review: Controller endpoints, ResponseEntity usage.*

**Bathroom Queue API.** The controller pairs each endpoint with explicit status codes — `200 OK`, `409 CONFLICT`, and `500 INTERNAL_SERVER_ERROR`:

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

**S3 File API.** A single resource exposes create, read, and delete via the matching HTTP verbs:

```java
@RestController
@RequestMapping("/api/files")
public class S3FileApiController {

    @PostMapping("/upload/{uid}")          // create

    @GetMapping("/download/{uid}/{filename}") // read

    @DeleteMapping("/delete/{uid}")        // delete
}
```

Its response semantics map cleanly to HTTP: `200 OK` for a successful upload or download, `404 NOT_FOUND` for a missing file, `400 BAD_REQUEST` for invalid input, and `500 INTERNAL_SERVER_ERROR` for backend failures.

**Groups CRUD API.** The groups controller wraps results in `ResponseEntity` and returns `500` on failure:

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

**Nested group chat resources.** Chat endpoints are nested under the groups namespace and return `404 NOT_FOUND` when resources are missing:

```java
@RestController
@RequestMapping("/api/groups/chat")
@CrossOrigin
public class GroupChatApiController {

    @GetMapping("/analytics/{personId}") ...

    @GetMapping("/{groupId}/messages") ...
}
```

---

### Database Integration

*Evidence required — Implement JPA/Hibernate with proper relationships (OneToMany, ManyToMany).*  
*Assessment — Code review: Entity models, repository interfaces, SQL queries.*

**`@OneToOne` relationship (`Tinkle ↔ Person`).** A one-to-one link with cascading delete:

```java
@OneToOne
@JoinColumn(name = "person_id", unique = true)
@OnDelete(action = OnDeleteAction.CASCADE)
@JsonBackReference
private Person person;
```

**`@ManyToMany` relationship (`Groups ↔ Person`).** Membership is modeled through a join table with lazy fetching:

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

**`@OneToMany` with orphan removal (`Submitter ↔ AssignmentSubmission`).** Removing a submission from the collection deletes the row:

```java
@OneToMany(
    mappedBy = "submitter",
    cascade = CascadeType.ALL,
    orphanRemoval = true
)

@JsonBackReference(value = "submitter-submissions")

private List<AssignmentSubmission> submissions;
```

**Polymorphic persistence with `@Inheritance`.** A joined-table hierarchy lets both `Person` and `Groups` act as submitters:

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

**Repository queries.** `GroupsJpaRepository` demonstrates derived queries, JPQL, `JOIN FETCH`, native SQL, case-insensitive search, and relationship traversal:

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

**Bulk modification queries.** `BathroomQueueJPARepository` adds a derived lookup and a transactional bulk delete:

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

**JSON column mapping.** Hibernate persists a nested map directly into a JSON column:

```java
@JdbcTypeCode(SqlTypes.JSON)

@Column(columnDefinition = "json")

private Map<String, Map<String, Object>> stats =
        new HashMap<>();
```

**Transactional lazy loading.** `@Transactional(readOnly = true)` keeps the session open so lazy collections resolve during serialization:

```java
@GetMapping
@Transactional(readOnly = true)
public ResponseEntity<List<Map<String, Object>>> getAllGroups() { ... }
```

Together these snippets cover all major relationship types required by the rubric — `@OneToOne`, `@OneToMany`, `@ManyToMany`, `@Inheritance`, and JSON column persistence.
