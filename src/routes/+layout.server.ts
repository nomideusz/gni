import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Define public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/forgot-password', '/register'];

export const load: LayoutServerLoad = async ({ locals, url }) => {
  // Use locals directly since hooks.server.ts already processed auth
  const isAuthenticated = !!locals.user;
  
  // Check if current route requires authentication
  const path = url.pathname;
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    path === route || path.startsWith(route + '/'));
  
  // Redirect to login if authentication required but not provided
  if (!isAuthenticated && !isPublicRoute) {
    throw redirect(303, '/login');
  }
  
  // Return authenticated user data from locals
  let user = null;
  if (isAuthenticated && locals.user) {
    // Map user data to the expected format
    const userData = locals.user;
    user = {
      id: userData.id,
      email: userData.email,
      username: userData.username || userData.name || userData.email,
      avatarUrl: userData.avatarUrl,
      created: userData.created,
      updated: userData.updated
    };
    console.log('Server sending authenticated user:', user.email);
  }
  
  return { 
    isAuthenticated,
    user
  };
}; 