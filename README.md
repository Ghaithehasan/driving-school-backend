# Driving School Backend

Backend API for a driving school management system built with **NestJS**, **TypeScript**, **PostgreSQL**, **TypeORM**, and **Docker**.

This project is designed for managing a driving school workflow, including students, instructors, vehicles, bookings, payments, government certificate requests, expenses, and notifications.

---

## Project Overview

The system is built to support both:

* Student mobile application
* Admin web dashboard

The backend is responsible for handling:

* Authentication and user accounts
* Students, instructors, and staff members
* Instructor availability and unavailable periods
* Vehicle management and vehicle unavailable periods
* Lesson booking and scheduling
* Booking payments and financial charges
* ShamCash payment integration
* Government certificate service workflow
* Operational expenses
* Instructor earnings and payouts
* Notifications

---

## Tech Stack

* **NestJS** - Backend framework
* **TypeScript** - Main programming language
* **PostgreSQL** - Relational database
* **TypeORM** - ORM for database access and migrations
* **Docker Compose** - Local database and pgAdmin environment
* **pgAdmin** - PostgreSQL database GUI
* **JWT** - Authentication token strategy
* **Passport** - Authentication middleware strategy
* **bcrypt** - Password hashing

---

## Current Project Setup

The project currently includes:

* NestJS project initialized
* PostgreSQL running through Docker
* pgAdmin running through Docker
* TypeORM connected to PostgreSQL
* Global API prefix configured as `/api/v1`
* Global ValidationPipe configured
* Global Exception Filter configured
* Environment variables support using `.env`
* Basic project structure ready for coding

---

## Main Domain Modules

The backend will be organized into the following modules:

```text
src
├── common
│   ├── decorators
│   ├── dto
│   ├── enums
│   ├── filters
│   ├── guards
│   ├── interceptors
│   └── utils
│
├── database
│   ├── database.module.ts
│   └── migrations
│
└── modules
    ├── auth
    ├── users
    ├── students
    ├── instructors
    ├── staff-members
    ├── vehicles
    ├── instructor-availability
    ├── bookings
    ├── payments
    ├── shamcash
    ├── certificates
    ├── expenses
    └── notifications
```

---

## Business Scope

### Users

The system supports three main user types:

* Student
* Instructor
* Staff member

The `users` table represents the shared account data, while each role has its own related table for role-specific information.

---

### Bookings

A booking connects:

* Student
* Instructor
* Vehicle
* Training type
* Date and time
* Payment status

Bookings are created for driving lessons with a fixed session duration.

Available booking slots are generated dynamically based on:

* Instructor weekly availability
* Instructor unavailable periods
* Existing instructor bookings
* Vehicle status
* Vehicle unavailable periods
* Existing vehicle bookings

The system does not store available slots directly. It calculates them when needed.

---

### Vehicles

Vehicles can be used for school-provided lessons.

Each vehicle has:

* Training type
* Plate number
* Model
* Color
* General status

Vehicle temporary unavailability, such as maintenance, is stored separately in `vehicle_unavailable_periods`.

---

### Payments

The financial system is based on three main concepts:

```text
student_charges  = what the student must pay
student_payments = what the school actually received
payment_proofs   = uploaded external payment proofs, when needed
```

The system supports:

* Booking deposit fee
* Lesson remaining fee
* Certificate service fee
* Practical exam retake fee
* Theoretical exam retake fee
* Certificate transport fee

---

### ShamCash Integration

The project will support ShamCash integration for payment verification.

The planned architecture separates internal payment logic from external payment provider logic:

```text
payments = internal financial records
shamcash = external ShamCash API integration
```

This keeps the payment system clean and maintainable.

---

### Government Certificate Service

The system supports managing government certificate requests.

This includes:

* Creating certificate requests
* Registering student personal photo
* Creating service fee charge
* Managing government training sessions
* Recording practical exam results
* Recording theoretical exam results
* Creating retake fees when the student fails an exam

---

### Expenses

The system supports recording operational expenses such as:

* Vehicle fuel
* Vehicle maintenance
* Vehicle cleaning
* Vehicle license or insurance
* Office rent
* Electricity
* Water
* Internet and communications
* Office supplies
* Government service cost
* Transport cost
* Staff salary
* Instructor payout
* Other expenses

Vehicle-related expenses may be linked to a specific vehicle.

---

## API Prefix

All API routes are prefixed with:

```text
/api/v1
```

Example:

```text
http://localhost:3000/api/v1
```

Future endpoints will follow this style:

```text
/api/v1/auth/login
/api/v1/users
/api/v1/students
/api/v1/instructors
/api/v1/vehicles
/api/v1/bookings
/api/v1/payments
```

---

## Environment Variables

Create a `.env` file in the project root.

Example:

