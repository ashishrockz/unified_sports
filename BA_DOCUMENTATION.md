# Unified Sports Platform — Business Analyst Documentation

**Version:** 1.1
**Last Updated:** 2026-03-18
**Platform:** Multi-sport match management system
**Sports Supported:** Cricket, Tennis, Badminton, Pickleball

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [User Roles & Access Matrix](#3-user-roles--access-matrix)
4. [User App Features (Mobile)](#4-user-app-features-mobile)
5. [Admin Panel Features (Web)](#5-admin-panel-features-web)
6. [Complete API Reference (88 Endpoints)](#6-complete-api-reference-88-endpoints)
7. [WebSocket Real-Time Events](#7-websocket-real-time-events)
8. [Data Models](#8-data-models)
9. [State Machines](#9-state-machines)
10. [Cricket Match Flow (End-to-End)](#10-cricket-match-flow-end-to-end)
11. [Racket Sport Match Flow](#11-racket-sport-match-flow)
12. [Feature Summary](#12-feature-summary)

---

## 1. Project Overview

Unified Sports is a multi-sport platform that enables users to:
- Create and manage real-time sports matches (Cricket, Tennis, Badminton, Pickleball)
- Score matches ball-by-ball (cricket) or point-by-point (racket sports)
- Build a friend network and invite friends to matches
- Maintain sport-specific player statistics
- View live commentary, leaderboards, and match highlights
- Receive real-time updates via WebSocket

The platform consists of:
- **Backend API** — Node.js + Express + MongoDB REST API with WebSocket support
- **Admin Panel** — React + Vite + TypeScript web application for platform management
- **Mobile App** — (Consumer-facing, consumes the API)

---

## 2. Technology Stack

### Backend (`d:\gits\unified_sports`)
| Component | Technology |
|-----------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB (Mongoose ODM) |
| Authentication | JWT (jsonwebtoken) |
| Real-time | Socket.IO |
| API Docs | Swagger (swagger-jsdoc + swagger-ui-express) |
| Email | Nodemailer (SMTP) |
| File Upload | Multer |
| Security | bcryptjs, express-rate-limit, regex sanitization |
| Dev Tools | Nodemon |

### Admin Panel (`d:\gits\unified-admin-vite`)
| Component | Technology |
|-----------|-----------|
| Framework | React 19 + Vite |2
| Language | TypeScript |
| UI Library | shadcn/ui + Tailwind CSS v4 |
| Charts | Recharts |
| Icons | Lucide React |
| Notifications | Sonner |
| HTTP Client | Axios |
| Real-time | Socket.IO Client |

---

## 3. User Roles & Access Matrix

### Roles
| Role | Description | Auth Method |
|------|-------------|-------------|
| **User** | Regular app user (mobile) | OTP (phone/email) |
| **Admin** | Platform operator / employee | Email + Password |
| **SuperAdmin** | Platform owner / senior manager | Email + Password |

### Access Matrix
| Feature | User | Admin | SuperAdmin |
|---------|------|-------|------------|
| OTP Authentication | Yes | — | — |
| Profile Management | Yes | Yes | Yes |
| Friend System | Yes | — | — |
| Sport Stats Profiles | Yes | — | — |
| Browse Sport Types | Yes | Yes | Yes |
| Create/Manage Rooms | Yes | — | — |
| Score Matches | Yes (creator) | — | — |
| View Leaderboards | Yes | — | — |
| View Match Highlights | Yes | — | — |
| Live Commentary | Yes | — | — |
| WebSocket Live Updates | Yes | — | — |
| Admin Login | — | Yes | Yes |
| Manage Users (ban/unban) | — | Yes | Yes |
| View Rooms & Matches (read-only) | — | Yes | Yes |
| Manage Sport Types (CRUD) | — | Yes | Yes |
| Export Users | — | Yes | Yes |
| Bulk User Actions | — | Yes | Yes |
| View Dashboard & Analytics | — | Yes | Yes |
| Create/Manage Admin Accounts | — | — | Yes |
| View Audit Logs | — | — | Yes |
| Platform Dashboard (full) | — | — | Yes |

---

## 4. User App Features (Mobile)

### 4.1 Authentication (OTP-Based)

**Flow:** Phone/Email → Send OTP → Verify OTP → Auto-create account → JWT returned

| Step | Description |
|------|-------------|
| Send OTP | User provides phone number or email. A 6-digit OTP is sent (email via SMTP, phone via console/WhatsApp TBD). OTP expires in 10 minutes. Rate-limited to 10 requests per 15 minutes. |
| Verify OTP | User submits the OTP. If valid, a JWT (7-day expiry) is returned. If the user doesn't exist, an account is auto-created with `role: user`, `status: active`. |
| JWT Payload | `{ userId }` — no role in regular user tokens |

### 4.2 Profile Management

| Feature | Description |
|---------|-------------|
| View Profile | See own name, username, avatar, email, phone, friend counts (friends, incoming requests, outgoing requests, blocked) |
| Edit Profile | Update name, username (unique, 3-25 chars, lowercase + numbers + underscores), avatar URL. Phone and email are immutable. |
| Discover People | Search all users by name/username. Each result shows friendship status relative to the viewer. Paginated. Excludes admins and self. |
| View Others | View any user's public profile including their friends list (first 20) and your friendship status with them |

### 4.3 Friend System

**State Machine:**
```
(none) → send request → pending → accept → accepted → unfriend → (deleted)
                           ↓                    ↓
                        reject               block → unblock → (deleted)
```

| Action | Description |
|--------|-------------|
| Send Request | Send a friend request to any user. If the other user already sent you a request, it auto-accepts (mutual request). Cannot send to blocked users. |
| Accept Request | Accept an incoming pending request (recipient only) |
| Reject Request | Reject an incoming pending request (recipient only). Record kept as "rejected". |
| Cancel Request | Cancel your outgoing pending request (sender only). Record deleted. |
| List Friends | See all accepted friends with populated profiles |
| Unfriend | Remove an accepted friendship (either party). Record deleted. |
| Block | Block any user. Overwrites any existing relationship. |
| Unblock | Unblock a previously blocked user (original blocker only). Record deleted (clean slate). |
| Check Status | Check exact relationship status with any specific user |
| Friend Stats | Get counts: friends, incoming requests, outgoing requests, blocked |

**Business Rules:**
- Cannot send request to self
- Cannot send request to blocked user (either direction)
- Cannot send duplicate request
- Mutual request = auto-accept
- Only accepted friends can be added to match rooms

### 4.4 Sport Stats Profiles (Manual Entry)

Users can create one profile per sport. Each profile has **local stats** (club/league) and **tournament stats** (competitive events).

| Sport | Key Stats Tracked |
|-------|------------------|
| **Cricket** | Batting (matches, innings, runs, not outs, high score, average, strike rate, 100s, 50s, 4s, 6s, ducks), Bowling (wickets, overs, runs, economy, average, strike rate, best bowling, 5W, maidens), Fielding (catches, run outs, stumpings), Tournament events |
| **Tennis** | UTR rating, matches/wins/losses, singles & doubles breakdown, serve stats (aces, double faults, 1st serve %), surface stats (hard/clay/grass), tournament events with surface/category |
| **Badminton** | BWF ranking/points, matches/wins/losses, singles/doubles/mixed breakdown, performance (smash speed, rally win %, service accuracy), tournament events with discipline/BWF category |
| **Pickleball** | DUPR rating, matches/wins/losses, singles/doubles/mixed breakdown, tournament events with format/level/organization |

**Note:** These are manually entered stats, NOT auto-computed from match results.

### 4.5 Sport Type Browsing (Public)

Users can browse available match formats before creating a room.

| Feature | Description |
|---------|-------------|
| List All | See all sport types with name, sport, slug, active status. Filterable and paginated. |
| Get by ID | View full sport type configuration |
| Get by Slug | Look up by slug (e.g., "t20-cricket", "club-badminton") |
| Get Defaults | View default configuration template for any sport |

**Sport Type Configuration Fields:**
- Common: minPlayers, maxPlayers, teamSize, tossOptions, roles
- Cricket: innings (1 or 2), oversPerInnings
- Tennis: sets (best-of 3/5), gamesPerSet, deuceEnabled
- Badminton: pointsPerGame, gamesPerMatch
- Pickleball: pointsToWin, winByTwo

### 4.6 Room Lifecycle (Pre-Match)

The room creator controls the entire flow. Other players participate via WebSocket.

| Step | Action | Room Status |
|------|--------|-------------|
| 1 | Create room (sportTypeId + name) | `waiting` |
| 2 | Add players (friends or walk-ins) | `waiting` |
| 3 | Lock room (min players required) | → `toss_pending` |
| 4 | Perform toss (coin flip + choice) | `toss_pending` |
| 5 | Assign teams (A/B) + roles, start | → `active` |
| 6 | Match plays out | `active` |
| 7 | Match completes or is abandoned | → `completed` / `abandoned` |

**Business Rules:**
- One active room per user at a time (cannot be in two rooms simultaneously)
- Only accepted friends can be added as registered players
- Static (walk-in) players have no account — just a name
- Only the room creator can add/remove players, lock, toss, assign teams
- Minimum player requirement must be met before locking
- After locking, no more player changes allowed

**Player Slot Fields:**
- userId (null for static players)
- name (display name)
- isStatic (true = walk-in, no account)
- team ("A" or "B", set at start)
- role (sport-specific, e.g., "batsman", "bowler")
- isActive (boolean)

### 4.7 Match Scoring

#### Cricket (Ball-by-Ball)

| Action | Description |
|--------|-------------|
| Set Lineup | Set striker, non-striker, and bowler for current innings |
| Record Ball | Record each delivery: batsmanId, bowlerId, runs (0-6), isLegal, extras (wide/noball/bye/legbye), wicket (bowled/caught/lbw/run_out/stumped/hit_wicket + fielderId) |
| Resume Innings | After innings break, start the 2nd innings |

**Auto-Calculations:**
- Over complete after 6 legal balls
- Innings complete when all out or max overs reached
- Match auto-completes when last innings ends
- Winner determined by comparing total runs
- Margin: runs (if batting first wins) or wickets (if chasing team wins)

#### Racket Sports (Point-by-Point)

| Action | Description |
|--------|-------------|
| Record Point | Add a point to Team A or B |
| Resume Set | After set break, start the next set |

**Auto-Calculations:**
- Game won when points reach threshold (with win-by-two if enabled)
- Set won when games reach threshold
- Match won when sets reach majority (e.g., 2 of 3)

#### Manual Controls

| Action | Description |
|--------|-------------|
| Complete Match | Manually declare winner (A/B/draw/no_result) with optional margin and description |
| Abandon Match | Cancel the match. Result set to "no_result". |

### 4.8 Live Commentary (Auto-Generated)

Commentary is automatically generated for every ball (cricket) and every point (racket sports). The last 50 entries are stored on the match document and sent via WebSocket.

**Cricket Commentary Types:**

| Type | Example |
|------|---------|
| `dot` | "Tight line from Amit, no run conceded. [12/1]" |
| `single` | "Ravi works it away for a quick single. [13/1]" |
| `runs` | "Well placed! Two runs to Ravi. [15/1]" |
| `four` | "FOUR! Ravi cracks it through the covers! [19/1]" |
| `six` | "MASSIVE SIX! What a hit by Ravi! [25/1]" |
| `wicket` | "BOWLED! Amit knocks over Ravi's stumps!" |
| `extra` | "Wide ball! Extra run conceded." |
| `over_end` | "End of over 5. Team A: 42/2 after 5 overs. (8 runs this over)" |
| `milestone` | "FIFTY! Ravi reaches the half-century mark!" |
| `milestone` | "CENTURY! Ravi reaches 100! What a magnificent innings!" |
| `milestone` | "FIVE-FOR! Amit picks up 5 wickets! Outstanding bowling!" |
| `innings_end` | "End of innings! Team A finish on 156/7 in 20 overs." |
| `match_end` | "MATCH OVER! Team A win by 5 wickets!" |

**Racket Commentary Types:**

| Type | Example |
|------|---------|
| `point` | "Point to Team A! (15-10)" |
| `game_end` | "Team A wins the game! Score: 21-18." |
| `set_end` | "SET to Team A! They win it 2-1. Sets: 1-0." |
| `match_end` | "Game, set and match! Team A wins 2-1!" |

**Delivery:** Commentary is included in the match document sent with every `match:score_update` WebSocket event and can also be fetched via `GET /api/matches/:matchId/commentary`.

### 4.9 Leaderboards

| Leaderboard | Metrics | Filters |
|-------------|---------|---------|
| Cricket Batting | Runs, balls faced, 4s, 6s, highest score, strike rate, average | Period: weekly/monthly/alltime |
| Cricket Bowling | Wickets, runs conceded, overs, economy, best bowling, average | Period: weekly/monthly/alltime |
| Most Wins | Wins, losses, draws, win percentage | Sport + Period |
| Most Matches | Total matches played | Sport + Period |

Each entry includes: userId, name, username, avatar (enriched from User model).

### 4.10 Match Highlights (Auto-Generated)

Available for any match that has started. Generated on-the-fly from match data.

**Cricket Highlights:**
| Highlight | Description |
|-----------|-------------|
| Match Result | "Team A won by 5 wickets" |
| Top Scorer | Name, runs, balls, 4s, 6s, strike rate |
| Best Bowler | Name, wickets/runs, overs, economy |
| Centuries | Players who scored 100+ runs |
| Half Centuries | Players who scored 50+ runs |
| 5-Wicket Hauls | Bowlers who took 5+ wickets |
| 3-Wicket Hauls | Bowlers who took 3+ wickets |
| Most Sixes | Player with most sixes (min 2) |
| Most Fours | Player with most fours (min 3) |
| Best Strike Rate | Highest SR (min 10 balls faced, different from top scorer) |
| Best Economy | Best economy rate (min 2 overs bowled, different from best bowler) |
| Innings Summaries | Per-innings: score, overs, extras, top scorer, top bowler |

**Racket Highlights:**
| Highlight | Description |
|-----------|-------------|
| Match Result | Winner and margin |
| Set Scores | e.g., "6-4, 3-6, 7-5" |
| Sets Won | Team A vs Team B count |
| Closest Set | Tightest set (margin <= 2) |
| Total Points | Points aggregated per team |

---

## 5. Admin Panel Features (Web)

**URL:** `http://localhost:5173`
**Backend API:** `http://localhost:8080`

### 5.1 Authentication

| Feature | Description |
|---------|-------------|
| Login | Email + Password login. Returns JWT with `{ userId, role }`. |
| Forgot Password | Request password reset email (public endpoint) |
| Reset Password | Reset password using emailed token (public endpoint) |
| Change Password | Change own password (requires current password) |

### 5.2 Dashboard

| Section | Visible To | Cards Shown |
|---------|-----------|-------------|
| Users | All Admins | Total, Active, Inactive, Banned |
| Admins | SuperAdmin | Total, Active, Inactive |
| Rooms | SuperAdmin | Total, Active, Completed |
| Matches | SuperAdmin | Total, Active, Completed |
| Sport Types | SuperAdmin | Total |
| Trend Charts | All Admins | User Registrations (30 days), Matches Created, Rooms Created, Sport Popularity |

Trend charts use Recharts (AreaChart for time-series, BarChart for sport popularity).

### 5.3 User Management

| Feature | Description |
|---------|-------------|
| List Users | Paginated table with avatar, name, email, username, status, join date. Searchable by name/email/username. Filterable by status. |
| View User Detail | Full profile card with all fields, status badges, action buttons |
| Ban User | Ban a user (sets status to "banned") |
| Unban User | Restore a banned user to active |
| Activate User | Activate an inactive user |
| Deactivate User | Deactivate a user |
| Bulk Actions | Select multiple users via checkboxes, then bulk ban/unban/activate/deactivate (max 100 at once) |
| Export Users | Export user data as CSV or JSON file (with optional status filter) |
| Sortable Columns | Sort by name, status, or join date |

### 5.4 Admin Management (SuperAdmin Only)

| Feature | Description |
|---------|-------------|
| List Admins | Paginated table of all admin and superadmin accounts. Searchable. Filterable by status. Shows role badge (Admin/SuperAdmin). |
| Create Admin | Create new admin or superadmin account with name, email, password, and role selector |
| Activate Admin | Activate an admin account |
| Deactivate Admin | Deactivate an admin account |
| Remove Admin | Permanently delete an admin account (irreversible, with confirmation) |

### 5.5 Room Management (Read-Only)

| Feature | Description |
|---------|-------------|
| List Rooms | Paginated table with room name, sport, creator, player count, status. Filterable by status (waiting/toss_pending/active/completed/abandoned). |
| View Room Detail | Room info card, players table (name, type, team, role), toss details (if performed), link to associated match |

### 5.6 Match Management (Read-Only)

| Feature | Description |
|---------|-------------|
| List Matches | Paginated table with room name, sport, status, inline score display, result. Filterable by status. |
| View Match Detail | Full match state: team cards, toss info, sport-aware scoring display |
| Cricket Display | Tabbed innings view. Per-innings: score, overs, extras breakdown, over-by-over table with ball-by-ball notation (W, wd, nb, 4, 6, etc.) |
| Racket Display | Sets won banner, set-by-set cards with game-by-game point tables |

### 5.7 Sport Type Management (CRUD)

| Feature | Description |
|---------|-------------|
| List Sport Types | Paginated table with name, slug, sport badge, player range, config summary, status. Searchable. |
| Create Sport Type | Dialog form with dynamic config fields based on selected sport. Auto-loads default config. Fields: name, sport, description, minPlayers, maxPlayers, teamSize + sport-specific fields. |
| Edit Sport Type | Pre-filled dialog (sport field locked). Updates name, description, config. |
| Delete Sport Type | Confirmation dialog. Permanent deletion. |

### 5.8 Profile Management

| Feature | Description |
|---------|-------------|
| View Profile | Avatar, name, email, role badge |
| Edit Name | Update display name |
| Upload Avatar | Upload image (max 5MB, JPEG/PNG/WebP/GIF). Stored in `/uploads/` directory. |

### 5.9 Activity Logs (SuperAdmin Only)

| Feature | Description |
|---------|-------------|
| View Audit Logs | Timeline of all admin actions. Shows: action name (color-coded), target model badge, actor name, timestamp, IP, raw JSON details. |
| Filter by Action | Text filter (e.g., "user.ban", "admin.create") |
| Filter by Target | Dropdown: User/Room/Match/SportType |
| Pagination | 50 entries per page |

**Logged Actions:**

| Action | Trigger |
|--------|---------|
| `admin.login` | Admin/SuperAdmin logs in |
| `user.ban` | User is banned |
| `user.unban` | User is unbanned |
| `user.activate` | User is activated |
| `user.deactivate` | User is deactivated |
| `user.bulk_ban` | Bulk ban action |
| `user.bulk_unban` | Bulk unban action |
| `user.bulk_activate` | Bulk activate action |
| `user.bulk_deactivate` | Bulk deactivate action |
| `admin.create` | New admin account created |
| `admin.activate` | Admin account activated |
| `admin.deactivate` | Admin account deactivated |
| `admin.remove` | Admin account removed |
| `admin.profile_update` | Admin updates own profile |
| `admin.avatar_upload` | Admin uploads avatar |
| `admin.change_password` | Admin changes password |

### 5.10 Dark Mode

Toggle between light and dark themes via the Topbar. Persisted in localStorage with system preference detection.

### 5.11 Mobile Responsive

Sidebar collapses on mobile with overlay backdrop. Layout adapts for smaller screens.

### 5.12 Navigation Structure

| Menu Item | Path | Access |
|-----------|------|--------|
| Dashboard | `/dashboard` | All Admins |
| Users | `/users` | All Admins |
| Admins | `/admins` | SuperAdmin Only |
| Rooms | `/rooms` | All Admins |
| Matches | `/matches` | All Admins |
| Sport Types | `/sport-types` | All Admins |
| Activity Logs | `/activity-logs` | SuperAdmin Only |

---

## 6. Complete API Reference (88 Endpoints)

### Auth — `/api/auth` (2 endpoints)
| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 1 | POST | `/api/auth/send-otp` | Public | Send 6-digit OTP to phone/email |
| 2 | POST | `/api/auth/verify-otp` | Public | Verify OTP, return JWT + user |

### User — `/api/user` (4 endpoints)
| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 3 | GET | `/api/user` | JWT | Search/list all users (paginated) |
| 4 | GET | `/api/user/profile` | JWT | Get own full profile |
| 5 | PUT | `/api/user/profile` | JWT | Update own profile (name, username, avatar) |
| 6 | GET | `/api/user/:userId` | JWT | View any user's public profile |

### Friends — `/api/friends` (12 endpoints)
| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 7 | GET | `/api/friends` | JWT | List accepted friends |
| 8 | GET | `/api/friends/stats` | JWT | Friend counts (friends, incoming, outgoing, blocked) |
| 9 | GET | `/api/friends/requests/incoming` | JWT | List incoming pending requests |
| 10 | GET | `/api/friends/requests/outgoing` | JWT | List outgoing pending requests |
| 11 | GET | `/api/friends/status/:userId` | JWT | Check friendship status with a user |
| 12 | POST | `/api/friends/request/:userId` | JWT | Send friend request (auto-accepts if mutual) |
| 13 | PUT | `/api/friends/request/:requestId/accept` | JWT | Accept incoming request |
| 14 | PUT | `/api/friends/request/:requestId/reject` | JWT | Reject incoming request |
| 15 | DELETE | `/api/friends/request/:requestId` | JWT | Cancel outgoing request |
| 16 | DELETE | `/api/friends/unfriend/:userId` | JWT | Remove friendship |
| 17 | POST | `/api/friends/block/:userId` | JWT | Block a user |
| 18 | DELETE | `/api/friends/block/:userId` | JWT | Unblock a user |

### Sports — `/api/sports` (5 endpoints)
| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 19 | POST | `/api/sports` | JWT | Create sport stats profile (one per sport) |
| 20 | GET | `/api/sports` | JWT | List own sport profiles |
| 21 | GET | `/api/sports/:id` | JWT | Get one sport profile |
| 22 | PUT | `/api/sports/:id` | JWT | Update sport stats |
| 23 | DELETE | `/api/sports/:id` | JWT | Delete sport profile |

### Sport Types — `/api/sport-types` (7 endpoints)
| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 24 | GET | `/api/sport-types` | Public | List all sport types |
| 25 | GET | `/api/sport-types/:sportTypeId` | Public | Get sport type by ID |
| 26 | GET | `/api/sport-types/slug/:slug` | Public | Get sport type by slug |
| 27 | GET | `/api/sport-types/defaults/:sport` | Public | Get default config template |
| 28 | POST | `/api/sport-types` | Admin | Create sport type |
| 29 | PUT | `/api/sport-types/:sportTypeId` | Admin | Update sport type |
| 30 | DELETE | `/api/sport-types/:sportTypeId` | Admin | Delete sport type |

### Rooms — `/api/rooms` (10 endpoints)
| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 31 | POST | `/api/rooms` | JWT | Create room (creator = first player) |
| 32 | GET | `/api/rooms` | JWT | List rooms (filterable, paginated) |
| 33 | GET | `/api/rooms/:roomId` | JWT | Get room details |
| 34 | POST | `/api/rooms/:roomId/players/friend` | JWT | Add friend as player (creator only) |
| 35 | POST | `/api/rooms/:roomId/players/static` | JWT | Add walk-in player (creator only) |
| 36 | DELETE | `/api/rooms/:roomId/players/:slotId` | JWT | Remove player (creator only) |
| 37 | POST | `/api/rooms/:roomId/lock` | JWT | Lock room → toss_pending (creator only) |
| 38 | POST | `/api/rooms/:roomId/toss` | JWT | Perform coin toss (creator only) |
| 39 | POST | `/api/rooms/:roomId/start` | JWT | Assign teams + start match (creator only) |
| 40 | POST | `/api/rooms/:roomId/abandon` | JWT | Abandon room (creator only) |

### Matches — `/api/matches` (11 endpoints)
| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 41 | GET | `/api/matches/room/:roomId` | JWT | Get match by room |
| 42 | GET | `/api/matches/:matchId` | JWT | Get match by ID |
| 43 | GET | `/api/matches/:matchId/commentary` | JWT | Get live commentary feed (last 50) |
| 44 | POST | `/api/matches/:matchId/start` | JWT | Start match (creator only) |
| 45 | POST | `/api/matches/:matchId/complete` | JWT | Declare winner manually (creator only) |
| 46 | POST | `/api/matches/:matchId/abandon` | JWT | Abandon match (creator only) |
| 47 | POST | `/api/matches/:matchId/cricket/lineup` | JWT | Set batsmen + bowler (creator only) |
| 48 | POST | `/api/matches/:matchId/cricket/ball` | JWT | Record a delivery (creator only) |
| 49 | POST | `/api/matches/:matchId/cricket/resume-innings` | JWT | Resume after innings break (creator only) |
| 50 | POST | `/api/matches/:matchId/racket/point` | JWT | Record a point (creator only) |
| 51 | POST | `/api/matches/:matchId/racket/resume-set` | JWT | Resume after set break (creator only) |

### Admin — `/api/admin` (20 endpoints)
| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 52 | POST | `/api/admin/login` | Public | Admin login (email + password) |
| 53 | POST | `/api/admin/forgot-password` | Public | Request password reset email |
| 54 | POST | `/api/admin/reset-password` | Public | Reset password with token |
| 55 | GET | `/api/admin/me` | Admin | Get own admin profile |
| 56 | PUT | `/api/admin/me` | Admin | Update own profile |
| 57 | POST | `/api/admin/me/avatar` | Admin | Upload avatar |
| 58 | PUT | `/api/admin/me/password` | Admin | Change password |
| 59 | GET | `/api/admin/dashboard` | Admin | Dashboard stats |
| 60 | GET | `/api/admin/rooms` | Admin | List all rooms |
| 61 | GET | `/api/admin/rooms/:roomId` | Admin | Get room detail |
| 62 | GET | `/api/admin/matches` | Admin | List all matches |
| 63 | GET | `/api/admin/matches/:matchId` | Admin | Get match detail |
| 64 | GET | `/api/admin/users` | Admin | List users (paginated, searchable) |
| 65 | GET | `/api/admin/users/export` | Admin | Export users (CSV/JSON) |
| 66 | PUT | `/api/admin/users/bulk-action` | Admin | Bulk status change (max 100) |
| 67 | GET | `/api/admin/users/:userId` | Admin | Get user detail |
| 68 | PUT | `/api/admin/users/:userId/ban` | Admin | Ban user |
| 69 | PUT | `/api/admin/users/:userId/unban` | Admin | Unban user |
| 70 | PUT | `/api/admin/users/:userId/activate` | Admin | Activate user |
| 71 | PUT | `/api/admin/users/:userId/deactivate` | Admin | Deactivate user |

### SuperAdmin — `/api/superadmin` (7 endpoints)
| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 72 | GET | `/api/superadmin/dashboard` | SuperAdmin | Full platform dashboard |
| 73 | POST | `/api/superadmin/admins` | SuperAdmin | Create admin account |
| 74 | GET | `/api/superadmin/admins` | SuperAdmin | List all admins |
| 75 | GET | `/api/superadmin/admins/:adminId` | SuperAdmin | Get admin profile |
| 76 | PUT | `/api/superadmin/admins/:adminId/activate` | SuperAdmin | Activate admin |
| 77 | PUT | `/api/superadmin/admins/:adminId/deactivate` | SuperAdmin | Deactivate admin |
| 78 | DELETE | `/api/superadmin/admins/:adminId` | SuperAdmin | Remove admin (permanent) |

### Audit Logs — `/api/audit-logs` (1 endpoint)
| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 79 | GET | `/api/audit-logs` | SuperAdmin | Get admin activity logs (paginated, filterable) |

### Analytics — `/api/analytics` (1 endpoint)
| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 80 | GET | `/api/analytics/trends` | Admin | Platform trends (signups, matches, rooms, sport popularity) |

### Leaderboards — `/api/leaderboards` (4 endpoints)
| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 81 | GET | `/api/leaderboards/cricket/batting` | JWT | Top run scorers |
| 82 | GET | `/api/leaderboards/cricket/bowling` | JWT | Top wicket takers |
| 83 | GET | `/api/leaderboards/wins` | JWT | Most wins (all sports) |
| 84 | GET | `/api/leaderboards/most-matches` | JWT | Most matches played |

### Highlights — `/api/highlights` (1 endpoint)
| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 85 | GET | `/api/highlights/:matchId` | JWT | Auto-generated match highlights |

### Utility (3 endpoints)
| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 86 | GET | `/` | Public | API health check |
| 87 | GET | `/api/docs` | Public | Swagger UI documentation |
| 88 | GET | `/api/docs.json` | Public | Raw OpenAPI JSON spec |

### Summary by Auth Level
| Auth Level | Count |
|------------|-------|
| Public | 10 |
| JWT (regular user) | 49 |
| Admin (admin + superadmin) | 21 |
| SuperAdmin only | 8 |
| **Total** | **88** |

---

## 7. WebSocket Real-Time Events

**Connection:** `ws://localhost:8080` with JWT in handshake (`socket.handshake.auth.token`)

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `{ roomId }` | Subscribe to room updates |
| `leave_room` | `{ roomId }` | Unsubscribe from room |

### Server → Client
| Event | Trigger | Payload |
|-------|---------|---------|
| `room:updated` | Player add/remove, lock, status change | Full Room document |
| `toss:completed` | Toss performed | Full Room document |
| `match:started` | Match created / activated | Full Match document |
| `match:score_update` | Ball recorded / point scored | Full Match document (includes commentary[]) |
| `match:innings_break` | Cricket innings ends | Full Match document |
| `match:innings_resume` | Cricket innings resumed | Full Match document |
| `match:set_break` | Racket set ends | Full Match document |
| `match:set_resume` | Racket set resumed | Full Match document |
| `match:completed` | Match done | Full Match document |
| `match:abandoned` | Match abandoned | Full Match document |
| `joined` | Successful subscription | `{ roomId, message }` |
| `error` | Server error | `{ message }` |

**Note:** The `match:score_update` payload includes the `commentary[]` array, allowing clients to display live commentary in real-time without additional API calls.

---

## 8. Data Models

### User
| Field | Type | Description |
|-------|------|-------------|
| name | String | Display name |
| username | String | Unique, 3-25 chars, lowercase + numbers + underscores |
| phone | String | Unique, sparse |
| email | String | Unique, sparse |
| avatar | String | URL |
| role | Enum | user, admin, superadmin |
| status | Enum | active, inactive, banned |
| password | String | Hashed (admin/superadmin only) |
| resetPasswordToken | String | Password reset token (admin only) |
| resetPasswordExpires | Date | Token expiry |

### Room
| Field | Type | Description |
|-------|------|-------------|
| sportTypeId | ObjectId → SportType | Match format configuration |
| name | String | Room display name |
| creator | ObjectId → User | Room owner/organizer |
| status | Enum | waiting, toss_pending, active, completed, abandoned |
| players[] | Embedded | Array of player slots (userId, name, isStatic, team, role, isActive) |
| toss | Embedded | Toss data (coinResult, call, callerSlotId, winnerSlotId, choice, completedAt) |
| matchId | ObjectId → Match | Associated match (set after start) |
| maxPlayers | Number | Copied from sport type config |
| minPlayers | Number | Copied from sport type config |

### Match
| Field | Type | Description |
|-------|------|-------------|
| roomId | ObjectId → Room | Associated room |
| sportTypeId | ObjectId → SportType | Match format |
| sport | Enum | cricket, tennis, badminton, pickleball |
| teamA | Object | { name, players: [slotIds], captain } |
| teamB | Object | { name, players: [slotIds], captain } |
| toss | Object | { winnerTeam, choice } |
| innings[] | Embedded | Cricket: innings with overs with balls |
| currentInnings | Number | Current innings number (1-based) |
| sets[] | Embedded | Racket: sets with games |
| setsWonA/B | Number | Sets won by each team |
| currentSet/Game | Number | Current set/game (1-based) |
| commentary[] | Embedded | Auto-generated commentary entries (last 50) |
| status | Enum | not_started, active, innings_break, set_break, completed, abandoned |
| config | Mixed | Snapshot of sport type config at match creation |
| result | Object | { winner, margin, description, completedAt } |

### Friend
| Field | Type | Description |
|-------|------|-------------|
| requester | ObjectId → User | Who sent the request |
| recipient | ObjectId → User | Who received it |
| status | Enum | pending, accepted, rejected, blocked |
| blockedBy | ObjectId → User | Who blocked (only when blocked) |

### SportType
| Field | Type | Description |
|-------|------|-------------|
| name | String | e.g., "T20 Cricket" |
| slug | String | Auto-generated, unique, URL-safe |
| sport | Enum | cricket, tennis, badminton, pickleball |
| description | String | Free text |
| isActive | Boolean | Whether available for room creation |
| config | Object | Full rules engine (players, overs, sets, points, etc.) |

### AuditLog
| Field | Type | Description |
|-------|------|-------------|
| actor | ObjectId → User | Admin who performed the action |
| action | String | e.g., "user.ban", "admin.create" |
| target | String | e.g., "User:664a1f3e..." |
| targetModel | String | User, Room, Match, SportType |
| targetId | ObjectId | Target document ID |
| details | Mixed | Extra info (old/new status, updated fields, etc.) |
| ip | String | Client IP address |

### OTP
| Field | Type | Description |
|-------|------|-------------|
| identifier | String | Phone or email |
| type | Enum | phone, email |
| otp | String | 6-digit code |
| expiresAt | Date | TTL (10 minutes) — auto-deleted by MongoDB |
| used | Boolean | Whether already verified |

---

## 9. State Machines

### Room Status
```
waiting ──[lock]──> toss_pending ──[start]──> active ──> completed
    |                    |                       |
    └────────────────────┴───────[abandon]───────┘──> abandoned
```

### Match Status (Cricket)
```
not_started ──[start]──> active ──[innings end, more innings]──> innings_break
                            ^                                         |
                            └─────────[resume-innings]────────────────┘
                            |
                            ├──[last innings ends]──> completed
                            ├──[complete (manual)]──> completed
                            └──[abandon]────────────> abandoned
```

### Match Status (Racket)
```
not_started ──[start]──> active ──[set won, more sets]──> set_break
                            ^                                  |
                            └──────[resume-set]────────────────┘
                            |
                            ├──[match won]──────────> completed
                            ├──[complete (manual)]──> completed
                            └──[abandon]────────────> abandoned
```

### Friend Status
```
(none) ──[send]──> pending ──[accept]──> accepted ──[unfriend]──> (deleted)
                      |                      |
                   [reject]               [block]
                      v                      v
                  rejected              blocked ──[unblock]──> (deleted)
```

### User Status
```
active ──[deactivate]──> inactive ──[activate]──> active
   |                                                 ^
   └──────[ban]──> banned ──[unban]──────────────────┘
```

---

## 10. Cricket Match Flow (End-to-End)

| Step | API Call | Room Status | Match Status | WebSocket Event |
|------|----------|-------------|--------------|-----------------|
| 1 | `POST /api/rooms` | `waiting` | — | — |
| 2 | `POST /api/rooms/:id/players/friend` (repeat) | `waiting` | — | `room:updated` |
| 3 | `POST /api/rooms/:id/lock` | → `toss_pending` | — | `room:updated` |
| 4 | `POST /api/rooms/:id/toss` | `toss_pending` | — | `toss:completed` |
| 5 | `POST /api/rooms/:id/start` | → `active` | `not_started` | `match:started` |
| 6 | `POST /api/matches/:id/start` | `active` | → `active` | `match:started` |
| 7 | `POST /api/matches/:id/cricket/lineup` | `active` | `active` | — |
| 8 | `POST /api/matches/:id/cricket/ball` (repeat) | `active` | `active` | `match:score_update` |
| 9 | *(1st innings auto-ends)* | `active` | → `innings_break` | `match:innings_break` |
| 10 | `POST /api/matches/:id/cricket/resume-innings` | `active` | → `active` | `match:score_update` |
| 11 | `POST /api/matches/:id/cricket/lineup` | `active` | `active` | — |
| 12 | `POST /api/matches/:id/cricket/ball` (repeat) | `active` | `active` | `match:score_update` |
| 13 | *(2nd innings auto-ends)* | → `completed` | → `completed` | `match:completed` |

---

## 11. Racket Sport Match Flow

| Step | API Call | Room Status | Match Status | WebSocket Event |
|------|----------|-------------|--------------|-----------------|
| 1 | `POST /api/rooms` | `waiting` | — | — |
| 2 | Add players | `waiting` | — | `room:updated` |
| 3 | `POST /api/rooms/:id/lock` | → `toss_pending` | — | `room:updated` |
| 4 | `POST /api/rooms/:id/toss` | `toss_pending` | — | `toss:completed` |
| 5 | `POST /api/rooms/:id/start` | → `active` | `not_started` | `match:started` |
| 6 | `POST /api/matches/:id/start` | `active` | → `active` | `match:started` |
| 7 | `POST /api/matches/:id/racket/point` (repeat) | `active` | `active` | `match:score_update` |
| 8 | *(set auto-ends)* | `active` | → `set_break` | `match:set_break` |
| 9 | `POST /api/matches/:id/racket/resume-set` | `active` | → `active` | `match:score_update` |
| 10 | `POST /api/matches/:id/racket/point` (repeat) | `active` | `active` | `match:score_update` |
| 11 | *(match auto-ends)* | → `completed` | → `completed` | `match:completed` |

---

## 12. Feature Summary

### Backend Modules (15)
| Module | Endpoints | Description |
|--------|-----------|-------------|
| Auth | 2 | OTP send/verify |
| User | 4 | Profile management + discovery |
| Friends | 12 | Full friend lifecycle |
| Sports | 5 | Manual sport stats profiles |
| SportType | 7 | Match format configuration |
| Room | 10 | Room lifecycle + toss |
| Match | 11 | Scoring + commentary |
| Admin | 20 | User management + oversight |
| SuperAdmin | 7 | Admin management |
| AuditLog | 1 | Activity tracking |
| Analytics | 6 | Platform trends, engagement, growth, match analytics, revenue |
| Leaderboards | 4 | Player rankings |
| Highlights | 1 | Match highlights |
| WebSocket | — | Real-time events (12 events) |
| Utility | 3 | Health + Swagger docs |

### Admin Panel Pages (13)
| Page | Description |
|------|-------------|
| Login | Email + password authentication |
| Dashboard | Stats cards + trend charts |
| User List | Manage users (search, filter, sort, bulk, export) |
| User Detail | Full user profile + actions |
| Admin List | Manage admin accounts (SuperAdmin only) |
| Room List | View rooms (read-only) |
| Room Detail | Room info + players + toss |
| Match List | View matches with inline scores |
| Match Detail | Full scoring display (cricket/racket) |
| Sport Type List | CRUD sport types with dynamic config |
| Profile | Edit profile + avatar upload |
| Activity Logs | Audit trail (SuperAdmin only) |
| Settings | Dark mode, change password |

### Platform Totals
| Metric | Count |
|--------|-------|
| REST API Endpoints | 93 |
| WebSocket Events | 12 (10 server→client, 2 client→server) |
| Database Models | 8 (User, Room, Match, Friend, SportType, AuditLog, OTP, PasswordResetToken) |
| Admin Panel Pages | 13 |
| Sports Supported | 4 (Cricket, Tennis, Badminton, Pickleball) |
| User Roles | 3 (User, Admin, SuperAdmin) |

---

## 13. v1.1 Changelog (2026-03-18)

### Fixes Applied
| Issue | Severity | Resolution |
|-------|----------|------------|
| Analytics page called 4 non-existent backend endpoints (`/engagement`, `/platform-summary`, `/growth`, `/revenue`) | **Critical** | Added all 4 endpoints + a 5th (`/match-analytics`) with Swagger docs |
| Password reset tokens stored in-memory (`Map()`) — lost on restart | **Critical** | Created `PasswordResetToken` MongoDB model with TTL auto-expiry |
| Admin dashboard showed only 4 user count cards | **Enhancement** | Added match stats, pie chart, recent signups table, recent matches table |

### New Analytics Endpoints (5 added)
| Endpoint | Description |
|----------|-------------|
| `GET /api/analytics/platform-summary` | Total users, matches, rooms, sport types |
| `GET /api/analytics/engagement` | Active users, matches per user, avg session duration |
| `GET /api/analytics/growth` | Period-over-period growth rates for users & matches |
| `GET /api/analytics/revenue` | Revenue stub (placeholder for payment integration) |
| `GET /api/analytics/match-analytics` | Completion/abandon rates, avg duration by sport, peak usage hours |

### Enhanced Admin Dashboard
- **Match stats section:** total, completed, active, abandoned counts
- **Match status pie chart:** visual breakdown of match outcomes
- **Recent signups table:** last 10 user registrations with status badges
- **Recent matches table:** last 10 matches with sport, room, status, date

---

## 14. Known Gaps & Recommendations for Admin/Stakeholders

### What's Production-Ready
1. Complete multi-sport scoring engine (ball-by-ball cricket, point-by-point racket)
2. Robust RBAC with User/Admin/SuperAdmin role hierarchy
3. Real-time WebSocket events for live match updates
4. Comprehensive audit logging of all admin actions
5. 93 documented API endpoints with Swagger
6. Mobile app with 10-language i18n support
7. Friend system with full request lifecycle
8. App configuration (maintenance mode, announcements, SMTP/SMS testing)

### Remaining Gaps (Priority Order)
| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| 1 | **No automated tests** — 0 backend tests, 0 frontend tests | High risk of regressions | Medium |
| 2 | **No push notifications** — no FCM/APNs integration | Users miss updates when app is closed | Medium |
| 3 | **No user reporting/flagging** — no moderation workflow | Can't handle misconduct reports | Medium |
| 4 | **No CI/CD pipeline** — no automated deploy or quality gates | Manual error-prone deployments | Low-Medium |
| 5 | **File storage is local** — uploads on disk, not cloud (S3/Cloudinary) | Not scalable for multi-instance | Low |
| 6 | **No payment/subscription system** — revenue hook is a stub | No monetization | High (scope) |
| 7 | **No analytics data export** — no PDF reports for stakeholders | Manual reporting | Low |
| 8 | **No WebSocket rate limiting** — potential abuse vector | Security risk | Low |
| 9 | **No admin activity summary** — audit logs exist but no visual dashboard | Harder to track admin performance | Low |

### Quick Wins (High visibility, low effort)
- Add unit tests for scoring engine (highest business value code)
- Add Firebase Cloud Messaging for match result notifications
- Add CSV/PDF export button to analytics page
- Add admin activity summary cards on audit logs page

---

*Documentation generated for Unified Sports Platform v1.1*
*Swagger UI available at: `/api/docs`*
*OpenAPI JSON spec at: `/api/docs.json`*
