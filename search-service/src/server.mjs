import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env file if present
const __server_dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__server_dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

import http from "node:http";
import { readCatalog, readRuns, readVerifiedCatalog } from "./lib/store.mjs";
import { searchCatalog } from "./lib/rank.mjs";
import { normalizeText } from "./lib/normalize.mjs";
import { getCatalogSummary, ingestVendors, seedSampleCatalog } from "./lib/ingest.mjs";
import { priorityVendors } from "./config/vendors.mjs";
import { discoverLiveVendorProducts } from "./lib/discover.mjs";

import { buildQueryVariants, buildSearchIntent } from "./lib/query-intelligence.mjs";
import { aiParseAndExpand, aiDiscoverProducts, aiRankResults, aiGenerateSummary, aiCompareProducts, aiGenerateQuoteNarratives, aiGeneratePresentation, aiVendorIntelligence, aiAnalyzeProject, aiTrendAnalysis, aiExtractProduct, aiChat, aiVisualSearch, aiRoomPlan, aiDesignBrief, aiAutocomplete, aiWeeklyDigest, aiConversationalSearch, getApiCallStats } from "./lib/ai-search.mjs";
import { crawlAllVendors, crawlVendor, searchTradeCatalog, getTradeCatalogStats, readTradeCatalog } from "./lib/catalog-crawler.mjs";
import { tradeVendors } from "./config/trade-vendors.mjs";
import { initCatalogDB, searchCatalogDB, insertProducts as dbInsertProducts, getCatalogDBStats, getProductCount, clearSearchCache, getVendorCrawlMeta, setVendorCrawlMeta, getProductsByVendor, getProduct, findSimilarProducts, getAllProducts, updateProductDirect, deleteProduct, forceDeleteProduct, getProductsByVendorGrouped, renormalizeAllCategories, recomputeAllQualityScores, computeFacets, downloadCatalogIfMissing, isCatalogFromURL } from "./db/catalog-db.mjs";
import { diversifyResults, getVendorDiversityStats } from "./lib/vendor-diversity.mjs";
import { startCrawlScheduler, crawlForQuery, getCrawlStatus } from "./jobs/crawl-scheduler.mjs";
import { runBulkImport, getImportStatus, importVendor } from "./importers/bulk-importer.mjs";
import { importFromCsv } from "./importers/csv-importer.mjs";
import { buildAutocompleteIndex, autocompleteSearch, smartAutocomplete, recordSearch } from "./lib/autocomplete-index.mjs";
import { initAnalytics, trackSearch, trackClick, trackCompare, trackQuote, getAnalyticsDashboard, getProductClickData, getSearchesByDay, getRecentSearches, getSearchLocations } from "./lib/search-analytics.mjs";
import { runImageVerification, getImageVerificationStatus, stopImageVerification } from "./jobs/image-verifier.mjs";
import { runDeduplication, getDedupStatus } from "./jobs/dedup-job.mjs";
import { runPhotoAnalysis, getPhotoAnalysisStatus, stopPhotoAnalysis } from "./jobs/photo-analyzer.mjs";
import { runEnrichment, getEnrichmentStatus, stopEnrichment } from "./jobs/enrichment-job.mjs";
import { runVisualTagger, getVisualTaggerStatus, stopVisualTagger } from "./jobs/visual-tagger.mjs";
import { runImageFixer, getImageFixerStatus, stopImageFixer } from "./jobs/image-fixer.mjs";
import { runDeepEnrichment, getDeepEnrichmentStatus, stopDeepEnrichment } from "./jobs/deep-enrichment-job.mjs";
import { importBernhardt, getBernhardtStatus, stopBernhardt } from "./importers/bernhardt-importer.mjs";
import { runCatalogCleanup, getCatalogCleanupStatus, stopCatalogCleanup } from "./jobs/catalog-cleanup-job.mjs";
import { BLOCKED_VENDOR_IDS, isVendorBlocked, isProductBlocked } from "./config/vendor-blocklist.mjs";
import { importMissingVendors, getMissingVendorsStatus, stopMissingVendors } from "./importers/missing-vendors-importer.mjs";
import { importTheodoreAlexander, getTheodoreAlexanderStatus, stopTheodoreAlexander } from "./importers/theodore-alexander-importer.mjs";
import { importRowe, getRoweStatus, stopRowe } from "./importers/rowe-importer.mjs";
import { importBaker, getBakerStatus, stopBaker } from "./importers/baker-importer.mjs";
import { importHancockMoore, getHancockMooreStatus, stopHancockMoore } from "./importers/hancock-moore-importer.mjs";
import { importCRLaine, getCRLaineStatus, stopCRLaine } from "./importers/crlaine-importer.mjs";
import { importVerellen, getVerellenStatus, stopVerellen } from "./importers/verellen-importer.mjs";
import { getCategoryTree } from "./lib/category-normalizer.mjs";
import { detectQueryCategory, productMatchesCategory, inferCategoryFromName } from "./lib/query-category-filter.mjs";
import { initVectorStore, indexAllProducts as vectorIndexAll, indexProduct as vectorIndexProduct, removeVector, getVectorStoreStats, persistVectors, crossMatchScores, vectorSearch } from "./lib/vector-store.mjs";
import { searchPipeline, findSimilar as vectorFindSimilar, listSearchPipeline, buildCatalogIndex, clearVectorSearchCache, getAICostStats, visualSearchPipeline } from "./lib/ai-vector-search.mjs";
import { getRoomTemplate, getAllRoomTemplates, getStyleDNA, checkStyleCoherence, generateSourcingQueries, estimateLeadTime, suggestSwaps } from "./lib/sourcing-brain.mjs";
import { initProjectStore, createProject, getProject, updateProject, deleteProject, listProjects, addRoomToProject, updateRoomItem, getProjectShareToken, getProjectByShareToken } from "./lib/project-store.mjs";
import { parseDimensions, batchParseDimensions, checkProductFit, checkArrangement, calculateFitScore, checkDeliveryFeasibility, suggestProportions, recommendRoomSize, getSpatialRules } from "./lib/spatial-engine.mjs";
import { generateLayout, generateFloorPlanSVG, generateScaleComparisonSVG } from "./lib/layout-generator.mjs";
import { getMaterial, getAllMaterials, matchProductMaterial, checkMaterialSuitability, compareMaterials, getProductMaterialBadges, scoreMaterialFit } from "./lib/material-intelligence.mjs";
import { getVendorProcurement, getAllVendorProcurement, getProductProcurement, estimateFullCost, estimateCOMYardage, checkCOMAvailability } from "./lib/procurement-intel.mjs";
import { think as designBrainThink } from "./lib/design-brain.mjs";
import { translateQuery, applyAIFilter, getAIQueryStats, translateFollowUp, localParseFollowUp, localParse } from "./lib/ai-query-translator.mjs";
import { askSearchBrain } from "./lib/search-brain.mjs";
import { registerUser, loginUser, getUserFromToken, updateUser, extractToken, changePassword, deleteUser, exportUserData, generateVerificationToken, verifyEmail, generateResetToken, resetPassword, checkLoginRateLimit, recordFailedLogin, clearLoginAttempts, getAllUsers, initDatabase } from "./lib/auth-store.mjs";
import { initSubscriptionStore, getGuestUsage, incrementGuestSearch, incrementGuestQuote, incrementGuestQuoteItems, getSubscription, getAllSubscriptions, setSubscription, getUserStatus, checkAccess, logSubscriptionEvent, getRevenueDashboard, generateGuestToken, verifyGuestToken, linkFingerprintToUser, checkMultiAccountAbuse, getActiveVisitors, getFunnelMetrics, FREE_SEARCH_LIMIT, createSession, validateSession, trackActivity, checkSharingViolation, createTeam, getTeam, getTeamByUser, inviteMember, removeMember, addSeat, getTeamMembers, isAdminEmail } from "./lib/subscription-store.mjs";
import { initStripe, createCheckoutSession, verifyWebhook, cancelSubscription, reactivateSubscription, createReactivationSession, getStripeSubscription, createPortalSession, createTeamSeatCheckout } from "./lib/stripe-integration.mjs";
import { initSearchEnhancer, expandAllSynonyms, findProductsBySynonymExpansion, computeEnhancedScore, getMatchingVendors, getEnhancerStats } from "./lib/search-enhancer.mjs";
import { initAdminStore, logCompAction, getCompLog, getActiveComps, logAdminAction, getActivityLog, saveHealthCheckResult, getHealthCheckResults, getHealthAlerts, dismissAlert, createAlert, runCatalogHealthCheck, getVendorHealthSummary, getLastHealthRun, setLastHealthRun, persistAdminStore } from "./lib/admin-store.mjs";
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail, sendSubscriptionConfirmationEmail, sendPaymentFailedEmail, sendClientFeedbackEmail, sendRevisionEmail } from "./lib/email.mjs";
import { initUserDataStore, getSavedProducts, saveProduct, unsaveProduct, getUserQuote, saveUserQuote, addSearchHistory, getSearchHistory, createSharedQuote, getSharedQuote, submitQuoteFeedback, getDesignerSharedQuotes, updateSharedQuote } from "./lib/user-data-store.mjs";

const host = process.env.SEARCH_SERVICE_HOST || "0.0.0.0";
const port = Number(process.env.PORT || process.env.SEARCH_SERVICE_PORT || 4310);

// ── Rate Limiting ──
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function getRateLimitKey(ip) {
  return ip || "unknown";
}

function checkRateLimit(ip, maxRequests) {
  const key = getRateLimitKey(ip);
  const now = Date.now();
  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(key, entry);
  }
  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// ── Bot detection ──
const BOT_UA_PATTERN = /bot|crawl|spider|slurp|googlebot|bingbot|yandex|baidu|duckduck|facebookexternalhit|twitterbot|linkedinbot|embedly|quora|pinterest|redditbot|applebot|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider|gptbot|claude|anthropic/i;

function isBot(req) {
  const ua = req.headers["user-agent"] || "";
  return BOT_UA_PATTERN.test(ua);
}

// ── Cloud provider IP blocking (anti-scrape) ──
// AWS, GCP, Azure, DigitalOcean, Oracle Cloud, Hetzner — no real designer searches from a data center
const BLOCKED_IP_PREFIXES = [
  // AWS (the scraper's IPs)
  "3.0.", "3.1.", "3.2.", "3.5.", "3.6.", "3.8.", "3.9.",
  "3.12.", "3.13.", "3.14.", "3.15.", "3.16.", "3.17.", "3.18.", "3.19.",
  "3.20.", "3.21.", "3.22.", "3.23.", "3.24.", "3.25.", "3.26.", "3.27.", "3.28.", "3.29.",
  "3.32.", "3.33.", "3.34.", "3.35.", "3.36.", "3.37.", "3.38.", "3.39.",
  "3.64.", "3.65.", "3.66.", "3.67.", "3.68.", "3.69.",
  "3.96.", "3.97.", "3.98.", "3.99.", "3.100.", "3.101.", "3.104.", "3.105.", "3.106.",
  "3.108.", "3.109.", "3.110.", "3.111.", "3.112.",
  "3.120.", "3.121.", "3.122.", "3.123.", "3.124.", "3.125.", "3.126.", "3.127.",
  "3.128.", "3.129.", "3.130.", "3.131.", "3.132.", "3.133.", "3.134.", "3.135.", "3.136.", "3.137.", "3.138.", "3.139.",
  "3.140.", "3.141.", "3.142.", "3.143.", "3.144.", "3.145.",
  "3.208.", "3.209.", "3.210.", "3.211.", "3.212.", "3.213.", "3.214.", "3.215.", "3.216.", "3.217.", "3.218.", "3.219.",
  "3.224.", "3.225.", "3.226.", "3.227.", "3.228.", "3.229.", "3.230.", "3.231.", "3.232.", "3.233.", "3.234.", "3.235.", "3.236.", "3.237.", "3.238.", "3.239.",
  "13.52.", "13.53.", "13.54.", "13.55.", "13.56.", "13.57.", "13.58.", "13.59.",
  "13.112.", "13.113.", "13.114.", "13.115.",
  "13.124.", "13.125.", "13.126.", "13.127.",
  "13.200.", "13.201.", "13.208.", "13.209.", "13.210.", "13.211.", "13.212.", "13.213.",
  "13.228.", "13.229.", "13.230.", "13.231.", "13.232.", "13.233.", "13.234.", "13.235.", "13.236.", "13.237.", "13.238.", "13.239.",
  "13.244.", "13.245.", "13.246.", "13.247.", "13.248.", "13.249.", "13.250.", "13.251.",
  "15.152.", "15.153.", "15.156.", "15.157.", "15.160.", "15.161.", "15.164.", "15.165.",
  "15.168.", "15.177.", "15.184.", "15.185.", "15.188.", "15.197.", "15.200.", "15.206.", "15.207.",
  "16.16.", "16.162.", "16.163.", "16.170.", "16.171.",
  "18.116.", "18.117.", "18.118.", "18.119.",
  "18.130.", "18.131.", "18.132.", "18.133.", "18.134.", "18.135.",
  "18.136.", "18.138.", "18.139.", "18.140.", "18.141.", "18.142.", "18.143.",
  "18.144.", "18.153.", "18.156.", "18.157.", "18.158.", "18.159.",
  "18.162.", "18.163.", "18.166.", "18.167.", "18.168.", "18.169.",
  "18.170.", "18.171.", "18.172.", "18.175.", "18.176.", "18.177.", "18.178.", "18.179.",
  "18.180.", "18.181.", "18.182.", "18.183.", "18.184.", "18.185.",
  "18.188.", "18.189.", "18.190.", "18.191.",
  "18.193.", "18.194.", "18.195.", "18.196.", "18.197.", "18.198.", "18.199.",
  "18.200.", "18.201.", "18.202.", "18.203.", "18.204.", "18.205.", "18.206.", "18.207.",
  "18.208.", "18.209.", "18.210.", "18.211.", "18.212.", "18.213.", "18.214.", "18.215.",
  "18.216.", "18.217.", "18.218.", "18.219.", "18.220.", "18.221.", "18.222.", "18.223.",
  "18.224.", "18.225.", "18.228.", "18.229.", "18.230.", "18.231.", "18.232.", "18.233.", "18.234.", "18.236.", "18.237.",
  "18.246.", "18.252.", "18.253.", "18.254.",
  "23.20.", "23.21.", "23.22.", "23.23.",
  "34.192.", "34.193.", "34.194.", "34.195.", "34.196.", "34.197.", "34.198.", "34.199.",
  "34.200.", "34.201.", "34.202.", "34.203.", "34.204.", "34.205.", "34.206.", "34.207.",
  "34.208.", "34.209.", "34.210.", "34.211.", "34.212.", "34.213.", "34.214.", "34.215.", "34.216.", "34.217.", "34.218.", "34.219.",
  "34.220.", "34.221.", "34.222.", "34.223.", "34.224.", "34.225.", "34.226.", "34.227.", "34.228.", "34.229.",
  "34.230.", "34.231.", "34.232.", "34.233.", "34.234.", "34.235.", "34.236.", "34.237.", "34.238.", "34.239.",
  "34.240.", "34.241.", "34.242.", "34.243.", "34.244.", "34.245.", "34.246.", "34.247.", "34.248.", "34.249.",
  "34.250.", "34.251.", "34.252.", "34.253.", "34.254.", "34.255.",
  "35.153.", "35.154.", "35.155.", "35.156.", "35.157.", "35.158.", "35.159.",
  "35.160.", "35.161.", "35.162.", "35.163.", "35.164.", "35.165.", "35.166.", "35.167.", "35.168.", "35.169.",
  "35.170.", "35.171.", "35.172.", "35.173.", "35.174.", "35.175.", "35.176.", "35.177.", "35.178.", "35.179.",
  "35.180.", "35.181.", "35.182.",
  "44.192.", "44.193.", "44.194.", "44.195.", "44.196.", "44.197.", "44.198.", "44.199.",
  "44.200.", "44.201.", "44.202.", "44.203.", "44.204.", "44.205.", "44.206.", "44.207.",
  "44.208.", "44.209.", "44.210.", "44.211.", "44.212.", "44.213.", "44.214.", "44.215.", "44.216.", "44.217.", "44.218.", "44.219.",
  "44.220.", "44.221.", "44.222.", "44.223.", "44.224.", "44.225.", "44.226.", "44.227.", "44.228.", "44.229.",
  "44.230.", "44.231.", "44.232.", "44.233.", "44.234.", "44.235.", "44.236.", "44.237.", "44.238.", "44.239.",
  "44.240.", "44.241.", "44.242.",
  "50.16.", "50.17.", "50.18.", "50.19.",
  "52.0.", "52.1.", "52.2.", "52.3.", "52.4.", "52.5.", "52.6.", "52.7.", "52.8.", "52.9.",
  "52.10.", "52.11.", "52.12.", "52.13.", "52.14.", "52.15.",
  "52.20.", "52.21.", "52.22.", "52.23.", "52.24.", "52.25.", "52.26.", "52.27.", "52.28.", "52.29.",
  "52.30.", "52.31.", "52.32.", "52.33.", "52.34.", "52.35.", "52.36.", "52.37.", "52.38.", "52.39.",
  "52.40.", "52.41.", "52.42.", "52.43.", "52.44.", "52.45.", "52.46.", "52.47.", "52.48.", "52.49.",
  "52.50.", "52.51.", "52.52.", "52.53.", "52.54.", "52.55.", "52.56.", "52.57.", "52.58.", "52.59.",
  "52.60.", "52.61.", "52.62.", "52.63.", "52.64.", "52.65.", "52.66.", "52.67.", "52.68.", "52.69.",
  "52.70.", "52.71.", "52.72.", "52.73.", "52.74.", "52.75.", "52.76.", "52.77.", "52.78.", "52.79.",
  "52.80.", "52.81.", "52.82.", "52.83.",
  "52.86.", "52.87.", "52.88.", "52.89.", "52.90.", "52.91.", "52.92.", "52.93.", "52.94.", "52.95.",
  "52.194.", "52.195.", "52.196.", "52.197.", "52.198.", "52.199.",
  "52.200.", "52.201.", "52.202.", "52.203.", "52.204.", "52.205.", "52.206.", "52.207.",
  "54.64.", "54.65.", "54.66.", "54.67.", "54.68.", "54.69.",
  "54.72.", "54.73.", "54.74.", "54.75.", "54.76.", "54.77.", "54.78.", "54.79.",
  "54.80.", "54.81.", "54.82.", "54.83.", "54.84.", "54.85.", "54.86.", "54.87.", "54.88.", "54.89.",
  "54.90.", "54.91.", "54.92.", "54.93.", "54.94.", "54.95.",
  "54.144.", "54.145.", "54.146.", "54.147.", "54.148.", "54.149.",
  "54.150.", "54.151.", "54.152.", "54.153.", "54.154.", "54.155.", "54.156.", "54.157.", "54.158.", "54.159.",
  "54.160.", "54.161.", "54.162.", "54.163.", "54.164.", "54.165.", "54.166.", "54.167.", "54.168.", "54.169.",
  "54.170.", "54.171.", "54.172.", "54.173.", "54.174.", "54.175.", "54.176.", "54.177.", "54.178.", "54.179.",
  "54.180.", "54.183.", "54.184.", "54.185.", "54.186.", "54.187.",
  "54.188.", "54.189.", "54.190.", "54.191.", "54.192.", "54.193.",
  "54.194.", "54.195.", "54.196.", "54.197.", "54.198.", "54.199.",
  "54.200.", "54.201.", "54.202.", "54.203.", "54.204.", "54.205.", "54.206.", "54.207.",
  "54.208.", "54.209.", "54.210.", "54.211.", "54.212.", "54.213.", "54.214.", "54.215.", "54.216.", "54.217.", "54.218.", "54.219.",
  "54.220.", "54.221.", "54.222.", "54.224.", "54.225.", "54.226.", "54.227.", "54.228.", "54.229.",
  "54.230.", "54.231.", "54.232.", "54.233.", "54.234.", "54.235.", "54.236.", "54.237.", "54.238.", "54.239.",
  "54.240.", "54.241.", "54.242.", "54.243.", "54.244.", "54.245.", "54.246.", "54.247.", "54.248.", "54.249.",
  "54.250.", "54.251.", "54.252.", "54.253.", "54.254.", "54.255.",
  // GCP
  "34.64.", "34.65.", "34.66.", "34.67.", "34.68.", "34.69.",
  "34.70.", "34.71.", "34.72.", "34.73.", "34.74.", "34.75.", "34.76.", "34.77.", "34.78.", "34.79.",
  "34.80.", "34.81.", "34.82.", "34.83.", "34.84.", "34.85.", "34.86.", "34.87.", "34.88.", "34.89.",
  "34.90.", "34.91.", "34.92.", "34.93.", "34.94.", "34.95.", "34.96.", "34.97.", "34.98.", "34.99.",
  "34.100.", "34.101.", "34.102.", "34.103.", "34.104.", "34.105.", "34.106.", "34.107.", "34.108.", "34.109.",
  "34.110.", "34.111.", "34.112.", "34.113.", "34.114.", "34.115.", "34.116.", "34.117.", "34.118.", "34.119.",
  "34.120.", "34.121.", "34.122.", "34.123.", "34.124.", "34.125.", "34.126.", "34.127.", "34.128.",
  "34.130.", "34.131.", "34.132.", "34.133.", "34.134.", "34.135.", "34.136.", "34.137.", "34.138.", "34.139.",
  "34.140.", "34.141.", "34.142.", "34.143.", "34.144.", "34.145.", "34.146.", "34.147.", "34.148.", "34.149.",
  "34.150.", "34.151.", "34.152.", "34.153.", "34.154.", "34.155.", "34.156.", "34.157.", "34.158.", "34.159.",
  "34.160.", "34.161.", "34.162.", "34.163.", "34.164.", "34.165.", "34.166.", "34.167.", "34.168.", "34.169.",
  "34.170.", "34.171.", "34.172.", "34.173.", "34.174.", "34.175.", "34.176.",
  "35.184.", "35.185.", "35.186.", "35.187.", "35.188.", "35.189.",
  "35.190.", "35.191.", "35.192.", "35.193.", "35.194.", "35.195.", "35.196.", "35.197.", "35.198.", "35.199.",
  "35.200.", "35.201.", "35.202.", "35.203.", "35.204.", "35.205.", "35.206.", "35.207.",
  "35.208.", "35.209.", "35.210.", "35.211.", "35.212.", "35.213.", "35.214.", "35.215.", "35.216.", "35.217.",
  "35.218.", "35.219.", "35.220.", "35.221.", "35.222.", "35.223.", "35.224.", "35.225.", "35.226.", "35.227.",
  "35.228.", "35.229.", "35.230.", "35.231.", "35.232.", "35.233.", "35.234.", "35.235.", "35.236.", "35.237.",
  "35.238.", "35.239.", "35.240.", "35.241.", "35.242.", "35.243.", "35.244.", "35.245.", "35.246.", "35.247.",
  "104.196.", "104.197.", "104.198.", "104.199.",
  // Azure
  "13.64.", "13.65.", "13.66.", "13.67.", "13.68.", "13.69.",
  "13.70.", "13.71.", "13.72.", "13.73.", "13.74.", "13.75.", "13.76.", "13.77.", "13.78.", "13.79.",
  "13.80.", "13.81.", "13.82.", "13.83.", "13.84.", "13.85.", "13.86.", "13.87.", "13.88.", "13.89.",
  "13.90.", "13.91.", "13.92.", "13.93.", "13.94.", "13.95.",
  "20.36.", "20.37.", "20.38.", "20.39.", "20.40.", "20.41.", "20.42.", "20.43.", "20.44.", "20.45.",
  "20.46.", "20.47.", "20.48.", "20.49.", "20.50.", "20.51.", "20.52.", "20.53.", "20.54.", "20.55.",
  "20.56.", "20.57.", "20.58.", "20.59.", "20.60.", "20.61.", "20.62.", "20.63.",
  "20.64.", "20.65.", "20.66.", "20.67.", "20.68.", "20.69.", "20.70.", "20.71.", "20.72.", "20.73.",
  "20.74.", "20.75.", "20.76.", "20.77.", "20.78.", "20.79.", "20.80.", "20.81.", "20.82.", "20.83.",
  "20.84.", "20.85.", "20.86.", "20.87.", "20.88.", "20.89.", "20.90.", "20.91.", "20.92.", "20.93.",
  "20.94.", "20.95.", "20.96.", "20.97.", "20.98.", "20.99.",
  "20.100.", "20.101.", "20.102.", "20.103.", "20.104.", "20.105.", "20.106.", "20.107.", "20.108.", "20.109.",
  "20.110.", "20.111.", "20.112.", "20.113.", "20.114.", "20.115.", "20.116.", "20.117.", "20.118.", "20.119.",
  "20.120.", "20.121.", "20.122.", "20.123.", "20.124.", "20.125.", "20.150.", "20.157.", "20.184.", "20.185.",
  "20.186.", "20.187.", "20.188.", "20.189.", "20.190.", "20.191.",
  "20.192.", "20.193.", "20.194.", "20.195.", "20.196.", "20.197.", "20.198.", "20.199.",
  "20.200.", "20.201.", "20.202.", "20.203.", "20.204.", "20.205.", "20.206.", "20.207.",
  "20.208.", "20.209.", "20.210.", "20.211.", "20.212.", "20.213.", "20.214.", "20.215.", "20.216.", "20.217.",
  "20.218.", "20.219.", "20.220.", "20.221.", "20.222.", "20.223.", "20.224.", "20.225.", "20.226.", "20.227.",
  "20.228.", "20.229.", "20.230.", "20.231.", "20.232.", "20.233.", "20.234.", "20.235.", "20.236.", "20.237.",
  "20.238.", "20.239.", "20.240.", "20.241.", "20.242.", "20.243.", "20.244.", "20.245.", "20.246.",
  "40.64.", "40.65.", "40.66.", "40.67.", "40.68.", "40.69.", "40.70.", "40.71.", "40.74.", "40.75.",
  "40.76.", "40.77.", "40.78.", "40.79.", "40.80.", "40.81.", "40.82.", "40.83.", "40.84.", "40.85.",
  "40.86.", "40.87.", "40.88.", "40.89.", "40.90.", "40.91.",
  "40.112.", "40.113.", "40.114.", "40.115.", "40.116.", "40.117.", "40.118.", "40.119.",
  "40.120.", "40.121.", "40.122.", "40.123.", "40.124.", "40.125.", "40.126.", "40.127.",
  "51.104.", "51.105.", "51.107.", "51.116.", "51.120.", "51.124.", "51.132.", "51.136.", "51.137.", "51.138.", "51.140.", "51.141.", "51.142.", "51.143.", "51.144.", "51.145.",
  // DigitalOcean
  "64.225.", "134.122.", "134.209.", "137.184.", "138.68.", "139.59.",
  "142.93.", "143.110.", "143.198.", "144.126.", "146.190.",
  "147.182.", "148.113.",
  "157.230.", "157.245.",
  "159.65.", "159.89.", "159.203.",
  "161.35.", "162.243.",
  "164.90.", "164.92.",
  "165.22.", "165.227.", "165.232.",
  "167.71.", "167.99.", "167.172.",
  "170.64.",
  "174.138.",
  "178.62.", "178.128.",
  "188.166.",
  "192.241.",
  "198.199.", "198.211.",
  "206.81.", "206.189.",
  // Hetzner
  "49.12.", "49.13.",
  "65.21.", "65.108.", "65.109.",
  "78.46.", "78.47.",
  "88.198.", "88.99.",
  "95.216.", "95.217.",
  "116.202.", "116.203.",
  "128.140.",
  "135.181.",
  "136.243.",
  "138.201.",
  "142.132.",
  "144.76.",
  "148.251.",
  "157.90.",
  "159.69.",
  "162.55.",
  "167.233.", "167.235.",
  "168.119.",
  "176.9.",
  "178.63.",
  "188.34.",
  "195.201.",
  "213.133.", "213.239.",
  // OVH
  "51.38.", "51.68.", "51.75.", "51.77.", "51.79.", "51.81.", "51.83.", "51.89.", "51.91.",
  "54.36.", "54.37.", "54.38.", "54.39.",
  "91.134.", "92.222.",
  "135.125.",
  "137.74.",
  "141.94.", "141.95.",
  "145.239.",
  "147.135.",
  "149.56.",
  "151.80.",
  "158.69.",
  "164.132.",
  "176.31.",
  "178.32.", "178.33.",
  "185.231.",
  "188.165.",
  "192.95.",
  "193.70.",
  "198.27.",
  "198.100.",
  "209.50.",
  // Vultr
  "45.32.", "45.63.", "45.76.", "45.77.",
  "66.42.",
  "78.141.",
  "95.179.",
  "104.156.", "104.207.", "104.238.",
  "108.61.",
  "136.244.",
  "140.82.",
  "149.28.",
  "155.138.",
  "207.148.", "207.246.",
  "209.250.",
  "216.128.",
  // Linode / Akamai Cloud
  "45.33.", "45.56.", "45.79.",
  "50.116.",
  "66.175.", "66.228.",
  "69.164.",
  "72.14.",
  "74.207.",
  "85.159.",
  "96.126.",
  "97.107.",
  "109.74.",
  "139.144.", "139.162.",
  "143.42.",
  "170.187.",
  "172.104.", "172.105.",
  "173.230.", "173.255.",
  "178.79.",
  "192.46.", "192.53.", "192.155.",
  "194.195.",
  "198.58.",
  "212.71.",
];

// Build a Set of /16 prefixes for fast O(1) lookup
const BLOCKED_IP_16 = new Set();
const BLOCKED_IP_24 = new Set();
for (const prefix of BLOCKED_IP_PREFIXES) {
  const parts = prefix.split(".");
  if (parts.length === 3) {
    // e.g. "54.176." → /16 prefix
    BLOCKED_IP_16.add(`${parts[0]}.${parts[1]}.`);
  }
}
// Also build /24 set for more specific matching
for (const prefix of BLOCKED_IP_PREFIXES) {
  BLOCKED_IP_24.add(prefix);
}

function isCloudIP(ip) {
  if (!ip) return false;
  // Quick /16 check first (catches most)
  const parts = ip.split(".");
  if (parts.length < 3) return false;
  const p16 = `${parts[0]}.${parts[1]}.`;
  if (BLOCKED_IP_16.has(p16)) return true;
  const p24 = `${parts[0]}.${parts[1]}.${parts[2]}.`;
  if (BLOCKED_IP_24.has(p24)) return true;
  return false;
}

// ── CORS allowed origins ──
const ALLOWED_ORIGINS = new Set([
  "https://spekd.ai",
  "https://www.spekd.ai",
  "http://localhost:4174",
  "http://localhost:5173",
  "http://127.0.0.1:4174",
  "http://127.0.0.1:5173",
]);

