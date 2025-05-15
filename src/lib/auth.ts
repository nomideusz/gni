import { FiniteStateMachine } from 'runed';
import { currentUser } from './pocketbase';
import { get } from 'svelte/store';

type AuthStates = 'loggedOut' | 'loggedIn' | 'loading';
type AuthEvents = 'login' | 'logout' | 'checkAuth';

// Define the state machine without complex initialization hooks
export const authFSM = new FiniteStateMachine<AuthStates, AuthEvents>('loading', {
  loggedOut: {
    login: 'loggedIn',
    checkAuth: 'loading'
  },
  loading: {
    login: 'loggedIn',
    logout: 'loggedOut'
    // No _enter hook to avoid circular references
  },
  loggedIn: {
    login: 'loggedIn', // Self-transition to handle repeated login events
    logout: 'loggedOut',
    checkAuth: 'loading'
  }
});

// Function to update FSM based on currentUser state
export function updateAuthState(userValue: any) {
  console.log('Auth update triggered with value:', userValue ? 'User Logged In' : 'No User');
  
  // Only send events that result in state changes to avoid confusing warnings
  if (userValue) {
    if (authFSM.current !== 'loggedIn') {
      authFSM.send('login');
    }
  } else {
    if (authFSM.current !== 'loggedOut') {
      authFSM.send('logout');
    }
  }
}

// Initial state setup (after FSM is defined)
setTimeout(() => {
  console.log('Setting initial auth state');
  const currentValue = get(currentUser);
  updateAuthState(currentValue);
}, 0);

// Subscribe to currentUser changes to update FSM
currentUser.subscribe((value) => {
  updateAuthState(value);
}); 