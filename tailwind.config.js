/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			sans: ['"Plus Jakarta Sans"', 'Inter', 'Segoe UI', 'sans-serif'],
  			serif: ['"Instrument Serif"', '"Playfair Display"', 'Georgia', 'serif'],
  			display: ['"Instrument Serif"', '"Playfair Display"', 'Georgia', 'serif'],
  			brand: ['"Space Grotesk"', '"Plus Jakarta Sans"', 'sans-serif'],
  			body: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			gold: {
  				DEFAULT: '#C8A97E',
  				50: '#FAF6F1',
  				100: '#F0E6D8',
  				200: '#E0CCAF',
  				300: '#D4BA94',
  				400: '#C8A97E',
  				500: '#B8955F',
  				600: '#9E7D4B',
  				700: '#7D6339',
  				800: '#5C4A2B',
  				900: '#3B301C',
  			},
  			night: {
  				DEFAULT: '#141210',
  				50: '#242018',
  				100: '#1E1C19',
  				200: '#1A1816',
  				300: '#171513',
  				400: '#141210',
  				500: '#0E0D0B',
  			},
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			},
  			'glow': {
  				'0%, 100%': { boxShadow: '0 0 20px rgba(200,169,126,0.1), 0 0 60px rgba(200,169,126,0.04)' },
  				'50%': { boxShadow: '0 0 30px rgba(200,169,126,0.2), 0 0 80px rgba(200,169,126,0.06)' },
  			},
  			'shimmer': {
  				'0%': { backgroundPosition: '-200% 0' },
  				'100%': { backgroundPosition: '200% 0' },
  			},
  			'float': {
  				'0%, 100%': { transform: 'translateY(0)' },
  				'50%': { transform: 'translateY(-6px)' },
  			},
  			'pulse-ring': {
  				'0%': { transform: 'scale(0.95)', opacity: '1' },
  				'75%, 100%': { transform: 'scale(1.3)', opacity: '0' },
  			},
  			'scan': {
  				'0%': { transform: 'translateX(0)' },
  				'100%': { transform: 'translateX(-50%)' },
  			},
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'glow': 'glow 3s ease-in-out infinite',
  			'shimmer': 'shimmer 2s linear infinite',
  			'float': 'float 4s ease-in-out infinite',
  			'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
  			'scan': 'scan 25s linear infinite',
  		},
  		backdropBlur: {
  			'3xl': '64px',
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
