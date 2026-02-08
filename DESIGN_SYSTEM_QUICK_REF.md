# 🎨 Design System Quick Reference

## 🚀 Getting Started

The design system is automatically imported in your project. Just use the classes!

---

## 📝 Typography Quick Reference

### Headings (Always use Primary Blue color)

```html
<h1 class="heading-1">Main Page Title</h1>          <!-- 36px, Bold, Blue -->
<h2 class="heading-2">Section Header</h2>           <!-- 30px, Semibold, Blue -->
<h3 class="heading-3">Subsection</h3>               <!-- 24px, Semibold, Blue -->
<h4 class="heading-4">Card Title</h4>               <!-- 20px, Medium, Blue -->
```

### Body Text (Always use Slate Gray color)

```html
<p class="body-text">Default paragraph text</p>    <!-- 16px, Regular, Gray -->
<p class="body-text-lg">Large body text</p>         <!-- 18px, Regular, Gray -->
<p class="body-text-sm">Small text</p>              <!-- 14px, Regular, Light Gray -->
<p class="body-text-xs">Extra small text</p>        <!-- 12px, Regular, Light Gray -->
```

---

## 🎨 Color Classes

### Text Colors
```html
<p class="text-primary">Primary blue text</p>
<p class="text-secondary">Secondary gray text</p>
<p class="text-muted">Muted light gray text</p>
```

### Background Colors
```html
<div class="bg-primary">Blue background</div>
<div class="bg-primary-light">Light blue background</div>
<div class="bg-secondary">Gray background</div>
<div class="bg-white">White background</div>
```

---

## 🔘 Buttons

### Button Styles
```html
<!-- Primary (Blue background, white text) -->
<button class="btn btn-primary">Primary Action</button>

<!-- Secondary (Gray background, dark text) -->
<button class="btn btn-secondary">Secondary Action</button>

<!-- Outline (Transparent, blue border) -->
<button class="btn btn-outline">Outline Action</button>

<!-- Ghost (Transparent, no border) -->
<button class="btn btn-ghost">Ghost Action</button>
```

### Button Sizes
```html
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary">Default</button>
<button class="btn btn-primary btn-lg">Large</button>
```

---

## 🃏 Cards

### Basic Card
```html
<div class="card">
  <div class="card-header">
    <h4 class="card-title">Card Title</h4>
    <p class="card-description">Optional description</p>
  </div>
  <div class="card-content">
    <p class="body-text">Card content goes here</p>
  </div>
  <div class="card-footer">
    <button class="btn btn-primary">Action</button>
  </div>
</div>
```

### Card Variants
```html
<div class="card card-flat">No shadow</div>
<div class="card card-elevated">Large shadow</div>
<div class="card card-interactive">Clickable card</div>
```

---

## 📏 Spacing

### Margin
```html
<div class="mt-4">Margin top 16px</div>
<div class="mb-6">Margin bottom 24px</div>
<div class="mt-8">Margin top 32px</div>
```

### Padding
```html
<div class="p-4">Padding 16px all sides</div>
<div class="p-6">Padding 24px all sides</div>
<div class="p-8">Padding 32px all sides</div>
```

---

## 📦 Containers

```html
<!-- Standard container (max-width: 1280px) -->
<div class="container">
  <!-- Your content -->
</div>

<!-- Narrow container (max-width: 768px) -->
<div class="container container-narrow">
  <!-- Your content -->
</div>
```

---

## 📱 Responsive Grid

```html
<!-- 1 col mobile, 2 col tablet, 3 col desktop -->
<div class="grid grid-cols-3">
  <div class="card">Item 1</div>
  <div class="card">Item 2</div>
  <div class="card">Item 3</div>
</div>

<!-- 1 col mobile, 2 col tablet, 4 col desktop -->
<div class="grid grid-cols-4">
  <div class="card">Item 1</div>
  <div class="card">Item 2</div>
  <div class="card">Item 3</div>
  <div class="card">Item 4</div>
</div>
```

---

## 📋 Forms

### Input Field
```html
<div>
  <label class="label">Field Label</label>
  <input type="text" class="input" placeholder="Enter text">
</div>
```

### Textarea
```html
<div>
  <label class="label">Message</label>
  <textarea class="input" rows="4" placeholder="Enter message"></textarea>
</div>
```

---

## 🎯 Common Patterns

### Page Header
```html
<header class="section">
  <div class="container">
    <h1 class="heading-1">Page Title</h1>
    <p class="body-text-lg text-muted">Page description</p>
  </div>
</header>
```

### Stats Card
```html
<div class="card">
  <p class="caption text-muted">LABEL</p>
  <h2 class="heading-2">1,234</h2>
  <p class="body-text-sm text-success">↑ 12% increase</p>
</div>
```

### Action Card
```html
<div class="card">
  <h3 class="card-title">Card Title</h3>
  <p class="body-text">Description of the action or content.</p>
  <div class="card-footer">
    <button class="btn btn-primary">Primary Action</button>
    <button class="btn btn-secondary">Cancel</button>
  </div>
</div>
```

---

## ✅ Do's and Don'ts

### ✅ DO:
- Use `heading-1` through `heading-4` for all headings
- Use `body-text` for all paragraph content
- Use `btn btn-primary` for primary actions
- Use consistent spacing with spacing classes
- Use the two main colors (Blue & Gray)

### ❌ DON'T:
- Use inline styles for colors or fonts
- Create custom font sizes
- Mix different heading colors
- Use arbitrary spacing values
- Skip heading levels (H1 → H3)

---

## 🎨 Color Reference

### Primary Blue (Headings & Buttons)
- **Primary:** `#3B82F6` - Main brand color
- **Hover:** `#2563EB` - Button hover state
- **Light:** `#60A5FA` - Accents

### Secondary Gray (Body Text)
- **Secondary:** `#475569` - Body text
- **Light:** `#64748B` - Muted text
- **Dark:** `#334155` - Strong text

---

## 📱 Responsive Utilities

```html
<!-- Hide on mobile, show on desktop -->
<div class="hidden-mobile">Desktop content</div>

<!-- Show on mobile, hide on desktop -->
<div class="hidden-desktop">Mobile content</div>
```

---

## 🔗 Full Documentation

For complete documentation, see: `DESIGN_SYSTEM.md`

---

**Remember:** Consistency is key! Always use design system classes instead of custom styles.
