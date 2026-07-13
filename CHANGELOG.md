# Changelog & AI IDE Instructions

This file serves as a persistent record of changes made to this project and crucial rules that all AI assistants, IDEs, and agents MUST follow. Before making any modifications, read this file to understand the project's history and constraints.

## Critical Rules for AI Agents

1. **NO FAKE DATA OR URLS**: Never allow an LLM to hallucinate or generate fake URLs, mock data, or placeholder content when asked for live internet results (e.g., news articles). This provides a false sense of security.
2. **REQUIRE WEB SEARCH**: When fetching articles, the LLM MUST use a live web search tool (like Google Search/Grounding) to ensure accuracy. If internet access is unavailable or the tool fails, the system must explicitly throw an error stating "No internet access" or "Search tool unavailable", rather than falling back to internal training data.
3. **EXPLICIT ERRORS OVER FALLBACKS**: If an LLM encounters a billing issue, quota limit, or missing capability, the system MUST explicitly report the exact error to the user. Do NOT automatically silently switch to another LLM to hide the error. 
4. **STRICT MODEL NAMES**: Do not alter model names based on assumptions of what "should" exist. Ensure the exact model identifiers expected by the APIs (e.g., `gemini-3.1-pro-preview`) are used, even if a stable version "should" be out.

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
