# Guillotine

An online version of the classic card game built with modern web technologies. Players can create or join rooms to play together in real-time using WebSocket communication.

## 🎮 Features

- **Real-time Multiplayer**: WebSocket-based communication using Socket.io for seamless multiplayer gameplay
- **Room System**: Create or join game rooms with unique codes
- **Responsive UI**: Built with React and Tailwind CSS for a modern, responsive interface
- **Card System**: Dynamic card management with JSON-based card data

## 📁 Project Structure

```
Guillotine/
├── back-end/              # Express.js server with Socket.io
│   ├── index.js          # Server entry point
│   ├── actions.js        # Game logic and event handlers
│   ├── assets/
│   │   └── cards/        # Card data in JSON format
│   └── package.json
│
├── front-end/            # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── App.tsx              # Main app component with routing
│   │   ├── main.tsx             # Entry point
│   │   ├── components/
│   │   │   ├── socket.ts        # Socket.io client setup
│   │   │   └── shared/          # Shared UI components
│   │   ├── _create/             # Room creation/joining pages
│   │   │   ├── Create.tsx
│   │   │   └── forms/
│   │   ├── _root/               # Game pages
│   │   │   ├── Room.tsx         # Lobby view
│   │   │   └── Game2.tsx        # Game view
│   │   └── public/
│   │       └── assets/          # Images, 3D models, icons
│   ├── vite.config.ts           # Vite configuration
│   ├── tailwind.config.js        # Tailwind CSS configuration
│   ├── tsconfig.json            # TypeScript configuration
│   └── package.json
│
└── README.md
```

## 🛠️ Tech Stack

### Backend
- **Express.js** - Web server framework
- **Socket.io** - Real-time bidirectional communication
- **CORS** - Cross-origin resource sharing
- **Node.js** - JavaScript runtime

### Frontend
- **React 19** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Three.js** - 3D graphics library
- **React Router** - Client-side routing
- **Socket.io Client** - WebSocket client

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Guillotine
   ```

2. **Install backend dependencies**
   ```bash
   cd back-end
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../front-end
   npm install
   ```

### Running the Application

#### Development Mode

1. **Start the backend server** (from `back-end/` directory)
   ```bash
   npm run dev
   ```
   The server will run on `http://localhost:3001`

2. **Start the frontend development server** (from `front-end/` directory)
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:5173`

#### Production Build

1. **Build the frontend** (from `front-end/` directory)
   ```bash
   npm run build
   ```

2. **Start the backend** (from `back-end/` directory)
   ```bash
   npm start
   ```

## 📝 Available Scripts

### Backend
- `npm start` - Start the production server
- `npm run dev` - Start the development server with hot reload (requires nodemon)

### Frontend
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint to check code quality
- `npm run preview` - Preview production build locally

## 🎯 Game Flow

1. User navigates to the home page
2. User can either **Create a Room** or **Join an Existing Room**
3. Players wait in the lobby (Room page) until the game starts
4. Once started, players are taken to the game view (Game2 page)
5. Game events are synchronized across all players via WebSocket

## 🔧 Configuration

### Server Configuration
- **CORS Origins**: Configured in `back-end/index.js` to allow requests from:
  - `https://guillotine.vercel.app` (production)
  - `http://localhost:5173` (development frontend)
- **Room Timeout**: 30 minutes of inactivity before rooms are deleted

### Frontend Proxy
- Development proxy configured in `front-end/package.json` to route API requests to `http://localhost:3001`

## 📦 Card System

Card data is stored in JSON format:
- Backend: `back-end/assets/cards/cards.json`
- Frontend: `front-end/public/assets/cards/cards.json`

## 🌐 Deployment

The frontend is deployed on [Vercel](https://guillotine.vercel.app). The `vercel.json` configuration is included in the `front-end/` directory.

## 📄 License

ISC