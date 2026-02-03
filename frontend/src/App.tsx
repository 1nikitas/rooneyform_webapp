import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { ProductCard } from './components/ProductCard';
import { BottomNav } from './components/BottomNav';
import { ProductGridSkeleton } from './components/Skeleton';
import { PullToRefresh } from './components/PullToRefresh';
import { SwipeableCartItem } from './components/SwipeableCartItem';
import { useToast } from './components/Toast';
import { useStore } from './store/useStore';
import type { Product } from './types';
import apiClient from './api/client';
import { Search, Sun, Moon, ChevronDown, Package } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import { formatPrice } from './utils/currency';
import { useTheme } from './context/ThemeContext';
import logoDark from './assets/logo_dark.png';
import logoLight from './assets/logo_white.png';
import { SlidingNumber } from './components/animate-ui/primitives/texts/sliding-number';
import haptics from './utils/haptics';

const TAB_ORDER = ['home', 'cart', 'favorites'] as const;
const PRODUCT_LIMIT = 300;

const ProductModal = lazy(() =>
  import('./components/ProductModal').then((module) => ({ default: module.ProductModal })),
);

const tabVariants = {
  enter: (direction: number) => ({
    x: direction >= 0 ? 20 : -20,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? -20 : 20,
    opacity: 0,
  }),
};

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [direction, setDirection] = useState(0);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toggleTheme, isDark } = useTheme();
  const [catalogFilter, setCatalogFilter] = useState<'jerseys' | 'posters'>('jerseys');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [sortOption, setSortOption] = useState<'default' | 'price-asc' | 'price-desc' | 'name-asc'>('default');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const { showToast } = useToast();
  
  const { cart, favorites, pendingCartIds, addToCart, fetchCart, fetchFavorites, removeFromCart } = useStore();
  const fetchRequestId = useRef(0);
  const fetchAbortRef = useRef<AbortController | null>(null);

  const catalogCategory = useMemo(
    () => (catalogFilter === 'posters' ? 'posters' : undefined),
    [catalogFilter],
  );

  const fetchProducts = useCallback(async (q = '', categorySlug?: string) => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const requestId = ++fetchRequestId.current;
    
    try {
      const params = new URLSearchParams();
      params.append('limit', String(PRODUCT_LIMIT));
      if (q) params.append('search', q);
      if (categorySlug) params.append('category_slug', categorySlug);
      const res = await apiClient.get(`/products/?${params.toString()}`, {
        signal: controller.signal,
      });
      if (requestId !== fetchRequestId.current) return;
      const payload = res.data as unknown;
      if (Array.isArray(payload)) {
        setProducts(payload);
      } else if (payload && typeof payload === 'object') {
        const maybeList =
          Array.isArray((payload as { results?: Product[] }).results)
            ? (payload as { results: Product[] }).results
            : Array.isArray((payload as { items?: Product[] }).items)
              ? (payload as { items: Product[] }).items
              : Array.isArray((payload as { data?: Product[] }).data)
                ? (payload as { data: Product[] }).data
                : null;
        setProducts(maybeList ?? []);
      } else {
        setProducts([]);
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      console.error(e);
      setProducts([]);
    } finally {
      if (requestId === fetchRequestId.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Initial data fetch (cart + favorites)
  useEffect(() => {
    fetchCart();
    fetchFavorites();
  }, [fetchCart, fetchFavorites]);

  // Product fetch with debounce
  useEffect(() => {
    setIsLoading(true);
    const trimmedQuery = searchQuery.trim();
    const delay = trimmedQuery ? 400 : 0;
    const delayDebounceFn = setTimeout(() => {
      fetchProducts(trimmedQuery, catalogCategory);
    }, delay);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, fetchProducts, catalogCategory]);

  // User photo from Telegram
  useEffect(() => {
    const photoUrl = WebApp.initDataUnsafe?.user?.photo_url || null;
    setUserPhoto(photoUrl);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // TELEGRAM MAIN BUTTON INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const total = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    
    if (activeTab === 'cart' && cartCount > 0) {
      // Show Main Button for checkout
      try {
        WebApp.MainButton.setText(`Оформить заказ • ${formatPrice(total)}`);
        WebApp.MainButton.color = '#2563eb';
        WebApp.MainButton.textColor = '#ffffff';
        WebApp.MainButton.show();
        WebApp.MainButton.enable();
        
        const handleMainButtonClick = () => {
          if (!isCheckoutLoading) {
            handleCheckout();
          }
        };
        
        WebApp.MainButton.onClick(handleMainButtonClick);
        
        return () => {
          WebApp.MainButton.offClick(handleMainButtonClick);
          WebApp.MainButton.hide();
        };
      } catch (e) {
        // Fallback for environments without Main Button
        console.warn('Main Button not available:', e);
      }
    } else {
      // Hide Main Button on other tabs
      try {
        WebApp.MainButton.hide();
      } catch (e) {
        // Ignore
      }
    }
  }, [activeTab, cart, isCheckoutLoading]);

  const handleTabChange = (tab: string) => {
    if (tab === activeTab) return;
    haptics.selection();
    const currentIndex = TAB_ORDER.indexOf(activeTab as typeof TAB_ORDER[number]);
    const nextIndex = TAB_ORDER.indexOf(tab as typeof TAB_ORDER[number]);
    setDirection(currentIndex === -1 || nextIndex === -1 ? 0 : nextIndex > currentIndex ? 1 : -1);
    setActiveTab(tab);
  };

  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => { setLogoFailed(false); }, [isDark]);

  const sizeOptions = useMemo(() => {
    const sizes = new Set<string>();
    for (const product of products) {
      if (product.size) sizes.add(product.size.trim().toUpperCase());
    }
    const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    return Array.from(sizes).sort((a, b) => {
      const aIdx = order.indexOf(a);
      const bIdx = order.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (catalogFilter === 'jerseys') {
      list = list.filter((p) => p.category?.slug !== 'posters');
    }
    if (catalogFilter === 'jerseys' && sizeFilter !== 'all') {
      list = list.filter((p) => p.size?.trim().toUpperCase() === sizeFilter);
    }
    if (sortOption === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (sortOption === 'price-desc') list.sort((a, b) => b.price - a.price);
    else if (sortOption === 'name-asc') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, sizeFilter, sortOption, catalogFilter]);

  const handleCheckout = async () => {
    if (isCheckoutLoading || cart.length === 0) return;
    setIsCheckoutLoading(true);
    haptics.button();
    
    try {
      WebApp.MainButton.showProgress(true);
    } catch (e) {
      // Ignore
    }
    
    try {
      const res = await apiClient.post('/orders/');
      await fetchCart();
      const orderId = (res.data as { id?: number } | undefined)?.id;
      
      haptics.success();
      showToast('success', orderId ? `Заказ #${orderId} создан!` : 'Заказ создан!');
      
      // Optional: close WebApp after successful order
      // WebApp.close();
    } catch (e) {
      console.error(e);
      haptics.error();
      showToast('error', 'Ошибка оформления. Попробуйте ещё раз.');
    } finally {
      setIsCheckoutLoading(false);
      try {
        WebApp.MainButton.hideProgress();
      } catch (e) {
        // Ignore
      }
    }
  };

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      fetchProducts(searchQuery.trim(), catalogCategory),
      fetchCart(),
      fetchFavorites(),
    ]);
  }, [fetchProducts, searchQuery, catalogCategory, fetchCart, fetchFavorites]);

  // Add to cart with haptics and toast
  const handleAddToCart = useCallback(async (productId: number, productName: string) => {
    haptics.button();
    const success = await addToCart(productId);
    if (success) {
      haptics.success();
      showToast('cart', `${productName} добавлен в корзину`);
    } else {
      haptics.error();
    }
    return success;
  }, [addToCart, showToast]);

  // Remove from cart with haptics
  const handleRemoveFromCart = useCallback(async (itemId: number) => {
    haptics.tap();
    await removeFromCart(itemId);
    showToast('info', 'Товар удалён из корзины');
  }, [removeFromCart, showToast]);

  const cartProductIds = useMemo(() => new Set(cart.map(item => item.product.id)), [cart]);
  const pendingCartSet = useMemo(() => new Set(pendingCartIds), [pendingCartIds]);

  const sortLabels: Record<string, string> = {
    'default': 'По умолчанию',
    'price-asc': 'Сначала дешевле',
    'price-desc': 'Сначала дороже',
    'name-asc': 'По названию',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HOME TAB
  // ═══════════════════════════════════════════════════════════════════════════
  const renderHome = () => (
    <PullToRefresh onRefresh={handleRefresh} disabled={isLoading}>
      <div className="space-y-5">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          {/* Theme toggle */}
          <motion.button
            onClick={() => {
              haptics.tap();
              toggleTheme();
            }}
            aria-label="Сменить тему"
            className={`
              w-11 h-11 rounded-xl flex items-center justify-center
              transition-colors duration-200 tap-target
              ${isDark 
                ? 'bg-white/[0.08] text-white/80 hover:bg-white/[0.12] active:bg-white/[0.16]' 
                : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.06] active:bg-black/[0.08]'
              }
            `}
            whileTap={{ scale: 0.92 }}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </motion.button>
          
          {/* Logo */}
          <div className="flex-1 flex justify-center">
            {!logoFailed ? (
              <img
                src={isDark ? logoLight : logoDark}
                alt="RooneyForm"
                className="h-8 w-auto select-none pointer-events-none"
                draggable={false}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span className="text-lg font-bold tracking-tight text-tg-text">
                RooneyForm
              </span>
            )}
          </div>
          
          {/* Avatar */}
          <div className={`
            w-11 h-11 rounded-xl overflow-hidden
            flex items-center justify-center
            ${isDark 
              ? 'bg-gradient-to-br from-blue-500/80 to-purple-600/80' 
              : 'bg-gradient-to-br from-blue-500 to-purple-600'
            }
          `}>
            {userPhoto ? (
              <img src={userPhoto} alt="" className="w-full h-full object-cover" />
            ) : null}
          </div>
        </header>

        {/* Search */}
        <div className="relative">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} size={20} />
          <input
            type="text"
            placeholder="Найти футболку..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-search"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              haptics.tap();
              setCatalogFilter('jerseys');
            }}
            className={`chip ${catalogFilter === 'jerseys' ? 'chip-active' : 'chip-default'}`}
          >
            Футболки
          </button>
          <button
            onClick={() => {
              haptics.tap();
              setCatalogFilter('posters');
            }}
            className={`chip ${catalogFilter === 'posters' ? 'chip-active' : 'chip-default'}`}
          >
            Плакаты
          </button>
        </div>

        {/* Filters - only for jerseys */}
        {catalogFilter === 'jerseys' && (
          <div className={`
            rounded-2xl p-4 space-y-4
            ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.02]'}
          `}>
            {/* Size filters */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-wide text-tg-hint">
                  Размер
                </span>
                <span className="text-xs text-tg-hint">
                  {filteredProducts.length} шт.
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    haptics.tap();
                    setSizeFilter('all');
                  }}
                  className={`chip ${sizeFilter === 'all' ? 'chip-active' : 'chip-default'}`}
                >
                  Все
                </button>
                {sizeOptions.map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      haptics.tap();
                      setSizeFilter(size);
                    }}
                    className={`chip ${sizeFilter === size ? 'chip-active' : 'chip-default'}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  haptics.tap();
                  setShowSortDropdown(!showSortDropdown);
                }}
                className={`
                  w-full h-12 px-4 rounded-xl
                  flex items-center justify-between
                  text-sm font-medium
                  transition-colors duration-200
                  ${isDark 
                    ? 'bg-white/[0.06] text-white/90 hover:bg-white/[0.08]' 
                    : 'bg-white text-gray-700 shadow-xs hover:bg-gray-50'
                  }
                `}
              >
                <span>{sortLabels[sortOption]}</span>
                <ChevronDown size={18} className={`transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {showSortDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className={`
                      absolute top-full left-0 right-0 mt-2 z-20
                      rounded-xl overflow-hidden shadow-lg
                      ${isDark ? 'bg-[#1a1a1d] border border-white/[0.08]' : 'bg-white border border-black/[0.04]'}
                    `}
                  >
                    {Object.entries(sortLabels).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => {
                          haptics.tap();
                          setSortOption(key as typeof sortOption);
                          setShowSortDropdown(false);
                        }}
                        className={`
                          w-full px-4 py-3 text-left text-sm
                          transition-colors duration-150
                          ${sortOption === key 
                            ? 'text-tg-accent font-medium' 
                            : 'text-tg-text'
                          }
                          ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-gray-50'}
                        `}
                      >
                        {label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Product grid or skeleton */}
        {isLoading ? (
          <ProductGridSkeleton count={6} />
        ) : filteredProducts.length === 0 ? (
          <div className={`
            rounded-2xl px-6 py-16 text-center
            ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.02]'}
          `}>
            <div className={`
              w-16 h-16 mx-auto mb-4 rounded-2xl
              flex items-center justify-center
              ${isDark ? 'bg-white/[0.06] text-white/40' : 'bg-gray-100 text-gray-400'}
            `}>
              <Search size={28} />
            </div>
            <p className="text-tg-hint text-sm">Ничего не найдено</p>
            <p className="text-tg-hint/60 text-xs mt-1">Попробуйте изменить фильтры</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.25 }}
              >
                <ProductCard
                  product={product}
                  onClick={() => {
                    haptics.tap();
                    setSelectedProduct(product);
                  }}
                  onAdd={(e) => {
                    e.stopPropagation();
                    if (!cartProductIds.has(product.id) && !pendingCartSet.has(product.id)) {
                      handleAddToCart(product.id, product.name);
                    }
                  }}
                  inCart={cartProductIds.has(product.id) || pendingCartSet.has(product.id)}
                  enableSharedLayout={false}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // CART TAB
  // ═══════════════════════════════════════════════════════════════════════════
  const renderCart = () => {
    const total = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-tg-text">Корзина</h1>
            <p className="text-sm text-tg-hint mt-0.5">
              {cartCount} {cartCount === 1 ? 'товар' : cartCount < 5 ? 'товара' : 'товаров'}
            </p>
          </div>
          {cart.length > 0 && (
            <div className={`
              px-4 py-2 rounded-xl text-sm font-semibold
              ${isDark ? 'bg-tg-accent/20 text-tg-accent' : 'bg-blue-50 text-blue-600'}
            `}>
              {formatPrice(total)}
            </div>
          )}
        </div>

        {cart.length === 0 ? (
          /* Empty state */
          <div className={`
            rounded-2xl px-6 py-16 text-center
            ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.02]'}
          `}>
            <div className={`
              w-16 h-16 mx-auto mb-4 rounded-2xl
              flex items-center justify-center
              ${isDark ? 'bg-white/[0.06] text-white/40' : 'bg-gray-100 text-gray-400'}
            `}>
              <Package size={28} />
            </div>
            <p className="text-tg-hint text-sm">Корзина пуста</p>
            <p className="text-tg-hint/60 text-xs mt-1">Добавьте товары из каталога</p>
          </div>
        ) : (
          <>
            {/* Swipe hint */}
            <p className="text-xs text-tg-hint text-center">
              ← Свайпните влево для удаления
            </p>

            {/* Cart items with swipe-to-delete */}
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {cart.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <SwipeableCartItem
                      item={item}
                      onRemove={() => handleRemoveFromCart(item.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Summary */}
            <div className={`
              rounded-2xl p-5 space-y-4
              ${isDark 
                ? 'bg-[#1a1a1d] border border-white/[0.06]' 
                : 'bg-white border border-black/[0.04] shadow-card'
              }
            `}>
              <div className="flex justify-between items-center">
                <span className="text-sm text-tg-hint">Товары</span>
                <span className="text-sm text-tg-text">{formatPrice(total)}</span>
              </div>
              
              <div className="h-px bg-current opacity-[0.06]" />
              
              <div className="flex justify-between items-center">
                <span className="text-base font-semibold text-tg-text">Итого</span>
                <span className="text-xl font-bold text-tg-text inline-flex items-baseline gap-1">
                  <SlidingNumber number={total} thousandSeparator=" " decimalPlaces={0} />
                  <span className="text-sm font-semibold">₽</span>
                </span>
              </div>
              
              {/* Fallback button (Main Button is primary) */}
              <motion.button
                onClick={handleCheckout}
                disabled={isCheckoutLoading}
                className={`
                  btn-primary w-full
                  ${isCheckoutLoading ? 'opacity-70 cursor-wait' : ''}
                `}
                whileTap={isCheckoutLoading ? undefined : { scale: 0.98 }}
              >
                {isCheckoutLoading ? 'Оформляем...' : 'Оформить заказ'}
              </motion.button>
              
              <p className="text-xs text-tg-hint text-center">
                Или используйте кнопку внизу экрана
              </p>
            </div>
          </>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FAVORITES TAB
  // ═══════════════════════════════════════════════════════════════════════════
  const renderFavorites = () => (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-tg-text">Избранное</h1>
        <p className="text-sm text-tg-hint mt-0.5">
          {favorites.length} {favorites.length === 1 ? 'товар' : favorites.length < 5 ? 'товара' : 'товаров'}
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className={`
          rounded-2xl px-6 py-16 text-center
          ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.02]'}
        `}>
          <div className={`
            w-16 h-16 mx-auto mb-4 rounded-2xl
            flex items-center justify-center
            ${isDark ? 'bg-white/[0.06] text-white/40' : 'bg-gray-100 text-gray-400'}
          `}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <p className="text-tg-hint text-sm">Список пуст</p>
          <p className="text-tg-hint/60 text-xs mt-1">Добавляйте понравившиеся товары</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {favorites.map((fav, idx) => (
            <motion.div
              key={fav.product.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <ProductCard
                product={fav.product}
                onClick={() => {
                  haptics.tap();
                  setSelectedProduct(fav.product);
                }}
                onAdd={(e) => {
                  e.stopPropagation();
                  if (!cartProductIds.has(fav.product.id) && !pendingCartSet.has(fav.product.id)) {
                    handleAddToCart(fav.product.id, fav.product.name);
                  }
                }}
                inCart={cartProductIds.has(fav.product.id) || pendingCartSet.has(fav.product.id)}
                enableSharedLayout={false}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  const renderContent = () => {
    if (activeTab === 'home') return renderHome();
    if (activeTab === 'cart') return renderCart();
    if (activeTab === 'favorites') return renderFavorites();
    return null;
  };

  return (
    <Layout>
      <div className="relative min-h-[70vh]">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={tabVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="w-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNav currentTab={activeTab} onTabChange={handleTabChange} />

      <AnimatePresence>
        {selectedProduct && (
          <Suspense fallback={null}>
            <ProductModal
              product={selectedProduct}
              onClose={() => setSelectedProduct(null)}
            />
          </Suspense>
        )}
      </AnimatePresence>
      
      {/* Backdrop for sort dropdown */}
      {showSortDropdown && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => setShowSortDropdown(false)} 
        />
      )}
    </Layout>
  );
}

export default App;
