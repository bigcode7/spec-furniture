/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Cart from './pages/Cart';
import Compare from './pages/Compare';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import ManufacturerAnalytics from './pages/ManufacturerAnalytics';
import ManufacturerCatalog from './pages/ManufacturerCatalog';
import Manufacturers from './pages/Manufacturers';
import Orders from './pages/Orders';
import ProductDetail from './pages/ProductDetail';
import Projects from './pages/Projects';
import RetailerAnalytics from './pages/RetailerAnalytics';
import Search from './pages/Search';
import VendorDashboard from './pages/VendorDashboard';
import Intelligence from './pages/Intelligence';
import AdminImport from './pages/AdminImport';
import AdminAnalytics from './pages/AdminAnalytics';
import ClientPortal from './pages/ClientPortal';
import Showcase from './pages/Showcase';
import { Navigate } from 'react-router-dom';
import __Layout from './Layout.jsx';

/* Redirect components for consolidated Intelligence tabs */
const TrendsRedirect = () => <Navigate to="/Intelligence?tab=trends" replace />;
const VendorIntelRedirect = () => <Navigate to="/Intelligence?tab=vendors" replace />;
const WeeklyDigestRedirect = () => <Navigate to="/Intelligence?tab=digest" replace />;

/* Redirect components for consolidated Compare tabs */
const PresentationRedirect = () => <Navigate to="/Compare?tab=presentation" replace />;
const PresentationBuilderRedirect = () => <Navigate to="/Compare?tab=builder" replace />;

/* Redirect components for merged Discover/Collections into Search */
const DiscoverRedirect = () => <Navigate to="/Search?mode=discover" replace />;
const CollectionsRedirect = () => <Navigate to="/Search?mode=collections" replace />;

/* Redirect components for consolidated Project tools into Projects */
const ProjectManagerRedirect = () => <Navigate to="/Projects" replace />;
const ProjectIntakeRedirect = () => <Navigate to="/Projects?tab=intake" replace />;
const DesignBriefRedirect = () => <Navigate to="/Projects?tab=brief" replace />;
const SourcingBoardRedirect = () => <Navigate to="/Projects?tab=sourcing" replace />;
const ProjectWorkflowRedirect = () => <Navigate to="/Projects?tab=workflow" replace />;
const RoomPlannerRedirect = () => <Navigate to="/Projects?tab=room-plan" replace />;
const RoomDesignerRedirect = () => <Navigate to="/Projects?tab=room-design" replace />;
const CostTrackerRedirect = () => <Navigate to="/Projects?tab=budget" replace />;

export const PAGES = {
    "Cart": Cart,
    "Compare": Compare,
    "Dashboard": Dashboard,
    "DesignBrief": DesignBriefRedirect,
    "Landing": Landing,
    "ManufacturerAnalytics": ManufacturerAnalytics,
    "ManufacturerCatalog": ManufacturerCatalog,
    "Manufacturers": Manufacturers,
    "Orders": Orders,
    "Presentation": PresentationRedirect,
    "PresentationBuilder": PresentationBuilderRedirect,
    "ProductDetail": ProductDetail,
    "ProjectManager": ProjectManagerRedirect,
    "Projects": Projects,
    "RetailerAnalytics": RetailerAnalytics,
    "RoomPlanner": RoomPlannerRedirect,
    "Search": Search,
    "Trends": TrendsRedirect,
    "VendorDashboard": VendorDashboard,
    "VendorIntel": VendorIntelRedirect,
    "WeeklyDigest": WeeklyDigestRedirect,
    "ProjectWorkflow": ProjectWorkflowRedirect,
    "Intelligence": Intelligence,
    "AdminImport": AdminImport,
    "AdminAnalytics": AdminAnalytics,
    "ProjectIntake": ProjectIntakeRedirect,
    "SourcingBoard": SourcingBoardRedirect,
    "ClientPortal": ClientPortal,
    "CostTracker": CostTrackerRedirect,
    "RoomDesigner": RoomDesignerRedirect,
    "Discover": DiscoverRedirect,
    "Collections": CollectionsRedirect,
    "Showcase": Showcase,
    "Assistant": () => <Navigate to="/Search" replace />,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};
