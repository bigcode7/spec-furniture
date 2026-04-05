/**
 * pages.config.js - Page routing configuration
 *
 * Three core pages: Landing (marketing), Search (app), Quotes (quote builder).
 * Plus static pages: About, Privacy, Terms.
 * All old routes redirect to Search.
 *
 * Only Landing is eagerly loaded. All other pages are lazy-loaded
 * for faster initial bundle and Time to Interactive.
 */
import Landing from './pages/Landing';
import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import __Layout from './Layout.jsx';

const Search = lazy(() => import('./pages/Search'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Quotes = lazy(() => import('./pages/Quotes'));
const Account = lazy(() => import('./pages/Account'));
const About = lazy(() => import('./pages/About'));
const ClientPortal = lazy(() => import('./pages/ClientPortal'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));

const ToSearch = () => <Navigate to="/Search" replace />;

export const PAGES = {
    "Landing": Landing,
    "Search": Search,
    "Quotes": Quotes,
    "Account": Account,
    "About": About,
    "Privacy": Privacy,
    "Terms": Terms,
    "Approve": ClientPortal,
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
