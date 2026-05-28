---
title: 'CS113: Java Data Structures in Practice'
description: 'Collections, lists, FIFO queues, trees, sets, maps, and graphs — concrete uses across the bathroom queue, group chat, and presence-tracking code.'
pubDate: 'May 28 2026 11:00'
---

Java data structures demonstrated across `bathroom/`, `S3uploads/`, `groups/`, and `chat/`.

## 1. Collections — ArrayList, HashMap, HashSet

`GroupChatPresenceService` uses concurrent maps and a `HashSet` snapshot to track WebSocket presence across groups.

```java
// groups/GroupChatPresenceService.java:23-24
private final ConcurrentMap<String, PresenceSession> sessions = new ConcurrentHashMap<>();
private final ConcurrentMap<Long, ConcurrentMap<String, Integer>> participantCountsByGroup = new ConcurrentHashMap<>();

// line 92 — snapshot the user's joined groups into a HashSet
for (Long groupId : new HashSet<>(presenceSession.getGroups())) { ... }
```

Maps hold relationships such as:

* `session -> user`
* `group -> user -> connection-count`

The `HashSet` copy allows iteration while safely mutating the underlying set.

**References**

* `GroupChatPresenceService.java:23-24`
* `GroupChatPresenceService.java:92`

`Teacher` uses a nested `HashMap` for JSON-backed daily statistics.

```java
// bathroom/Teacher.java:74-76
@JdbcTypeCode(SqlTypes.JSON)
@Column(columnDefinition = "json")
private Map<String, Map<String, Object>> stats = new HashMap<>();
```

**Reference**

* `Teacher.java:74-76`

---

## 2. Lists — Add / Remove / Search / Iterate

`Groups` wraps a JPA `List<Person>` and exposes safe add/remove operations using `contains`.

```java
// groups/Groups.java:57-69
public void addPerson(Person person) {
    if (!this.groupMembers.contains(person)) {       // search
        this.groupMembers.add(person);               // add
        person.getGroups().add(this);
    }
}

public void removePerson(Person person) {
    if (this.groupMembers.contains(person)) {
        this.groupMembers.remove(person);            // remove
        person.getGroups().remove(this);
    }
}
```

**Reference**

* `Groups.java:57-69`

`GroupChatService.addMessage()` iterates over a list and rewrites it back to S3.

```java
// groups/GroupChatService.java:92-105
List<GroupChatMessage> messages = getMessages(groupName);

messages.add(message); // add

String jsonl = messages.stream() // iterate
        .map(this::toJson)
        .collect(Collectors.joining("\n"));
```

`deleteMessage()` uses `removeIf()` to search and remove entries.

```java
// groups/GroupChatService.java:110
boolean removed = messages.removeIf(m -> messageId.equals(m.getId()));
```

**Reference**

* `GroupChatService.java:92-122`

---

## 3. Stacks / Queues — BathroomQueue (FIFO)

`BathroomQueue` implements queue behavior using a comma-separated string structure.

### Enqueue

```java
// bathroom/BathroomQueue.java:53-59
public void addStudent(String studentName) {
    if (this.peopleQueue == null || this.peopleQueue.isEmpty()) {
        this.peopleQueue = studentName;
    } else {
        this.peopleQueue += "," + studentName;
    }
}
```

### Peek (Front of Queue)

```java
// bathroom/BathroomQueue.java:115-120
public String getFrontStudent() {
    if (this.peopleQueue != null && !this.peopleQueue.isEmpty()) {
        return this.peopleQueue.split(",")[0];
    }
    return null;
}
```

### Dequeue / Approval Pop

```java
// bathroom/BathroomQueue.java:127-143
public void approveStudent() {
    if (this.away < this.maxOccupancy) {
        int totalInQueue = this.peopleQueue.split(",").length;

        if (this.away < totalInQueue)
            this.away++;
    }
}
```

The teacher always approves the student at the front of the line, matching FIFO queue behavior.

**Reference**

* `BathroomQueue.java:53-143`

---

## 4. Trees — Hierarchical Aggregation Structure

`TinkleStatisticsService` uses `Collectors.groupingBy()` to create a hierarchical aggregation structure.

