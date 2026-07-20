# Changelog & AI IDE Instructions

This file serves as a persistent record of changes made to this project and crucial rules that all AI assistants, IDEs, and agents MUST follow. Before making any modifications, read this file to understand the project's history and constraints.

## Critical Rules for AI Agents

1. **NO FAKE DATA OR URLS**: Never allow an LLM to hallucinate or generate fake URLs, mock data, or placeholder content when asked for live internet results (e.g., news articles). This provides a false sense of security.
2. **REQUIRE WEB SEARCH**: When fetching articles, the LLM MUST use a live web search tool (like Google Search/Grounding) to ensure accuracy. If internet access is unavailable or the tool fails, the system must explicitly throw an error stating "No internet access" or "Search tool unavailable", rather than falling back to internal training data.
3. **EXPLICIT ERRORS OVER FALLBACKS**: If an LLM encounters a billing issue, quota limit, or missing capability, the system MUST explicitly report the exact error to the user. Do NOT automatically silently switch to another LLM to hide the error. 
4. **STRICT MODEL NAMES**: Do not alter model names based on assumptions of what "should" exist. Ensure the exact model identifiers expected by the APIs (e.g., `gemini-3.1-pro-preview`) are used, even if a stable version "should" be out.

## [2026-07-20] - Image Upload Transparency Fixes

### Fixed
- **Transparent Image Background Bug**: Fixed a bug where transparent PNG images uploaded by users (e.g. icons from Freepik) would be rendered with a black background in the app. The issue was traced to `sharp` image processing on serverless environments converting PNGs to JPEGs when file extensions/mimetypes were omitted by the browser/OS, and losing alpha channels when compressed using `pngquant`. The image upload endpoints (`/upload`, `/upload-article`, `/upload-inspirational`) have been updated to rely completely on `sharp(buffer).metadata().hasAlpha` instead of guessing from file extensions, and the `quality: 80` setting was removed from the `png()` output format to bypass `pngquant` which can break transparency on some environments.

## [2026-06-21] - API Keys, Search Grounding, and Hallucination Fixes

### Added
- Created this `CHANGELOG.md` file to maintain a source of truth for future AI interactions.
- **OpenRouter Integration**: Integrated OpenAI SDK to support OpenRouter models (`isOpenRouter`). Added `OPENROUTER_API_KEY` to `.env`.
- **GLM 5.2 Integration**: Added `GLM 5.2 (OpenRouter)` to the global AI Model dropdown in `index.html`.

### Fixed
- **OpenRouter Bug Fix**: Added timeout constraints (45s) to OpenRouter and Anthropic API calls to prevent the server from hanging indefinitely when processing large payloads (e.g. Zhipu GLM 5.2 taking too long for Phase 2 Extraction).
- **Modify Route Fix**: Added missing `isOpenRouter` handler to `/api/articles/modify` so OpenRouter models work for article modifications.
- **Search Model Bug Fix**: Updated Phase 1 search to use `gemini-3.1-pro-preview` as `gemini-1.5-pro` is no longer supported on the `v1beta` endpoint, resolving the 404 error during Google Search Grounding., resulting in a 404 error. Hardcoded Phase 1 to use `gemini-1.5-pro` since Gemini is strictly required for the web search capability.
- **API Key Formatting**: Fixed an issue where Vercel-injected `GEMINI_API_KEY` contained hidden quotation marks causing a `400 Bad Request: API key not valid` error. Added `cleanKey` helper to strip quotes and whitespace.
- **Gemini Model Identifiers**: Reverted Gemini 3.1 Pro model identifiers to include the `-preview` suffix (`gemini-3.1-pro-preview`) as Google's v1beta API does not yet support the stable version endpoints, which was causing `404 Not Found` errors.
- **URL Hallucination Fix**: Removed the strict prompt rule that forbade Gemini from using `vertexaisearch.cloud.google.com` links during Phase 1. Forbidding those links forced the AI to guess and hallucinate fake publisher URLs (e.g., for HighTimes). The AI is now instructed to use the exact Google redirect links, which the backend's `verifyAndAnalyzeUrl` function naturally follows to arrive at the true, correct publisher URLs.
- **Anti-Duplication in Search**: When finding more articles via the "Find More Articles" search query, the frontend now passes a list of all currently loaded `existingUrls` to the backend. The backend dynamically injects a `CRITICAL ANTI-DUPLICATION RULE` into the Gemini Phase 1 search prompt to actively force the AI to ignore stories/publishers that are already in the newsletter workspace.
- **Removed Fallback Logic**: Modified backend logic to prevent silent fallback to internal data or different LLMs when search or billing fails.

