import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Search, ChevronDown, Package, SlidersHorizontal, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import { formatPrice } from './utils/currency';
import { SlidingNumber } from './components/animate-ui/primitives/texts/sliding-number';
import haptics from './utils/haptics';
import { BRANDS, LEAGUES, LEAGUE_CLUBS, SEASONS, KIT_TYPES } from './constants/referenceData';

const TAB_ORDER = ['home', 'cart', 'favorites'] as const;
const PRODUCT_LIMIT = 300;
const INITIAL_RENDER_COUNT = 24;
const RENDER_CHUNK = 24;

import { ProductModal } from './components/ProductModal';

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
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [catalogFilter, setCatalogFilter] = useState<'jerseys' | 'posters'>('jerseys');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [clubFilter, setClubFilter] = useState('all');
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [kitTypeFilter, setKitTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortOption, setSortOption] = useState<'default' | 'price-asc' | 'price-desc' | 'name-asc'>('default');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_COUNT);
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

  // Hide Telegram MainButton (we use our own checkout button)
  useEffect(() => {
    try {
      WebApp.MainButton.hide();
    } catch {
      // Ignore
    }
  }, [activeTab]);

  const handleTabChange = (tab: string) => {
    if (tab === activeTab) return;
    haptics.selection();
    const currentIndex = TAB_ORDER.indexOf(activeTab as typeof TAB_ORDER[number]);
    const nextIndex = TAB_ORDER.indexOf(tab as typeof TAB_ORDER[number]);
    setDirection(currentIndex === -1 || nextIndex === -1 ? 0 : nextIndex > currentIndex ? 1 : -1);
    setActiveTab(tab);
  };

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

  // Count active filters (excluding size which is always visible)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (brandFilter !== 'all') count++;
    if (leagueFilter !== 'all') count++;
    if (clubFilter !== 'all') count++;
    if (seasonFilter !== 'all') count++;
    if (kitTypeFilter !== 'all') count++;
    return count;
  }, [brandFilter, leagueFilter, clubFilter, seasonFilter, kitTypeFilter]);

  // Available clubs based on selected league
  const availableClubs = useMemo(() => {
    if (leagueFilter === 'all') return [];
    return LEAGUE_CLUBS[leagueFilter] ?? [];
  }, [leagueFilter]);

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (catalogFilter === 'jerseys') {
      list = list.filter((p) => p.category?.slug !== 'posters');
    }
    if (catalogFilter === 'jerseys') {
      if (sizeFilter !== 'all') {
        list = list.filter((p) => p.size?.trim().toUpperCase() === sizeFilter);
      }
      if (brandFilter !== 'all') {
        list = list.filter((p) => p.brand === brandFilter);
      }
      if (leagueFilter !== 'all') {
        list = list.filter((p) => p.league === leagueFilter);
      }
      if (clubFilter !== 'all') {
        list = list.filter((p) => p.team === clubFilter);
      }
      if (seasonFilter !== 'all') {
        list = list.filter((p) => p.season === seasonFilter);
      }
      if (kitTypeFilter !== 'all') {
        list = list.filter((p) => p.kit_type === kitTypeFilter);
      }
    }
    if (sortOption === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (sortOption === 'price-desc') list.sort((a, b) => b.price - a.price);
    else if (sortOption === 'name-asc') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, sizeFilter, brandFilter, leagueFilter, clubFilter, seasonFilter, kitTypeFilter, sortOption, catalogFilter]);

  useEffect(() => {
    setVisibleCount(INITIAL_RENDER_COUNT);
  }, [filteredProducts]);

  const handleCheckout = async () => {
    if (isCheckoutLoading || cart.length === 0) return;
    setIsCheckoutLoading(true);
    haptics.button();
    
    try {
      const res = await apiClient.post('/orders/');
      await fetchCart();
      const orderId = (res.data as { id?: number } | undefined)?.id;

      const orderEntries: string[] = [];
      cart.forEach((item) => {
        const label = item.product.category?.slug === 'posters' ? 'плакат' : 'футболка';
        const link = item.product.tg_post_url?.trim();
        const entry = link ? `${label} — ${link}` : label;
        for (let i = 0; i < Math.max(1, item.quantity); i += 1) {
          orderEntries.push(entry);
        }
      });
      const orderList = orderEntries.length ? orderEntries.join(', ') : 'товар';
      const message = `Здравствуйте! Хотел бы сделать заказ: ${orderList}. Что для этого нужно сделать?`;
      const tgChatUrl = `https://t.me/rooneyform_admin?text=${encodeURIComponent(message)}`;

      haptics.success();
      showToast('success', orderId ? `Заказ #${orderId} создан!` : 'Заказ создан!');
      
      // Open Telegram chat with admin for order confirmation
      try {
        WebApp.openTelegramLink(tgChatUrl);
      } catch {
        // Fallback: try opening link directly
        try {
          window.open(tgChatUrl, '_blank');
        } catch {
          // Ignore
        }
      }
    } catch (e) {
      console.error(e);
      haptics.error();
      showToast('error', 'Ошибка оформления. Попробуйте ещё раз.');
    } finally {
      setIsCheckoutLoading(false);
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

  const cartTotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0),
    [cart],
  );
  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart],
  );

  const sortLabels: Record<string, string> = {
    'default': 'По умолчанию',
    'price-asc': 'Сначала дешевле',
    'price-desc': 'Сначала дороже',
    'name-asc': 'По названию',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HOME TAB
  // ═══════════════════════════════════════════════════════════════════════════
  const renderHome = () => {
    const visibleProducts = filteredProducts.slice(0, visibleCount);
    return (
    <PullToRefresh onRefresh={handleRefresh} disabled={isLoading}>
      <div className="space-y-5">
        {/* Header */}
        <header className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold tracking-tight text-tg-text">Каталог</span>
            <span className="text-[10px] uppercase tracking-[0.32em] text-tg-hint">
              RooneyForm
            </span>
          </div>
        </header>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-tg-hint" size={20} />
          <input
            type="text"
            placeholder="Поиск по каталогу"
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
          <div className="space-y-3">
            {/* Size chips + filter toggle + sort - always visible */}
            <div className="surface-muted rounded-2xl p-4 space-y-3">
              {/* Size row */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-tg-hint">
                    Размер
                  </span>
                  <span className="text-xs text-tg-hint">
                    {filteredProducts.length} шт.
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => { haptics.tap(); setSizeFilter('all'); }}
                    className={`chip ${sizeFilter === 'all' ? 'chip-active' : 'chip-default'}`}
                  >
                    Все
                  </button>
                  {sizeOptions.map((size) => (
                    <button
                      key={size}
                      onClick={() => { haptics.tap(); setSizeFilter(size); }}
                      className={`chip ${sizeFilter === size ? 'chip-active' : 'chip-default'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter toggle + Sort in a row */}
              <div className="flex gap-2">
                <button
                  onClick={() => { haptics.tap(); setShowFilters(!showFilters); }}
                  className={`flex-1 h-11 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors duration-200 ${
                    showFilters || activeFilterCount > 0
                      ? 'surface-card text-tg-text'
                      : 'surface-card text-tg-hint'
                  }`}
                >
                  <SlidersHorizontal size={16} />
                  <span>Фильтры</span>
                  {activeFilterCount > 0 && (
                    <span className="min-w-[20px] h-[20px] px-1 badge-contrast text-[10px] font-bold rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <div className="relative flex-1">
                  <button
                    onClick={() => { haptics.tap(); setShowSortDropdown(!showSortDropdown); }}
                    className="w-full h-11 px-4 rounded-xl flex items-center justify-between text-sm font-medium transition-colors duration-200 surface-card"
                  >
                    <span className="truncate text-tg-hint">{sortLabels[sortOption]}</span>
                    <ChevronDown size={16} className={`transition-transform flex-shrink-0 ml-1 ${showSortDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <AnimatePresence>
                    {showSortDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 mt-2 z-20 rounded-xl overflow-hidden surface-card shadow-lg"
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
                              w-full px-4 py-3 text-left text-sm transition-colors duration-150
                              ${sortOption === key ? 'text-tg-text font-semibold' : 'text-tg-text'}
                              hover:bg-black/5 dark:hover:bg-white/5
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
            </div>

            {/* Extended filters panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="surface-muted rounded-2xl p-4 space-y-4">
                    {/* Active filters summary + reset */}
                    {activeFilterCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-tg-hint">
                          Активных фильтров: {activeFilterCount}
                        </span>
                        <button
                          onClick={() => {
                            haptics.tap();
                            setBrandFilter('all');
                            setLeagueFilter('all');
                            setClubFilter('all');
                            setSeasonFilter('all');
                            setKitTypeFilter('all');
                          }}
                          className="text-xs font-medium text-tg-text flex items-center gap-1"
                        >
                          <X size={12} />
                          Сбросить
                        </button>
                      </div>
                    )}

                    {/* Brand */}
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wide text-tg-hint block mb-2">
                        Бренд
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => { haptics.tap(); setBrandFilter('all'); }}
                          className={`chip ${brandFilter === 'all' ? 'chip-active' : 'chip-default'}`}
                        >
                          Все
                        </button>
                        {BRANDS.map((b) => (
                          <button
                            key={b}
                            onClick={() => { haptics.tap(); setBrandFilter(b); }}
                            className={`chip ${brandFilter === b ? 'chip-active' : 'chip-default'}`}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* League */}
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wide text-tg-hint block mb-2">
                        Лига
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => { haptics.tap(); setLeagueFilter('all'); setClubFilter('all'); }}
                          className={`chip ${leagueFilter === 'all' ? 'chip-active' : 'chip-default'}`}
                        >
                          Все
                        </button>
                        {LEAGUES.map((l) => (
                          <button
                            key={l}
                            onClick={() => { haptics.tap(); setLeagueFilter(l); setClubFilter('all'); }}
                            className={`chip ${leagueFilter === l ? 'chip-active' : 'chip-default'}`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Club - only when a league is selected */}
                    {leagueFilter !== 'all' && availableClubs.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <span className="text-xs font-medium uppercase tracking-wide text-tg-hint block mb-2">
                          Клуб
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => { haptics.tap(); setClubFilter('all'); }}
                            className={`chip ${clubFilter === 'all' ? 'chip-active' : 'chip-default'}`}
                          >
                            Все
                          </button>
                          {availableClubs.map((c) => (
                            <button
                              key={c}
                              onClick={() => { haptics.tap(); setClubFilter(c); }}
                              className={`chip ${clubFilter === c ? 'chip-active' : 'chip-default'}`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Season */}
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wide text-tg-hint block mb-2">
                        Сезон
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => { haptics.tap(); setSeasonFilter('all'); }}
                          className={`chip ${seasonFilter === 'all' ? 'chip-active' : 'chip-default'}`}
                        >
                          Все
                        </button>
                        {SEASONS.map((s) => (
                          <button
                            key={s}
                            onClick={() => { haptics.tap(); setSeasonFilter(s); }}
                            className={`chip ${seasonFilter === s ? 'chip-active' : 'chip-default'}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Kit type */}
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wide text-tg-hint block mb-2">
                        Тип формы
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => { haptics.tap(); setKitTypeFilter('all'); }}
                          className={`chip ${kitTypeFilter === 'all' ? 'chip-active' : 'chip-default'}`}
                        >
                          Все
                        </button>
                        {KIT_TYPES.map((k) => (
                          <button
                            key={k}
                            onClick={() => { haptics.tap(); setKitTypeFilter(k); }}
                            className={`chip ${kitTypeFilter === k ? 'chip-active' : 'chip-default'}`}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Product grid or skeleton */}
        {isLoading ? (
          <ProductGridSkeleton count={6} />
        ) : filteredProducts.length === 0 ? (
          <div className="surface-muted rounded-2xl px-6 py-16 text-center">
            <div className="surface-soft w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-tg-hint">
              <Search size={28} />
            </div>
            <p className="text-tg-hint text-sm">Ничего не найдено</p>
            <p className="text-tg-hint opacity-60 text-xs mt-1">Попробуйте изменить фильтры</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {visibleProducts.map((product, idx) => (
                <div
                  key={product.id}
                  className={idx < 4 ? '' : 'animate-fade-in'}
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
                    imageLoading={idx < 4 ? 'eager' : 'lazy'}
                    imageFetchPriority={idx < 4 ? 'high' : 'auto'}
                  />
                </div>
              ))}
            </div>
            {visibleCount < filteredProducts.length && (
              <LoadMoreSentinel
                onVisible={() =>
                  setVisibleCount((prev) =>
                    Math.min(prev + RENDER_CHUNK, filteredProducts.length),
                  )
                }
              />
            )}
          </>
        )}
      </div>
    </PullToRefresh>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CART TAB
  // ═══════════════════════════════════════════════════════════════════════════
  const renderCart = () => {
    return (
      <div className="space-y-5 pb-20">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-lg font-semibold text-tg-text">Корзина</h1>
            <p className="text-sm text-tg-hint mt-0.5">
              {cartCount} {cartCount === 1 ? 'товар' : cartCount < 5 ? 'товара' : 'товаров'}
            </p>
          </div>
          {cart.length > 0 && (
            <div className="surface-soft px-4 py-2 rounded-xl text-sm font-semibold text-tg-text">
              {formatPrice(cartTotal)}
            </div>
          )}
        </div>

        {cart.length === 0 ? (
          /* Empty state */
          <div className="surface-muted rounded-2xl px-6 py-16 text-center">
            <div className="surface-soft w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-tg-hint">
              <Package size={28} />
            </div>
            <p className="text-tg-hint text-sm">Корзина пуста</p>
            <p className="text-tg-hint opacity-60 text-xs mt-1">Добавьте товары из каталога</p>
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

            {/* Summary (totals only, no button here) */}
            <div className="surface-card rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-tg-hint">Товары</span>
                <span className="text-sm text-tg-text">{formatPrice(cartTotal)}</span>
              </div>
              
              <div className="h-px bg-current opacity-[0.06]" />
              
              <div className="flex justify-between items-center">
                <span className="text-base font-semibold text-tg-text">Итого</span>
                <span className="text-xl font-bold text-tg-text inline-flex items-baseline gap-1">
                  <SlidingNumber number={cartTotal} thousandSeparator=" " decimalPlaces={0} />
                  <span className="text-sm font-semibold">₽</span>
                </span>
              </div>
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
        <h1 className="text-lg font-semibold text-tg-text">Избранное</h1>
        <p className="text-sm text-tg-hint mt-0.5">
          {favorites.length} {favorites.length === 1 ? 'товар' : favorites.length < 5 ? 'товара' : 'товаров'}
        </p>
      </div>

      {favorites.length === 0 ? (
          <div className="surface-muted rounded-2xl px-6 py-16 text-center">
          <div className="surface-soft w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-tg-hint">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <p className="text-tg-hint text-sm">Список пуст</p>
          <p className="text-tg-hint opacity-60 text-xs mt-1">Добавляйте понравившиеся товары</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {favorites.map((fav, idx) => (
            <div
              key={fav.product.id}
              className={idx < 4 ? '' : 'animate-fade-in'}
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
            </div>
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

      {/* Fixed checkout bar - above navbar, only on cart tab with items */}
      <AnimatePresence>
        {activeTab === 'cart' && cartCount > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed left-0 right-0 z-40 px-4"
            style={{ bottom: 'calc(var(--safe-area-bottom-effective) + 82px)' }}
          >
            <div className="w-full max-w-[430px] mx-auto">
              <motion.button
                onClick={handleCheckout}
                disabled={isCheckoutLoading}
                className={`
                  btn-primary w-full py-4 rounded-2xl font-semibold text-[15px]
                  shadow-[0_8px_32px_rgba(0,0,0,0.25)]
                  ${isCheckoutLoading ? 'opacity-70 cursor-wait' : ''}
                `}
                whileTap={isCheckoutLoading ? undefined : { scale: 0.98 }}
              >
                {isCheckoutLoading ? 'Оформляем...' : `Оформить заказ • ${formatPrice(cartTotal)}`}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav currentTab={activeTab} onTabChange={handleTabChange} />

      <AnimatePresence>
        {selectedProduct && (
          <ProductModal
            key={selectedProduct.id}
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
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

const LoadMoreSentinel = ({ onVisible }: { onVisible: () => void }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onVisible();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [onVisible]);

  return <div ref={ref} className="h-6" />;
};