function getCorsOrigin(req) {
  const origin = req.headers["origin"];
  if (!origin) return "*"; // non-browser requests (curl, server-to-server)
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  // Allow Railway preview URLs
  if (origin.endsWith(".up.railway.app")) return origin;
  return null; // blocked
}
const liveWarmVendorIds = priorityVendors.filter(v => !isVendorBlocked(v.id)).slice(0, 8).map((vendor) => vendor.id);

// ── Health flag — set true after heavy init completes ──
let serviceReady = false;

// ── Initialize catalog database ──
await initCatalogDB();
console.log(`[startup] After initCatalogDB: ${getProductCount()} products in memory`);
// initUserDataStore() deferred to runHeavyInit to avoid blocking server.listen

// ── Deferred heavy init — runs AFTER server.listen so Railway sees the port immediately ──
async function runHeavyInit() {
  // Initialize user data store (PostgreSQL tables)
  await initUserDataStore();

  // Initialize Stripe
  const stripeOk = await initStripe();
  console.log(`[startup] Stripe: ${stripeOk ? "initialized" : "NOT configured (STRIPE_SECRET_KEY missing)"}`);

  console.log(`[startup] Products in memory at heavy init start: ${getProductCount()}`);

  // Skip catalog mutations on Railway — protect the volume file
  if (!isCatalogFromURL()) {
    // Fix miscategorized products
    for (const product of getAllProducts()) {
      if (product.category === "beds") {
        const name = (product.product_name || "").toLowerCase();
        if (name.includes("pillow") || /catalog$/i.test(name.trim())) {
          updateProductDirect(product.id, { category: "accessories" });
        }
      }
    }

    // Remove non-furniture items from catalog
    {
      const junkCategories = new Set(["fabric", "leather", "finishes", "book"]);
      const junkPatterns = [
        /\bfabric$/i,
        /\bleather$/i,
        /\bfinish$/i,
        /\bcatalog$/i,
        /\bmembership\b/i,
        /\bsubscription\b/i,
        /testing page/i,
        /\|\s*(holly hunt|lee industries|four hands|visual comfort|loloi)/i,  // category pages scraped as products
        /^(sofas|chairs|tables|beds|lighting|rugs|accessories)\s*[&|]/i,     // generic category page titles
      ];
      const scrapedPagePattern = /\|/;
      const finishCodePattern = /^(oak|cherry|mahogany)\s+\d/i;
      const stickleyFinishNumPattern = /^8\d{2}\s+\w/;

      let removedCount = 0;
      for (const product of getAllProducts()) {
        const name = (product.product_name || "").trim();
        const cat = (product.category || "").toLowerCase();
        let shouldRemove = false;

        if (junkCategories.has(cat)) shouldRemove = true;

        if (!shouldRemove) {
          for (const pat of junkPatterns) {
            if (pat.test(name)) { shouldRemove = true; break; }
          }
        }

        if (!shouldRemove && scrapedPagePattern.test(name)) shouldRemove = true;

        if (!shouldRemove && product.vendor_id === "stickley") {
          if (finishCodePattern.test(name) || stickleyFinishNumPattern.test(name)) shouldRemove = true;
        }

        if (!shouldRemove && product.vendor_id === "hooker") {
          if (/^page\s+\w+\s*-\s*\w+/i.test(name) && (product.sku || "").startsWith("HD40046")) shouldRemove = true;
        }

        if (shouldRemove) {
          deleteProduct(product.id);
          removedCount++;
        }
      }
      if (removedCount > 0) {
        console.log(`[startup] Removed ${removedCount} non-furniture items (swatches, catalogs, books, finishes)`);
      }

      let setteeFixCount = 0;
      for (const product of getAllProducts()) {
        const name = (product.product_name || "").toLowerCase();
        const cat = (product.category || "").toLowerCase();
        if (cat === "sofas" && name.includes("settee")) {
          updateProductDirect(product.id, { category: "settees" });
          setteeFixCount++;
        }
        if (cat === "sofas" && (name.includes("swivel") || name.includes("recliner")) && !name.includes("sofa")) {
          updateProductDirect(product.id, { category: "accent-chairs" });
          setteeFixCount++;
        }
      }
      if (setteeFixCount > 0) {
        console.log(`[startup] Re-categorized ${setteeFixCount} settees/chairs out of sofas`);
      }
    }
  } else {
    console.log(`[startup] Skipping catalog cleanup (catalog from URL — protecting data)`);
  }

  // Purge blocked vendors on every startup (ALWAYS runs, even when catalog is from URL)
  // Collect IDs first to avoid mutating the Map while iterating (which skips entries)
  {
    const blockedIds = [];
    const blockedByVendor = {};
    for (const product of getAllProducts()) {
      if (isProductBlocked(product)) {
        const label = product.vendor_id || product.manufacturer_name || product.vendor_name || "unknown";
        blockedIds.push(product.id);
        blockedByVendor[label] = (blockedByVendor[label] || 0) + 1;
      }
    }
    for (const id of blockedIds) {
      forceDeleteProduct(id);
    }
    if (blockedIds.length > 0) {
      console.log(`[startup] Purged ${blockedIds.length} products from blocked vendors:`);
      for (const [vid, count] of Object.entries(blockedByVendor)) {
        console.log(`[startup]   ${vid}: ${count} products removed`);
      }
    }
  }

  // Vendor pricing removals — runs on every startup (including Railway)
  // Hooker Furniture removed public retail pricing from their website
  {
    let hookerPriceStripped = 0;
    for (const product of getAllProducts()) {
      if (product.vendor_id === "hooker" && product.retail_price) {
        product.retail_price = null;
        hookerPriceStripped++;
      }
    }
    if (hookerPriceStripped > 0) {
      console.log(`[startup] Stripped retail pricing from ${hookerPriceStripped} Hooker Furniture products (vendor removed public pricing)`);
    }
  }

  // Initialize project store
  initProjectStore();

  // Re-normalize categories with master tree + compute quality scores
  renormalizeAllCategories();
  recomputeAllQualityScores();

  // Report tagged vs untagged products for search eligibility
  {
    let tagged = 0, untagged = 0, hasCategoryOnly = 0;
    for (const p of getAllProducts()) {
      if (p.ai_furniture_type) tagged++;
      else if (p.category) hasCategoryOnly++;
      else untagged++;
    }
    const excluded = hasCategoryOnly + untagged;
    console.log(`[startup] Search-eligible products: ${tagged} (ai_furniture_type required) | ${excluded} excluded (${hasCategoryOnly} category-only + ${untagged} no type at all)`);
  }

  // Build autocomplete index from catalog data
  buildAutocompleteIndex(getAllProducts());

  // Initialize analytics
  initAnalytics();

  // Initialize database (PostgreSQL or JSON fallback)
  await initDatabase();

  // Initialize subscription store and Stripe
  initSubscriptionStore();
  initAdminStore();
  initStripe().catch(err => console.warn("[stripe] Init failed:", err.message));

  // Build catalog index for Haiku system prompt
  buildCatalogIndex(getAllProducts());

  // Initialize vector store — always load cached vectors from disk
  const isRailway = !!process.env.RAILWAY_PUBLIC_DOMAIN;
  await initVectorStore().catch((err) => {
    console.warn(`[server] Vector store init failed (non-fatal): ${err.message}`);
  });

  if (isRailway) {
    // On Railway: load existing vectors from disk only (no heavy re-embedding)
    vectorIndexAll(getAllProducts(), { reindex: false, skipEmbed: true }).then((stats) => {
      if (stats.total > 0) console.log(`[server] Vector index loaded from cache: ${stats.total} total, ${(stats.timeMs / 1000).toFixed(1)}s`);
      else console.log(`[server] Vector index loaded: using cached vectors.bin`);
    }).catch((err) => {
      console.error(`[server] Vector index load failed: ${err.message}`);
    });
  } else {
    // Local/dev: load from disk + embed any new products
    vectorIndexAll(getAllProducts(), { reindex: false }).then((stats) => {
      if (stats.total > 0) console.log(`[server] Vector indexing complete: ${stats.total} total, ${stats.new} new, ${(stats.timeMs / 1000).toFixed(1)}s`);
    }).catch((err) => {
      console.error(`[server] Vector indexing failed: ${err.message}`);
    });
  }

  // Initialize search enhancer
  {
    const clickData = getProductClickData();
    initSearchEnhancer(getAllProducts(), {
      productClicks: clickData.productClicks,
      totalSearches: clickData.totalSearches,
    });
  }

  serviceReady = true;
  console.log(`[server] Heavy init complete — service fully ready`);

  // Heartbeat: log product count every 60s to detect data loss
  setInterval(() => {
    console.log(`[heartbeat] products=${getProductCount()} vectors=${getVectorStoreStats().total_vectors} uptime=${Math.floor(process.uptime())}s`);
  }, 60_000);
}

const catalogDBInterface = {
  insertProducts: (products) => {
    const result = dbInsertProducts(products);
    // Auto-index new products into vector store (non-blocking)
    for (const p of products) {
      const normalized = getProduct(p.id || "");
      if (normalized) vectorIndexProduct(normalized).catch(() => {});
    }
    return result;
  },
  getVendorCrawlMeta,
  setVendorCrawlMeta,
  getProductsByVendor,
  getProductCount,
  getAllProducts,
  updateProductDirect,
  deleteProduct,
  getProductsByVendorGrouped,
};

// ── Simple in-memory result cache ──
const resultCache = new Map();
let cacheHits = 0;
let cacheMisses = 0;

function getFromCache(key) {
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    resultCache.delete(key);
    return null;
  }
  cacheHits++;
  return entry.value;
}

function setCache(key, value, ttlMs) {
  resultCache.set(key, { value, expires: Date.now() + ttlMs });
  // Evict old entries if cache gets too large
  if (resultCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of resultCache) {
      if (now > v.expires) resultCache.delete(k);
    }
  }
}

function pickRelevantVendors(intent, maxVendors = 5) {
  // If intent specifies a vendor, use that
  if (intent.vendor) {
    const match = tradeVendors.find(v =>
      v.name.toLowerCase().includes(intent.vendor.toLowerCase()) ||
      v.id === intent.vendor.toLowerCase()
    );
    if (match) return [match.id];
  }
  // Otherwise pick top tier vendors
  return tradeVendors
    .filter(v => v.tier <= 2)
    .slice(0, maxVendors)
    .map(v => v.id);
}

// Store current request's CORS origin (set per-request in the handler)
let _currentCorsOrigin = "*";

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": _currentCorsOrigin,
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-fingerprint, x-ls-id, x-admin-key, stripe-signature",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "x-xss-protection": "1; mode=block",
    "referrer-policy": "strict-origin-when-cross-origin",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function notFound(res, path) {
  json(res, 404, { error: "Not found", path: path || undefined });
}

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

