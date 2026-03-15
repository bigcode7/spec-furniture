import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Truck, CheckCircle, Clock, XCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";



const STATUS_CONFIG = {
  pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400", icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-gold/10 text-gold/70", icon: CheckCircle },
  in_production: { label: "In Production", color: "bg-purple-500/20 text-purple-400", icon: Package },
  shipped: { label: "Shipped", color: "bg-orange-500/20 text-orange-400", icon: Truck },
  delivered: { label: "Delivered", color: "bg-green-500/20 text-green-400", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-red-500/20 text-red-400", icon: XCircle },
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      // Admin/manufacturer sees all orders; buyers see their own
      if (u.role === "admin" || u.role === "manufacturer") {
        return base44.entities.Order.list("-created_date", 100);
      }
      return base44.entities.Order.filter({ buyer_id: u.id }, "-created_date");
    }).then(setOrders).catch(() => {});
  }, []);

  const filtered = orders.filter(o =>
    (o.order_number || "").includes(search) ||
    (o.buyer_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (o.items || []).some(i => (i.product_name || "").toLowerCase().includes(search.toLowerCase()))
  );

  const byStatus = (status) => filtered.filter(o => o.status === status);

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Orders</h1>
            <p className="text-white/40 mt-1">{orders.length} total orders</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Orders", val: orders.length, color: "text-gold" },
            { label: "Pending", val: orders.filter(o => o.status === "pending").length, color: "text-yellow-400" },
            { label: "Shipped", val: orders.filter(o => o.status === "shipped").length, color: "text-orange-400" },
            { label: "Revenue", val: `$${orders.reduce((s, o) => s + o.total, 0).toLocaleString()}`, color: "text-green-400" },
          ].map((s, i) => (
            <div key={i} className="glass-surface rounded-xl p-4 border border-white/[0.06]">
              <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
              <div className="text-sm text-white/40">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input placeholder="Search by order number, buyer, or product..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20 focus:border-gold/30" />
        </div>

        {/* Order list */}
        <Tabs defaultValue="all">
          <TabsList className="mb-4 bg-white/[0.03] border border-white/[0.06]">
            <TabsTrigger value="all" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold">All ({filtered.length})</TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold">Pending ({byStatus("pending").length})</TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold">Active ({byStatus("in_production").length + byStatus("shipped").length})</TabsTrigger>
            <TabsTrigger value="delivered" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold">Delivered ({byStatus("delivered").length})</TabsTrigger>
          </TabsList>

          {["all", "pending", "active", "delivered"].map(tab => (
            <TabsContent key={tab} value={tab}>
              <div className="space-y-4">
                {(tab === "all" ? filtered :
                  tab === "active" ? filtered.filter(o => ["in_production", "shipped", "confirmed"].includes(o.status)) :
                  filtered.filter(o => o.status === tab)
                ).map(order => {
                  const statusCfg = STATUS_CONFIG[order.status];
                  return (
                    <div key={order.id} className="glass-surface rounded-xl border border-white/[0.06] p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-white">{order.order_number}</span>
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.color}`}>
                              {statusCfg.label}
                            </span>
                          </div>
                          <div className="text-sm text-white/40 mt-1">{order.buyer_name} · {order.created_date}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gold text-lg">${order.total.toLocaleString()}</div>
                          <div className="text-xs text-white/30">Est. delivery: {order.estimated_delivery}</div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-3 p-2 bg-white/[0.03] rounded-lg">
                            <img src={item.thumbnail} alt={item.product_name} className="w-10 h-8 object-cover rounded" />
                            <div className="flex-1 text-sm">
                              <span className="font-medium text-white">{item.product_name}</span>
                              <span className="text-white/30"> · {item.manufacturer_name}</span>
                            </div>
                            <div className="text-sm text-white/40">Qty: {item.quantity}</div>
                            <div className="text-sm font-medium text-white">${item.total_price.toLocaleString()}</div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-sm text-white/40">
                        <span>{order.shipping_address}</span>
                        {order.tracking_number && (
                          <span className="flex items-center gap-1 text-gold font-medium">
                            <Truck className="w-3 h-3" /> {order.tracking_number}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-center py-12 text-white/30">No orders found.</div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
