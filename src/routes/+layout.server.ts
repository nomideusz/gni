import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  // Return the user data if authenticated
  return {
    user: locals.pb.authStore.model
  };
}; 