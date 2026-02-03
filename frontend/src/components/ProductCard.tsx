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
                relative overflow-hidden rounded-3xl cursor-pointer
                ${isDark 
                    ? 'bg-[#151517] border border-white/[0.06]' 
                    : 'bg-white border border-black/[0.04]'
                }
                shadow-lg shadow-black/5 hover:shadow-xl hover:-translate-y-0.5
                transition-all duration-300 will-change-transform
            `}
            whileTap={{ scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
            {/* Image Container */}
            <div className={`
                relative aspect-[4/5] overflow-hidden
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/30 to-black/0" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,0,0,0.25),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(0,0,0,0.2),transparent_32%)]" />
                
                {/* Size badge */}
                {product.size && (
                    <div className={`
                        absolute top-3 left-3 
                        px-3 py-1.5 rounded-full
                        text-[11px] font-semibold uppercase tracking-wide leading-none
                        ${isDark 
                            ? 'bg-white/10 text-white/90 backdrop-blur-md border border-white/15 shadow-[0_4px_14px_rgba(0,0,0,0.4)]' 
                            : 'bg-white/90 text-gray-700 shadow-md backdrop-blur-md border border-white/80'
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
                        w-11 h-11 rounded-xl
                        flex items-center justify-center
                        transition-all duration-200 shadow-md
                        tap-target
                        ${inCart
                            ? 'bg-tg-success/20 text-tg-success cursor-default backdrop-blur-sm'
                            : isDark
                                ? 'bg-white/12 text-white hover:bg-white/20 active:bg-white/25 backdrop-blur-md border border-white/15'
                                : 'bg-white/95 text-gray-800 hover:bg-white active:bg-gray-100 shadow-lg backdrop-blur-md border border-black/5'
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
                <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-black/35 backdrop-blur-lg p-3 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
                    <motion.h3 
                        layoutId={shouldAnimate ? `title-${product.id}` : undefined}
                        className="text-white font-semibold text-[15px] leading-snug tracking-tight line-clamp-2"
                    >
                        {product.name}
                    </motion.h3>
                    
                    <div className="flex items-center justify-between mt-2 gap-2">
                        <motion.span 
                            layoutId={shouldAnimate ? `price-${product.id}` : undefined}
                            className="text-white text-[15px] font-semibold"
                        >
                            {formatPrice(product.price)}
                        </motion.span>
                        
                        {product.team && (
                            <span className="text-white/70 text-[12px] font-medium truncate max-w-[55%] leading-none">
                                {product.team}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.article>
    );
};