function collectBody(req, { raw: returnRaw = false } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let aborted = false;
    req.on("data", (chunk) => {
      const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      totalBytes += buf.length;
      if (totalBytes > MAX_BODY_SIZE) {
        aborted = true;
        req.destroy();
        reject(new Error("PAYLOAD_TOO_LARGE"));
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => {
      const rawBuffer = Buffer.concat(chunks);
      const rawStr = rawBuffer.toString("utf8");
      if (returnRaw) {
        // Return both raw buffer and parsed body for webhook support
        if (!rawStr) {
          resolve({ body: {}, rawBody: rawBuffer });
          return;
        }
        try {
          resolve({ body: JSON.parse(rawStr), rawBody: rawBuffer });
        } catch {
          resolve({ body: {}, rawBody: rawBuffer });
        }
        return;
      }
      if (!rawStr) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(rawStr));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function getRequestIdentity(req, body) {
  // Check for authenticated user first
  const authHeader = req.headers["authorization"];
  const token = extractToken(authHeader);

  let userId = null;
  let userEmail = null;
  let userStatus = "guest";

  if (token && !token.startsWith("g.")) {
    const result = await getUserFromToken(token);
    if (result.ok) {
      userId = result.user.id;
      userEmail = result.user.email;
      userStatus = isAdminEmail(userEmail) ? "active" : getUserStatus(userId);
    }
  }

  // Track activity for sharing detection
  const fingerprint = body?.fingerprint || req.headers["x-fingerprint"] || null;
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || null;
  if (userId) {
    trackActivity(userId, fingerprint, ip);
  }

  // Session validation
  let sessionInvalid = false;
  if (userId) {
    const sessionToken = req.headers["x-session-token"] || body?.sessionToken;
    const sessionCheck = validateSession(userId, sessionToken);
    if (!sessionCheck.valid) {
      sessionInvalid = true;
    }
  }

  // Guest identification
  const localStorageId = body?.ls_id || req.headers["x-ls-id"] || null;

  // Check guest token
  if (!userId && token && token.startsWith("g.")) {
    const guestPayload = verifyGuestToken(token);
    if (guestPayload) {
      return {
        userId: null,
        fingerprint: guestPayload.fp || fingerprint,
        ip: guestPayload.ip || ip,
        localStorageId: guestPayload.ls || localStorageId,
        status: "guest",
      };
    }
  }

  return { userId, userEmail, fingerprint, ip, localStorageId, status: userStatus, sessionInvalid };
}

const server = http.createServer(async (req, res) => {
  try {
    // Set CORS origin for this request
    const corsOrigin = getCorsOrigin(req);
    _currentCorsOrigin = corsOrigin || "null";

    if (req.method === "OPTIONS") {
      if (!corsOrigin) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.writeHead(204, {
        "access-control-allow-origin": corsOrigin,
        "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
        "access-control-allow-headers": "content-type, authorization, x-fingerprint, x-ls-id, x-admin-key, stripe-signature",
        "access-control-max-age": "86400",
      });
      res.end();
      return;
    }

    // ── Security headers (applied to every non-OPTIONS response) ──
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    // Rate limiting on search endpoints (fast path — no DB lookup)
    const reqIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress;
    if (req.method === "POST" && (req.url === "/search" || req.url === "/smart-search" || req.url === "/conversational-search" || req.url === "/list-search")) {
      // Block cloud provider IPs — no real designer searches from AWS/GCP/Azure
      if (isCloudIP(reqIp)) {
        console.log(`[BLOCKED] Cloud IP ${reqIp} attempted search on ${req.url}`);
        return json(res, 403, { error: "Access denied." });
      }
      // Determine limit: if user has a real auth token (not guest "g." token), give Pro limits
      const authHeader = req.headers["authorization"];
      const authToken = extractToken(authHeader);
      const maxReqs = (authToken && !authToken.startsWith("g.")) ? 60 : 30;
      const rateCheck = checkRateLimit(reqIp, maxReqs);
      if (!rateCheck.allowed) {
        return json(res, 429, { error: "Too many requests. Please wait a moment.", retry_after: rateCheck.retryAfter });
      }
    }

    if (req.method === "GET" && req.url === "/health") {
      const vs = getVectorStoreStats();
      const stripeKeySet = !!process.env.STRIPE_SECRET_KEY;
      const stripePriceMonthly = !!process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
      const stripePriceAnnual = !!process.env.STRIPE_PRO_ANNUAL_PRICE_ID;
      const webhookSet = !!process.env.STRIPE_WEBHOOK_SECRET;
      const appUrl = process.env.APP_URL || "(not set)";
      return json(res, 200, {
        ok: true,
        ready: serviceReady,
        catalog_size: getProductCount(),
        vectors: vs.total_vectors,
        uptime: Math.floor(process.uptime()),
        stripe: {
          secret_key: stripeKeySet ? "set" : "MISSING",
          webhook_secret: webhookSet ? "set" : "MISSING",
          pro_monthly_price: stripePriceMonthly ? "set" : "MISSING",
          pro_annual_price: stripePriceAnnual ? "set" : "MISSING",
          app_url: appUrl,
        },
      });
    }

    // ── RELOAD CATALOG (emergency) ──
    if (req.method === "POST" && req.url === "/reload-catalog") {
      // Always available — hardcoded fallback URLs exist in catalog-db.mjs
      console.log("[reload-catalog] Manual reload triggered");
      try {
        await initCatalogDB();
        const count = getProductCount();
        console.log(`[reload-catalog] Done — ${count} products`);
        return json(res, 200, { ok: true, catalog_size: count });
      } catch (err) {
        console.error(`[reload-catalog] Failed: ${err.message}`);
        return json(res, 500, { error: err.message });
      }
    }

    // ── AUTH ENDPOINTS ──────────────────────────────────────────
    if (req.method === "POST" && req.url === "/auth/register") {
      const body = await collectBody(req);
      const result = await registerUser(body);
      if (result.ok) {
        const verifyToken = generateVerificationToken(result.user.id, result.user.email);
        result.verification_token = verifyToken;
        console.log(`[auth] Verification link: /auth/verify-email?token=${verifyToken}`);
        // Send verification email
        sendVerificationEmail(result.user.email, verifyToken).catch(err => console.error("[email] verification send failed:", err));
        // Auto-activate admin accounts on registration
        if (isAdminEmail(result.user.email)) {
          setSubscription(result.user.id, { status: "active", plan: "admin", comped: true, comped_at: new Date().toISOString() });
          console.log(`[admin] Admin account auto-activated: ${result.user.email}`);
        }
      }
      return json(res, result.ok ? 201 : 400, result);
    }

    if (req.method === "POST" && req.url === "/auth/login") {
      const loginIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress;
      const rateCheck = checkLoginRateLimit(loginIp);
      if (!rateCheck.allowed) {
        return json(res, 429, { error: `Too many login attempts. Try again in ${Math.ceil(rateCheck.retryAfterSeconds / 60)} minutes.` });
      }
      const body = await collectBody(req);
      const result = await loginUser(body);
      if (result.ok) {
        clearLoginAttempts(loginIp);
        const fingerprint = body.fingerprint || req.headers["x-fingerprint"];
        const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress;
        const sessionToken = createSession(result.user.id, fingerprint, ip, req.headers["user-agent"]);
        result.sessionToken = sessionToken;
        // Auto-activate admin accounts on login
        if (isAdminEmail(result.user.email)) {
          const existingSub = getSubscription(result.user.id);
          if (!existingSub || existingSub.status !== "active") {
            setSubscription(result.user.id, { status: "active", plan: "admin", comped: true, comped_at: new Date().toISOString() });
          }
        }
      } else {
        recordFailedLogin(loginIp);
      }
      return json(res, result.ok ? 200 : 401, result);
    }

    if (req.method === "GET" && req.url.startsWith("/auth/verify-email?")) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get("token");
      if (!token) return json(res, 400, { error: "Token required" });
      const result = await verifyEmail(token);
      if (result.ok) {
        // Send welcome email
        sendWelcomeEmail(result.user.email, result.user.full_name).catch(err => console.error("[email] welcome send failed:", err));
        // Redirect to app with success message
        const appUrl = (process.env.APP_URL || "https://spekd.ai").replace(/\/$/, "");
        res.writeHead(302, { Location: `${appUrl}/Search?verified=true` });
        res.end();
        return;
      }
      return json(res, 400, result);
    }

    if (req.method === "POST" && req.url === "/auth/forgot-password") {
      const body = await collectBody(req);
      const result = await generateResetToken(body.email);
      // Always return success to not reveal email existence
      // In production, would send email here
      if (result.token) {
        console.log(`[auth] Password reset token for ${result.email}: ${result.token}`);
        sendPasswordResetEmail(result.email, result.token).catch(err => console.error("[email] reset send failed:", err));
      }
      return json(res, 200, { ok: true, message: "If an account exists with that email, a reset link has been sent." });
    }

    // Serve password reset form (linked from email)
    if (req.method === "GET" && req.url.startsWith("/auth/reset-password-form")) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get("token") || "";
      const appUrl = process.env.APP_URL || "https://spekd.ai";
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reset Password — SPEKD</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#080c18;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.card{background:#0e0e14;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:40px 32px;max-width:400px;width:100%}
h1{font-size:20px;margin-bottom:8px;color:#C9A96E;letter-spacing:0.15em;font-weight:700}
h2{font-size:16px;margin-bottom:24px;color:rgba(255,255,255,0.7);font-weight:400}
label{display:block;font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:6px}
input{width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;font-size:14px;margin-bottom:16px;outline:none}
input:focus{border-color:#C9A96E}
button{width:100%;padding:14px;background:#C9A96E;color:#080c18;font-size:14px;font-weight:600;border:none;border-radius:8px;cursor:pointer;letter-spacing:0.02em}
button:hover{background:#d4b87a}
.msg{margin-top:16px;padding:12px;border-radius:8px;font-size:13px;text-align:center}
.err{background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2)}
.ok{background:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.2)}
</style></head><body>
<div class="card">
<h1>SPEKD</h1><h2>Reset your password</h2>
<div id="form-wrap">
<label>New Password</label>
<input type="password" id="pw" placeholder="Min 8 chars, include a number" autofocus>
<label>Confirm Password</label>
<input type="password" id="pw2" placeholder="Confirm password">
<button onclick="doReset()">Reset Password</button>
</div>
<div id="msg"></div>
</div>
<script>
async function doReset(){
  const pw=document.getElementById('pw').value;
  const pw2=document.getElementById('pw2').value;
  const msg=document.getElementById('msg');
  if(!pw||pw.length<8){msg.className='msg err';msg.textContent='Password must be at least 8 characters';return}
  if(pw!==pw2){msg.className='msg err';msg.textContent='Passwords do not match';return}
  try{
    const r=await fetch(location.origin+'/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'${token}',new_password:pw})});
    const d=await r.json();
    if(d.ok){msg.className='msg ok';msg.textContent='Password reset! Redirecting...';document.getElementById('form-wrap').style.display='none';setTimeout(()=>location.href='${appUrl}/Search',2000)}
    else{msg.className='msg err';msg.textContent=d.error||'Reset failed'}
  }catch(e){msg.className='msg err';msg.textContent='Network error'}
}
document.querySelectorAll('input').forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter')doReset()}));
</script></body></html>`);
      return;
    }

    if (req.method === "POST" && req.url === "/auth/reset-password") {
      const body = await collectBody(req);
      const result = await resetPassword(body.token, body.new_password);
      return json(res, result.ok ? 200 : 400, result);
    }

    if (req.method === "GET" && req.url === "/auth/me") {
      const token = extractToken(req.headers.authorization);
      const result = await getUserFromToken(token);
      return json(res, result.ok ? 200 : 401, result);
    }

    if (req.method === "PUT" && req.url === "/auth/me") {
      const token = extractToken(req.headers.authorization);
      const auth = await getUserFromToken(token);
      if (!auth.ok) return json(res, 401, auth);
      const body = await collectBody(req);
      const result = await updateUser(auth.user.id, body);
      return json(res, result.ok ? 200 : 400, result);
    }

    if (req.method === "POST" && req.url === "/auth/change-password") {
      const token = extractToken(req.headers.authorization);
      const auth = await getUserFromToken(token);
      if (!auth.ok) return json(res, 401, auth);
      const body = await collectBody(req);
      const result = await changePassword(auth.user.id, body);
      return json(res, result.ok ? 200 : 400, result);
    }

    if (req.method === "DELETE" && req.url === "/auth/me") {
      const token = extractToken(req.headers.authorization);
      const auth = await getUserFromToken(token);
      if (!auth.ok) return json(res, 401, auth);
      const result = await deleteUser(auth.user.id);
      return json(res, result.ok ? 200 : 400, result);
    }

    if (req.method === "GET" && req.url === "/auth/export") {
      const token = extractToken(req.headers.authorization);
      const auth = await getUserFromToken(token);
      if (!auth.ok) return json(res, 401, auth);
      const result = await exportUserData(auth.user.id);
      return json(res, result.ok ? 200 : 400, result);
    }

    // ── GUEST TOKEN ──
    if (req.method === "POST" && req.url === "/auth/guest-token") {
      const body = await collectBody(req);
      const { fingerprint, ls_id } = body;
      const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress;

      if (!fingerprint) {
        return json(res, 400, { error: "fingerprint required" });
      }

      const result = generateGuestToken(fingerprint, ip, ls_id);
      return json(res, 200, result);
    }

    // ── USER DATA ENDPOINTS (server-side persistence) ──────────

    if (req.method === "GET" && req.url === "/user/favorites") {
      const token = extractToken(req.headers.authorization);
      const auth = await getUserFromToken(token);
      if (!auth.ok) return json(res, 401, { error: "Authentication required" });
      const favorites = await getSavedProducts(auth.user.id);
      return json(res, 200, { ok: true, favorites });
    }

    if (req.method === "POST" && req.url === "/user/favorites") {
      const token = extractToken(req.headers.authorization);
      const auth = await getUserFromToken(token);
      if (!auth.ok) return json(res, 401, { error: "Authentication required" });
      const body = await collectBody(req);
      const result = await saveProduct(auth.user.id, body.product);
      return json(res, 200, result);
    }

    if (req.method === "DELETE" && req.url.startsWith("/user/favorites/")) {
      const token = extractToken(req.headers.authorization);
      const auth = await getUserFromToken(token);
      if (!auth.ok) return json(res, 401, { error: "Authentication required" });
      const productId = decodeURIComponent(req.url.split("/user/favorites/")[1]);
      const result = await unsaveProduct(auth.user.id, productId);
      return json(res, 200, result);
    }

    if (req.method === "GET" && req.url === "/user/quote") {
      const token = extractToken(req.headers.authorization);
      const auth = await getUserFromToken(token);
      if (!auth.ok) return json(res, 401, { error: "Authentication required" });
      const quote = await getUserQuote(auth.user.id);
      return json(res, 200, { ok: true, quote });
    }

    if (req.method === "PUT" && req.url === "/user/quote") {
      const token = extractToken(req.headers.authorization);
      const auth = await getUserFromToken(token);
      if (!auth.ok) return json(res, 401, { error: "Authentication required" });
      const body = await collectBody(req);
      const result = await saveUserQuote(auth.user.id, body.quote);
      return json(res, 200, result);
    }

    // ── SHARED QUOTE / CLIENT PORTAL ENDPOINTS ──

    if (req.method === "POST" && req.url === "/quotes/share") {
      const token = extractToken(req.headers.authorization);
      const auth = await getUserFromToken(token);
      if (!auth.ok) return json(res, 401, { error: "Authentication required" });
      const body = await collectBody(req);
      const result = await createSharedQuote(auth.user.id, {
        quoteData: body.quoteData,
        designerName: body.designerName || auth.user.full_name,
        designerCompany: body.designerCompany || "",
        designerEmail: auth.user.email,
        projectName: body.projectName || "Untitled Project",
        clientNote: body.clientNote || "",
        clientEmail: body.clientEmail || "",
      });
      if (result.ok && body.clientEmail) {
        sendRevisionEmail(body.clientEmail, body.projectName || "Untitled Project", body.designerName || auth.user.full_name).catch(err => console.error("[email] revision send failed:", err));
      }
      return json(res, result.ok ? 200 : 500, result);
    }

    if (req.method === "GET" && req.url.startsWith("/quotes/shared/")) {
      const shareToken = req.url.split("/quotes/shared/")[1]?.split("?")[0];
      if (!shareToken) return json(res, 400, { error: "Token required" });
      const shared = await getSharedQuote(shareToken);
      if (!shared) return json(res, 404, { error: "Quote not found" });
      // Strip wholesale prices from response
      const safeQuote = { ...shared.quote_data };
      if (safeQuote.rooms) {
        safeQuote.rooms = safeQuote.rooms.map(r => ({
          ...r,
          items: r.items.map(({ wholesale_price, ...rest }) => rest),
        }));
      }
      return json(res, 200, {
        ok: true,
        quote: safeQuote,
        designerName: shared.designer_name,
        designerCompany: shared.designer_company,
        projectName: shared.project_name,
        clientNote: shared.client_note,
        version: shared.version,
        feedback: shared.feedback || {},
        feedbackSubmittedAt: shared.feedback_submitted_at,
        createdAt: shared.created_at,
      });
    }

    if (req.method === "POST" && req.url.startsWith("/quotes/shared/") && req.url.endsWith("/feedback")) {
      const shareToken = req.url.split("/quotes/shared/")[1]?.split("/feedback")[0];
      if (!shareToken) return json(res, 400, { error: "Token required" });
      const shared = await getSharedQuote(shareToken);
      if (!shared) return json(res, 404, { error: "Quote not found" });
      const body = await collectBody(req);
      const result = await submitQuoteFeedback(shareToken, body.feedback);
      // Email the designer
      if (result.ok && shared.designer_email) {
        const fb = body.feedback || {};
        const items = Object.values(fb);
        const summary = {
          approved: items.filter(i => i.status === "approved").length,
          changes: items.filter(i => i.status === "change").length,
          rejected: items.filter(i => i.status === "rejected").length,
          total: items.length,
        };
        sendClientFeedbackEmail(shared.designer_email, shared.designer_name, shared.project_name || "Untitled", summary).catch(err => console.error("[email] feedback email failed:", err));
      }
      return json(res, result.ok ? 200 : 500, result);
    }

    if (req.method === "GET" && req.url === "/quotes/shared") {
      const token = extractToken(req.headers.authorization);
      const auth = await getUserFromToken(token);
      if (!auth.ok) return json(res, 401, { error: "Authentication required" });
      const quotes = await getDesignerSharedQuotes(auth.user.id);
      return json(res, 200, { ok: true, quotes });
    }

    if (req.method === "PUT" && req.url.startsWith("/quotes/shared/")) {
      const shareToken = req.url.split("/quotes/shared/")[1]?.split("?")[0];
      if (!shareToken) return json(res, 400, { error: "Token required" });
      const token = extractToken(req.headers.authorization);
      const auth = await getUserFromToken(token);
      if (!auth.ok) return json(res, 401, { error: "Authentication required" });
      const body = await collectBody(req);
      const result = await updateSharedQuote(shareToken, auth.user.id, {
        quoteData: body.quoteData,
        clientNote: body.clientNote,
      });
      if (result.ok && body.clientEmail) {
        sendRevisionEmail(body.clientEmail, body.projectName || "Updated Selections", auth.user.full_name || "Your designer").catch(err => console.error("[email] revision send failed:", err));
      }
      return json(res, result.ok ? 200 : 500, result);
    }

    if (req.method === "GET" && req.url === "/user/search-history") {
      const token = extractToken(req.headers.authorization);
      const auth = await getUserFromToken(token);
      if (!auth.ok) return json(res, 401, { error: "Authentication required" });
      const history = await getSearchHistory(auth.user.id);
      return json(res, 200, { ok: true, history });
    }

    // ── SUBSCRIPTION ENDPOINTS ──────────────────────────────────

    if (req.method === "GET" && req.url === "/subscribe/status") {
      const identity = await getRequestIdentity(req, {});

      if (identity.userId) {
        // Admin bypass — always active, no Stripe needed
        if (identity.userEmail && isAdminEmail(identity.userEmail)) {
          return json(res, 200, {
            status: "active",
            plan: "admin",
            current_period_end: null,
            trial_end: null,
            trial_days_remaining: null,
            stripe_subscription_id: null,
            is_admin: true,
          });
        }

        const sub = getSubscription(identity.userId);
        const status = getUserStatus(identity.userId);
        let trialDaysRemaining = null;
        if (status === "trialing" && sub?.trial_end) {
          trialDaysRemaining = Math.max(0, Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        }
        return json(res, 200, {
          status,
          plan: sub?.plan || null,
          current_period_end: sub?.current_period_end || null,
          trial_end: sub?.trial_end || null,
          trial_days_remaining: trialDaysRemaining,
          stripe_subscription_id: sub?.stripe_subscription_id || null,
        });
      }

      // Guest
      const usage = getGuestUsage(identity.fingerprint, identity.ip, identity.localStorageId);
      return json(res, 200, usage);
    }

    // Verify checkout session directly with Stripe — fallback when webhook is delayed
    if (req.method === "POST" && req.url === "/subscribe/verify-session") {
      const body = await collectBody(req);
      const { session_id } = body;
      const identity = await getRequestIdentity(req, body);

      if (!identity.userId) return json(res, 401, { error: "Authentication required" });
      if (!session_id) return json(res, 400, { error: "session_id required" });

      try {
        if (!await ensureStripe()) return json(res, 500, { error: "Stripe not configured" });

        // Import stripe to use directly
        const Stripe = (await import("stripe")).default;
        const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
        const session = await stripeClient.checkout.sessions.retrieve(session_id);

        if (session.payment_status === "paid" || session.status === "complete") {
          const userId = session.metadata?.user_id || identity.userId;
          const plan = session.metadata?.plan || "monthly";
          const stripeSubId = session.subscription;

          // Get subscription details from Stripe
          let subStatus = "active";
          let trialEnd = null;
          let periodEnd = null;
          if (stripeSubId) {
            try {
              const stripeSub = await getStripeSubscription(stripeSubId);
              if (stripeSub.status === "trialing" && stripeSub.trial_end) {
                subStatus = "trialing";
                trialEnd = new Date(stripeSub.trial_end * 1000).toISOString();
              }
              if (stripeSub.current_period_end) {
                periodEnd = new Date(stripeSub.current_period_end * 1000).toISOString();
              }
            } catch (e) {
              console.warn("[verify-session] Could not fetch subscription details:", e.message);
            }
          }

          // Activate the subscription
          setSubscription(userId, {
            status: subStatus,
            plan,
            stripe_subscription_id: stripeSubId,
            stripe_customer_id: session.customer,
            trial_end: trialEnd,
            current_period_end: periodEnd,
            created_at: new Date().toISOString(),
          });

          const trialDaysRemaining = trialEnd
            ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null;

          console.log(`[verify-session] Subscription activated for user ${userId}: ${subStatus} (${plan})`);
          return json(res, 200, {
            status: subStatus,
            plan,
            trial_end: trialEnd,
            trial_days_remaining: trialDaysRemaining,
            activated: true,
          });
        }

        return json(res, 200, { status: "pending", activated: false });
      } catch (err) {
        console.error("[verify-session] Error:", err.message);
        return json(res, 500, { error: err.message });
      }
    }

    if (req.method === "POST" && req.url === "/subscribe/create-checkout") {
      const body = await collectBody(req);
      const { plan, email, password, full_name, business_name, fingerprint } = body;

      // Check if user is already authenticated
      let userId, token, userEmail;
      const existingAuth = extractToken(req.headers["authorization"]);
      if (existingAuth && !existingAuth.startsWith("g.")) {
        const me = await getUserFromToken(existingAuth);
        if (me.ok) {
          userId = me.user.id;
          userEmail = me.user.email;
          token = existingAuth;
        }
      }

      // If not authenticated via token, require email/password for registration
      if (!userId) {
        if (!email || !password) {
          return json(res, 400, { error: "Email and password required" });
        }
        // Try to register
        let result = await registerUser({ email, password, full_name, business_name });
        if (!result.ok && result.error?.includes("already exists")) {
          // Try login instead
          result = await loginUser({ email, password });
        }
        if (!result.ok) {
          return json(res, 400, { error: result.error });
        }
        userId = result.user.id;
        userEmail = result.user.email;
        token = result.token;

        // Link fingerprint to user for anti-abuse
        if (fingerprint) linkFingerprintToUser(fingerprint, userId);
      }

      // Admin/founder bypass — skip Stripe entirely, just activate
      const checkEmail = userEmail || email;
      if (isAdminEmail(checkEmail)) {
        setSubscription(userId, { status: "active", plan: "admin", comped: true, comped_at: new Date().toISOString() });
        console.log(`[admin] Admin account activated: ${checkEmail}`);
        return json(res, 200, { token, user_id: userId, admin_bypass: true });
      }

      // Check multi-account abuse
      if (fingerprint) {
        const abuse = checkMultiAccountAbuse(fingerprint);
        if (abuse.flagged) {
          console.warn(`[anti-abuse] Fingerprint ${fingerprint} linked to multiple accounts:`, abuse.accounts);
        }
      }

      const appUrl = (process.env.APP_URL || "https://spekd.ai").replace(/\/$/, "");

      try {
        const checkout = await createCheckoutSession(
          plan || "monthly",
          userEmail || email,
          userId,
          `${appUrl}/Search?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
          `${appUrl}/Search?subscription=cancelled`
        );
        return json(res, 200, { ...checkout, token, user_id: userId });
      } catch (err) {
        return json(res, 500, { error: err.message });
      }
    }

    if (req.method === "POST" && req.url === "/subscribe/webhook") {
      // Use raw body for Stripe webhook signature verification
      const { body, rawBody } = await collectBody(req, { raw: true });
      const signature = req.headers["stripe-signature"];

      try {
        const event = verifyWebhook(rawBody, signature);
        if (!event) return json(res, { received: true, skipped: true }, 200);

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object;
            const userId = session.metadata?.user_id;
            const plan = session.metadata?.plan || "monthly";
            if (userId) {
              const stripeSubId = session.subscription;
              // Check if subscription has a trial period
              let subStatus = "active";
              let trialEnd = null;
              try {
                const stripeSub = await getStripeSubscription(stripeSubId);
                if (stripeSub.status === "trialing" && stripeSub.trial_end) {
                  subStatus = "trialing";
                  trialEnd = new Date(stripeSub.trial_end * 1000).toISOString();
                }
              } catch {}
              setSubscription(userId, {
                status: subStatus,
                plan,
                stripe_subscription_id: stripeSubId,
                stripe_customer_id: session.customer,
                current_period_end: null, // Will be set by invoice.paid
                trial_end: trialEnd,
                created_at: new Date().toISOString(),
              });
              logSubscriptionEvent("new_subscription", {
                user_id: userId,
                plan,
                trial: subStatus === "trialing",
                amount: 0, // No charge during trial
              });
              // Send subscription confirmation email
              try {
                const subUsers = await getAllUsers();
                const subUser = subUsers.find(u => u.id === userId);
                if (subUser?.email) {
                  sendSubscriptionConfirmationEmail(subUser.email, subUser.full_name, plan).catch(err => console.error("[email] sub confirmation failed:", err));
                }
              } catch {}
            }
            break;
          }

          case "customer.subscription.updated": {
            // Handles trial → active transition and other status changes
            const subscription = event.data.object;
            const subId = subscription.id;
            const allSubs = getAllSubscriptions();
            const sub = Object.values(allSubs).find(s => s.stripe_subscription_id === subId);
            if (sub) {
              const newStatus = subscription.status === "active" ? "active"
                : subscription.status === "trialing" ? "trialing"
                : subscription.status === "past_due" ? "past_due"
                : subscription.status;
              const updates = { status: newStatus };
              if (subscription.current_period_end) {
                updates.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
              }
              if (subscription.trial_end) {
                updates.trial_end = new Date(subscription.trial_end * 1000).toISOString();
              }
              setSubscription(sub.user_id, updates);

              // Log trial-to-active conversion
              if (newStatus === "active" && sub.status === "trialing") {
                logSubscriptionEvent("trial_converted", {
                  user_id: sub.user_id,
                  plan: sub.plan,
                  amount: sub.plan?.includes("annual") ? 990 : 99,
                });
              }
            }
            break;
          }

          case "invoice.paid": {
            const invoice = event.data.object;
            const subId = invoice.subscription;
            // Find user by stripe subscription ID
            const allSubs = getAllSubscriptions();
            const sub = Object.values(allSubs).find(s => s.stripe_subscription_id === subId);
            if (sub) {
              // Get subscription details for period end
              try {
                const stripeSub = await getStripeSubscription(subId);
                setSubscription(sub.user_id, {
                  status: "active",
                  current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
                });
                // Log renewal (not first payment)
                if (invoice.billing_reason === "subscription_cycle") {
                  logSubscriptionEvent("renewal", {
                    user_id: sub.user_id,
                    plan: sub.plan,
                    amount: invoice.amount_paid / 100,
                  });
                }
              } catch {}
            }
            break;
          }

          case "invoice.payment_failed": {
            const invoice = event.data.object;
            const subId = invoice.subscription;
            const allSubs = getAllSubscriptions();
            const sub = Object.values(allSubs).find(s => s.stripe_subscription_id === subId);
            if (sub) {
              setSubscription(sub.user_id, {
                status: "past_due",
                payment_failed_at: new Date().toISOString(),
              });
              logSubscriptionEvent("failed_payment", { user_id: sub.user_id });
              // Send payment failed email
              try {
                const pfUsers = await getAllUsers();
                const pfUser = pfUsers.find(u => u.id === sub.user_id);
                if (pfUser?.email) {
                  sendPaymentFailedEmail(pfUser.email, pfUser.full_name).catch(err => console.error("[email] payment failed email error:", err));
                }
              } catch {}
            }
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object;
            const subId = subscription.id;
            const allSubs = getAllSubscriptions();
            const sub = Object.values(allSubs).find(s => s.stripe_subscription_id === subId);
            if (sub) {
              setSubscription(sub.user_id, { status: "cancelled" });
            }
            break;
          }
        }

        return json(res, 200, { received: true });
      } catch (err) {
        console.error("[stripe webhook] Error:", err.message);
        return json(res, 400, { error: err.message });
      }
    }

    if (req.method === "POST" && req.url === "/subscribe/cancel") {
      const body = await collectBody(req);
      const identity = await getRequestIdentity(req, body);
      if (!identity.userId) return json(res, 401, { error: "Authentication required" });

      const sub = getSubscription(identity.userId);
      if (!sub?.stripe_subscription_id) return json(res, 400, { error: "No active subscription" });

      try {
        await cancelSubscription(sub.stripe_subscription_id, false); // Cancel at period end
        setSubscription(identity.userId, { status: "cancelled" });
        logSubscriptionEvent("cancellation", {
          user_id: identity.userId,
          reason: body.reason || "not specified",
        });
        return json(res, 200, { ok: true, access_until: sub.current_period_end });
      } catch (err) {
        return json(res, 500, { error: err.message });
      }
    }

    if (req.method === "POST" && req.url === "/subscribe/reactivate") {
      const body = await collectBody(req);
      const identity = await getRequestIdentity(req, body);
      if (!identity.userId) return json(res, 401, { error: "Authentication required" });

      const sub = getSubscription(identity.userId);
      if (!sub?.stripe_subscription_id) {
        // Need new checkout
        return json(res, 400, { error: "need_checkout", message: "Create a new checkout session" });
      }

      try {
        // Try to reactivate existing (if not yet ended)
        await reactivateSubscription(sub.stripe_subscription_id);
        setSubscription(identity.userId, { status: "active" });
        logSubscriptionEvent("reactivation", {
          user_id: identity.userId,
          plan: sub.plan,
          amount: sub.plan.includes("annual") ? (sub.plan.includes("team") ? 2490 : 990) : (sub.plan.includes("team") ? 249 : 99),
        });
        return json(res, 200, { ok: true, status: "active" });
      } catch (err) {
        // Subscription already ended, need new checkout
        return json(res, 400, { error: "need_checkout", message: err.message });
      }
    }

    if (req.method === "POST" && req.url === "/subscribe/portal") {
      const body = await collectBody(req);
      const identity = await getRequestIdentity(req, body);
      if (!identity.userId) return json(res, 401, { error: "Authentication required" });

      const sub = getSubscription(identity.userId);
      if (!sub?.stripe_customer_id) return json(res, 400, { error: "No subscription found" });

      const appUrl = (process.env.APP_URL || "https://spekd.ai").replace(/\/$/, "");
      try {
        const portal = await createPortalSession(sub.stripe_customer_id, `${appUrl}/Account`);
        return json(res, 200, portal);
      } catch (err) {
        return json(res, 500, { error: err.message });
      }
    }

    if (req.method === "POST" && req.url === "/subscribe/onboarding") {
      const body = await collectBody(req);
      const identity = await getRequestIdentity(req, body);
      if (!identity.userId) return json(res, 401, { error: "Authentication required" });

      const { project_types, trade_discounts } = body;

      // Update user preferences
      updateUser(identity.userId, {
        preferences: {
          project_types: project_types || [],
          onboarding_completed: true,
          onboarded_at: new Date().toISOString(),
        }
      });

      return json(res, 200, { ok: true });
    }

    // ── TEAM ENDPOINTS ──────────────────────────────────────
    if (req.method === "POST" && req.url === "/team/create") {
      const body = await collectBody(req);
      const identity = await getRequestIdentity(req, body);
      if (!identity.userId) return json(res, 401, { error: "Authentication required" });
      const result = createTeam(identity.userId, body.team_name || "My Team");
      return json(res, result.error ? 400 : 201, result);
    }

    if (req.method === "GET" && req.url === "/team/members") {
      const identity = await getRequestIdentity(req, {});
      if (!identity.userId) return json(res, 401, { error: "Authentication required" });
      const team = getTeamByUser(identity.userId);
      if (!team) return json(res, 404, { error: "No team found" });
      const members = getTeamMembers(team.id);
      return json(res, 200, { team_id: team.id, team_name: team.name, seats: team.seats + (team.extra_seats || 0), members });
    }

    if (req.method === "POST" && req.url === "/team/invite") {
      const body = await collectBody(req);
      const identity = await getRequestIdentity(req, body);
      if (!identity.userId) return json(res, 401, { error: "Authentication required" });
      const team = getTeamByUser(identity.userId);
      if (!team) return json(res, 404, { error: "No team found" });
      const result = inviteMember(team.id, identity.userId, body.email);
      return json(res, result.error ? 400 : 200, result);
    }

    if (req.method === "POST" && req.url === "/team/remove") {
      const body = await collectBody(req);
      const identity = await getRequestIdentity(req, body);
      if (!identity.userId) return json(res, 401, { error: "Authentication required" });
      const team = getTeamByUser(identity.userId);
      if (!team) return json(res, 404, { error: "No team found" });
      const result = removeMember(team.id, identity.userId, body.member_user_id);
      return json(res, result.error ? 400 : 200, result);
    }

    if (req.method === "POST" && req.url === "/team/add-seat") {
      const body = await collectBody(req);
      const identity = await getRequestIdentity(req, body);
      if (!identity.userId) return json(res, 401, { error: "Authentication required" });
      const team = getTeamByUser(identity.userId);
      if (!team) return json(res, 404, { error: "No team found" });
      const sub = getSubscription(identity.userId);
      if (!sub?.stripe_customer_id) return json(res, 400, { error: "No active subscription" });
      const appUrl = (process.env.APP_URL || "https://spekd.ai").replace(/\/$/, "");
      try {
        const checkout = await createTeamSeatCheckout(sub.stripe_customer_id, 1, `${appUrl}/Account?seat=added`, `${appUrl}/Account`);
        const seatResult = addSeat(team.id, identity.userId);
        return json(res, 200, { ...checkout, ...seatResult });
      } catch (err) {
        return json(res, 500, { error: err.message });
      }
    }

    if (req.method === "GET" && req.url === "/team/sharing-status") {
      const identity = await getRequestIdentity(req, {});
      if (!identity.userId) return json(res, 401, { error: "Authentication required" });
      const violation = checkSharingViolation(identity.userId);
      return json(res, 200, violation);
    }

    if (req.method === "GET" && req.url === "/vendors") {
      // Enrich vendor configs with product counts from catalog DB
      const allProducts = getAllProducts();
      const vendorCounts = {};
      for (const p of allProducts) {
        const vn = (p.vendor_name || p.manufacturer_name || "").toLowerCase();
        vendorCounts[vn] = (vendorCounts[vn] || 0) + 1;
      }
      const seenIds = new Set();
      const enriched = priorityVendors
        .filter(v => {
          if (seenIds.has(v.id)) return false;
          seenIds.add(v.id);
          return true;
        })
        .map(v => ({
          ...v,
          product_count: vendorCounts[v.name.toLowerCase()] || 0,
          active_skus: vendorCounts[v.name.toLowerCase()] || 0,
        }))
        .filter(v => v.product_count > 0);
      return json(res, 200, { vendors: enriched });
    }

    if (req.method === "GET" && req.url === "/catalog") {
      return json(res, 200, {
        summary: getCatalogSummary(),
        catalog: readCatalog(),
        verified_catalog: readVerifiedCatalog(),
      });
    }

    // ── Full Catalog Crawl (background) ──
    if (req.method === "POST" && req.url === "/catalog/full-crawl") {
      const importStatus = getImportStatus();
      if (importStatus.running) {
        return json(res, 409, { error: "Import already running", status: importStatus });
      }
      // Run in background
      runBulkImport(catalogDBInterface).then(async () => {
        console.log("[server] Full crawl complete. Running dedup...");
        try { await runDeduplication(catalogDBInterface); } catch (e) { console.error("[server] Dedup error:", e.message); }
        console.log("[server] Re-indexing vectors...");
        vectorIndexAll(getAllProducts(), { reindex: false }).catch(() => {});
        buildAutocompleteIndex(getAllProducts());
        clearSearchCache();
        console.log("[server] Post-crawl processing complete. Total products:", getProductCount());
      }).catch(err => console.error("[server] Full crawl failed:", err.message));
      return json(res, 202, { message: "Full catalog crawl started (with post-crawl dedup)", status_url: "/import/status" });
    }

    // ── Import Status ──
    if (req.method === "GET" && req.url === "/import/status") {
      const raw = getImportStatus();
      // Return lightweight summary to avoid OOM on huge sitemap progress objects
      const summary = {
        running: raw.running,
        progress: raw.progress ? {
          status: raw.progress.status,
          vendors_total: raw.progress.vendors_total,
          vendors_completed: raw.progress.vendors_completed,
          products_before: raw.progress.products_before,
          products_after: raw.progress.products_after,
          started_at: raw.progress.started_at,
          completed_at: raw.progress.completed_at,
          errors: (raw.progress.errors || []).slice(0, 10),
          vendor_results: (raw.progress.vendor_results || []).map(vr => ({
            vendor_id: vr.vendor_id,
            vendor_name: vr.vendor_name,
            tier: vr.tier,
            total_products: vr.total_products,
            methods_succeeded: vr.methods_succeeded,
          })),
        } : null,
        catalog_total: getProductCount(),
      };
      return json(res, 200, summary);
    }

    // ── Vector Rebuild ──
    if (req.method === "POST" && req.url === "/vectors/rebuild") {
      const vectorStats = getVectorStoreStats();
      // Rebuild catalog index and all vectors
      buildCatalogIndex(getAllProducts());
      clearVectorSearchCache();
      vectorIndexAll(getAllProducts(), { reindex: true }).then(() => {
        console.log("[server] Vector rebuild complete.");
        persistVectors();
      }).catch(err => console.error("[server] Vector rebuild failed:", err.message));
      return json(res, 202, { message: "Vector rebuild started", current_vectors: vectorStats.total_vectors });
    }

    // ── Image Proxy ──
    if (req.method === "GET" && req.url.startsWith("/images/")) {
      const productId = decodeURIComponent(req.url.slice(8).split("?")[0]);
      const product = getProduct(productId);
      if (!product || !product.image_url) return json(res, 404, { error: "No image" });

      // Check local cache
      if (product.cached_image_path) {
        try {
          const { createReadStream, existsSync } = await import("node:fs");
          if (existsSync(product.cached_image_path)) {
            const ext = product.cached_image_path.split(".").pop();
            const ct = ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "image/jpeg";
            res.writeHead(200, { "content-type": ct, "cache-control": "public, max-age=86400", "access-control-allow-origin": _currentCorsOrigin });
            createReadStream(product.cached_image_path).pipe(res);
            return;
          }
        } catch {}
      }

      // Proxy fetch the image server-side to bypass hotlink protection
      try {
        const imgResp = await fetch(product.image_url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SpekdBot/1.0)" },
          redirect: "follow",
          signal: AbortSignal.timeout(10000),
        });
        if (imgResp.ok) {
          const contentType = imgResp.headers.get("content-type") || "image/jpeg";
          const buffer = Buffer.from(await imgResp.arrayBuffer());
          res.writeHead(200, {
            "content-type": contentType,
            "cache-control": "public, max-age=86400",
            "access-control-allow-origin": _currentCorsOrigin,
          });
          res.end(buffer);
          return;
        }
      } catch {}
      // Fallback: redirect if proxy fails
      res.writeHead(302, { location: product.image_url, "access-control-allow-origin": _currentCorsOrigin });
      res.end();
      return;
    }

    // Image proxy for PDF generation (avoids CORS issues with vendor CDNs)
    if (req.method === "GET" && req.url.startsWith("/proxy-image?")) {
      const params = new URL(req.url, "http://localhost").searchParams;
      const imageUrl = params.get("url");
      if (!imageUrl) return json(res, 400, { error: "url param required" });
      try {
        const imgResp = await fetch(imageUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SpekdBot/1.0)" },
          signal: AbortSignal.timeout(8000),
        });
        if (!imgResp.ok) return json(res, 502, { error: "upstream failed" });
        const contentType = imgResp.headers.get("content-type") || "image/jpeg";
        const buffer = Buffer.from(await imgResp.arrayBuffer());
        res.writeHead(200, {
          "content-type": contentType,
          "cache-control": "public, max-age=86400",
          "access-control-allow-origin": _currentCorsOrigin,
        });
        res.end(buffer);
      } catch {
        return json(res, 502, { error: "proxy fetch failed" });
      }
      return;
    }

    if (req.method === "GET" && req.url === "/catalog/stats") {
      const dbStats = getCatalogDBStats();
      const crawlStatus = getCrawlStatus();
      const apiStats = getApiCallStats();
      const vectorStats = getVectorStoreStats();
      // Compute search eligibility counts
      let aiTagged = 0, categoryOnly = 0, untagged = 0;
      for (const p of getAllProducts()) {
        if (p.ai_furniture_type) aiTagged++;
        else if (p.category) categoryOnly++;
        else untagged++;
      }
      return json(res, 200, {
        catalog: dbStats,
        vectors: vectorStats,
        crawl: crawlStatus,
        api_calls: apiStats,
        search_eligibility: {
          total: aiTagged + categoryOnly + untagged,
          searchable: aiTagged,
          ai_tagged: aiTagged,
          category_only_excluded: categoryOnly,
          no_type_excluded: untagged,
          total_excluded: categoryOnly + untagged,
        },
        cache: {
          size: resultCache.size,
          hits: cacheHits,
          misses: cacheMisses,
          hit_rate: cacheHits + cacheMisses > 0 ? (cacheHits / (cacheHits + cacheMisses) * 100).toFixed(1) + "%" : "N/A",
        },
      });
    }

    // ── Find Similar Products (vector-powered) ──
    if (req.method === "POST" && req.url === "/similar") {
      const body = await collectBody(req);

      // Find Similar does NOT count as a search — allow for anyone
      const identity = await getRequestIdentity(req, body);

      const productId = String(body.product_id || "");
      if (!productId) return json(res, 400, { error: "product_id required" });
      const limit = Number(body.limit) || 20;

      const sourceProduct = getProduct(productId);
      const similar = vectorFindSimilar(productId, limit);

      const annotated = similar.map(p => {
        const sim = sanitizeSearchProduct(p);
        if (sourceProduct) {
          const signals = [];
          // AI tag matches
          if (p.ai_furniture_type && sourceProduct.ai_furniture_type &&
              p.ai_furniture_type.toLowerCase().replace(/s$/, "") === sourceProduct.ai_furniture_type.toLowerCase().replace(/s$/, "")) {
            signals.push({ type: "attribute", label: `same type: ${p.ai_furniture_type}`, strength: "strong" });
          }
          if (p.ai_style && sourceProduct.ai_style && p.ai_style.toLowerCase() === sourceProduct.ai_style.toLowerCase()) {
            signals.push({ type: "attribute", label: `${p.ai_style} style`, strength: "strong" });
          }
          if (p.ai_primary_material && sourceProduct.ai_primary_material) {
            const srcWords = sourceProduct.ai_primary_material.toLowerCase().split(/[,\s]+/).filter(w => w.length > 2);
            const pWords = p.ai_primary_material.toLowerCase().split(/[,\s]+/).filter(w => w.length > 2);
            if (srcWords.some(w => pWords.some(pw => pw.includes(w) || w.includes(pw)))) {
              signals.push({ type: "attribute", label: `similar material`, strength: "medium" });
            }
          }
          if (p.ai_primary_color && sourceProduct.ai_primary_color && p.ai_primary_color.toLowerCase() === sourceProduct.ai_primary_color.toLowerCase()) {
            signals.push({ type: "attribute", label: `same color: ${p.ai_primary_color}`, strength: "medium" });
          }
          if (p.retail_price && sourceProduct.retail_price) {
            const ratio = p.retail_price / sourceProduct.retail_price;
            if (ratio >= 0.6 && ratio <= 1.6) signals.push({ type: "price", label: "similar price range", strength: "medium" });
          }
          if (p.vendor_id !== sourceProduct.vendor_id) {
            signals.push({ type: "vendor", label: `from ${p.vendor_name || p.vendor_id}`, strength: "medium" });
          }
          sim.match_explanation = { signals, score: p._similarity ? Math.round(p._similarity * 100) : null, tag_score: p._tag_score || null };
        }
        return sim;
      });

      // Find Similar does NOT increment guest search counter

      return json(res, 200, {
        source_product_id: productId,
        products: annotated,
        total: annotated.length,
        method: "semantic",
      });
    }

    // ── Cross-Match: compute cosine similarity between selected products and candidates ──
    if (req.method === "POST" && req.url === "/cross-match") {
      const body = await collectBody(req);
      const selectedIds = body.selected_ids || [];
      const candidateIds = body.candidate_ids || [];

      if (!selectedIds.length || !candidateIds.length) {
        return json(res, 400, { error: "selected_ids and candidate_ids required" });
      }

      const scores = crossMatchScores(selectedIds, candidateIds);
      const result = {};
      for (const [id, score] of scores) {
        result[id] = Math.round(score * 10000) / 10000;
      }

      return json(res, 200, { scores: result });
    }

    // ── Get Single Product ──
    if (req.method === "GET" && req.url.startsWith("/product/")) {
      const productId = decodeURIComponent(req.url.slice("/product/".length));
      const product = getProduct(productId);
      if (!product) return json(res, 404, { error: "Product not found" });
      const dims = parseDimensions(product.dimensions);
      const delivery = dims ? checkDeliveryFeasibility(dims) : null;
      const materialInfo = matchProductMaterial(product);
      const materialBadges = getProductMaterialBadges(product);
      const procurement = getProductProcurement(product);
      return json(res, 200, {
        product: sanitizeSearchProduct(product),
        parsed_dimensions: dims || null,
        delivery_feasibility: delivery,
        material_info: materialInfo,
        material_badges: materialBadges,
        procurement,
      });
    }

    if (req.method === "GET" && req.url === "/runs") {
      return json(res, 200, readRuns());
    }

    if (req.method === "POST" && req.url === "/seed") {
      const payload = await seedSampleCatalog();
      return json(res, 200, {
        ok: true,
        count: payload.products.length,
        updated_at: payload.updated_at,
        vendor_results: payload.vendor_results,
      });
    }

    // ── Delete products by ID or vendor ──
    if (req.method === "POST" && req.url === "/catalog/delete") {
      const body = await collectBody(req);
      let deleted = 0;
      if (body.id) {
        if (deleteProduct(body.id)) deleted++;
      }
      if (Array.isArray(body.ids)) {
        for (const id of body.ids) { if (deleteProduct(id)) deleted++; }
      }
      if (body.vendor_name) {
        // Vendor-wide deletion requires explicit force flag
        if (!body.force_delete_vendor) {
          return json(res, 400, { ok: false, error: `Deleting all products for vendor "${body.vendor_name}" requires force_delete_vendor: true` });
        }
        const all = getAllProducts();
        for (const p of all) {
          if (p.vendor_name === body.vendor_name) { if (deleteProduct(p.id)) deleted++; }
        }
      }
      return json(res, 200, { ok: true, deleted, total: getProductCount() });
    }

    // ── Direct product insert (for scrapers) ──
    if (req.method === "POST" && req.url === "/catalog/insert") {
      const body = await collectBody(req);
      const products = Array.isArray(body.products) ? body.products : [];
      if (products.length === 0) return json(res, 400, { error: "No products provided" });
      const result = catalogDBInterface.insertProducts(products);
      return json(res, 200, { ok: true, inserted: result.inserted, updated: result.updated, total: getProductCount() });
    }

    if (req.method === "POST" && req.url === "/ingest") {
      const body = await collectBody(req);
      const payload = await ingestVendors({
        mode: String(body.mode || "seed"),
        vendorIds: Array.isArray(body.vendor_ids) ? body.vendor_ids.map(String) : [],
      });
      return json(res, 200, {
        ok: true,
        count: payload.products.length,
        updated_at: payload.updated_at,
        vendor_results: payload.vendor_results,
      });
    }

    // ── Trade Catalog Endpoints ──────────────────────────────
    if (req.method === "GET" && req.url === "/trade-catalog") {
      const stats = getTradeCatalogStats();
      return json(res, 200, stats);
    }

    if (req.method === "POST" && req.url === "/trade-catalog/crawl") {
      const body = await collectBody(req);
      const vendorIds = Array.isArray(body.vendor_ids) ? body.vendor_ids : undefined;
      const maxCategories = Number(body.max_categories) || 6;
      // Run async — respond immediately with status
      const result = await crawlAllVendors({ vendorIds, maxCategories });
      return json(res, 200, { ok: true, ...result });
    }

    if (req.method === "POST" && req.url === "/trade-catalog/crawl-vendor") {
      const body = await collectBody(req);
      const vendorId = String(body.vendor_id || "");
      if (!vendorId) return json(res, 400, { error: "vendor_id required" });
      const products = await crawlVendor(vendorId, { maxCategories: Number(body.max_categories) || 8 });
      return json(res, 200, { ok: true, vendor_id: vendorId, discovered: products.length, products });
    }

    if (req.method === "GET" && req.url === "/trade-vendors") {
      return json(res, 200, { vendors: tradeVendors });
    }

    // ══════════════════════════════════════════════════════════════════
    // SMART SEARCH — Conversation-aware AI search
    // One Haiku call per message with full conversation context.
    // ══════════════════════════════════════════════════════════════════
    // SMART SEARCH — Conversational AI search via pure vector pipeline
    // ══════════════════════════════════════════════════════════════════
    if (req.method === "POST" && req.url === "/smart-search") {
      const body = await collectBody(req);

      // Subscription check
      const identity = await getRequestIdentity(req, body);
      const access = checkAccess(identity.userId, identity.fingerprint, identity.ip, identity.localStorageId, "search");
      if (!access.allowed) {
        return json(res, 402, {
          error: "subscription_required",
          status: access.status,
          reason: access.reason,
          searches_remaining: 0,
        });
      }

      const conversation = Array.isArray(body.conversation) ? body.conversation.slice(-20) : [];

      if (conversation.length === 0) {
        return json(res, 400, { error: "conversation array required" });
      }

      const lastUserMsg = [...conversation].reverse().find(m => m.role === "user");
      const queryText = lastUserMsg?.content || "";

      // Pure AI vector pipeline — Haiku sees full conversation, returns vector_query
      const result = await searchPipeline(queryText, { conversation });
      const responseProducts = result.products.map(sanitizeSearchProduct);

      // Increment guest search count
      if (!identity.userId || getUserStatus(identity.userId) === "guest") {
        incrementGuestSearch(identity.fingerprint);
      }

      const updatedAccess = checkAccess(identity.userId, identity.fingerprint, identity.ip, identity.localStorageId, "search");
      return json(res, 200, {
        products: responseProducts,
        total: responseProducts.length,
        assistant_message: result.assistant_message || result.ai_summary,
        intent: result.intent,
        vendor_comparison: null,
        zero_result_guidance: responseProducts.length === 0
          ? { suggestion: "No matches found. Try broadening your search." }
          : null,
        diagnostics: result.diagnostics,
        searches_remaining: updatedAccess.searches_remaining,
        subscription_status: updatedAccess.status,
      });
    }

    // ── LIST SEARCH — Pure vector pipeline for multi-item sourcing lists ──
    if (req.method === "POST" && req.url === "/list-search") {
      const body = await collectBody(req);

      // Subscription check — each item counts as a separate search
      const identity = await getRequestIdentity(req, body);
      const access = checkAccess(identity.userId, identity.fingerprint, identity.ip, identity.localStorageId, "search");
      if (!access.allowed) {
        return json(res, 402, {
          error: "subscription_required",
          status: access.status,
          reason: access.reason,
          searches_remaining: 0,
        });
      }

      const items = Array.isArray(body.items) ? body.items : [];

      if (items.length === 0) {
        return json(res, 400, { error: "items array required" });
      }

      // Pure vector pipeline for list search
      const listResult = await listSearchPipeline(items);

      // Sanitize products in each item
      for (const item of listResult.items) {
        item.products = item.products.map(sanitizeSearchProduct);
      }

      // Increment guest search count — each list item counts as a search
      if (!identity.userId || getUserStatus(identity.userId) === "guest") {
        for (let i = 0; i < items.length; i++) {
          incrementGuestSearch(identity.fingerprint);
        }
      }

      const updatedAccess = checkAccess(identity.userId, identity.fingerprint, identity.ip, identity.localStorageId, "search");
      listResult.searches_remaining = updatedAccess.searches_remaining;
      listResult.subscription_status = updatedAccess.status;

      return json(res, 200, listResult);
    }

    // OLD LIST SEARCH CODE BELOW — REPLACED BY VECTOR PIPELINE
    if (false) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      let parsedItems = null;

      if (apiKey) {
        try {
          const listPrompt = items.map((item, i) => `${i + 1}. ${item}`).join("\n");
          const parseResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "anthropic-version": "2023-06-01",
              "x-api-key": apiKey,
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 2048,
              system: `You are a furniture sourcing expert parsing a designer's product list. For each item, extract structured search filters.

CATEGORY NAMES (use exact): sofas, sectionals, loveseats, settees, accent-chairs, swivel-chairs, dining-chairs, bar-stools, counter-stools, recliners, ottomans, benches, chaises, daybeds, beds, nightstands, dressers, chests, armoires, cocktail-tables, side-tables, console-tables, dining-tables, desks, bookcases, media-cabinets, bar-cabinets, buffets, credenzas, mirrors, lighting, floor-lamps, table-lamps, chandeliers, pendants, rugs, art, accessories, outdoor-seating, outdoor-dining, outdoor-tables

Return ONLY valid JSON — an array of objects, one per item:
[
  {
    "item_number": 1,
    "original_text": "the original item text",
    "summary": "Brief expert description of what we're searching for (1 sentence)",
    "category": "media-cabinets" or null,
    "material": "oak" or null,
    "style": "contemporary" or null,
    "color": null,
    "keywords": ["wall-mount", "media console"],
    "search_queries": ["white oak media console", "oak wall mount media cabinet"],
    "price_max": null,
    "dimension_notes": "60 inches wide" or null,
    "feasibility": "strong" or "possible" or "unlikely",
    "feasibility_note": null or "We don't carry rugs from most trade vendors yet"
  }
]

feasibility:
- "strong": We definitely carry this category from trade vendors
- "possible": We might have some, worth searching
- "unlikely": This is a category we likely don't have (e.g., specific rug brands, outdoor cushions, window treatments)

Be specific with search_queries — generate 2-3 targeted queries per item.`,
              messages: [{ role: "user", content: `A designer pasted this sourcing list:\n${listPrompt}\n\nParse each item into structured search filters.` }],
            }),
          });

          if (parseResponse.ok) {
            const parseData = await parseResponse.json();
            const parseText = parseData.content?.[0]?.text || "";
            const jsonMatch = parseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              parsedItems = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (err) {
          console.error("[list-search] AI parse error:", err.message);
        }
      }

      // Step 2: If AI parsing failed, create basic parsed items from raw text
      if (!parsedItems) {
        parsedItems = items.map((item, i) => ({
          item_number: i + 1,
          original_text: item,
          summary: item,
          category: null,
          material: null,
          style: null,
          color: null,
          keywords: item.toLowerCase().split(/\s+/).filter(w => w.length > 2),
          search_queries: [item],
          price_max: null,
          dimension_notes: null,
          feasibility: "possible",
          feasibility_note: null,
        }));
      }

      // Step 3: Run searches for each item
      const results = [];
      for (const parsed of parsedItems) {
        const candidateMap = new Map();

        // Search using AI queries
        const queries = parsed.search_queries?.length > 0 ? parsed.search_queries : [parsed.original_text];
        for (const sq of queries) {
          if (!sq || sq.length < 2) continue;
          const sqResults = searchCatalogDB(sq, {}, 200);
          for (const r of sqResults) {
            if (!candidateMap.has(r.id)) candidateMap.set(r.id, r);
          }
        }

        // Also search by category
        if (parsed.category) {
          const catQuery = parsed.category.replace(/-/g, " ");
          const catResults = searchCatalogDB(catQuery, {}, 200);
          for (const r of catResults) {
            if (!candidateMap.has(r.id)) candidateMap.set(r.id, r);
          }
        }

        let itemResults = Array.from(candidateMap.values());

        // Apply category filter
        if (parsed.category) {
          const cat = parsed.category.toLowerCase().replace(/\s+/g, "-");
          const catSingular = cat.replace(/s$/, "");
          const catFiltered = itemResults.filter(p => {
            const pCat = (p.category || "").toLowerCase();
            return pCat.includes(catSingular) || pCat === cat;
          });
          if (catFiltered.length > 0) itemResults = catFiltered;
        }

        // Apply material filter (soft)
        if (parsed.material) {
          const mat = parsed.material.toLowerCase();
          const matFiltered = itemResults.filter(p => {
            const text = `${p.material || ""} ${p.product_name || ""} ${p.description || ""}`.toLowerCase();
            return text.includes(mat);
          });
          if (matFiltered.length >= 3) itemResults = matFiltered;
        }

        // Apply style filter (soft)
        if (parsed.style) {
          const sty = parsed.style.toLowerCase();
          const styFiltered = itemResults.filter(p => {
            const text = `${p.style || ""} ${p.product_name || ""}`.toLowerCase();
            return text.includes(sty);
          });
          if (styFiltered.length >= 3) itemResults = styFiltered;
        }

        // Apply price filter
        if (parsed.price_max) {
          const pf = itemResults.filter(p => (p.retail_price || 0) <= parsed.price_max);
          if (pf.length > 0) itemResults = pf;
        }

        // Score by keyword relevance
        const allTerms = [
          ...(parsed.keywords || []),
          parsed.category || "",
          parsed.material || "",
          parsed.style || "",
        ].filter(Boolean).flatMap(k => k.toLowerCase().split(/[\s-]+/)).filter(w => w.length > 2);
        const uniqueTerms = [...new Set(allTerms)];

        for (const p of itemResults) {
          const text = `${p.product_name || ""} ${p.category || ""} ${p.material || ""} ${p.style || ""} ${p.description || ""} ${(p.tags || []).join(" ")}`.toLowerCase();
          let matchCount = 0;
          for (const term of uniqueTerms) {
            if (text.includes(term)) matchCount++;
          }
          p._relevance = (uniqueTerms.length > 0 ? (matchCount / uniqueTerms.length) : 0) * 100 + (p.quality_score || 0) * 0.01;
        }
        itemResults.sort((a, b) => (b._relevance || 0) - (a._relevance || 0));

        // Vendor diversity
        const diversified = diversifyResults(itemResults, {
          maxPerVendor: 4,
          topSlice: 20,
          totalLimit: 12,
          queryTerms: (parsed.original_text || "").toLowerCase().split(/\s+/),
        });

        const products = diversified.map(sanitizeSearchProduct);

        results.push({
          item_number: parsed.item_number,
          original_text: parsed.original_text,
          summary: parsed.summary || parsed.original_text,
          category: parsed.category,
          feasibility: parsed.feasibility || "possible",
          feasibility_note: parsed.feasibility_note || null,
          dimension_notes: parsed.dimension_notes || null,
          products,
          total: products.length,
        });
      }

      // Build overview AI message
      const totalFound = results.reduce((sum, r) => sum + r.total, 0);
      const strongItems = results.filter(r => r.total >= 3);
      const weakItems = results.filter(r => r.total > 0 && r.total < 3);
      const emptyItems = results.filter(r => r.total === 0);

      // Collect vendor names across all results
      const allVendors = new Set();
      for (const r of results) {
        for (const p of r.products) {
          if (p.vendor_name || p.manufacturer_name) allVendors.add(p.vendor_name || p.manufacturer_name);
        }
      }
      const vendorList = [...allVendors].slice(0, 5).join(", ");

      let overviewMessage = `Got your list — sourcing all ${items.length} items.`;
      if (strongItems.length > 0) {
        overviewMessage += ` Found strong matches for ${strongItems.length} item${strongItems.length > 1 ? "s" : ""}`;
        if (vendorList) overviewMessage += ` from ${vendorList}`;
        overviewMessage += ".";
      }
      if (weakItems.length > 0) {
        overviewMessage += ` ${weakItems.length} item${weakItems.length > 1 ? "s" : ""} had limited results.`;
      }
      if (emptyItems.length > 0) {
        overviewMessage += ` ${emptyItems.length} item${emptyItems.length > 1 ? "s" : ""} didn't match our catalog — noted for future sourcing.`;
      }

      return json(res, 200, {
        overview_message: overviewMessage,
        items: results,
        total_items: results.length,
        total_products: totalFound,
      });
    } // end old list-search dead code

    // ══════════════════════════════════════════════════════════════════
    // ADMIN ENDPOINTS — tyler@spekd.ai only, returns 404 for others
    // ══════════════════════════════════════════════════════════════════

    const ADMIN_SECRET = process.env.ADMIN_SECRET || "e8d71b57f7a4a15f092ab7e003e0e0199e04da86871146bdfa43df78e7a2e44a";

    async function isAdmin(req) {
      // Allow URL-based secret key for browser access
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.searchParams.get("key") === ADMIN_SECRET) return true;
      const authHeader = req.headers["authorization"];
      const token = extractToken(authHeader);
      if (!token) return false;
      const result = await getUserFromToken(token);
      if (!result.ok) return false;
      return result.user.email === "tyler@spekd.ai";
    }

    // GET /admin/suspect-activity — traffic analysis by city, flags scraping
    if (req.method === "GET" && req.url.startsWith("/admin/suspect-activity")) {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });
      const url = new URL(req.url, `http://${req.headers.host}`);
      const city = url.searchParams.get("city") || null;
      const days = parseInt(url.searchParams.get("days")) || 7;
      const { getSuspectActivity } = await import("./lib/search-analytics.mjs");
      return json(res, 200, getSuspectActivity(city, days));
    }

    // GET /admin/active-visitors — who's on the site right now
    if (req.method === "GET" && (req.url === "/admin/active-visitors" || req.url.startsWith("/admin/active-visitors?"))) {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });
      const url = new URL(req.url, `http://${req.headers.host}`);
      const minutes = parseInt(url.searchParams.get("minutes")) || 5;
      return json(res, 200, getActiveVisitors(minutes));
    }

    // GET /admin/ai-costs — real token usage and cost breakdown
    if (req.method === "GET" && req.url === "/admin/ai-costs") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });
      return json(res, 200, getAICostStats());
    }

    // GET /admin/search-locations — where searches come from
    if (req.method === "GET" && (req.url === "/admin/search-locations" || req.url.startsWith("/admin/search-locations?"))) {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });
      const url = new URL(req.url, `http://${req.headers.host}`);
      const days = parseInt(url.searchParams.get("days")) || 7;
      return json(res, 200, getSearchLocations(days));
    }

    // GET /admin/funnel — trial funnel metrics
    if (req.method === "GET" && req.url === "/admin/funnel") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });
      return json(res, 200, getFunnelMetrics());
    }

    // 1. GET /admin/overview — top-line metrics + recent activity
    if (req.method === "GET" && req.url === "/admin/overview") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });

      const allUsers = await getAllUsers();
      const allSubs = getAllSubscriptions();
      const analytics = getAnalyticsDashboard();
      const searchesByDay = getSearchesByDay(30);
      const recentSearches = getRecentSearches(10);
      const revenue = getRevenueDashboard();

      // Count users by status
      const now = Date.now();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const totalUsers = allUsers.length;
      const newThisWeek = allUsers.filter(u => new Date(u.created_at).getTime() > weekAgo).length;

      // Active Pro = subscriptions with status "active"
      const activePro = Object.values(allSubs).filter(s => s.status === "active").length;
      const activeProThisWeek = Object.values(allSubs).filter(s => s.status === "active" && new Date(s.created_at || s.subscribed_at || 0).getTime() > weekAgo).length;
      const freeUsers = totalUsers - activePro;
      const mrr = activePro * 99; // simplified

      // Searches
      const searchesToday = analytics.overview?.searches_today || 0;
      const searchesThisMonth = searchesByDay.reduce((sum, d) => sum + d.count, 0);
      // Real AI cost from actual token usage tracking
      const aiCosts = getAICostStats();
      const apiCostEstimate = aiCosts.today.cost; // today's actual cost

      // Recent signups (10 most recent)
      const recentSignups = [...allUsers]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10)
        .map(u => ({
          id: u.id, full_name: u.full_name, email: u.email,
          business_name: u.business_name, created_at: u.created_at,
          plan: allSubs[u.id]?.status === "active" ? (allSubs[u.id]?.plan || "pro") : "free",
        }));

      // Health alerts count
      const alerts = getHealthAlerts();

      return json(res, 200, {
        total_users: totalUsers,
        new_users_this_week: newThisWeek,
        active_pro: activePro,
        new_pro_this_week: activeProThisWeek,
        free_users: freeUsers,
        mrr,
        searches_today: searchesToday,
        searches_this_month: searchesThisMonth,
        api_cost_estimate: apiCostEstimate,
        ai_costs: aiCosts,
        cost_per_search: aiCosts.per_search.avg_cost,
        searches_by_day: searchesByDay,
        recent_signups: recentSignups,
        recent_searches: recentSearches,
        health_alert_count: alerts.length,
        revenue_summary: revenue.overview || {},
      });
    }

    // 2. GET /admin/users — all users with subscription info
    if (req.method === "GET" && req.url === "/admin/users") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });

      const allUsers = await getAllUsers();
      const allSubs = getAllSubscriptions();

      const usersWithSubs = allUsers.map(u => ({
        ...u,
        subscription: allSubs[u.id] || null,
        status: allSubs[u.id]?.status || "free",
        plan: allSubs[u.id]?.plan || null,
      }));

      return json(res, 200, { users: usersWithSubs });
    }

    // 3. GET /admin/users/:id — detailed user info
    if (req.method === "GET" && req.url.match(/^\/admin\/users\/[^/]+$/) && !req.url.includes("/comp") && !req.url.includes("/upgrade") && !req.url.includes("/deactivate") && !req.url.includes("/reactivate")) {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });

      const userId = req.url.split("/admin/users/")[1];
      const allUsers = await getAllUsers();
      const user = allUsers.find(u => u.id === userId);
      if (!user) return json(res, 404, { error: "User not found" });

      const sub = getSubscription(userId);
      const searchHistory = await getSearchHistory(userId);
      const savedProducts = await getSavedProducts(userId);
      return json(res, 200, { user, subscription: sub, search_history: searchHistory, saved_products_count: savedProducts.length });
    }

    // 4. POST /admin/comp — comp free Pro access
    if (req.method === "POST" && req.url === "/admin/comp") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });

      const body = await collectBody(req);
      const { email, days, note } = body;
      if (!email) return json(res, 400, { error: "Email required" });

      const allUsers = await getAllUsers();
      const user = allUsers.find(u => u.email === email.toLowerCase().trim());
      if (!user) return json(res, 404, { error: "User not found with that email" });

      const daysNum = parseInt(days) || 30;
      const expiresAt = new Date(Date.now() + daysNum * 24 * 60 * 60 * 1000).toISOString();

      setSubscription(user.id, {
        status: "active",
        plan: "pro_comp",
        current_period_end: expiresAt,
        comped: true,
        comped_at: new Date().toISOString(),
        comped_days: daysNum,
        comp_note: note || "",
      });

      logCompAction({ user_id: user.id, email: user.email, days: daysNum, note: note || "", expires_at: expiresAt });

      return json(res, 200, { ok: true, message: `Comped ${user.email} for ${daysNum} days`, expires_at: expiresAt });
    }

    // 5. GET /admin/comps — list all comps
    if (req.method === "GET" && req.url === "/admin/comps") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });
      return json(res, 200, { comps: getCompLog(), active_comps: getActiveComps() });
    }

    // 6. POST /admin/deactivate — deactivate user account
    if (req.method === "POST" && req.url === "/admin/deactivate") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });

      const body = await collectBody(req);
      const { user_id, reason } = body;
      if (!user_id) return json(res, 400, { error: "user_id required" });

      // Set deactivated flag on user account
      const result = await updateUser(user_id, {
        deactivated: true,
        deactivated_at: new Date().toISOString(),
        deactivated_reason: reason || "Admin deactivated",
      });

      if (!result.ok) return json(res, 404, { error: result.error });

      // Also cancel subscription
      setSubscription(user_id, {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: "admin_deactivated",
      });

      logAdminAction("deactivate_user", user_id, reason || "No reason provided");

      return json(res, 200, { ok: true, message: "User deactivated" });
    }

    // 7. POST /admin/reactivate — reactivate user account
    if (req.method === "POST" && req.url === "/admin/reactivate") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });

      const body = await collectBody(req);
      const { user_id } = body;
      if (!user_id) return json(res, 400, { error: "user_id required" });

      const result = await updateUser(user_id, {
        deactivated: false,
        deactivated_at: null,
        deactivated_reason: null,
      });

      if (!result.ok) return json(res, 404, { error: result.error });

      logAdminAction("reactivate_user", user_id, "");

      return json(res, 200, { ok: true, message: "User reactivated" });
    }

    // 7b. POST /admin/delete-user — permanently delete user account
    if (req.method === "POST" && req.url === "/admin/delete-user") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });

      const body = await collectBody(req);
      const { user_id, reason } = body;
      if (!user_id) return json(res, 400, { error: "user_id required" });

      // Cancel subscription first
      setSubscription(user_id, {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: "admin_deleted",
      });

      const result = await deleteUser(user_id);
      if (!result.ok) return json(res, 404, { error: result.error });

      logAdminAction("delete_user", user_id, reason || "Admin deleted");

      return json(res, 200, { ok: true, message: "User permanently deleted" });
    }

    // 8. GET /admin/analytics — search analytics
    if (req.method === "GET" && req.url === "/admin/analytics") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });
      return json(res, 200, getAnalyticsDashboard());
    }

    // 9. GET /admin/catalog-health — catalog health dashboard
    if (req.method === "GET" && req.url === "/admin/catalog-health") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });

      const summary = getVendorHealthSummary();
      const alerts = getHealthAlerts();

      return json(res, 200, { ...summary, alerts });
    }

    // 10. POST /admin/run-health-check — trigger immediate health check
    if (req.method === "POST" && req.url === "/admin/run-health-check") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });

      runCatalogHealthCheck(getAllProducts);
      logAdminAction("run_health_check", "catalog", "Manual health check triggered");

      const summary = getVendorHealthSummary();
      return json(res, 200, { ok: true, message: "Health check complete", ...summary });
    }

    // 11. POST /admin/dismiss-alert — dismiss a health alert
    if (req.method === "POST" && req.url === "/admin/dismiss-alert") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });

      const body = await collectBody(req);
      if (!body.alert_id) return json(res, 400, { error: "alert_id required" });

      dismissAlert(body.alert_id);
      return json(res, 200, { ok: true });
    }

    // 12. GET /admin/activity-log — admin action history
    if (req.method === "GET" && req.url === "/admin/activity-log") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });
      return json(res, 200, { log: getActivityLog(100) });
    }

    // 13. GET /admin/search?q=... — search users, products, vendors
    if (req.method === "GET" && req.url.startsWith("/admin/search")) {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });

      const urlObj = new URL(req.url, "http://localhost");
      const q = (urlObj.searchParams.get("q") || "").toLowerCase().trim();
      if (!q) return json(res, 200, { users: [], products: [], vendors: [] });

      // Search users
      const allUsers = await getAllUsers();
      const matchedUsers = allUsers.filter(u =>
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.business_name || "").toLowerCase().includes(q)
      ).slice(0, 10);

      // Search products
      const allProductsArr = [...getAllProducts()];
      const matchedProducts = allProductsArr.filter(p =>
        (p.product_name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q)
      ).slice(0, 10).map(p => ({
        id: p.id, product_name: p.product_name, vendor_name: p.vendor_name,
        sku: p.sku, category: p.category, image_url: p.image_url,
        retail_price: p.retail_price,
      }));

      // Search vendors
      const vendorMap = {};
      for (const p of allProductsArr) {
        const v = p.vendor_id || p.vendor_name;
        if (!v) continue;
        if (!vendorMap[v]) vendorMap[v] = { vendor_id: v, vendor_name: p.vendor_name, count: 0 };
        vendorMap[v].count++;
      }
      const matchedVendors = Object.values(vendorMap).filter(v =>
        (v.vendor_id || "").toLowerCase().includes(q) ||
        (v.vendor_name || "").toLowerCase().includes(q)
      ).slice(0, 10);

      return json(res, 200, { users: matchedUsers, products: matchedProducts, vendors: matchedVendors });
    }

    // 14. POST /admin/rebuild-vectors — trigger vector index rebuild
    if (req.method === "POST" && req.url === "/admin/rebuild-vectors") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });

      clearVectorSearchCache();
      vectorIndexAll(getAllProducts(), { reindex: true }).then(() => {
        persistVectors();
        console.log("[admin] Vector rebuild complete.");
      }).catch(err => console.error("[admin] Vector rebuild failed:", err.message));

      logAdminAction("rebuild_vectors", "catalog", "Manual vector rebuild triggered");
      return json(res, 202, { ok: true, message: "Vector rebuild started" });
    }

    // 15. POST /admin/rebuild-catalog-index — trigger catalog index rebuild
    if (req.method === "POST" && req.url === "/admin/rebuild-catalog-index") {
      if (!(await isAdmin(req))) return json(res, 404, { error: "Not found" });

      buildCatalogIndex(getAllProducts());
      clearVectorSearchCache();
      logAdminAction("rebuild_catalog_index", "catalog", "Manual catalog index rebuild triggered");
      return json(res, 200, { ok: true, message: "Catalog index rebuilt" });
    }

    // ══════════════════════════════════════════════════════════════════
    // SEARCH — One endpoint, two modes:
    //   Free: vector-only (MiniLM cosine similarity, 20 results, $0)
    //   Pro:  full Haiku pipeline (AI + vector, 80 results)
    // 1. Query → Haiku (with catalog context)
    // 2. Haiku returns vector_query
    // 3. vector_query → MiniLM embedding → cosine similarity
    // 4. Top 80 results returned
    // No parser. No filters. No keyword search. No synonym maps. Pure AI.
    // ══════════════════════════════════════════════════════════════════
    if (req.method === "POST" && req.url === "/search") {
      const body = await collectBody(req);

      const query = String(body.query || "").trim();
      if (!query) return json(res, 400, { error: "query required" });

      // ── Determine search tier ──
      const identity = await getRequestIdentity(req, body);

      let searchTier; // "pro" | "free_hook" | "trial_required" | "free_fallback"
      let searchesRemaining = null;
      let trialDaysRemaining = null;
      let subStatus = "guest";

      // Admin bypass — always full Pro, no counters
      if (identity.userEmail && isAdminEmail(identity.userEmail)) {
        searchTier = "pro";
        subStatus = "active";
      } else if (identity.userId) {
        const status = getUserStatus(identity.userId);
        subStatus = status;
        if (status === "active" || status === "trialing" || status === "cancelled" || status === "past_due" || status === "internal") {
          searchTier = "pro";
          // Calculate trial days remaining
          if (status === "trialing") {
            const sub = getSubscription(identity.userId);
            if (sub?.trial_end) {
              trialDaysRemaining = Math.max(0, Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            }
          }
        } else {
          searchTier = "free_fallback"; // expired user → vector-only
        }
      } else if (!identity.fingerprint && !identity.localStorageId) {
        // No identification at all — internal/API call
        searchTier = "pro";
        subStatus = "internal";
      } else {
        // Anonymous user
        const usage = getGuestUsage(identity.fingerprint, identity.ip, identity.localStorageId);
        if (usage.search_count < FREE_SEARCH_LIMIT) {
          searchTier = "free_hook"; // full Haiku pipeline, then increment counter
          searchesRemaining = FREE_SEARCH_LIMIT - usage.search_count - 1; // remaining AFTER this search
        } else {
          searchTier = "trial_required";
        }
      }

      // 402 — anonymous user out of free searches → show trial signup modal
      if (searchTier === "trial_required") {
        return json(res, 402, {
          error: "trial_required",
          searches_remaining: 0,
          subscription_status: "trial_expired",
        });
      }

      // ── FREE FALLBACK: expired/cancelled user → still use full Haiku pipeline ──
      // (Same as Pro path below — no reason to degrade search quality for expired users,
      //  paywall is enforced on the frontend. Keeping search quality high encourages re-subscription.)

      // ── PRO PATH: full Haiku pipeline (existing code, untouched) ──
      const excludeIds = new Set(Array.isArray(body.exclude_ids) ? body.exclude_ids : []);
      const page = Math.max(1, Number(body.page) || 1);
      const requestFilters = body.filters || {};
      const MAX_CONVERSATION_MESSAGES = 20;
      const conversation = Array.isArray(body.conversation)
        ? body.conversation.slice(-MAX_CONVERSATION_MESSAGES)
        : [];

      // Pure AI vector pipeline — with hard 20s server timeout
      let result;
      try {
        result = await Promise.race([
          searchPipeline(query, {
            conversation,
            excludeIds,
            page,
            filters: requestFilters,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Server search timeout (20s)")), 20000)),
        ]);
      } catch (timeoutErr) {
        console.error(`[search] Pipeline timeout for query "${query}": ${timeoutErr.message}`);
        return json(res, 504, { error: "Search timed out. Please try again.", query });
      }

      // Sanitize products for frontend
      const responseProducts = result.products.map(sanitizeSearchProduct);

      // Filter out products without valid images (keep all if that would remove everything)
      const imageFiltered = responseProducts.filter(p => hasValidProductImage(p.image_url));
      const finalProducts = imageFiltered.length > 0 ? imageFiltered : responseProducts;

      // Material badges
      for (const product of finalProducts) {
        product.material_badges = getProductMaterialBadges(product);
      }

      // Room dimensions fit scoring
      if (body.room_dimensions) {
        for (const product of finalProducts) {
          let dims = parseDimensions(product.dimensions);
          if (!dims && (product.dimensions_width || product.dimensions_length)) {
            dims = {
              width_in: Number(product.dimensions_width) || 0,
              depth_in: Number(product.dimensions_length) || Number(product.dimensions_depth) || 0,
              height_in: Number(product.dimensions_height) || 0,
            };
            if (dims.width_in === 0 && dims.depth_in === 0) dims = null;
          }
          if (dims) {
            product.fit_score = calculateFitScore(dims, body.room_dimensions, product.category);
          }
        }
      }

      // Facets
      const facets = result.facets;

      const vendorCount = new Set(finalProducts.map(p => p.vendor_name)).size;
      const vectorStats = getVectorStoreStats();

      const response = {
        query,
        intent: result.intent,
        ai_filter: null,
        ai_summary: result.ai_summary,
        assistant_message: result.assistant_message,
        total: finalProducts.length,
        total_available: result.total_available,
        has_more: result.has_more,
        page,
        result_mode: result.result_mode || "ai-vector",
        tier_used: result.tier_used ?? 1,
        ai_called: result.ai_called ?? true,
        cache_hit: result.cache_hit || false,
        facets,
        diagnostics: {
          ...result.diagnostics,
          total_catalog_size: getProductCount(),
          vector_indexed: vectorStats.total_vectors,
        },
        products: finalProducts,
      };

      // Track analytics (skip bots)
      if (!isBot(req)) {
        trackSearch({
          query,
          resultCount: finalProducts.length,
          vendorIds: [...new Set(finalProducts.map(p => p.vendor_id))],
          tier: 1,
          cacheHit: result.cache_hit || false,
          ip: reqIp,
        });
        recordSearch(query);
      }

      // Increment free search counter for anonymous users (free_hook)
      if (searchTier === "free_hook") {
        incrementGuestSearch(identity.fingerprint);
      }

      // Track search history for logged-in users
      if (identity.userId) {
        addSearchHistory(identity.userId, query, finalProducts.length).catch(() => {});
      }

      // Add subscription info to response
      response.searches_remaining = searchesRemaining;
      response.subscription_status = subStatus;
      response.trial_days_remaining = trialDaysRemaining;

      // Cache for 2 hours (handled by searchPipeline, but also cache here for the old cacheKey format)
      const cacheKey = `search:${query.toLowerCase()}:${JSON.stringify(requestFilters)}:p${page}`;
      setCache(cacheKey, response, 2 * 60 * 60 * 1000);

      return json(res, 200, response);
    }

    // OLD SEARCH CODE BELOW — DEAD CODE, REPLACED BY VECTOR PIPELINE
    if (false) {
      const cached = getFromCache("dead");
      if (cached && excludeIds.size === 0) {
        return json(res, 200, { ...cached, cache_hit: true });
      }
      cacheMisses++;

      // ══════════════════════════════════════════════════════════════════
      // FAST PATH: Local parse is instant, AI translation races it
      // Local parse (~0ms) runs first. AI call fires in parallel with a
      // short timeout — if it returns in time, it replaces local parse.
      // Target: first results in <500ms even when AI is slow.
      // ══════════════════════════════════════════════════════════════════

      // Immediately do local parse (synchronous, ~0ms)
      const localFilter = previousFilter
        ? (localParseFollowUp(query, previousFilter) || localParse(query))
        : localParse(query);

      // Race AI translation with a tight timeout — don't block on it
      let aiFilter = localFilter;
      let aiResult = null;
      try {
        if (previousFilter) {
          aiResult = await withTimeout(translateFollowUp(query, previousFilter), 3000, null);
          if (!aiResult) aiResult = await withTimeout(translateQuery(query), 2000, null);
        } else {
          aiResult = await withTimeout(translateQuery(query), 3000, null);
        }
      } catch { /* AI unavailable — local filter is fine */ }
      if (aiResult) {
        // Merge AI result with local parse's strict AI fields
        // localParse detects ai_features, ai_arm_style, ai_back_style, ai_silhouette
        // that the AI translator doesn't produce — preserve them
        if (localFilter) {
          if (localFilter.ai_features?.length > 0) aiResult.ai_features = localFilter.ai_features;
          if (localFilter.ai_arm_style) aiResult.ai_arm_style = localFilter.ai_arm_style;
          if (localFilter.ai_back_style) aiResult.ai_back_style = localFilter.ai_back_style;
          if (localFilter.ai_silhouette) aiResult.ai_silhouette = localFilter.ai_silhouette;
        }
        aiFilter = aiResult;
      }

      let aiFilterUsed = !!aiFilter;
      let filteredResults = [];
      let totalBeforeExclude = 0;
      let tier = 1;
      let aiCalled = !!aiFilter;

      // Build local intent as fallback
      const intent = buildSearchIntent(query);

      if (aiFilter) {
        // ── AI-guided search: broad catalog fetch, then AI filter ──
        const keywords = aiFilter.keywords || [query];

        // Build vendor filter(s) — supports multi-vendor queries
        // Use vendor_ids (from LOCAL_VENDORS) when available, fall back to slugifying display names
        const vendorIds = aiFilter.vendor_ids?.length > 0
          ? aiFilter.vendor_ids
          : aiFilter.vendors?.length > 0
            ? aiFilter.vendors.map(v => v.toLowerCase().replace(/[&]/g, "").replace(/\s+/g, "-"))
            : aiFilter.vendor
              ? [aiFilter.vendor.toLowerCase().replace(/[&]/g, "").replace(/\s+/g, "-")]
              : [];
        const vendorFilter = vendorIds.length === 1 ? vendorIds[0] : undefined;

        // Build search filters including AI-parsed price
        const aiSearchFilters = {
          vendor: vendorFilter || requestFilters.vendor,
          max_price: aiFilter.price_max || requestFilters.price_max,
          min_price: aiFilter.price_min || requestFilters.price_min,
        };

        // Search with each keyword to build a rich candidate pool
        const candidateMap = new Map();

        // Also include expanded material terms as keywords (#6)
        const allKeywords = [...keywords, query];
        if (aiFilter.material_expanded?.length > 0) {
          allKeywords.push(...aiFilter.material_expanded.slice(0, 4));
        }
        // Add collection as keyword (#8)
        if (aiFilter.collection) {
          allKeywords.push(aiFilter.collection);
        }

        // For multi-vendor queries, search per vendor to ensure coverage
        const searchVendorFilters = vendorIds.length > 1
          ? vendorIds.map(vid => ({ ...aiSearchFilters, vendor: vid }))
          : [aiSearchFilters];

        for (const svf of searchVendorFilters) {
          for (const kw of allKeywords) {
            const results = searchCatalogDB(kw, svf, 200);
            for (const r of results) {
              if (!candidateMap.has(r.id)) candidateMap.set(r.id, r);
            }
          }
        }

        // Also search by category name if we have one
        if (aiFilter.category) {
          for (const svf of searchVendorFilters) {
            const catResults = searchCatalogDB(aiFilter.category.replace(/-/g, " "), {
              vendor: svf.vendor,
            }, 200);
            for (const r of catResults) {
              if (!candidateMap.has(r.id)) candidateMap.set(r.id, r);
            }
          }
        }
        if (aiFilter.categories?.length) {
          for (const cat of aiFilter.categories) {
            for (const svf of searchVendorFilters) {
              const catResults = searchCatalogDB(cat.replace(/-/g, " "), {
                vendor: svf.vendor,
              }, 100);
              for (const r of catResults) {
                if (!candidateMap.has(r.id)) candidateMap.set(r.id, r);
              }
            }
          }
        }

        // ── VISUAL TAG CROSS-MATCHING: Find products by visual tag synonyms ──
        // Expands each keyword through the synonym map and finds products via the visual tag reverse index
        const expandedKeywords = expandAllSynonyms(keywords);
        for (const expanded of expandedKeywords) {
          const tagMatches = findProductsBySynonymExpansion(expanded);
          for (const pid of tagMatches) {
            if (!candidateMap.has(pid)) {
              const product = getProduct(pid);
              if (product) candidateMap.set(pid, product);
            }
          }
        }

        let candidates = Array.from(candidateMap.values());
        console.log(`[search] AI filter for "${query}": ${candidates.length} candidates (incl visual tag matches), filter=${JSON.stringify({ category: aiFilter.category, categories: aiFilter.categories, vendor: aiFilter.vendor, vendors: aiFilter.vendors, style: aiFilter.style, material: aiFilter.material, collection: aiFilter.collection, dimensions: aiFilter.dimensions, exclude_terms: aiFilter.exclude_terms })}`);

        // Apply AI filter (hard category + exclude + vendor + dimensions + material + scoring)
        // Pass original query for vibe expansion
        aiFilter._original_query = query;
        filteredResults = applyAIFilter(candidates, aiFilter);

        // ── SEARCH ENHANCER: Apply all 6 zero-cost improvements ──
        const vendorMatchScores = getMatchingVendors(keywords);
        for (const p of filteredResults) {
          const enhancedBonus = computeEnhancedScore(p, keywords, vendorMatchScores);
          const baseScore = p._ai_score || 0;
          p._ai_score = baseScore + enhancedBonus;
          p._enhanced_bonus = enhancedBonus;
        }

        // Re-sort after enhanced scoring
        filteredResults.sort((a, b) => (b._ai_score || 0) - (a._ai_score || 0));

        // Propagate AI score to relevance_score so downstream sorting uses it
        for (const p of filteredResults) {
          if (typeof p._ai_score === "number") {
            p.relevance_score = p._ai_score;
          }
        }
        // ── HYBRID SEARCH: Merge keyword results with vector semantic results ──
        try {
          filteredResults = await hybridSearch(query, filteredResults, {
            limit: 300,
            vectorWeight: 0.5,
            keywordWeight: 0.5,
            getProduct,
          });
          const semanticOnly = filteredResults.filter(p => p._search_method === "semantic").length;
          const hybridCount = filteredResults.filter(p => p._search_method === "hybrid").length;
          if (semanticOnly > 0 || hybridCount > 0) {
            console.log(`[search] Hybrid merge: ${hybridCount} in both, ${semanticOnly} semantic-only added`);
          }
        } catch (err) {
          console.error(`[search] Hybrid search failed, using keyword-only:`, err.message);
        }

        // ── RE-APPLY STRICT AI FILTER after hybrid merge ──
        // Hybrid search can inject products that bypass strict filtering
        filteredResults = applyAIFilter(filteredResults, aiFilter);

        filteredResults = dedupeProducts(filteredResults);
        totalBeforeExclude = filteredResults.length;

        // Exclude already-seen products (#11 pagination)
        if (excludeIds.size > 0) {
          filteredResults = filteredResults.filter(p => !excludeIds.has(p.id));
        }

        console.log(`[search] AI filter result: ${filteredResults.length} products after filtering (excluded ${excludeIds.size} seen)`);
      }

      // ── FALLBACK: Only when AI filter is completely unavailable ──
      // NO backfilling, NO padding. If AI filter returns 5 results, show 5 results.
      if (!aiFilter) {
        console.log(`[search] No AI filter available, using keyword fallback`);

        const brain = designBrainThink(query);
        const brainPlan = brain.plan;

        const mergedFilters = {
          vendor: brainPlan.filters.vendor_id || intent.vendor || requestFilters.vendor || undefined,
          max_price: brainPlan.filters.price_max || intent.max_price || requestFilters.price_max || undefined,
          min_price: brainPlan.filters.price_min || requestFilters.price_min || undefined,
          categories: requestFilters.categories || undefined,
          materials: requestFilters.materials || undefined,
          vendors: requestFilters.vendors || undefined,
          styles: requestFilters.styles || undefined,
        };

        const catalogResults = searchCatalogDB(query, mergedFilters, 200);
        const seenIds = new Set(catalogResults.map(p => p.id));

        // Brain expanded terms
        const expandedSearches = brainPlan.expanded_terms
          .filter(t => t.length > 3 && t !== query.toLowerCase())
          .slice(0, 4);
        for (const term of expandedSearches) {
          const expandedResults = searchCatalogDB(term, mergedFilters, 50);
          for (const r of expandedResults) {
            if (!seenIds.has(r.id)) { catalogResults.push(r); seenIds.add(r.id); }
          }
        }

        let allResults = dedupeProducts(catalogResults);

        // Exclude already-seen
        if (excludeIds.size > 0) {
          allResults = allResults.filter(p => !excludeIds.has(p.id));
        }

        // Category hard filter
        const categoryDetection = detectQueryCategory(query, mergedFilters.vendor);
        if (categoryDetection.categories?.length > 0) {
          const catFiltered = allResults.filter(p => productMatchesCategory(p, categoryDetection.categories));
          allResults = catFiltered; // HARD — no fallback
        }

        // Brain ranking
        allResults = brain.applyToResults(allResults);

        filteredResults = allResults;
        totalBeforeExclude = allResults.length;
        aiFilterUsed = false;
      }

      // ── Apply explicit request filters (from UI facets) ──
      if (requestFilters.vendors?.length) {
        filteredResults = filteredResults.filter(p =>
          requestFilters.vendors.some(v => (p.vendor_name || "").toLowerCase() === v.toLowerCase() || (p.vendor_id || "").toLowerCase() === v.toLowerCase())
        );
      }
      if (requestFilters.materials?.length) {
        filteredResults = filteredResults.filter(p =>
          requestFilters.materials.some(m => (p.material || "").toLowerCase().includes(m.toLowerCase()))
        );
      }
      if (requestFilters.categories?.length) {
        filteredResults = filteredResults.filter(p =>
          requestFilters.categories.some(c => (p.category || "").toLowerCase().includes(c.toLowerCase().replace(/ /g, "-")))
        );
      }
      if (requestFilters.styles?.length) {
        filteredResults = filteredResults.filter(p =>
          requestFilters.styles.some(s => (p.style || "").toLowerCase() === s.toLowerCase())
        );
      }
      if (requestFilters.price_min != null) {
        filteredResults = filteredResults.filter(p => !p.retail_price || p.retail_price >= requestFilters.price_min);
      }
      if (requestFilters.price_max != null) {
        filteredResults = filteredResults.filter(p => !p.retail_price || p.retail_price <= requestFilters.price_max);
      }

      // ── Filter out products without valid product images ──
      // Logo, placeholder, banner, and missing images provide no value to designers
      // But don't filter if it would remove ALL results — show what we have
      const imageFiltered = filteredResults.filter(p => hasValidProductImage(p.image_url) && !p.bad_image);
      if (imageFiltered.length > 0) {
        filteredResults = imageFiltered;
      }

      // ── Vendor diversity ──
      const preDiv = filteredResults;
      const queryTerms = (query || "").toLowerCase().split(/\s+/).filter(Boolean);
      const isMultiVendor = aiFilter?.vendors?.length > 1 || aiFilter?.vendor_ids?.length > 1;
      const hasVendorLock = !!(aiFilter?.vendor || isMultiVendor || intent.vendor);
      // For multi-vendor queries, don't lock to a single vendor — let diversity interleave
      const vendorLock = isMultiVendor ? null : (aiFilter?.vendor?.toLowerCase().replace(/\s+/g, "-") || intent.vendor || null);
      const diversified = diversifyResults(preDiv, {
        maxPerVendor: hasVendorLock ? 80 : 8,
        topSlice: 40,
        totalLimit: 100,
        queryTerms,
        vendorFilter: vendorLock,
      });


      const responseProducts = diversified.slice(0, 80).map(sanitizeSearchProduct);

      // If room dimensions provided, add fit scores
      if (body.room_dimensions) {
        const roomDims = body.room_dimensions;
        for (const product of responseProducts) {
          let dims = parseDimensions(product.dimensions);
          if (!dims && (product.dimensions_width || product.dimensions_length)) {
            dims = {
              width_in: Number(product.dimensions_width) || 0,
              depth_in: Number(product.dimensions_length) || Number(product.dimensions_depth) || 0,
              height_in: Number(product.dimensions_height) || 0,
            };
            if (dims.width_in === 0 && dims.depth_in === 0) dims = null;
          }
          if (dims) {
            product.fit_score = calculateFitScore(dims, roomDims, product.category);
          }
        }
      }

      // Material badges
      for (const product of responseProducts) {
        product.material_badges = getProductMaterialBadges(product);
      }
      if (body.material_context) {
        for (const product of responseProducts) {
          product.material_score = scoreMaterialFit(product, body.material_context);
        }
      }

      // ── Compute facets ──
      const facets = computeFacets(preDiv);

      const vendorCount = new Set(responseProducts.map(p => p.vendor_name)).size;
      const vectorStats = getVectorStoreStats();

      // Build rich summary including dimension/collection context
      let summary = `Found ${responseProducts.length} products across ${vendorCount} vendors`;
      if (totalBeforeExclude > responseProducts.length) {
        summary += ` (${totalBeforeExclude} total available)`;
      }
      if (aiFilter?.dimensions?.width_max) {
        summary += `. Filtered to ${aiFilter.dimensions.width_max}" wide or less`;
      }
      if (aiFilter?.dimensions?.width_min) {
        summary += `. Showing ${aiFilter.dimensions.width_min}"+ wide`;
      }
      if (aiFilter?.collection) {
        summary += `. Collection: ${aiFilter.collection}`;
      }
      if (aiFilter?.exclude_terms?.length > 0) {
        summary += `. Excluded: ${aiFilter.exclude_terms.join(", ")}`;
      }
      summary += ".";

      const response = {
        query,
        intent,
        ai_filter: aiFilter || null,
        ai_summary: summary,
        total: responseProducts.length,
        total_available: totalBeforeExclude,
        has_more: preDiv.length > responseProducts.length || totalBeforeExclude > (page * 50),
        page,
        result_mode: aiFilterUsed ? "ai-filter" : "keyword-fallback",
        tier_used: tier,
        ai_called: aiCalled,
        cache_hit: false,
        facets,
        diagnostics: {
          ai_filter_used: aiFilterUsed,
          total_catalog_size: getProductCount(),
          vector_indexed: vectorStats.total_vectors,
          tier_used: tier,
          ai_query_calls: getAIQueryStats().calls,
        },
        products: responseProducts,
      };

      // Track analytics (skip bots)
      if (!isBot(req)) {
        trackSearch({
          query,
          resultCount: responseProducts.length,
          vendorIds: [...new Set(responseProducts.map(p => p.vendor_id))],
          tier,
          cacheHit: false,
          ip: reqIp,
        });
        recordSearch(query);
      }

      // Cache for 2 hours
      setCache(cacheKey, response, 2 * 60 * 60 * 1000);

      return json(res, 200, response);
    } // end old search dead code

    if (req.method === "POST" && req.url === "/compare-analyze") {
      const body = await collectBody(req);
      const products = Array.isArray(body.products) ? body.products : [];
      if (products.length < 2) return json(res, 400, { error: "at least 2 products required" });
      const analysis = await withTimeout(aiCompareProducts(products), 30000, null);
      return json(res, 200, { analysis });
    }

    if (req.method === "POST" && req.url === "/quote-narratives") {
      const body = await collectBody(req);
      const products = Array.isArray(body.products) ? body.products : [];
      const projectName = String(body.project_name || "Untitled Project");
      if (products.length === 0) return json(res, 400, { error: "products required" });
      const narratives = await withTimeout(aiGenerateQuoteNarratives(products, projectName), 30000, null);
      return json(res, 200, { narratives });
    }

    if (req.method === "POST" && req.url === "/presentation") {
      const body = await collectBody(req);
      const products = Array.isArray(body.products) ? body.products : [];
      if (products.length === 0) return json(res, 400, { error: "products required" });
      const presentation = await withTimeout(aiGeneratePresentation(products, body.project_context || {}), 30000, null);
      return json(res, 200, { presentation });
    }

    if (req.method === "POST" && req.url === "/vendor-intelligence") {
      const body = await collectBody(req);
      const vendors = Array.isArray(body.vendors) ? body.vendors : priorityVendors;
      let intelligence = await withTimeout(aiVendorIntelligence(vendors, body.catalog_summary || getCatalogSummary()), 30000, null);

      // Fallback: build vendor intelligence from local procurement data when AI is unavailable
      if (!intelligence) {
        const allProcurement = getAllVendorProcurement();
        const vendorCards = Object.values(allProcurement).map((v) => {
          const lt = v.lead_time_weeks;
          const quickWeeks = lt.quick_ship || lt.in_stock || null;
          const standardWeeks = lt.standard || lt.import || 8;
          const leadTimeStr = quickWeeks
            ? `${quickWeeks}-${standardWeeks} weeks`
            : `${standardWeeks} weeks`;

          // Derive tier from trade discount and notes
          let tier = "mid-market";
          const discount = v.trade_discount || "";
          const notes = (v.notes || "").toLowerCase();
          if (notes.includes("ultra high-end") || notes.includes("premium") || notes.includes("trade-only")) {
            tier = "luxury";
          } else if (notes.includes("heritage") || notes.includes("high quality") || discount.includes("40-50%")) {
            tier = "premium";
          } else if (discount.includes("15-20%") || discount.includes("20%")) {
            tier = "value";
          }

          // Build specialties from notes
          const specialties = [];
          if (v.com_col) specialties.push("COM/COL Available");
          if (v.grade_out) specialties.push(`${v.grade_count} Fabric Grades`);
          if (v.stocking_program) specialties.push("Quick-Ship Program");
          if (notes.includes("lighting")) specialties.push("Lighting");
          if (notes.includes("upholster")) specialties.push("Upholstery");
          if (notes.includes("case goods")) specialties.push("Case Goods");
          if (notes.includes("accent")) specialties.push("Accent Furniture");
          if (notes.includes("rattan") || notes.includes("wicker") || notes.includes("natural fiber")) specialties.push("Natural Fibers");
          if (notes.includes("accessories")) specialties.push("Accessories");

          // Strengths
          const strengths = [];
          if (v.stocking_program && v.stocking_note) strengths.push("Strong In-Stock Program");
          if (notes.includes("made in") && (notes.includes("nc") || notes.includes("va"))) strengths.push("American Made");
          if (v.com_col) strengths.push("Custom Material Options");
          if (notes.includes("designer") || notes.includes("trade")) strengths.push("Designer-Friendly");
          if (notes.includes("warranty") || (v.warranty && v.warranty.includes("Lifetime"))) strengths.push("Lifetime Frame Warranty");
          if (notes.includes("free freight") || (v.freight_cost_estimate && v.freight_cost_estimate.includes("free"))) strengths.push("Free Freight Available");

          // Considerations
          const considerations = [];
          if (standardWeeks >= 10) considerations.push("Longer Lead Times");
          if (v.return_policy && v.return_policy.includes("Non-returnable")) considerations.push("Non-Returnable");
          if (v.typical_deposit >= 50) considerations.push(`${v.typical_deposit}% Deposit Required`);
          if (v.minimum_order) considerations.push(v.minimum_order);

          // Determine competitors based on similar notes/specialties
          const competes_with = [];
          for (const [, other] of Object.entries(allProcurement)) {
            if (other.vendor_id === v.vendor_id) continue;
            const otherNotes = (other.notes || "").toLowerCase();
            if (v.com_col && other.com_col && notes.includes("upholster") && otherNotes.includes("upholster")) {
              competes_with.push(other.vendor_name);
            } else if (notes.includes("lighting") && otherNotes.includes("lighting")) {
              competes_with.push(other.vendor_name);
            } else if (notes.includes("accent") && otherNotes.includes("accent")) {
              competes_with.push(other.vendor_name);
            }
            if (competes_with.length >= 3) break;
          }

          // Best for
          let best_for = "General furnishing projects";
          if (notes.includes("slipcovered") || notes.includes("upholster")) best_for = "Custom upholstery projects";
          else if (notes.includes("lighting")) best_for = "Lighting specification";
          else if (notes.includes("accent") && notes.includes("statement")) best_for = "Statement accent pieces";
          else if (notes.includes("coastal") || notes.includes("rattan")) best_for = "Coastal and organic modern projects";
          else if (notes.includes("industrial") || notes.includes("reclaimed")) best_for = "Industrial and modern spaces";

          return {
            id: v.vendor_id,
            name: v.vendor_name,
            tier,
            typical_lead_time: leadTimeStr,
            price_positioning: `Trade discount: ${v.trade_discount}. ${v.payment_terms.map(t => t.replace(/-/g, " ")).join(", ")} accepted.`,
            specialties: specialties.slice(0, 5),
            strengths: strengths.slice(0, 4),
            considerations,
            best_for,
            competes_with: competes_with.slice(0, 3),
          };
        });

        intelligence = {
          industry_context: `Analysis of ${vendorCards.length} trade furniture vendors in our procurement database. Vendors span luxury to mid-market tiers, with lead times ranging from 1-16 weeks. Most offer trade discounts between 40-50% off retail, with strong stocking programs for quick-ship needs.`,
          sourcing_tips: [
            "Compare quick-ship programs across vendors — lead times range from 1-3 weeks for stocked items vs. 8-16 weeks for custom orders.",
            "Vendors offering COM (Customer's Own Material) add 2-4 weeks to lead time but allow full fabric customization.",
            "Many vendors offer free freight on orders over $2,000-$2,500 — consolidate orders to save on shipping costs.",
          ],
          vendors: vendorCards,
        };
      }

      return json(res, 200, { intelligence });
    }

    if (req.method === "POST" && req.url === "/project-analyze") {
      const body = await collectBody(req);
      if (!body.project) return json(res, 400, { error: "project required" });
      const analysis = await withTimeout(aiAnalyzeProject(body.project), 30000, null);
      return json(res, 200, { analysis });
    }

    if (req.method === "POST" && req.url === "/trends") {
      const body = await collectBody(req);
      let trends = await withTimeout(aiTrendAnalysis(body.category || null, body.style || null), 45000, null);

      // Fallback: generate trends from local catalog and material data when AI is unavailable
      if (!trends) {
        const totalProducts = getProductCount();
        const allMaterials = getAllMaterials();
        const materialNames = Object.values(allMaterials).map(m => m.name);

        // Build trending_now from catalog data and real industry knowledge
        const trendingNow = [
          {
            trend: "Performance Fabrics",
            category: "Upholstery",
            momentum: "rising",
            description: "Performance fabrics like Crypton and Revolution are replacing traditional upholstery textiles. They offer stain resistance and durability without sacrificing aesthetics.",
            vendors_leading: ["Lee Industries", "CR Laine", "Bernhardt"],
            search_terms: ["performance fabric sofa", "crypton upholstery", "stain resistant"],
          },
          {
            trend: "Natural & Organic Materials",
            category: "Materials",
            momentum: "rising",
            description: "Rattan, wicker, seagrass, and other natural fibers are surging in popularity for both indoor and outdoor spaces, driven by biophilic design principles.",
            vendors_leading: ["Palecek", "Four Hands", "Serena & Lily"],
            search_terms: ["rattan chair", "wicker furniture", "natural fiber", "seagrass"],
          },
          {
            trend: "Warm Minimalism",
            category: "Style",
            momentum: "peaking",
            description: "Clean lines paired with warm tones and organic textures. This approach balances the simplicity of minimalism with inviting, tactile surfaces.",
            vendors_leading: ["RH", "McGee & Co.", "Made Goods"],
            search_terms: ["warm minimalist", "organic modern", "japandi"],
          },
          {
            trend: "Curved & Sculptural Seating",
            category: "Seating",
            momentum: "rising",
            description: "Curved sofas, barrel chairs, and sculptural accent seating continue to replace boxy silhouettes as designers embrace softer, more organic forms.",
            vendors_leading: ["Century Furniture", "Hickory Chair", "Bernhardt"],
            search_terms: ["curved sofa", "barrel chair", "sculptural seating"],
          },
          {
            trend: "Mixed Metal Finishes",
            category: "Lighting",
            momentum: "stabilizing",
            description: "Combining brass, iron, and nickel finishes within the same space has become an established design practice rather than a bold statement.",
            vendors_leading: ["Visual Comfort", "Arteriors", "Currey & Company"],
            search_terms: ["brass lighting", "mixed metals", "iron chandelier"],
          },
          {
            trend: "Artisan & Handcrafted Pieces",
            category: "Accent Furniture",
            momentum: "rising",
            description: "One-of-a-kind artisan pieces with visible hand-finishing and natural variations are prized as counterpoints to mass production.",
            vendors_leading: ["Noir", "Made Goods", "Palecek"],
            search_terms: ["handcrafted furniture", "artisan table", "hand-finished"],
          },
        ];

        // Filter by category/style if provided
        let filteredTrending = trendingNow;
        if (body.category) {
          const cat = body.category.toLowerCase();
          filteredTrending = trendingNow.filter(t =>
            t.category.toLowerCase().includes(cat) ||
            t.description.toLowerCase().includes(cat) ||
            t.search_terms.some(s => s.includes(cat))
          );
          if (filteredTrending.length === 0) filteredTrending = trendingNow.slice(0, 3);
        }
        if (body.style) {
          const sty = body.style.toLowerCase();
          const styleFiltered = filteredTrending.filter(t =>
            t.description.toLowerCase().includes(sty) ||
            t.trend.toLowerCase().includes(sty)
          );
          if (styleFiltered.length > 0) filteredTrending = styleFiltered;
        }

        trends = {
          trending_now: filteredTrending,
          emerging: [
            {
              trend: "Bouclé & Textured Upholstery",
              description: "Bouclé, sherpa, and heavily textured fabrics are moving from accent pillows to full upholstery on major seating pieces.",
              watch_for: "Watch for bouclé dining chairs and headboards as the next application.",
            },
            {
              trend: "Quiet Luxury Interiors",
              description: "Understated, high-quality materials with no visible branding. Focus on craftsmanship and material quality over logos or trendy patterns.",
              watch_for: "Expect growth in solid-color premium leathers and matte-finish woods.",
            },
            {
              trend: "Indoor-Outdoor Living",
              description: "Performance materials designed for outdoor use are being specified for high-traffic indoor rooms, blurring traditional indoor-outdoor boundaries.",
              watch_for: "Sunbrella and similar outdoor fabrics on indoor dining chairs and family room sofas.",
            },
          ],
          declining: [
            "Farmhouse Shiplap",
            "All-Gray Interiors",
            "Mirrored Furniture",
            "Heavy Traditional Ornamentation",
            "Ultra-Glossy Finishes",
          ],
          color_forecast: [
            { name: "Warm Clay", hex: "#C67B5C", usage: "Accent walls, upholstery" },
            { name: "Olive Grove", hex: "#6B7C4E", usage: "Case goods, accent pieces" },
            { name: "Midnight Navy", hex: "#1B2A4A", usage: "Statement seating, cabinetry" },
            { name: "Soft Ivory", hex: "#F5F0E8", usage: "Primary upholstery, walls" },
            { name: "Burnished Brass", hex: "#B8953E", usage: "Hardware, lighting fixtures" },
            { name: "Stone Gray", hex: "#A09B93", usage: "Rugs, secondary textiles" },
          ],
          material_spotlight: `Our catalog tracks ${materialNames.length} material categories including ${materialNames.slice(0, 5).join(", ")}. Performance fabrics lead in durability with ratings of 8-9/10 and 15+ year expected lifespans. Natural materials like solid hardwood and marble remain premium choices for longevity and resale value. Sustainable materials are increasingly requested by design clients.`,
          designer_tip: `With ${totalProducts} products across our catalog, consider mixing vendor price tiers — pair premium upholstery from heritage makers like Century or Lee Industries with value-driven accent pieces from Four Hands or Noir to balance project budgets while maintaining quality where it matters most.`,
        };
      }

      return json(res, 200, { trends });
    }

    if (req.method === "POST" && req.url === "/extract-product") {
      const body = await collectBody(req);
      if (!body.page_content) return json(res, 400, { error: "page_content required" });
      const extracted = await withTimeout(aiExtractProduct(body.page_content, body.source_url || null), 20000, null);
      return json(res, 200, { extracted });
    }

    if (req.method === "POST" && req.url === "/chat") {
      const rl = checkRateLimit(reqIp + ":chat", 20);
      if (!rl.allowed) return json(res, 429, { error: "Too many requests. Please wait a moment.", retry_after: rl.retryAfter });
      const body = await collectBody(req);
      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (messages.length === 0) return json(res, 400, { error: "messages required" });
      const reply = await withTimeout(aiChat(messages), 60000, { message: "Request timed out. Please try again.", products: null });
      return json(res, 200, { reply });
    }

    if (req.method === "POST" && req.url === "/visual-search") {
      const rl = checkRateLimit(reqIp + ":visual", 10);
      if (!rl.allowed) return json(res, 429, { error: "Too many requests. Please wait a moment.", retry_after: rl.retryAfter });
      const body = await collectBody(req);

      if (!body.image) return json(res, 400, { error: "image (base64) required" });

      // Use the new visual search pipeline — same fieldMatch + vector ranking as text search
      const result = await withTimeout(
        visualSearchPipeline(body.image, body.mime_type || "image/jpeg"),
        30000,
        { query: "[visual search]", products: [], total: 0, error: "Visual search timed out" }
      );

      // Sanitize products for both single and room modes
      if (result.result_mode === "visual-room" && result.items) {
        result.items = result.items.map(item => ({
          ...item,
          products: (item.products || []).map(sanitizeSearchProduct),
        }));
      } else if (result.products) {
        result.products = result.products.map(sanitizeSearchProduct);
      }
      return json(res, 200, result);
    }

    if (req.method === "POST" && req.url === "/room-plan") {
      const rl = checkRateLimit(reqIp + ":room", 10);
      if (!rl.allowed) return json(res, 429, { error: "Too many requests. Please wait a moment.", retry_after: rl.retryAfter });
      const body = await collectBody(req);
      const plan = await withTimeout(aiRoomPlan(body), 120000, null);
      return json(res, 200, { plan });
    }

    if (req.method === "POST" && req.url === "/design-brief") {
      const rl = checkRateLimit(reqIp + ":brief", 15);
      if (!rl.allowed) return json(res, 429, { error: "Too many requests. Please wait a moment.", retry_after: rl.retryAfter });
      const body = await collectBody(req);
      const brief = await withTimeout(aiDesignBrief(body), 45000, null);
      return json(res, 200, { brief });
    }

    // ── Why This Piece — AI design justification ──
    if (req.method === "POST" && req.url === "/why-this-piece") {
      const rl = checkRateLimit(reqIp + ":justify", 30);
      if (!rl.allowed) return json(res, 429, { error: "Too many requests.", retry_after: rl.retryAfter });
      const body = await collectBody(req);

      const { product, room_products, room_name } = body;
      if (!product) return json(res, 400, { error: "product required" });

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return json(res, 500, { error: "AI not configured" });

      // Build product description from AI tags
      const describeProd = (p) => {
        const parts = [p.product_name || "Unknown"];
        if (p.manufacturer_name) parts.push(`by ${p.manufacturer_name}`);
        const tags = [];
        if (p.ai_furniture_type) tags.push(p.ai_furniture_type);
        if (p.ai_style) tags.push(`${p.ai_style} style`);
        if (p.ai_primary_material) tags.push(p.ai_primary_material);
        if (p.ai_primary_color) tags.push(p.ai_primary_color);
        if (p.ai_silhouette) tags.push(`${p.ai_silhouette} silhouette`);
        if (p.ai_formality) tags.push(p.ai_formality);
        if (p.ai_arm_style) tags.push(`${p.ai_arm_style} arms`);
        if (p.ai_back_style) tags.push(`${p.ai_back_style} back`);
        if (p.ai_leg_style) tags.push(`${p.ai_leg_style} legs`);
        if (p.ai_scale) tags.push(`${p.ai_scale} scale`);
        if (p.material) tags.push(`material: ${p.material}`);
        if (p.dimensions) tags.push(`dimensions: ${p.dimensions}`);
        if (p.ai_mood) tags.push(`${p.ai_mood} mood`);
        if (tags.length > 0) parts.push(`(${tags.join(", ")})`);
        return parts.join(" ");
      };

      const otherProducts = (room_products || [])
        .filter(rp => rp.id !== product.id)
        .map(describeProd);

      const prompt = `You are writing a design justification for a client presentation. The designer selected this product:

${describeProd(product)}

${otherProducts.length > 0 ? `It is in ${room_name ? `the "${room_name}" room` : "a room"} with these other pieces:
${otherProducts.map((d, i) => `${i + 1}. ${d}`).join("\n")}` : "This is the first piece selected for the room."}

Write 2-3 sentences explaining WHY this piece was selected for this room. Sound like a confident interior designer presenting to a client. Reference how it complements the other pieces (if any), what makes this specific piece the right choice, and how it contributes to the overall design vision. Be specific about actual product features — material, construction, scale, finish. Do NOT sound like a salesperson. Do NOT use generic praise.`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": apiKey },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 300,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) return json(res, 500, { error: "AI call failed" });
        const data = await resp.json();
        const justification = data.content?.[0]?.text || "";
        return json(res, 200, { justification, product_id: product.id });
      } catch (err) {
        return json(res, 500, { error: "AI call failed: " + err.message });
      }
    }

    // ── Generate All justifications in one call ──
    if (req.method === "POST" && req.url === "/why-this-piece-batch") {
      const rl = checkRateLimit(reqIp + ":justify-batch", 10);
      if (!rl.allowed) return json(res, 429, { error: "Too many requests.", retry_after: rl.retryAfter });
      const body = await collectBody(req);

      const { products, room_name } = body;
      if (!Array.isArray(products) || products.length === 0) return json(res, 400, { error: "products array required" });

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return json(res, 500, { error: "AI not configured" });

      const describeProd = (p) => {
        const parts = [p.product_name || "Unknown"];
        if (p.manufacturer_name) parts.push(`by ${p.manufacturer_name}`);
        const tags = [];
        if (p.ai_furniture_type) tags.push(p.ai_furniture_type);
        if (p.ai_style) tags.push(`${p.ai_style} style`);
        if (p.ai_primary_material) tags.push(p.ai_primary_material);
        if (p.ai_primary_color) tags.push(p.ai_primary_color);
        if (p.ai_silhouette) tags.push(`${p.ai_silhouette} silhouette`);
        if (p.ai_formality) tags.push(p.ai_formality);
        if (p.ai_arm_style) tags.push(`${p.ai_arm_style} arms`);
        if (p.ai_scale) tags.push(`${p.ai_scale} scale`);
        if (p.material) tags.push(`material: ${p.material}`);
        if (p.ai_mood) tags.push(`${p.ai_mood} mood`);
        if (tags.length > 0) parts.push(`(${tags.join(", ")})`);
        return parts.join(" ");
      };

      const productList = products.map((p, i) => `${i + 1}. ${describeProd(p)}`).join("\n");

      const prompt = `You are writing design justifications for a client presentation. The designer has curated these pieces for ${room_name ? `the "${room_name}" room` : "a room"}:

${productList}

For EACH product, write 2-3 sentences explaining WHY it was selected. Sound like a confident interior designer presenting to a high-end client. Reference how each piece complements the others, what makes it the right choice, and how it contributes to the overall design vision. Be specific about actual product features. Do NOT sound like a salesperson.

Return JSON array:
[
  { "product_index": 0, "justification": "..." },
  { "product_index": 1, "justification": "..." }
]`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": apiKey },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1500,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) return json(res, 500, { error: "AI call failed" });
        const data = await resp.json();
        const text = data.content?.[0]?.text || "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return json(res, 500, { error: "AI returned invalid format" });
        const justifications = JSON.parse(jsonMatch[0]);
        return json(res, 200, { justifications });
      } catch (err) {
        return json(res, 500, { error: "AI call failed: " + err.message });
      }
    }

    // Old AI autocomplete replaced by local autocomplete (see /autocomplete handler below)

    if (req.method === "POST" && req.url === "/weekly-digest") {
      const rl = checkRateLimit(reqIp + ":digest", 5);
      if (!rl.allowed) return json(res, 429, { error: "Too many requests. Please wait a moment.", retry_after: rl.retryAfter });
      const body = await collectBody(req);
      let digest = await withTimeout(aiWeeklyDigest(body), 60000, null);

      // Fallback: generate digest from local catalog and analytics data when AI is unavailable
      if (!digest) {
        const analytics = getAnalyticsDashboard();
        const totalProducts = getProductCount();
        const allProducts = getAllProducts();

        // Get the current week date range
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekOfStr = weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

        // Pick editor's picks from actual catalog products (diverse selection)
        const editorPicks = [];
        const seenVendors = new Set();
        const shuffled = [...allProducts].sort(() => Math.random() - 0.5);
        for (const p of shuffled) {
          const vendorName = p.vendor_name || p.manufacturer_name || "Unknown";
          if (seenVendors.has(vendorName)) continue;
          seenVendors.add(vendorName);
          editorPicks.push({
            product_name: p.product_name || p.name || p.title || "Untitled Product",
            vendor_name: vendorName,
            image_url: p.image_url || p.images?.[0] || null,
            retail_price: p.retail_price ? `$${Number(p.retail_price).toLocaleString()}` : (p.wholesale_price ? `$${Number(p.wholesale_price).toLocaleString()}` : null),
            why_picked: p.description ? p.description.slice(0, 120) : "A standout piece from our curated trade catalog.",
            product_url: p.product_url || p.url || null,
          });
          if (editorPicks.length >= 6) break;
        }

        // Build trending searches from analytics or provide defaults
        let trendingSearches = [];
        if (analytics.top_queries && analytics.top_queries.length > 0) {
          trendingSearches = analytics.top_queries.slice(0, 10).map(q => q.query);
        } else {
          trendingSearches = [
            "performance fabric sofa",
            "rattan dining chair",
            "brass chandelier",
            "marble coffee table",
            "velvet accent chair",
            "walnut dining table",
            "boucle chair",
            "console table",
            "linen sofa",
            "modern bookcase",
          ];
        }

        digest = {
          week_of: weekOfStr,
          headline: `This week's catalog spans ${totalProducts} products across ${seenVendors.size}+ trade vendors — from heritage American upholstery makers to curated modern accent brands.`,
          editor_picks: editorPicks,
          trending_searches: trendingSearches,
          industry_news: [
            {
              headline: "Performance Fabrics Now Account for Majority of Trade Upholstery Orders",
              summary: "Interior designers report that performance fabrics like Crypton, Revolution, and Sunbrella have overtaken traditional textiles in new upholstery orders, driven by demand for durability without compromising aesthetics.",
              source: "Trade Industry Report",
            },
            {
              headline: "Lead Times Stabilizing Across Major Domestic Manufacturers",
              summary: "After years of pandemic-era delays, most domestic furniture manufacturers have returned to pre-2020 lead times of 6-10 weeks for standard orders. Quick-ship programs continue to expand.",
              source: "Furniture Today",
            },
          ],
          new_collections: [
            {
              vendor: "Four Hands",
              collection: "Spring Collection",
              description: "Expanded warehouse-stocked program with 200+ new SKUs in reclaimed and industrial styles, most shipping within 1-2 weeks.",
            },
            {
              vendor: "Lee Industries",
              collection: "Performance Living",
              description: "New quick-ship frames available in curated performance fabrics with 3-4 week delivery, expanding their stain-resistant family room offerings.",
            },
          ],
          personalized: [
            {
              recommendation: "Explore quick-ship programs for time-sensitive projects",
              reason: `${Object.values(getAllVendorProcurement()).filter(v => v.stocking_program).length} of our tracked vendors offer in-stock programs with 1-3 week shipping.`,
            },
            {
              recommendation: "Compare COM options across upholstery vendors",
              reason: `${Object.values(getAllVendorProcurement()).filter(v => v.com_col).length} vendors in our database accept Customer's Own Material — lead time additions range from 1-4 weeks.`,
            },
          ],
          pro_tip: "When sourcing for a full project, order long-lead custom upholstery first (8-14 weeks), then fill in with quick-ship accent furniture and lighting (1-3 weeks). This parallel approach can cut overall project timelines by 4-6 weeks.",
        };
      }

      return json(res, 200, { digest });
    }

    // ── CONVERSATIONAL SEARCH — Same pure vector pipeline with conversation history ──
    if (req.method === "POST" && req.url === "/conversational-search") {
      const body = await collectBody(req);

      // Follow-up refinements do NOT count as separate searches
      // But user must have had at least one search in the session (or be a subscriber)
      const identity = await getRequestIdentity(req, body);

      // Block only if completely unauthorized (no free searches ever, no subscription)
      if (identity.userId) {
        const status = getUserStatus(identity.userId);
        if (status === "trial_expired") {
          // Expired users can't use conversational search (Pro feature)
          return json(res, 402, {
            error: "subscription_required",
            status: "trial_expired",
            reason: "Pro subscription required for conversational search",
          });
        }
      }

      const conversation = Array.isArray(body.conversation) ? body.conversation.slice(-20) : [];
      const sessionId = String(body.session_id || `cs-${Date.now()}`);

      if (conversation.length === 0) {
        return json(res, 400, { error: "conversation array required" });
      }

      const lastUserMsg = [...conversation].reverse().find(m => m.role === "user");
      const queryText = lastUserMsg?.content || "";

      // Pure AI vector pipeline — full conversation sent to Haiku
      const result = await searchPipeline(queryText, { conversation });
      const responseProducts = result.products.map(sanitizeSearchProduct);

      // Follow-ups do NOT increment guest search counter

      return json(res, 200, {
        intent: result.intent,
        ai_summary: result.ai_summary,
        assistant_message: result.assistant_message,
        action: "search",
        action_params: null,
        products: responseProducts,
        total: responseProducts.length,
        diagnostics: {
          ...result.diagnostics,
          action: "search",
          previous_results_count: 0,
        },
        session_id: sessionId,
      });
    }

    // ── BULK IMPORT ENDPOINTS ─────────────────────────────────

    if (req.method === "POST" && req.url === "/catalog/bulk-import") {
      const body = await collectBody(req);
      const vendorIds = Array.isArray(body.vendor_ids) ? body.vendor_ids : undefined;
      const maxTier = Number(body.max_tier) || 4;
      const methods = Array.isArray(body.methods) ? body.methods : ["shopify", "feed", "api", "sitemap"];
      const concurrentVendors = Number(body.concurrent_vendors) || 3;

      // Run async — respond immediately with status
      runBulkImport(catalogDBInterface, { vendor_ids: vendorIds, max_tier: maxTier, methods, concurrent_vendors: concurrentVendors })
        .catch((err) => console.error("[bulk-import] Error:", err.message));

      return json(res, 202, {
        ok: true,
        message: "Bulk import started. Poll GET /catalog/import-status for progress.",
      });
    }

    if (req.method === "GET" && req.url === "/catalog/import-status") {
      const raw = getImportStatus();
      const summary = {
        running: raw.running,
        progress: raw.progress ? {
          status: raw.progress.status,
          vendors_total: raw.progress.vendors_total,
          vendors_completed: raw.progress.vendors_completed,
          products_before: raw.progress.products_before,
          products_after: raw.progress.products_after,
          vendor_results: (raw.progress.vendor_results || []).map(vr => ({
            vendor_id: vr.vendor_id,
            vendor_name: vr.vendor_name,
            tier: vr.tier,
            total_products: vr.total_products,
            methods_succeeded: vr.methods_succeeded,
          })),
        } : null,
        catalog_total: getProductCount(),
      };
      return json(res, 200, summary);
    }

    if (req.method === "POST" && req.url === "/catalog/import-csv") {
      // Accepts raw CSV text in body
      const rawBody = await new Promise((resolve, reject) => {
        let raw = "";
        req.on("data", (chunk) => { raw += chunk; });
        req.on("end", () => resolve(raw));
        req.on("error", reject);
      });

      // Try to parse as JSON first (for { csv_text, vendor_id, vendor_name } format)
      let csvText, vendorId, vendorName;
      try {
        const parsed = JSON.parse(rawBody);
        csvText = parsed.csv_text || parsed.csv || parsed.data;
        vendorId = parsed.vendor_id;
        vendorName = parsed.vendor_name;
      } catch {
        // Assume raw CSV
        csvText = rawBody;
      }

      if (!csvText || csvText.trim().length < 10) {
        return json(res, 400, { error: "CSV data required. Send as JSON { csv_text, vendor_id?, vendor_name? } or raw CSV body." });
      }

      const result = importFromCsv(csvText, { vendor_id: vendorId, vendor_name: vendorName }, catalogDBInterface);
      return json(res, 200, { ok: true, ...result });
    }

    // ── SMART AUTOCOMPLETE (local, zero API cost) ──
    if (req.method === "POST" && req.url === "/autocomplete") {
      const body = await collectBody(req);
      const query = String(body.query || body.partial || "").trim();
      if (!query || query.length < 2) return json(res, 200, { suggestions: [], details: [] });
      const results = smartAutocomplete(query, 8);
      return json(res, 200, { suggestions: results.map(r => r.text), details: results });
    }

    // ── ANALYTICS ENDPOINTS ──
    if (req.method === "GET" && req.url === "/analytics") {
      const dashboard = getAnalyticsDashboard();
      return json(res, 200, dashboard);
    }

    if (req.method === "POST" && req.url === "/analytics/click") {
      const body = await collectBody(req);
      if (body.product_id) trackClick(body.product_id, body.vendor_id);
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && req.url === "/analytics/compare") {
      const body = await collectBody(req);
      if (body.product_id) trackCompare(body.product_id);
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && req.url === "/analytics/quote") {
      const body = await collectBody(req);
      if (body.product_id) trackQuote(body.product_id);
      return json(res, 200, { ok: true });
    }

    // ── CATEGORY TREE ──
    if (req.method === "GET" && req.url === "/categories") {
      return json(res, 200, { categories: getCategoryTree() });
    }

    // ── BACKGROUND JOBS ──
    if (req.method === "POST" && req.url === "/jobs/verify-images") {
      runImageVerification(catalogDBInterface, { cacheImages: false, batchSize: 25, delayMs: 200 }).catch(err => console.error("[image-verifier] Error:", err.message));
      return json(res, 202, { ok: true, message: "Image verification job started. Poll GET /jobs/status for progress." });
    }

    if (req.method === "POST" && req.url === "/jobs/dedup") {
      runDeduplication(catalogDBInterface).then(() => {
        // Rebuild autocomplete after dedup
        buildAutocompleteIndex(getAllProducts());
      }).catch(err => console.error("[dedup] Error:", err.message));
      return json(res, 202, { ok: true, message: "Deduplication job started." });
    }

    if (req.method === "POST" && req.url === "/jobs/enrich") {
      const body = await collectBody(req);
      runEnrichment(catalogDBInterface, {
        maxProducts: Number(body.max_products) || 20000,
        batchSize: Number(body.batch_size) || 10,
      }).then(() => {
        recomputeAllQualityScores();
        buildAutocompleteIndex(getAllProducts());
      }).catch(err => console.error("[enrichment] Error:", err.message));
      return json(res, 202, { ok: true, message: "Enrichment job started." });
    }

    if (req.method === "POST" && req.url === "/jobs/photo-analyze") {
      const body = await collectBody(req);
      const vendors = Array.isArray(body.vendors) ? body.vendors : undefined;
      runPhotoAnalysis(catalogDBInterface, { vendors }).then(() => {
        // Rebuild index after analysis to pick up new visual tags in search
        const allProds = getAllProducts();
        // Re-index products with new visual tags
        for (const p of allProds) {
          if (p.ai_visual_tags) {
            // Trigger re-index by re-inserting (updateProductDirect already saved tags)
          }
        }
        clearSearchCache();
        console.log("[photo-analyzer] Search cache cleared, visual tags now searchable");
      }).catch(err => console.error("[photo-analyzer] Error:", err.message));
      return json(res, 202, { ok: true, message: "Photo analysis job started. Poll GET /jobs/status for progress." });
    }

    // ── Visual Tagger ──
    if (req.method === "POST" && req.url === "/admin/visual-tagger/start") {
      const body = await collectBody(req);
      const opts = {
        vendors: Array.isArray(body.vendors) ? body.vendors : undefined,
        batchSize: Number(body.batch_size) || undefined,
        delayMs: Number(body.delay_ms) || undefined,
        maxProducts: Number(body.max_products) || undefined,
        dryRun: body.dry_run === true,
        skipTagged: body.skip_tagged !== false,
      };
      runVisualTagger(catalogDBInterface, opts).then(() => {
        clearSearchCache();
        console.log("[visual-tagger] Search cache cleared, visual tags now searchable");
      }).catch(err => console.error("[visual-tagger] Error:", err.message));
      return json(res, 202, { ok: true, message: "Visual tagger job started.", status_url: "/admin/visual-tagger/status" });
    }

    if (req.method === "GET" && req.url === "/admin/visual-tagger/status") {
      return json(res, 200, getVisualTaggerStatus());
    }

    if (req.method === "POST" && req.url === "/admin/visual-tagger/stop") {
      stopVisualTagger();
      return json(res, 200, { ok: true, message: "Visual tagger stop requested." });
    }

    // ── Image Fixer ──
    if (req.method === "POST" && req.url === "/admin/image-fixer/start") {
      const body = await collectBody(req);
      runImageFixer(catalogDBInterface, {
        dryRun: body.dry_run || false,
        batchSize: body.batch_size || 10,
        delayMs: body.delay_ms || 500,
        vendorFilter: body.vendor_filter || null,
      }).then(() => {
        clearSearchCache();
        console.log("[image-fixer] Search cache cleared after image fixes");
      }).catch(err => console.error("[image-fixer] Error:", err.message));
      return json(res, 202, { ok: true, message: "Image fixer started.", status_url: "/admin/image-fixer/status" });
    }

    if (req.method === "GET" && req.url === "/admin/image-fixer/status") {
      return json(res, 200, getImageFixerStatus());
    }

    if (req.method === "POST" && req.url === "/admin/image-fixer/stop") {
      stopImageFixer();
      return json(res, 200, { ok: true, message: "Image fixer stop requested." });
    }

    // Dry-run scan only (fast, no changes)
    if (req.method === "POST" && req.url === "/admin/image-fixer/scan") {
      const body = await collectBody(req);
      runImageFixer(catalogDBInterface, {
        dryRun: true,
        vendorFilter: body.vendor_filter || null,
      }).catch(err => console.error("[image-fixer] Scan error:", err.message));
      return json(res, 202, { ok: true, message: "Image scan started (dry run).", status_url: "/admin/image-fixer/status" });
    }

    // ── Bernhardt Importer ──
    if (req.method === "POST" && req.url === "/admin/bernhardt/start") {
      const body = await collectBody(req);
      importBernhardt(catalogDBInterface, {
        enrichDetails: body.enrich_details !== false,
        batchSize: body.batch_size || 3,
        delayMs: body.delay_ms || 1000,
      }).then(() => {
        clearSearchCache();
        console.log("[bernhardt] Search cache cleared");
      }).catch(err => console.error("[bernhardt] Error:", err.message));
      return json(res, 202, { ok: true, message: "Bernhardt import started.", status_url: "/admin/bernhardt/status" });
    }

    if (req.method === "GET" && req.url === "/admin/bernhardt/status") {
      return json(res, 200, getBernhardtStatus());
    }

    if (req.method === "POST" && req.url === "/admin/bernhardt/stop") {
      stopBernhardt();
      return json(res, 200, { ok: true, message: "Bernhardt import stop requested." });
    }

    // ── Cleanup bad enrichment data ──
    if (req.method === "POST" && req.url === "/admin/deep-enrichment/cleanup") {
      let cleaned = 0;
      for (const product of getAllProducts()) {
        if (product.page_status === 200 && product.dimensions && /cssanimation|borderradius|boxshadow/i.test(product.dimensions)) {
          updateProductDirect(product.id, {
            dimensions: null, width: null, depth: null, height: null,
            material: null, frame_material: null, fill_type: null, spring_system: null,
            leg_finish: null, top_material: null, wood_species: null, metal_finish: null,
            features: null, style: null, style_tags: null, room_types: null,
            seat_height: null, seat_depth: null, arm_height: null,
            page_status: null, last_crawled_at: null,
          });
          cleaned++;
        }
      }
      clearSearchCache();
      return json(res, 200, { ok: true, cleaned });
    }

    // ── Deep Enrichment ──
    if (req.method === "POST" && req.url === "/admin/deep-enrichment/start") {
      const body = await collectBody(req);
      runDeepEnrichment(catalogDBInterface, {
        batchSize: body.batch_size || 5,
        delayMs: body.delay_ms || 800,
        vendorFilter: body.vendor_filter || null,
      }).then(() => {
        clearSearchCache();
        console.log("[deep-enrichment] Search cache cleared after enrichment");
      }).catch(err => console.error("[deep-enrichment] Error:", err.message));
      return json(res, 202, { ok: true, message: "Deep enrichment started.", status_url: "/admin/deep-enrichment/status" });
    }

    if (req.method === "GET" && req.url === "/admin/deep-enrichment/status") {
      return json(res, 200, getDeepEnrichmentStatus());
    }

    if (req.method === "POST" && req.url === "/admin/deep-enrichment/stop") {
      stopDeepEnrichment();
      return json(res, 200, { ok: true, message: "Deep enrichment stop requested." });
    }

    // ── Catalog Cleanup endpoints ────────────────────────
    if (req.method === "POST" && req.url === "/admin/catalog-cleanup/start") {
      const body = await collectBody(req);
      const options = {
        checkImageUrls: body?.checkImageUrls ?? true,
        httpCheckSample: body?.httpCheckSample ?? 2000,
        brokenImageVendors: body?.brokenImageVendors || [],
      };
      runCatalogCleanup(catalogDBInterface, options).catch(err =>
        console.error("[catalog-cleanup] Error:", err)
      );
      return json(res, 202, { ok: true, message: "Catalog cleanup started.", status_url: "/admin/catalog-cleanup/status" });
    }

    if (req.method === "GET" && req.url === "/admin/catalog-cleanup/status") {
      return json(res, 200, getCatalogCleanupStatus());
    }

    if (req.method === "POST" && req.url === "/admin/catalog-cleanup/stop") {
      stopCatalogCleanup();
      return json(res, 200, { ok: true, message: "Catalog cleanup stop requested." });
    }

    // ── Missing Vendors Import endpoints ──────────────
    if (req.method === "POST" && req.url === "/admin/missing-vendors/start") {
      importMissingVendors(catalogDBInterface).catch(err =>
        console.error("[missing-vendors] Error:", err)
      );
      return json(res, 202, { ok: true, message: "Missing vendors import started.", status_url: "/admin/missing-vendors/status" });
    }

    if (req.method === "GET" && req.url === "/admin/missing-vendors/status") {
      return json(res, 200, getMissingVendorsStatus());
    }

    if (req.method === "POST" && req.url === "/admin/missing-vendors/stop") {
      stopMissingVendors();
      return json(res, 200, { ok: true, message: "Missing vendors import stop requested." });
    }

    // ── Theodore Alexander Import endpoints ──────────────
    if (req.method === "POST" && req.url === "/admin/theodore-alexander/start") {
      importTheodoreAlexander(catalogDBInterface).catch(err =>
        console.error("[theodore-alexander] Error:", err)
      );
      return json(res, 202, { ok: true, message: "Theodore Alexander import started.", status_url: "/admin/theodore-alexander/status" });
    }

    if (req.method === "GET" && req.url === "/admin/theodore-alexander/status") {
      return json(res, 200, getTheodoreAlexanderStatus());
    }

    if (req.method === "POST" && req.url === "/admin/theodore-alexander/stop") {
      stopTheodoreAlexander();
      return json(res, 200, { ok: true, message: "Theodore Alexander import stop requested." });
    }

    // ── Rowe Furniture Import ──
    if (req.method === "POST" && req.url === "/admin/rowe/start") {
      importRowe(catalogDBInterface).then(() => {
        clearSearchCache();
        console.log("[rowe] Search cache cleared after import");
      }).catch(err => console.error("[rowe] Error:", err.message));
      return json(res, 202, { ok: true, message: "Rowe import started.", status_url: "/admin/rowe/status" });
    }

    if (req.method === "GET" && req.url === "/admin/rowe/status") {
      return json(res, 200, getRoweStatus());
    }

    if (req.method === "POST" && req.url === "/admin/rowe/stop") {
      stopRowe();
      return json(res, 200, { ok: true, message: "Rowe import stop requested." });
    }

    // ── Verellen Import ──
    if (req.method === "POST" && (req.url === "/admin/verellen/start" || req.url === "/admin/import/verellen")) {
      importVerellen(catalogDBInterface).then(() => {
        clearSearchCache();
        console.log("[verellen] Search cache cleared after import");
      }).catch(err => console.error("[verellen] Error:", err.message));
      return json(res, 202, { ok: true, message: "Verellen import started.", status_url: "/admin/verellen/status" });
    }

    if (req.method === "GET" && (req.url === "/admin/verellen/status" || req.url === "/admin/import/verellen/status")) {
      return json(res, 200, getVerellenStatus());
    }

    if (req.method === "POST" && req.url === "/admin/verellen/stop") {
      stopVerellen();
      return json(res, 200, { ok: true, message: "Verellen import stop requested." });
    }

    if (req.method === "POST" && req.url === "/admin/baker/start") {
      importBaker(catalogDBInterface).then(r => console.log("[baker] Import finished:", r.phase))
        .catch(e => console.error("[baker] Import error:", e));
      return json(res, 202, { ok: true, message: "Baker import started.", status_url: "/admin/baker/status" });
    }

    if (req.method === "GET" && req.url === "/admin/baker/status") {
      return json(res, 200, getBakerStatus());
    }

    if (req.method === "POST" && req.url === "/admin/baker/stop") {
      stopBaker();
      return json(res, 200, { ok: true, message: "Baker import stop requested." });
    }

    if (req.method === "POST" && req.url === "/admin/hancock-moore/start") {
      importHancockMoore(catalogDBInterface).then(r => console.log("[hm] Import finished:", r.phase))
        .catch(e => console.error("[hm] Import error:", e));
      return json(res, 202, { ok: true, message: "Hancock & Moore import started.", status_url: "/admin/hancock-moore/status" });
    }

    if (req.method === "GET" && req.url === "/admin/hancock-moore/status") {
      return json(res, 200, getHancockMooreStatus());
    }

    if (req.method === "POST" && req.url === "/admin/hancock-moore/stop") {
      stopHancockMoore();
      return json(res, 200, { ok: true, message: "Hancock & Moore import stop requested." });
    }

    if (req.method === "POST" && req.url === "/admin/cr-laine/start") {
      importCRLaine(catalogDBInterface).then(r => console.log("[crl] Import finished:", r.phase))
        .catch(e => console.error("[crl] Import error:", e));
      return json(res, 202, { ok: true, message: "CR Laine import started.", status_url: "/admin/cr-laine/status" });
    }

    if (req.method === "GET" && req.url === "/admin/cr-laine/status") {
      return json(res, 200, getCRLaineStatus());
    }

    if (req.method === "POST" && req.url === "/admin/cr-laine/stop") {
      stopCRLaine();
      return json(res, 200, { ok: true, message: "CR Laine import stop requested." });
    }

    if (req.method === "GET" && req.url === "/jobs/status") {
      return json(res, 200, {
        image_verification: getImageVerificationStatus(),
        deduplication: getDedupStatus(),
        enrichment: getEnrichmentStatus(),
        photo_analysis: getPhotoAnalysisStatus(),
        visual_tagger: getVisualTaggerStatus(),
        image_fixer: getImageFixerStatus(),
        deep_enrichment: getDeepEnrichmentStatus(),
        catalog_cleanup: getCatalogCleanupStatus(),
      });
    }

    if (req.method === "POST" && req.url === "/jobs/stop") {
      stopImageVerification();
      stopEnrichment();
      stopPhotoAnalysis();
      stopVisualTagger();
      return json(res, 200, { ok: true, message: "Stop signals sent to running jobs." });
    }

    // ── VECTOR STORE ENDPOINTS ──
    if (req.method === "GET" && req.url === "/vectors/stats") {
      return json(res, 200, getVectorStoreStats());
    }

    if (req.method === "POST" && req.url === "/vectors/reindex") {
      const body = await collectBody(req);
      const reindex = body.reindex === true;
      vectorIndexAll(getAllProducts(), { reindex }).then((stats) => {
        console.log(`[server] Vector reindex complete: ${stats.total} total, ${stats.new} new`);
      }).catch((err) => console.error(`[server] Vector reindex failed: ${err.message}`));
      return json(res, 202, { ok: true, message: "Vector reindexing started in background." });
    }

    if (req.method === "POST" && req.url === "/catalog/import-vendor") {
      const body = await collectBody(req);
      const vendorId = String(body.vendor_id || "");
      if (!vendorId) return json(res, 400, { error: "vendor_id required" });

      const methods = Array.isArray(body.methods) ? body.methods : ["shopify", "feed", "api", "sitemap"];

      // Find vendor in unified list
      const allVendors = tradeVendors;
      const tv = allVendors.find((v) => v.id === vendorId);
      if (!tv) return json(res, 404, { error: `Vendor not found: ${vendorId}` });

      const profileMap = new Map();
      for (const v of priorityVendors) profileMap.set(v.id, v);
      const profile = profileMap.get(tv.id);

      const vendor = {
        ...tv,
        profile: profile?.profile || {},
        discovery: profile?.discovery || {},
        shopify_domain: profile?.shopify_domain || null,
      };

      // Run import (async for sitemap, sync for shopify/feed/api)
      const result = await importVendor(vendor, catalogDBInterface, methods);
      return json(res, 200, { ok: true, ...result, catalog_total: getProductCount() });
    }

    // ── Sourcing Brain Endpoints ──────────────────────────────

    // Room templates
    if (req.method === "GET" && req.url === "/room-templates") {
      return json(res, 200, { templates: getAllRoomTemplates() });
    }

    if (req.method === "GET" && req.url.startsWith("/room-templates/")) {
      const parts = req.url.slice("/room-templates/".length).split("/");
      const type = decodeURIComponent(parts[0] || "");
      const size = decodeURIComponent(parts[1] || "");
      if (!type || !size) return json(res, 400, { error: "Usage: /room-templates/:type/:size" });
      const template = getRoomTemplate(type, size);
      if (!template) return json(res, 404, { error: `No template for ${type}/${size}` });
      return json(res, 200, { template });
    }

    // Project CRUD
    if (req.method === "POST" && req.url === "/projects/intake") {
      const body = await collectBody(req);
      const description = String(body.description || "").trim();
      if (!description) return json(res, 400, { error: "description required" });

      let parsed = null;
      try {
        parsed = await withTimeout(aiParseProjectIntake(description), 30000, null);
      } catch { /* AI unavailable, fall through to local parser */ }

      // Fallback: parse project description locally when AI is unavailable
      if (!parsed) {
        const lower = description.toLowerCase();

        // Extract budget
        const budgetMatch = lower.match(/\$\s?([\d,]+(?:\.\d{2})?)\s*k?\b/);
        let budgetTotal = 0;
        if (budgetMatch) {
          budgetTotal = parseFloat(budgetMatch[1].replace(/,/g, ""));
          if (lower.includes("k") && budgetTotal < 1000) budgetTotal *= 1000;
        }

        // Extract style
        const styleMap = {
          "mid-century": "mid-century-modern", "mid century": "mid-century-modern", mcm: "mid-century-modern",
          modern: "modern", minimalist: "minimalist", coastal: "coastal",
          traditional: "traditional", bohemian: "bohemian", boho: "bohemian",
          industrial: "industrial", farmhouse: "farmhouse", transitional: "transitional",
          japandi: "japandi", "art deco": "art-deco", scandinavian: "scandinavian",
        };
        let style = "modern";
        for (const [keyword, value] of Object.entries(styleMap)) {
          if (lower.includes(keyword)) { style = value; break; }
        }

        // Extract rooms from description
        const roomPatterns = [
          { regex: /living\s*room/i, type: "living-room" },
          { regex: /bedroom/i, type: "bedroom" },
          { regex: /dining\s*(room|area)/i, type: "dining-room" },
          { regex: /office|study/i, type: "home-office" },
          { regex: /entry|foyer|mudroom/i, type: "entryway" },
          { regex: /nursery|kid/i, type: "nursery" },
          { regex: /media|theater/i, type: "media-room" },
          { regex: /outdoor|patio|deck/i, type: "outdoor" },
        ];
        const rooms = [];
        const bedroomMatch = lower.match(/(\d+)\s*(?:-\s*)?bed(?:room)?/);
        if (bedroomMatch) {
          const count = Math.min(parseInt(bedroomMatch[1]), 6);
          for (let i = 0; i < count; i++) {
            rooms.push({ name: `Bedroom ${i + 1}`, type: "bedroom", size: i === 0 ? "large" : "medium" });
          }
        }
        for (const { regex, type } of roomPatterns) {
          if (regex.test(description) && !rooms.some(r => r.type === type)) {
            rooms.push({ name: type.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()), type, size: "medium" });
          }
        }
        if (rooms.length === 0) {
          rooms.push({ name: "Living Room", type: "living-room", size: "medium" });
        }

        // Extract timeline
        const weeksMatch = lower.match(/(\d+)\s*(?:week|wk)/);
        const monthsMatch = lower.match(/(\d+)\s*month/);
        let weeks = 12;
        if (weeksMatch) weeks = parseInt(weeksMatch[1]);
        else if (monthsMatch) weeks = parseInt(monthsMatch[1]) * 4;

        // Extract client name
        const clientMatch = description.match(/(?:client|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);

        parsed = {
          name: clientMatch ? `${clientMatch[1]} Project` : "New Project",
          client_name: clientMatch ? clientMatch[1] : "",
          style,
          budget: { total: budgetTotal, currency: "USD" },
          timeline: { weeks, urgency: weeks <= 6 ? "urgent" : "normal" },
          rooms,
          vendor_preferences: [],
          notes: description,
        };
      }

      // Create the project
      const startDate = new Date().toISOString().split("T")[0];
      const weeks = parsed.timeline?.weeks || 12;
      const targetDate = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const project = createProject({
        name: parsed.name,
        client_name: parsed.client_name,
        style: parsed.style,
        budget: { total: parsed.budget?.total || 0, currency: parsed.budget?.currency || "USD" },
        timeline: { start: startDate, target_completion: targetDate, weeks, urgency: parsed.timeline?.urgency || "normal", status: "planning" },
        vendor_preferences: parsed.vendor_preferences || [],
        notes: parsed.notes || "",
      });

      // Auto-populate rooms with templates
      for (const room of (parsed.rooms || [])) {
        const template = getRoomTemplate(room.type, room.size);
        const items = [];
        if (template) {
          for (const item of template.essential) {
            items.push({
              name: item.item,
              priority: item.priority,
              status: "sourcing",
              search_query: parsed.style ? `${parsed.style} ${item.search}` : item.search,
              qty: item.qty,
            });
          }
          for (const item of template.optional) {
            items.push({
              name: item.item,
              priority: item.priority,
              status: "sourcing",
              search_query: parsed.style ? `${parsed.style} ${item.search}` : item.search,
              qty: item.qty,
            });
          }
        }
        addRoomToProject(project.id, {
          name: room.name,
          type: room.type,
          size: room.size,
          items,
        });
      }

      // Refetch to get populated rooms
      const fullProject = getProject(project.id);
      return json(res, 201, { project: fullProject, parsed_intake: parsed });
    }

    if (req.method === "POST" && req.url === "/projects") {
      const body = await collectBody(req);
      const project = createProject(body);
      return json(res, 201, { project });
    }

    if (req.method === "GET" && req.url === "/projects") {
      return json(res, 200, { projects: listProjects() });
    }

    // Share token lookup (must be before /projects/:id to avoid conflicts)
    if (req.method === "GET" && req.url.startsWith("/share/")) {
      const token = decodeURIComponent(req.url.slice("/share/".length));
      const project = getProjectByShareToken(token);
      if (!project) return json(res, 404, { error: "Invalid or expired share token" });
      return json(res, 200, { project });
    }

    // Project-level routes with :id
    if (req.url.startsWith("/projects/")) {
      const urlWithoutQuery = req.url.split("?")[0];
      const pathParts = urlWithoutQuery.slice("/projects/".length).split("/");
      const projectId = decodeURIComponent(pathParts[0]);

      // GET /projects/:id
      if (req.method === "GET" && pathParts.length === 1) {
        const project = getProject(projectId);
        if (!project) return json(res, 404, { error: "Project not found" });
        return json(res, 200, { project });
      }

      // PUT /projects/:id
      if (req.method === "PUT" && pathParts.length === 1) {
        const body = await collectBody(req);
        const project = updateProject(projectId, body);
        if (!project) return json(res, 404, { error: "Project not found" });
        return json(res, 200, { project });
      }

      // DELETE /projects/:id
      if (req.method === "DELETE" && pathParts.length === 1) {
        const deleted = deleteProject(projectId);
        if (!deleted) return json(res, 404, { error: "Project not found" });
        return json(res, 200, { ok: true });
      }

      // POST /projects/:id/rooms
      if (req.method === "POST" && pathParts[1] === "rooms" && pathParts.length === 2) {
        const body = await collectBody(req);
        // Auto-populate items from room template if none provided
        if (!body.items || body.items.length === 0) {
          const template = getRoomTemplate(body.type || "living-room", body.size || "medium");
          if (template) {
            const project = getProject(projectId);
            const styleMod = project?.style ? project.style.replace(/-/g, " ") : "";
            body.items = [...template.essential, ...template.optional].map((t) => ({
              name: t.item,
              priority: t.priority,
              search_query: styleMod ? `${styleMod} ${t.search}` : t.search,
              qty: t.qty,
              status: "sourcing",
            }));
          }
        }
        const room = addRoomToProject(projectId, body);
        if (!room) return json(res, 404, { error: "Project not found" });
        return json(res, 201, { room });
      }

      // PUT /projects/:id/rooms/:roomId/items/:itemId
      if (req.method === "PUT" && pathParts[1] === "rooms" && pathParts[3] === "items" && pathParts.length === 5) {
        const roomId = decodeURIComponent(pathParts[2]);
        const itemId = decodeURIComponent(pathParts[4]);
        const body = await collectBody(req);
        const item = updateRoomItem(projectId, roomId, itemId, body);
        if (!item) return json(res, 404, { error: "Project, room, or item not found" });
        return json(res, 200, { item });
      }

      // POST /projects/:id/rooms/:roomId/auto-source
      if (req.method === "POST" && pathParts[1] === "rooms" && pathParts[3] === "auto-source" && pathParts.length === 4) {
        const roomId = decodeURIComponent(pathParts[2]);
        const project = getProject(projectId);
        if (!project) return json(res, 404, { error: "Project not found" });
        const room = project.rooms.find((r) => r.id === roomId);
        if (!room) return json(res, 404, { error: "Room not found" });

        const styleDNA = getStyleDNA(project.style);
        let sourcedCount = 0;

        for (const item of room.items) {
          if (item.status !== "sourcing") continue;

          let query = item.search_query || item.name;
          // Add style modifiers if not already present
          if (project.style && !query.toLowerCase().includes(project.style)) {
            query = `${project.style} ${query}`;
          }

          try {
            const results = searchCatalogDB(query, {}, 10);
            if (results.length > 0) {
              item.options = results.slice(0, 5).map(sanitizeSearchProduct);
              item.status = "options-ready";
              sourcedCount++;
            }
          } catch (err) {
            console.error(`[auto-source] Failed for "${item.name}": ${err.message}`);
          }
        }

        // Persist changes
        updateProject(projectId, { rooms: project.rooms });

        return json(res, 200, {
          room,
          sourced_count: sourcedCount,
          total_items: room.items.length,
        });
      }

      // POST /projects/:id/style-check
      if (req.method === "POST" && pathParts[1] === "style-check" && pathParts.length === 2) {
        const project = getProject(projectId);
        if (!project) return json(res, 404, { error: "Project not found" });
        if (!project.style) return json(res, 400, { error: "Project has no style set" });

        // Gather all selected products
        const selectedProducts = [];
        for (const room of project.rooms) {
          for (const item of room.items) {
            if (item.selected_product) {
              selectedProducts.push(item.selected_product);
            }
          }
        }

        if (selectedProducts.length === 0) {
          return json(res, 200, {
            coherence: { score: 100, issues: [], materialConflicts: [], colorConflicts: [], suggestions: ["No products selected yet — nothing to check."] },
            products_checked: 0,
          });
        }

        const coherence = checkStyleCoherence(selectedProducts, project.style);
        return json(res, 200, { coherence, products_checked: selectedProducts.length });
      }

      // POST /projects/:id/share
      if (req.method === "POST" && pathParts[1] === "share" && pathParts.length === 2) {
        const token = getProjectShareToken(projectId);
        if (!token) return json(res, 404, { error: "Project not found" });
        return json(res, 200, { share_token: token, share_url: `/share/${token}` });
      }

      // GET /projects/:id/cost-summary
      if (req.method === "GET" && pathParts[1] === "cost-summary" && pathParts.length === 2) {
        const project = getProject(projectId);
        if (!project) return json(res, 404, { error: "Project not found" });

        const roomBreakdown = [];
        let totalSpent = 0;
        let totalItems = 0;
        let sourcedItems = 0;
        let selectedItems = 0;

        for (const room of project.rooms) {
          let roomSpent = 0;
          const roomItems = room.items.length;
          let roomSourced = 0;
          let roomSelected = 0;

          for (const item of room.items) {
            totalItems++;
            if (item.status !== "sourcing") roomSourced++;
            if (item.selected_product) {
              roomSelected++;
              selectedItems++;
              const price = item.selected_product.retail_price || item.selected_product.price || 0;
              roomSpent += price * (item.qty || 1);
            }
            if (item.status !== "sourcing") sourcedItems++;
          }

          totalSpent += roomSpent;
          roomBreakdown.push({
            room_id: room.id,
            room_name: room.name,
            room_budget: room.budget,
            spent: Math.round(roomSpent * 100) / 100,
            remaining: room.budget > 0 ? Math.round((room.budget - roomSpent) * 100) / 100 : null,
            items: roomItems,
            sourced: roomSourced,
            selected: roomSelected,
          });
        }

        const suggestions = [];
        if (project.budget.total > 0 && totalSpent > project.budget.total * 0.9) {
          suggestions.push("Budget is over 90% spent. Consider reviewing selections for cost savings.");
        }
        for (const rb of roomBreakdown) {
          if (rb.room_budget > 0 && rb.spent > rb.room_budget) {
            suggestions.push(`${rb.room_name} is over budget by $${Math.round(rb.spent - rb.room_budget)}.`);
          }
        }

        return json(res, 200, {
          project_budget: project.budget.total,
          total_spent: Math.round(totalSpent * 100) / 100,
          total_remaining: Math.round((project.budget.total - totalSpent) * 100) / 100,
          currency: project.budget.currency || "USD",
          total_items: totalItems,
          sourced_items: sourcedItems,
          selected_items: selectedItems,
          rooms: roomBreakdown,
          suggestions,
        });
      }
    }

    // ── Spatial Intelligence Endpoints ──────────────────────────

    // Parse dimensions from text
    if (req.method === "POST" && req.url === "/spatial/parse-dimensions") {
      const body = await collectBody(req);
      if (body.products) {
        const results = batchParseDimensions(body.products);
        return json(res, 200, { results });
      }
      const text = String(body.text || "").trim();
      if (!text) return json(res, 400, { error: "text or products required" });
      const parsed = parseDimensions(text);
      return json(res, 200, { dimensions: parsed });
    }

    // Check product fit in a room
    if (req.method === "POST" && req.url === "/spatial/check-fit") {
      const body = await collectBody(req);
      if (!body.product || !body.room) return json(res, 400, { error: "product and room required" });
      const result = checkProductFit(body.product, body.room);
      return json(res, 200, { fit: result });
    }

    // Calculate fit scores for multiple products
    if (req.method === "POST" && req.url === "/spatial/fit-scores") {
      const body = await collectBody(req);
      if (!body.products || !body.room) return json(res, 400, { error: "products and room required" });
      const scores = {};
      for (const product of body.products) {
        const dims = product.dimensions ? parseDimensions(product.dimensions) : product;
        if (dims) {
          scores[product.id] = calculateFitScore(dims, body.room, product.category);
        }
      }
      return json(res, 200, { scores });
    }

    // Check delivery feasibility
    if (req.method === "POST" && req.url === "/spatial/delivery-check") {
      const body = await collectBody(req);
      if (!body.product) return json(res, 400, { error: "product required" });
      let dims = body.product;
      if (body.product.dimensions && typeof body.product.dimensions === "string") {
        dims = parseDimensions(body.product.dimensions);
        if (!dims) return json(res, 400, { error: "Could not parse dimensions" });
      }
      const result = checkDeliveryFeasibility(dims, body.constraints || {});
      return json(res, 200, { delivery: result });
    }

    // Suggest proportional companion pieces
    if (req.method === "POST" && req.url === "/spatial/suggest-proportions") {
      const body = await collectBody(req);
      if (!body.main_piece || !body.companion_category) return json(res, 400, { error: "main_piece and companion_category required" });
      const result = suggestProportions(body.main_piece, body.companion_category, body.room || {});
      return json(res, 200, { suggestion: result });
    }

    // Get spatial rules reference
    if (req.method === "GET" && req.url === "/spatial/rules") {
      return json(res, 200, { rules: getSpatialRules() });
    }

    // Generate room layout
    if (req.method === "POST" && req.url === "/spatial/generate-layout") {
      const body = await collectBody(req);
      if (!body.room || !body.pieces) return json(res, 400, { error: "room and pieces required" });
      const layout = generateLayout(body.room, body.pieces);
      return json(res, 200, { layout });
    }

    // Generate floor plan SVG
    if (req.method === "POST" && req.url === "/spatial/floor-plan") {
      const body = await collectBody(req);
      if (!body.room || !body.pieces) return json(res, 400, { error: "room and pieces required" });
      const layout = generateLayout(body.room, body.pieces);
      const svg = generateFloorPlanSVG(body.room, layout.placements || [], body.options || {});
      return json(res, 200, { layout, svg });
    }

    // Generate scale comparison SVG
    if (req.method === "POST" && req.url === "/spatial/scale-compare") {
      const body = await collectBody(req);
      if (!body.products || !Array.isArray(body.products)) return json(res, 400, { error: "products array required" });
      const svg = generateScaleComparisonSVG(body.products, body.options || {});
      return json(res, 200, { svg });
    }

    // Recommend room size for furniture set
    if (req.method === "POST" && req.url === "/spatial/recommend-room-size") {
      const body = await collectBody(req);
      if (!body.pieces || !Array.isArray(body.pieces)) return json(res, 400, { error: "pieces array required" });
      const recommendation = recommendRoomSize(body.pieces);
      return json(res, 200, { recommendation });
    }

    // ── Material Intelligence Endpoints ──────────────────────────

    // Get all materials
    if (req.method === "GET" && req.url === "/materials") {
      return json(res, 200, { materials: getAllMaterials() });
    }

    // Get material info (fuzzy matched)
    if (req.method === "GET" && req.url.startsWith("/materials/") && !req.url.includes("/match") && !req.url.includes("/check") && !req.url.includes("/compare") && !req.url.includes("/badges") && !req.url.includes("/scores")) {
      const name = decodeURIComponent(req.url.slice("/materials/".length));
      const material = getMaterial(name);
      if (!material) return json(res, 404, { error: `Material not found: ${name}` });
      return json(res, 200, { material });
    }

    // Match product materials
    if (req.method === "POST" && req.url === "/materials/match") {
      const body = await collectBody(req);
      if (!body.product) return json(res, 400, { error: "product required" });
      const matches = matchProductMaterial(body.product);
      return json(res, 200, { matches });
    }

    // Check material suitability
    if (req.method === "POST" && req.url === "/materials/check") {
      const body = await collectBody(req);
      if (!body.material) return json(res, 400, { error: "material required" });
      const result = checkMaterialSuitability(body.material, body.context || {});
      return json(res, 200, { suitability: result });
    }

    // Compare two materials
    if (req.method === "POST" && req.url === "/materials/compare") {
      const body = await collectBody(req);
      if (!body.material1 || !body.material2) return json(res, 400, { error: "material1 and material2 required" });
      const result = compareMaterials(body.material1, body.material2, body.context || {});
      return json(res, 200, { comparison: result });
    }

    // Get material badges for a product
    if (req.method === "POST" && req.url === "/materials/badges") {
      const body = await collectBody(req);
      if (!body.product) return json(res, 400, { error: "product required" });
      const badges = getProductMaterialBadges(body.product);
      return json(res, 200, { badges });
    }

    // Batch material scores for search results
    if (req.method === "POST" && req.url === "/materials/scores") {
      const body = await collectBody(req);
      if (!body.products || !Array.isArray(body.products)) return json(res, 400, { error: "products array required" });
      const scores = {};
      for (const product of body.products) {
        scores[product.id] = {
          score: scoreMaterialFit(product, body.context || {}),
          badges: getProductMaterialBadges(product),
        };
      }
      return json(res, 200, { scores });
    }

    // ── Procurement Intelligence Endpoints ──────────────────────

    // Get all vendor procurement data
    if (req.method === "GET" && req.url === "/procurement") {
      return json(res, 200, { vendors: getAllVendorProcurement() });
    }

    // Check COM availability for vendor
    if (req.method === "GET" && req.url.match(/^\/procurement\/[^/]+\/com$/)) {
      const vendorId = decodeURIComponent(req.url.split("/")[2]);
      const result = checkCOMAvailability(vendorId);
      if (!result) return json(res, 404, { error: `Vendor not found: ${vendorId}` });
      return json(res, 200, { com: result });
    }

    // Get vendor procurement info (fuzzy matched)
    if (req.method === "GET" && req.url.startsWith("/procurement/") && !req.url.includes("/com")) {
      const vendorId = decodeURIComponent(req.url.slice("/procurement/".length));
      const vendor = getVendorProcurement(vendorId);
      if (!vendor) return json(res, 404, { error: `Vendor not found: ${vendorId}` });
      return json(res, 200, { vendor });
    }

    // Get procurement info for a product
    if (req.method === "POST" && req.url === "/procurement/product") {
      const body = await collectBody(req);
      if (!body.product) return json(res, 400, { error: "product required" });
      const result = getProductProcurement(body.product);
      return json(res, 200, { procurement: result });
    }

    // Estimate full cost
    if (req.method === "POST" && req.url === "/procurement/estimate-cost") {
      const body = await collectBody(req);
      if (!body.product) return json(res, 400, { error: "product required" });
      const estimate = estimateFullCost(body.product, body.delivery_zip || null);
      return json(res, 200, { estimate });
    }

    // COM yardage estimate
    if (req.method === "POST" && req.url === "/procurement/com-yardage") {
      const body = await collectBody(req);
      if (!body.category) return json(res, 400, { error: "category required" });
      const estimate = estimateCOMYardage(body.category, body.width_in || null);
      return json(res, 200, { estimate });
    }

    // ── POST /discover — Visual discovery endpoint ──
    if (req.method === "POST" && req.url === "/discover") {
      const body = await collectBody(req);
      const colors = Array.isArray(body.colors) ? body.colors : [];
      const textures = Array.isArray(body.textures) ? body.textures : [];
      const vibes = Array.isArray(body.vibes) ? body.vibes : [];
      const room_type = String(body.room_type || "");
      const page = Math.max(1, Number(body.page) || 1);

      const COLOR_MAP = {
        "warm-neutrals": ["beige","cream","tan","camel","ivory","sand","wheat","champagne"],
        "cool-neutrals": ["gray","charcoal","slate","silver","pewter","smoke","ash"],
        "earth-tones": ["terracotta","rust","olive","sage","moss","brown","copper","sienna","umber"],
        "jewel-tones": ["emerald","navy","burgundy","plum","sapphire","ruby","teal","amethyst"],
        "pastels": ["blush","powder blue","lavender","mint","rose","peach","lilac","soft pink"],
        "monochromes": ["black","white","ivory","espresso","ebony","snow","charcoal"],
      };
      const TEXTURE_MAP = {
        "smooth-polished": ["leather","marble","lacquer","glass","chrome","polished","metal"],
        "soft-plush": ["velvet","boucle","chenille","mohair","plush","shearling","fur"],
        "natural-organic": ["linen","rattan","raw wood","jute","stone","oak","walnut","teak","bamboo","seagrass"],
        "woven-tactile": ["cane","wicker","rope","performance fabric","woven","knit","macrame"],
      };
      const VIBE_MAP = {
        "clean-quiet": ["modern","contemporary","minimal","scandinavian","japanese"],
        "warm-collected": ["transitional","traditional","layered","eclectic","warm"],
        "bold-dramatic": ["glam","bold","art deco","maximalist","hollywood"],
        "coastal-relaxed": ["coastal","beach","resort","bohemian","casual","relaxed"],
        "heritage-classic": ["traditional","classic","english","european","french","colonial"],
      };
      const ROOM_MAP = {
        "living-room": "sofa OR chair OR coffee table OR side table OR console",
        "dining-room": "dining table OR dining chair OR sideboard OR buffet",
        "bedroom": "bed OR nightstand OR dresser OR chest OR bench",
        "office": "desk OR office chair OR bookcase OR shelving",
        "outdoor": "outdoor",
        "entryway": "console OR mirror OR bench OR coat rack",
      };

      // Gather all matched terms
      const colorTerms = colors.flatMap(c => COLOR_MAP[c] || []);
      const textureTerms = textures.flatMap(t => TEXTURE_MAP[t] || []);
      const vibeTerms = vibes.flatMap(v => VIBE_MAP[v] || []);
      const roomQuery = ROOM_MAP[room_type] || "";

      // Build search query from representative subset (2-3 from each)
      const pick = (arr, n) => arr.slice(0, n);
      const queryParts = [
        ...pick(colorTerms, 3),
        ...pick(textureTerms, 3),
        ...pick(vibeTerms, 3),
        roomQuery,
      ].filter(Boolean);
      const searchQuery = queryParts.join(" ");

      // Build filters
      const filters = {};
      if (textureTerms.length > 0) filters.materials = textureTerms;
      if (vibeTerms.length > 0) filters.styles = vibeTerms;

      // Pass 1: text search
      let searchResults = [];
      if (searchQuery) {
        searchResults = searchCatalogDB(searchQuery, filters, 200);
      }

      // Pass 2: direct field matching against all products
      const allProducts = getAllProducts();
      const colorSet = new Set(colorTerms.map(t => t.toLowerCase()));
      const textureSet = new Set(textureTerms.map(t => t.toLowerCase()));
      const vibeSet = new Set(vibeTerms.map(t => t.toLowerCase()));
      const allTerms = new Set([...colorSet, ...textureSet, ...vibeSet]);

      const fieldMatched = allProducts.filter(p => {
        if (!p.ai_furniture_type) return false; // Tagged-only: require ai_furniture_type
        const pColor = (p.color || "").toLowerCase();
        const pMaterial = (p.material || "").toLowerCase();
        const pStyle = (p.style || "").toLowerCase();
        const pTags = Array.isArray(p.tags) ? p.tags.map(t => t.toLowerCase()) : [];
        for (const term of allTerms) {
          if (pColor.includes(term) || pMaterial.includes(term) || pStyle.includes(term) || pTags.some(tag => tag.includes(term))) {
            return true;
          }
        }
        return false;
      });

      // Merge and deduplicate
      const seenIds = new Set();
      const merged = [];
      for (const p of [...searchResults, ...fieldMatched]) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          merged.push(p);
        }
      }

      // Sort: image_verified first, then by quality_score descending
      merged.sort((a, b) => {
        const aVerified = a.image_verified ? 1 : 0;
        const bVerified = b.image_verified ? 1 : 0;
        if (bVerified !== aVerified) return bVerified - aVerified;
        return (b.quality_score || 0) - (a.quality_score || 0);
      });

      // Paginate (60 per page)
      const perPage = 60;
      const start = (page - 1) * perPage;
      const pageProducts = merged.slice(start, start + perPage);

      // Compute facets from full result set
      const facets = computeFacets(merged);

      return json(res, 200, {
        products: pageProducts.map(sanitizeSearchProduct),
        total: merged.length,
        page,
        has_more: start + perPage < merged.length,
        facets,
      });
    }

    // ── GET /collections — List all collections ──
    if (req.method === "GET" && req.url.startsWith("/collections")) {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const pathname = parsedUrl.pathname;

      // GET /collections/:collectionName
      if (pathname.startsWith("/collections/") && pathname !== "/collections/") {
        const collectionName = decodeURIComponent(pathname.slice("/collections/".length));
        const allProducts = getAllProducts();
        const collectionProducts = allProducts.filter(p => p.collection === collectionName);
        return json(res, 200, {
          collection: collectionName,
          products: collectionProducts.map(sanitizeSearchProduct),
          total: collectionProducts.length,
        });
      }

      // GET /collections
      const vendorFilter = parsedUrl.searchParams.get("vendor") || "";
      const allProducts = getAllProducts();
      const collectionMap = new Map();

      for (const p of allProducts) {
        if (!p.collection) continue;
        if (vendorFilter && p.vendor_id !== vendorFilter) continue;
        if (!collectionMap.has(p.collection)) {
          collectionMap.set(p.collection, []);
        }
        collectionMap.get(p.collection).push(p);
      }

      const collections = [];
      for (const [name, products] of collectionMap) {
        const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
        const styles = [...new Set(products.map(p => p.style).filter(Boolean))];
        const materials = [...new Set(products.map(p => p.material).filter(Boolean))];
        const colorsArr = [...new Set(products.map(p => p.color).filter(Boolean))];
        const prices = products.map(p => p.retail_price || p.wholesale_price).filter(Boolean);
        const verifiedImages = products
          .filter(p => p.image_verified && p.image_url)
          .map(p => p.image_url)
          .slice(0, 6);

        collections.push({
          name,
          vendor_name: products[0].vendor_name || null,
          vendor_id: products[0].vendor_id || null,
          product_count: products.length,
          categories,
          styles,
          materials,
          colors: colorsArr,
          price_range: prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
          sample_images: verifiedImages,
        });
      }

      collections.sort((a, b) => b.product_count - a.product_count);

      return json(res, 200, { collections, total: collections.length });
    }

    // ── POST /style-profile — Compute visual taste profile ──
    if (req.method === "POST" && req.url === "/style-profile") {
      const body = await collectBody(req);
      const interactions = Array.isArray(body.interactions) ? body.interactions : [];

      const colorCounts = {};
      const materialCounts = {};
      const styleCounts = {};
      const vendorCounts = {};
      const categoryCounts = {};
      const prices = [];

      for (const interaction of interactions) {
        const product = getProduct(String(interaction.product_id || ""));
        if (!product) continue;

        if (product.color) colorCounts[product.color] = (colorCounts[product.color] || 0) + 1;
        if (product.material) materialCounts[product.material] = (materialCounts[product.material] || 0) + 1;
        if (product.style) styleCounts[product.style] = (styleCounts[product.style] || 0) + 1;
        if (product.vendor_name) vendorCounts[product.vendor_name] = (vendorCounts[product.vendor_name] || 0) + 1;
        if (product.category) categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
        const price = product.retail_price || product.wholesale_price;
        if (price) prices.push(price);
      }

      const toSorted = (counts) => Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);

      return json(res, 200, {
        colors: toSorted(colorCounts),
        materials: toSorted(materialCounts),
        styles: toSorted(styleCounts),
        vendors: toSorted(vendorCounts).map(v => ({ name: v.value, count: v.count })),
        avg_price: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
        price_range: prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
        categories: toSorted(categoryCounts),
        total_interactions: interactions.length,
      });
    }

    return notFound(res, req.url);
  } catch (error) {
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      return json(res, 413, { error: "Payload too large. Maximum body size is 1MB." });
    }
    return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, host, () => {
  console.log(`[server] Listening on http://${host}:${port} (PORT=${port})`);

  // Run heavy init AFTER listening so Railway sees the port immediately
  runHeavyInit().then(() => {
    // Only start crawl scheduler if explicitly enabled (disable on production to save resources)
    if (process.env.ENABLE_CRAWL_SCHEDULER === "true") {
      startCrawlScheduler(catalogDBInterface);
    } else {
      console.log("[server] Crawl scheduler disabled (set ENABLE_CRAWL_SCHEDULER=true to enable)");
    }

    // Schedule image verification every 6 hours
    setInterval(() => {
      runImageVerification(catalogDBInterface, { batchSize: 15, delayMs: 300 })
        .catch(err => console.error("[server] Image verification failed:", err.message));
    }, 6 * 60 * 60 * 1000);

    // Background health check every 6 hours
    setTimeout(() => {
      runCatalogHealthCheck(getAllProducts);
      console.log("[admin] Initial health check complete.");
    }, 30_000); // 30s after startup

    setInterval(() => {
      runCatalogHealthCheck(getAllProducts);
      console.log("[admin] Scheduled health check complete.");
    }, 6 * 60 * 60 * 1000);
  }).catch((err) => {
    console.error(`[server] Heavy init failed: ${err.message}`);
  });
});

