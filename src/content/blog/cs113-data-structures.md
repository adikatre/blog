---
title: 'CS113: Java Data Structures in Practice'
description: 'Collections, lists, FIFO queues, trees, sets, maps, and graphs — concrete uses across the bathroom queue, group chat, and presence-tracking code.'
pubDate: 'May 28 2026 11:00'
heroImage: '../../assets/cs113-data-structures.jpg'
---

Java data structures demonstrated across `bathroom/`, `S3uploads/`, `groups/`, and `chat/`.

**Source:** [Pirna-spring](https://github.com/adikatre/Pirna-spring) (Spring backend) · [Pirna-pages](https://github.com/adikatre/Pirna-pages) (frontend)

## 1. Collections — ArrayList, HashMap, HashSet

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

## 2. Lists — Add / Remove / Search / Iterate

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

## 3. Stacks / Queues — BathroomQueue (FIFO)

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

The teacher always approves the student at the front of the line, matching FIFO queue behavior.

**Reference:** `BathroomQueue.java:53-143`

---

## 4. Trees — Hierarchical Aggregation Structure

`TinkleStatisticsService` uses `Collectors.groupingBy()` to build a hierarchical aggregation (`root -> user -> durations`):

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

This tree-like structure is commonly consumed by decision-tree ML systems such as Smile or Weka.

**Reference:** `TinkleStatisticsService.java:27-50`

---

## 5. Sets — Unique Data with HashSet

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

**Reference:** `GroupChatPresenceService.java:135-152`

---

## 6. Dictionaries / Maps — Key/Value Analytics

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

**References:** `GroupChatService.java:152-195`, `GroupChatService.java:133-141`

---

## 7. Graphs — Group ↔ Member Adjacency and Traversal

The `Groups ↔ Person` many-to-many relationship forms a bipartite graph represented as an adjacency list. Building the adjacency list and traversing a person's connected groups runs below:

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

This forms the basis for friend recommendations, mutual-connection discovery, and 2-hop graph queries.

**References:** `Groups.java:30-37`, `GroupChatService.java:152-195`
