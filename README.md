# KLE 2.0 - Modern Keyboard Layout Editor

A modern reimplementation of the Keyboard Layout Editor (KLE) with improved features and a contemporary tech stack.

## Features

### Core Functionality
- **Visual Keyboard Editor** - Drag-and-drop interface for designing custom keyboard layouts
- **Key Selection & Manipulation** - Single and multi-select with box selection
- **Properties Panel** - Edit key properties including size, position, legends, colors, and profiles
- **Import/Export** - Full compatibility with original KLE JSON format
- **Preset Layouts** - Common layouts including ANSI 104, ISO 105, 60%, TKL, Planck, and ErgoDox

### Advanced Features
- **Color Picker with Swatches** - Includes GMK/Uniqey, Signature Plastics ABS/PBT color palettes
- **Character Picker** - Special characters for legends (arrows, math symbols, currency, etc.)
- **Export Options** - Save layouts as PNG or SVG
- **Undo/Redo** - Full history support with keyboard shortcuts
- **Grid & Snap** - Configurable grid with snap-to-grid functionality

### Keyboard Shortcuts
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Y` - Redo
- `Ctrl/Cmd + A` - Select All
- `Ctrl/Cmd + D` - Duplicate selected keys
- `Delete/Backspace` - Delete selected keys
- `Arrow Keys` - Move selected keys (hold Shift for larger movements)
- `Escape` - Clear selection

## Tech Stack

- **React 19** with TypeScript
- **Konva.js** - Canvas rendering
- **Zustand** - State management
- **Vite** - Build tool
- **File Saver** - Export functionality

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Type Checking
```bash
npm run typecheck
```

### Linting
```bash
npm run lint
```

## Data Format

KLE 2.0 maintains full compatibility with the original KLE JSON format. Keys support:

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

This project is licensed under the MIT License.