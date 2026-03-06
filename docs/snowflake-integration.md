# Snowflake Integration Guide

## Overview

Chirp is designed with a **repository abstraction layer** that makes swapping the underlying data store straightforward. This document describes how to migrate from the current SQLite/Postgres local database to Snowflake.

## Architecture

```
┌─────────────────────────────────────────────┐
│              Application Layer              │
│  (API Routes, Services, Nudge Engine)       │
├─────────────────────────────────────────────┤
│           Repository Interfaces             │
│  IContactRepository, INudgeRepository, etc. │
├──────────────┬──────────────────────────────┤
│ PrismaImpl   │   SnowflakeImpl (future)     │
│ (current)    │                              │
├──────────────┼──────────────────────────────┤
│ SQLite/PG    │   Snowflake                  │
└──────────────┴──────────────────────────────┘
```

## Repository Interfaces

Each entity has a corresponding repository interface in `src/lib/repositories/interfaces/`:

| Interface               | Key Methods                                    |
|------------------------|------------------------------------------------|
| `IPartnerRepository`   | `findById`, `findByEmail`, `findAll`           |
| `IContactRepository`   | `findByPartnerId`, `findById`, `search`, `countByPartnerId` |
| `IInteractionRepository` | `findByContactId`, `findRecentByPartnerId`, `searchByContent` |
| `ISignalRepository`    | `findByContactId`, `findByCompanyId`, `searchByContent` |
| `INudgeRepository`     | `findByPartnerId`, `createMany`, `updateStatus`, `deleteOpenByPartnerId` |
| `IMeetingRepository`   | `findUpcomingByPartnerId`, `findById`, `updateBrief` |

## Snowflake Table Mapping

### Assumed Snowflake Schema

```sql
-- Partners (relationship owners)
CREATE TABLE CRM.PARTNERS (
    ID VARCHAR(36) PRIMARY KEY,
    EMAIL VARCHAR(255) UNIQUE NOT NULL,
    NAME VARCHAR(255) NOT NULL,
    AVATAR_URL VARCHAR(500),
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Companies
CREATE TABLE CRM.COMPANIES (
    ID VARCHAR(36) PRIMARY KEY,
    NAME VARCHAR(255) UNIQUE NOT NULL,
    INDUSTRY VARCHAR(100),
    DESCRIPTION TEXT,
    EMPLOYEE_COUNT INTEGER,
    WEBSITE VARCHAR(500)
);

-- Contacts
CREATE TABLE CRM.CONTACTS (
    ID VARCHAR(36) PRIMARY KEY,
    PARTNER_ID VARCHAR(36) REFERENCES CRM.PARTNERS(ID),
    COMPANY_ID VARCHAR(36) REFERENCES CRM.COMPANIES(ID),
    NAME VARCHAR(255) NOT NULL,
    EMAIL VARCHAR(255),
    TITLE VARCHAR(255),
    PHONE VARCHAR(50),
    IMPORTANCE VARCHAR(20) DEFAULT 'MEDIUM',
    NOTES TEXT,
    LAST_CONTACTED TIMESTAMP_NTZ,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Interactions
CREATE TABLE CRM.INTERACTIONS (
    ID VARCHAR(36) PRIMARY KEY,
    CONTACT_ID VARCHAR(36) REFERENCES CRM.CONTACTS(ID),
    TYPE VARCHAR(20) NOT NULL,
    DATE TIMESTAMP_NTZ NOT NULL,
    SUMMARY TEXT,
    SENTIMENT VARCHAR(20) DEFAULT 'NEUTRAL',
    NEXT_STEP TEXT,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- External Signals
CREATE TABLE CRM.EXTERNAL_SIGNALS (
    ID VARCHAR(36) PRIMARY KEY,
    CONTACT_ID VARCHAR(36) REFERENCES CRM.CONTACTS(ID),
    COMPANY_ID VARCHAR(36) REFERENCES CRM.COMPANIES(ID),
    TYPE VARCHAR(30) NOT NULL,
    DATE TIMESTAMP_NTZ NOT NULL,
    CONTENT TEXT,
    URL VARCHAR(500),
    CONFIDENCE FLOAT DEFAULT 0.8,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Nudges
CREATE TABLE CRM.NUDGES (
    ID VARCHAR(36) PRIMARY KEY,
    CONTACT_ID VARCHAR(36) REFERENCES CRM.CONTACTS(ID),
    SIGNAL_ID VARCHAR(36) REFERENCES CRM.EXTERNAL_SIGNALS(ID),
    RULE_TYPE VARCHAR(30) NOT NULL,
    REASON TEXT,
    PRIORITY VARCHAR(20) DEFAULT 'MEDIUM',
    STATUS VARCHAR(20) DEFAULT 'OPEN',
    GENERATED_EMAIL TEXT,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Meetings
CREATE TABLE CRM.MEETINGS (
    ID VARCHAR(36) PRIMARY KEY,
    PARTNER_ID VARCHAR(36) REFERENCES CRM.PARTNERS(ID),
    START_TIME TIMESTAMP_NTZ NOT NULL,
    TITLE VARCHAR(500),
    PURPOSE TEXT,
    NOTES TEXT,
    GENERATED_BRIEF TEXT,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Meeting Attendees (junction table)
CREATE TABLE CRM.MEETING_ATTENDEES (
    ID VARCHAR(36) PRIMARY KEY,
    MEETING_ID VARCHAR(36) REFERENCES CRM.MEETINGS(ID),
    CONTACT_ID VARCHAR(36) REFERENCES CRM.CONTACTS(ID),
    UNIQUE (MEETING_ID, CONTACT_ID)
);
```