function queueLiveWarmup() {
  setTimeout(async () => {
    try {
      await ingestVendors({
        mode: "live",
        vendorIds: liveWarmVendorIds,
      });
      console.log(`search-service live warmup completed for ${liveWarmVendorIds.join(", ")}`);
    } catch (error) {
      console.error("search-service live warmup failed:", error instanceof Error ? error.message : String(error));
    }
  }, 250);
}

function filterSearchableProducts(products, body) {
  if (body.allow_seed_results) return products;
  return products.filter((product) => product.ingestion_source === "live-crawler" || product.ingestion_source === "live-discovery");
}

function getSearchMode(body) {
  const mode = String(body.search_mode || "").toLowerCase();
  if (["verified-only", "balanced", "catalog-only"].includes(mode)) {
    return mode;
  }
  return "balanced";
}

function shouldRefreshVerifiedCatalog(verifiedCatalog) {
  const updatedAt = verifiedCatalog?.updated_at ? Date.parse(verifiedCatalog.updated_at) : NaN;
  if (!Number.isFinite(updatedAt)) return true;
  return Date.now() - updatedAt > 1000 * 60 * 30;
}

function dedupeProducts(products) {
  const seen = new Map();
  for (const product of products) {
    const key = [product.vendor_id, product.product_url || product.product_name].join("::").toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, product);
    }
  }
  return Array.from(seen.values());
}

