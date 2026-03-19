/**
 * pages.config.js - Page routing configuration
 *
 * Three core pages: Landing (marketing), Search (app), Quotes (quote builder).
 * All old routes redirect to Search.
 */
import Landing from './pages/Landing';
import Search from './pages/Search';
import Quotes from './pages/Quotes';
import { Navigate } from 'react-router-dom';
import __Layout from './Layout.jsx';

const ToSearch = () => <Navigate to="/Search" replace />;

export const PAGES = {
    "Landing": Landing,
    "Search": Search,
    "Quotes": Quotes,
    /* Legacy redirects */
    "Dashboard": ToSearch,
    "Cart": ToSearch,
    "Compare": ToSearch,
    "Projects": ToSearch,
    "Intelligence": ToSearch,
    "Showcase": ToSearch,
    "VendorDashboard": ToSearch,
    "Discover": ToSearch,
    "Collections": ToSearch,
    "Assistant": ToSearch,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};
