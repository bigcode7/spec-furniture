import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Check, CheckCheck, Sparkles, TrendingUp,
  Package, DollarSign, FolderKanban, Search,
} from "lucide-react";
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  getUnreadNotificationCount,
} from "@/lib/growth-store";

const ICON_MAP = {
  "new-products": Sparkles,
  "collection-update": Package,
  "price-drop": DollarSign,
  "project-reminder": FolderKanban,
  "trending": TrendingUp,
  "search": Search,
  default: Bell,
};

const COLOR_MAP = {
  "new-products": "text-gold bg-gold/10",
  "collection-update": "text-purple-400 bg-purple-500/10",
  "price-drop": "text-green-400 bg-green-500/10",
  "project-reminder": "text-amber-400 bg-amber-500/10",
  "trending": "text-emerald-400 bg-emerald-500/10",
  "search": "text-gold bg-gold/10",
  default: "text-white/40 bg-white/5",
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/**
 * Notification Center — bell icon with dropdown.
 * Shows in-app notifications for new products, collection updates,
 * price drops, project reminders, and trending alerts.
 *
 * Usage: <NotificationCenter />
 * Designed to replace or supplement AlertBell in the nav.
 */
export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef(null);

  useEffect(() => {
    setNotifications(getNotifications());
    setUnreadCount(getUnreadNotificationCount());
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleMarkRead = (id) => {
    markNotificationRead(id);
    setNotifications(getNotifications());
    setUnreadCount(getUnreadNotificationCount());
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    setNotifications(getNotifications());
    setUnreadCount(0);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/30 hover:bg-white/5 hover:text-white/50 transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-white/[0.06] bg-[rgba(10,10,15,0.9)] backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-sm font-display font-medium text-white/70">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-gold/70 hover:text-gold transition-colors flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="w-6 h-6 text-white/10 mx-auto mb-2" />
                  <p className="text-xs text-white/25">No notifications yet</p>
                  <p className="text-[10px] text-white/15 mt-1">
                    We'll notify you about new products matching your style, price drops, and project updates.
                  </p>
                </div>
              ) : (
                notifications.slice(0, 20).map((notif) => {
                  const type = notif.type || "default";
                  const Icon = ICON_MAP[type] || ICON_MAP.default;
                  const colorClass = COLOR_MAP[type] || COLOR_MAP.default;

                  return (
                    <div
                      key={notif.id}
                      className={`px-4 py-3 border-b border-white/[0.03] transition-colors hover:bg-white/[0.02] ${
                        notif.read ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/70 leading-relaxed">
                            {notif.message || notif.title}
                          </p>
                          {notif.detail && (
                            <p className="text-[10px] text-white/30 mt-0.5">{notif.detail}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-white/20">
                              {timeAgo(notif.created_at)}
                            </span>
                            {notif.link && (
                              <Link
                                to={notif.link}
                                onClick={() => { handleMarkRead(notif.id); setOpen(false); }}
                                className="text-[10px] text-gold/70 hover:text-gold transition-colors"
                              >
                                View
                              </Link>
                            )}
                            {!notif.read && (
                              <button
                                onClick={() => handleMarkRead(notif.id)}
                                className="text-[10px] text-white/20 hover:text-white/40 transition-colors"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-white/[0.06]">
                <Link
                  to={createPageUrl("Search") + "?mode=discover"}
                  onClick={() => setOpen(false)}
                  className="text-[10px] text-gold/70 hover:text-gold transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Discover products matching your style
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
