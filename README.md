# Online Store Order Management API

A REST API for a small online store built with the MERN stack (MongoDB, Express, Node.js). Admins manage products and process orders. Customers register, browse products, place orders and cancel them while they are still being prepared.

The server is in charge of prices and stock. The customer sends product IDs and quantities, and the API reads the prices from the database and calculates the total.

## Tech stack

- Node.js and Express
- MongoDB with Mongoose
- JWT authentication and bcrypt password hashing
- express-validator for request validation

## Project structure

```
store-api/
  config/db.js
  controllers/
    authController.js
    productController.js
    orderController.js
  middleware/          auth, role check, validation, error handler
  models/
    user.js
    product.js
    order.js
  routes/
    auth.js
    products.js
    orders.js
  scripts/createAdmin.js
  .env.example
  app.js
  server.js
  README.md
```

## Setup

```bash
npm install
cp .env.example .env
# fill in MONGODB_URI and JWT_SECRET
npm start
```

For development with automatic restarts:

```bash
npm run dev
```

The API runs on `http://localhost:3000` by default.

Placing and cancelling orders use MongoDB transactions. Atlas supports them out of the box. If you use a local MongoDB, it must run as a replica set, otherwise those two endpoints will fail.

## Environment variables

| Variable      | Description                              |
| ------------- | ---------------------------------------- |
| `PORT`        | Port the API listens on (default `3000`) |
| `MONGODB_URI` | MongoDB connection string                |
| `MONGODB_DB`  | Database name (default `online-store`)   |
| `JWT_SECRET`  | Secret used to sign login tokens         |

`.env` is ignored by git. Commit `.env.example` only.

## Endpoints

| Method | Endpoint                    | Access        | What it does                                      |
| ------ | --------------------------- | ------------- | ------------------------------------------------- |
| POST   | `/api/auth/register`        | Public        | Register a customer                               |
| POST   | `/api/auth/login`           | Public        | Log in and receive a JWT                          |
| GET    | `/api/auth/me`              | Logged in     | Get the current user's profile                    |
| POST   | `/api/products`             | Admin         | Create a product                                  |
| GET    | `/api/products`             | Public        | List active products with search and filters      |
| GET    | `/api/products/:id`         | Public        | Get one product                                   |
| PUT    | `/api/products/:id`         | Admin         | Update a product                                  |
| DELETE | `/api/products/:id`         | Admin         | Soft delete a product                             |
| POST   | `/api/orders`               | Customer      | Place an order                                    |
| GET    | `/api/orders/my`            | Customer      | Get the current customer's orders                 |
| GET    | `/api/orders/summary`       | Admin         | Sales summary and top selling products            |
| GET    | `/api/orders`               | Admin         | Get all orders                                    |
| GET    | `/api/orders/:id`           | Owner or admin| Get one order                                     |
| PATCH  | `/api/orders/:id/cancel`    | Owner         | Cancel an order while it is still placed          |
| PATCH  | `/api/orders/:id/status`    | Admin         | Move an order forward                             |

Send the token in the header:

```
Authorization: Bearer <token>
```

### Register body

```json
{
  "name": "Aarav Sharma",
  "email": "aarav@example.com",
  "password": "secret123"
}
```

Registration always creates a customer. There is no public way to create an admin.

### Create product body

```json
{
  "name": "Wireless Mouse",
  "description": "Compact wireless mouse with a 12 month battery.",
  "price": 25.5,
  "category": "Electronics",
  "stock": 10
}
```

### Place order body

```json
{
  "items": [
    { "product": "<productId>", "quantity": 2 },
    { "product": "<productId>", "quantity": 1 }
  ],
  "shippingAddress": {
    "street": "12 MG Road",
    "city": "Mumbai",
    "pincode": "400001"
  }
}
```

Only the product ID and quantity are used. A price or total sent by the client is ignored.

## Getting products

Supported query parameters:

| Parameter  | Example      | Notes                                            |
| ---------- | ------------ | ------------------------------------------------ |
| `search`   | `mouse`      | Case-insensitive partial match on the name       |
| `category` | `Electronics`| Case-insensitive exact match                     |
| `minPrice` | `20`         | Minimum price                                    |
| `maxPrice` | `100`        | Maximum price                                    |
| `inStock`  | `true`       | `true` for stock above 0, `false` for 0          |
| `sort`     | `-price`     | `price`, `-price`, `name`, `-name`, `createdAt`, `-createdAt` |
| `page`     | `1`          | Positive integer                                 |
| `limit`    | `10`         | Between 1 and 100                                |

