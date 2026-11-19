# COMP3322 - PROJECT PROPOSAL
## The Kitchen Ledger

### 1. Member Information

| Full Name          | Student Number |
|--------------------|----------------|
| Chau Wai Yee       | 3036336168     |
| Chung Ka Yi        | 3036058247     |
| Chiu Wing Tung     | 3036216667     |
| Shiyu Zhang        | 3036717477     |
| Wu Wing Yan        | 3036440983     |

### 2. Project Title
The project title is formally designated as The Kitchen Ledger.

### 3. Project Description
The Kitchen Ledger is a full-stack web application for Ember & Oak, a Western fine-dining restaurant. It brings customer dining services and restaurant operations together in one platform. Customers can create and verify an account, browse and filter the menu, book a table with optional pre-order courses, join and monitor a walk-in queue, place dine-in orders, and review their booking and order histories. Customers can also manage their personal information, change their password, and rate menu items. Restaurant managers can oversee menu items, bookings, queue activity, orders and table bills, and review service and sales metrics through a date-filterable dashboard.

The system is built with React and Vite on the frontend, Node.js and Express on the backend, MySQL for persistent data storage, and Socket.io for real-time queue updates. Docker Compose is used to deploy and connect the frontend, backend, and database services on the assigned project server. JWT authentication and role-based route protection separate customer functions from manager functions.
The primary target end-user groups are:
- **Customers:** Diners who want to book ahead or join the walk-in queue, browse the menu, pre-order courses, order while seated, and keep track of their dining activity.
- **Restaurant Managers:** Staff who need a central system for coordinating bookings, queue movements, menu items, active orders, table bills, and service performance.
The Kitchen Ledger replaces fragmented telephone reservations, physical queue lists, and manual order tracking with one connected platform. It also gives managers summaries of paid revenue, order volume, popular dishes, and service performance over a selected date range.

### 4. Feature List

**Customer Features**
- Account registration, email verification, login, password recovery, and account security measures.
- Menu browsing with food-type and price filters, sale labels, ratings, and reviews.
- Table booking by date, time, and party size, with optional special requests and pre-order courses. Tables are assigned automatically.
- Walk-in queue tickets for party sizes of 1–12, grouped into A (1–2), B (3–6), and C (7+) with live queue updates and daily ticket numbers. If a number is missed and the number being called is within 25 tickets, staff can return the customer to the queue with priority.
- Dine-in ordering and order history, plus booking management and booking history.
- Personal information and password management, including visibility of accumulated booking-cancellation flags.

**Manager Features**
- Dashboard date-range controls and service metrics, including paid revenue, paid orders, top-selling dishes, revenue trends, and best-selling dishes.
- Menu, booking, and queue management.
- Active order and table-bill management, including order totals and payment collection tracking.
- Manager account registration and manager-only access to operational features.

**Restaurant Rules and Validation**
- Restaurant hours are 10:00 AM–10:00 PM. Walk-in queue tickets are issued from 10:00 AM–9:00 PM.
- Bookings use one-hour dining slots, and a table is auto-assigned. Customers may cancel up to 11:59 PM Hong Kong time on the day before a booking; each cancellation adds a permanent flag, and four flags disable the account.
- Seated customers may order within 45 minutes of seating, but no later than 9:45 PM. Customers can request payment when ready; managers record payment after collection.
- Customer and manager forms validate input. Five consecutive failed login attempts temporarily lock an account for 15 minutes.

**Potential Future Enhancements**
- Takeaway ordering.
- Expanded analysis of customer preferences and order patterns.

### 5. Full Technology Stack

| Layer                    | Technology Standard                                      |
|--------------------------|----------------------------------------------------------|
| Frontend Framework       | React (Vite) with React Router                           |
| Backend Services         | Node.js with Express framework (RESTful API architecture)|
| Database System          | MySQL relational database                                |
| Real-time Communication  | WebSocket protocol (Socket.io)                           |
| Data Visualization       | Recharts library                                         |
| Deployment Environment   | Docker and Docker Compose on Linux Virtual Machine       |
| Security & Auth          | JSON Web Tokens (JWT) for session authentication         |

### 6. Preliminary Team Task Allocation

