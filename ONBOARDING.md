# ParKada Project Onboarding Guide

Welcome to the ParKada team! This guide will walk you through setting up your local development environment so you can run the web apps, the mobile app, and the AI backend.

---

## 1. System Requirements

Before you clone the repository, ensure you have the following installed on your machine:

- **Node.js** (v18.0.0 or higher) - [Download](https://nodejs.org/)
- **pnpm** (v8.0.0 or higher) - We use `pnpm` as our monorepo package manager instead of `npm`. Install it globally via:
  ```bash
  npm install -g pnpm
  ```
- **Python** (v3.10 or higher) - Required for the AI/Computer Vision backend.
- **Git** - For version control.

> [!TIP]
> **Mobile App Development:** If you plan to work on the Expo mobile app, download the **Expo Go** app on your physical iOS/Android device, or install Android Studio / Xcode for local emulators.

---

## 2. Project Structure

ParKada is structured as a **monorepo**. All applications and shared configurations live in the same repository:

- `apps/admin` - The Super Admin & Guard Dashboard (React + Vite)
- `apps/portal` - The Web Portal (React + Vite)
- `apps/landing` - The Landing Page website
- `apps/mobile` - The React Native cross-platform mobile application (Expo)
- `apps/ai-node` - Python backend for AI camera streams, OCR, and vehicle tracking
- `packages/shared` - Shared configurations and components across web apps
- `database/` - Supabase SQL migration files and scripts

---

## 3. Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ParKada/ParKada-parking-webapp.git
   cd ParKada-parking-webapp
   ```

2. **Install all Node dependencies:**
   From the root folder, run:
   ```bash
   pnpm install
   ```
   *This single command will install the dependencies for all web and mobile applications simultaneously.*

3. **Set up Environment Variables:**
   You will need to create a `.env` file in the root of the project (or inside the specific app folders depending on the setup) containing the Supabase configuration:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   *(Ask the project lead for the actual development keys).*

---

## 4. Running the Applications

### Web Apps (Admin, Portal, Landing)
To start a specific web application locally, open a terminal at the root directory and use the pnpm filter command:

```bash
# Run the Admin Dashboard
pnpm --filter admin dev

# Run the Web Portal
pnpm --filter portal dev

# Run the Landing Page
pnpm --filter landing dev
```
*The apps will generally run on `http://localhost:5173` or consecutive ports.*

### Mobile App (Expo)
To start the React Native mobile app:
```bash
cd apps/mobile
pnpm start
```
This will open the Expo Metro Bundler in your browser. You can scan the QR code using the Expo Go app on your phone, or press `a` in the terminal to launch an Android Emulator.

### AI Node (Python Backend)
The AI node processes the camera feed for vehicle occupancy.

1. **Navigate to the AI directory:**
   ```bash
   cd apps/ai-node
   ```
2. **Create a virtual environment (Recommended):**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Mac/Linux:
   source venv/bin/activate
   ```
3. **Install Python dependencies:**
   ```bash
   pip install opencv-python-headless numpy ultralytics supabase python-dotenv flask flask-cors
   ```
4. **Run the AI Node:**
   Ensure your AI `.env` file is set up, then run:
   ```bash
   python occupancy_scanner.py
   ```

---

## 5. Database (Supabase)

The project relies heavily on Supabase for Auth, PostgreSQL, and Row-Level Security (RLS). 
- If you need to make database changes, refer to the SQL scripts in the `database/` folder. 
- Always ensure you run database migrations via the Supabase Dashboard SQL Editor when testing new schema changes (like new tables or RLS policies).

> [!IMPORTANT]
> If you encounter `42501` (Row-Level Security) errors while testing locally, it means your Supabase user does not have permission to execute the action. Make sure you are logged in with the correct role (e.g., `super_admin`) when testing the Admin Dashboard.
