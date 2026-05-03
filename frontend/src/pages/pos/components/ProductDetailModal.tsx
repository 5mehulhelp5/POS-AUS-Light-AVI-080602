import { useState, useEffect } from 'react';
import {
  PlusIcon,
  MinusIcon,
  ShoppingCartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { productsApi, competitorApi } from '../../../services/api';
import {
  isProductOnSale,
  effectiveProductPrice,
} from '../../../store/slices/productsSlice';

interface ProductDetailModalProps {
  productId: number;
  fallbackProduct: {
    id: number;
    sku: string;
    name: string;
    price: number;
    specialPrice: number | null;
    specialPriceFrom?: string | null;
    specialPriceTo?: string | null;
    stockQty: number;
    isInStock: boolean;
    thumbnailUrl: string | null;
  };
  onClose: () => void;
  onAddToCart: (
    product: {
      id: number;
      sku: string;
      name: string;
      price: number;
      specialPrice: number | null;
      specialPriceFrom?: string | null;
      specialPriceTo?: string | null;
      thumbnailUrl: string | null;
      isInStock?: boolean;
      stockQty?: number;
    },
    quantity: number,
  ) => void;
}

type Tab = 'specs' | 'competitors' | 'description';

export default function ProductDetailModal({
  productId,
  fallbackProduct,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('specs');
  const [qty, setQty] = useState(1);
  const [galleryIdx, setGalleryIdx] = useState(0);

  const [competitor, setCompetitor] = useState<any>(null);
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [competitorError, setCompetitorError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    productsApi
      .getProductDetail(productId)
      .then((r) => {
        if (cancelled) return;
        setDetail(r.data.data);
      })
      .catch(() => {
        if (cancelled) return;
        setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Fetch competitor pricing when that tab is opened
  useEffect(() => {
    if (tab !== 'competitors' || competitor || competitorLoading) return;
    setCompetitorLoading(true);
    setCompetitorError(null);
    competitorApi
      .getPrice(fallbackProduct.name, fallbackProduct.sku)
      .then((r) => setCompetitor(r.data?.data || r.data))
      .catch((e) => {
        setCompetitorError(
          e.response?.data?.message || 'No competitor pricing found',
        );
      })
      .finally(() => setCompetitorLoading(false));
  }, [tab, competitor, competitorLoading, fallbackProduct.name, fallbackProduct.sku]);

  const product = detail?.product || fallbackProduct;
  const gallery: string[] =
    detail?.gallery && detail.gallery.length > 0
      ? detail.gallery
      : product.thumbnailUrl
        ? [product.thumbnailUrl]
        : [];
  const specs = detail?.specs || [];

  const onSale = isProductOnSale(product);
  const effectivePrice = effectiveProductPrice(product);
  const ourPrice = Number(effectivePrice);
  const compPrice = competitor?.price ? Number(competitor.price) : null;
  const diff = compPrice !== null ? ourPrice - compPrice : null;
  const diffPct =
    compPrice !== null && compPrice > 0 ? (diff! / compPrice) * 100 : null;

  const handleAdd = () => {
    // Out-of-stock items can still be added — the cashier will mark them
    // as Backorder in the payment sidebar. Surface a warning so they
    // don't forget.
    if (!product.isInStock || product.stockQty <= 0) {
      toast(
        'Out of stock — remember to tick "Backorder" on this line at checkout',
        { icon: 'ℹ️', duration: 5000 },
      );
    }
    onAddToCart(
      {
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        specialPrice: product.specialPrice,
        specialPriceFrom: product.specialPriceFrom,
        specialPriceTo: product.specialPriceTo,
        thumbnailUrl: product.thumbnailUrl,
        isInStock: product.isInStock,
        stockQty: product.stockQty,
      },
      qty,
    );
    onClose();
  };

  const nextImage = () =>
    setGalleryIdx((i) => (i + 1) % Math.max(1, gallery.length));
  const prevImage = () =>
    setGalleryIdx((i) => (i - 1 + gallery.length) % Math.max(1, gallery.length));

  return (
    <div className="modal-backdrop">
      <div className="bg-pos-card w-full h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start p-6 pb-4 border-b border-gray-700">
          <button onClick={onClose} className="modal-back-btn self-start">
            <ArrowLeftIcon className="h-5 w-5" /> Back
          </button>
          <div className="flex-1 px-6">
            <p className="text-xs text-gray-400 font-mono">{product.sku}</p>
            <h2 className="text-xl font-bold mt-1">{product.name}</h2>
            <div className="flex items-center gap-3 mt-2">
              {onSale ? (
                <>
                  <span className="text-2xl font-bold text-primary-400">
                    ${Number(product.specialPrice).toFixed(2)}
                  </span>
                  <span className="text-gray-500 line-through">
                    ${Number(product.price).toFixed(2)}
                  </span>
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
                    SALE
                  </span>
                </>
              ) : (
                <span className="text-2xl font-bold text-primary-400">
                  ${Number(product.price).toFixed(2)}
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  product.isInStock
                    ? 'bg-green-600/30 text-green-300'
                    : 'bg-red-600/30 text-red-300'
                }`}
              >
                {product.isInStock ? `In Stock: ${product.stockQty}` : 'Out of Stock'}
              </span>
            </div>
          </div>
        </div>

        {/* Body: gallery + tabs */}
        <div className="flex-1 overflow-auto flex">
          {/* Gallery column */}
          <div className="w-1/2 p-6 border-r border-gray-700 flex flex-col">
            <div className="relative flex-1 min-h-[260px] bg-pos-dark rounded-lg overflow-hidden flex items-center justify-center">
              {gallery.length > 0 ? (
                <img
                  src={gallery[galleryIdx]}
                  alt={product.name}
                  className="max-h-[340px] w-auto object-contain"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.onerror = null;
                    img.style.display = 'none';
                    const parent = img.parentElement;
                    if (parent && !parent.querySelector('[data-img-fallback]')) {
                      const fb = document.createElement('span');
                      fb.dataset.imgFallback = 'true';
                      fb.className = 'text-gray-500';
                      fb.textContent = 'Image unavailable';
                      parent.appendChild(fb);
                    }
                  }}
                />
              ) : (
                <span className="text-gray-500">No Image</span>
              )}
              {gallery.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 rounded-full p-1"
                  >
                    <ChevronLeftIcon className="h-5 w-5 text-white" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 rounded-full p-1"
                  >
                    <ChevronRightIcon className="h-5 w-5 text-white" />
                  </button>
                </>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {gallery.map((url, i) => (
                  <button
                    key={url + i}
                    onClick={() => setGalleryIdx(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
                      i === galleryIdx ? 'border-primary-500' : 'border-gray-700'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabs column */}
          <div className="w-1/2 flex flex-col">
            <div className="flex border-b border-gray-700">
              {[
                { id: 'specs', label: 'Specifications' },
                { id: 'competitors', label: 'Competitor Pricing' },
                { id: 'description', label: 'Description' },
              ].map((t) => (
                <button
                  key={t.id}
                  className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.id
                      ? 'border-primary-500 text-white'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setTab(t.id as Tab)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-4 text-sm">
              {tab === 'specs' && (
                <>
                  {loading ? (
                    <p className="text-gray-400">Loading specs...</p>
                  ) : specs.length === 0 ? (
                    <p className="text-gray-400">
                      {detail?.liveError || 'No specifications available for this product.'}
                    </p>
                  ) : (
                    <dl className="divide-y divide-gray-700">
                      {specs.map((s: any) => (
                        <div key={s.code} className="py-2 flex justify-between gap-4">
                          <dt className="text-gray-400">{s.label}</dt>
                          <dd className="text-right font-medium">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </>
              )}

              {tab === 'competitors' && (
                <>
                  {competitorLoading ? (
                    <p className="text-gray-400">Checking competitor pricing...</p>
                  ) : competitorError ? (
                    <div className="text-gray-400">
                      <p>{competitorError}</p>
                      <p className="text-xs mt-2">
                        We compare against onlinelighting.com.au by SKU and name.
                      </p>
                    </div>
                  ) : compPrice !== null ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-pos-dark rounded p-3">
                          <p className="text-xs text-gray-400">Our Price</p>
                          <p className="text-lg font-bold text-primary-400">
                            ${ourPrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-pos-dark rounded p-3">
                          <p className="text-xs text-gray-400">Competitor</p>
                          <p className="text-lg font-bold">${compPrice.toFixed(2)}</p>
                        </div>
                      </div>
                      <div
                        className={`rounded p-3 text-sm ${
                          diff! < 0
                            ? 'bg-green-500/10 border border-green-500/40 text-green-300'
                            : diff! > 0
                              ? 'bg-orange-500/10 border border-orange-500/40 text-orange-300'
                              : 'bg-gray-700/40 text-gray-300'
                        }`}
                      >
                        {diff! < 0
                          ? `We are cheaper by $${Math.abs(diff!).toFixed(2)} (${Math.abs(diffPct!).toFixed(1)}%)`
                          : diff! > 0
                            ? `We are more expensive by $${diff!.toFixed(2)} (${diffPct!.toFixed(1)}%)`
                            : 'Prices match.'}
                      </div>
                      {competitor.url && (
                        <a
                          href={competitor.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-400 text-xs underline"
                        >
                          View competitor product page →
                        </a>
                      )}
                      {competitor.checkedAt && (
                        <p className="text-[11px] text-gray-500">
                          Last checked: {new Date(competitor.checkedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400">No competitor match found.</p>
                  )}
                </>
              )}

              {tab === 'description' && (
                <>
                  {loading ? (
                    <p className="text-gray-400">Loading...</p>
                  ) : product.description || product.shortDescription ? (
                    <div className="space-y-3 text-gray-300">
                      {product.shortDescription && (
                        <p className="italic">{product.shortDescription}</p>
                      )}
                      {product.description && (
                        <p className="whitespace-pre-wrap">{product.description}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400">No description available.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer: qty + add to cart */}
        <div className="flex justify-between items-center p-4 border-t border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Qty:</span>
            <button
              className="p-1 bg-pos-accent rounded hover:bg-gray-600"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              <MinusIcon className="h-4 w-4" />
            </button>
            <input
              type="number"
              min={1}
              className="input w-16 text-center py-1 px-2"
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            />
            <button
              className="p-1 bg-pos-accent rounded hover:bg-gray-600"
              onClick={() => setQty((q) => q + 1)}
            >
              <PlusIcon className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-400 ml-4">
              Price: ${(ourPrice * qty).toFixed(2)}
            </span>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>
              Close
            </button>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handleAdd}
            >
              <ShoppingCartIcon className="h-5 w-5" />
              {product.isInStock && product.stockQty > 0
                ? 'Add to Cart'
                : 'Add as Backorder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
