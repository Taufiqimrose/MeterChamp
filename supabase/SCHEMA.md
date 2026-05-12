# Database schema — entity relationships

The diagram below renders natively on GitHub/GitLab and most Markdown viewers.

```mermaid
erDiagram
    auth_users ||--|| profiles : "1:1 (trigger-created)"
    profiles {
        uuid id PK,FK
        text full_name
        user_role role
        timestamptz created_at
        timestamptz updated_at
    }

    parks ||--o{ units : contains
    parks ||--o{ park_assignments : "scoped to"
    parks {
        uuid id PK
        text name
        text address
        boolean active
    }

    units ||--o{ unit_meters : has
    units ||--o{ photos : "documented by"
    units {
        uuid id PK
        uuid park_id FK
        text label
        text street_address
        boolean active
    }

    unit_meters ||--o{ meter_readings : produces
    unit_meters {
        uuid id PK
        uuid unit_id FK
        meter_type meter_type
        text serial_label
        text unit_of_measure
        boolean active
    }

    profiles ||--o{ park_assignments : assigned
    park_assignments {
        uuid id PK
        uuid user_id FK
        uuid park_id FK
        timestamptz assigned_at
        timestamptz unassigned_at
        uuid assigned_by FK
    }

    profiles ||--o{ meter_readings : "captured_by"
    meter_readings ||--o| meter_readings : "superseded_by"
    meter_readings ||--o{ photos : "proof"
    meter_readings {
        uuid id PK
        uuid unit_meter_id FK
        numeric value
        timestamptz captured_at
        uuid captured_by FK
        numeric gps_lat
        numeric gps_lng
        numeric gps_accuracy_m
        text device_user_agent
        text app_version
        numeric quality_score
        boolean flagged
        uuid superseded_by FK
        timestamptz superseded_at
    }

    profiles ||--o{ photos : "captured_by"
    photos {
        uuid id PK
        uuid unit_id FK
        uuid meter_reading_id FK
        photo_kind kind
        text s3_bucket
        text s3_key
        text mime_type
        bigint size_bytes
        timestamptz captured_at
        uuid captured_by FK
        timestamptz deleted_at
    }
```

## Relationship cheat sheet

| Parent | Child | Cardinality | Notes |
|---|---|---|---|
| `auth.users` | `profiles` | 1 — 1 | Auto-created by trigger on signup. |
| `parks` | `units` | 1 — N | A park has many lots/sites. |
| `units` | `unit_meters` | 1 — N | "Some have water + gas + electric, some have only one." |
| `unit_meters` | `meter_readings` | 1 — N | Append-only readings. |
| `meter_readings` | `meter_readings` | 0..1 self | Corrections via `superseded_by`. |
| `units` | `photos` | 1 — N (kind=`unit_reference`) | Setup photos of the meter location. |
| `meter_readings` | `photos` | 1 — N (kind=`meter_reading`) | Proof-of-reading photos. |
| `parks` | `park_assignments` | 1 — N | Who's reading the park, with history. |
| `profiles` | `park_assignments` | 1 — N | One active row per user (partial unique index). |
| `profiles` | `meter_readings` | 1 — N (`captured_by`) | Forensic. |
| `profiles` | `photos` | 1 — N (`captured_by`) | Forensic. |

## Append-only correction flow

Readings are never updated or deleted by readers. To correct a wrong reading:

1. Insert a *new* `meter_readings` row with the correct value.
2. (Admin) update the wrong row, setting `superseded_by` → new row's id, `superseded_at`, `superseded_by_user`, and `supersede_reason`.
3. The `current_park_progress` view and any "latest reading" queries filter on `superseded_by IS NULL`.

The original wrong row stays in the database. Full audit trail.

## RLS scoping at a glance

| Table | Reader can read | Reader can write |
|---|---|---|
| `parks` | only `current_user_park_id()` | — |
| `units` | only own park | — |
| `unit_meters` | only own park | — |
| `meter_readings` | only own park | INSERT for own park only; no UPDATE/DELETE |
| `photos` | only own park | INSERT for own park only |
| `park_assignments` | own assignments | — |
| `profiles` | own row | UPDATE own non-role fields |

Admins (`profiles.role = 'admin'`) bypass all scoping via the `is_admin()` SECURITY DEFINER function.
