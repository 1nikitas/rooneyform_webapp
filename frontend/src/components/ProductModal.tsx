import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product } from '../types';
import { X, Heart, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper/types';
import 'swiper/css';
import 'swiper/css/navigation';
import { useTheme } from '../context/ThemeContext';
import { formatPrice } from '../utils/currency';
import { resolveAssetUrl } from '../utils/assets';
import { useToast } from './Toast';
import haptics from '../utils/haptics';

interface ProductModalProps {
    product: Product | null;
    onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ product, onClose }) => {
    const { addToCart, toggleFavorite, favorites, cart, pendingCartIds } = useStore();
    const [activeIndex, setActiveIndex] = useState(0);
    const [swiperRef, setSwiperRef] = useState<SwiperType | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { isDark } = useTheme();
    const { showToast } = useToast();

    useEffect(() => {
        setActiveIndex(0);
    }, [product?.id]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (product) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = '';
            };
        }
    }, [product]);

    if (!product) return null;

    const isLiked = favorites.some(f => f.product.id === product.id);
    const images = product.gallery?.length ? product.gallery : [product.image_url];
    const inCart = cart.some(item => item.product.id === product.id) || pendingCartIds.includes(product.id);
    const hasMultipleImages = images.length > 1;

    return (
        <AnimatePresence>
            {product && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal Sheet */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className={`
                            fixed inset-x-0 bottom-0 z-[60]
                            max-h-[92vh] overflow-hidden
                            rounded-t-3xl
                            flex flex-col
                            ${isDark ? 'bg-[#0f0f11]' : 'bg-white'}
                        `}
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className={`
                                absolute top-4 right-4 z-30
                                w-10 h-10 rounded-xl
                                flex items-center justify-center
                                tap-target
                                ${isDark 
                                    ? 'bg-white/10 text-white/80 hover:bg-white/15' 
                                    : 'bg-black/5 text-gray-600 hover:bg-black/10'
                                }
                                transition-colors
                            `}
                            aria-label="Закрыть"
                        >
                            <X size={20} />
                        </button>

                        {/* Image Gallery */}
                        <div className={`
                            relative aspect-square flex-shrink-0
                            ${isDark ? 'bg-[#18181b]' : 'bg-gray-50'}
                        `}>
                            <Swiper
                                modules={[Navigation]}
                                onSwiper={setSwiperRef}
                                onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                                className="h-full"
                            >
                                {images.map((image, idx) => (
                                    <SwiperSlide key={image}>
                                        <button
                                            type="button"
                                            className="h-full w-full flex items-center justify-center focus:outline-none"
                                            onClick={() => {
                                                setActiveIndex(idx);
                                                setIsFullscreen(true);
                                            }}
                                        >
                                            <img
                                                src={resolveAssetUrl(image)}
                                                alt={`${product.name} ${idx + 1}`}
                                                loading={idx === 0 ? 'eager' : 'lazy'}
                                                decoding="async"
                                                className="h-full w-full object-contain"
                                            />
                                        </button>
                                    </SwiperSlide>
                                ))}
                            </Swiper>

                            {/* Navigation arrows */}
                            {hasMultipleImages && (
                                <>
                                    <button
                                        onClick={() => {
                                            haptics.tap();
                                            swiperRef?.slidePrev();
                                        }}
                                        className={`
                                            absolute left-3 top-1/2 -translate-y-1/2 z-20
                                            w-10 h-10 rounded-xl
                                            flex items-center justify-center
                                            transition-all tap-target
                                            ${activeIndex === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                                            ${isDark 
                                                ? 'bg-white/10 text-white hover:bg-white/20' 
                                                : 'bg-white/90 text-gray-700 shadow-md hover:bg-white'
                                            }
                                        `}
                                        aria-label="Предыдущее фото"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            haptics.tap();
                                            swiperRef?.slideNext();
                                        }}
                                        className={`
                                            absolute right-3 top-1/2 -translate-y-1/2 z-20
                                            w-10 h-10 rounded-xl
                                            flex items-center justify-center
                                            transition-all tap-target
                                            ${activeIndex === images.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                                            ${isDark 
                                                ? 'bg-white/10 text-white hover:bg-white/20' 
                                                : 'bg-white/90 text-gray-700 shadow-md hover:bg-white'
                                            }
                                        `}
                                        aria-label="Следующее фото"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </>
                            )}

                            {/* Pagination dots */}
                            {hasMultipleImages && (
                                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20">
                                    {images.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => swiperRef?.slideTo(idx)}
                                            className={`
                                                h-1.5 rounded-full transition-all duration-200
                                                ${activeIndex === idx 
                                                    ? 'w-6 bg-tg-accent' 
                                                    : `w-1.5 ${isDark ? 'bg-white/30' : 'bg-black/20'}`
                                                }
                                            `}
                                            aria-label={`Фото ${idx + 1}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto overscroll-contain p-5 pb-safe-bottom">
                            {/* Title & Price */}
                            <div className="flex justify-between items-start gap-4 mb-4">
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-xl font-bold text-tg-text leading-tight">
                                        {product.name}
                                    </h2>
                                    {product.team && (
                                        <p className="text-sm text-tg-hint mt-1">
                                            {product.team}
                                        </p>
                                    )}
                                </div>
                                <span className="text-xl font-bold text-tg-accent flex-shrink-0">
                                    {formatPrice(product.price)}
                                </span>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-2 mb-5">
                                {product.size && (
                                    <span className={`
                                        px-3 py-1.5 rounded-lg text-sm font-medium
                                        ${isDark ? 'bg-white/[0.06] text-white/80' : 'bg-gray-100 text-gray-600'}
                                    `}>
                                        Размер: {product.size}
                                    </span>
                                )}
                                <span className={`
                                    px-3 py-1.5 rounded-lg text-sm font-medium
                                    ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}
                                `}>
                                    Оригинал
                                </span>
                            </div>

                            {/* Description */}
                            <p className="text-sm text-tg-hint leading-relaxed">
                                {product.description || 'Аутентичная винтажная футболка. Коллекционный экземпляр с оригинальной символикой клуба.'}
                            </p>
                        </div>

                        {/* Bottom Actions - Fixed */}
                        <div className={`
                            flex-shrink-0 p-4 pb-6
                            ${isDark 
                                ? 'bg-[#0f0f11] border-t border-white/[0.06]' 
                                : 'bg-white border-t border-black/[0.04]'
                            }
                        `}>
                            <div className="flex gap-3">
                                {/* Favorite button */}
                                <motion.button
                                    onClick={() => {
                                        haptics.button();
                                        toggleFavorite(product.id);
                                        if (isLiked) {
                                            showToast('info', 'Удалено из избранного');
                                        } else {
                                            haptics.success();
                                            showToast('success', 'Добавлено в избранное');
                                        }
                                    }}
                                    className={`
                                        w-14 h-14 rounded-xl flex items-center justify-center
                                        transition-colors tap-target
                                        ${isLiked
                                            ? 'bg-red-500/15 text-red-500'
                                            : isDark
                                                ? 'bg-white/[0.06] text-white/60 hover:bg-white/[0.08]'
                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }
                                    `}
                                    whileTap={{ scale: 0.92 }}
                                    aria-label={isLiked ? 'Удалить из избранного' : 'Добавить в избранное'}
                                >
                                    <Heart size={22} fill={isLiked ? 'currentColor' : 'none'} />
                                </motion.button>

                                {/* Add to cart button */}
                                <motion.button
                                    onClick={async () => {
                                        if (!inCart) {
                                            haptics.button();
                                            const ok = await addToCart(product.id);
                                            if (ok) {
                                                haptics.success();
                                                showToast('cart', `${product.name} добавлен в корзину`);
                                                onClose();
                                            } else {
                                                haptics.error();
                                            }
                                        }
                                    }}
                                    disabled={inCart}
                                    className={`
                                        flex-1 h-14 rounded-xl font-semibold
                                        flex items-center justify-center gap-2
                                        transition-all tap-target
                                        ${inCart
                                            ? isDark
                                                ? 'bg-tg-success/20 text-tg-success cursor-default'
                                                : 'bg-emerald-50 text-emerald-600 cursor-default'
                                            : 'btn-primary'
                                        }
                                    `}
                                    whileTap={inCart ? undefined : { scale: 0.98 }}
                                >
                                    <ShoppingCart size={20} />
                                    {inCart ? 'В корзине' : 'Добавить'}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Fullscreen Gallery */}
                    <AnimatePresence>
                        {isFullscreen && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black z-[80] flex flex-col"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-center p-4 pt-safe-top">
                                    <span className="text-white/60 text-sm">
                                        {activeIndex + 1} / {images.length}
                                    </span>
                                    <button
                                        onClick={() => setIsFullscreen(false)}
                                        className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center tap-target"
                                        aria-label="Закрыть"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Image */}
                                <Swiper
                                    modules={[Navigation]}
                                    navigation
                                    initialSlide={activeIndex}
                                    onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                                    className="flex-1 w-full"
                                >
                                    {images.map((image) => (
                                        <SwiperSlide key={`${image}-fullscreen`}>
                                            <div className="h-full w-full flex items-center justify-center p-4">
                                                <img
                                                    src={resolveAssetUrl(image)}
                                                    alt={product.name}
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="max-h-full max-w-full object-contain"
                                                />
                                            </div>
                                        </SwiperSlide>
                                    ))}
                                </Swiper>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </AnimatePresence>
    );
};
