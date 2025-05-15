import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return json({ success: false, message: 'Email and password are required' }, { status: 400 });
        }

        // Authenticate with PocketBase
        const { token, record } = await locals.pb.collection('users').authWithPassword(email, password);

        // Return successful response
        return json({ 
            success: true, 
            user: {
                id: record.id,
                email: record.email,
                username: record.username,
                name: record.name
            }
        });
    } catch (err) {
        console.error('Login failed:', err);
        return json({ 
            success: false, 
            message: 'Authentication failed. Please check your credentials.' 
        }, { status: 401 });
    }
}; 