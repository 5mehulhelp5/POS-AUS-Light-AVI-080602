import { useMemo, useState } from 'react';
import {
  XMarkIcon,
  ScissorsIcon,
  ClipboardDocumentIcon,
  PaperAirplaneIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

// Cut-to-length LED strip catalogue. Edit these entries to add products
// or tweak rates — the modal reads everything from this array. Prices
// are per metre GST-inclusive; trade rate applies when the cashier
// flips the top-right pill.
interface StripProduct {
  id: string;
  name: string;
  retailPerM: number;
  tradePerM: number;
  // Only cuttable at multiples of this many mm. e.g. 1000 = 1m cuts.
  cutMm: number;
  // Longest single continuous run (limited by voltage drop). Longer
  // orders are split into separate runs; we warn but don't block.
  maxRunM: number;
  // How many metres of lead tail are included free with each strip,
  // and the per-metre charge for anything above that.
  includedTailM: number;
  tailPerM: number;
}

const STRIP_PRODUCTS: StripProduct[] = [
  {
    id: 'hv240-ip67',
    name: 'High-Voltage Strip 240V — IP67 Outdoor',
    retailPerM: 46,
    tradePerM: 36,
    cutMm: 1000,
    maxRunM: 50,
    includedTailM: 1,
    tailPerM: 7,
  },
  {
    id: 'lv24-ip65',
    name: 'Low-Voltage 24V — IP65 Outdoor',
    retailPerM: 28,
    tradePerM: 22,
    cutMm: 100,
    maxRunM: 10,
    includedTailM: 1,
    tailPerM: 6,
  },
  {
    id: 'lv12-ip20',
    name: 'Low-Voltage 12V — IP20 Indoor',
    retailPerM: 18,
    tradePerM: 14,
    cutMm: 50,
    maxRunM: 5,
    includedTailM: 1,
    tailPerM: 5,
  },
  {
    id: 'cob24-ip20',
    name: 'COB LED 24V — IP20 Indoor',
    retailPerM: 32,
    tradePerM: 25,
    cutMm: 50,
    maxRunM: 5,
    includedTailM: 1,
    tailPerM: 5,
  },
];

interface OrderLine {
  id: number;
  product: StripProduct;
  lengthMm: number;
  suppliedLengthM: number;
  tailM: number;
  linePrice: number;
  perM: number;
  isTrade: boolean;
}

interface Props {
  onClose: () => void;
  onSendToCart: (
    lines: Array<{ sku: string; name: string; price: number }>,
  ) => void;
}

const money = (n: number) =>
  n.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  });

