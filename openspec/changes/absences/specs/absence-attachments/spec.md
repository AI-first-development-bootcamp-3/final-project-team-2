## Purpose

Holds the documents the law expects behind a sick day or a reserve-duty day. Files go straight from the employee's device to private blob storage and are reachable only through short-lived signed URLs, so a sick note is never served from a public address and never passes through the API. Because documents routinely arrive days after the absence, they can be attached after the fact — including after the month has been locked.

## ADDED Requirements

### Requirement: Signed upload URLs

The system SHALL issue a signed upload URL, valid for 60 minutes, that lets the client upload a file directly to blob storage without the file passing through the API.

#### Scenario: Upload URL issued

- **WHEN** an authenticated employee requests an upload URL for a permitted file type and size
- **THEN** a signed URL and a blob key are returned, and the URL expires 60 minutes after issue

#### Scenario: Unauthenticated upload request

- **WHEN** an unauthenticated caller requests an upload URL
- **THEN** the response is 401

#### Scenario: Blob storage not configured

- **WHEN** an upload URL is requested while no blob storage credential is configured
- **THEN** the response is a server error naming the missing configuration, and the rest of the API continues to operate

### Requirement: File type restriction

Only JPG, PNG, and PDF files SHALL be accepted, enforced both when the upload URL is issued and when the uploaded file is registered.

#### Scenario: Permitted types

- **WHEN** a file is declared as JPG, PNG, or PDF
- **THEN** it is accepted at both the upload-URL and registration steps

#### Scenario: Rejected type at upload-URL time

- **WHEN** an upload URL is requested for a file of any other type
- **THEN** the response is 400 with rule VAL-60, and no URL is issued

#### Scenario: Rejected type at registration time

- **WHEN** a file of a disallowed type is registered against an absence
- **THEN** the response is 400 with rule VAL-60, and no attachment record is created

### Requirement: File size limit

A file SHALL NOT exceed 5MB, enforced both when the upload URL is issued and when the uploaded file is registered.

#### Scenario: File at the limit

- **WHEN** a file of exactly 5MB is registered
- **THEN** it is accepted

#### Scenario: File over the limit

- **WHEN** a file larger than 5MB is declared or registered
- **THEN** the response is 400 with rule VAL-61, and no attachment record is created

### Requirement: Attachments reference an existing absence

An attachment SHALL reference an absence that exists and has not been deleted.

#### Scenario: Unknown absence

- **WHEN** a file is registered against an absence id that does not exist
- **THEN** the response is 404 with rule VAL-62

#### Scenario: Soft-deleted absence

- **WHEN** a file is registered against a soft-deleted absence
- **THEN** the response is 404 with rule VAL-62

#### Scenario: Another employee's absence

- **WHEN** an employee registers a file against an absence belonging to somebody else
- **THEN** the response is 404, without revealing that the absence exists

### Requirement: Attachment writes survive a month lock

Registering a document against an existing absence SHALL be permitted regardless of whether the absence's month is locked.

#### Scenario: Document attached after the month locked

- **WHEN** an employee registers a document against a sick absence whose month is locked
- **THEN** it is accepted and the absence's missing-document flag clears

#### Scenario: Document attached while the month is open

- **WHEN** an employee registers a document against an absence whose month is open
- **THEN** it is accepted

### Requirement: Signed download URLs scoped to owner and admin

The system SHALL issue a signed download URL, valid for 60 minutes, to the absence's owner and to any admin, and SHALL refuse every other caller.

#### Scenario: Owner downloads

- **WHEN** the absence's owner requests a download URL for its attachment
- **THEN** a signed URL is returned that expires 60 minutes after issue

#### Scenario: Admin downloads

- **WHEN** an admin requests a download URL for any employee's attachment
- **THEN** a signed URL is returned

#### Scenario: Another employee is refused

- **WHEN** an employee requests a download URL for an attachment on somebody else's absence
- **THEN** the response is 404, without revealing that the attachment exists

#### Scenario: Unauthenticated request

- **WHEN** an unauthenticated caller requests a download URL
- **THEN** the response is 401

### Requirement: Blob objects are private

Stored files SHALL NOT be readable without a signed URL.

#### Scenario: No public address

- **WHEN** a file is uploaded
- **THEN** it is stored with private access and is not retrievable from an unsigned address

### Requirement: Attachment records are soft-deleted

Deleting an attachment record SHALL retain the row and exclude it from reads, and SHALL leave the stored file in place.

#### Scenario: Deleted attachment is retained

- **WHEN** an attachment record is deleted
- **THEN** the row remains in storage with a deletion timestamp, is absent from reads, and the underlying file is not removed

#### Scenario: Deleted attachment stops satisfying the document requirement

- **WHEN** the only attachment on a sick absence is deleted
- **THEN** that absence is again flagged as missing its document

### Requirement: Multiple attachments per absence

The system SHALL accept more than one attachment on a single absence, and SHALL return all of them with it.

#### Scenario: Second document added

- **WHEN** a second file is registered against an absence that already has one
- **THEN** both are stored and both are returned with the absence

### Requirement: Documented endpoints

Every attachment endpoint SHALL appear in the API documentation with its request and response schemas and its bearer-token requirement.

#### Scenario: Endpoints documented

- **WHEN** the API documentation is served
- **THEN** the upload-URL, registration, and download-URL endpoints are present with their schemas
