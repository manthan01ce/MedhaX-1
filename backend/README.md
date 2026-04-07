# CodeDuel ⚔️

**Real-time 1v1 multiplayer coding quiz website with Battleship-style hidden board mechanics.**

Two registered users challenge each other, answer synchronized coding MCQs, and dig into each other's hidden boards. Correct answers earn points equal to the question number and grant dig chances on the opponent's grid.

## 🎮 How It Works

1. **Register & Login** — Create an account with a unique username
2. **Challenge** — Search for another online user and send a challenge (pick question count + category)
3. **Place Shapes** — Both players place randomly generated shapes on their own hidden grid
4. **Quiz Battle** — Answer the same MCQs in real-time with a 30-second timer
5. **Dig Phase** — Correct answers give 1 dig chance on the opponent's hidden board (+3 bonus for hits)
6. **Results** — Detailed scoreboard with winner, stats, and breakdown

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ installed
- **npm** 

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment (defaults work fine for local dev)
cp .env.example .env

# 3. Seed the database with test users and 140+ questions
npm run seed

# 4. Start the server
npm run dev
```

### Test Credentials

| Username | Password |
|----------|----------|
| alice    | pass123  |
| bob      | pass123  |
| charlie  | pass123  |

### Testing with Two Players

> ⚠️ **IMPORTANT**: You must use **two separate browser contexts** because cookies are shared within the same browser. Use one of these approaches:
> - **Regular window** + **Incognito/Private window** (same browser)
> - **Two different browsers** (e.g., Chrome + Firefox)
> - **Two browser profiles**

1. Open **http://localhost:3000** in a **regular** browser window → Login as `alice`
2. Open **http://localhost:3000** in an **incognito/private** window (or different browser) → Login as `bob`
3. On Alice's dashboard, search for "bob" and send a challenge
4. On Bob's dashboard, accept the incoming challenge
5. Both players place shapes on their boards, then the quiz begins!

## 🎯 Game Rules

### Scoring
- **Correct answer**: Points equal to question number (Q1 = +1, Q5 = +5, Q20 = +20)
- **Dig hit** (found hidden shape cell): **+3 bonus points**
- **Wrong answer**: 0 points, no dig chance
- **Final score** = question points + dig bonus points

### Board Sizes
| Questions | Grid Size | Hidden Cells |
|-----------|-----------|-------------|
| 10        | 5×5       | ~6          |
| 20        | 7×7       | ~12         |
| 50        | 10×10     | ~30         |

### Shape Types
Random shapes including: line, L-shape, T-shape, zigzag, cross, S-shape, corner, staircase, and more. Players can rotate shapes before placing.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Real-time | Socket.IO |
| Database | SQLite (better-sqlite3) |
| Frontend | Vanilla HTML/CSS/JS |
| Auth | bcryptjs + JWT |

## 📁 Project Structure

```
├── server/
│   ├── index.js          # Express + Socket.IO server
│   ├── db.js             # SQLite database setup
│   ├── seed.js           # Database seeder
│   ├── middleware/auth.js # JWT auth middleware
│   ├── routes/            # API routes (auth, users, matches)
│   ├── game/              # Game logic (shapes, board, questions, match manager)
│   └── socket/index.js    # Socket.IO event handlers
├── public/
│   ├── index.html         # Landing page
│   ├── login.html         # Login page
│   ├── register.html      # Register page
│   ├── dashboard.html     # User dashboard
│   ├── match.html         # Game screen
│   ├── css/style.css      # Design system
│   └── js/                # Client-side JS
├── data/                  # SQLite database (auto-created)
├── .env                   # Environment variables
└── package.json
```

## 📝 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| JWT_SECRET | (required) | JWT signing key |
| QUESTION_TIME_LIMIT | 30 | Seconds per question |

## 📚 Question Categories

Python, JavaScript, Java, C++, DSA, DBMS, OS, OOP — 140+ seeded questions. Add more by editing `server/seed.js`.

## License

MIT
