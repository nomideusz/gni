import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomBytes, createHash } from 'crypto';

// Define the shared file record structure
interface SharedFileRecord {
	id?: string;
	shareId: string;
	filename: string;
	data: any[];
	columns: string[];
	uploadedAt: string;
	contentHash: string;
	createdAt?: string;
	updated?: string;
}

// Function to generate content hash from file data
function generateContentHash(data: any[], columns: string[]): string {
	const content = JSON.stringify({ data, columns });
	return createHash('sha256').update(content).digest('hex');
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const { filename, data, columns, uploadedAt } = body;
		
		if (!filename || !data || !columns) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}
		
		// Generate content hash for deduplication
		const contentHash = generateContentHash(data, columns);
		
		// Check if file with same content already exists
		try {
			const existingRecords = await locals.pb.collection('shared_files').getList(1, 1, {
				filter: `contentHash = "${contentHash}"`
			});
			
			if (existingRecords.items.length > 0) {
				// File already exists, return existing shareId
				const existingFile = existingRecords.items[0];
				return json({ 
					shareId: existingFile.shareId,
					message: 'File already exists - returning existing share link',
					id: existingFile.id,
					isDuplicate: true
				});
			}
		} catch (error) {
			// If contentHash field doesn't exist yet, continue with normal flow
			console.log('ContentHash field may not exist yet, proceeding with normal save');
		}
		
		// Generate a unique share ID for new file
		const shareId = randomBytes(16).toString('hex');
		
		// Store the file data in PocketBase
		const sharedFileData: SharedFileRecord = {
			shareId,
			filename,
			data,
			columns,
			uploadedAt,
			contentHash
		};
		
		const record = await locals.pb.collection('shared_files').create(sharedFileData);
		
		return json({ 
			shareId,
			message: 'File saved successfully',
			id: record.id,
			isDuplicate: false
		});
		
	} catch (error) {
		console.error('Error saving shared file:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const shareId = url.searchParams.get('id');
		
		if (!shareId) {
			return json({ error: 'Share ID is required' }, { status: 400 });
		}
		
		// Query PocketBase for the shared file by shareId
		const records = await locals.pb.collection('shared_files').getList(1, 1, {
			filter: `shareId = "${shareId}"`
		});
		
		if (records.items.length === 0) {
			return json({ error: 'File not found' }, { status: 404 });
		}
		
		const sharedFile = records.items[0];
		
		return json({
			id: sharedFile.shareId,
			filename: sharedFile.filename,
			data: sharedFile.data,
			columns: sharedFile.columns,
			uploadedAt: sharedFile.uploadedAt,
			createdAt: sharedFile.created
		});
		
	} catch (error) {
		console.error('Error retrieving shared file:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}; 