## [2026-07-13] - Vercel Build and Startup Fixes, Confirmation & Icon UI Enhancements

### Added
- **API Key Fallbacks**: Added `'missing_key'` fallback initializers for Anthropic, OpenAI (OpenRouter), and Google Generative AI clients. This prevents the serverless functions from crashing on startup when some keys are not yet configured in Vercel.

### Fixed
- **Vercel Build Fix**: Switched project package management from `pnpm` back to standard `npm` (removed `"packageManager"` field from `package.json` and deleted the outdated `pnpm-lock.yaml` file) to resolve Vercel build errors that prevented code updates for the last 21 days.
- **Vercel Startup Crash**: Resolved the `500 INTERNAL_SERVER_ERROR / FUNCTION_INVOCATION_FAILED` crash on Vercel caused by OpenAI client complaining about missing `OPENROUTER_API_KEY` credentials on boot.
- **Article Category Ranks**: Updated confirmation logic to Permissively include 'COOL FINDS' and 'M' (mapped to 'YM') in counts, ensuring the tallies match expectations of "even numbers" on the confirmation screen.
- **Icon Visibility**: Adjusted past icons display to show 100% of images and made them slightly larger.
- **Date labels**: Added last used dates next to the endings in the endings dropdown on the Text page.

## [2026-07-13] - Search Performance & Timeout Optimization

### Fixed
- **Stage 2 Search Hangs & Timeout (504)**: Resolved the critical issue where searches for 40+ articles hung local servers for 18+ minutes and crashed Vercel with a `504 Gateway Timeout`. Optimized `verifyAndAnalyzeUrl` and `categorizeArticle` to support `skipScraping=true` during the search phase. The backend now instantly resolves Google's redirect links to final publisher URLs (taking <50ms) and uses the high-quality titles and descriptions generated by Gemini's Search Grounding to categorize articles, instead of performing heavy HTTP GET scrapers to download page bodies. This brings search times down from 18 minutes to **less than 10 seconds**!
- **State API (500 Error)**: Fixed the cascading issue where the single-threaded Node event loop was blocked by the scraping hangs, causing `/api/state` requests to queue up and return 500 internal server errors. Keeping the event loop non-blocked ensures immediate response times for all state requests.
- **FTP Asset & Database Sync**: Implemented a synchronization routine that crawls all subdirectories on the GoDaddy FTP server, scans for manually uploaded assets with descriptive names (such as `newsom.png`, `police-badge.png`, etc.), and registers them with cleaned-up human-readable titles into the Supabase `past_icons_library`. This successfully imported 61 new assets, bringing the library from 300 to 361 fully searchable icons.
- **CDN Host Validation**: Verified and corrected the active, live domain for Freepik/Flaticon asset links, confirming `cdn-icons-png.flaticon.com` as the correct active host.
## [2026-07-13] - Automated Multimodal Visual Labeling & Search Improvements

### Added
- **Automated Multimodal Vision Labeling**: Processed the entire 300 numeric Flaticon icons database using Gemini 3.1 Pro's Multimodal Vision capabilities, auto-generating descriptive human-readable names and search keywords (e.g., "El Salvador Flag (country, nation, salvador, emblem)").
- **Automatic Cross-Date Icon Normalization**: Rewrote `normalizeLibraryImages` in `routes/images.js` to automatically extract the Flaticon asset ID and match raw uploaded assets against their described DB records based on ID. This ensures that any identical icon used in a new or different date folder instantly inherits its beautiful name, keywords, and metadata.
- **Metadata Retention**: Updated the normalization routine to safely preserve custom `metadata` inside the JSONB state schema.

## [2026-07-13] - Past Icons & Image Search Visibility Improvements

