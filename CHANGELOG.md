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

### Fixed
- **API Key Formatting**: Fixed an issue where Vercel-injected `GEMINI_API_KEY` contained hidden quotation marks causing a `400 Bad Request: API key not valid` error. Added `cleanKey` helper to strip quotes and whitespace.
- **Gemini Model Identifiers**: Reverted Gemini 3.1 Pro model identifiers to include the `-preview` suffix (`gemini-3.1-pro-preview`) as Google's v1beta API does not yet support the stable version endpoints, which was causing `404 Not Found` errors.
- **URL Hallucination & Web Search Tool**: Re-enabled the `googleSearch` tool for Gemini in `routes/articles.js`. Previously, the tool was removed due to suspected billing errors, which forced Gemini to rely on internal training data and hallucinate fake URLs. Re-enabling the tool ensures live, accurate web links.
- **Removed Fallback Logic**: Modified backend logic to prevent silent fallback to internal data or different LLMs when search or billing fails.

