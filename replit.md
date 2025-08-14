# Overview

RecruiterTracker is a modern AI-powered recruitment management platform built with React/TypeScript frontend and Node.js/Express backend. The system streamlines the recruitment process by allowing recruiters to manage jobs, candidates, and submissions while integrating OpenAI for resume analysis and matching capabilities. Key features include duplicate candidate prevention, intelligent resume processing, comprehensive tracking of the recruitment pipeline from initial submission to final hiring decisions, and robust analytics with success/rejection rate calculations.

## Recent Changes (August 14, 2025)

**Comprehensive Test Suite Implementation**
- Added complete Jest-based testing framework with TypeScript support
- Created 8 comprehensive test files covering all major services
- Implemented both success and failure scenario testing
- Added proper mocking for external dependencies (OpenAI, database)
- Enhanced analytics calculations with success rate (Approved/Total × 100) and rejected rate (Rejected/Total × 100)
- Added rejected rate column to reports with color-coded badges (Green ≤30%, Yellow 31-50%, Red >50%)
- Updated CSV export to include both success and rejected rate metrics

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript and Vite for fast development and building
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and dark mode support
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod schema validation

## Backend Architecture
- **Runtime**: Node.js with TypeScript and ESM modules
- **Framework**: Express.js for REST API endpoints
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Session-based authentication with role-based access control
- **File Processing**: Multer for file uploads, Mammoth for DOCX parsing, pdf-parse for PDF extraction
- **AI Integration**: OpenAI GPT-4 for resume analysis, job matching, and content generation

## Data Storage Solutions
- **Primary Database**: PostgreSQL for all application data
- **Schema Management**: Drizzle ORM with migration support
- **File Storage**: Local filesystem for resume uploads (configurable for cloud storage)
- **Session Storage**: Database-backed sessions using connect-pg-simple

## External Dependencies

### AI Services
- **OpenAI API**: GPT-4 model for resume analysis, job description parsing, and candidate matching with confidence scoring

### Database & ORM
- **PostgreSQL**: Primary relational database
- **Drizzle ORM**: Type-safe database operations and schema management
- **@neondatabase/serverless**: Serverless PostgreSQL driver support

### Document Processing
- **mammoth**: Microsoft Word (.docx) document text extraction
- **pdf-parse**: PDF document text extraction and parsing

### Authentication & Security
- **connect-pg-simple**: PostgreSQL session store for Express sessions
- **Crypto polyfills**: Cross-platform cryptographic functions for both development and production environments

### Development & Build Tools
- **Vite**: Fast frontend build tool with hot module replacement
- **esbuild**: Fast JavaScript bundler for production builds
- **PM2**: Production process manager for application deployment
- **cross-env**: Cross-platform environment variable handling