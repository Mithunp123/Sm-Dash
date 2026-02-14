# Frontend - SM Volunteers Dashboard

> React + TypeScript + Vite frontend application

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server (port 9000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

---

## 🛠️ Tech Stack

- **React 18.3.1** - UI library
- **TypeScript 5.8.3** - Type safety
- **Vite 5.4.19** - Build tool & dev server
- **Tailwind CSS 3.4.17** - Styling
- **shadcn/ui** - UI components (Radix UI based)
- **React Query 5.83.0** - Server state management
- **React Router 6.30.1** - Routing
- **React Hook Form 7.61.1** - Form handling
- **Zod 3.25.76** - Schema validation

---

## 📁 Structure

```
frontend/
├── src/
│   ├── pages/          # Page components (52 pages)
│   ├── components/     # Reusable components
│   │   ├── ui/        # shadcn/ui components
│   │   ├── layout/    # Layout components
│   │   └── landing/   # Landing page components
│   ├── lib/           # Utilities & API client
│   ├── hooks/         # Custom React hooks
│   └── styles/        # Style files
├── public/            # Static assets
├── index.html         # HTML entry point
└── [config files]
```

---

## ⚙️ Configuration Files

- `vite.config.ts` - Vite configuration (port 9000)
- `tailwind.config.ts` - Tailwind CSS config
- `tsconfig.json` - TypeScript config
- `components.json` - shadcn/ui config
- `eslint.config.js` - ESLint rules
- `postcss.config.js` - PostCSS config

---

## 🌐 Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:3000/api
```

---

## 📊 Features

- 52 page components for different views
- Role-based routing (Admin, Office Bearer, Student)
- Responsive design with Tailwind CSS
- Dark mode support
- Form validation with Zod
- API integration with React Query
- Real-time updates
- File upload functionality
- Data visualization with Recharts

---

## 🔧 Development

### Adding shadcn/ui Components

```bash
npx shadcn-ui@latest add [component-name]
```

### Building for Production

```bash
npm run build
# Output: dist/ folder
```

### Port Configuration

The dev server runs on **port 9000** (configured in vite.config.ts).

---

## 📚 Documentation

See main project documentation in `/docs` folder:
- [Main README](../README.md)
- [Complete Analysis](../docs/PROJECT_ANALYSIS.md)
- [File Structure](../docs/FILE_STRUCTURE.md)

---

**For backend API documentation, see `/backend` folder**
