import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: false,
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand colors from globals.css
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        'brand-pink': 'var(--color-brand-pink)',
        
        // App-specific color palette
        primary: {
          DEFAULT: '#f7e8e0', // muted rose
          foreground: '#333333',
        },
        accent: {
          DEFAULT: '#d4c2fb', // dusk lavender
          foreground: '#333333',
        },
        muted: {
          DEFAULT: '#888888',
          foreground: '#333333',
        },
        success: {
          DEFAULT: '#cce8d4',
          foreground: '#1a2e20',
        },
        destructive: {
          DEFAULT: '#fddcdc',
          foreground: '#2e1a1a',
        },
        border: '#e2e8f0',
        input: '#e2e8f0',
        ring: '#d4c2fb',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      spacing: {
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
      },
      boxShadow: {
        'elevation-1': 'var(--elevation-1)',
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'success-bounce': 'success-bounce 0.6s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'gentle-pulse': 'gentle-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'fade-in-up': {
          'from': {
            opacity: '0',
            transform: 'translateY(16px)',
          },
          'to': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'shimmer': {
          '0%': {
            'background-position': '-200% 0',
          },
          '100%': {
            'background-position': '200% 0',
          },
        },
        'success-bounce': {
          '0%, 20%, 53%, 80%, 100%': {
            transform: 'translateY(0)',
          },
          '40%, 43%': {
            transform: 'translateY(-10px)',
          },
          '70%': {
            transform: 'translateY(-5px)',
          },
        },
        'slide-up': {
          'from': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          'to': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'slide-down': {
          'from': {
            opacity: '0',
            transform: 'translateY(-20px)',
          },
          'to': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'gentle-pulse': {
          '0%, 100%': {
            opacity: '1',
          },
          '50%': {
            opacity: '0.7',
          },
        },
      },
      // Mobile-first responsive design
      screens: {
        'xs': '360px',  // Extra small phones
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      // Mobile utilities
      minHeight: {
        'mobile': ['100svh', '100dvh'],
        'screen': '100vh', // Fallback for older browsers
      },
      height: {
        'mobile': ['100svh', '100dvh'],
        'screen': '100vh', // Fallback for older browsers
      },
    },
  },
  plugins: [],
}

export default config 