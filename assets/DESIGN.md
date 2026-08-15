---
name: Kinetic High-Performance
colors:
  surface: '#fdf7ff'
  surface-dim: '#DED8E0'
  surface-bright: '#fdf7ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f2fa'
  surface-container: '#f2ecf4'
  surface-container-high: '#ece6ee'
  surface-container-highest: '#e6e0e9'
  on-surface: '#1d1b20'
  on-surface-variant: '#494551'
  inverse-surface: '#322f35'
  inverse-on-surface: '#f5eff7'
  outline: '#7a7582'
  outline-variant: '#cbc4d2'
  surface-tint: '#6750a4'
  primary: '#381e72'
  on-primary: '#ffffff'
  primary-container: '#4f378a'
  on-primary-container: '#c0a7ff'
  inverse-primary: '#d0bcff'
  secondary: '#63597c'
  on-secondary: '#ffffff'
  secondary-container: '#e1d4fd'
  on-secondary-container: '#645a7d'
  tertiary: '#765b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c9a74d'
  on-tertiary-container: '#503d00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#22005c'
  on-primary-fixed-variant: '#4f378a'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#cdc0e9'
  on-secondary-fixed: '#1f1635'
  on-secondary-fixed-variant: '#4b4263'
  tertiary-fixed: '#ffdf93'
  tertiary-fixed-dim: '#e7c265'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#594400'
  background: '#fdf7ff'
  on-background: '#1d1b20'
  surface-variant: '#e6e0e9'
  execute-neon: '#39FF14'
  surface-ink: '#1D1B20'
  energy-yellow: '#FFDF93'
typography:
  display-lg:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Public Sans
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: 0.05em
  body-md:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-uppercase:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
  nav-label:
    fontFamily: Public Sans
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  container-margin: 1rem
  stack-gap-sm: 0.5rem
  stack-gap-md: 1rem
  section-margin: 2rem
  safe-area-bottom: env(safe-area-inset-bottom)
---

## Brand & Style
The brand identity is centered on **Kinetic High-Performance**—a high-energy, athletic aesthetic designed for users who treat fitness as a discipline. It merges a "Dark Mode" utilitarian base with high-visibility "Safety Neon" accents to evoke the feeling of a high-end gym at night or professional racing telemetry.

The design style is **High-Contrast / Modern**, utilizing deep ink-toned surfaces and vibrant energy pops. It borrows from **Minimalism** for functional clarity and **Tactile** design through the use of subtle glows and pulsing animations to represent "live" data. The emotional response should be one of urgency, precision, and peak physical readiness.

## Colors
The palette is built on a high-contrast foundation:
- **Primary Deep Purple (#4F378A):** Used for structural brand elements and primary toggles.
- **Neon Execute (#39FF14):** A critical "action-only" color. This is reserved exclusively for the "Execute" or "Start" functions, creating a clear psychological trigger for performance.
- **Tertiary Amber:** Used for tracking and "Energy Map" states to signify completion without competing with the primary action color.
- **Surface Ink:** Deep, near-black neutrals are used for cards and backgrounds to allow the neon and primary accents to "pop" with maximum luminance.

## Typography
We use **Public Sans** across all levels to maintain an institutional, trustworthy, yet athletic feel. 

- **Headlines:** Use heavy weights (700+) with tight tracking for a condensed, impactful look.
- **Section Headers:** Small, all-caps labels with wide letter-spacing (0.1em) are used to categorize content without cluttering the visual hierarchy.
- **Action Text:** The "Execute" button uses a larger, bolder weight (Black/900) and wide tracking to emphasize its importance as the primary screen goal.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a focus on vertical rhythm and horizontal momentum:
- **Horizontal Momentum:** Use snapping horizontal carousels (e.g., Energy Map) to allow for infinite tracking without vertical bloat.
- **Margins:** Standard 16px (1rem) side margins for all mobile views.
- **Safe Zones:** High-priority buttons (FABs) are anchored 20px above the bottom navigation or safe area to ensure they are within the "thumb zone."
- **Stacking:** Cards are stacked with 16px gaps to maintain individual distinctness while keeping a tight, unified list.

## Elevation & Depth
Depth is created through **Tonal Layering** and **Luminous Accents** rather than traditional heavy shadows:
- **Surface Levels:** The background uses the lightest surface tone (`#FDF7FF`), while active workout cards use `inverse-surface` (`#322F35`) to create a dramatic focal point.
- **Atmospheric Glow:** Cards feature blurred radial gradients in the corner (Primary or Tertiary tints at 20% opacity) to suggest light reflecting off gym equipment or screens.
- **Neon Glow:** The primary action button uses a specialized shadow (`0 0 30px rgba(57,255,20,0.3)`) to simulate a physical neon glow, making it feel "charged."

## Shapes
The system uses a **Hyper-Rounded** language to balance the aggressive high-contrast colors with a sense of approachability and comfort:
- **Containers/Cards:** Large 24px (1.5rem) or 32px (2rem) corners.
- **Interactive Elements:** Buttons and toggles use full "Pill" shapes (`rounded-full`) to clearly signal touchability.
- **Icons:** Enclosed in circular or soft-square (8px) containers to provide a consistent tap target.

## Components
- **Performance Cards:** Dark-themed containers with high-contrast white text. They must include a "Swap" action (rounded-full button) to allow for real-time workout adjustments.
- **Execute FAB:** A full-width, neon-colored button. It is the only element allowed to use the `#39FF14` color and must feature a "Play" icon.
- **Energy Map:** A sequence of 48x48px circles. States:
    - *Completed:* Solid color with checkmark.
    - *Active:* Pulsing border with an inner glow animation.
    - *Missed:* Low-opacity outline only.
- **Environment Toggle:** A pill-shaped segmented control with a sliding background indicator to switch between contexts (e.g., Home vs. Gym).
- **Smart Swap Modal:** Bottom-aligned sheet with a 32px top-radius, using backdrop blurs to maintain context with the workout flow behind it.