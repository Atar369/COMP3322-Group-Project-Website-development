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
The Kitchen Ledger is a full-stack web application for a modern Western-style restaurant named Ember & Oak. It provides an integrated digital solution for restaurant operations and customer dining services. Customers can register and log in, browse the menu, make table reservations, join and monitor a walk-in queue, place dine-in orders, review their order status, and record dish ratings and reviews. Restaurant managers can manage menu availability, process and track orders, control queue call status, maintain table bookings, and review operational and sales data through an interactive dashboard.

The system is built with React and Vite on the frontend, Node.js and Express on the backend, MySQL for persistent data storage, and Socket.io for real-time queue updates. Docker Compose is used to deploy and connect the frontend, backend, and database services on the assigned project server. JWT authentication and role-based route protection separate customer functions from manager functions.
The primary target end-user groups are:
- **Customers:** Diners who want a convenient way to reserve a table or join a walk-in queue remotely, browse an available menu, place orders, and track their dining activity.
- **Restaurant Managers:** Staff who need a central real-time system for coordinating table occupancy, queue movements, order preparation, menu availability, and customer service.
The Kitchen Ledger replaces fragmented telephone reservations, physical queue lists, and manual order tracking with one responsive and connected platform. It also provides managers with data-driven summaries of revenue, menu sales, hourly activity, and customer dining preferences to support more informed operational decisions.

### 4. Feature List

**Core Requirements (Must-have Features)**
- User Authentication: Secure registration and login functionality tailored for customers, and restaurant managers.
- Table Booking System: An interactive floor-plan table reservation module featuring party-size validation and server-side timeslot conflict checking.
- Walk-in Queue Management: A live walk-in queue system categorized by party size (Groups A, B, and C) featuring real-time 'Now Serving' status updates.
- Digital Ordering System: Comprehensive menu browsing and order placement functionalities linked directly to customer booking or queue identifiers.
- Order Tracking: Real-time order status tracking accessible to dining customers.
- Manager Operations Portal: Dedicated interface for restaurant managers to monitor and update table bookings, active queues, and incoming orders.
- Manager Analytics Dashboard: An administrative analytical interface equipped with comprehensive data visualizations:
  - Menu Item Sales Bar Chart: Comparative sales volume analysis across menu items.
  - Daily Revenue Trend Chart: Line charts tracking daily financial performance.
  - Peak Hours Visualization: Analytical distribution of hourly customer traffic.
- Responsive Design: A fully responsive user interface structured to provide an optimal viewing experience across mobile, tablet, and desktop devices.
- Data Validation: Robust client-side and server-side input validation mechanisms to maintain data integrity and security.

**Optional Enhancements (Nice-to-have Features)**
1. Takeaway and Pre-order Capabilities: Functionality enabling customers to place advance orders or arrange takeaway meals.
2. Dynamic Menu Item Visibility Management: Functionality enabling restaurant managers to dynamically remove specific menu items from the customer menu view when items are unavailable.
3. Meal Rating and Review System: Post-dining customer feedback and review module to measure service and food quality.
4. Customer Preference Analysis: Insights into diner choices and order patterns.
5. Ordering history: Enable customers to review historical order records.

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
  <img width="1897" height="987" alt="image" src="https://github.com/user-attachments/assets/0b3cd045-3a99-4861-99e9-ca1846f063fc" />

  Customer login page:  
  <img width="1897" height="993" alt="image" src="https://github.com/user-attachments/assets/cbd846ae-15a1-4924-963c-7d051cc09ee9" />

  Customer register page:  
  <img width="1897" height="990" alt="image" src="https://github.com/user-attachments/assets/804b1b7f-a553-40db-a6b3-2609c0923c7e" />

- **Step 2: Reserve Table** — The customer selects the party size, views an interactive floor plan, chooses an available table and timeslot, and confirms the reservation.

  <img width="1897" height="993" alt="image" src="https://github.com/user-attachments/assets/186f8aca-995b-4169-b9b3-9c353c7379f7" />

- **Step 3: Join Queue** — The customer enters the party size, receives a categorized queue reference number (Series A, B, or C), and monitors the live queue progression. The system also calculates the customer’s current queue position so they can see how many groups are ahead of them.

  Queue page before joining the queue:  
  <img width="1897" height="993" alt="image" src="https://github.com/user-attachments/assets/7fedca18-904b-43e9-adb9-f603a8694c64" />

  Queue page after joining the queue:  
  <img width="1897" height="999" alt="image" src="https://github.com/user-attachments/assets/aded7423-e0c5-4cc3-9597-0b00c7620000" />

