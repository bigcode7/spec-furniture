/**
 * pages.config.js - Page routing configuration
 *
 * Three core pages: Landing (marketing), Search (app), Quotes (quote builder).
 * Plus static pages: About, Privacy, Terms.
 * All old routes redirect to Search.
 */
import Landing from './pages/Landing';
import Search from './pages/Search';
import Quotes from './pages/Quotes';
import Account from './pages/Account';
import About from './pages/About';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import __Layout from './Layout.jsx';

const ToSearch = () => <Navigate to="/Search" replace />;

export const PAGES = {
    "Landing": Landing,
    "Search": Search,
    "Quotes": Quotes,
    "Account": Account,
    "About": About,
    "Privacy": Privacy,
    "Terms": Terms,
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

export const NO_LAYOUT_PAGES = {
    Admin: { component: lazy(() => import("@/pages/Admin")), layout: false },
};

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};
