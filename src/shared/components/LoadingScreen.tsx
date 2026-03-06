import React from 'react';

/**
 * Premium full-screen loading state with animated Cozy Moments logo,
 * pulsing ring, and subtle shimmer. Used across customer & business apps.
 */
export const LoadingScreen: React.FC<{ variant?: 'customer' | 'business' }> = ({ variant = 'customer' }) => {
  const bg = variant === 'business' ? '#f5f5f0' : 'var(--color-cozy-bg, #f5f5f0)';
  const accentColor = variant === 'business' ? 'rgba(90,90,64,0.15)' : 'rgba(92,64,51,0.12)';
  const dotColor = variant === 'business' ? '#5a5a40' : '#5c4033';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: bg }}
    >
      {/* Outer glow ring */}
      <div className="relative flex items-center justify-center mb-8">
        {/* Spinning ring */}
        <div
          className="absolute w-32 h-32 rounded-full"
          style={{
            border: `2.5px solid ${accentColor}`,
            borderTopColor: dotColor,
            animation: 'cozy-spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite',
          }}
        />
        {/* Pulsing soft glow */}
        <div
          className="absolute w-36 h-36 rounded-full"
          style={{
            background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
            animation: 'cozy-pulse 2s ease-in-out infinite',
          }}
        />
        {/* Logo */}
        <img
          src="/cozylogo.png"
          alt="Cozy Moments"
          className="w-20 h-20 object-contain relative z-10"
          style={{ animation: 'cozy-fade-in 0.6s ease-out' }}
        />
      </div>

      {/* Loading dots */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: dotColor,
              opacity: 0.4,
              animation: `cozy-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Inline keyframes — no external CSS needed */}
      <style>{`
        @keyframes cozy-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes cozy-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.08); }
        }
        @keyframes cozy-dot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes cozy-fade-in {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