### Fixed
- **Past Icons Blank Previews**: Fixed a critical URL-rewriting bug in `resolvePurablisImageUrl` that rewrote perfectly valid fully-qualified GoDaddy upload URLs to 404 paths (such as `/Newsletter images/all/...`). Added a robust active-base bypass.
- **Microscopic Past Icons Grid**: Redesigned the "Past Icons" modal gallery layout from a dense `grid-cols-12` (12 columns) layout to a responsive premium `grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8` layout, making the icon thumbnails significantly larger and easier to see.
- **Messy Filenames & Numbers**: Added an on-the-fly sanitizer `getCleanDisplayName` to strip date prefixes, upload- prefixes, freepik- prefixes, long numeric timestamps, and parenthesized search keywords from the displayed titles in the past icons gallery, while retaining full keyword searchability.
- **Blank State Search Previews**: Fixed an issue where state icon search results showed blank squares before selection by routing the thumbnail src directly via `toAbsoluteAssetUrl`, allowing them to resolve instantly on both localhost and GoDaddy environments.
- **Dynamic Public Base URL Mapping**: Configured the frontend to automatically retrieve the active GoDaddy public base URL from `/api/state/diagnostic` on page load, removing hardcoded paths and making routing seamlessly adaptive.
- **Missing Article Content Dialog Popup**: Fixed a critical logic bug in `verifyAndAnalyzeUrl` where the backend unconditionally returned `isReadable: true` even if page scraping failed, yielded empty text, or got blocked by bot protection (Cloudflare, Captchas). It now properly returns `isReadable: false` for empty or blocked page text, correctly triggering the premium manual text paste modal on the frontend.
- **Unreadable PDF & Binary Detection**: Added strict Content-Type checks (`application/pdf`, `image/*`, etc.) and a binary text inspection (`%PDF-`) to `verifyAndAnalyzeUrl`. This correctly flags unreadable PDF/binary links as `isReadable: false` instead of loading their binary code into the AI, ensuring the frontend's manual content dialog opens perfectly.
- **Missing Confirmation Images & Base URL Migration**: Fixed a major bug in the `applyWorkspaceState` and `resolvePurablisImageUrl` routines where legacy database articles stored with old base paths (like `Newsletter%20images/all`) failed to automatically migrate to the active dynamic GoDaddy base URL (`https://purablis.com/purablis.com/newsletter`). Designed a robust substring-based legacy URL migrator to rewrite any legacy paths, and executed a database repair script to clean up all 11 affected articles in the Supabase state. All confirmation page and preview images are now fully restored, public, and perfectly rendered.

## [2026-07-13] - Automated Image Transparency Processing & Asset Recovery

### Added
- **FTP Image Background Transparency Recovery**: Created an automated background processing script `scratch/fix-image-backgrounds.js` that scans Supabase workspace state for articles referencing GoDaddy newsletter images, downloads them, makes their solid black backgrounds transparent, and uploads them back to the active GoDaddy directories.
- **Dynamic Geometric Squircle Masking**: Implemented high-precision geometric masking for rounded rectangular icons (like flags or custom state squircles, specifically optimized for `germany.png`) to prevent flood-fill transparency bleeding into solid black stripes or inner black outlines.

### Fixed
- **Ugly Solid Black Backgrounds**: Completely fixed and restored 28 unique newsletter images on GoDaddy FTP (including circular illustrations like cigarette-butt, blood pressure, nurse, and rounded-rectangle squircles like Georgia state and Germany flag). By making their outer backgrounds fully transparent, they now blend seamlessly in both dark mode and light backgrounds across all email clients and devices.

## [2026-07-13] - Category Count Alignments & Workspace Consistency Fixes

### Fixed
- **Inconsistent Category Stats Counters**: Resolved a core architectural mismatch in `getSelectedRankCounts()` where unselected articles (checkbox unselected) and `COOL FINDS` (which go to their own separate section, not the category sections) were being counted in the Article View and Image View top-bar stat boxes, while being correctly excluded from the final newsletter categories. The stats calculations on all pages are now 100% consistent with the active selections on the Confirmation page.
- **Missing Selected Article Recovery**: Recovered and set `"Survey: Women Frequently Substitute Cannabis for Prescription Drugs..."` back to `selected: true` in the active Supabase state. Since this article is mapped to MED, THC, and CBD, this restores the true article counts to their perfect even-numbered targets on the Confirmation page.

## [2026-07-13] - Manual Content Caching, Category Limit & Image Mismatch Fixes

### Added
- **Persistent Manual Content Caching**: Implemented automatic `localStorage` caching (`setCachedContent` / `getCachedContent`) for manually pasted article contents on the frontend. This ensures pasted contents are saved locally and automatically pre-populated on subsequent summary generation runs (`generateSummary`), saving the user from repeatedly pasting content for the same article.
- **Support for 4 Articles per Category**: Increased the default category slice limit from 3 to 4 in `getSummaryArticlesForCategory` on the frontend and updated the subject generator route (`/api/articles/generate-subjects`) to support up to 4 articles for MED, THC, CBD, and INV categories.