/**
 * Check if a product image URL is a real product photo (not a logo, placeholder, or banner).
 */
function hasValidProductImage(url) {
  if (!url || url.length < 15) return false;
  const lower = url.toLowerCase();
  // Reject known non-product patterns
  if (/logo|placeholder|no.?image|default|spacer|blank/i.test(lower)) return false;
  // Reject website banners/headers/cluster images
  if (/header|mid-cluster|hp_.*cluster|essentials-/i.test(lower)) return false;
  // Reject SVG files (almost always logos/icons)
  if (lower.endsWith('.svg')) return false;
  // Reject swatches, fabric samples, finish samples, lifestyle/room scenes
  if (/swatch|fabric[_-]?sample|finish[_-]?sample|detail[_-]?shot|lifestyle|room[_-]?scene|collection[_-]?hero|catalog[_-]?page|pattern[_-]?tile/i.test(lower)) return false;
  // Reject URLs explicitly tagged as non-product image types
  // NOTE: exclude "catalog" from this check — Magento uses /media/catalog/product/ for ALL product images
  if (/[_/-](swatch|fabric|finish|detail|lifestyle|roomscene|collection|pattern)\b/i.test(lower)) return false;
  // Only reject "catalog" when it's clearly a catalog PAGE image, not Magento product path
  if (/catalog[_-](?:page|hero|cover|image)/i.test(lower)) return false;
  // Reject tiny thumbnails (often swatches: 50x50, 100x100)
  if (/[_-](50x50|75x75|100x100|swatch)\./i.test(lower)) return false;
  return true;
}