```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=driving_school_user
DB_PASSWORD=driving_school_password
DB_NAME=driving_school_db
```

Do not commit the real `.env` file.

Use `.env.example` as a safe template for other developers.

---

## Docker Services

The local development environment uses Docker Compose for:

* PostgreSQL
* pgAdmin

Current services:

```text
postgres  -> PostgreSQL database
pgadmin   -> PostgreSQL GUI
```

---

## Running the Database

Start Docker services:

```bash
sudo docker compose up -d
```

Check running containers:

```bash
sudo docker ps
```

You should see:

```text
driving_school_postgres
driving_school_pgadmin
```

---

## pgAdmin Access

Open pgAdmin:

```text
http://localhost:5050
```

Login credentials:

```text
Email: admin@drivingschool.com
Password: admin_password
```

Register PostgreSQL server inside pgAdmin:

```text
Host name/address: postgres
Port: 5432
Maintenance database: driving_school_db
Username: driving_school_user
Password: driving_school_password
```

Important note:

* Use `postgres` as host inside pgAdmin.
* Use `localhost` as host inside NestJS `.env`.

---

## Install Dependencies

```bash
npm install
```

---

## Run the Backend

Development mode:

```bash
npm run start:dev
```

The application should run on:

```text
http://localhost:3000/api/v1
```

---

## TypeORM Connection

The project connects to PostgreSQL using TypeORM.

The database connection is configured inside:

```text
src/database/database.module.ts
```

The connection reads values from `.env` using `ConfigService`.

Current TypeORM configuration uses:

```text
synchronize: false
```

This means database schema changes should be handled through migrations, not automatic synchronization.

---

## Why synchronize is disabled

We keep:

```ts
synchronize: false
```

because automatic schema synchronization can be dangerous in real projects.

The project should use migrations for database schema changes so the team can track every change clearly.

---

## Global Validation

The project uses a global ValidationPipe.

This helps protect the API from invalid or unexpected request data.

Configured behavior:

```text
whitelist: true
forbidNonWhitelisted: true
transform: true
```

Meaning:

* Unknown fields are rejected
* DTO validation is enforced
* Request values can be transformed based on DTO types

---

## Global Exception Filter

The project includes a global exception filter to standardize error responses across the whole API.

All errors should follow a consistent shape:

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Resource not found",
  "error": "Not Found",
  "path": "/api/v1/example",
  "method": "GET",
  "timestamp": "2026-06-17T00:00:00.000Z"
}
```

This makes error handling easier for the frontend and mobile application.

---

## Authentication Plan

Authentication will use:

* JWT access token
* Passport JWT strategy
* bcrypt password hashing

The expected login flow:

```text
1. User enters phone number and password
2. Backend validates credentials
3. Backend generates JWT access token
4. Client sends token in Authorization header
5. Protected routes validate token using JwtStrategy
```

Example header:

```text
Authorization: Bearer <access_token>
```

---

## Branching Strategy

Recommended branches:

```text
main       -> stable version
develop    -> development integration branch
feature/*  -> feature branches
fix/*      -> bug fix branches
```

Examples:

```bash
git checkout -b feature/auth
git checkout -b feature/users
git checkout -b feature/bookings
git checkout -b feature/payments
git checkout -b feature/shamcash-integration
```

Do not work directly on `main`.

---

## Recommended Development Order

The recommended implementation order is:

```text
1. Users, students, instructors, staff members
2. Vehicles
3. Instructor availability
4. Bookings
5. Lesson price rules
6. Student charges and payments
7. ShamCash integration
8. Government certificate requests
9. Expenses
10. Notifications
```

This order keeps the project stable because bookings depend on users, instructors, vehicles, and availability.

---

## Useful Commands

Start Docker services:

```bash
sudo docker compose up -d
```

Stop Docker services:

```bash
sudo docker compose down
```

Check containers:

```bash
sudo docker ps
```

Run NestJS in development mode:

```bash
npm run start:dev
```

Build the project:

```bash
npm run build
```

Run tests:

```bash
npm run test
```

---

## Project Status

The project is currently in the initial setup phase.

Completed:

* Repository created
* NestJS initialized
* Docker Compose configured
* PostgreSQL connected
* pgAdmin configured
* TypeORM connected
* Global API prefix configured
* Global validation configured
* Global exception filter configured

Next phase:

* Create base modules
* Define entities
* Create initial migrations
* Start implementing authentication and users module

---

## Notes for Developers

* Never commit `.env`
* Keep `.env.example` updated
* Do not enable `synchronize: true`
* Use migrations for database changes
* Use DTOs for request validation
* Use global exceptions instead of custom error shapes in every controller
* Keep business logic inside services
* Keep controllers thin and focused on request/response handling
* Use feature branches and pull requests for collaboration
