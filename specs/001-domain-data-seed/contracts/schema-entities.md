# Contract: Schema entity inventory

**Feature**: `001-domain-data-seed`  
**After**: successful first migration on empty database

## Required tables / models

The following models MUST exist and be usable (insert/query) after migrate:

1. User  
2. Client  
3. Project  
4. Task  
5. TaskAssignment  
6. TimeEntry  
7. Absence  
8. AbsenceAttachment  
9. MonthLock  
10. AuditLog  

## Soft-delete column presence

| Model | `deleted_at` required |
|-------|------------------------|
| User, Client, Project, Task, TimeEntry, Absence | yes |
| TaskAssignment, MonthLock, AuditLog, AbsenceAttachment | no |

## Critical constraints (must be enforceable by schema)

- User: unique email among active (non-deleted) rows  
- TaskAssignment: unique `(user_id, task_id)`  
- MonthLock: unique `(year, month)`  
- FKs as in [data-model.md](../data-model.md)

## Out of scope for this contract

- HTTP API shapes  
- Prisma middleware behavior  
- Blob storage availability for AbsenceAttachment
