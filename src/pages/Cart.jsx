import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft, CheckCircle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Cart() {
  const [items, setItems] = useState([]);
  const [ordered, setOrdered] = useState(false);
  const [address, setAddress] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      return base44.entities.CartItem.filter({ user_id: u.id });
    }).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const updateQty = async (id, delta) => {
    const item = items.find(i => i.id === id);
    const newQty = Math.max(1, item.quantity + delta);
    await base44.entities.CartItem.update(id, { quantity: newQty });
    setItems(items.map(i => i.id === id ? { ...i, quantity: newQty } : i));
  };

  const remove = async (id) => {
    await base44.entities.CartItem.delete(id);
    setItems(items.filter(i => i.id !== id));
  };

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const shipping = 299;
  const total = subtotal + shipping;

  const manufacturers = [...new Set(items.map(i => i.manufacturer_name))];

  if (ordered) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-12 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-[#222222] mb-2">Order Placed!</h2>
          <p className="text-gray-500 mb-6">Your order has been sent to {manufacturers.length} manufacturers. You'll receive confirmations shortly.</p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
            <div className="text-sm text-gray-500 mb-1">Order total</div>
            <div className="text-2xl font-bold text-[#0066CC]">${total.toLocaleString()}</div>
            <div className="text-sm text-gray-400 mt-1">Sent to: {manufacturers.join(", ")}</div>
          </div>
          <Link to={createPageUrl("Orders")}>
            <Button className="w-full bg-[#0066CC] hover:bg-[#0055AA] text-white">View Order Status</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <div className="max-w-5xl mx-auto">
        <Link to={createPageUrl("Search")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0066CC] mb-6">
          <ArrowLeft className="w-4 h-4" /> Continue Shopping
        </Link>

        <h1 className="text-3xl font-bold text-[#222222] mb-8">Your Cart ({items.length} items)</h1>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-4">Your cart is empty</p>
            <Link to={createPageUrl("Search")}>
              <Button className="bg-[#0066CC] text-white">Browse Furniture</Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Items */}
            <div className="lg:col-span-2 space-y-3">
              {items.map(item => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
                  <img src={item.thumbnail} alt={item.product_name} className="w-20 h-16 object-cover rounded-lg shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-[#222222]">{item.product_name}</div>
                    <div className="text-sm text-gray-400">{item.manufacturer_name}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                      <Truck className="w-3 h-3" /> Ships in {item.lead_time_weeks} week{item.lead_time_weeks > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="font-bold text-[#0066CC] w-20 text-right">${(item.unit_price * item.quantity).toLocaleString()}</div>
                  <button onClick={() => remove(item.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Manufacturer breakdown */}
              <div className="bg-[#F0F7FF] rounded-xl p-4 border border-blue-100">
                <div className="text-sm font-semibold text-[#0066CC] mb-2">One checkout · {manufacturers.length} manufacturers</div>
                <p className="text-sm text-gray-500">Your order will be automatically split and sent to {manufacturers.join(", ")}. You'll receive a single confirmation.</p>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-100 p-6 sticky top-6">
                <h2 className="font-bold text-[#222222] mb-5">Order Summary</h2>
                <div className="space-y-3 text-sm mb-5">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal ({items.length} items)</span>
                    <span>${subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Shipping (est.)</span>
                    <span>${shipping}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-[#222222]">
                    <span>Total</span>
                    <span className="text-[#0066CC] text-lg">${total.toLocaleString()}</span>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 block mb-1">Shipping Address</label>
                  <Input placeholder="Enter delivery address" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <Button
                  className="w-full bg-[#0066CC] hover:bg-[#0055AA] text-white h-12 text-base"
                  disabled={placing || !address}
                  onClick={async () => {
                    setPlacing(true);
                    const orderNumber = `SPE-${Date.now()}`;
                    await base44.entities.Order.create({
                      order_number: orderNumber,
                      buyer_id: user?.id,
                      buyer_name: user?.full_name || user?.email,
                      buyer_type: user?.role || "consumer",
                      items: items.map(i => ({
                        product_id: i.product_id,
                        product_name: i.product_name,
                        manufacturer_name: i.manufacturer_name,
                        quantity: i.quantity,
                        unit_price: i.unit_price,
                        total_price: i.unit_price * i.quantity,
                        thumbnail: i.thumbnail,
                      })),
                      subtotal,
                      shipping_total: shipping,
                      total,
                      status: "pending",
                      shipping_address: address,
                    });
                    // Clear cart items
                    await Promise.all(items.map(i => base44.entities.CartItem.delete(i.id)));
                    setPlacing(false);
                    setOrdered(true);
                  }}
                >
                  {placing ? "Placing Order..." : "Place Order"}
                </Button>
                <p className="text-xs text-gray-400 text-center mt-3">
                  Orders sent to {manufacturers.length} manufacturer{manufacturers.length > 1 ? "s" : ""} automatically
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}