export default function StripCutModal({ onClose, onSendToCart }: Props) {
  const [productId, setProductId] = useState(STRIP_PRODUCTS[0].id);
  const [lengthMmStr, setLengthMmStr] = useState('');
  const [tailMStr, setTailMStr] = useState('1');
  const [isTrade, setIsTrade] = useState(false);
  const [order, setOrder] = useState<OrderLine[]>([]);

  const product = STRIP_PRODUCTS.find((p) => p.id === productId)!;
  const perM = isTrade ? product.tradePerM : product.retailPerM;

  // Round the requested length up to the next cut point, then compute
  // supplied metres + tail metres + total line price.
  const calc = useMemo(() => {
    const lengthMm = Math.max(0, Number(lengthMmStr) || 0);
    const tailM = Math.max(0, Number(tailMStr) || 0);
    const suppliedMm = lengthMm > 0
      ? Math.ceil(lengthMm / product.cutMm) * product.cutMm
      : 0;
    const suppliedM = suppliedMm / 1000;
    const extraTailM = Math.max(0, tailM - product.includedTailM);
    const stripPrice = suppliedM * perM;
    const tailPrice = extraTailM * product.tailPerM;
    const linePrice = stripPrice + tailPrice;
    const exceedsMaxRun = suppliedM > product.maxRunM;
    return {
      lengthMm,
      tailM,
      suppliedMm,
      suppliedM,
      extraTailM,
      stripPrice,
      tailPrice,
      linePrice,
      exceedsMaxRun,
    };
  }, [lengthMmStr, tailMStr, product, perM]);

  const canAdd = calc.suppliedM > 0 && !calc.exceedsMaxRun;

  const subtotal = order.reduce((s, l) => s + l.linePrice, 0);

  const handleAdd = () => {
    if (!canAdd) return;
    setOrder((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        product,
        lengthMm: calc.lengthMm,
        suppliedLengthM: calc.suppliedM,
        tailM: calc.tailM,
        linePrice: calc.linePrice,
        perM,
        isTrade,
      },
    ]);
    setLengthMmStr('');
  };

  const handleRemove = (id: number) => {
    setOrder((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSend = () => {
    if (order.length === 0) return;
    const cartLines = order.map((l) => ({
      sku: `LED-STRIP-${l.product.id.toUpperCase()}-${Math.round(
        l.suppliedLengthM * 1000,
      )}`,
      name: `${l.product.name} — ${l.suppliedLengthM}m${
        l.tailM > l.product.includedTailM ? ` + ${l.tailM}m tail` : ''
      }${l.isTrade ? ' (trade)' : ''}`,
      price: l.linePrice,
    }));
    onSendToCart(cartLines);
    onClose();
  };

  // Reel bar visualisation — show N slots for cut points, coloured
  // amber up to the current supplied length. Purely decorative.
  const reelSlots = Math.max(10, Math.ceil(product.maxRunM * 1000 / product.cutMm));
  const filledSlots = Math.min(
    reelSlots,
    Math.ceil(calc.suppliedMm / product.cutMm),
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content bg-gray-50 text-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-4xl mx-auto pb-10">
          {/* Header */}
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-gray-900 text-amber-400 flex items-center justify-center">
                <ScissorsIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">Strip Cut Counter</div>
                <div className="text-xs text-gray-500">
                  Staff order tool — cut-to-length LED strip
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTrade((v) => !v)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  isTrade
                    ? 'bg-gray-900 text-amber-400 border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                }`}
              >
                {isTrade ? 'Trade pricing' : 'Retail pricing'}
              </button>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-900"
                aria-label="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Product picker + cut calculator */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {STRIP_PRODUCTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
              <span>Rate <span className="font-bold text-gray-900">${perM.toFixed(2)}</span>/m</span>
              <span>Cuts every <span className="font-bold text-gray-900">{product.cutMm}mm</span></span>
              <span>Max run <span className="font-bold text-gray-900">{product.maxRunM}m</span></span>
              <span>
                Tail <span className="font-bold text-gray-900">{product.includedTailM}m</span> incl
                {' · '}
                <span className="font-bold text-gray-900">+${product.tailPerM.toFixed(2)}</span>/m
              </span>
            </div>

            {/* Reel visualisation */}
            <div className="mt-4 bg-gray-100 rounded-md p-4">
              <div className="flex overflow-hidden rounded">
                {Array.from({ length: reelSlots }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-8 border-r border-white/60 last:border-r-0 ${
                      i < filledSlots ? 'bg-amber-300' : 'bg-gray-200'
                    }`}
                    style={
                      i < filledSlots
                        ? {
                            opacity: 0.6 + 0.4 * (i / Math.max(1, filledSlots - 1)),
                          }
                        : {}
                    }
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1 text-[11px] text-gray-500">
                <span>0</span>
                <span>{product.maxRunM}m reel</span>
              </div>
            </div>

            {/* Length + Tail inputs */}
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Length (mm)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={lengthMmStr}
                  onChange={(e) => setLengthMmStr(e.target.value)}
                  placeholder="e.g. 3200"
                  autoFocus
                />
                {calc.lengthMm > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Rounded up to next cut point → supplied {calc.suppliedMm}mm
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tail length (m)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={tailMStr}
                  onChange={(e) => setTailMStr(e.target.value)}
                  min={0}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {product.includedTailM}m included
                </p>
              </div>
            </div>

            {/* Max-run warning */}
            {calc.exceedsMaxRun && (
              <div className="mt-4 border border-red-200 bg-red-50 text-red-700 rounded-md px-3 py-2 text-sm">
                {calc.suppliedM}m exceeds the {product.maxRunM}m max continuous run
                — this needs separate runs or a joiner. Split into multiple lines.
              </div>
            )}

            {/* Line price + Add */}
            <div className="mt-5 flex items-end justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Line price
                </div>
                <div className="text-3xl font-extrabold text-amber-600 leading-tight">
                  {money(calc.linePrice)}
                </div>
                <div className="text-xs text-gray-500">
                  {money(calc.stripPrice)} strip
                  {calc.tailPrice > 0
                    ? ` + ${money(calc.tailPrice)} tail`
                    : ''}
                </div>
              </div>
              <button
                onClick={handleAdd}
                disabled={!canAdd}
                className={`px-5 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                  canAdd
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                + Add to order
              </button>
            </div>
          </div>

          {/* Order list */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardDocumentIcon className="h-5 w-5 text-gray-500" />
              <div className="font-bold text-gray-900">Order</div>
              <div className="text-xs text-gray-500">({order.length} lines)</div>
            </div>

            {order.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">
                Add a cut length and it lands here. Keep adding — you stay on this product.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {order.map((l) => (
                  <li key={l.id} className="py-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900">
                        {l.product.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {l.suppliedLengthM}m · tail {l.tailM}m · ${l.perM.toFixed(2)}/m
                        {l.isTrade ? ' · trade' : ''}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-gray-900">
                      {money(l.linePrice)}
                    </div>
                    <button
                      onClick={() => handleRemove(l.id)}
                      className="text-gray-400 hover:text-red-500 text-xs"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between border-t border-gray-200 mt-4 pt-4">
              <div className="text-sm text-gray-500">Subtotal</div>
              <div className="text-lg font-bold text-amber-600 flex items-center gap-1">
                <BoltIcon className="h-5 w-5" />
                {money(subtotal)}
              </div>
            </div>

            <button
              onClick={handleSend}
              disabled={order.length === 0}
              className={`mt-4 w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 ${
                order.length === 0
                  ? 'bg-amber-100 text-amber-400 cursor-not-allowed'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              <PaperAirplaneIcon className="h-5 w-5" />
              Send to cart / My Quote
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
