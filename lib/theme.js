/**
 * Theme Constants - Stripe Brand Color
 * Centralized theme configuration for consistent color usage across the application
 */

// Stripe brand color - Primary theme color
export const THEME = {
  // Primary colors
  primary: '#635BFF',           // Stripe brand color
  primaryHover: '#5548E6',       // Darker shade for hover states
  primaryLight: '#8B7FFF',       // Lighter shade
  
  // Background colors with opacity
  bg: {
    light: 'rgba(99, 91, 255, 0.1)',      // 10% opacity - for subtle backgrounds
    medium: 'rgba(99, 91, 255, 0.2)',     // 20% opacity - for hover states
    dark: 'rgba(99, 91, 255, 0.05)',      // 5% opacity - for very subtle backgrounds
  },
  
  // Border colors with opacity
  border: {
    light: 'rgba(99, 91, 255, 0.2)',       // 20% opacity - for borders
    medium: 'rgba(99, 91, 255, 0.4)',     // 40% opacity - for hover borders
    dark: 'rgba(99, 91, 255, 0.6)',       // 60% opacity - for active borders
  },
  
  // Text colors
  text: {
    primary: '#635BFF',          // Primary text color
    hover: '#5548E6',            // Hover text color
    light: 'rgba(255, 255, 255, 0.9)', // Light text on dark backgrounds
  },
  
  // Gradient
  gradient: {
    from: '#635BFF',
    to: '#5548E6',
    css: 'linear-gradient(to bottom right, #635BFF, #5548E6)',
  },
  
  // Shadow
  shadow: {
    sm: '0 10px 15px -3px rgba(99, 91, 255, 0.1)',
    md: '0 20px 25px -5px rgba(99, 91, 255, 0.1)',
    lg: '0 25px 50px -12px rgba(99, 91, 255, 0.15)',
    xl: '0 25px 50px -12px rgba(99, 91, 255, 0.25)',
  },
  
  // Dashboard specific colors - all use primary theme color (#635BFF)
  dashboard: {
    // Theme strip color - for background gradients (uses primary theme color)
    stripColor: 'rgba(99, 91, 255, 0.1)', // THEME.primary (#635BFF) with 10% opacity
    stripColorLight: 'rgba(99, 91, 255, 0.05)', // THEME.primary (#635BFF) with 5% opacity
    
    // Label color - for section labels and metadata
    labelColor: '#94a3b8', // slate-400
    labelColorLight: '#cbd5e1', // slate-300
    
    // Line color - for sparklines and chart lines (uses primary theme color)
    lineColor: '#635BFF', // THEME.primary - Stripe brand color
    
    // Win rate color - for efficiency percentage and progress bars (uses primary theme color)
    winRateColor: '#635BFF', // THEME.primary - Stripe brand color
  },
  
  // For Tailwind classes (when you need to use className)
  classes: {
    text: 'text-[#635BFF]',
    bg: 'bg-[#635BFF]',
    border: 'border-[#635BFF]',
  },
};

// Helper functions for common use cases
export const getThemeStyle = (type) => {
  switch (type) {
    case 'text':
      return { color: THEME.text.primary };
    case 'bg':
      return { backgroundColor: THEME.bg.light };
    case 'border':
      return { borderColor: THEME.border.light };
    case 'button':
      return { 
        backgroundColor: THEME.primary,
        color: 'white',
      };
    case 'buttonHover':
      return { 
        backgroundColor: THEME.primaryHover,
        color: 'white',
      };
    default:
      return {};
  }
};

// For inline styles - commonly used combinations
export const themeStyles = {
  // Text styles
  textPrimary: { color: THEME.text.primary },
  textHover: { color: THEME.text.hover },
  textLight: { color: THEME.text.light },
  
  // Background styles
  bgLight: { backgroundColor: THEME.bg.light },
  bgMedium: { backgroundColor: THEME.bg.medium },
  bgDark: { backgroundColor: THEME.bg.dark },
  
  // Border styles
  borderLight: { borderColor: THEME.border.light },
  borderMedium: { borderColor: THEME.border.medium },
  borderDark: { borderColor: THEME.border.dark },
  
  // Button styles
  button: {
    backgroundColor: THEME.primary,
    color: 'white',
  },
  buttonHover: {
    backgroundColor: THEME.primaryHover,
    color: 'white',
  },
  
  // Badge/Tag styles
  badge: {
    backgroundColor: THEME.bg.light,
    color: THEME.text.primary,
    borderColor: THEME.border.light,
  },
  
  // Gradient
  gradient: {
    background: THEME.gradient.css,
  },
  
  // Dashboard styles
  dashboard: {
    stripColor: { backgroundColor: THEME.dashboard.stripColor },
    stripColorLight: { backgroundColor: THEME.dashboard.stripColorLight },
    labelColor: { color: THEME.dashboard.labelColor },
    labelColorLight: { color: THEME.dashboard.labelColorLight },
    lineColor: { color: THEME.dashboard.lineColor },
    winRateColor: { color: THEME.dashboard.winRateColor },
    winRateBg: { backgroundColor: THEME.dashboard.winRateColor },
  },
};

export default THEME;