| Team Member | Primary Operational Responsibilities |
|-------------|--------------------------------------|
| **Chung Ka Yi (Kelly)** | **Frontend Development:** Develop responsive React components and pages, implement customer and manager interface layouts, integrate frontend state and API calls, and refine user flows for navigation, authentication, booking, queue, menu, ordering, and account management. |
| **Chau Wai Yee** | **Frontend Development:** Design and implement the visual presentation and responsive user experience, develop shared UI components, and support integration of customer-facing and manager-facing pages with backend APIs. |
| **Chiu Wing Tung** | **Business Logic Backend:** Implement and maintain Express routes and controllers, reservation and booking conflict logic, order management APIs, and Socket.io integration for real-time queue and operational updates. |
| **Shiyu Zhang** | **Database Architecture and Analytics:** Design and maintain the MySQL schema and seed data, define data relationships and constraints, implement analytical SQL queries, and support the manager dashboard's sales and operational visualizations. |
| **Wu Wing Yan** | **Authentication and Queue Backend:** Implement database integration, user registration and login with JWT and bcrypt, account verification and security middleware, queue management APIs, and supporting queue workflows. |

### 7. Problem Statement & Target User Context
A significant number of food and beverage establishments continue to rely on manual phone reservations and physical waitlists for managing customer access. This traditional methodology frequently results in operational inefficiencies, including table double-bookings, and extended customer wait times.

The Kitchen Ledger addresses these industry challenges by establishing a unified, web-based operational platform designed to support three key functions:
- Digital Queueing & Reservations: Customers can remotely reserve dining timeslots or join live queue rosters directly from personal mobile devices.
- Operational Oversight: Managers gain real-time visibility into table occupancy and queue sequences.
- Data-Driven Decisions: Management receives detailed analytical reporting on sales, popular menu items, and peak service hours to guide strategic decision-making.

A browser-based web application is optimal for this deployment because both customers and managers can access the platform from any internet-enabled device without requiring native software installation. While commercial alternatives exist within the market, they are frequently cost-prohibitive for independent establishments or lack a unified architecture that integrates ordering workflows directly with operational business analytics.

### 8. High-Level System Workflow

**Customer Workflow Journey**

- **Step 1: Access Platform** — The customer accesses the system landing page and chooses to log in or register a new account.

  System landing page:  
  <img width="1200" alt="Ember & Oak landing page" src="https://github.com/user-attachments/assets/b501d941-c6f8-48c4-8611-cd9e23219678" />

  Customer login page:  
  <img width="1200" alt="Customer login page" src="https://github.com/user-attachments/assets/6441b481-7a87-4e54-a934-059a53181abe" />

  Customer register page:  
  <img width="1200" alt="Customer registration page" src="https://github.com/user-attachments/assets/19bf743a-f7e7-445c-9274-a572702719c3" />

- **Step 2: Reserve Table** — The customer chooses a date, time, and party size, optionally adds a special request and pre-order courses, and confirms the booking. The system assigns a table automatically.

  <img width="1200" alt="Book a table form" src="https://github.com/user-attachments/assets/861c17bc-e645-49a1-b64b-a63538a290b8" />

- **Step 3: Join Queue** — The customer chooses a party size from 1–12 and receives a daily ticket in the corresponding group: A (1–2 people), B (3–6), or C (7+). The queue page displays the current calls and the customer’s ticket status, and updates as the queue progresses.

  Queue page before joining the queue:  
  <img width="1200" alt="Join the waiting list" src="https://github.com/user-attachments/assets/44fdf6cf-973e-4985-84c3-7cafcada87a3" />

  Queue page after joining the queue:  
  <img width="1200" alt="Queue ticket and live status" src="https://github.com/user-attachments/assets/382e7f6d-abaf-4de5-97a8-abf5abc23a8e" />

- **Step 4: Browse the Menu and Order** — Customers can filter menu items by food type and price, view item descriptions and ratings, and add dishes to their cart. Seated customers can place dine-in orders within the restaurant’s ordering period.

  Customer menu:

  <img width="1200" alt="Customer menu with filters and dish ratings" src="https://github.com/user-attachments/assets/dcfc46cb-bead-447f-b928-9a619f852091" />

  Customer orders and cart:

  <img width="1200" alt="Customer orders and table bills" src="https://github.com/user-attachments/assets/0b766f7d-c6ff-43ef-80c0-3d49d58c0b4a" />

