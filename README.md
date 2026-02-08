# Australian Lighting & Fans - Point of Sale System

A production-ready, web-based Point of Sale system for in-store retail operations, integrated with Magento as the source of truth.

## Overview

This POS system is designed for walk-in customers at a physical retail store, providing:

- **Fast Checkout**: Optimized for speed with sub-second response times
- **Magento Integration**: Syncs products, customers, and orders
- **Role-Based Discounts**: Server-enforced discount limits
- **Quote Management**: Create and convert quotes to orders
- **CRM Features**: Log inquiries and track customer interactions
- **Comprehensive Reporting**: Sales, discounts, and conversion analytics

## Tech Stack

### Backend
- **Framework**: NestJS (Node.js)
- **Database**: MySQL
- **Authentication**: JWT
- **API Style**: REST

### Frontend
- **Framework**: React 18
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

### Integration
- Magento 2.x REST/GraphQL APIs

## Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- Magento 2.4+ (with API access)

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database and Magento credentials

# Run migrations
npm run migration:run

# Seed initial data
npm run seed

# Start development server
npm run start:dev
```

The API will be available at `http://localhost:4000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The POS UI will be available at `http://localhost:3000`

## User Roles & Permissions

| Role | Max Discount | Can Stack Discounts |
|------|-------------|---------------------|
| Sales Staff | 10% | No |
| Manager | 20% | Yes |
| Admin | Unlimited | Yes |

All discount rules are enforced server-side.

## Documentation

- [System Architecture](docs/ARCHITECTURE.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [API Contracts](docs/API_CONTRACTS.md)
- [Discount Engine](docs/DISCOUNT_ENGINE.md)
- [Magento Sync Strategy](docs/MAGENTO_SYNC.md)
- [Next Development Steps](docs/NEXT_STEPS.md)

## Project Structure

```
POS_AUS_Light/
├── docs/               # Documentation
├── backend/            # NestJS API
│   └── src/
│       ├── modules/    # Feature modules
│       └── database/   # Migrations & seeds
└── frontend/           # React POS UI
    └── src/
        ├── components/ # Reusable components
        ├── pages/      # Page components
        ├── store/      # Redux store
        └── services/   # API services
```

## Features

### Core POS
- Product search (name, SKU, barcode)
- Category filtering
- Cart management
- Cash and EFTPOS payments
- Receipt generation

### Customer Management
- Create walk-in customers
- Customer search
- Order history

### Quotes
- Create quotes from cart
- 14-day default expiry
- Convert to orders
- Printable quotes

### CRM
- Log phone calls and walk-ins
- Convert inquiries to quotes
- Follow-up tracking

### Reports
- Sales by date/user
- Discount usage
- Quote conversion rates

## Environment Variables

### Backend (.env)

```env
# Application
NODE_ENV=development
PORT=4000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=pos_user
DB_PASSWORD=your_password
DB_DATABASE=pos_aus_light

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION=8h

# Magento
MAGENTO_BASE_URL=https://your-magento-store.com
MAGENTO_ACCESS_TOKEN=your-integration-token
```

## License

Proprietary - Australian Lighting & Fans

## Support

For support, contact the development team.
