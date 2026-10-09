# GBN Supply Chain

GBN Supply Chain is a single-deployment, cash-on-delivery sales and fulfillment application. The React frontend is built to `dist/`; the Express backend serves that build and its API from the same Node.js process.

## Requirements

- Node.js 18.11 or newer
- MongoDB (local or hosted)

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` to your MongoDB connection string and replace `JWT_SECRET` with a private random value of at least 32 characters.
3. Install dependencies with `npm install`.
4. Start the API and React development server with `npm run dev`.
5. Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

The API listens on port 5000 by default. Set `PORT` to change it and update the Vite API proxy if you use a different development port. On the first launch, the system creates a default admin account automatically. The admin can then create invite links to share with staff members. All sign-ins use an email and password pair; no email-confirmation or password-reset flow is included.

## Production

Run `npm run build`, then start the combined application with `npm start`. Set `MONGODB_URI`, `JWT_SECRET`, and optionally `PORT` in the deployment environment. The Node server serves both `/api/*` and the built React application, so only one application/service needs to be deployed.

## Main workflows

- Create and share a product funnel at `/f/:slug`; customers submit delivery details, including a required WhatsApp number, and select a quantity without paying online. Open the WhatsApp link on an order to chat with the customer.
- Edit a funnel from its sales funnel card to update product details, images, pricing, currency, or Meta Pixel settings without changing its share link.
- Product image links must be direct, publicly accessible HTTPS image URLs; third-party share-page links (for example, a photo album page) are not image files.
- Customer delivery and dispatch-rider forms use a state selector and a free-text city/town field.
- A submitted order creates an in-app notification and starts at **New order**.
- The Orders page shows active orders, excluding **Transferred to your account** and **Failed**, with 10 orders per page. Those two final statuses are listed on **Completed orders**, with 20 orders per page. Search, status filters, and pagination are applied server-side.
- Enable push alerts from the notifications menu on each device to receive new-order and order-status notifications when the app is not open. Push notifications require HTTPS (localhost is supported for development) and VAPID credentials (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`) in the server environment. Generate a key pair with `npx web-push generate-vapid-keys`; use a contact address such as `mailto:you@example.com` for the subject.
- Move confirmed orders through **Activated**, **In transit**, and **With rider**. Selecting a rider at pickup adds the order quantity to that rider's current bag count.
- Mark a rider order **Delivered** after payment is collected, or **Delivery failed** if the customer declines. A failed product returns to the rider's available stock; only the account owner can assign customers to riders or decide to return available stock to the supplier. After delivery, record **Transferred to your account** and enter the rider's agreed service charge; the app stores the remaining amount as the transfer amount. Rerouting updates that customer's existing order and keeps the failed order as linked history; it does not create a duplicate customer order.
- Supplier returns move through **Returning to supplier** and **Returned to supplier**; the rider confirms supplier receipt before the item is removed from their inventory. Public orders collect city and state so reroute options can be matched by location.
- Each rider has a private portal link at `/rider/:accessToken` to review assigned addresses, call customers, see their live bag count, and report paid deliveries or delivery failures. Share it directly with the rider (for example, by WhatsApp).
- Record product quantities sent to riders from the Riders page; each shipment is tracked as **In transit** until the rider confirms receipt in their portal. Only received stock is available for assignment. A rider's bag count is the sum of available stock and units on assigned deliveries; these two quantities are shown separately and should reconcile to the total. When delivery fails, its units return to available stock so they can be assigned to another confirmed customer order; successful deliveries and supplier returns remove units from the bag. When an order is confirmed, assign it from an active rider's available local stock in Orders; the app reserves the units, and the assigned order appears in the rider's portal for delivery.
- Add each dispatch rider with their primary city and state so their service location is visible in the rider list and portal. Edit a rider from their card to update their name, phone, service location, or active status; the private portal link and inventory history remain unchanged.
- Share `/track/:orderNumber` with a customer to show their order progress.
- Enter an optional Meta Pixel ID when creating a funnel. The public page sends `PageView`, `ViewContent`, and (on successful order submission) `Purchase` events.

## API

The Express application is organized into `backend/controllers`, `backend/routers`, `backend/models`, `backend/middleware`, and `backend/config`. `GET /api/health` is available as a deployment health check.