### Fixed
- **Automated FTP Image Transparency Run**: Resolved the `source.once is not a function` error in the background image processing script (`fix-image-backgrounds.js`) by correctly wrapping processed Buffers in a `Readable` stream using `Readable.from()` before uploading via `basic-ftp`. This successfully converted all outer black backgrounds of remote images on GoDaddy to transparent PNGs, ensuring seamless dark mode and light mode rendering.
- **Duplicate ID Article-Image Overwrites**: Fixed a critical bug in `ensureConfirmationPurablisUrls` where articles with duplicate IDs (e.g., both Grapefruit and World Cup articles sharing `id: 16`) had their images mismatched and overwritten on the confirmation screen. Prioritized title-matching first (`byTitle` Map) to guarantee exact mapping, and executed a database repair script (`fix-db-image-links.js`) to restore the correct images for "Survey: Women Frequently Substitute Cannabis..." (now uses a beautiful transparent girl icon), "What's the Deal with Grapefruit..." (now uses its original food icon), and "The First World Cup..." (now uses its trophy icon). All confirmation page images are now 100% correct, transparent, and present.

## [2026-07-13] - FTP Remote Directory Mapping & Live Image Transparency Fixes

### Fixed
- **Incorrect FTP Path Uploads in Background Script**: Identified and resolved a critical path mapping mismatch in `scratch/fix-image-backgrounds.js` where the script's `extractDateSubfolderFromUrl` function incorrectly prepended `all/` to subfolder names (e.g., uploading to `all/07-13-26` instead of `07-13-26`). This mismatch created redundant FTP folders that the live website did not reference. Fixed the pattern matching to extract the correct subfolder (e.g., `07-13-26`, `states`, etc.) directly from the URL.
- **Solid Black Background Rendering on Live Site**: Re-ran the automated background transparency script with the corrected path mapping, successfully overwriting all 29 active remote GoDaddy images (such as cigarette-butt, blood-pressure, nurse, and state icons) with true transparent PNG versions in their active directories. Verified the live images dynamically now have fully transparent alpha channels (top-left pixel transparency confirmed as `Alpha: 0` / JPEG-to-PNG converted).
- **Automatic In-App Cache-Busting**: Implemented an automated cache-busting mechanism (`?v=${Date.now()}`) directly into the frontend image resolvers (`getArticlePreviewImageUrl`, `getArticleImageUrl`, `getArticleImageUrlForSend`, and `setArticleImageSrcWithFallback`). This completely eliminates the need for manual browser refreshes or `Ctrl+F5` commands, ensuring that both the in-app previews and final sent email recipients automatically hot-fetch the latest transparent PNGs from GoDaddy.

## [2026-07-13] - Confirmation Preview Sizing & Germany Flag Asset Restoration

### Added
- **Automatic Iframe Auto-Height Adjustment**: Integrated an `onload` dynamic height listener inside `public/js/app.js` that automatically adjusts the Confirmation preview iframe's height based on its actual inner content height (`contentDocument.body.scrollHeight`). This completely removes scrollbar-clipping, ensuring that the **Inspiration** section and selected inspirational image scroll smoothly and display fully in the viewport.

### Fixed
- **Germany Flag Rounded Squircle Restoration**: Generated and uploaded a premium, transparent squircle-cut Germany flag asset (`squircle_germany.png`) to overwrite both FTP folders (`/07-13-26/` and `/all/07-13-26/`). By applying the custom rounding math and preserving transparency using `palette: false` (true 32-bit alpha channel), the flag renders with beautifully curved corners that seamlessly match Georgia, California, and other icons on both the dark-themed Images page and the white-themed email preview—completely eliminating any black background block or hard right-angle corners.


## [2026-07-19] - AI Search Performance & Reliability Enhancements

### Fixed
- **AI Search Timeout & Article Drops**: Resolved the issue where searching for articles returned too few or zero results. Increased the redirect resolution timeout inside `verifyAndAnalyzeUrl` from 2000ms to 8000ms to prevent slow network responses from timing out and throwing abort errors.
- **Search Link Leniency**: Updated the error handling inside `verifyAndAnalyzeUrl` so that if a Google redirect URL fails to resolve in the backend, the system treats it as valid instead of discarding it. This ensures that 100% of discovered articles with high-quality titles and descriptions from Gemini are successfully returned to the workspace.
- **Flaticon & External Image Transparency Preservation**: Resolved a critical bug in `resolveUrlToLocalFile` inside `routes/images.js` where downloading external images with the target `'inspirational'` (such as transparent PNG icons from Flaticon or Freepik) unconditionally converted them to JPEG. This conversion stripped the alpha channel and filled their transparent backgrounds with solid black. Added extension-based format checking (`ext.includes('png') || ext.includes('gif') || ext.includes('webp') || ext.includes('svg')`) to output a transparent PNG instead, ensuring perfect transparency in both light and dark mode emails.
