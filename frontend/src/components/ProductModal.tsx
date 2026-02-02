import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product } from '../types';
import { X, Heart, ShoppingCart } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Thumbs } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper/types';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/thumbs';
import { useTheme } from '../context/ThemeContext';
import { formatPrice } from '../utils/currency';
import { resolveAssetUrl } from '../utils/assets';
import { RippleButton, RippleButtonRipples } from './animate-ui/primitives/buttons/ripple-button';
import { ShimmeringText } from './animate-ui/primitives/texts/shimmering-text';

interface ProductModalProps {
    product: Product | null;
    onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ product, onClose }) => {
    const { addToCart, toggleFavorite, favorites } = useStore();
    const [activeIndex, setActiveIndex] = useState(0);
    const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { theme } = useTheme();

    if (!product) return null;

    const isLiked = favorites.some(f => f.product.id === product.id);
    const images = product.gallery?.length ? product.gallery : [product.image_url];

    useEffect(() => {
        setActiveIndex(0);
    }, [product?.id]);

    return (
        <AnimatePresence>
            {product && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
                    />
                    <motion.div
                        layoutId={`card-${product.id}`}
                        className="fixed inset-x-0 bottom-0 bg-tg-secondaryBg text-tg-text rounded-t-[30px] overflow-hidden z-[60] flex flex-col shadow-2xl tg-modal-sheet"
                    >
                        <div className={`relative h-1/2 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
                            <Swiper
                                modules={[Navigation, Thumbs]}
                                spaceBetween={12}
                                navigation={images.length > 1}
                                thumbs={{ swiper: thumbsSwiper }}
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
                                                alt={product.name}
                                                className="h-full w-full object-cover"
                                            />
                                        </button>
                                    </SwiperSlide>
                                ))}
                            </Swiper>

                            {images.length > 1 && (
                                <div className="absolute bottom-4 inset-x-0 px-6">
                                    <Swiper
                                        onSwiper={setThumbsSwiper}
                                        modules={[Thumbs]}
                                        watchSlidesProgress
                                        slidesPerView={Math.min(images.length, 5)}
                                        spaceBetween={8}
                                        className="[&_.swiper-slide]:cursor-pointer"
                                    >
                                        {images.map((image, idx) => (
                                            <SwiperSlide key={`${image}-thumb`}>
                                                <div
                                                className={`h-16 rounded-2xl overflow-hidden border transition-all ${
                                                        activeIndex === idx
                                                            ? 'border-blue-500/70 bg-white/70'
                                                            : theme === 'dark'
                                                                ? 'border-white/10 bg-black/30'
                                                                : 'border-gray-200 bg-white/70'
                                                    }`}
                                                >
                                                    <img
                                                        src={resolveAssetUrl(image)}
                                                        alt={`${product.name} ${idx + 1}`}
                                                        className="w-full h-full object-contain p-2"
                                                    />
                                                </div>
                                            </SwiperSlide>
                                        ))}
                                    </Swiper>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }}
                                className="absolute top-4 right-4 z-20 bg-black/30 backdrop-blur-md p-2 rounded-full text-white"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 p-6 flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <motion.h2 layoutId={`title-${product.id}`} className="text-2xl font-bold mb-1 text-tg-text">
                                        {product.name}
                                    </motion.h2>
                                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}>{product.team}</p>
                                </div>
                                <motion.p layoutId={`price-${product.id}`} className="text-xl font-semibold text-blue-500">
                                    {formatPrice(product.price)}
                                </motion.p>
                            </div>

                            <div className="mb-6 flex space-x-2">
                                <span className={`px-3 py-1 text-sm rounded-lg ${theme === 'dark' ? 'bg-white/10 text-gray-200' : 'bg-gray-100 text-gray-600'}`}>
                                    Размер: {product.size}
                                </span>
                                <span className={`px-3 py-1 text-sm rounded-lg ${theme === 'dark' ? 'bg-white/10 text-gray-200' : 'bg-gray-100 text-gray-600'}`}>
                                    <ShimmeringText
                                        text="Оригинал"
                                        className="text-sm"
                                        color={theme === 'dark' ? 'rgba(255,255,255,0.75)' : '#4b5563'}
                                        shimmeringColor={theme === 'dark' ? 'rgba(191,219,254,0.85)' : '#93c5fd'}
                                    />
                                </span>
                            </div>

                            <p className={`text-sm leading-relaxed mb-auto ${theme === 'dark' ? 'text-gray-200' : 'text-gray-600'}`}>
                                {product.description || 'Аутентичная винтажная футболка. Коллекционный экземпляр с оригинальной символикой.'}
                            </p>

                            <div className="mt-6 grid grid-cols-4 gap-4">
                                <button 
                                    onClick={() => toggleFavorite(product.id)}
                                    className={`col-span-1 py-3.5 rounded-xl flex items-center justify-center transition-colors ${isLiked ? 'bg-red-500/10 text-red-500' : theme === 'dark' ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-500'}`}
                                >
                                    <Heart size={24} fill={isLiked ? "currentColor" : "none"} />
                                </button>
                                <RippleButton asChild hoverScale={1.02} tapScale={0.97}>
                                    <button 
                                        onClick={() => {
                                            addToCart(product.id);
                                            onClose();
                                        }}
                                        className="col-span-3 py-3.5 bg-blue-600 rounded-xl text-white font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                    >
                                        <ShoppingCart size={20} />
                                        Добавить в корзину
                                        <RippleButtonRipples color="rgba(255,255,255,0.4)" />
                                    </button>
                                </RippleButton>
                            </div>
                        </div>
                    </motion.div>

                    <AnimatePresence>
                        {isFullscreen && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/90 z-[80] flex flex-col"
                            >
                                <div className="flex justify-end p-4 tg-fullscreen-top">
                                    <button
                                        type="button"
                                        onClick={() => setIsFullscreen(false)}
                                        className="text-white bg-black/40 rounded-full p-2"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>
                                <Swiper
                                    modules={[Navigation]}
                                    navigation
                                    initialSlide={activeIndex}
                                    onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                                    className="flex-1 w-full"
                                >
                                    {images.map((image) => (
                                        <SwiperSlide key={`${image}-fullscreen`}>
                                            <div className="h-full w-full flex items-center justify-center">
                                                <img
                                                    src={resolveAssetUrl(image)}
                                                    alt={product.name}
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
