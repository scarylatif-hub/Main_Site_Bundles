# Testing the API with Postman

This guide provides instructions on how to test the application's API endpoints using an API client like Postman.

## Base URL

All endpoints are relative to your local development server's URL. By default, this is:

`http://localhost:9002`

---

## 1. Fetch All Packages

This endpoint retrieves a list of all available data bundle packages from the external provider.

- **Method:** `GET`
- **URL:** `http://localhost:9002/api/packages`

### Request

- **Headers:** No special headers are required.
- **Body:** None.

### Example Success Response (200 OK)

You will receive a JSON array of package objects.

```json
[
    {
        "id": "pkg_1",
        "network": {
            "id": 1,
            "name": "MTN"
        },
        "dataAmount": "100MB",
        "validity": "30 Days",
        "price": 2.50,
        "sharedBundle": 100
    },
    {
        "id": "pkg_2",
        "network": {
            "id": 2,
            "name": "Telecel"
        },
        "dataAmount": "500MB",
        "validity": "30 Days",
        "price": 5.00,
        "sharedBundle": 500
    }
]
```

---

## 2. Buy a Bundle

This endpoint simulates a user purchasing a data bundle. **This is a protected endpoint and requires a user authentication token.**

- **Method:** `POST`
- **URL:** `http://localhost:9002/api/buy-bundle`

### How to Get an Authentication Token

To test this endpoint, you need a valid JWT from a logged-in user. The easiest way to get this is from your browser's developer tools:

1.  Log in to your application in your web browser.
2.  Open the **Developer Tools** (usually by pressing F12).
3.  Go to the **Application** (or **Storage** in Firefox) tab.
4.  Under `Storage` -> `Local Storage`, find the entry for your site (`http://localhost:9002`).
5.  Look for a key that starts with `sb-` and ends with `-auth-token`. It will have a large JSON object as its value.
6.  Copy the value of the `access_token` property from within that JSON object. This is your JWT.

### Request

- **Headers:**
  - `Content-Type`: `application/json`
  - `Authorization`: `Bearer <YOUR_JWT_ACCESS_TOKEN>` (Replace `<YOUR_JWT_ACCESS_TOKEN>` with the token you copied).

- **Body (raw, JSON):**
  You need to provide the details of the bundle you want to purchase. These values should correspond to a valid package from the `GET /api/packages` endpoint.

  ```json
  {
    "recipientMsisdn": "0241234567",
    "networkId": 1,
    "sharedBundle": 100,
    "price": 2.50,
    "dataAmount": "100MB"
  }
  ```

### Example Success Response (200 OK)

```json
{
    "success": true,
    "transactionCode": "CBG-1234567890",
    "message": "Bundle purchase successful."
}
```

### Example Error Responses

- **401 Unauthorized:** If your `Authorization` header is missing or the token is invalid.
  ```json
  {
    "error": "Unauthorized"
  }
  ```
- **400 Bad Request:** If you have insufficient funds in your wallet.
  ```json
  {
    "error": "Insufficient funds. Please top up your wallet."
  }
  ```
- **400 Bad Request:** If any required fields are missing from the request body.
    ```json
    {
      "error": "Missing required fields for purchase"
    }
    ```
