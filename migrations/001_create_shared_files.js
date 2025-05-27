// Migration to create shared_files collection
// Run this in PocketBase Admin UI > Settings > Import collections

const sharedFilesCollection = {
  "id": "shared_files",
  "name": "shared_files", 
  "type": "base",
  "system": false,
  "schema": [
    {
      "id": "shareId",
      "name": "shareId",
      "type": "text",
      "system": false,
      "required": true,
      "unique": true,
      "options": {
        "min": null,
        "max": null,
        "pattern": ""
      }
    },
    {
      "id": "filename", 
      "name": "filename",
      "type": "text",
      "system": false,
      "required": true,
      "unique": false,
      "options": {
        "min": null,
        "max": null,
        "pattern": ""
      }
    },
    {
      "id": "data",
      "name": "data", 
      "type": "json",
      "system": false,
      "required": true,
      "unique": false,
      "options": {}
    },
    {
      "id": "columns",
      "name": "columns",
      "type": "json", 
      "system": false,
      "required": true,
      "unique": false,
      "options": {}
    },
    {
      "id": "uploadedAt",
      "name": "uploadedAt",
      "type": "text",
      "system": false,
      "required": true,
      "unique": false,
      "options": {
        "min": null,
        "max": null,
        "pattern": ""
      }
    }
  ],
  "indexes": [
    "CREATE UNIQUE INDEX `idx_shareId` ON `shared_files` (`shareId`)"
  ],
  "listRule": null,
  "viewRule": null, 
  "createRule": null,
  "updateRule": null,
  "deleteRule": null,
  "options": {}
};

// To apply this migration:
// 1. Go to PocketBase Admin UI
// 2. Navigate to Settings > Import collections
// 3. Paste this collection definition
// 4. Click Import

console.log('Shared files collection schema:');
console.log(JSON.stringify(sharedFilesCollection, null, 2)); 