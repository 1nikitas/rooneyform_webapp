import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import haptics from '../utils/haptics';
import { formatPrice } from '../utils/currency';
import { resolveAssetUrl } from '../utils/assets';
import type { CartItem } from '../types';

interface SwipeableCartItemProps {
  item: CartItem;
  onRemove: () => void;
}

const DELETE_THRESHOLD = -80;
const MAX_SWIPE = -120;

export const SwipeableCartItem: React.FC<SwipeableCartItemProps> = ({ item, onRemove }) => {
  const { isDark } = useTheme();
  const x = useMotionValue(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasTriggeredHaptic = useRef(false);

  const deleteOpacity = useTransform(x, [0, DELETE_THRESHOLD / 2, DELETE_THRESHOLD], [0, 0.5, 1]);
  const deleteScale = useTransform(x, [DELETE_THRESHOLD, DELETE_THRESHOLD / 2], [1, 0.8]);
  const contentOpacity = useTransform(x, [MAX_SWIPE, DELETE_THRESHOLD], [0.5, 1]);

  const handleDragEnd = async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    void info;
    const currentX = x.get();
    
    if (currentX <= DELETE_THRESHOLD) {
      setIsDeleting(true);
      haptics.success();
      
      // Animate out
      await animate(x, -400, { duration: 0.2 });
      onRemove();
    } else {
      // Snap back
      animate(x, 0, { type: 'spring', damping: 20, stiffness: 300 });
    }
    
    hasTriggeredHaptic.current = false;
  };

  const handleDrag = () => {
    const currentX = x.get();
    
    // Haptic feedback when crossing threshold
    if (currentX <= DELETE_THRESHOLD && !hasTriggeredHaptic.current) {
      haptics.impact('medium');
      hasTriggeredHaptic.current = true;
    } else if (currentX > DELETE_THRESHOLD && hasTriggeredHaptic.current) {
      hasTriggeredHaptic.current = false;
    }
  };

  const coverImage = item.product.gallery?.[0] || item.product.image_url;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete background */}
      <motion.div
        className={`
          absolute inset-y-0 right-0 w-24
          flex items-center justify-center
          ${isDark ? 'bg-red-500/30' : 'bg-red-500'}
          rounded-r-2xl
        `}
        style={{ opacity: deleteOpacity }}
      >
        <motion.div style={{ scale: deleteScale }} className="text-white">
          <Trash2 size={24} />
        </motion.div>
      </motion.div>

      {/* Swipeable content */}
      <motion.div
        drag={isDeleting ? false : 'x'}
        dragConstraints={{ left: MAX_SWIPE, right: 0 }}
        dragElastic={0.1}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ x, opacity: contentOpacity }}
        className={`
          relative flex gap-4 p-3 rounded-2xl cursor-grab active:cursor-grabbing
          ${isDark 
            ? 'bg-[#1a1a1d] border border-white/[0.06]' 
            : 'bg-white border border-black/[0.04] shadow-card'
          }
        `}
      >
        {/* Image */}
        <div className={`
          w-20 h-20 rounded-xl overflow-hidden flex-shrink-0
          ${isDark ? 'bg-[#0f0f11]' : 'bg-gray-50'}
        `}>
          <img
            src={resolveAssetUrl(coverImage)}
            alt={item.product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex justify-between gap-2">
            <h3 className="font-semibold text-sm text-tg-text line-clamp-1">
              {item.product.name}
            </h3>
            <span className="text-sm font-bold text-tg-accent flex-shrink-0">
              {formatPrice(item.product.price)}
            </span>
          </div>
          
          <p className="text-xs text-tg-hint mt-0.5 line-clamp-1">
            {item.product.team}
          </p>
          
          <div className="flex items-center mt-auto pt-2">
            <div className={`
              inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs
              ${isDark ? 'bg-white/[0.06] text-white/70' : 'bg-gray-100 text-gray-600'}
            `}>
              <span>Размер: {item.product.size}</span>
              <span className="w-px h-3 bg-current opacity-20" />
              <span>×{item.quantity}</span>
            </div>
          </div>
        </div>

        {/* Swipe hint */}
        <div className={`
          absolute right-2 top-1/2 -translate-y-1/2
          text-xs
          ${isDark ? 'text-white/20' : 'text-gray-300'}
        `}>
          ←
        </div>
      </motion.div>
    </div>
  );
};
