/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    // Tremor 컴포넌트
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Apple 스타일 컬러 팔레트
        blue: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          500: '#007AFF',
          600: '#0056CC',
          900: '#0C4A6E'
        },
        gray: {
          50: '#F9FAFB',
          100: '#F2F2F7',
          200: '#E5E5EA',
          500: '#8E8E93',
          900: '#1C1C1E'
        },
        green: {
          500: '#34C759'
        },
        orange: {
          500: '#FF9500'
        },
        red: {
          500: '#FF3B30'
        }
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'display': ['28px', '34px'],
        'headline': ['24px', '30px'],
        'title': ['20px', '26px'],
        'body': ['16px', '24px'],
        'small': ['14px', '20px'],
        'caption': ['12px', '16px']
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem'
      },
      borderRadius: {
        lg: "12px",
        xl: "16px"
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 12px rgba(0, 0, 0, 0.1)',
        'lg': '0 8px 24px rgba(0, 0, 0, 0.1)'
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-in-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-subtle": "pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        }
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}