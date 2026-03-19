/**
 * pages.config.js - Page routing configuration
 *
 * Simplified to two core pages: Search and Quotes.
 * All old routes redirect to Search.
 */
import Search from './pages/Search';
import Quotes from './pages/Quotes';
import { Navigate } from 'react-router-dom';
import __Layout from './Layout.jsx';

/* All legacy routes redirect to Search */
const ToSearch = () => <Navigate to="/Search" replace />;
const ToQuotes = () => <Navigate to="/Quotes" replace />;

export const PAGES = {
    "Search": Search,
    "Quotes": Quotes,
    /* Legacy redirects */
    "Landing": ToSearch,
    "Dashboard": ToSearch,
    "Cart": ToQuotes,
    "Compare": ToSearch,
    "Projects": ToSearch,
    "Intelligence": ToSearch,
    "Trends": ToSearch,
    "VendorIntel": ToSearch,
    "WeeklyDigest": ToSearch,
    "Showcase": ToSearch,
    "VendorDashboard": ToSearch,
    "ManufacturerAnalytics": ToSearch,
    "ManufacturerCatalog": ToSearch,
    "Manufacturers": ToSearch,
    "Orders": ToSearch,
    "AdminImport": ToSearch,
    "AdminAnalytics": ToSearch,
    "ClientPortal": ToSearch,
    "Discover": ToSearch,
    "Collections": ToSearch,
    "Assistant": ToSearch,
}

export const pagesConfig = {
    mainPage: "Search",
    Pages: PAGES,
    Layout: __Layout,
};
