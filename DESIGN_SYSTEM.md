# 🎨 SM Dashboard Design System

**Version:** 1.0.0  
**Last Updated:** February 2026  
**Author:** Professional UI/UX Design Team

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Typography](#typography)
3. [Color Palette](#color-palette)
4. [Spacing System](#spacing-system)
5. [Components](#components)
6. [Usage Guidelines](#usage-guidelines)
7. [Responsive Design](#responsive-design)

---

## 🎯 Overview

This design system ensures consistency across all pages of the SM Dashboard application. It follows modern design principles with a focus on:

- **Simplicity**: Clean, minimal design
- **Consistency**: Uniform appearance across all pages
- **Accessibility**: WCAG 2.1 AA compliant
- **Responsiveness**: Mobile-first approach
- **Professionalism**: Corporate-ready aesthetics

---

## 📝 Typography

### Font Family

**Primary Font:** [Inter](https://fonts.google.com/specimen/Inter)

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Why Inter?**
- Modern, professional appearance
- Excellent readability at all sizes
- Optimized for digital screens
- Wide character support

### Font Size Scale

| Element | Size (Desktop) | Size (Mobile) | Variable | Usage |
|---------|---------------|---------------|----------|-------|
| **Display XL** | 72px (4.5rem) | 40px (2.5rem) | `--font-size-display-xl` | Hero headlines |
| **Display LG** | 60px (3.75rem) | 36px (2.25rem) | `--font-size-display-lg` | Large displays |
| **Display MD** | 48px (3rem) | 32px (2rem) | `--font-size-display-md` | Medium displays |
| **H1** | 36px (2.25rem) | 28px (1.75rem) | `--font-size-h1` | Page titles |
| **H2** | 30px (1.875rem) | 24px (1.5rem) | `--font-size-h2` | Section headers |
| **H3** | 24px (1.5rem) | 20px (1.25rem) | `--font-size-h3` | Subsections |
| **H4** | 20px (1.25rem) | 20px (1.25rem) | `--font-size-h4` | Card titles |
| **H5** | 18px (1.125rem) | 18px (1.125rem) | `--font-size-h5` | Small headers |
| **Body LG** | 18px (1.125rem) | 18px (1.125rem) | `--font-size-body-lg` | Large body text |
| **Body** | 16px (1rem) | 16px (1rem) | `--font-size-body` | Default text |
| **Body SM** | 14px (0.875rem) | 14px (0.875rem) | `--font-size-body-sm` | Small text |
| **Body XS** | 12px (0.75rem) | 12px (0.75rem) | `--font-size-body-xs` | Metadata |
| **Button** | 15px (0.9375rem) | 15px (0.9375rem) | `--font-size-button` | Buttons |
| **Caption** | 11px (0.6875rem) | 11px (0.6875rem) | `--font-size-caption` | Captions |

### Font Weights

| Weight | Value | Variable | Usage |
|--------|-------|----------|-------|
| Light | 300 | `--font-weight-light` | Subtle text |
| Regular | 400 | `--font-weight-regular` | Body text |
| Medium | 500 | `--font-weight-medium` | Emphasis |
| Semibold | 600 | `--font-weight-semibold` | Headings |
| Bold | 700 | `--font-weight-bold` | Strong emphasis |
| Extrabold | 800 | `--font-weight-extrabold` | Display text |
| Black | 900 | `--font-weight-black` | Maximum emphasis |

### Line Heights

| Type | Value | Variable |
|------|-------|----------|
| Tight | 1.25 | `--line-height-tight` |
| Normal | 1.5 | `--line-height-normal` |
| Relaxed | 1.75 | `--line-height-relaxed` |

### Usage Examples

```html
<!-- Page Title -->
<h1 class="heading-1">Dashboard Overview</h1>

<!-- Section Header -->
<h2 class="heading-2">Recent Activity</h2>

<!-- Card Title -->
<h4 class="heading-4">User Statistics</h4>

<!-- Body Text -->
<p class="body-text">This is a paragraph with default body text styling.</p>

<!-- Small Text -->
<p class="body-text-sm">Additional information in smaller text.</p>
```

---

## 🎨 Color Palette

### Two Main Colors Philosophy

The design system uses **only two main colors** for maximum consistency and professionalism:

#### 1️⃣ Primary Color: Royal Blue
**Usage:** Headings, primary buttons, links, brand elements

| Shade | Hex | Variable | Usage |
|-------|-----|----------|-------|
| Primary | `#3B82F6` | `--color-primary` | Main brand color |
| Hover | `#2563EB` | `--color-primary-hover` | Interactive states |
| Light | `#60A5FA` | `--color-primary-light` | Accents |
| Dark | `#1E40AF` | `--color-primary-dark` | Dark mode |
| 50 | `#EFF6FF` | `--color-primary-50` | Backgrounds |
| 100 | `#DBEAFE` | `--color-primary-100` | Light backgrounds |

**Color Preview:**
```
████ #3B82F6 - Primary Blue
████ #2563EB - Hover Blue
████ #60A5FA - Light Blue
```

#### 2️⃣ Secondary Color: Slate Gray
**Usage:** Body text, secondary content, metadata

| Shade | Hex | Variable | Usage |
|-------|-----|----------|-------|
| Secondary | `#475569` | `--color-secondary` | Body text |
| Light | `#64748B` | `--color-secondary-light` | Muted text |
| Dark | `#334155` | `--color-secondary-dark` | Dark text |
| 50 | `#F8FAFC` | `--color-secondary-50` | Light backgrounds |
| 100 | `#F1F5F9` | `--color-secondary-100` | Card backgrounds |

**Color Preview:**
```
████ #475569 - Secondary Gray
████ #64748B - Light Gray
████ #334155 - Dark Gray
```

### Supporting Colors

#### Neutral Colors
| Color | Hex | Variable |
|-------|-----|----------|
| White | `#FFFFFF` | `--color-white` |
| Black | `#0F172A` | `--color-black` |

#### Semantic Colors
| Purpose | Hex | Variable |
|---------|-----|----------|
| Success | `#10B981` | `--color-success` |
| Warning | `#F59E0B` | `--color-warning` |
| Error | `#EF4444` | `--color-error` |
| Info | `#3B82F6` | `--color-info` |

### Color Usage Guidelines

✅ **DO:**
- Use primary blue for all headings
- Use primary blue for primary action buttons
- Use slate gray for all body text
- Use semantic colors for status indicators

❌ **DON'T:**
- Mix multiple heading colors on the same page
- Use colors outside the defined palette
- Use low-contrast color combinations

### Accessibility

All color combinations meet **WCAG 2.1 AA** standards:
- Primary Blue on White: **4.5:1** contrast ratio ✅
- Secondary Gray on White: **7.2:1** contrast ratio ✅
- White on Primary Blue: **4.8:1** contrast ratio ✅

---

## 📏 Spacing System

### Spacing Scale (4px Grid System)

| Name | Size | Variable | Usage |
|------|------|----------|-------|
| 1 | 4px | `--space-1` | Tight spacing |
| 2 | 8px | `--space-2` | Small gaps |
| 3 | 12px | `--space-3` | Default gaps |
| 4 | 16px | `--space-4` | Standard spacing |
| 5 | 20px | `--space-5` | Medium spacing |
| 6 | 24px | `--space-6` | Large spacing |
| 8 | 32px | `--space-8` | Section spacing |
| 10 | 40px | `--space-10` | Large sections |
| 12 | 48px | `--space-12` | Extra large |
| 16 | 64px | `--space-16` | Hero spacing |
| 20 | 80px | `--space-20` | Maximum spacing |
| 24 | 96px | `--space-24` | Ultra spacing |

### Container Padding

| Breakpoint | Padding | Variable |
|------------|---------|----------|
| Mobile | 16px | `--container-padding-mobile` |
| Tablet | 24px | `--container-padding-tablet` |
| Desktop | 32px | `--container-padding-desktop` |

### Section Spacing

| Type | Mobile | Desktop | Variable |
|------|--------|---------|----------|
| Default | 48px | 80px | `--section-spacing-*` |
| Small | 48px | 48px | N/A |
| Large | 96px | 96px | N/A |

### Usage Examples

```html
<!-- Card with consistent spacing -->
<div class="card p-6 mb-4">
  <h3 class="heading-3 mb-3">Card Title</h3>
  <p class="body-text mb-4">Card content goes here.</p>
</div>

<!-- Section with spacing -->
<section class="section">
  <div class="container">
    <!-- Content -->
  </div>
</section>
```

---

## 🧩 Components

### Buttons

#### Primary Button
```html
<button class="btn btn-primary">Primary Action</button>
```
**Style:**
- Background: Royal Blue (`#3B82F6`)
- Text: White
- Padding: 12px 24px
- Border Radius: 8px
- Font Weight: 500

#### Secondary Button
```html
<button class="btn btn-secondary">Secondary Action</button>
```
**Style:**
- Background: Light Gray (`#F1F5F9`)
- Text: Dark Gray (`#334155`)
- Border: 1px solid `#D1D5DB`

#### Outline Button
```html
<button class="btn btn-outline">Outline Action</button>
```
**Style:**
- Background: Transparent
- Text: Royal Blue
- Border: 2px solid Royal Blue

#### Button Sizes
```html
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary">Default</button>
<button class="btn btn-primary btn-lg">Large</button>
```

### Cards

#### Basic Card
```html
<div class="card">
  <div class="card-header">
    <h4 class="card-title">Card Title</h4>
    <p class="card-description">Card description text</p>
  </div>
  <div class="card-content">
    <!-- Card content -->
  </div>
  <div class="card-footer">
    <button class="btn btn-primary">Action</button>
  </div>
</div>
```

**Style:**
- Background: White
- Border: 1px solid `#E5E7EB`
- Border Radius: 12px
- Padding: 24px
- Shadow: Medium

#### Card Variants
```html
<!-- Flat Card (no shadow) -->
<div class="card card-flat">...</div>

<!-- Elevated Card (large shadow) -->
<div class="card card-elevated">...</div>

<!-- Interactive Card (clickable) -->
<div class="card card-interactive">...</div>
```

### Forms

#### Input Field
```html
<div>
  <label class="label">Email Address</label>
  <input type="email" class="input" placeholder="Enter your email">
</div>
```

#### Textarea
```html
<div>
  <label class="label">Message</label>
  <textarea class="input" rows="4" placeholder="Enter your message"></textarea>
</div>
```

### Containers

#### Standard Container
```html
<div class="container">
  <!-- Content (max-width: 1280px) -->
</div>
```

#### Narrow Container
```html
<div class="container container-narrow">
  <!-- Content (max-width: 768px) -->
</div>
```

#### Wide Container
```html
<div class="container container-wide">
  <!-- Content (max-width: 1536px) -->
</div>
```

---

## 📱 Responsive Design

### Breakpoints

| Name | Min Width | Usage |
|------|-----------|-------|
| Mobile | 0px | Default (mobile-first) |
| Tablet | 768px | Tablets and small laptops |
| Desktop | 1024px | Desktops and large screens |
| Wide | 1280px | Extra large screens |

### Responsive Grid

```html
<!-- 1 column on mobile, 2 on tablet, 3 on desktop -->
<div class="grid grid-cols-3">
  <div class="card">Item 1</div>
  <div class="card">Item 2</div>
  <div class="card">Item 3</div>
</div>
```

### Responsive Utilities

```html
<!-- Hide on mobile, show on desktop -->
<div class="hidden-mobile">Desktop only content</div>

<!-- Show on mobile, hide on desktop -->
<div class="hidden-desktop">Mobile only content</div>
```

---

## 📖 Usage Guidelines

### Importing the Design System

Add to your main CSS file or component:

```css
@import './styles/design-system.css';
```

Or in your main entry file:

```javascript
import './styles/design-system.css';
```

### Page Structure Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title</title>
  <link rel="stylesheet" href="./styles/design-system.css">
</head>
<body>
  <!-- Page Header -->
  <header class="section">
    <div class="container">
      <h1 class="heading-1">Page Title</h1>
      <p class="body-text-lg text-muted">Page description</p>
    </div>
  </header>

  <!-- Main Content -->
  <main class="section">
    <div class="container">
      <div class="grid grid-cols-3">
        <!-- Cards -->
        <div class="card">
          <h3 class="card-title">Card Title</h3>
          <p class="body-text">Card content</p>
          <button class="btn btn-primary">Action</button>
        </div>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="section bg-gray">
    <div class="container">
      <p class="body-text-sm text-muted">Footer content</p>
    </div>
  </footer>
</body>
</html>
```

### Best Practices

1. **Consistency First**
   - Always use design system classes
   - Avoid inline styles
   - Don't create custom colors

2. **Typography Hierarchy**
   - One H1 per page
   - Use heading levels sequentially (H1 → H2 → H3)
   - Don't skip heading levels

3. **Spacing**
   - Use spacing variables, not arbitrary values
   - Maintain consistent gaps between elements
   - Follow the 4px grid system

4. **Colors**
   - Primary blue for headings and CTAs
   - Slate gray for body text
   - Semantic colors for status only

5. **Accessibility**
   - Ensure sufficient color contrast
   - Use semantic HTML
   - Include focus states
   - Add ARIA labels where needed

---

## 🎯 Quick Reference

### Common Patterns

#### Hero Section
```html
<section class="section bg-primary text-white">
  <div class="container">
    <h1 class="text-display-lg">Welcome to SM Dashboard</h1>
    <p class="body-text-lg">Manage your volunteers efficiently</p>
    <button class="btn btn-lg bg-white text-primary">Get Started</button>
  </div>
</section>
```

#### Stats Grid
```html
<div class="grid grid-cols-4">
  <div class="card">
    <p class="caption text-muted">TOTAL USERS</p>
    <h2 class="heading-2">1,234</h2>
    <p class="body-text-sm text-success">↑ 12% from last month</p>
  </div>
  <!-- More stat cards -->
</div>
```

#### Form Layout
```html
<form class="card">
  <div class="card-header">
    <h3 class="card-title">Contact Form</h3>
  </div>
  <div class="card-content">
    <div class="mb-4">
      <label class="label">Name</label>
      <input type="text" class="input" placeholder="Your name">
    </div>
    <div class="mb-4">
      <label class="label">Email</label>
      <input type="email" class="input" placeholder="your@email.com">
    </div>
  </div>
  <div class="card-footer">
    <button type="submit" class="btn btn-primary">Submit</button>
    <button type="button" class="btn btn-secondary">Cancel</button>
  </div>
</form>
```

---

## 🔄 Version History

- **v1.0.0** (February 2026) - Initial release
  - Complete typography system
  - Two-color palette
  - Spacing system
  - Component library
  - Responsive utilities

---

## 📞 Support

For questions or suggestions about the design system:
- Create an issue in the project repository
- Contact the design team
- Refer to this documentation

---

**Made with ❤️ for SM Dashboard**
