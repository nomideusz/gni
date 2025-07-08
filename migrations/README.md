# PocketBase Database Setup for Shared Files

## Overview
The shared files feature now uses PocketBase for persistent storage instead of in-memory storage.

## Setting up the Database Collection

### Method 1: Import via PocketBase Admin UI

1. **Access PocketBase Admin UI**
   - Go to your PocketBase admin interface (usually `https://g.zaur.app/_/` or your configured URL)
   - Log in with your admin credentials

2. **Import Collection**
   - Navigate to **Settings** > **Import collections**
   - Copy the contents of `shared_files_collection.json`
   - Paste it into the import field
   - Click **Import**

### Method 2: Manual Collection Creation

If you prefer to create the collection manually:

1. Go to **Collections** in PocketBase Admin
2. Click **+ New collection**
3. Set **Collection name** to `shared_files`
4. Add the following fields:

| Field Name | Type | Required | Unique | Notes |
|------------|------|----------|--------|-------|
| `shareId` | Text | ✓ | ✓ | Unique identifier for sharing |
| `filename` | Text | ✓ | ✗ | Original filename |
| `data` | JSON | ✓ | ✗ | Survey data array |
| `columns` | JSON | ✓ | ✗ | Column names array |
| `uploadedAt` | Text | ✓ | ✗ | Original upload timestamp |
| `contentHash` | Text | ✓ | ✗ | SHA-256 hash for deduplication |

5. **Create Indexes**: 
   - Add a unique index on `shareId` field for fast lookups
   - Add an index on `contentHash` field for deduplication queries

## Collection Schema Details

```json
{
  "name": "shared_files",
  "type": "base", 
  "schema": [
    {
      "name": "shareId",
      "type": "text",
      "required": true,
      "unique": true
    },
    {
      "name": "filename", 
      "type": "text",
      "required": true
    },
    {
      "name": "data",
      "type": "json",
      "required": true
    },
    {
      "name": "columns",
      "type": "json",
      "required": true
    },
    {
      "name": "uploadedAt",
      "type": "text", 
      "required": true
    },
    {
      "name": "contentHash",
      "type": "text",
      "required": true
    }
  ]
}
```

## Benefits of Database Storage

✅ **Persistent Storage** - Files survive server restarts  
✅ **Scalable** - Works across multiple server instances  
✅ **Backup & Recovery** - PocketBase handles data persistence  
✅ **Query Performance** - Indexed lookups for fast retrieval  
✅ **Data Integrity** - ACID compliance and validation  
✅ **Deduplication** - Identical files share the same storage and link  

## API Endpoints

- **POST** `/api/v1/shared-files` - Save a new shared file
- **GET** `/api/v1/shared-files?id={shareId}` - Retrieve a shared file

## Security Notes

- Currently, no authentication is required for sharing files
- Consider adding access controls based on your security requirements
- The `shareId` is a cryptographically secure random string (32 hex characters)

## Troubleshooting

If you encounter issues:

1. **Collection not found**: Ensure the `shared_files` collection exists in PocketBase
2. **Permission errors**: Check PocketBase collection rules (currently set to allow all operations)
3. **Connection issues**: Verify `POCKETBASE_URL` environment variable is set correctly 