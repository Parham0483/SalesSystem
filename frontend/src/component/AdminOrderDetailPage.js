import React, { useState, useEffect } from 'react';
import API from '../component/api';

const AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {
    const [order, setOrder] = useState(null);
    const [items, setItems] = useState([]);
    const [adminComment, setAdminComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchOrder();
    }, [orderId]);

    const fetchOrder = async () => {
        setLoading(true);
        try {
            const res = await API.get(`/orders/${orderId}/`);
            setOrder(res.data);
            setItems(res.data.items || []);
            setAdminComment(res.data.admin_comment || '');
            setLoading(false);
        } catch {
            setError('Failed to load order');
            setLoading(false);
        }
    };

    const handlePricingSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await API.post(`/orders/${orderId}/submit_pricing/`, {
                admin_comment : adminComment,
                items: items.map(i => ({
                    id: i.id,
                    quoted_unit_price: Number(i.quoted_unit_price),
                    final_quantity: Number(i.final_quantity),
                    admin_notes: i.admin_notes,
                }))
            });
            setLoading(false);
            if (onOrderUpdated) onOrderUpdated();
        } catch {
            setError('Failed to update pricing');
            setLoading(false);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div style={{ color: 'red' }}>{error}</div>;
    if (!order) return <div>Order not found</div>;

    return (
        <div>
            <h2>Admin Edit Order #{order.id}</h2>
            <div><strong>Customer:</strong> {order.customer_name}</div>
            <div><strong>Status:</strong> {order.status}</div>
            <div><strong>Customer Comment:</strong> {order.customer_comment}</div>

            <h3>Update Pricing & Details</h3>
            <form onSubmit={handlePricingSubmit}>
                <label>
                    Admin Comment:
                    <textarea value={adminComment} onChange={e => setAdminComment(e.target.value)} />
                </label>

                <h4>Items</h4>
                {items.map((item, idx) => (
                    <div key={item.id} style={{ border: '1px solid #eee', margin: 4, padding: 4 }}>
                        <div><strong>Item Name:</strong> {item.product_name}</div>
                        <div><strong>Quantity Requested:</strong> {item.requested_quantity}</div>
                        <div><strong>Customer Comment:</strong> {item.customer_notes}</div>

                        <label>
                            Quoted Unit Price:
                            <input type="number" value={item.quoted_unit_price || ''} onChange={e => {
                                const newItems = [...items];
                                newItems[idx].quoted_unit_price = e.target.value;
                                setItems(newItems);
                            }} />
                        </label>
                        <label>
                            Final Quantity:
                            <input type="number" value={item.final_quantity || ''} onChange={e => {
                                const newItems = [...items];
                                newItems[idx].final_quantity = e.target.value;
                                setItems(newItems);
                            }} />
                        </label>
                        <label>
                            Admin Notes:
                            <input type="text" value={item.admin_notes || ''} onChange={e => {
                                const newItems = [...items];
                                newItems[idx].admin_notes = e.target.value;
                                setItems(newItems);
                            }} />
                        </label>
                    </div>
                ))}
                <button type="submit" disabled={loading}>Submit Pricing</button>
            </form>
        </div>
    );
};

export default AdminOrderDetailPage;
