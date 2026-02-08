import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product } from '../types';
import { Heart, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper/types';
import 'swiper/css';
import 'swiper/css/zoom';
import { Zoom } from 'swiper/modules';
import WebApp from '@twa-dev/sdk';
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
    const [fullscreenSwiperRef, setFullscreenSwiperRef] = useState<SwiperType | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { showToast } = useToast();

    // Lock body scroll when modal is open
    useEffect(() => {
        if (product) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = '';
            };
        }
    }, [product]);

    const closeFullscreen = useCallback(() => setIsFullscreen(false), []);

    // Telegram back button handling
    useEffect(() => {
        if (!product) return;
        const handleBack = () => {
            if (isFullscreen) {
                closeFullscreen();
            } else {
                onClose();
            }
        };
        try {
            WebApp.BackButton.show();
            WebApp.BackButton.onClick(handleBack);
        } catch {
            // Ignore if not in Telegram
        }
        return () => {
            try {
                WebApp.BackButton.offClick(handleBack);
                WebApp.BackButton.hide();
            } catch {
                // Ignore
            }
        };
    }, [product, isFullscreen, onClose, closeFullscreen]);

    // Close fullscreen on Escape key
    useEffect(() => {
        if (!isFullscreen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeFullscreen();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isFullscreen, closeFullscreen]);

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
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 140 }}
                        dragElastic={0.2}
                        onDragEnd={(_, info) => {
                            if (info.offset.y > 120 || info.velocity.y > 800) {
                                onClose();
                            }
                        }}
                        className={`
                            fixed inset-x-0 bottom-0 z-[60]
                            h-[92vh] overflow-hidden
                            rounded-t-3xl
                            flex flex-col
                            bg-[var(--tg-surface-1)] border-t border-[var(--tg-border-subtle)]
                        `}
                    >
                        {/* Image Gallery */}
                        <div className="relative flex-shrink-0 bg-[var(--tg-surface-2)]" style={{ height: '50vh', maxHeight: '420px' }}>
                            <Swiper
                                onSwiper={setSwiperRef}
                                onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                                observer
                                observeParents
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
                                                fetchPriority={idx === 0 ? 'high' : 'auto'}
                                                className="h-full w-full object-cover"
                                            />
                                        </button>
                                    </SwiperSlide>
                                ))}
                            </Swiper>

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
                                                    ? 'w-6 bg-white/80' 
                                                    : 'w-1.5 bg-white/30'
                                                }
                                            `}
                                            aria-label={`Фото ${idx + 1}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div
                            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 pb-safe"
                            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                        >
                            {/* Title & Price */}
                            <div className="flex justify-between items-start gap-4 mb-4">
                                <div className="flex-1 min-w-0">
                                <h2 className="text-lg font-semibold text-tg-text leading-tight tracking-tight">
                                    {product.name}
                                </h2>
                                {product.team && (
                                    <p className="text-sm text-tg-hint mt-1">
                                        {product.team}
                                    </p>
                                )}
                            </div>
                            <span className="text-lg font-semibold text-tg-text flex-shrink-0 tracking-tight">
                                {formatPrice(product.price)}
                            </span>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mb-5">
                            {product.size && (
                                <span className="px-3 py-1.5 rounded-lg text-sm font-medium surface-soft text-tg-text">
                                    Размер: {product.size}
                                </span>
                            )}
                            {product.league && (
                                <span className="px-3 py-1.5 rounded-lg text-sm font-medium surface-soft text-tg-text">
                                    {product.league}
                                </span>
                            )}
                            {product.brand && (
                                <span className="px-3 py-1.5 rounded-lg text-sm font-medium surface-soft text-tg-text">
                                    {product.brand}
                                </span>
                            )}
                            {product.season && (
                                <span className="px-3 py-1.5 rounded-lg text-sm font-medium surface-soft text-tg-text">
                                    {product.season}
                                </span>
                            )}
                            {product.kit_type && (
                                <span className="px-3 py-1.5 rounded-lg text-sm font-medium surface-soft text-tg-text">
                                    {product.kit_type}
                                </span>
                            )}
                        </div>

                            {/* Description */}
                            <p className="text-sm text-tg-hint leading-relaxed">
                                {product.description || 'Аутентичная винтажная футболка. Коллекционный экземпляр с оригинальной символикой клуба.'}
                            </p>
                        </div>

                        {/* Bottom Actions - Fixed */}
                        <div
                            className={`
                                flex-shrink-0 p-4 pb-6
                                bg-[var(--tg-surface-1)] border-t border-[var(--tg-border-subtle)]
                            `}
                            style={{ paddingBottom: 'calc(var(--safe-area-bottom-effective) + 18px)' }}
                        >
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
                                            ? 'badge-contrast'
                                            : 'icon-button'
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
                                            ? 'btn-secondary text-tg-text cursor-default'
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
                    {isFullscreen && (
                        <div className="fixed inset-0 z-[80] bg-black flex flex-col">
                            {/* Image area */}
                            <div className="flex-1 flex items-center justify-center relative min-h-0 px-4">
                                {/* Navigation arrows */}
                                {hasMultipleImages && (
                                    <>
                                        <button
                                            onClick={() => fullscreenSwiperRef?.slidePrev()}
                                            className="absolute left-2 z-10 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center tap-target"
                                            aria-label="Предыдущее фото"
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <button
                                            onClick={() => fullscreenSwiperRef?.slideNext()}
                                            className="absolute right-2 z-10 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center tap-target"
                                            aria-label="Следующее фото"
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </>
                                )}

                                <Swiper
                                    onSwiper={setFullscreenSwiperRef}
                                    onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                                    initialSlide={activeIndex}
                                    zoom
                                    modules={[Zoom]}
                                    className="h-full w-full"
                                >
                                    {images.map((image, idx) => (
                                        <SwiperSlide key={`fullscreen-${image}-${idx}`}>
                                            <div className="h-full w-full flex items-center justify-center">
                                                <div className="swiper-zoom-container h-full w-full flex items-center justify-center">
                                                    <img
                                                        src={resolveAssetUrl(image)}
                                                        alt={`${product.name} ${idx + 1}`}
                                                        className="max-h-full max-w-full object-contain"
                                                        draggable={false}
                                                    />
                                                </div>
                                            </div>
                                        </SwiperSlide>
                                    ))}
                                </Swiper>
                            </div>

                            {/* Count + Thumbnail dots */}
                            {hasMultipleImages && (
                                <div className="flex-shrink-0 flex flex-col items-center gap-2 py-4">
                                    <span className="text-[12px] uppercase tracking-[0.25em] text-white/60 font-medium">
                                        {activeIndex + 1} / {images.length}
                                    </span>
                                    <div className="flex justify-center gap-2">
                                        {images.map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => fullscreenSwiperRef?.slideTo(idx)}
                                                className={`
                                                    rounded-full transition-all duration-200
                                                    ${activeIndex === idx 
                                                        ? 'w-7 h-2 bg-white' 
                                                        : 'w-2 h-2 bg-white/30'
                                                    }
                                                `}
                                                aria-label={`Фото ${idx + 1}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </AnimatePresence>
    );
};
