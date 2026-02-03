import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}) => {
  const { isDark } = useTheme();

  const baseClasses = `
    ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}
    ${animation === 'pulse' ? 'animate-pulse' : ''}
    ${animation === 'wave' ? 'skeleton-wave' : ''}
  `;

  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-xl',
  };

  const style: React.CSSProperties = {
    width: width ?? '100%',
    height: height ?? (variant === 'text' ? '1em' : '100%'),
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};

// Product Card Skeleton
export const ProductCardSkeleton: React.FC = () => {
  const { isDark } = useTheme();

  return (
    <div className={`
      rounded-2xl overflow-hidden
      ${isDark 
        ? 'bg-[#1a1a1d] border border-white/[0.06]' 
        : 'bg-white border border-black/[0.04]'
      }
    `}>
      {/* Image placeholder */}
      <div className="aspect-[3/4] relative">
        <Skeleton variant="rectangular" className="absolute inset-0" />
        
        {/* Size badge skeleton */}
        <div className="absolute top-3 left-3">
          <Skeleton variant="rounded" width={40} height={24} />
        </div>
        
        {/* Add button skeleton */}
        <div className="absolute top-3 right-3">
          <Skeleton variant="rounded" width={40} height={40} />
        </div>
        
        {/* Bottom content skeleton */}
        <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
          <Skeleton variant="rounded" height={16} width="80%" />
          <div className="flex justify-between items-center">
            <Skeleton variant="rounded" height={14} width={60} />
            <Skeleton variant="rounded" height={12} width={50} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Cart Item Skeleton
export const CartItemSkeleton: React.FC = () => {
  const { isDark } = useTheme();

  return (
    <div className={`
      flex gap-4 p-3 rounded-2xl
      ${isDark 
        ? 'bg-[#1a1a1d] border border-white/[0.06]' 
        : 'bg-white border border-black/[0.04]'
      }
    `}>
      {/* Image */}
      <Skeleton variant="rounded" width={80} height={80} />
      
      {/* Content */}
      <div className="flex-1 space-y-2">
        <div className="flex justify-between">
          <Skeleton variant="rounded" height={16} width="60%" />
          <Skeleton variant="rounded" height={16} width={60} />
        </div>
        <Skeleton variant="rounded" height={12} width="40%" />
        <div className="flex justify-between items-center pt-2">
          <Skeleton variant="rounded" height={24} width={120} />
          <Skeleton variant="rounded" width={32} height={32} />
        </div>
      </div>
    </div>
  );
};

// Grid of skeleton cards
interface ProductGridSkeletonProps {
  count?: number;
}

export const ProductGridSkeleton: React.FC<ProductGridSkeletonProps> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, idx) => (
        <ProductCardSkeleton key={idx} />
      ))}
    </div>
  );
};
