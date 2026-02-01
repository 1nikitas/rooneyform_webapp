'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

type ShimmeringTextProps = Omit<HTMLMotionProps<'span'>, 'children'> & {
  text: string;
  duration?: number;
  wave?: boolean;
  color?: string;
  shimmeringColor?: string;
};

function ShimmeringText({
  text,
  duration = 1,
  transition,
  wave = false,
  color = 'var(--color-neutral-500)',
  shimmeringColor = 'var(--color-neutral-300)',
  ...props
}: ShimmeringTextProps) {
  return (
    <motion.span
      style={
        {
          '--shimmering-color': shimmeringColor,
          '--color': color,
          color: 'var(--color)',
          position: 'relative',
          display: 'inline-block',
          perspective: '500px',
        } as React.CSSProperties
      }
      {...props}
    >
      {text?.split('')?.map((char, i) => (
        <motion.span
          key={i}
          style={{
            display: 'inline-block',
            whiteSpace: 'pre',
            transformStyle: 'preserve-3d',
          }}
          initial={{
            ...(wave
              ? {
                  scale: 1,
                  rotateY: 0,
                }
              : {}),
            color: 'var(--color)',
          }}
          animate={{
            ...(wave
              ? {
                  scale: [1, 1.3, 1],
                  rotateY: [0, 20, 0],
                }
              : {}),
            color: ['var(--color)', 'var(--shimmering-color)', 'var(--color)'],
          }}
          transition={{
            duration,
            delay: wave ? i * 0.1 : i * 0.03,
            repeat: Infinity,
            repeatDelay: wave ? 2 : 2.5,
            ...transition,
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </motion.span>
  );
}

export { ShimmeringText, type ShimmeringTextProps };
