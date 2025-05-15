import type { LayoutLoad } from './$types';
import { browser } from '$app/environment';
import { currentUser, pb } from '$lib';

export const load: LayoutLoad = async ({ data }) => {
  // Update the currentUser store with the user data from the server
  if (browser && data.user) {
    currentUser.set(data.user);
    
    // Sync client-side PocketBase auth store with server
    if (pb && data.user) {
      // Wait for PocketBase to initialize
      await new Promise(resolve => setTimeout(resolve, 0));
      // Only attempt to refresh if we have a token
      if (!pb.authStore.isValid) {
        try {
          // Attempt to load auth from cookie if available
          pb.authStore.loadFromCookie(document.cookie);
          if (pb.authStore.isValid) {
            await pb.collection('users').authRefresh();
          }
        } catch (e) {
          console.error('Failed to refresh auth state:', e);
        }
      }
    }
  }
  
  return {
    user: data.user
  };
}; 