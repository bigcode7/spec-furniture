import { useState, useEffect, useRef } from "react";
import { Bell, Plus, X, Trash2, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  getAlerts,
  createAlert,
  deleteAlert,
  getAlertNotifications,
  markNotificationsRead,
} from "@/lib/growth-store";

export default function AlertBell() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("notifications");
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [newQuery, setNewQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    setAlerts(getAlerts());
    setNotifications(getAlertNotifications());
  }, [open]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleOpen = () => {
    setOpen(!open);
    if (!open) {
      markNotificationsRead();
      setNotifications(getAlertNotifications());
    }
  };

  const handleCreateAlert = () => {
    if (!newQuery.trim()) return;
    createAlert({ query: newQuery.trim() });
    setAlerts(getAlerts());
    setNewQuery("");
  };

  const handleDeleteAlert = (id) => {
    deleteAlert(id);
    setAlerts(getAlerts());
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/30 transition-colors hover:bg-white/10 hover:text-white/50"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-white/[0.06] bg-[rgba(10,10,15,0.9)] backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/5">
            {["notifications", "alerts"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  tab === t ? "text-white border-b-2 border-gold" : "text-white/30 hover:text-white/50"
                }`}
              >
                {t === "notifications" ? "Activity" : "My Alerts"}
              </button>
            ))}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {tab === "notifications" && (
              <div>
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-white/20 text-sm">
                    No notifications yet. Set up alerts to get notified.
                  </div>
                ) : (
                  notifications.slice(0, 15).map((n) => (
                    <div key={n.id} className={`px-4 py-3 border-b border-white/5 ${n.read ? "" : "bg-gold/5"}`}>
                      <div className="text-sm text-white/70">{n.message}</div>
                      <div className="text-[10px] text-white/20 mt-1">
                        {new Date(n.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "alerts" && (
              <div>
                {/* Create new alert */}
                <div className="p-3 border-b border-white/5">
                  <div className="flex gap-2">
                    <input
                      value={newQuery}
                      onChange={(e) => setNewQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateAlert()}
                      placeholder="e.g. boucle swivel chair"
                      className="flex-1 h-8 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 text-xs text-white placeholder:text-white/20 outline-none focus:border-gold/30 focus:ring-1 focus:ring-gold/20 transition-all"
                    />
                    <button
                      onClick={handleCreateAlert}
                      className="flex h-8 w-8 items-center justify-center rounded-lg btn-gold text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-[10px] text-white/20 mt-1.5">
                    Get notified when new matching products appear
                  </div>
                </div>

                {alerts.length === 0 ? (
                  <div className="p-6 text-center text-white/20 text-sm">
                    No alerts set. Create one above.
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                      <Search className="h-3.5 w-3.5 text-white/20 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white/60 truncate">{alert.query}</div>
                        <div className="text-[10px] text-white/20">
                          Since {new Date(alert.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAlert(alert.id)}
                        className="text-white/20 hover:text-red-400 p-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
