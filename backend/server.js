const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: "*"
}));

app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// -------------------------
// Sample Data
// -------------------------

let orders = [
    {
        id: "ORD-1001",
        customer: "Ali",
        product: "Wireless Headphones",
        quantity: 1,
        price: 4500,
        status: "Processing"
    },
    {
        id: "ORD-1002",
        customer: "Sara",
        product: "Smart Watch",
        quantity: 1,
        price: 7500,
        status: "Shipped"
    },
    {
        id: "ORD-1003",
        customer: "Ahmed",
        product: "Bluetooth Speaker",
        quantity: 2,
        price: 6000,
        status: "Delivered"
    }
];

const catalog = [
    {
        id: 1,
        name: "Wireless Headphones",
        price: 4500
    },
    {
        id: 2,
        name: "Smart Watch",
        price: 7500
    },
    {
        id: 3,
        name: "Bluetooth Speaker",
        price: 3000
    }
];

// -------------------------
// Basic Route
// -------------------------

app.get("/", (req, res) => {
    res.json({
        message: "Real-Time Order Tracker Backend is Running",
        status: "OK"
    });
});

// -------------------------
// REST API
// -------------------------

app.get("/api/v1/orders", (req, res) => {
    res.json(orders);
});

app.get("/api/v1/orders/:id", (req, res) => {
    const order = orders.find(
        o => o.id === req.params.id
    );

    if (!order) {
        return res.status(404).json({
            error: "Order not found"
        });
    }

    res.json(order);
});

app.get("/api/v1/catalog", (req, res) => {
    res.json(catalog);
});

// -------------------------
// JSON-RPC 2.0
// -------------------------

app.post("/rpc", (req, res) => {

    const { jsonrpc, method, params, id } = req.body;

    if (jsonrpc !== "2.0") {
        return res.status(400).json({
            jsonrpc: "2.0",
            error: {
                code: -32600,
                message: "Invalid Request"
            },
            id
        });
    }

    if (method === "cancelOrder") {

        const orderId = params?.orderId;

        const order = orders.find(
            o => o.id === orderId
        );

        if (!order) {
            return res.json({
                jsonrpc: "2.0",
                error: {
                    code: -32602,
                    message: "Order not found"
                },
                id
            });
        }

        order.status = "Cancelled";

        io.emit("orderStatusUpdated", order);

        sendAlert(
            `Order ${orderId} has been cancelled`
        );

        return res.json({
            jsonrpc: "2.0",
            result: {
                success: true,
                message: `Order ${orderId} cancelled`,
                order
            },
            id
        });
    }

    return res.json({
        jsonrpc: "2.0",
        error: {
            code: -32601,
            message: "Method not found"
        },
        id
    });
});

// -------------------------
// Server-Sent Events
// -------------------------

let clients = [];

app.get("/events", (req, res) => {

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(`data: ${JSON.stringify({
        message: "Connected to live alerts"
    })}\n\n`);

    clients.push(res);

    req.on("close", () => {
        clients = clients.filter(
            client => client !== res
        );
    });
});

function sendAlert(message) {

    const data = JSON.stringify({
        message,
        time: new Date().toISOString()
    });

    clients.forEach(client => {
        client.write(`data: ${data}\n\n`);
    });
}

// -------------------------
// Socket.IO
// -------------------------

io.on("connection", (socket) => {

    console.log("Client connected:", socket.id);

    socket.emit("connectionMessage", {
        message: "Connected to real-time server"
    });

    // Join 1-on-1 support room
    socket.on("joinSupportRoom", (roomId) => {

        socket.join(roomId);

        socket.emit("roomJoined", {
            roomId,
            message: `Joined support room ${roomId}`
        });
    });

    // Chat message
    socket.on("sendMessage", (data) => {

        io.to(data.roomId).emit("receiveMessage", {
            sender: data.sender,
            message: data.message,
            time: new Date().toISOString()
        });
    });

    // Order status update
    socket.on("updateOrderStatus", (data) => {

        const order = orders.find(
            o => o.id === data.orderId
        );

        if (!order) return;

        order.status = data.status;

        io.emit("orderStatusUpdated", order);

        sendAlert(
            `Order ${order.id} status changed to ${order.status}`
        );
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

// -------------------------
// Start Server
// -------------------------

server.listen(PORT, () => {
    console.log(
        `Server running on http://localhost:${PORT}`
    );
});