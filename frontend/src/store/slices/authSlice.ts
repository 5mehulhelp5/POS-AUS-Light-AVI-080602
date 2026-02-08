import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../services/api';

export interface UserRole {
  id: number;
  name: string;
  displayName: string;
  maxDiscountPercent: number;
  canStackDiscounts: boolean;
}

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Load user from localStorage
const storedUser = localStorage.getItem('pos_user');
const parsedUser = storedUser ? JSON.parse(storedUser) : null;

const initialState: AuthState = {
  user: parsedUser,
  token: localStorage.getItem('pos_token'),
  isAuthenticated: !!localStorage.getItem('pos_token'),
  isLoading: false,
  error: null,
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (
    credentials: { email: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await authApi.login(credentials);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error?.message || 'Login failed'
      );
    }
  }
);

export const pinLogin = createAsyncThunk(
  'auth/pinLogin',
  async (pinCode: string, { rejectWithValue }) => {
    try {
      const response = await authApi.pinLogin(pinCode);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error?.message || 'Invalid PIN'
      );
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.getMe();
      return response.data.user;
    } catch (error: any) {
      return rejectWithValue('Session expired');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
    },
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        const { user, accessToken } = action.payload.data;
        state.user = user;
        state.token = accessToken;
        state.isAuthenticated = true;
        localStorage.setItem('pos_token', accessToken);
        localStorage.setItem('pos_user', JSON.stringify(user));
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // PIN Login
      .addCase(pinLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(pinLogin.fulfilled, (state, action) => {
        state.isLoading = false;
        const { user, accessToken } = action.payload.data;
        state.user = user;
        state.token = accessToken;
        state.isAuthenticated = true;
        localStorage.setItem('pos_token', accessToken);
        localStorage.setItem('pos_user', JSON.stringify(user));
      })
      .addCase(pinLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch current user
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        localStorage.removeItem('pos_token');
        localStorage.removeItem('pos_user');
      });
  },
});

export const { logout, clearError, setUser } = authSlice.actions;
export default authSlice.reducer;
