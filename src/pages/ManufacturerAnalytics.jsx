import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Search, Eye, ShoppingCart, DollarSign } from "lucide-react";

const weeklySearches = [
  { day: "Mon", searches: 38000, clicks: 1800 },
  { day: "Tue", searches: 42000, clicks: 2100 },
  { day: "Wed", searches: 35000, clicks: 1600 },
  { day: "Thu", searches: 48000, clicks: 2400 },
  { day: "Fri", searches: 51000, clicks: 2700 },
  { day: "Sat", searches: 44000, clicks: 2200 },
  { day: "Sun", searches: 39000, clicks: 1900 },
];

const topSearchTerms = [
  { term: "velvet sectional", count: 45200, match: "High", color: "bg-green-100 text-green-700" },
  { term: "emerald green sofa", count: 28100, match: "Medium", color: "bg-yellow-100 text-yellow-700" },
  { term: "mid-century dining", count: 19400, match: "Low", color: "bg-red-100 text-red-700" },
  { term: "performance fabric", count: 15700, match: "High", color: "bg-green-100 text-green-700" },
  { term: "sectional under $3k", count: 12300, match: "Medium", color: "bg-yellow-100 text-yellow-700" },
];

const topProducts = [
  { name: "Mercer Velvet Sectional", views: 15000, orders: 45, revenue: 90000 },
  { name: "Club Chair", views: 5400, orders: 12, revenue: 9600 },
  { name: "King Bed", views: 2200, orders: 5, revenue: 7000 },
  { name: "Dining Table", views: 3800, orders: 8, revenue: 20800 },
];

const categoryBreakdown = [
  { name: "Sectionals", value: 40, color: "#0066CC" },
  { name: "Chairs", value: 25, color: "#2D5016" },
  { name: "Beds", value: 20, color: "#6366F1" },
  { name: "Tables", value: 15, color: "#F59E0B" },
];

export default function ManufacturerAnalytics() {
  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#222222]">Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">Week of Feb 24 – Mar 2, 2026</p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Total Searches", val: "45,200", change: "+8%", icon: Search, color: "text-[#0066CC]" },
            { label: "Your Impressions", val: "15,000", change: "+12%", icon: Eye, color: "text-purple-500" },
            { label: "Product Clicks", val: "2,500", change: "+5%", icon: TrendingUp, color: "text-orange-500" },
            { label: "Add to Carts", val: "150", change: "+18%", icon: ShoppingCart, color: "text-green-500" },
            { label: "Orders", val: "45", change: "+22%", icon: DollarSign, color: "text-emerald-600" },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
              <s.icon className={`w-5 h-5 mb-2 ${s.color}`} />
              <div className="text-2xl font-bold text-[#222222]">{s.val}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
              <div className="text-xs text-green-500 font-medium mt-1">{s.change} vs last week</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Search volume chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-bold text-[#222222] mb-4">Search Volume vs. Clicks This Week</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklySearches}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="searches" stroke="#0066CC" strokeWidth={2} dot={false} name="Searches" />
                <Line type="monotone" dataKey="clicks" stroke="#2D5016" strokeWidth={2} dot={false} name="Clicks" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Category breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-bold text-[#222222] mb-4">Orders by Category</h2>
            <div className="flex justify-center mb-4">
              <PieChart width={160} height={160}>
                <Pie data={categoryBreakdown} cx={75} cy={75} innerRadius={45} outerRadius={75} dataKey="value">
                  {categoryBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </div>
            <div className="space-y-2">
              {categoryBreakdown.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </div>
                  <span className="font-medium">{c.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          {/* Top search terms */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-bold text-[#222222] mb-4">Top Search Terms</h2>
            <div className="space-y-3">
              {topSearchTerms.map((t, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-sm font-bold text-gray-400">{i + 1}</span>
                    <span className="text-sm">"{t.term}"</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">{t.count.toLocaleString()}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.color}`}>{t.match}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top products */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-bold text-[#222222] mb-4">Top Performing Products</h2>
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.views.toLocaleString()} views · {p.orders} orders</div>
                  </div>
                  <div className="text-sm font-bold text-[#0066CC]">${p.revenue.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