```java
// bathroom/TinkleStatisticsService.java:29-37
Map<String, List<Long>> userWeeklyDurations = tinkleList.stream()
    .filter(tinkle -> tinkle.getPersonName() != null)
    .collect(Collectors.groupingBy(
        Tinkle::getPersonName,
        Collectors.mapping(
            t -> calculateTotalDurationInSeconds(t.getTimeIn()),
            Collectors.toList()
        )
    ));
```

This produces a hierarchy like:

```text
root
 └── user
      └── list of weekly durations
```

This tree-like structure is commonly consumed by decision-tree ML systems such as Smile or Weka.

**Reference**

* `TinkleStatisticsService.java:27-50`

---

## 5. Sets — Unique Data with HashSet / ConcurrentHashMap.newKeySet

`PresenceSession` uses a concurrent set to prevent duplicate group memberships per session.

```java
// groups/GroupChatPresenceService.java:135-152
private static class PresenceSession {
    private volatile String username;

    private final Set<Long> groups = ConcurrentHashMap.newKeySet();

    public Set<Long> getGroups() {
        return groups;
    }
}
```

A snapshot copy is later created using `HashSet`.

```java
for (Long groupId : new HashSet<>(presenceSession.getGroups())) { ... }
```

This guarantees uniqueness while enabling safe concurrent iteration.

**Reference**

* `GroupChatPresenceService.java:135-152`

---

## 6. Dictionaries / Maps — Key/Value Analytics and Configuration

`GroupChatService.getUserAnalytics()` builds nested analytics payloads using `HashMap`.

```java
// groups/GroupChatService.java:152-195
Map<String, Object> analytics = new HashMap<>();
List<Map<String, Object>> groupAnalyticsList = new ArrayList<>();

for (Groups group : groups) {

    Map<String, Object> groupEntry = new HashMap<>();

    groupEntry.put("groupId", group.getId());
    groupEntry.put("groupName", groupName);
    groupEntry.put("messagesSent", messagesSent);
    groupEntry.put("messagesWithImages", messagesWithImages);
    groupEntry.put("sharedFilesCount", sharedFilesCount);

    groupAnalyticsList.add(groupEntry);
}

analytics.put("totalGroups", groups.size());
analytics.put("totalMessagesSent", totalMessagesSent);
```

`GroupChatService.listSharedFiles()` also stores file metadata in `Map<String, String>` entries.

```java
// groups/GroupChatService.java:133-141
Map<String, String> fileEntry = new HashMap<>();

fileEntry.put("filename", filename);
fileEntry.put("base64Data", base64Data);

files.add(fileEntry);
```

**References**

* `GroupChatService.java:152-195`
* `GroupChatService.java:133-141`

---

## 7. Graphs — Group ↔ Member Adjacency and Traversal

The `Groups ↔ Person` many-to-many relationship forms a bipartite graph represented as an adjacency list.

### Adjacency List Representation

```java
// groups/Groups.java:30-37
@ManyToMany(
    fetch = FetchType.LAZY,
    cascade = {CascadeType.PERSIST, CascadeType.MERGE}
)

@JoinTable(
    name = "group_members",
    joinColumns = @JoinColumn(name = "group_id"),
    inverseJoinColumns = @JoinColumn(name = "person_id")
)

@JsonIgnore
private List<Person> groupMembers = new ArrayList<>();
```

Conceptually:

```text
Group -> Members
```

### Graph Traversal for Analytics

`getUserAnalytics()` traverses a user's connected groups and aggregates metrics.

```java
// groups/GroupChatService.java:160-187
for (Groups group : groups) {

    List<GroupChatMessage> messages = getMessages(group.getName());

    List<GroupChatMessage> userMessages = messages.stream()
            .filter(m -> personName.equals(m.getName()))
            .collect(Collectors.toList());

    totalMessagesSent       += userMessages.size();
    totalMessagesWithImages += messagesWithImages;
    totalSharedFiles        += sharedFilesCount;
}
```

Traversal structure:

```text
Person
  └── Groups
        └── Members / Messages / Files
```

This forms the basis for:

* friend recommendations
* mutual connection discovery
* neighborhood traversal
* 2-hop graph queries

**References**

* `Groups.java:30-37`
* `GroupChatService.java:152-195`
