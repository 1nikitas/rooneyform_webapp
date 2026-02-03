import React from 'react';
import { motion } from 'framer-motion';
import type { Product } from '../types';
import { Check, Plus } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { formatPrice } from '../utils/currency';
import { resolveAssetUrl } from '../utils/assets';

interface ProductCardProps {
    product: Product;
    onClick: () => void;
    onAdd: (e: React.MouseEvent) => void;
    inCart?: boolean;
    enableSharedLayout?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
    product,
    onClick,
    onAdd,
    inCart = false,
    enableSharedLayout = true,
}) => {
    const coverImage = product.gallery?.[0] || product.image_url;
    const { isDark } = useTheme();
    const shouldAnimate = enableSharedLayout;

    return (
        <motion.article
            layoutId={shouldAnimate ? `card-${product.id}` : undefined}
            onClick={onClick}
            className={`
                relative overflow-hidden rounded-2xl cursor-pointer
                ${isDark 
                    ? 'bg-[#1a1a1d] border border-white/[0.06]' 
                    : 'bg-white border border-black/[0.04]'
                }
                shadow-card hover:shadow-card-hover
                transition-shadow duration-300
            `}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
            {/* Image Container */}
            <div className={`
                relative aspect-[3/4] overflow-hidden
                ${isDark ? 'bg-[#0f0f11]' : 'bg-gray-50'}
            `}>
                <motion.img
                    layoutId={shouldAnimate ? `image-${product.id}` : undefined}
                    src={resolveAssetUrl(coverImage)}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent" />
                
                {/* Size badge */}
                {product.size && (
                    <div className={`
                        absolute top-3 left-3 
                        px-2.5 py-1 rounded-lg
                        text-[11px] font-semibold uppercase tracking-wide
                        ${isDark 
                            ? 'bg-black/40 text-white/90 backdrop-blur-sm' 
                            : 'bg-white/90 text-gray-700 shadow-sm backdrop-blur-sm'
                        }
                    `}>
                        {product.size}
                    </div>
                )}
                
                {/* Add to cart button */}
                <motion.button
                    onClick={onAdd}
                    disabled={inCart}
                    className={`
                        absolute top-3 right-3
                        w-10 h-10 rounded-xl
                        flex items-center justify-center
                        transition-all duration-200
                        tap-target
                        ${inCart
                            ? 'bg-tg-success/20 text-tg-success cursor-default backdrop-blur-sm'
                            : isDark
                                ? 'bg-white/15 text-white hover:bg-white/25 active:bg-white/30 backdrop-blur-sm'
                                : 'bg-white/90 text-gray-700 hover:bg-white active:bg-gray-100 shadow-sm backdrop-blur-sm'
                        }
                    `}
                    whileTap={inCart ? undefined : { scale: 0.9 }}
                    aria-label={inCart ? 'В корзине' : 'Добавить в корзину'}
                >
                    {inCart ? (
                        <Check size={18} strokeWidth={2.5} />
                    ) : (
                        <Plus size={18} strokeWidth={2.5} />
                    )}
                </motion.button>
                
                {/* Bottom content */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                    <motion.h3 
                        layoutId={shouldAnimate ? `title-${product.id}` : undefined}
                        className="text-white font-semibold text-sm leading-tight line-clamp-2"
                    >
                        {product.name}
                    </motion.h3>
                    
                    <div className="flex items-center justify-between mt-2">
                        <motion.span 
                            layoutId={shouldAnimate ? `price-${product.id}` : undefined}
                            className="text-white/90 text-sm font-bold"
                        >
                            {formatPrice(product.price)}
                        </motion.span>
                        
                        {product.team && (
                            <span className="text-white/60 text-xs truncate max-w-[50%]">
                                {product.team}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.article>
    );
};