/** Filter an images array, keeping only valid product images */
function filterProductImages(images) {
  if (!Array.isArray(images) || images.length === 0) return images;
  // Deduplicate URLs first (many products have the hero image repeated 10+ times)
  const seen = new Set();
  const unique = [];
  for (const url of images) {
    if (typeof url === "string" && url && !seen.has(url)) {
      seen.add(url);
      unique.push(url);
    }
  }
  const filtered = unique.filter(url => hasValidProductImage(url));
  return filtered.length > 0 ? filtered : unique.slice(0, 1); // keep at least one
}

function getSearchVendorIds(body) {
  if (Array.isArray(body.vendor_ids) && body.vendor_ids.length > 0) {
    return body.vendor_ids.map(String);
  }
  return priorityVendors.map((vendor) => vendor.id);
}

async function discoverAcrossVariants(queryVariants, options) {
  const settled = await Promise.allSettled(
    queryVariants.slice(0, 4).map((variant) => discoverLiveVendorProducts(variant, options)),
  );
  const results = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.push(...result.value);
    }
  }
  return dedupeProducts(results);
}

async function withTimeout(promise, timeoutMs, fallbackValue) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve(fallbackValue), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function aiParseProjectIntake(description) {
  const headers = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (process.env.ANTHROPIC_API_KEY) {
    headers["x-api-key"] = process.env.ANTHROPIC_API_KEY;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: `You are a furniture sourcing assistant. Parse this project description into structured data.

Description: "${description}"

Return JSON only:
{
  "name": "project name",
  "client_name": "client name if mentioned, else empty string",
  "style": "one of: modern, mid-century-modern, coastal, traditional, minimalist, bohemian, industrial, transitional, japandi, art-deco, scandinavian, farmhouse",
  "rooms": [{ "name": "display name", "type": "living-room|bedroom|dining-room|home-office|entryway|nursery|media-room|outdoor|kitchen|bathroom", "size": "small|medium|large" }],
  "budget": { "total": number or 0, "currency": "USD" },
  "timeline": { "weeks": number or 12, "urgency": "normal|rush|flexible" },
  "vendor_preferences": [],
  "notes": "any additional details"
}` }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
}

