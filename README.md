# 💰 Išlaidų Sekimo Programėlė

Pilna stack išlaidų sekimo sistema su React, TypeScript, Tailwind, Node.js, Prisma (SQLite) ir Nginx.

## Tech Stack

| Dalis | Technologija |
|-------|-------------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Backend | Node.js + Express + TypeScript |
| Duomenų bazė | SQLite (via Prisma ORM) |
| Autentifikacija | JWT + bcryptjs |
| Reverse Proxy | Nginx |

---

## Greita pradžia (Lokali aplinka)

### Reikalavimai
- Node.js 18+
- npm arba yarn

### 1. Backend paleisimas

```bash
cd backend

# Instaliuoti priklausomybes
npm install

# Sukurti .env failą
cp .env.example .env
# Atidaryk .env ir nustatyk JWT_SECRET į saugų slaptažodį!

# Generuoti Prisma Client ir sukurti DB
npx prisma generate
npx prisma db push

# Paleisti development serveri
npm run dev
# Serveris veikia: http://localhost:3001
```

### 2. Frontend paleisimas

```bash
cd frontend

# Instaliuoti priklausomybes
npm install

# Paleisti development serveri
npm run dev
# Programėlė veikia: http://localhost:5173
```

### 3. Nginx (neprivaloma lokaliai)

```bash
# Ubuntu/Debian
sudo apt install nginx
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf
sudo nginx -t  # Patikrinti konfigūraciją
sudo systemctl restart nginx
# Aplikacija pasiekiama: http://localhost
```

---

## Nemokamas Hosting

### Variantas A: Render.com (rekomenduojama)

**Backend:**
1. Sukurk paskyrą [render.com](https://render.com)
2. "New Web Service" → prijunk GitHub repozitoriją
3. Root directory: `backend`
4. Build command: `npm install && npx prisma generate && npx prisma db push && npm run build`
5. Start command: `npm start`
6. Environment variables:
   - `DATABASE_URL` = `file:./prod.db`
   - `JWT_SECRET` = (generuok stiprų slaptažodį)
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = (tavo frontend URL)

**Frontend:**
1. "New Static Site" → ta pati repozitorija
2. Root directory: `frontend`
3. Build command: `npm install && npm run build`
4. Publish directory: `dist`
5. Environment variables:
   - `VITE_API_URL` = (tavo backend URL, pvz. https://expense-api.onrender.com)

### Variantas B: Railway.app

```bash
# Instaliuok Railway CLI
npm install -g @railway/cli
railway login

# Backend
cd backend
railway init
railway up

# Frontend (kaip static site arba Node server)
cd frontend
railway up
```

### Variantas C: Vercel (tik frontend) + Render (backend)

Frontend į Vercel:
```bash
npm install -g vercel
cd frontend
vercel
```

---

## ENV Kintamieji

### Backend `.env`

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="minimum_32_simboliu_stiprus_slaptazodis"
PORT=3001
FRONTEND_URL="http://localhost:5173"
NODE_ENV="development"
```

### Frontend aplinkos kintamieji (jei reikia)

Vite proxy automatiškai nukreipia `/api` į `localhost:3001` dev aplinkoje.
Produkcijai nustatyk backend URL per Nginx arba environment variable.

---

## API Dokumentacija

### Autentifikacija

```
POST /api/auth/register
Body: { "email": "...", "password": "..." }
Response: { "token": "...", "user": { "id": "...", "email": "..." } }

POST /api/auth/login
Body: { "email": "...", "password": "..." }
Response: { "token": "...", "user": { "id": "...", "email": "..." } }
```

### Išlaidos (reikia JWT tokeno)

```
GET /api/expenses?month=5&year=2025
Headers: Authorization: Bearer <token>
Response: { "expenses": [...], "total": 150.00, "byCategory": {...} }

POST /api/expenses
Headers: Authorization: Bearer <token>
Body: { "category": "MAISTAS", "amount": 25.50, "note": "Lidl" }
Response: { "id": "...", "category": "MAISTAS", "amount": 25.50, ... }

DELETE /api/expenses/:id
Headers: Authorization: Bearer <token>
Response: { "message": "Išlaida sėkmingai ištrinta" }
```

### Kategorijos

| Kodas | Lietuviškai |
|-------|------------|
| `MAISTAS` | 🍽️ Maistas |
| `KURAS` | ⛽ Kuras |
| `RUBAI` | 👗 Rūbai |
| `NEBUTINOS` | 🛍️ Nebūtinos išlaidos |
| `KITOS` | 📦 Kitos išlaidos |

---

## Projekto Struktūra

```
expense-tracker/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma      # Duomenų bazės schema
│   ├── src/
│   │   ├── lib/prisma.ts      # Prisma klientas
│   │   ├── middleware/auth.ts # JWT middleware
│   │   ├── routes/
│   │   │   ├── auth.ts        # Register/Login
│   │   │   └── expenses.ts    # CRUD išlaidoms
│   │   └── index.ts           # Express serveris
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   ├── ExpenseCard.tsx
│   │   │   └── CategoryBadge.tsx
│   │   ├── hooks/useAuth.ts   # Auth state + Context
│   │   ├── pages/
│   │   │   ├── Home.tsx       # Dashboard
│   │   │   ├── Login.tsx      # Login/Register
│   │   │   └── CreateRecord.tsx # Nauja išlaida
│   │   ├── services/api.ts    # Axios API klientas
│   │   ├── types/index.ts     # TypeScript tipai
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── nginx/
    └── nginx.conf             # Reverse proxy konfigūracija
```

---

## Licencija

MIT
