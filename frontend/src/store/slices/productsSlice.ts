import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { productsApi } from '../../services/api';

export interface Product {
  id: number;
  magentoId: number;
  sku: string;
  name: string;
  price: number;
  specialPrice: number | null;
  stockQty: number;
  isInStock: boolean;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  barcode: string | null;
  categories: Array<{ id: number; name: string }>;
}

export interface Category {
  id: number;
  magentoId: number;
  name: string;
  children?: Category[];
}

interface CategoryBreadcrumb {
  id: number;
  name: string;
}

interface ProductsState {
  items: Product[];
  categories: Category[];
  subcategories: Category[];
  selectedCategory: number | null;
  selectedSubcategory: number | null;
  parentCategoryName: string | null;
  categoryPath: CategoryBreadcrumb[]; // Breadcrumb trail for deep navigation
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const initialState: ProductsState = {
  items: [],
  categories: [],
  subcategories: [],
  selectedCategory: null,
  selectedSubcategory: null,
  parentCategoryName: null,
  categoryPath: [],
  searchQuery: '',
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
};

// Async thunks
export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (
    params: {
      search?: string;
      category?: number;
      page?: number;
      limit?: number;
      // Default true — out-of-stock (treated as discontinued) is hidden
      // from the grid/search. Pass undefined or false to surface them
      // (e.g. an admin "Show discontinued" toggle). Barcode and SKU
      // lookups are unaffected and still return any product.
      inStock?: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      const withDefault = {
        inStock: true,
        ...params,
      };
      const response = await productsApi.getProducts(withDefault);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error?.message || 'Failed to fetch products'
      );
    }
  }
);

export const fetchCategories = createAsyncThunk(
  'products/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await productsApi.getCategories();
      return response.data.data.categories;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error?.message || 'Failed to fetch categories'
      );
    }
  }
);

export const fetchSubcategories = createAsyncThunk(
  'products/fetchSubcategories',
  async (categoryId: number, { rejectWithValue }) => {
    try {
      const response = await productsApi.getSubcategories(categoryId);
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error?.message || 'Failed to fetch subcategories'
      );
    }
  }
);

export const searchByBarcode = createAsyncThunk(
  'products/searchByBarcode',
  async (barcode: string, { rejectWithValue }) => {
    try {
      const response = await productsApi.getByBarcode(barcode);
      if (!response.data.success) {
        return rejectWithValue('Product not found');
      }
      return response.data.data.product;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error?.message || 'Product not found'
      );
    }
  }
);

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setSelectedCategory: (state, action: PayloadAction<number | null>) => {
      state.selectedCategory = action.payload;
      state.selectedSubcategory = null;
      state.subcategories = [];
      state.parentCategoryName = null;
      state.categoryPath = [];
    },
    setSelectedSubcategory: (state, action: PayloadAction<number | null>) => {
      state.selectedSubcategory = action.payload;
    },
    // Navigate into a subcategory (for deep navigation)
    navigateToCategory: (state, action: PayloadAction<{ id: number; name: string }>) => {
      state.categoryPath.push(action.payload);
      state.subcategories = [];
      state.selectedSubcategory = null;
    },
    // Go back to a specific level in the breadcrumb
    navigateToBreadcrumb: (state, action: PayloadAction<number>) => {
      const index = action.payload;
      if (index < 0) {
        // Go back to main categories
        state.categoryPath = [];
        state.subcategories = [];
        state.selectedSubcategory = null;
        state.parentCategoryName = null;
      } else {
        // Go to specific level
        state.categoryPath = state.categoryPath.slice(0, index + 1);
        state.subcategories = [];
        state.selectedSubcategory = null;
      }
    },
    clearSubcategories: (state) => {
      state.subcategories = [];
      state.selectedSubcategory = null;
      state.parentCategoryName = null;
      state.categoryPath = [];
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch products
      .addCase(fetchProducts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload.data.products;
        state.pagination = action.payload.data.pagination;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch categories
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload;
      })
      // Fetch subcategories
      .addCase(fetchSubcategories.fulfilled, (state, action) => {
        state.subcategories = action.payload.subcategories;
        state.parentCategoryName = action.payload.parentCategory?.name || null;
      })
      // Search by barcode
      .addCase(searchByBarcode.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  setSearchQuery,
  setSelectedCategory,
  setSelectedSubcategory,
  navigateToCategory,
  navigateToBreadcrumb,
  clearSubcategories,
  clearError,
} = productsSlice.actions;

export default productsSlice.reducer;