// ── Product Data Cleanup Utilities ──────────────────────────────────

/**
 * Clean a product description — remove scraped junk, HTML artifacts, metadata,
 * and normalize to professional prose.
 */
function cleanDescription(desc) {
  if (!desc || typeof desc !== "string") return null;
  let s = desc;

  // Strip HTML tags completely (including img tags with alt text, etc.)
  s = s.replace(/<[^>]+>/g, " ");
  // Strip HTML entities
  s = s.replace(/&[a-z]+;/gi, " ").replace(/&#\d+;/g, " ");

  // Remove raw data/img attributes that survived HTML stripping
  s = s.replace(/data-\w+="[^"]*"/g, "");
  s = s.replace(/alt="[^"]*"/g, "");
  s = s.replace(/class="[^"]*"/g, "");
  s = s.replace(/src="[^"]*"/g, "");

  // Remove SKU/model references
  s = s.replace(/^[A-Z0-9][-A-Z0-9_/]{3,}\s*[-–—]\s*/i, "");

  // Remove "Product | Category | SKU | Brand" catalog header patterns
  s = s.replace(/^[^|]+\|[^|]+\|[^|]+\|[^|]*$/gm, "");

  // Remove COL/COM yardage specs
  s = s.replace(/\bCOL:\s*[\d.]+\s*(sq\s*ft|yards?)\.?/gi, "");
  s = s.replace(/\bCOM:\s*[\d.]+\s*(sq\s*ft|yards?)\.?/gi, "");
  s = s.replace(/\bcushion\s*weight:\s*\d+\s*lbs?\.?/gi, "");
  s = s.replace(/\ballowed\s*patterns?:\s*[A-Z, ]+\.?/gi, "");

  // Remove shipping/logistics metadata
  s = s.replace(/\b(shipping|ships? in|shipping cubes?|cartons?|freight|lead time)[^.]*\.?/gi, "");
  s = s.replace(/\bweight:\s*\d+[\s.]*lbs?\.?/gi, "");
  s = s.replace(/\bcubic\s*(meters?|feet)\b[^.]*\.?/gi, "");
  s = s.replace(/\bquick\s*ship\b[^.]*\.?/gi, "");

  // Remove raw dimension strings embedded in descriptions
  s = s.replace(/\bDimensions?\s*\(inches\)\.?\s*/gi, "");
  s = s.replace(/\bDimension\s+\d+[Ww]\s+\d+[Dd]\s+[\d.]+[Hh]\b/g, "");
  s = s.replace(/\b\d+[Ww]\s+\d+[Dd]\s+[\d.]+[Hh]\s*(in\.?|inches?)?\b/g, "");

  // Remove "Standard Features." "Product Features" headers
  s = s.replace(/\b(standard|product)\s+features?\.?\s*/gi, "");

  // Remove "Rendering shown." / "As Shown:" / "Shown in:" lines
  s = s.replace(/\b(rendering|photograph(ed)?)\s+(shown|in)[^.]*\.?/gi, "");
  s = s.replace(/\bas\s+shown:\s*[^.]*\.?/gi, "");
  s = s.replace(/\bshown\s+(in|with)[^.]*\.?/gi, "");

  // Remove spec lines like "Back Pillows: 2", "Inside: Arm Height: 26"
  s = s.replace(/\b(back\s+pillows|bp\s+cushions|seat\s+cushions):\s*\d+\b[^.]*\.?/gi, "");
  s = s.replace(/\binside:\s*arm\s*height:\s*\d+\b[^.]*\.?/gi, "");
  s = s.replace(/\bseat\s*height\s*:\s*\d+\b[^.]*\.?/gi, "");
  s = s.replace(/\barm\s*height\s*:\s*\d+\b[^.]*\.?/gi, "");

  // Remove "Options Shown:" and similar config lines
  s = s.replace(/\boptions\s*shown\b[^.]*\.?/gi, "");
  s = s.replace(/\bskirt\s*is\s*standard\b\.?/gi, "");
  s = s.replace(/\b(loose\s*pillow\s*back)\s*$/gim, "");

  // Remove vendor catalog page references
  s = s.replace(/\|\s*\w+\s+Home\s+Brands\b/gi, "");

  // Remove "Available sizes:" followed by SKU
  s = s.replace(/\bavailable\s+sizes?:\s*[A-Z0-9][-A-Z0-9_]*\.?/gi, "");

  // Remove "this product is temporarily unavailable" type text
  s = s.replace(/\bthis\s+product\s+is\s+temporarily\s+unavailable[^.]*\.?/gi, "");
  s = s.replace(/\bour\s+team\s+is\s+working[^.]*\.?/gi, "");
  s = s.replace(/\bplease\s+(contact|call|email|reach\s+out)[^.]*\.?/gi, "");
  s = s.replace(/\b(currently\s+)?(out\s+of\s+stock|backordered|discontinued)\b[^.]*\.?/gi, "");

  // Remove repeated comma-separated keyword spam (e.g. ": cc-chair-rc, cc-chair-rc, comfort, comfort")
  s = s.replace(/^:\s*/, "");
  s = s.replace(/\b(\w[-\w]*),\s*\1\b/gi, "$1"); // remove consecutive dupes
  // Detect keyword spam: comma-separated short tokens that look like tags, not sentences
  s = s.split("\n").map(line => {
    const tokens = line.split(",").map(t => t.trim()).filter(Boolean);
    if (tokens.length >= 3) {
      // If most tokens are short single words or SKU-like, it's spam
      const shortTokens = tokens.filter(t => t.length < 20 && t.split(" ").length <= 2);
      if (shortTokens.length >= tokens.length * 0.7) return "";
    }
    return line;
  }).join("\n");

  // Remove lines starting with "+" (item category breadcrumbs)
  s = s.replace(/^\+ .+$/gm, "");

  // Remove spec fragment lists like "Removable Leg/ Fixed Seat Cushion Back Cushion Throw Available"
  s = s.replace(/\b(removable|fixed)\s+(leg|seat|back)\/?[^.]*\b(available|included|optional)\b[^.]*\.?/gi, "");
  // Remove bare feature lists without sentence structure
  s = s.replace(/^(removable|fixed)\s+(leg|seat|back)\b.*$/gim, "");

  // Clean up resulting whitespace
  s = s.replace(/\n{2,}/g, "\n").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim();

  // Remove lines that are just punctuation, very short fragments, or raw specs
  s = s.split("\n").filter(line => {
    const t = line.trim();
    if (t.length <= 5) return false;
    // Skip lines that are just number specs like "90: 42" Depth"
    if (/^\d+:\s*\d+"?\s*\w+$/.test(t)) return false;
    // Skip lines that are just "01: Chair S-Slope Arm" type config
    if (/^\d{2,}:\s*\w/.test(t)) return false;
    return true;
  }).join("\n");

  // If after cleanup the description is empty or too short, return null
  if (!s || s.length < 10) return null;

  return s;
}

/**
 * Parse and normalize dimensions into clean W × D × H format.
 * Extracts width, depth, height from various raw formats.
 */
function parseCleanDimensions(product) {
  const w = product.width;
  const d = product.depth;
  const h = product.height;

  // If we have clean numeric dimensions, use those
  if (w && d && h) {
    // Sanity check: reject obviously wrong values (e.g. 900" width)
    if (w > 200 || d > 200 || h > 200) return null;
    return `${w}"W × ${d}"D × ${h}"H`;
  }

  // Try to parse from raw dimensions string
  const raw = product.dimensions;
  if (!raw || typeof raw !== "string") return null;

  // Common patterns:
  // "W76.14" x D36.06" x H36.22""
  // "W: 81" x D: 39" x H: 35""
  // "88"W x 44"D x 30"H"
  // "L 82" x D 39" x H 37""
  // "99"W x 41"D x 38"H"
  let pw = null, pd = null, ph = null;

  // Pattern 1: W: 81" x D: 39" x H: 35" (with optional colon and spaces)
  const m1 = raw.match(/[WL]:?\s*([\d.]+)"?\s*[×xX]\s*D:?\s*([\d.]+)"?\s*[×xX]\s*H:?\s*([\d.]+)/i);
  if (m1) { pw = parseFloat(m1[1]); pd = parseFloat(m1[2]); ph = parseFloat(m1[3]); }

  // Pattern 2: 88"W x 44"D x 30"H
  if (!pw) {
    const m2 = raw.match(/([\d.]+)"?\s*W\s*[×xX]\s*([\d.]+)"?\s*D\s*[×xX]\s*([\d.]+)"?\s*H/i);
    if (m2) { pw = parseFloat(m2[1]); pd = parseFloat(m2[2]); ph = parseFloat(m2[3]); }
  }

  // Pattern 3: W76.14" x D36.06" x H36.22" (no space between letter and number)
  if (!pw) {
    const m3 = raw.match(/W([\d.]+)"?\s*[×xX]\s*D([\d.]+)"?\s*[×xX]\s*H([\d.]+)/i);
    if (m3) { pw = parseFloat(m3[1]); pd = parseFloat(m3[2]); ph = parseFloat(m3[3]); }
  }

  if (pw && pd && ph) {
    // Sanity check
    if (pw > 200 || pd > 200 || ph > 200) return null;
    // Round to clean values
    const fmt = (n) => Number.isInteger(n) ? `${n}` : `${n.toFixed(1).replace(/\.0$/, "")}`;
    return `${fmt(pw)}"W × ${fmt(pd)}"D × ${fmt(ph)}"H`;
  }

  // Pattern 4: Just width — "W: 81" or "W: 71""
  const mw = raw.match(/[WL]:?\s*([\d.]+)"?/i);
  if (mw) {
    const val = parseFloat(mw[1]);
    if (val > 0 && val < 200) return `${Number.isInteger(val) ? val : val.toFixed(1)}"W`;
  }

  return null;
}

/**
 * Clean product name — remove raw SKU-as-name, title case fixes, etc.
 */
function cleanProductName(name, sku, vendor) {
  if (!name) return null;
  let s = name.trim();

  // If the product name IS just the SKU, return null for AI fallback
  if (sku && s.toLowerCase().replace(/[-_\s]/g, "") === sku.toLowerCase().replace(/[-_\s]/g, "")) {
    return null;
  }

  // If name looks like a raw SKU pattern (all caps/numbers, no real words)
  if (/^[A-Z0-9][-A-Z0-9_/]+$/.test(s) && s.length < 20) {
    return null;
  }

  // Remove leading SKU prefix patterns like "NC7003-PRB-HR " or "CD8600 "
  s = s.replace(/^[A-Z]{1,4}\d{3,}[-A-Z0-9]*\s+/i, "");

  // Remove leading numeric catalog codes like "100X44 " or "112X44 "
  // But keep numbers that are part of real names like "1000 Series"
  s = s.replace(/^\d+[Xx]\d+\s+/, "");

  // Remove "CUSTOM KIT for " prefix
  s = s.replace(/^CUSTOM\s+KIT\s+for\s+/i, "");

  // Fix HTML entities
  s = s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, "");

  // Fix encoding artifacts like "Cr+Ême" → "Crème"
  s = s.replace(/\+Ê/g, "è").replace(/\+É/g, "é");

  // Remove vendor name from product name if it's just prepended
  if (vendor && s.toLowerCase().startsWith(vendor.toLowerCase() + " ")) {
    s = s.slice(vendor.length + 1);
  }

  // Expand common abbreviations for display
  s = s.replace(/\bUph\b/gi, "Upholstered");
  s = s.replace(/\bPwr\b/gi, "Power");
  s = s.replace(/\bRec\b/gi, "Recliner");
  s = s.replace(/\bLaf\b/gi, "Left Arm Facing");
  s = s.replace(/\bRaf\b/gi, "Right Arm Facing");
  s = s.replace(/\bKg\b/g, "King");
  s = s.replace(/\bQn\b/g, "Queen");
  s = s.replace(/\bSr\b/g, "Side Rails");
  s = s.replace(/\bFb\b/g, "Footboard");
  s = s.replace(/\bHb\b/g, "Headboard");
  s = s.replace(/\bRnd\b/gi, "Round");
  s = s.replace(/\bRect\b/gi, "Rectangle");
  s = s.replace(/\bEdg\b/gi, "Edge");
  s = s.replace(/\b1\/2T\b/g, "½ Thick");
  s = s.replace(/\bFlt\b/gi, "Flat");
  s = s.replace(/\bW\/(\w)/g, "with $1");
  s = s.replace(/\bw\/(\w)/g, "with $1");

  // Clean up multiple spaces
  s = s.replace(/\s+/g, " ").trim();

  // Title case if name is ALL CAPS (more than 3 consecutive uppercase words)
  if (/^[A-Z\s&]{10,}$/.test(s)) {
    s = s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  return s || null;
}

/**
 * Clean SKU — standardize format
 */
function cleanSku(sku) {
  if (!sku || typeof sku !== "string") return null;
  let s = sku.trim();
  // Remove "None" or empty
  if (s.toLowerCase() === "none" || s === "") return null;
  return s;
}

function sanitizeSearchProduct(product) {
  const isAiDiscovery = product.ingestion_source === "ai-discovery" || product.ingestion_source === "ai-extraction";
  const isLive = product.ingestion_source === "live-crawler" || product.ingestion_source === "live-discovery";

  // Clean product data for professional presentation
  const cleanedDesc = cleanDescription(product.description);
  const cleanedDims = parseCleanDimensions(product);
  const cleanedName = cleanProductName(product.product_name, product.sku, product.vendor_name);
  const cleanedSku = cleanSku(product.sku);

  // Fall back to AI-generated description if scraped description is junk
  const aiDesc = product.ai_visual_analysis
    ? (() => {
      const va = product.ai_visual_analysis;
      // Skip values that are junk from the AI tagger
      const skip = v => !v || /^(unable to determine|null|none|n\/a|unknown|not visible|not applicable|from schematic)/i.test(String(v).trim());
      const cap = v => v ? v.charAt(0).toUpperCase() + v.slice(1) : "";

      // Build a natural-sounding sentence, not a spec list
      let sentence1 = "";
      let sentence2 = "";

      // Sentence 1: "A [silhouette] [type] upholstered in [color] [material] with [arms] and [legs]"
      if (va.furniture_type) {
        // Clean silhouette: strip "with ..." clauses (those go in the details section)
        // Also skip if silhouette is too long/verbose or already contains the furniture type
        let sil = "";
        if (!skip(va.silhouette)) {
          let silVal = va.silhouette.replace(/\s+with\s+.*/i, "").trim(); // strip "with X arms" from silhouette
          if (silVal.length < 30 && !va.furniture_type.toLowerCase().includes(silVal.toLowerCase())) {
            sil = `${silVal} `;
          }
        }
        sentence1 = `A ${sil}${va.furniture_type}`;

        const mat = va.upholstery_material || va.primary_material;
        const color = va.color_primary;
        if (!skip(mat)) {
          const matStr = (!skip(color) && !mat.toLowerCase().includes(color.toLowerCase())) ? `${color} ${mat}` : mat;
          sentence1 += ` upholstered in ${matStr}`;
        } else if (!skip(color)) {
          sentence1 += ` in ${color}`;
        }

        const details = [];
        if (!skip(va.arms) && !va.arms.toLowerCase().includes("armless")) {
          const armVal = va.arms.toLowerCase().trim();
          // Don't repeat arms if already mentioned in silhouette
          if (!sil.toLowerCase().includes(armVal)) {
            // Avoid "track arm arms" — if arm type already ends with "arm", just add "s"
            details.push(armVal.endsWith("arm") ? `${va.arms}s` : `${va.arms} arms`);
          }
        }
        if (!skip(va.legs_base) && !/^(none|hidden|skirted)/i.test(va.legs_base)) {
          // Clean up verbose leg descriptions
          let legDesc = va.legs_base.replace(/,?\s*(four-legged|three-legged)\s*/gi, "").trim();
          if (legDesc && !skip(legDesc)) details.push(`${legDesc} legs`);
        }
        if (details.length > 0) sentence1 += ` with ${details.join(" and ")}`;

        sentence1 += ".";
      }

      // Sentence 2: "[Style] style with [distinctive features]"
      const s2parts = [];
      if (!skip(va.style)) s2parts.push(`${cap(va.style)} style`);
      const feats = va.distinctive_features;
      if (Array.isArray(feats) && feats.length > 0) {
        const good = feats.filter(f => !skip(f) && f.length < 40 && f.length > 3).slice(0, 3);
        if (good.length > 0) {
          if (s2parts.length > 0) {
            s2parts[0] += ` with ${good.join(", ")}`;
          } else {
            s2parts.push(`Features ${good.join(", ")}`);
          }
        }
      }
      if (!skip(va.back) && !/unable|unknown|not visible/i.test(va.back)) {
        const backStr = va.back.toLowerCase();
        // Avoid repeating back info already in sentence1 or duplicating "back back"
        if (!sentence1.toLowerCase().includes(backStr) && !backStr.includes("back")) {
          s2parts.push(`${cap(va.back)} back`);
        }
      }
      if (s2parts.length > 0) sentence2 = s2parts.join(". ") + ".";

      let result = [sentence1, sentence2].filter(Boolean).join(" ");
      // Final cleanup: fix awkward AI-generated patterns
      result = result.replace(/\b(\w+) \1\b/gi, "$1"); // "linen linen" → "linen"
      result = result.replace(/\b(\w+ \w+) \1\b/gi, "$1"); // "shelter arm shelter arm" → "shelter arm"
      result = result.replace(/with (\w+ \w+s?) (?:and|with) \1/gi, "with $1"); // "with shelter arms with shelter arms"
      result = result.replace(/(\w+ chair)\s+\w+ chair\b/gi, "$1"); // "lounge chair accent chair" → "lounge chair"
      result = result.replace(/,\s*(wooden|four-legged|three-legged),?\s*/gi, " "); // remove awkward mid-list items
      result = result.replace(/(tapered|straight|turned),?\s*(tapered|straight|turned),?\s*/gi, "$1 "); // dedup leg adjectives
      result = result.replace(/\b([\w-]+) legs legs\b/gi, "$1 legs"); // "four-legged legs" → just the descriptor
      result = result.replace(/four-legged legs/gi, "four legs");
      result = result.replace(/three-legged legs/gi, "three legs");
      result = result.replace(/\.\s*\./g, "."); // double periods
      result = result.replace(/\s{2,}/g, " ").trim(); // collapse whitespace
      // Fix "A accent" → "An accent", "A upholstered" → "An upholstered"
      result = result.replace(/^A ([aeiou])/i, "An $1");
      if (result.length < 30) return null;
      return result;
    })()
    : null;

  // For product name: use cleaned name, or fall back to AI furniture type + vendor
  const displayName = cleanedName
    || (product.ai_furniture_type
      ? `${product.ai_furniture_type.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}${product.collection ? ` — ${product.collection}` : ""}`
      : product.product_name);

  // Build clean images array — hero + unique gallery images, no dupes
  const heroUrl = isAiDiscovery ? (product.image_url || null)
    : isLive ? (product.image_verified ? product.image_url : null)
    : (product.image_url || null);

  const rawImages = Array.isArray(product.images) && product.images.length > 0
    ? product.images.map(img => typeof img === "string" ? img : (img && img.url ? img.url : "")).filter(Boolean)
    : Array.isArray(product.alternate_images) && product.alternate_images.length > 0
      ? product.alternate_images.filter(Boolean)
      : [];

  // Deduplicate: remove hero dupes from gallery, then filter invalid images
  // Aggressive normalization to catch dupes that differ by query params, sizing,
  // underscores vs hyphens, or minor path variations
  const galleryDeduped = new Set();
  const normalizeImgUrl = (u) => {
    try {
      const parsed = new URL(u);
      // Strip all query params (sizing, cache busters, etc.)
      const clean = (parsed.hostname + parsed.pathname).toLowerCase()
        .replace(/[_-]\d{2,4}x\d{2,4}/g, "")  // size suffixes like _800x600
        .replace(/[_-](small|medium|large|thumb|xlarge|xxlarge|original|full|master|grande|compact|pico|icon)/gi, "")
        .replace(/[_-]/g, "");  // treat underscores and hyphens as identical
      return clean;
    } catch { return u.toLowerCase().trim().replace(/[_-]/g, ""); }
  };
  if (heroUrl) galleryDeduped.add(normalizeImgUrl(heroUrl));
  const uniqueGallery = [];
  for (const url of rawImages) {
    if (typeof url === "string" && url) {
      const norm = normalizeImgUrl(url);
      if (!galleryDeduped.has(norm)) {
        galleryDeduped.add(norm);
        uniqueGallery.push(url);
      }
    }
  }
  const validGallery = uniqueGallery.filter(url => hasValidProductImage(url));
  // Final images: unique gallery only (hero is shown separately by frontend via image_url)
  const finalImages = validGallery;

  return {
    ...product,
    product_name: displayName,
    // Map vendor_name → manufacturer_name for frontend compatibility
    manufacturer_name: product.vendor_name || product.manufacturer_name || null,
    // Map product_url → portal_url for frontend compatibility
    portal_url: product.product_url || product.portal_url || null,
    retail_price: product.retail_price ?? null,
    wholesale_price: product.wholesale_price ?? null,
    image_url: heroUrl,
    images: finalImages,
    image_contain: product.image_contain || false,
    product_url: isAiDiscovery ? (product.product_url || null)
      : isLive ? (product.product_url_verified ? product.product_url : null)
      : (product.product_url || null),
    retrieval_quality_score: Number(product.retrieval_quality_score || 0),
    image_available: hasValidProductImage(product.image_url),
    match_explanation: product.match_explanation || null,
    // Cleaned fields
    sku: cleanedSku,
    dimensions: cleanedDims,
    description: (() => {
      // Use cleaned vendor description if it's substantial and not just repeating the name
      if (cleanedDesc && cleanedDesc.length >= 30) {
        const descLower = cleanedDesc.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
        const nameLower = (displayName || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
        // If description is essentially just the product name, use AI instead
        if (nameLower && nameLower.length > 5) {
          const similarity = descLower.startsWith(nameLower) || nameLower.startsWith(descLower);
          if (similarity && cleanedDesc.length < nameLower.length + 15) {
            return aiDesc || null;
          }
        }
        // If description is mostly spec junk (very short after cleanup, or just dimensions)
        if (cleanedDesc.length < 40 && /^[\d"WDHx×\s.]+$/.test(cleanedDesc)) {
          return aiDesc || null;
        }
        return cleanedDesc;
      }
      return aiDesc || null;
    })(),
  };
}
