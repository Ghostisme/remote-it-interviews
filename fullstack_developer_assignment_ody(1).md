# Fullstack Developer Assignment — Odyssey

## Objective

Build a small fullstack restaurant operations product using the same stack and architectural approach we use at Odyssey.

You are not working inside our codebase. You should create your own project from scratch, but it should follow the same core stack, structure, and engineering standards.

We are evaluating frontend quality, backend design, type safety, architecture, UX, and execution speed.

## AI-First Expectation

This assignment is intended to be completed heavily with AI tools.

You are free to use AI as much as you want for planning, implementation, debugging, testing, and polish. We will evaluate not just the final result, but how well you use AI: setting good guardrails, steering it clearly, reviewing output critically, and keeping the implementation clean and coherent.

The final quality will still show how strong your actual understanding of code, architecture, and product thinking is. Generic or poorly integrated AI-generated work will be a negative signal.

## Timebox

Target: 1–2 days.

We care about scope judgment as much as completeness.

## Required Stack

Use this stack:

- pnpm workspace + Turborepo
- `apps/dashboard`: Expo + React Native + Web
- `services/backend`: Hono on Cloudflare Workers
- PostgreSQL + Drizzle ORM
- drizzle-zod
- OpenAPI generation
- Orval-generated client/hooks
- React Query
- shared packages for UI/utilities/types

Use a repo structure shaped roughly like this:

```text
apps/dashboard
services/backend
packages/shared
packages/types
packages/api-client
```

Do not replace the stack with alternatives like Next.js, NestJS, Prisma, tRPC, Supabase, Firebase, or handwritten frontend API types.

## Part 1 — Design System and Dashboard

Build a polished restaurant dashboard with a clear, reusable design system.

Your design system should include at minimum:

- color tokens
- typography
- spacing scale
- radius, border, shadow, and elevation
- layout/grid rules
- semantic states
- loading, empty, success, warning, and error patterns

Also include a dedicated UI library screen/route that presents:

- tokens
- typography
- spacing
- surfaces
- reusable components
- component states

Build reusable primitives including at minimum:

- buttons
- inputs and form controls
- selects/dropdowns
- modals/dialogs
- cards/surfaces
- tables/lists
- badges/status indicators
- navigation elements
- skeleton/loading states
- feedback/toast patterns

Build these 5 dashboard pages:

- Home
- Settings
- CRM
- Orders
- Menu

Frontend expectations:

- strong visual consistency
- clear hierarchy and spacing
- interactive flows, not static screens
- edit/create flows with modals or drawers
- hover, focus, active, disabled states
- thoughtful empty/error/loading states
- real product feel

The dashboard must run on web. Native readiness is a bonus, not a requirement.

## Part 2 — Backend Ordering System

Build a real backend-backed ordering slice to power the dashboard.

At minimum, support:

- menu categories and menu items
- customer records
- orders and order items
- ordering-related business settings

The product should support these flows:

- manage menu items from the dashboard
- create orders
- list and filter orders
- view order details
- update order status through valid actions
- view customers in CRM with order history / spend
- update ordering-related settings
- show summary data on Home

Recommended page behavior:

- Home: KPIs such as total orders, revenue, pending orders, popular items
- Orders: list, filters, detail view, status actions
- CRM: customer list, order count, spend, recent orders
- Menu: categories, items, price, availability
- Settings: prep time, auto-accept, service availability, opening hours, or similar

Backend expectations:

- validate required fields
- reject invalid order payloads
- reject unavailable menu items
- calculate or verify totals server-side
- enforce valid order state transitions
- return clear typed request/response shapes

Do not make status updates a loose client-controlled field change. Show deliberate backend behavior.

Provide seed data or a bootstrap flow so the project is easy to review locally.

## Architecture Rules

This matters a lot. We are evaluating how you build, not just whether it works.

Your implementation should follow this flow:

```text
Drizzle schema -> drizzle-zod -> Hono/OpenAPI -> Orval -> generated frontend types/hooks
```

Requirements:

- persisted data truth starts in Drizzle schema
- API contracts are generated, not manually duplicated
- frontend API types come from generated/shared types only
- frontend data fetching uses generated hooks
- presentational components stay focused on UI
- business logic lives in hooks/services/backend, not large page components
- reusable UI patterns become shared components
- design tokens are centralized, not scattered

Avoid:

- handwritten frontend DTOs for backend data
- duplicated enums/status types across frontend and backend
- direct raw fetch as the main app pattern
- hand-editing generated API artifacts
- putting most logic directly inside screen/page components

## Testing and DX

We do not need exhaustive coverage, but we do expect discipline.

Include:

- targeted backend tests for key order flows
- at least some frontend tests for important logic or UI states
- clear scripts for local development

Your repo should expose scripts like:

```bash
pnpm dev:dashboard
pnpm dev:backend
pnpm gen:contract
pnpm lint
pnpm typecheck
pnpm test
```

## Deliverables

Submit:

- GitHub repository
- instructions to run locally
- instructions to seed data
- short explanation of architecture decisions
- short note on tradeoffs or incomplete areas

Optional:

- short Loom walkthrough

## Evaluation Criteria

We will evaluate:

- fidelity to the required stack
- quality and scalability of the design system
- component reusability and frontend structure
- visual polish and UX quality
- backend modeling and API design
- type safety and contract discipline
- end-to-end integration quality
- testing and engineering rigor
- speed, focus, and scope management
