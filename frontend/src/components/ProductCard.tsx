import React from 'react';
import { motion } from 'framer-motion';
import type { Product } from '../types';
import { Check, Plus, Heart } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { formatPrice } from '../utils/currency';
import { resolveAssetUrl } from '../utils/assets';
import { OptimizedImage } from './OptimizedImage';

interface ProductCardProps {
    product: Product;
    onClick: () => void;
    onAdd: (e: React.MouseEvent) => void;
    inCart?: boolean;
    isFavorite?: boolean;
    onToggleFavorite?: (e: React.MouseEvent) => void;
    enableSharedLayout?: boolean;
    imageLoading?: 'lazy' | 'eager';
    imageFetchPriority?: 'high' | 'low' | 'auto';
}

export const ProductCard: React.FC<ProductCardProps> = ({
    product,
    onClick,
    onAdd,
    inCart = false,
    isFavorite = false,
    onToggleFavorite,
    enableSharedLayout = true,
    imageLoading = 'lazy',
    imageFetchPriority = 'auto',
}) => {
    const coverImage = product.gallery?.[0] || product.image_url;
    const { isDark } = useTheme();
    const shouldAnimate = enableSharedLayout;

    // Show league or brand in the corner badge (issue #11)
    const cornerLabel = product.league || product.brand || '';

    return (
        <motion.article
            layoutId={shouldAnimate ? `card-${product.id}` : undefined}
            onClick={onClick}
            className="relative overflow-hidden rounded-2xl cursor-pointer surface-card transition-all duration-300 will-change-transform hover:-translate-y-0.5 hover:shadow-md"
            whileTap={{ scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
            {/* Image Container - more rectangular aspect ratio (3:4) */}
            <div className="relative aspect-[3/4] overflow-hidden bg-[var(--tg-surface-2)]">
                <OptimizedImage
                    src={resolveAssetUrl(coverImage)}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading={imageLoading}
                    fetchPriority={imageFetchPriority}
                />
                
                {/* Subtle gradient only at the very bottom */}
                <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                
                {/* Size badge */}
                {product.size && (
                    <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wide leading-none bg-black/55 text-white backdrop-blur-md border border-white/15 shadow-[0_4px_14px_rgba(0,0,0,0.35)]">
                        {product.size}
                    </div>
                )}
                
                {/* Quick actions (favorite + add to cart) */}
                <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end">
                    {/* Favorite button */}
                    {onToggleFavorite && (
                        <motion.button
                            onClick={onToggleFavorite}
                            className={`
                                w-7 h-7 rounded-lg
                                flex items-center justify-center
                                transition-all duration-200 shadow-md
                                ${isFavorite
                                    ? 'bg-white/90 text-black backdrop-blur-sm'
                                    : isDark
                                        ? 'bg-white/10 text-white hover:bg-white/16 active:bg-white/22 backdrop-blur-md border border-white/15'
                                        : 'bg-black/35 text-white hover:bg-black/45 active:bg-black/55 backdrop-blur-md border border-white/15'
                                }
                            `}
                            whileTap={{ scale: 0.9 }}
                            aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                        >
                            <Heart size={14} strokeWidth={2.5} fill={isFavorite ? 'currentColor' : 'none'} />
                        </motion.button>
                    )}

                    {/* Add to cart button */}
                    <motion.button
                        onClick={onAdd}
                        disabled={inCart}
                        className={`
                            w-7 h-7 rounded-lg
                            flex items-center justify-center
                            transition-all duration-200 shadow-md
                            ${inCart
                                ? 'bg-white/90 text-black cursor-default backdrop-blur-sm'
                                : isDark
                                    ? 'bg-white/10 text-white hover:bg-white/16 active:bg-white/22 backdrop-blur-md border border-white/15'
                                    : 'bg-black/35 text-white hover:bg-black/45 active:bg-black/55 backdrop-blur-md border border-white/15'
                            }
                        `}
                        whileTap={inCart ? undefined : { scale: 0.9 }}
                        aria-label={inCart ? 'В корзине' : 'Добавить в корзину'}
                    >
                        {inCart ? (
                            <Check size={14} strokeWidth={2.5} />
                        ) : (
                            <Plus size={14} strokeWidth={2.5} />
                        )}
                    </motion.button>
                </div>
                
                {/* Bottom content - overlaps only the bottom edge of the jersey */}
                <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/50 backdrop-blur-lg px-3 py-2.5">
                    <motion.h3 
                        layoutId={shouldAnimate ? `title-${product.id}` : undefined}
                        className="text-white font-semibold text-[13px] leading-snug tracking-tight line-clamp-1"
                    >
                        {product.name}
                    </motion.h3>
                    
                    <div className="flex items-center justify-between mt-1 gap-2">
                        <motion.span 
                            layoutId={shouldAnimate ? `price-${product.id}` : undefined}
                            className="text-white text-[13px] font-semibold"
                        >
                            {formatPrice(product.price)}
                        </motion.span>
                        
                        {cornerLabel && (
                            <span className="text-white/60 text-[11px] font-medium truncate max-w-[55%] leading-none">
                                {cornerLabel}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.article>
    );
};