- **Step 4: Place Order** — The customer enters their Booking ID or Queue ID, browses categorized menu selections (starters, mains, and desserts), adds items to the cart, and submits the order.

  Order page:  
  <img width="1897" height="1401" alt="image" src="https://github.com/user-attachments/assets/426aea07-0b78-48a8-a42a-8db8392b5afe" />

  Cart page:  
  <img width="1897" height="990" alt="image" src="https://github.com/user-attachments/assets/ca031fa8-695a-43e4-b46c-35cca5a86bd8" />

- **Step 5: Track Status** — The customer reviews live order progress, order history, queue history, booking history, and personal profile settings.

  Review order progress page:  
  <img width="1897" height="990" alt="image" src="https://github.com/user-attachments/assets/7a1209f2-b7d4-4392-bdcf-68d73370e8c6" />

  Order history page:  
  <img width="1897" height="993" alt="image" src="https://github.com/user-attachments/assets/b3842c02-20ea-464b-aa83-5a5215daa6f9" />

  Queue history page:  
  <img width="1897" height="999" alt="image" src="https://github.com/user-attachments/assets/6838054e-8f0d-44ff-af35-d95c87bfc59f" />

  Booking history page:  
  <img width="1897" height="990" alt="image" src="https://github.com/user-attachments/assets/a9159e17-3d75-4b6d-8c74-1c73de0f6945" />

  Personal information page:  
  <img width="1897" height="993" alt="image" src="https://github.com/user-attachments/assets/406dcee4-d473-44e8-9e73-9afd10a539c7" />

**Manager Workflow Journey**

- **Step 1: System Authentication** — Managers log into the system using authenticated administrative credentials.

  <img width="1897" height="984" alt="image" src="https://github.com/user-attachments/assets/4433fbe9-3805-4514-89a6-e70a750f73be" />

- **Step 2: Operations Management** — Managers view and manage active queue movements, table booking schedules, and live food orders by updating their lifecycle statuses.

  **Queue Management** — Managers call waiting groups and mark them as seated:
  - `waiting` → **Call** → `calling` (group is notified)
  - `calling` → **Seated** → `seated` (group is assigned a table)
 
  <img width="1897" height="993" alt="image" src="https://github.com/user-attachments/assets/30ba7806-e651-4c9f-9658-b92a3895ac3f" />

  **Order Management** — Managers advance kitchen order stages and confirm payment:
  - `pending` → `preparing` → `ready` → `arrived` (via **Advance Status**)
  - `arrived` → `paid` (via **Mark as Paid**)
 
  <img width="1897" height="999" alt="image" src="https://github.com/user-attachments/assets/22e667f7-4c6b-4dbd-8ba6-51504df3f6c6" />

  **Booking Management** — Managers view all confirmed and historical bookings, filterable by status (`confirmed`, `cancelled`, `completed`, `no_show`) and searchable by booking ID, date, or time.

  <img width="1897" height="1056" alt="image" src="https://github.com/user-attachments/assets/2cf1b689-5523-4564-9521-d3332c11f003" />

- **Step 3: Executive Analytics** — Managers filter operational metrics by date ranges to review sales distribution, peak service hours, and customer dining preferences.

  <img width="1897" height="993" alt="image" src="https://github.com/user-attachments/assets/1a58fee0-0ace-4c2c-9a4c-a70c4cbf64a8" />
  
### 9. Anticipated Technical Challenges & Execution Plan
1. Frontend Architecture & Full-Stack Integration (React, Vite, React Router, Context API):  
   Execution Strategy: Ensuring seamless communication across the entire stack so that all features operate reliably end-to-end (Frontend ↔ Backend ↔ Database). The team will establish clear RESTful API contracts, use Axios/Fetch abstractions with structured state management, implement localized technology prototypes, and conduct pair-programming sessions to establish unified development standards across all application layers.

2. Real-Time Synchronization & Reservation Conflict Logic:  
   Execution Strategy: The development team will initially implement short-polling protocols before upgrading to WebSocket (Socket.io) connections. Comprehensive automated unit tests will be executed for timeslot conflict validation logic prior to frontend integration.

3. Containerized Deployment & VM Configuration:  
   Execution Strategy: The infrastructure lead will establish a functional docker-compose.yml configuration early in the development cycle, secure environment variable handling, and perform staging deployments on a local Linux virtual machine prior to final release.
