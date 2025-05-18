import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Load user data for the page
export const load: PageServerLoad = async ({ locals }) => {
    // Get the current user from locals (set by hooks.server.js/ts)
    const user = locals.user;
    
    // If no user is logged in, still return but the UI will show login prompt
    return {
        user
    };
};

export const actions: Actions = {
    // Action for updating user profile
    updateProfile: async ({ request, locals }) => {
        const user = locals.user;
        
        // Ensure user is authenticated
        if (!user) {
            throw redirect(303, '/login');
        }
        
        const formData = await request.formData();
        const username = formData.get('username')?.toString();
        
        // Simple validation
        if (!username) {
            return fail(400, { 
                message: 'Username is required' 
            });
        }
        
        try {
            // Update the user record
            await locals.pb.collection('users').update(user.id, {
                username
            });
            
            // Return success
            return { success: true };
        } catch (err) {
            console.error('Profile update error:', err);
            return fail(500, { 
                message: err instanceof Error ? err.message : 'Failed to update profile' 
            });
        }
    },
    
    // Action for changing password
    changePassword: async ({ request, locals }) => {
        const user = locals.user;
        
        // Ensure user is authenticated
        if (!user) {
            throw redirect(303, '/login');
        }
        
        const formData = await request.formData();
        const currentPassword = formData.get('currentPassword')?.toString();
        const newPassword = formData.get('newPassword')?.toString();
        const confirmPassword = formData.get('confirmPassword')?.toString();
        
        // Validate input
        if (!currentPassword || !newPassword || !confirmPassword) {
            return fail(400, { 
                message: 'All password fields are required' 
            });
        }
        
        if (newPassword !== confirmPassword) {
            return fail(400, { 
                message: 'New passwords do not match' 
            });
        }
        
        if (newPassword.length < 8) {
            return fail(400, { 
                message: 'New password must be at least 8 characters long' 
            });
        }
        
        try {
            // No need for a separate auth check - include oldPassword in the update request
            await locals.pb.collection('users').update(user.id, {
                oldPassword: currentPassword,  // Add the old password for verification
                password: newPassword,
                passwordConfirm: confirmPassword
            });
            
            // Return success
            return { success: true };
        } catch (err) {
            console.error('Password change error:', err);
            
            // Handle specific case of wrong current password
            if (err instanceof Error && 
                (err.message.includes('authentication') || 
                 (err.toString().includes('400') && err.toString().includes('oldPassword')))) {
                return fail(400, { message: 'Current password is incorrect' });
            }
            
            return fail(500, { 
                message: err instanceof Error ? err.message : 'Failed to change password' 
            });
        }
    }
}; 