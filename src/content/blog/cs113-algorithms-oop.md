---
title: 'CS113: Algorithms & Object-Oriented Design'
description: 'Searching, sorting, hashing, Big-O analysis, abstraction, encapsulation, inheritance, polymorphism, and design patterns across the bathroom, groups, and S3 modules.'
pubDate: 'May 28 2026 10:00'
heroImage: '../../assets/cs113-algorithms-oop.jpg'
---

Algorithms and object-oriented design demonstrated across `bathroom/`, `S3uploads/`, `groups/`, and `chat/`.

**Source:** [Pirna-spring](https://github.com/adikatre/Pirna-spring) (Spring backend) · [Pirna-pages](https://github.com/adikatre/Pirna-pages) (frontend)

## Course alignment

| Learning Objective | Evidence Required | Assessment Method |
| ------------------ | ----------------- | ----------------- |
| *Algorithms* | | |
| Searching | Implement search algorithms (linear, binary, database queries) | Code review: Search functionality in API endpoints |
| Sorting | Apply practical sorting to data collections (by date, name, priority, score) using Comparator/Comparable | Code review: Comparator/Comparable implementations for business logic sorting |
| Hashing | Use hashing for passwords, data integrity, efficient lookups | Code review: BCrypt/hashing in authentication, HashMap usage |
| Algorithm Analysis | Analyze time/space complexity of implemented algorithms | Documentation: Big-O analysis in code comments or blog |
| *Object-Oriented Design* | | |
| Abstraction | Create abstract classes or interfaces to define contracts | Code review: Abstract base classes, interface definitions |
| Encapsulation | Use private fields with public getters/setters, hide implementation | Code review: Proper access modifiers in classes |
| Inheritance | Extend base classes to create specialized functionality | Code review: Class hierarchies (User -> Student/Teacher) |
| Polymorphism | Override methods, use interface implementations for flexible design | Code review: Method overriding, interface polymorphism |
| Design Patterns | Apply appropriate design patterns (MVC, Repository, Factory, Singleton) | Code review: Pattern usage in application architecture |

---

## Algorithms

### Searching

*Evidence required — Implement search algorithms (linear, binary, database queries).*  
*Assessment — Code review: Search functionality in API endpoints.*

This module implements **linear search** and **database (JPA) queries**. It does **not** implement binary search — the data is either unsorted in-memory (a comma-separated queue) or searched by the database engine, so neither path warrants a binary search. The honest evidence below is linear scanning plus delegated SQL queries.

**Linear search over a queue.** In `BathroomQueue.java:73-78` the controller converts a comma-separated string into a list and uses `indexOf()` to perform a linear search, giving **O(n)** time complexity.

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

**Database search with Spring Data JPA.** In `GroupsJpaRepository.java:46-50`, `findByName()` performs an exact indexed lookup while the `LIKE` query supports partial matching — in both cases the search is delegated to the database engine.

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

**S3 prefix search.** In `S3FileHandler.java:158-178` all S3 objects under a prefix are scanned (another linear scan), a common pattern for cloud file systems.

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

---

### Sorting

*Evidence required — Apply practical sorting to data collections (by date, name, priority, score) using Comparator/Comparable. Note: Merge, Selection, and Insertion are requirements in AP study sessions.*  
*Assessment — Code review: Comparator/Comparable implementations for business logic sorting.*

**Java Comparator sorting.** In `GroupChatPresenceService.java:80-83` a comparator method reference performs case-insensitive sorting by name.

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

**Database sorting.** In `TeacherJpaRepository.java:9` and `GroupsJpaRepository.java:17` the sorting is delegated to SQL `ORDER BY`, which is more efficient than in-memory sorting for large datasets.

```java
List<Teacher> findAllByOrderByFirstnameAsc();
List<Groups>  findAllByOrderByNameAsc();
```

---

### Hashing

*Evidence required — Use hashing for passwords, data integrity, efficient lookups.*  
*Assessment — Code review: BCrypt/hashing in authentication, HashMap usage.*

This module does **not** implement BCrypt password hashing. The honest evidence here is **HashMap usage** — hash-based data structures (`HashMap`, `ConcurrentHashMap`) for O(1) lookups, plus deterministic content-addressed S3 keys for efficient retrieval.

**HashMap analytics aggregation.** In `TinkleStatisticsService.java:40-47`, hash-based key lookup gives average-case **O(1)** access while aggregating per-user durations.

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

**Concurrent hash tables.** In `GroupChatPresenceService.java:23-24`, thread-safe concurrent hashing via `ConcurrentHashMap.merge()` enables scalable multi-user chat presence tracking.

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

**S3 content key hashing.** In `S3FileHandler.java:199-201`, deterministic content-addressed keys are generated for efficient object retrieval.

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

---

### Algorithm Analysis

*Evidence required — Analyze time/space complexity of implemented algorithms.*  
*Assessment — Documentation: Big-O analysis in code comments or blog.*

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

**Trade-off note.** The chat write path is **O(n)** per message because `addMessage()` re-serializes and re-uploads the entire JSONL file. This works for small groups but scales poorly as message count increases.

---

## Object-Oriented Design

### Abstraction

*Evidence required — Create abstract classes or interfaces to define contracts.*  
*Assessment — Code review: Abstract base classes, interface definitions.*

**FileHandler interface.** In `FileHandler.java:1-47` a storage abstraction layer decouples controllers from storage implementation details — controllers depend on the interface, not on a concrete store.

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

**Abstract base class.** In `Submitter.java:26-42` an abstract base class provides shared functionality for `Groups` and `Person`, demonstrating abstraction through an abstract base class.

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

---

### Encapsulation

*Evidence required — Use private fields with public getters/setters, hide implementation.*  
*Assessment — Code review: Proper access modifiers in classes.*

In `BathroomQueue.java:27-32` and `53-110`, internal state is hidden with `private` and the public methods (`addStudent`, `approveStudent`, `getAway`) are the only access path. Domain methods enforce invariants and prevent invalid state changes — for example, `approveStudent()` ensures `away <= maxOccupancy`.

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

---

### Inheritance

*Evidence required — Extend base classes to create specialized functionality.*  
*Assessment — Code review: Class hierarchies (User -> Student/Teacher).*

In this project the hierarchy is `Submitter -> Groups` / `Submitter -> Person`. In `Groups.java:29-46`, `Groups` inherits fields and behavior from `Submitter` and adds specialized membership functionality.

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

**JOINED inheritance strategy.** In `Submitter.java:17` the `@Inheritance(strategy = InheritanceType.JOINED)` annotation gives parent and child classes their own tables, joined relationally through shared IDs.

```java
@Inheritance(strategy = InheritanceType.JOINED)
```

---

### Polymorphism

*Evidence required — Override methods, use interface implementations for flexible design.*  
*Assessment — Code review: Method overriding, interface polymorphism.*

**FileHandler polymorphism.** In `ChatService.java:25` and `GroupChatService.java:28` the dependency could be typed as `FileHandler`, so any implementation (`S3FileHandler`, `LocalFileHandler`) could be injected.

```java
private final S3FileHandler s3FileHandler;

s3FileHandler.uploadFile(base64Data, MESSAGES_FILE, groupName);
```

**Runtime behavior switching.** In `Submitter.java:36-41`, behavior changes based on the runtime subtype.

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

---

### Design Patterns

*Evidence required — Apply appropriate design patterns (MVC, Repository, Factory, Singleton).*  
*Assessment — Code review: Pattern usage in application architecture.*

**MVC pattern.** The bathroom module separates the three roles cleanly, and the same split appears in the groups module: the Model is `BathroomQueue`, the View is `BathroomViewController`, and the Controller is `BathroomQueueApiController`.

**Repository pattern.** Database access logic is encapsulated behind repository interfaces such as `BathroomQueueJPARepository.java` and `GroupsJpaRepository.java`.

**Strategy / dependency injection.** Injecting `@Autowired private FileHandler fileHandler;` allows interchangeable storage implementations to be swapped in without changing the consumer.

**Singleton pattern.** Spring-managed `@Service` beans are singletons by default — for example `HallPassService`, `GroupChatService`, `TinkleStatisticsService`, and `S3FileHandler`.

**DTO pattern.** Data transfer objects such as `QueueAddReq`, `QueueDto`, `GroupCreateDto`, `BulkGroupCreateDto`, and `FileUploadRequest` carry request and response data across boundaries.

**Factory pattern.** Static methods like `BathroomQueue.init()` generate preconfigured objects.

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