- **Step 5: Manage Dining Activity** — Customers can review order and booking histories, manage upcoming bookings and their pre-order courses, monitor queue progress, and update personal information or their password.

  Order history page:  
  <img width="1200" alt="Customer order history" src="https://github.com/user-attachments/assets/ae8fc582-7c0f-4667-89ca-7e29cdc586d8" />

  Queue history page:  
  <img width="1897" height="999" alt="image" src="https://github.com/user-attachments/assets/6838054e-8f0d-44ff-af35-d95c87bfc59f" />

  Booking management page:

  <img width="1200" alt="Upcoming booking management" src="https://github.com/user-attachments/assets/9e65d36a-30fd-46be-8b22-c12aefd8f39e" />

  Booking history page:  
  <img width="1200" alt="Customer booking history" src="https://github.com/user-attachments/assets/694d2874-6553-4404-99b0-908266733b59" />

  Personal information page:  
  <img width="1200" alt="Customer personal information and cancellation flags" src="https://github.com/user-attachments/assets/8ec317a3-c3fa-40be-8f14-1d69cc729817" />

**Manager Workflow Journey**

- **Step 1: System Authentication** — Managers log in through the staff entry point. An existing manager can register another manager account.

  Role selection:

  <img width="1200" alt="Welcome page with customer and manager sign-in options" src="https://github.com/user-attachments/assets/cb7ae595-7c56-4910-9458-851d19a4ea86" />

  Manager login:

  <img width="1200" alt="Manager login page" src="https://github.com/user-attachments/assets/2adeeb7a-8be9-46fd-bbad-b96907c23cd1" />

  New manager registration:

  <img width="1200" alt="Manager registration page" src="https://github.com/user-attachments/assets/5e9db104-71ea-493e-a905-e392e983f820" />

- **Step 2: Operations Management** — Managers use the operations portal to oversee queue movements, bookings, menu items, active food orders, and table bills.

  **Queue Management** — Managers call waiting groups and mark them as seated:
  - `waiting` → **Call** → `calling` (group is notified)
  - `calling` → **Seated** → `seated` (group is assigned a table)
 
  <img width="1897" height="993" alt="image" src="https://github.com/user-attachments/assets/30ba7806-e651-4c9f-9658-b92a3895ac3f" />

  **Order Management** — Managers advance kitchen order stages and confirm payment:
  - `pending` → `preparing` → `ready` → `arrived` (via **Advance Status**)
  - `arrived` → `paid` (via **Mark as Paid**)
 
  <img width="1200" alt="Manager orders and table payment management" src="https://github.com/user-attachments/assets/54a13098-61e0-491b-a3d1-c22facb2a6be" />

  **Booking Management** — Managers oversee the restaurant’s booking schedule and booking records.

  <img width="1897" height="1056" alt="image" src="https://github.com/user-attachments/assets/2cf1b689-5523-4564-9521-d3332c11f003" />

- **Step 3: Service Analytics** — Managers select a date range and review paid revenue, paid-order counts, top-selling dishes, revenue trends, and dish sales.

  <img width="1200" alt="Manager dashboard with date range and service metrics" src="https://github.com/user-attachments/assets/7d605a70-57ca-46b2-b285-c67f67c43da7" />
  
### 9. Anticipated Technical Challenges & Execution Plan
1. Frontend Architecture & Full-Stack Integration (React, Vite, React Router, Context API):  
   Execution Strategy: Ensuring seamless communication across the entire stack so that all features operate reliably end-to-end (Frontend ↔ Backend ↔ Database). The team will establish clear RESTful API contracts, use Axios/Fetch abstractions with structured state management, implement localized technology prototypes, and conduct pair-programming sessions to establish unified development standards across all application layers.

2. Real-Time Synchronization & Reservation Conflict Logic:  
   Execution Strategy: The development team will initially implement short-polling protocols before upgrading to WebSocket (Socket.io) connections. Comprehensive automated unit tests will be executed for timeslot conflict validation logic prior to frontend integration.

3. Containerized Deployment & VM Configuration:  
   Execution Strategy: The infrastructure lead will establish a functional docker-compose.yml configuration early in the development cycle, secure environment variable handling, and perform staging deployments on a local Linux virtual machine prior to final release.
