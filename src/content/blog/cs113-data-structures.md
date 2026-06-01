---
title: 'CS113: Java Data Structures in Practice'
description: 'Collections, lists, FIFO queues, trees, sets, maps, and graphs — concrete uses across the bathroom queue, group chat, and presence-tracking code.'
pubDate: 'May 28 2026 09:00'
heroImage: '../../assets/cs113-data-structures.jpg'
---

Java data structures demonstrated across `bathroom/`, `S3uploads/`, `groups/`, and `chat/`.

**Source:** [Pirna-spring](https://github.com/adikatre/Pirna-spring) (Spring backend) · [Pirna-pages](https://github.com/adikatre/Pirna-pages) (frontend)

## Course alignment

| Learning Objective | Evidence Required | Assessment Method |
| --- | --- | --- |
| Collections | Use appropriate Java collections (ArrayList, HashMap, HashSet) in backend | Code review: Collection implementations in models/controllers |
| Lists | Implement list operations for managing data (add, remove, search, iterate) | Code review: List manipulation in service layer |
| Stacks/Queues | Apply stack/queue structures where appropriate (undo/redo, task queues) | Code review: Stack/queue usage in application logic |
| Trees | Implement tree structures OR use ML libraries (Smile, Weka) with tree-based algorithms (Decision Tree Classification, Random Forest) | Code review: Tree implementation, organizational hierarchy, or ML model integration |
| Sets | Use sets for unique data management (user roles, permissions, tags) | Code review: Set operations in authentication/authorization |
| Dictionaries/Maps | Implement key-value mappings for efficient data lookup | Code review: HashMap/JSONObject usage for configuration |
| Graphs | Model user relationships/networks using graph structures; implement graph algorithms (friend recommendations via BFS/DFS, community detection, influence ranking, task dependencies, collaboration networks) | Code review: Graph representation (adjacency list/matrix), graph traversal algorithms, pathfinding for recommendations |

---

## Data Structures

### Collections

*Evidence required — use appropriate Java collections (ArrayList, HashMap, HashSet) in backend.*  
*Assessment — code review: collection implementations in models/controllers.*

`GroupChatPresenceService` uses concurrent maps and a `HashSet` snapshot to track WebSocket presence across groups. The concurrent types behave like the plain `HashMap`/`HashSet` shown here:

```java run
// groups/GroupChatPresenceService.java (distilled)
import java.util.*;

public class Main {
    public static void main(String[] args) {
        // session -> user
        Map<String, String> sessions = new HashMap<>();
        sessions.put("sessionA", "alice");
        sessions.put("sessionB", "bob");

        // group -> set of joined users (HashSet dedupes)
        Map<Long, Set<String>> usersByGroup = new HashMap<>();
        usersByGroup.computeIfAbsent(1L, k -> new HashSet<>()).add("alice");
        usersByGroup.computeIfAbsent(1L, k -> new HashSet<>()).add("bob");
        usersByGroup.computeIfAbsent(1L, k -> new HashSet<>()).add("alice"); // duplicate ignored

        // Snapshot the user's joined groups into a HashSet so we can iterate
        // while the underlying set is mutated elsewhere.
        for (Long groupId : new HashSet<>(usersByGroup.keySet())) {
            System.out.println("group " + groupId + " -> " + usersByGroup.get(groupId));
        }
        System.out.println("sessions: " + sessions);
    }
}
```

Maps hold relationships such as `session -> user` and `group -> user -> connection-count`. The `HashSet` copy allows iteration while safely mutating the underlying set.

`Teacher` uses a nested `HashMap` for JSON-backed daily statistics:

```java run
// bathroom/Teacher.java (distilled)
import java.util.*;

public class Main {
    public static void main(String[] args) {
        // day -> (metric -> value)
        Map<String, Map<String, Object>> stats = new HashMap<>();

        Map<String, Object> monday = new HashMap<>();
        monday.put("visits", 12);
        monday.put("avgSeconds", 95.4);
        stats.put("Mon", monday);

        System.out.println(stats);
        System.out.println("Monday visits = " + stats.get("Mon").get("visits"));
    }
}
```

**References**

* `GroupChatPresenceService.java:23-24`, `GroupChatPresenceService.java:92`
* `Teacher.java:74-76`

---

### Lists

*Evidence required — implement list operations for managing data (add, remove, search, iterate).*  
*Assessment — code review: list manipulation in service layer.*

`Groups` wraps a JPA `List<Person>` and exposes safe add/remove operations using `contains`. The same guard logic runs below with plain `String` members:

```java run
// groups/Groups.java (distilled)
import java.util.*;

public class Main {
    static List<String> groupMembers = new ArrayList<>();

    static void addPerson(String person) {
        if (!groupMembers.contains(person)) {   // search
            groupMembers.add(person);            // add
        }
    }

    static void removePerson(String person) {
        if (groupMembers.contains(person)) {
            groupMembers.remove(person);         // remove
        }
    }

    public static void main(String[] args) {
        addPerson("alice");
        addPerson("bob");
        addPerson("alice");      // ignored — already a member
        removePerson("bob");

        for (String m : groupMembers) {          // iterate
            System.out.println("member: " + m);
        }
        System.out.println("size = " + groupMembers.size());
    }
}
```

`GroupChatService.addMessage()` iterates a list and rewrites it; `deleteMessage()` uses `removeIf()` to search-and-remove:

```java run
// groups/GroupChatService.java (distilled)
import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        List<String> messages = new ArrayList<>(List.of("m1: hi", "m2: hello", "m3: bye"));

        messages.add("m4: later");                       // add

        String jsonl = messages.stream()                 // iterate
                .collect(Collectors.joining("\n"));
        System.out.println("--- before ---\n" + jsonl);

        boolean removed = messages.removeIf(m -> m.startsWith("m2")); // search + remove
        System.out.println("\nremoved m2? " + removed);
        System.out.println("--- after ---\n" + String.join("\n", messages));
    }
}
```

**Reference:** `Groups.java:57-69`, `GroupChatService.java:92-122`

---

### Stacks/Queues

*Evidence required — apply stack/queue structures where appropriate (undo/redo, task queues).*  
*Assessment — code review: stack/queue usage in application logic.*

`BathroomQueue` implements queue behavior using a comma-separated string. The enqueue / peek / dequeue logic below is the real algorithm, runnable end-to-end:

```java run
// bathroom/BathroomQueue.java (distilled — real FIFO logic)
public class Main {
    static String peopleQueue;   // comma-separated FIFO line
    static int away = 0;
    static int maxOccupancy = 1;

    static void addStudent(String name) {              // enqueue
        if (peopleQueue == null || peopleQueue.isEmpty()) {
            peopleQueue = name;
        } else {
            peopleQueue += "," + name;
        }
    }

    static String getFrontStudent() {                  // peek
        if (peopleQueue != null && !peopleQueue.isEmpty()) {
            return peopleQueue.split(",")[0];
        }
        return null;
    }

    static void approveStudent() {                     // dequeue / approval pop
        if (away < maxOccupancy) {
            int totalInQueue = peopleQueue.split(",").length;
            if (away < totalInQueue) away++;
        }
    }

    public static void main(String[] args) {
        addStudent("alice");
        addStudent("bob");
        addStudent("carol");
        System.out.println("queue: " + peopleQueue);
        System.out.println("front (peek): " + getFrontStudent());

        approveStudent();   // teacher approves the front of the line (FIFO)
        System.out.println("away after approval: " + away);
    }
}
```

The teacher always approves the student at the front of the line, matching FIFO queue behavior. The bathroom line is the project's "task queue": students enqueue requests and the teacher pops them in arrival order.

**Reference:** `BathroomQueue.java:53-143`

---

### Trees

*Evidence required — implement tree structures OR use ML libraries (Smile, Weka) with tree-based algorithms (Decision Tree Classification, Random Forest).*  
*Assessment — code review: tree implementation, organizational hierarchy, or ML model integration.*

This project does **not** integrate an ML library (Smile or Weka) and does not train Decision Tree or Random Forest models. It satisfies the rubric's other option — a **tree-shaped organizational hierarchy**. `TinkleStatisticsService` uses `Collectors.groupingBy()` to build a hierarchical aggregation (`root -> user -> durations`), a tree whose root branches into users and whose leaves are each user's duration lists:

```java run
// bathroom/TinkleStatisticsService.java (distilled)
import java.util.*;
import java.util.stream.*;

record Tinkle(String personName, int durationSeconds) {}

public class Main {
    public static void main(String[] args) {
        List<Tinkle> tinkleList = List.of(
            new Tinkle("alice", 30), new Tinkle("bob", 45),
            new Tinkle("alice", 50), new Tinkle("bob", 20));

        Map<String, List<Integer>> userWeeklyDurations = tinkleList.stream()
            .filter(t -> t.personName() != null)
            .collect(Collectors.groupingBy(
                Tinkle::personName,
                Collectors.mapping(Tinkle::durationSeconds, Collectors.toList())));

        // root
        //  └── user
        //       └── list of weekly durations
        userWeeklyDurations.forEach((user, durations) ->
            System.out.println(user + " -> " + durations));
    }
}
```

The `groupingBy` result is a one-level-deep hierarchy: a root node fanning out to one child per user, each child holding that user's leaf durations.

**Reference:** `TinkleStatisticsService.java:27-50`

---

### Sets

*Evidence required — use sets for unique data management (user roles, permissions, tags).*  
*Assessment — code review: set operations in authentication/authorization.*

`PresenceSession` uses a concurrent set to prevent duplicate group memberships; a `HashSet` snapshot is taken for safe iteration. Uniqueness and the snapshot run below:

```java run
// groups/GroupChatPresenceService.java (distilled)
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Set<Long> groups = new HashSet<>();
        groups.add(1L);
        groups.add(2L);
        groups.add(1L);   // duplicate — ignored by the set

        System.out.println("unique groups: " + groups);

        // Snapshot copy guarantees uniqueness while enabling safe iteration.
        for (Long groupId : new HashSet<>(groups)) {
            System.out.println("joined group " + groupId);
        }
    }
}
```

The set enforces that a user belongs to each group at most once — the same uniqueness guarantee the rubric calls for with roles, permissions, or tags.

**Reference:** `GroupChatPresenceService.java:135-152`

---

### Dictionaries/Maps

*Evidence required — implement key-value mappings for efficient data lookup.*  
*Assessment — code review: HashMap/JSONObject usage for configuration.*

`GroupChatService.getUserAnalytics()` builds nested analytics payloads using `HashMap`:

```java run
// groups/GroupChatService.java (distilled)
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<String, Object> analytics = new HashMap<>();
        List<Map<String, Object>> groupAnalyticsList = new ArrayList<>();

        String[] groupNames = {"Math", "CS"};
        int totalMessagesSent = 0;

        for (String groupName : groupNames) {
            int messagesSent = groupName.length();    // stand-in metric
            Map<String, Object> groupEntry = new HashMap<>();
            groupEntry.put("groupName", groupName);
            groupEntry.put("messagesSent", messagesSent);
            groupAnalyticsList.add(groupEntry);
            totalMessagesSent += messagesSent;
        }

        analytics.put("totalGroups", groupNames.length);
        analytics.put("totalMessagesSent", totalMessagesSent);
        analytics.put("groups", groupAnalyticsList);

        System.out.println(analytics);
    }
}
```

Each `HashMap` key gives O(1) lookup of the analytics value, the key-value mapping the rubric asks for.

**References:** `GroupChatService.java:152-195`, `GroupChatService.java:133-141`

---

### Graphs

*Evidence required — model user relationships/networks using graph structures; implement graph algorithms (friend recommendations via BFS/DFS, community detection, influence ranking, task dependencies, collaboration networks).*  
*Assessment — code review: graph representation (adjacency list/matrix), graph traversal algorithms, pathfinding for recommendations.*

The `Groups ↔ Person` many-to-many relationship forms a bipartite graph represented as an **adjacency list**. The project implements two of the rubric's required pieces — **graph representation** (adjacency list) and **graph traversal** (a 2-hop walk over a person's connected groups). It does **not** implement PageRank-style influence ranking or topological-sort task dependencies; the 2-hop traversal below is instead the foundation for friend recommendations and mutual-connection discovery. Building the adjacency list and traversing a person's connected groups runs below:

```java run
// groups (distilled) — adjacency list + traversal
import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Adjacency list: group -> members
        Map<String, List<String>> groupMembers = new HashMap<>();
        groupMembers.put("Math", new ArrayList<>(List.of("alice", "bob")));
        groupMembers.put("CS",   new ArrayList<>(List.of("alice", "carol")));

        // Inverse adjacency: person -> groups
        Map<String, List<String>> personGroups = new HashMap<>();
        groupMembers.forEach((group, members) ->
            members.forEach(p ->
                personGroups.computeIfAbsent(p, k -> new ArrayList<>()).add(group)));

        // Traverse alice's connected groups and aggregate.
        String person = "alice";
        int reachableMembers = 0;
        System.out.println(person + " -> groups " + personGroups.get(person));
        for (String group : personGroups.get(person)) {
            reachableMembers += groupMembers.get(group).size();
        }
        System.out.println("2-hop reachable member slots: " + reachableMembers);
    }
}
```

This adjacency-list representation plus 2-hop traversal forms the basis for friend recommendations and mutual-connection discovery, satisfying the rubric's graph-representation and graph-traversal evidence.

**References:** `Groups.java:30-37`, `GroupChatService.java:152-195`
