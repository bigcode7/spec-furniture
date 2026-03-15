import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Package, DollarSign, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

const monthlyOrders = [
  { month: "Sep", orders: 42, spend: 84000 },
  { month: "Oct", orders: 58, spend: 116000 },
  { month: "Nov", orders: 71, spend: 142000 },
  { month: "Dec", orders: 90, spend: 180000 },
  { month: "Jan", orders: 65, spend: 130000 },
  { month: "Feb", orders: 80, spend: 160000 },
];

const topProducts = [
  { name: "Velvet Sectional", sold: 28, revenue: 67200, trend: "up" },
  { name: "Marble Coffee Table", sold: 45, revenue: 27000, trend: "up" },
  { name: "Club Chair", sold: 32, revenue: 25600, trend: "down" },
  { name: "Dining Chair (set)", sold: 18, revenue: 11160, trend: "up" },
  { name: "Bookshelf", sold: 12, revenue: 11760, trend: "down" },
];

const topManufacturers = [
  { name: "Bernhardt", orders: 38, spend: 91200 },
  { name: "Hooker Furniture", orders: 52, spend: 78000 },
  { name: "Theodore Alexander", orders: 24, spend: 28800 },
  { name: "Vanguard", orders: 41, spend: 49200 },
  { name: "Four Hands", orders: 15, spend: 27000 },
];

export default function RetailerAnalytics() {
  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#222222]">Retailer Analytics</h1>
          <p className="text-gray-500 mt-1">Your purchasing performance & inventory insights</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Orders This Month", val: "80", change: "+23%", icon: ShoppingCart, pos: true },
            { label: "Total Spend", val: "$160k", change: "+18%", icon: DollarSign, pos: true },
            { label: "Avg Order Value", val: "$2,000", change: "-5%", icon: Package, pos: false },
            { label: "Hours Saved", val: "62 hrs", change: "This month", icon: TrendingUp, pos: true },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <s.icon className="w-5 h-5 text-[#0066CC]" />
                <span className={`text-xs font-medium ${s.pos ? "text-green-500" : "text-red-500"}`}>{s.change}</span>
              </div>
              <div className="text-2xl font-bold text-[#222222]">{s.val}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Monthly orders */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-bold text-[#222222] mb-4">Orders & Spend (6 months)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyOrders}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="orders" fill="#0066CC" radius={[4, 4, 0, 0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top manufacturers */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-bold text-[#222222] mb-4">Top Manufacturers by Spend</h2>
            <div className="space-y-3">
              {topManufacturers.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#F0F7FF] rounded-full flex items-center justify-center text-sm font-bold text-[#0066CC]">
                    {m.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-[#0066CC] font-bold">${m.spend.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0066CC] rounded-full" style={{ width: `${(m.spend / 91200) * 100}%` }} />
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{m.orders} orders</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top products */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#222222]">Top Selling Products</h2>
            <Link to={createPageUrl("Search")}>
              <Button variant="outline" size="sm">Reorder</Button>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Product</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Units Sold</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Revenue</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium">{p.name}</td>
                    <td className="py-3 px-3 text-gray-600">{p.sold}</td>
                    <td className="py-3 px-3 font-bold text-[#0066CC]">${p.revenue.toLocaleString()}</td>
                    <td className="py-3 px-3">
                      {p.trend === "up"
                        ? <span className="flex items-center gap-1 text-green-500 text-xs"><TrendingUp className="w-3 h-3" /> Growing</span>
                        : <span className="flex items-center gap-1 text-red-400 text-xs"><TrendingDown className="w-3 h-3" /> Slowing</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI recommendation */}
        <div className="bg-gradient-to-r from-[#0066CC] to-[#004EA8] rounded-xl p-6 text-white">
          <h3 className="font-bold text-lg mb-2">AI Inventory Recommendation</h3>
          <p className="text-blue-100 text-sm mb-4">Based on your sales velocity and regional trends, here's what to reorder:</p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { item: "Velvet Sectional", reason: "Selling 28/mo, stock running low", urgency: "Urgent" },
              { item: "Marble Coffee Table", reason: "+32% search trend in your region", urgency: "This week" },
              { item: "Club Chair", reason: "Slowing trend, discount to move", urgency: "Discount" },
            ].map((r, i) => (
              <div key={i} className="bg-white/10 rounded-lg p-4">
                <div className="font-medium mb-1">{r.item}</div>
                <div className="text-blue-200 text-xs mb-2">{r.reason}</div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  r.urgency === "Urgent" ? "bg-red-400/30 text-red-200" :
                  r.urgency === "This week" ? "bg-yellow-400/30 text-yellow-200" :
                  "bg-gray-400/30 text-gray-200"
                }`}>{r.urgency}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
