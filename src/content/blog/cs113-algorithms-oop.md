---
title: 'CS113: Algorithms, OOP & Engineering Concepts'
description: 'Searching, sorting, hashing, Big-O analysis, abstraction, inheritance, polymorphism, and design patterns across the bathroom, groups, and S3 modules.'
pubDate: 'May 28 2026 10:00'
heroImage: '../../assets/cs113-algorithms-oop.jpg'
---

Data structures, algorithms, OOP, and software engineering concepts demonstrated across `bathroom/`, `S3uploads/`, `groups/`, and `chat/`.

**Source:** [Pirna-spring](https://github.com/adikatre/Pirna-spring) (Spring backend) · [Pirna-pages](https://github.com/adikatre/Pirna-pages) (frontend)

## 1. Searching — Linear Search, DB Queries, Derived Finders

### Linear Search Over a Queue

**File:** `BathroomQueue.java:73-78`

```java run
// BathroomQueue.java:73-78 (distilled)
import java.util.*;

public class Main {
    static String peopleQueue = "alice,bob,carol";

    static int getStudentIndex(String studentName) {
        if (peopleQueue == null || peopleQueue.isEmpty()) return -1;
        List<String> students = Arrays.asList(peopleQueue.split(","));
        return students.indexOf(studentName);   // O(n) linear scan
    }

    public static void main(String[] args) {
        System.out.println("index of bob:  " + getStudentIndex("bob"));
        System.out.println("index of dave: " + getStudentIndex("dave"));
    }
}
```

* Converts a comma-separated string into a list.
* Uses `indexOf()` to perform a linear search.
* Time complexity: **O(n)**.

---

### Database Search with Spring Data JPA

**File:** `GroupsJpaRepository.java:46-50`

```java
Optional<Groups> findByName(String name);   // indexed exact lookup

@Query("""
SELECT g
FROM Groups g
WHERE LOWER(g.name) LIKE LOWER(CONCAT('%', :searchTerm, '%'))
ORDER BY g.name
""")
List<Groups> searchByName(@Param("searchTerm") String searchTerm);
```

* `findByName()` performs an exact lookup.
* `LIKE` query supports partial matching.
* Search is delegated to the database engine.

---

### S3 Prefix Search

**File:** `S3FileHandler.java:158-178`

```java run
// S3FileHandler.java:158-178 (distilled — the prefix scan itself)
import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        // Stand-in for the bucket's object keys.
        List<String> allKeys = List.of(
            "uid1/photo.png", "uid1/notes.txt", "uid2/photo.png");
        String prefix = "uid1/";

        List<String> matches = allKeys.stream()
            .filter(key -> key.startsWith(prefix))
            .collect(Collectors.toList());

        System.out.println("keys under " + prefix + " -> " + matches);
    }
}
```

* Searches all S3 objects under a prefix.
* Common pattern for cloud file systems.

---

## 2. Sorting — Comparator, Comparable, ORDER BY

### Java Comparator Sorting

**File:** `GroupChatPresenceService.java:80-83`

```java run
// GroupChatPresenceService.java:80-83 (distilled)
import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        Map<String, Integer> participantCounts = new LinkedHashMap<>();
        participantCounts.put("Bob", 2);
        participantCounts.put("alice", 5);
        participantCounts.put("Carol", 1);

        List<String> sorted = participantCounts.keySet().stream()
                .sorted(String::compareToIgnoreCase)
                .collect(Collectors.toList());

        System.out.println(sorted);
    }
}
```

* Uses a comparator method reference.
* Performs case-insensitive sorting.

---

### Database Sorting

**Files:** `TeacherJpaRepository.java:9`, `GroupsJpaRepository.java:17`

```java
List<Teacher> findAllByOrderByFirstnameAsc();
List<Groups>  findAllByOrderByNameAsc();
```

* Delegates sorting to SQL `ORDER BY`.
* More efficient than in-memory sorting for large datasets.

---

## 3. Hashing — HashMap, HashSet, ConcurrentHashMap

### HashMap Analytics Aggregation

**File:** `TinkleStatisticsService.java:40-47`

```java run
// TinkleStatisticsService.java:40-47 (distilled)
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<String, List<Long>> userWeeklyDurations = new HashMap<>();
        userWeeklyDurations.put("alice", List.of(30L, 50L));
        userWeeklyDurations.put("bob", List.of(45L, 20L, 25L));

        Map<String, Long> averageWeeklyDurations = new HashMap<>();

        for (Map.Entry<String, List<Long>> entry : userWeeklyDurations.entrySet()) {
            long total = entry.getValue()
                              .stream()
                              .mapToLong(Long::longValue)
                              .sum();

            averageWeeklyDurations.put(
                entry.getKey(),
                total / entry.getValue().size()   // hash-based O(1) put
            );
        }

        System.out.println(averageWeeklyDurations);
    }
}
```

* Uses hash-based key lookup.
* Average-case access time: **O(1)**.

---

### Concurrent Hash Tables

**File:** `GroupChatPresenceService.java:23-24`

```java run
// GroupChatPresenceService.java:23-24 (distilled — thread-safe counting)
import java.util.concurrent.*;

public class Main {
    public static void main(String[] args) {
        ConcurrentMap<String, Integer> participantCounts = new ConcurrentHashMap<>();

        // merge() is an atomic read-modify-write — safe under concurrency.
        participantCounts.merge("groupA", 1, Integer::sum);
        participantCounts.merge("groupA", 1, Integer::sum);
        participantCounts.merge("groupB", 1, Integer::sum);

        System.out.println(participantCounts);   // {groupA=2, groupB=1}
    }
}
```

* Thread-safe concurrent hashing.
* Enables scalable multi-user chat presence tracking.

---

### S3 Content Key Hashing

**File:** `S3FileHandler.java:199-201`

```java run
// S3FileHandler.java:199-201 (distilled)
public class Main {
    static String generateKey(String uid, String filename) {
        return uid + "/" + filename;
    }

    public static void main(String[] args) {
        System.out.println(generateKey("uid42", "photo.png"));
        System.out.println(generateKey("uid42", "notes.txt"));
    }
}
```

* Generates deterministic content-addressed keys.
* Used for efficient object retrieval.

---

## 4. Algorithm Analysis — Big-O Complexity

| Operation                         | File                               | Big-O                      |
| --------------------------------- | ---------------------------------- | -------------------------- |
| `addStudent` (string append)      | `BathroomQueue.java:53`            | `O(n)` string copy         |
| `getFrontStudent`                 | `BathroomQueue.java:115`           | `O(n)` split               |
| `getStudentIndex`                 | `BathroomQueue.java:73`            | `O(n)` linear scan         |
| `joinGroup / leaveGroup`          | `GroupChatPresenceService.java:26` | `O(1)` average             |
| `getMessages` JSONL replay        | `GroupChatService.java:54`         | `O(n)`                     |
| `deleteMessage`                   | `GroupChatService.java:107`        | `O(n)` read + `O(n)` write |
| `deleteFiles`                     | `S3FileHandler.java:118`           | `O(n)` list                |
| `calculateAverageWeeklyDurations` | `TinkleStatisticsService.java:27`  | `O(n·k)`                   |

### Trade-Off Note

The chat write path is **O(n)** per message because `addMessage()` re-serializes and re-uploads the entire JSONL file. This works for small groups but scales poorly as message count increases.

---

## 5. Abstraction — Interfaces and Abstract Classes

### FileHandler Interface

**File:** `FileHandler.java:1-47`

```java run
// FileHandler.java (distilled — abstraction in action)
public class Main {
    // The abstraction: controllers depend on this, not on a concrete store.
    interface FileHandler {
        String uploadFile(String base64Data, String filename, String uid);
        boolean fileExists(String uid, String filename);
    }

    // One concrete implementation behind the interface.
    static class LocalFileHandler implements FileHandler {
        public String uploadFile(String base64Data, String filename, String uid) {
            return "stored " + filename + " for " + uid
                    + " (" + base64Data.length() + " chars)";
        }
        public boolean fileExists(String uid, String filename) {
            return true;
        }
    }

    public static void main(String[] args) {
        FileHandler handler = new LocalFileHandler();   // decoupled from impl
        System.out.println(handler.uploadFile("aGVsbG8=", "note.txt", "uid1"));
        System.out.println("exists? " + handler.fileExists("uid1", "note.txt"));
    }
}
```

* Defines a storage abstraction layer.
* Decouples controllers from storage implementation details.

---

### Abstract Base Class

**File:** `Submitter.java:26-42`

```java
public abstract class Submitter {

    @Id
    @GeneratedValue
    private Long id;

    @OneToMany(mappedBy = "submitter", ...)
    private List<AssignmentSubmission> submissions;

    public List<Person> getMembers() {
        if (this instanceof Groups)
            return ((Groups) this).getGroupMembers();

        return List.of((Person) this);
    }
}
```

* Shared base functionality for `Groups` and `Person`.
* Demonstrates abstraction through inheritance.

---

## 6. Encapsulation — Private State and Controlled Mutation

**Files:** `BathroomQueue.java:27-32`, `53-110`

```java run
// BathroomQueue.java:27-110 (distilled — private state + invariant)
public class Main {
    static class BathroomQueue {
        private String peopleQueue = "";
        private int away = 0;
        private int maxOccupancy = 1;

        public void addStudent(String studentName) {
            peopleQueue = peopleQueue.isEmpty() ? studentName : peopleQueue + "," + studentName;
        }

        public void approveStudent() {
            if (away < maxOccupancy) away++;   // invariant: away <= maxOccupancy
        }

        public int getAway() { return away; }
    }

    public static void main(String[] args) {
        BathroomQueue q = new BathroomQueue();
        q.addStudent("alice");
        q.addStudent("bob");

        q.approveStudent();
        q.approveStudent();   // blocked — maxOccupancy already reached

        System.out.println("away = " + q.getAway() + " (capped at maxOccupancy)");
    }
}
```

* Internal state is hidden with `private`.
* Domain methods enforce invariants.
* Prevents invalid state changes.

Example:

* `approveStudent()` ensures `away <= maxOccupancy`.

---

## 7. Inheritance — Submitter → Groups

**File:** `Groups.java:29-46`

```java run
// Groups.java:29-46 (distilled — inheritance without the JPA annotations)
import java.util.*;

public class Main {
    static abstract class Submitter {
        Long id;
        String describe() { return "Submitter#" + id; }
    }

    static class Groups extends Submitter {
        private List<String> groupMembers = new ArrayList<>();
        private String name, period, course;

        Groups(String name) { this.name = name; }
        void addMember(String p) { groupMembers.add(p); }
        @Override String describe() { return name + " " + groupMembers; }
    }

    public static void main(String[] args) {
        Groups g = new Groups("Period 3 CS");
        g.id = 7L;                       // field inherited from Submitter
        g.addMember("alice");
        g.addMember("bob");
        System.out.println(g.describe());
    }
}
```

* `Groups` inherits fields and behavior from `Submitter`.
* Adds specialized membership functionality.

---

### JOINED Inheritance Strategy

**File:** `Submitter.java:17`

```java
@Inheritance(strategy = InheritanceType.JOINED)
```

* Parent and child classes each have their own tables.
* Joined relationally through shared IDs.

---

## 8. Polymorphism — Runtime Dispatch

### FileHandler Polymorphism

**Files:** `ChatService.java:25`, `GroupChatService.java:28`

```java
private final S3FileHandler s3FileHandler;

s3FileHandler.uploadFile(base64Data, MESSAGES_FILE, groupName);
```

* Could be typed as `FileHandler`.
* Any implementation (`S3FileHandler`, `LocalFileHandler`) could be injected.

---

### Runtime Behavior Switching

**File:** `Submitter.java:36-41`

```java run
// Submitter.java:36-41 (distilled — runtime dispatch)
import java.util.*;

public class Main {
    static abstract class Submitter {
        List<String> getMembers() {
            if (this instanceof Groups)
                return ((Groups) this).groupMembers;
            return List.of(((Person) this).name);
        }
    }
    static class Groups extends Submitter { List<String> groupMembers = new ArrayList<>(); }
    static class Person extends Submitter { String name; Person(String n) { name = n; } }

    public static void main(String[] args) {
        Groups g = new Groups();
        g.groupMembers.addAll(List.of("alice", "bob"));

        Submitter asGroup = g;                 // same static type...
        Submitter asPerson = new Person("carol");

        System.out.println("group  -> " + asGroup.getMembers());   // [alice, bob]
        System.out.println("person -> " + asPerson.getMembers());  // [carol]
    }
}
```

* Behavior changes based on runtime subtype.

---

## 9. Design Patterns

### MVC Pattern

| Role       | Example                      |
| ---------- | ---------------------------- |
| Model      | `BathroomQueue`              |
| View       | `BathroomViewController`     |
| Controller | `BathroomQueueApiController` |

Also present in the groups module.

---

### Repository Pattern

Examples:

```java
BathroomQueueJPARepository.java
GroupsJpaRepository.java
```

* Encapsulates database access logic.

---

### Strategy / Dependency Injection

```java
@Autowired
private FileHandler fileHandler;
```

* Allows interchangeable storage implementations.

---

### Singleton Pattern

Spring-managed services:

```java
@Service
```

Examples:

* `HallPassService`
* `GroupChatService`
* `TinkleStatisticsService`
* `S3FileHandler`

---

### DTO Pattern

Examples:

* `QueueAddReq`
* `QueueDto`
* `GroupCreateDto`
* `BulkGroupCreateDto`
* `FileUploadRequest`

---

### Factory Pattern

```java run
// BathroomQueue.init() (distilled — static factory method)
public class Main {
    static class BathroomQueue {
        String teacherEmail;
        String peopleQueue;

        static BathroomQueue init() {                // factory
            BathroomQueue q = new BathroomQueue();
            q.teacherEmail = "default@school.edu";
            q.peopleQueue = "";                      // preconfigured empty line
            return q;
        }
    }

    public static void main(String[] args) {
        BathroomQueue q = BathroomQueue.init();
        System.out.println("preconfigured queue for " + q.teacherEmail);
    }
}
```

* Static methods generate preconfigured objects.

---

## 10. Version Control — Git History

Example commits:

```text
4a8d6287 email send requires auth
4b6ae279 email api constructor
238d3300 constructor for email send
a7a07f89 email send hashmap
```

* Small, focused commits.
* Clear iterative development history.

---

## 11. Testing — JUnit and API Testing

### JUnit Test Structure

```text
src/test/java/com/open/spring/mvc/chat/
```

* Standard Maven/Spring test layout.

---

### REST API Testing

Controllers return proper HTTP responses:

```java
@RestController
ResponseEntity<?>
```

Supports:

* Postman testing
* Integration testing
* HTTP status assertions

---

## 12. Build Tools — Maven

### Maven Configuration

```text
pom.xml
```

Handles:

* Dependency management
* Build lifecycle
* Lombok integration
* AWS SDK integration

---

### Example Dependencies

```java
software.amazon.awssdk
lombok.extern.slf4j.Slf4j
```

---

## 13. Debugging — Logging and Defensive Programming

### SLF4J Logging

**File:** `S3FileHandler.java:65-89`

```java
@Slf4j
public class S3FileHandler implements FileHandler {

    public String uploadFile(String base64Data,
                             String filename,
                             String uid) {

        if (s3Client == null) {
            log.warn("S3 upload attempted but S3 client is not configured.");
            return null;
        }

        String key = generateKey(uid, filename);

        System.out.println("S3 Upload: " + key);

        try {
            ...
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
}
```

* Structured logging.
* Defensive exception handling.

---

### Fault-Tolerant Parsing

**File:** `GroupChatService.java:81-83`

```java run
// GroupChatService.java:81-83 (distilled — fault-tolerant parsing)
import java.util.*;

public class Main {
    public static void main(String[] args) {
        String[] lines = {"42", "not-a-number", "17"};   // one malformed line
        List<Integer> parsed = new ArrayList<>();

        for (String line : lines) {
            try {
                parsed.add(Integer.parseInt(line));
            } catch (Exception e) {
                System.out.println("Skipping invalid line: " + line);
            }
        }

        System.out.println("parsed = " + parsed);   // [42, 17]
    }
}
```

* Prevents a single malformed message from crashing processing.

---

## 14. API Development — REST Endpoints and HTTP Codes

### REST Endpoint Example

**File:** `BathroomQueueApiController.java:98-116`

```java
@PostMapping("/addQueue")
public ResponseEntity<String> addQueue(
        @RequestBody QueueAddReq request) {

    Optional<BathroomQueue> existingQueue =
            repository.findByTeacherEmail(
                    request.getTeacherEmail());

    if (existingQueue.isPresent()) {
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body("Queue already exists for this teacher.");
    }

    repository.save(
            new BathroomQueue(
                    request.getTeacherEmail(),
                    request.getPeopleQueue()));

    return ResponseEntity.ok("Queue added successfully!");
}
```

---

### HTTP Status Usage

Examples:

* `200 OK`
* `400 BAD_REQUEST`
* `404 NOT_FOUND`
* `409 CONFLICT`
* `500 INTERNAL_SERVER_ERROR`

---

### Swagger/OpenAPI Documentation

```java
@Tag(
    name = "Bathroom Queue API",
    description = "Endpoints for managing the bathroom queue"
)

@Operation(
    summary = "Create a new bathroom queue"
)
```

* Self-documenting APIs.

---

## 15. Database Integration — JPA Relationships

### One-to-One Relationship

**File:** `Tinkle.java:37-41`

```java
@OneToOne
@JoinColumn(name = "person_id", unique = true)
@OnDelete(action = OnDeleteAction.CASCADE)
@JsonBackReference
private Person person;
```

---

### Many-to-Many Relationship

**File:** `Groups.java:30-37`

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
    joinColumns = @JoinColumn(name = "group_id"),
    inverseJoinColumns = @JoinColumn(name = "person_id")
)

private List<Person> groupMembers = new ArrayList<>();
```

---

### One-to-Many Relationship

**File:** `Submitter.java:31-33`

```java
@OneToMany(
    mappedBy = "submitter",
    cascade = CascadeType.ALL,
    orphanRemoval = true
)

private List<AssignmentSubmission> submissions;
```

---

### Custom JPQL + Native SQL

**File:** `GroupsJpaRepository.java:20-43`

```java
@Query("""
SELECT DISTINCT g
FROM Groups g
LEFT JOIN FETCH g.groupMembers gm
ORDER BY g.id
""")
List<Groups> findAllWithMembers();
```

```java
@Query(value = """
SELECT p.id, p.uid, p.name, p.email
FROM group_members gm
JOIN person p
ON gm.person_id = p.id
WHERE gm.group_id = :groupId
ORDER BY p.id
""", nativeQuery = true)
List<Object[]> findGroupMembersRaw(
        @Param("groupId") Long groupId);
```

---

### JSON Column Mapping

```java
@JdbcTypeCode(SqlTypes.JSON)
@Convert(... JsonType.class)
```

* Stores arbitrary structured data directly in database columns.
