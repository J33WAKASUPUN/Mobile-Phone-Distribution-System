# Mobile Phone Distribution System - Backend API

## 📋 Overview
Backend API for the Mobile Phone Distribution System built with Node.js, Express, and MongoDB.

## ✨ Features
- RESTful API architecture
- JWT-based authentication
- Role-based access control (RBAC) - Owner, DSR, Back-office, Warehouse
- IMEI-based inventory tracking
- Credit management system with approval workflow
- AWS S3 file storage integration
- Comprehensive error handling and logging
- Request validation with Joi
- Rate limiting and security headers

## 🛠 Tech Stack
- **Runtime**: Node.js 20.x LTS
- **Framework**: Express.js
- **Database**: MongoDB
- **File Storage**: AWS S3
- **Authentication**: JWT (JSON Web Tokens)
- **Logging**: Winston
- **Validation**: Joi
- **Security**: Helmet, express-mongo-sanitize, express-rate-limit

## 📦 Prerequisites
- Node.js >= 20.0.0
- npm >= 9.0.0
- MongoDB >= 6.0 (Local or Atlas)
- AWS Account (for S3 - optional for development)

## 🚀 Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
```bash
# Copy example env file
cp .env.example .env

# Edit .env with your configuration
# Set your MongoDB URI, JWT secret, and AWS credentials
```

### 3. Start MongoDB
**Local MongoDB:**
```bash
# Windows
net start MongoDB

# macOS/Linux
sudo systemctl start mongod
```

**MongoDB Atlas (Cloud):**
Update `MONGODB_URI` in `.env` with your Atlas connection string.

### 4. Run the Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## 🌐 API Endpoints

### Health Check
```
GET /health
```

### API Base URL
```
http://localhost:5000/api/v1
```

### Upcoming Modules (Phase-wise)
- **Phase 1**: Authentication & User Management
- **Phase 2**: Products & Inventory (IMEI-based)
- **Phase 3**: Purchasing Module
- **Phase 4**: Dealer & Credit Management
- **Phase 5**: Order Processing
- **Phase 6**: Sales & Billing
- **Phase 7**: Reporting & Analytics

## 📁 Project Structure
```
server/
├── src/
│   ├── config/              # Configuration files (DB, AWS)
│   ├── models/              # Mongoose models
│   ├── controllers/         # Route controllers
│   ├── services/            # Business logic layer
│   ├── middlewares/         # Custom middleware (auth, RBAC, validation)
│   ├── routes/              # API routes
│   ├── utils/               # Utility functions (logger, CSV, PDF)
│   ├── validations/         # Joi validation schemas
│   │   └── schemas/
│   ├── app.js               # Express app configuration
│   └── server.js            # Server entry point
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── setup.js             # Test setup
├── logs/                    # Application logs
├── .env                     # Environment variables (DO NOT COMMIT)
├── .env.example             # Example environment variables
├── .gitignore
├── package.json
└── README.md
```

## 🔧 Environment Variables

Key environment variables (see `.env.example` for full list):

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/mobile_distribution` |
| `JWT_SECRET` | JWT secret key (min 32 chars) | `your-secret-key` |
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `abc123...` |
| `AWS_S3_BUCKET_NAME` | S3 bucket name | `mobile-dist-files` |

## 🧪 Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## 🔒 Security Features
- Helmet.js for secure HTTP headers
- CORS configuration
- Rate limiting (100 req/15min per IP)
- NoSQL injection prevention
- Input validation and sanitization
- JWT with expiration
- Bcrypt password hashing (12 rounds)

## 📊 Development Timeline
- **Phase 0**: ✅ Project Setup (Complete)
- **Phase 1**: User Authentication (Week 1)
- **Phase 2**: Inventory Management (Week 1)
- **Phase 3**: Purchasing (Week 2)
- **Phase 4**: Credit Management (Week 2)
- **Phase 5**: Orders (Week 3)
- **Phase 6**: Sales & Billing (Week 3)
- **Phase 7**: Reports & Testing (Week 4)

## 🐛 Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
mongosh

# For Atlas, verify IP whitelist and credentials
```

### Port Already in Use
```bash
# Change PORT in .env file
PORT=5001
```

## 📝 License
Proprietary - Innovior (Pvt) Ltd © 2025

## 👥 Team
**Group 01** - Innovior (Pvt) Ltd

---