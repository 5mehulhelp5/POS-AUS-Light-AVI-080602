import { PlusIcon } from '@heroicons/react/24/outline';

interface Product {
  id: number;
  sku: string;
  name: string;
  price: number;
  specialPrice: number | null;
  stockQty: number;
  isInStock: boolean;
  thumbnailUrl: string | null;
  productType?: string;
}

interface ProductGridProps {
  products: Product[];
  isLoading: boolean;
  onAddToCart: (product: Product) => void;
}

export default function ProductGrid({
  products,
  isLoading,
  onAddToCart,
}: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Loading products...</div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">No products found</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="grid grid-cols-5 gap-2 auto-rows-max">
        {products.map((product) => (
          <button
            key={product.id}
            className="product-card text-left group h-fit"
            onClick={() => onAddToCart(product)}
            disabled={!product.isInStock}
          >
            {/* Product Image */}
            <div className="h-28 bg-pos-accent rounded-lg mb-2 overflow-hidden relative">
              {product.thumbnailUrl ? (
                <img
                  src={product.thumbnailUrl}
                  alt={product.name}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  No Image
                </div>
              )}

              {/* Add overlay on hover */}
              <div className="absolute inset-0 bg-primary-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <PlusIcon className="h-10 w-10 text-white" />
              </div>

              {/* Out of stock overlay */}
              {!product.isInStock && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <span className="text-red-400 font-medium">Out of Stock</span>
                </div>
              )}

              {/* Special price badge */}
              {product.specialPrice && (
                <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                  SALE
                </div>
              )}

              {/* Configurable product badge */}
              {product.productType === 'configurable' && (
                <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">
                  OPTIONS
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-1">
              <p className="text-xs text-gray-400 font-mono">{product.sku}</p>
              <h3 className="font-medium text-sm line-clamp-2">{product.name}</h3>
              <div className="flex items-center gap-2">
                {product.specialPrice ? (
                  <>
                    <span className="text-primary-400 font-bold">
                      ${product.specialPrice.toFixed(2)}
                    </span>
                    <span className="text-gray-500 text-sm line-through">
                      ${product.price.toFixed(2)}
                    </span>
                  </>
                ) : (
                  <span className="text-primary-400 font-bold">
                    ${product.price.toFixed(2)}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Stock: {product.stockQty}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
