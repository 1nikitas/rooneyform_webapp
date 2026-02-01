import React from 'react';
import { motion } from 'framer-motion';
import type { Product } from '../types';
import { Plus } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { formatPrice } from '../utils/currency';
import { resolveAssetUrl } from '../utils/assets';
import { Shine } from './animate-ui/primitives/effects/shine';

interface ProductCardProps {
    product: Product;
    onClick: () => void;
    onAdd: (e: React.MouseEvent) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick, onAdd }) => {
    const coverImage = product.gallery?.[0] || product.image_url;
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <Shine
            asChild
            enableOnHover
            loop
            loopDelay={2200}
            duration={1100}
            opacity={0.28}
            color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.8)'}
        >
            <motion.div
                layoutId={`card-${product.id}`}
                onClick={onClick}
                className="glass-card rounded-2xl overflow-hidden relative group"
                whileTap={{ scale: 0.98 }}
            >
                <div className={`aspect-[3/4] overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <motion.img
                        layoutId={`image-${product.id}`}
                        src={resolveAssetUrl(coverImage)}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                </div>

                <div className="p-3 absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-10">
                    <motion.h3 layoutId={`title-${product.id}`} className="text-white font-semibold text-sm truncate">
                        {product.name}
                    </motion.h3>
                    <div className="flex justify-between items-center mt-1">
                        <motion.p layoutId={`price-${product.id}`} className="text-gray-200 text-xs font-semibold">
                            {formatPrice(product.price)}
                        </motion.p>
                        <button
                            onClick={onAdd}
                            className={`p-1.5 rounded-full transition-colors ${
                                isDark
                                    ? 'bg-white/20 hover:bg-white/40 text-white'
                                    : 'bg-white/80 text-gray-900 hover:bg-white'
                            }`}
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
            </motion.div>
        </Shine>
    );
};