## Implementation Steps

### 1. Install Snowflake SDK

```bash
npm install snowflake-sdk
```

### 2. Create Snowflake Repository Implementations

Create `src/lib/repositories/snowflake/` directory with implementations for each interface.

Example for `SnowflakeContactRepository`:

```typescript
import snowflake from 'snowflake-sdk';
import type { IContactRepository, ContactWithCompany } from '../interfaces';

export class SnowflakeContactRepository implements IContactRepository {
  private connection: snowflake.Connection;

  constructor(connection: snowflake.Connection) {
    this.connection = connection;
  }

  async findByPartnerId(partnerId: string): Promise<ContactWithCompany[]> {
    const sql = `
      SELECT c.*, co.NAME as company_name, co.INDUSTRY, co.DESCRIPTION,
             co.EMPLOYEE_COUNT, co.WEBSITE
      FROM CRM.CONTACTS c
      JOIN CRM.COMPANIES co ON c.COMPANY_ID = co.ID
      WHERE c.PARTNER_ID = ?
      ORDER BY c.NAME ASC
    `;
    const rows = await this.executeQuery(sql, [partnerId]);
    return rows.map(mapRowToContactWithCompany);
  }

  // ... implement other methods
}
```

### 3. Update Repository Index

Modify `src/lib/repositories/index.ts` to conditionally use Snowflake:

```typescript
import { SnowflakeContactRepository } from './snowflake/contact-repository';
import { PrismaContactRepository } from './prisma/contact-repository';

const useSnowflake = process.env.DATA_SOURCE === 'snowflake';

export const contactRepo = useSnowflake
  ? new SnowflakeContactRepository(getSnowflakeConnection())
  : new PrismaContactRepository();
```

### 4. Environment Variables

```env
DATA_SOURCE=snowflake  # or "local" for Prisma
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USERNAME=your_user
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_DATABASE=CRM_DB
SNOWFLAKE_SCHEMA=CRM
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_ROLE=CRM_APP_ROLE
```

### 5. Vector Search Migration

For RAG functionality, consider:

- **Snowflake Cortex**: Use Snowflake's built-in vector search capabilities
- **Hybrid approach**: Keep pgvector for embeddings, Snowflake for structured data
- **External vector DB**: Use Pinecone/Weaviate alongside Snowflake

## Data Sync Considerations

If Snowflake is the source of truth for some data (e.g., interactions from other systems):

1. Set up Snowflake Streams and Tasks for change data capture
2. Use Snowpipe for real-time ingestion of new signals
3. Consider a read-replica pattern where the app reads from Snowflake but writes nudges/briefs locally

## Performance Notes

- Snowflake queries have higher latency than local DB (~100-500ms vs ~1-10ms)
- Implement caching (Redis) for frequently accessed data like partner profiles and contact lists
- Use Snowflake's result caching for repeated queries
- Consider materializing views for dashboard aggregations
