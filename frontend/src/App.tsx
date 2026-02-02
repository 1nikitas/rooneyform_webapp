import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from './components/Layout';
import { ProductCard } from './components/ProductCard';
import { BottomNav } from './components/BottomNav';
import { ProductModal } from './components/ProductModal';
import { useStore } from './store/useStore';
import type { Product } from './types';
import apiClient from './api/client';
import { Search, Loader2, Sun, Moon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import { formatPrice } from './utils/currency';
import { useTheme } from './context/ThemeContext';
import logoDark from './assets/logo_dark.png';
import logoLight from './assets/logo_white.png';
import { resolveAssetUrl } from './utils/assets';
import { SlidingNumber } from './components/animate-ui/primitives/texts/sliding-number';
import { GradientText } from './components/animate-ui/primitives/texts/gradient-text';
import { ShimmeringText } from './components/animate-ui/primitives/texts/shimmering-text';
import { HighlightText } from './components/animate-ui/primitives/texts/highlight-text';
import { RippleButton, RippleButtonRipples } from './components/animate-ui/primitives/buttons/ripple-button';

const TAB_ORDER = ['home', 'cart', 'favorites'] as const;

const tabVariants = {
  enter: (direction: number) => ({
    x: direction >= 0 ? 25 : -25,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? -25 : 25,
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
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [catalogFilter, setCatalogFilter] = useState<'jerseys' | 'posters'>('jerseys');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [sortOption, setSortOption] = useState<'default' | 'price-asc' | 'price-desc' | 'name-asc'>('default');
  const highlightStyle = {
    backgroundImage: isDark
      ? 'linear-gradient(120deg, rgba(59,130,246,0.35), rgba(236,72,153,0.35))'
      : 'linear-gradient(120deg, rgba(59,130,246,0.2), rgba(236,72,153,0.25))',
    borderRadius: '999px',
    padding: '2px 10px',
  };
  
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
      if (q) params.append('search', q);
      if (categorySlug) params.append('category_slug', categorySlug);
      const res = await apiClient.get(`/products/?${params.toString()}`, {
        signal: controller.signal,
      });
      if (requestId !== fetchRequestId.current) {
        return;
      }
      const payload = res.data as unknown;
      if (Array.isArray(payload)) {
        setProducts(payload);
        return;
      }
      if (payload && typeof payload === 'object') {
        const maybeList =
          Array.isArray((payload as { results?: Product[] }).results)
            ? (payload as { results: Product[] }).results
            : Array.isArray((payload as { items?: Product[] }).items)
              ? (payload as { items: Product[] }).items
              : Array.isArray((payload as { data?: Product[] }).data)
                ? (payload as { data: Product[] }).data
                : null;
        if (maybeList) {
          setProducts(maybeList);
          return;
        }
      }
      setProducts([]);
    } catch (e) {
      if (controller.signal.aborted) {
        return;
      }
      console.error(e);
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    fetchCart();
    fetchFavorites();
    fetchProducts('', catalogCategory);
  }, [fetchCart, fetchFavorites, fetchProducts, catalogCategory]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProducts(searchQuery, catalogCategory);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, fetchProducts, catalogCategory]);

  useEffect(() => {
    const photoUrl = WebApp.initDataUnsafe?.user?.photo_url || null;
    setUserPhoto(photoUrl);
  }, []);

  const handleTabChange = (tab: string) => {
    if (tab === activeTab) return;
    const currentIndex = TAB_ORDER.indexOf(activeTab as typeof TAB_ORDER[number]);
    const nextIndex = TAB_ORDER.indexOf(tab as typeof TAB_ORDER[number]);
    if (currentIndex === -1 || nextIndex === -1) {
      setDirection(0);
    } else {
      setDirection(nextIndex > currentIndex ? 1 : -1);
    }
    setActiveTab(tab);
  };

  const avatarNode = useMemo(() => (
    <div className={`w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm ${
      theme === 'dark' ? 'border border-white/10' : 'border border-gray-200'
    }`}>
      {userPhoto ? (
        <img
          src={userPhoto}
          alt="Аватар Telegram"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full" />
      )}
    </div>
  ), [userPhoto, theme]);

  const sizeOptions = useMemo(() => {
    const sizes = new Set<string>();
    for (const product of products) {
      if (product.size) {
        sizes.add(product.size.trim().toUpperCase());
      }
    }
    const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    return Array.from(sizes).sort((a, b) => {
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);
      if (aIndex === -1 && bIndex === -1) {
        return a.localeCompare(b);
      }
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (catalogFilter === 'jerseys') {
      list = list.filter((product) => product.category?.slug !== 'posters');
    }
    if (catalogFilter === 'jerseys' && sizeFilter !== 'all') {
      list = list.filter((product) => product.size?.trim().toUpperCase() === sizeFilter);
    }
    if (sortOption === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortOption === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortOption === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [products, sizeFilter, sortOption, catalogFilter]);

  const notifyUser = (message: string) => {
    if (typeof WebApp?.showAlert === 'function') {
      WebApp.showAlert(message);
    } else {
      alert(message);
    }
  };

  const handleCheckout = async () => {
    if (isCheckoutLoading || cart.length === 0) return;
    setIsCheckoutLoading(true);
    try {
      const res = await apiClient.post('/orders/');
      await fetchCart();
      const orderId = (res.data as { id?: number } | undefined)?.id;
      notifyUser(
        orderId
          ? `Заказ #${orderId} отправлен. Мы скоро свяжемся с вами.`
          : 'Заказ отправлен. Мы скоро свяжемся с вами.',
      );
    } catch (e) {
      console.error(e);
      notifyUser('Не удалось оформить заказ. Попробуйте еще раз.');
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [isDark]);

  const cartProductIds = useMemo(() => new Set(cart.map(item => item.product.id)), [cart]);
  const pendingCartSet = useMemo(() => new Set(pendingCartIds), [pendingCartIds]);

  const renderContent = () => {
    if (activeTab === 'home') {
      return (
        <div className="space-y-6">
          <header className="flex items-center mb-6 gap-3 relative z-10">
            <div className="flex-1 flex justify-start">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className={`w-11 h-11 rounded-full border flex items-center justify-center shadow-sm transition ${
                  isDark
                    ? 'border-white/20 text-white bg-white/10 hover:border-blue-300 hover:text-blue-200'
                    : 'border-gray-200 text-gray-700 bg-white hover:border-blue-400 hover:text-blue-500'
                }`}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
            <div className="flex-1 flex justify-center">
              {!logoFailed ? (
                <img
                  src={isDark ? logoLight : logoDark}
                  alt="RooneyForm"
                  className="h-9 w-auto select-none pointer-events-none"
                  draggable={false}
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span className="text-base font-semibold tracking-wide text-tg-text">
                  Rooneyform
                </span>
              )}
            </div>
            <div className="flex-1 flex justify-end">
              {avatarNode}
            </div>
          </header>

          <div className="space-y-6 tg-content-offset">
            {catalogFilter === 'jerseys' && (
              <div className="glass-card rounded-3xl p-4 relative overflow-hidden">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <ShimmeringText
                      text="Быстрый подбор"
                      className="text-[11px] uppercase tracking-[0.3em]"
                      color={isDark ? 'rgba(255,255,255,0.85)' : '#1f2937'}
                      shimmeringColor={isDark ? 'rgba(191,219,254,0.9)' : '#60a5fa'}
                    />
                    <p className="text-sm text-[var(--tg-theme-hint-color)]">
                      Подберите размер и сортировку под свой стиль.
                    </p>
                  </div>
                  <HighlightText
                    text={`${filteredProducts.length} в наличии`}
                    className={`text-[10px] uppercase tracking-[0.2em] ${isDark ? 'text-blue-100' : 'text-blue-700'}`}
                    style={highlightStyle}
                    inViewOnce
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSizeFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-wide transition ${
                      sizeFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : isDark
                          ? 'bg-white/10 text-white/80 hover:bg-white/20'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    Все размеры
                  </button>
                  {sizeOptions.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSizeFilter(size)}
                      className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-wide transition ${
                        sizeFilter === size
                          ? 'bg-blue-600 text-white'
                          : isDark
                            ? 'bg-white/10 text-white/80 hover:bg-white/20'
                            : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-xs uppercase tracking-[0.25em] text-[var(--tg-theme-hint-color)]">
                    Сортировка
                  </span>
                  <select
                    value={sortOption}
                    onChange={(event) => setSortOption(event.target.value as typeof sortOption)}
                    className={`flex-1 rounded-2xl px-3 py-2 text-sm outline-none ${
                      isDark
                        ? 'bg-white/10 text-white border border-white/10 focus:border-blue-300/60'
                        : 'bg-white text-gray-700 border border-gray-200 focus:border-blue-400'
                    }`}
                  >
                    <option value="default">По умолчанию</option>
                    <option value="price-asc">Сначала дешевле</option>
                    <option value="price-desc">Сначала дороже</option>
                    <option value="name-asc">По названию</option>
                  </select>
                </div>
              </div>
            )}

            <div className="relative">
              <Search className={`absolute left-3 top-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} size={20} />
              <input 
                type="text" 
                placeholder="Поиск винтажных футболок..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full rounded-2xl py-3 pl-10 pr-4 focus:outline-none focus:border-blue-500/50 transition-colors ${
                  isDark
                    ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500'
                    : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-500 shadow-sm'
                }`}
              />
            </div>

             {/* Carousel / Featured - Using first 3 products */}
            {!searchQuery && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-sm ${
                      catalogFilter === 'jerseys'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/10 text-[var(--tg-theme-text-color)]'
                    }`}
                    onClick={() => setCatalogFilter('jerseys')}
                  >
                    Футболки
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-sm ${
                      catalogFilter === 'posters'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/10 text-[var(--tg-theme-text-color)]'
                    }`}
                    onClick={() => setCatalogFilter('posters')}
                  >
                    Плакаты
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {filteredProducts.map(product => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  onClick={() => setSelectedProduct(product)}
                  onAdd={(e) => {
                    e.stopPropagation();
                    if (!cartProductIds.has(product.id) && !pendingCartSet.has(product.id)) {
                      addToCart(product.id);
                    }
                  }}
                  inCart={cartProductIds.has(product.id) || pendingCartSet.has(product.id)}
                />
              ))}
            </div>
            
            {filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Loader2 className="animate-spin mb-2" />
                <p>Не нашли позиции под текущие фильтры.</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'cart') {
      const total = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
      const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
      return (
        <div className="space-y-6 tg-content-offset">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--tg-theme-hint-color)]">Всего позиций</p>
              <h2 className="text-2xl font-bold text-[var(--tg-theme-text-color)]">{cartCount}</h2>
            </div>
            {cart.length > 0 && (
              <div className="px-4 py-2 rounded-2xl bg-blue-50 text-blue-600 text-sm font-semibold">
                {formatPrice(total)}
              </div>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="glass-card rounded-2xl px-6 py-16 text-center text-gray-500">
              <ShimmeringText
                text="Корзина пустует"
                className="text-sm"
                color={isDark ? 'rgba(255,255,255,0.7)' : '#6b7280'}
                shimmeringColor={isDark ? 'rgba(191,219,254,0.8)' : '#93c5fd'}
              />
              <p className="mt-2 text-sm">Добавьте футболки из каталога!</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {cart.map((item) => {
                  const coverImage = item.product.gallery?.[0] || item.product.image_url;
                  const src = resolveAssetUrl(coverImage);
                  return (
                    <div
                      key={item.id}
                      className="glass-card p-4 rounded-2xl flex items-center gap-4 shadow-lg"
                    >
                      <div className={`w-24 h-24 rounded-2xl overflow-hidden shrink-0 ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
                        <img src={src} alt={item.product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <h3 className="font-semibold text-[var(--tg-theme-text-color)]">{item.product.name}</h3>
                          <span className="text-sm text-blue-500 font-semibold">{formatPrice(item.product.price)}</span>
                        </div>
                        <p className="text-xs text-[var(--tg-theme-hint-color)]">{item.product.team}</p>
                        <div className="flex justify-between items-center mt-3">
                          <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-600'}`}>
                            Размер: {item.product.size} • Кол-во: {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="text-xs text-red-500 hover:text-red-600"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="glass-card rounded-2xl p-5 space-y-4">
                <div className="flex justify-between text-sm text-[var(--tg-theme-hint-color)]">
                  <span>Товары</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold text-[var(--tg-theme-text-color)]">
                  <HighlightText
                    text="Итого"
                    className="text-[15px] font-semibold"
                    style={highlightStyle}
                    inViewOnce
                  />
                  <span className="inline-flex items-baseline gap-1">
                    <SlidingNumber number={total} thousandSeparator=" " decimalPlaces={0} />
                    <span className="text-xs font-semibold">₽</span>
                  </span>
                </div>
                <RippleButton asChild hoverScale={1.02} tapScale={0.98}>
                  <button
                    type="button"
                    className={`w-full py-3 bg-blue-600 text-white rounded-2xl font-semibold active:scale-95 transition-transform ${
                      isCheckoutLoading ? 'opacity-70 cursor-wait' : ''
                    }`}
                    onClick={handleCheckout}
                    disabled={isCheckoutLoading}
                  >
                    {isCheckoutLoading ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin" size={18} />
                        Оформляем...
                      </span>
                    ) : (
                      'Оформить заказ'
                    )}
                    <RippleButtonRipples color="rgba(255,255,255,0.45)" />
                  </button>
                </RippleButton>
              </div>
            </>
          )}
        </div>
      );
    }

    if (activeTab === 'favorites') {
      return (
         <div className="space-y-4 tg-content-offset">
            <div className="mb-6">
              <GradientText text="Избранное" className="text-2xl font-bold" neon={!isDark} />
            </div>
            {favorites.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                  <ShimmeringText
                    text="Список избранного пуст"
                    className="text-sm"
                    color={isDark ? 'rgba(255,255,255,0.7)' : '#6b7280'}
                    shimmeringColor={isDark ? 'rgba(191,219,254,0.8)' : '#93c5fd'}
                  />
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    {favorites.map(fav => (
                        <ProductCard 
                            key={fav.product.id} 
                            product={fav.product} 
                            onClick={() => setSelectedProduct(fav.product)}
                            onAdd={(e) => {
                                e.stopPropagation();
                                if (!cartProductIds.has(fav.product.id) && !pendingCartSet.has(fav.product.id)) {
                                  addToCart(fav.product.id);
                                }
                            }}
                            inCart={cartProductIds.has(fav.product.id) || pendingCartSet.has(fav.product.id)}
                        />
                    ))}
                </div>
            )}
        </div>
      );
    }
  };

  return (
    <Layout>
      <div className="relative min-h-[70vh] overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={tabVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
      
      <BottomNav currentTab={activeTab} onTabChange={handleTabChange} />
      
      <AnimatePresence>
        {selectedProduct && (
          <ProductModal 
            product={selectedProduct} 
            onClose={() => setSelectedProduct(null)} 
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}

export default App;
