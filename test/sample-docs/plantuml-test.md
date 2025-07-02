# PlantUML Test Document

This document contains PlantUML diagrams for testing.

## Simple Sequence Diagram

```plantuml
@startuml
Alice -> Bob: Hello
Bob -> Alice: Hi there
Alice -> Bob: How are you?
Bob -> Alice: I'm fine, thanks!
@enduml
```

## Class Diagram

```plantuml
@startuml
class User {
  +String name
  +String email
  +login()
  +logout()
}

class Admin {
  +manageUsers()
  +deleteUser()
}

User <|-- Admin
@enduml
```

## Activity Diagram

```plantuml
@startuml
start
:User opens app;
if (Logged in?) then (yes)
  :Show dashboard;
else (no)
  :Show login form;
  :User enters credentials;
  if (Valid?) then (yes)
    :Login successful;
    :Show dashboard;
  else (no)
    :Show error message;
    stop
  endif
endif
:User interacts with app;
stop
@enduml
```

This document should process all PlantUML diagrams correctly. 