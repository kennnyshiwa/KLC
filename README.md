# KLC - Keyboard Layout Creator

A modern, user-friendly reimplementation of Keyboard Layout Editor (KLE) with enhanced features and improved usability for the mechanical keyboard community.

## What is KLC?

KLC (Keyboard Layout Creator) is a web-based tool designed to help keyboard enthusiasts, designers, and manufacturers visualize and create custom keyboard layouts. Whether you're designing a new keyboard PCB, planning a keycap set, or just exploring different layouts, KLC provides an intuitive interface to bring your ideas to life.

### Key Benefits
- **Visual Design** - See exactly how your keyboard will look before building or buying
- **Accurate Colors** - Test real keycap colors from popular manufacturers like GMK and Signature Plastics
- **Full Compatibility** - Import and export layouts in the standard KLE format used across the community
- **Modern Interface** - Improved user experience with better selection tools, property editing, and specialty key support
- **Community Features** - Browse and share layouts with other designers

## Who Uses KLC?

- **Keyboard Designers** - Create and iterate on new keyboard layouts
- **Keycap Set Designers** - Visualize colorways and legend placement
- **PCB Designers** - Plan switch and stabilizer placement
- **Group Buy Runners** - Create renders for interest checks and sales pages
- **Keyboard Enthusiasts** - Explore different layouts and plan builds

## Features

### Core Functionality
- **Visual Keyboard Editor** - Drag-and-drop interface for designing custom keyboard layouts
- **Smart Selection Tools** - Single, multi-select, box selection, and range selection
- **Properties Panel** - Edit key properties including size, position, legends, colors, and profiles
- **Import/Export** - Full compatibility with original KLE JSON format plus KRK export support
- **Preset Layouts** - Common layouts including ANSI 104, ISO 105, 60%, 65%, 75%, TKL, 1800, Planck, ErgoDox, and more
- **Grid Snapping** - Configurable grid with smart snapping for precise alignment

### Advanced Features
- **Authentic Color Swatches** - Real colors from GMK, Signature Plastics ABS/PBT
- **Character Picker** - Special characters, icons, Trashcon support, and 40s logo
- **Multiple Export Formats** - PNG, SVG, KLE JSON, and KRK formats
- **Full Undo/Redo History** - Never lose your work with unlimited history
- **Public Layout Gallery** - Browse and use community-created layouts
- **Cloud Save** - Save your layouts online (with Discord login)
- **LED & Encoder Support** - Add LED indicators and rotary encoders to your designs

### Keyboard Shortcuts

#### Selection
- `Click` - Select key
- `Ctrl/Cmd + Click` - Add/remove key from selection
- `Shift + Click` - Select range of keys
- `Drag` - Box select multiple keys
- `Ctrl/Cmd + Drag` - Box select and add to selection
- `Ctrl/Cmd + A` - Select all keys
- `Escape` - Clear selection

#### Movement & Manipulation
- `Arrow Keys` - Move selected keys (0.25u)
- `Shift + Arrow Keys` - Move selected keys (1u)
- `Alt + Arrow Keys` - Move selected keys (0.125u - fine control)
- `Drag Selected Keys` - Move keys with mouse
- `Alt + Drag` - Duplicate and drag keys

#### Resize
- `Ctrl/Cmd + Arrow Keys` - Resize selected keys (0.25u)
- `Ctrl/Cmd + Shift + Arrow Keys` - Resize selected keys (0.5u)
- `Ctrl/Cmd + ↑/↓` - Increase/decrease height
- `Ctrl/Cmd + ←/→` - Decrease/increase width

#### Edit
- `Ctrl/Cmd + C` - Copy selected keys
- `Ctrl/Cmd + V` - Paste keys
- `Ctrl/Cmd + D` - Duplicate selected keys below
- `Delete/Backspace` - Delete selected keys
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Y` - Redo
- `Ctrl/Cmd + Shift + Z` - Redo (alternative)

## Tech Stack

- **React 19** with TypeScript
- **KeyboardCanvasUltraFast.tsx** - Custom Canvas Rendering for the keycap shapes
- **Zustand** - State management
- **Vite** - Build tool
- **File Saver** - Export functionality

## Quick Start

### Using KLC Online
Visit [KLC Website URL] to start designing immediately - no installation required!

### Running Locally

#### Prerequisites
- Node.js 18+ 
- npm or yarn
- PostgreSQL (for backend features)

#### Installation
1. Clone the repository:
```bash
git clone https://github.com/kennnyshiwa/KLC.git
cd KLC
```

2. Install dependencies:
```bash
npm install
```

3. Set up the backend (optional, for cloud features):
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database and Discord OAuth credentials
npx prisma migrate dev
```

#### Development
```bash
# Frontend
npm run dev

# Backend (in separate terminal)
cd backend
npm run dev
```

#### Build for Production
```bash
npm run build
```

#### Other Commands
```bash
npm run typecheck  # Type checking
npm run lint       # Linting
```

## Why KLC Over Original KLE?

### Improvements Over Original KLE
- **Better Selection** - Box selection, multi-select with Ctrl/Cmd, range selection with Shift
- **Improved Specialty Keys** - Proper support for ISO Enter, Big Ass Enter, stepped keys
- **Real Manufacturer Colors** - GMK and SP color matching (Colors are approximations based on vendor provided color codes, renders will be more accurate for color determination)
- **Modern Codebase** - Built with React and TypeScript for better performance and maintainability
- **Cloud Features** - Save layouts online, browse community layouts
- **Better Export Options** - High-quality PNG/SVG export, KRK format support
- **Active Development** - Regular updates and new features

## Data Format

KLC maintains full compatibility with the original KLE JSON format. Keys support:

- Position (x, y) and size (width, height)
- Secondary dimensions for oddly-shaped keys (x2, y2, width2, height2)
- Rotation with custom center point
- Up to 12 legend positions per key
- Individual text color and size per legend
- Key profiles (DCS, DSA, SA, OEM, etc.)
- Special properties (stepped, homing nub, ghost, decal)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the GPL 3.0 License.
