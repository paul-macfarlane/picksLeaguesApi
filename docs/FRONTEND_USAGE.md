# Frontend Authentication Guide

## Overview
This guide demonstrates how to integrate with the OAuth authentication system from a frontend application.

## Quick Start

### 1. Login Button
```typescript
// React example
function LoginButton({ provider }: { provider: 'google' | 'discord' }) {
  const handleLogin = () => {
    // Redirect to the auth endpoint
    window.location.href = `${API_BASE_URL}/auth/login/${provider}`;
  };

  return (
    <button onClick={handleLogin}>
      Login with {provider.charAt(0).toUpperCase() + provider.slice(1)}
    </button>
  );
}
```

### 2. Callback Handler
```typescript
// React example using React Router
function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get the token from the URL query params
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (token) {
      // Store the token
      localStorage.setItem('auth_token', token);
      // Redirect to home or dashboard
      navigate('/dashboard');
    } else {
      setError('Authentication failed');
    }
  }, [navigate]);

  if (error) {
    return <div>Error: {error}</div>;
  }

  return <div>Authenticating...</div>;
}
```

### 3. Using the JWT Token
```typescript
// API client example
const api = {
  async fetchProtectedResource() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/protected-resource`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        throw new Error('Session expired');
      }
      throw new Error('Request failed');
    }

    return response.json();
  }
};
```

### 4. Protected Route Component
```typescript
// React example
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Optional: Verify token on the server
    async function verifyToken() {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Invalid token');
        }
        
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('auth_token');
        navigate('/login');
      }
    }

    verifyToken();
  }, [navigate]);

  if (isAuthenticated === null) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? children : null;
}
```

## Usage Example
```typescript
// App.tsx
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          <div>
            <LoginButton provider="google" />
            <LoginButton provider="discord" />
          </div>
        } />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}
```

## Error Handling

### Common Error Scenarios
1. **Token Expired**
   ```typescript
   if (response.status === 401) {
     // Clear token and redirect to login
     localStorage.removeItem('auth_token');
     window.location.href = '/login';
   }
   ```

2. **Network Error**
   ```typescript
   try {
     await api.fetchProtectedResource();
   } catch (error) {
     if (error.name === 'NetworkError') {
       // Handle offline scenario
       showOfflineMessage();
     }
   }
   ```

3. **Invalid State**
   ```typescript
   if (response.status === 400 && response.data.error === 'Invalid state') {
     // Authentication flow was interrupted
     showErrorMessage('Authentication failed. Please try again.');
   }
   ```

## Security Best Practices
1. Always store tokens in `localStorage` or `sessionStorage`, never in cookies for SPA
2. Clear tokens on logout and authentication errors
3. Use HTTPS for all API requests
4. Implement token refresh mechanism for long-lived sessions
5. Add request interceptors to handle token expiration gracefully
6. Implement proper error handling and user feedback
7. Consider implementing a service worker for offline support

## TypeScript Interfaces
```typescript
interface AuthToken {
  token: string;
  expiresIn: number;
}

interface User {
  id: string;
  email: string;
  name: string;
  provider: 'google' | 'discord';
}

interface AuthError {
  error: string;
  message: string;
}
```
