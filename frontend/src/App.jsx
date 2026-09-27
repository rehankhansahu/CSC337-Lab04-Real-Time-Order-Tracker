import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    "http://localhost:5000";

const socket = io(BACKEND_URL);

function App() {

    const [orders, setOrders] = useState([]);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [alerts, setAlerts] = useState([]);
    const [rpcResult, setRpcResult] = useState(null);

    const roomId = "support-room-1001";

    useEffect(() => {

        fetch(`${BACKEND_URL}/api/v1/orders`)
            .then(res => res.json())
            .then(data => setOrders(data));

        socket.emit("joinSupportRoom", roomId);

        socket.on("receiveMessage", (data) => {
            setMessages(prev => [...prev, data]);
        });

        socket.on("orderStatusUpdated", (updatedOrder) => {

            setOrders(prev =>
                prev.map(order =>
                    order.id === updatedOrder.id
                        ? updatedOrder
                        : order
                )
            );
        });

        const eventSource =
            new EventSource(`${BACKEND_URL}/events`);

        eventSource.onmessage = (event) => {

            const data = JSON.parse(event.data);

            setAlerts(prev => [
                data,
                ...prev
            ]);
        };

        return () => {
            socket.off("receiveMessage");
            socket.off("orderStatusUpdated");
            eventSource.close();
        };

    }, []);

    const sendMessage = () => {

        if (!message.trim()) return;

        socket.emit("sendMessage", {
            roomId,
            sender: "Customer",
            message
        });

        setMessage("");
    };

    const updateStatus = (orderId) => {

        socket.emit("updateOrderStatus", {
            orderId,
            status: "Out for Delivery"
        });
    };

    const cancelOrder = async (orderId) => {

        const response = await fetch(
            `${BACKEND_URL}/rpc`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "cancelOrder",
                    params: {
                        orderId
                    },
                    id: 1
                })
            }
        );

        const data = await response.json();

        setRpcResult(data);
    };

    return (
        <div className="container">

            <h1>Real-Time Order Tracker</h1>

            <p className="subtitle">
                REST + WebSocket + JSON-RPC + SSE
            </p>

            <section>

                <h2>Orders</h2>

                {orders.map(order => (

                    <div className="order" key={order.id}>

                        <h3>{order.id}</h3>

                        <p>
                            <b>Customer:</b> {order.customer}
                        </p>

                        <p>
                            <b>Product:</b> {order.product}
                        </p>

                        <p>
                            <b>Status:</b>{" "}
                            <span className="status">
                                {order.status}
                            </span>
                        </p>

                        <button
                            onClick={() =>
                                updateStatus(order.id)
                            }
                        >
                            Update Status
                        </button>

                        <button
                            onClick={() =>
                                cancelOrder(order.id)
                            }
                        >
                            Cancel Order
                        </button>

                    </div>

                ))}

            </section>

            <section>

                <h2>Live Support Chat</h2>

                <div className="chat">

                    {messages.map((msg, index) => (

                        <div key={index}>
                            <b>{msg.sender}:</b>{" "}
                            {msg.message}
                        </div>

                    ))}

                </div>

                <input
                    value={message}
                    onChange={e =>
                        setMessage(e.target.value)
                    }
                    placeholder="Type message..."
                />

                <button onClick={sendMessage}>
                    Send Message
                </button>

            </section>

            <section>

                <h2>Live System Alerts — SSE</h2>

                <div className="alerts">

                    {alerts.map((alert, index) => (

                        <div key={index}>
                            {alert.message}
                        </div>

                    ))}

                </div>

            </section>

            <section>

                <h2>JSON-RPC Response</h2>

                <pre>
                    {rpcResult
                        ? JSON.stringify(
                            rpcResult,
                            null,
                            2
                        )
                        : "No RPC request yet"}
                </pre>

            </section>

        </div>
    );
}

export default App;