The response shape for product and order lists is:

```json
{
  "success": true,
  "total": 42,
  "page": 1,
  "pages": 5,
  "count": 10,
  "data": []
}
```

`GET /api/orders/my` also accepts `status` and paging. `GET /api/orders` (admin) accepts `status`, `customer` and paging. `GET /api/orders/summary` accepts optional `from` and `to` dates, for example `?from=2026-01-01&to=2026-01-31`.

## How an admin is created

Admins are not created through the public API. Use the small script in `scripts/`:

```bash
npm run create:admin -- "Store Admin" admin@store.com admin123
```

If a user with that email already exists, the script promotes them to admin instead of creating a second account.

## Stock logic

Placing an order does the following inside a MongoDB transaction:

1. Loads all the products and checks that every one exists and is active.
2. Checks that there is enough stock for every item.
3. Copies the product name and the current price into the order item.
4. Calculates the total from the database prices.
5. Reduces the stock of every product and creates the order.

If any item fails, the transaction is aborted, so no stock is reduced and no order is saved. The same product cannot appear twice in one order.

A customer can cancel an order only while the status is `placed`. Cancelling puts the quantity of every item back into stock. Because the order keeps its own copy of each name and price, old orders do not change when a product is edited later.

Deleting a product only sets `isActive` to `false`. Deleted products disappear from the product list and cannot be ordered, but the orders that contain them still show the saved name and price.

## Order status

```
placed ──> shipped ──> delivered
   │
   └──> cancelled (customer only, while placed)
```

Only these moves are allowed. An admin cannot move an order backwards and cannot change an order that is already cancelled or delivered.

## Database

There are three collections.

### User

`name`, `email` (unique), `password` (bcrypt hash, never returned), `role` (`customer` or `admin`), `createdAt`, `updatedAt`.

### Product

`name`, `description`, `price`, `category`, `stock`, `isActive` (default `true`), `createdAt`, `updatedAt`.

### Order

`customer` (User reference), `items` (array of product reference, saved name, saved price and quantity), `totalAmount`, `shippingAddress` (street, city, pincode), `status` (`placed`, `shipped`, `delivered` or `cancelled`), `createdAt`, `updatedAt`.

### Relationships

```
User (customer) 1 ──── * Order
Order           1 ──── * Product (through the items array)
```

The sales summary uses an aggregation pipeline. It matches orders in the date range that are not cancelled, groups them to get the revenue and order count, then unwinds the items to find the top five products by quantity sold.

## Error responses

Errors use the same shape:

```json
{
  "success": false,
  "message": "Only 2 units of Wireless Mouse are left in stock"
}
```

| Status | Used for                                                              |
| ------ | --------------------------------------------------------------------- |
| 201    | Resource created                                                      |
| 200    | Fetched, updated, deleted or cancelled successfully                   |
| 400    | Validation error, invalid id, not enough stock, invalid status change |
| 401    | Missing, invalid or expired token, wrong password                     |
| 403    | Logged in but not allowed (wrong role or not the owner)               |
| 404    | Product, order or route not found                                     |
| 409    | Duplicate email, order cannot be cancelled because of its status      |
| 500    | Unexpected server error                                               |

## Test accounts

These accounts already exist in the development database:

| Account             | Role     | Used for                    |
| ------------------- | -------- | --------------------------- |
| `admin@store.com`   | admin    | Managing products and orders|
| `aarav@example.com` | customer | Placing and cancelling      |
| `nisha@example.com` | customer | Ownership tests             |

The admin password is `admin123`. The customer password is `secret123`.

If you start with a fresh database, create the admin with the script and register the customers through the API.

## Notes

- Passwords are hashed with bcrypt and excluded from every response.
- Prices and totals are always calculated on the server.
- Ownership is checked in the controllers, not only in the routes.
- Product and order routes validate MongoDB IDs before querying.
- Soft deleted products stay in the database so order history is not broken.
