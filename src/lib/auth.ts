import { FiniteStateMachine, Context } from 'runed';
import { currentUser } from './pocketbase';
import { get, readable, writable } from 'svelte/store';

// Define the auth state types
type AuthStates = 'loggedOut' | 'loggedIn' | 'loading' | 'loggingIn' | 'loggingOut';
type AuthEvents = 'login' | 'logout' | 'checkAuth' | 'finishTransition';

// Create a writable store to hold authentication data 
export const authStore = writable<{
  isAuthenticated: boolean;
  user: any | null;
  state: AuthStates;
}>({
  isAuthenticated: false,
  user: null,
  state: 'loading'
});

// Context definition for auth state - now using the store instead of raw values
export const authContext = new Context<typeof authStore>("auth");

// Define the state machine with more robust transitions
export const authFSM = new FiniteStateMachine<AuthStates, AuthEvents>('loading', {
  loggedOut: {
    login: 'loggingIn',
    checkAuth: 'loading'
  },
  loggingIn: {
    _enter: () => {
      // Animation timing - transition to logged in after animation completes
      authFSM.debounce(800, 'finishTransition');
    },
    finishTransition: 'loggedIn',
    login: 'loggingIn', // Allow self-transition to prevent warnings
    logout: 'loggingOut' // Allow direct transition to loggingOut
  },
  loading: {
    login: 'loggingIn',
    logout: 'loggingOut',
    checkAuth: 'loading' // Allow re-checking while in loading state
  },
  loggedIn: {
    login: 'loggedIn', // Self-transition to handle repeated login events
    logout: 'loggingOut',
    checkAuth: 'loading',
    finishTransition: 'loggedIn' // Add self-transition to handle any remaining debounced events
  },
  loggingOut: {
    _enter: () => {
      // Animation timing - transition to logged out after animation completes
      authFSM.debounce(800, 'finishTransition');
    },
    finishTransition: 'loggedOut',
    login: 'loggingIn', // Allow quick re-login
    logout: 'loggingOut' // Self-transition
  }
});

// Function to update FSM based on currentUser state with improved logging
export function updateAuthState(userValue: any) {
  console.log('Auth update triggered with value:', userValue ? 'User Logged In' : 'No User', 'Current FSM state:', authFSM.current);
  
  // Force authentication when flag is set
  if (userValue && userValue.forceAuth) {
    console.log('Forcing transition to loggedIn state');
    // Only do transitions if needed based on current state
    if (authFSM.current === 'loggedOut' || authFSM.current === 'loading') {
      authFSM.send('login');
    } else if (authFSM.current === 'loggingIn') {
      authFSM.send('finishTransition');
    }
    // If already in loggedIn state, no transition needed
    return;
  }
  
  // Handle the case where userValue is null or undefined
  if (!userValue) {
    console.log('No user value, transitioning to loggingOut or loggedOut');
    // Only send logout if not already logged out or logging out
    if (authFSM.current !== 'loggedOut' && authFSM.current !== 'loggingOut') {
      authFSM.send('logout');
    }
    return;
  }
  
  // Handle the case where userValue exists
  console.log('User value exists, transitioning to loggingIn or loggedIn');
  // Only send login if not already logged in or logging in
  if (authFSM.current !== 'loggedIn' && authFSM.current !== 'loggingIn') {
    authFSM.send('login');
  }
}

// Initial state setup (after FSM is defined) - use a shorter timeout for faster initialization
setTimeout(() => {
  console.log('Setting initial auth state');
  const currentValue = get(currentUser);
  console.log('Initial currentUser value:', currentValue ? 'Present' : 'None');
  
  // Try to detect auth status from localStorage if available
  try {
    if (typeof window !== 'undefined') {
      // Check if PocketBase has auth data in localStorage
      const pbAuthData = localStorage.getItem('pocketbase_auth');
      if (pbAuthData) {
        const authData = JSON.parse(pbAuthData);
        if (authData && authData.token) {
          console.log('Found auth token in localStorage, initializing as logged in');
          // Use proper transition instead of direct assignment
          if (authFSM.current !== 'loggedIn') {
            authFSM.send('login');
            // Immediately transition to logged in if needed
            if (authFSM.current === 'loggingIn') {
              authFSM.send('finishTransition');
            }
          }
          return;
        }
      }
    }
  } catch (e) {
    console.error('Error checking localStorage auth:', e);
  }
  
  // Fall back to checking currentUser value
  updateAuthState(currentValue);
}, 0);

// Subscribe to currentUser changes to update FSM
currentUser.subscribe((value) => {
  console.log('currentUser store updated:', value ? 'User present' : 'No user');
  updateAuthState(value);
});

// Create a writable store to track FSM state changes
const authStateStore = writable<AuthStates>(authFSM.current);

// Update the store whenever FSM transitions occur
const originalSend = authFSM.send;
authFSM.send = function(event: AuthEvents, ...args: unknown[]) {
  const result = originalSend.call(this, event, ...args);
  // After state transition, update the store
  authStateStore.set(authFSM.current);
  // Also update the authStore to ensure it has the latest state
  authStore.update(current => ({ ...current, state: authFSM.current }));
  return result;
};

// Export a readable version of the store for components
export const authState = readable<AuthStates>(authFSM.current, (set) => {
  const unsubscribe = authStateStore.subscribe((state) => {
    console.log('Auth state changed to:', state);
    set(state);
  });
  
  return unsubscribe;
}); 