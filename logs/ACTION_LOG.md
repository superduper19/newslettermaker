# AI Action Log & Changelog

This log tracks the actions performed by the AI assistant on the codebase. It serves as a record for future tools and developers to understand the changes made.

## 2026-02-28 (Session: Fix Model Access & Web Search)

### 1. Model Configuration & Access
- **Fixed Model Mapping**: Updated `routes/articles.js` to use the correct, active model IDs for 2026:
  - `claude-opus-4-6` (Standard & Extended)
  - `claude-sonnet-4-6`
  - `claude-haiku-4-5` (mapped to `claude-haiku-4-5-20251001`)
- **Deprecated Models**: Removed references to `claude-3-opus` and `claude-3-5-sonnet` which were causing 404 errors.
- **Frontend Update**: Updated `public/index.html` dropdown to reflect the new available models (Opus 4.6, Sonnet 4.6, Haiku 4.5).

### 2. Web Search & Prompting
- **Enabled Web Search Tool**: Activated the `web_search_20250305` tool for Anthropic models in `routes/articles.js`. This allows Claude to browse the live web instead of relying solely on training data.
- **Removed Restrictive Prompts**: Deleted system instructions in `routes/articles.js` that told the AI to "generate mock/fake data" or claim it "cannot browse the web".
- **Simplified System Prompts**: Reduced system prompts to a minimal instruction: "Use the available web search tool... Return strictly a JSON array". This ensures raw, unfiltered results.

### 3. Article Filtering Logic
- **Disabled Rejection Rules**: Commented out internal filtering logic in `routes/articles.js` (lines 97-129) that previously rejected articles based on:
  - Paywalls
  - Anti-cannabis sentiment
  - Press releases
  - Short content length (< 300 chars)
- **Outcome**: All search results found by the AI are now passed through to the user without backend filtering.

### 4. Testing & Verification
- **Created Test Scripts**:
  - `test_anthropic_models.js`: Verified API key access to specific model IDs.
  - `test_api.js`: Verified local server API endpoints are responding correctly (no 404s).
- **Server Management**: Restarted `server.js` on port 5020 to apply all changes.

### 5. Prior Context (Session History)
*Added to bring log up to speed with previous troubleshooting steps.*

- **Initial Issue**: User reported duplicates in model dropdown and API errors.
- **Fix 1 (UI)**: Removed duplicate "Claude 4.6" entries in `public/index.html`.
- **Fix 2 (API Testing)**:
  - Created `test_api.js` to debug 404 errors.
  - Identified `node-fetch` compatibility issues; switched to native `http` module.
  - Confirmed server was running on port 5020 but returning 404s for old model IDs.
- **Fix 3 (Gemini Support)**:
  - Added Gemini Flash 3.0 and 3.1 Pro to `routes/articles.js` and `public/index.html`.
  - Created `list_gemini_models.js` to verify Google API access.
- **Fix 4 (Process Management)**:
  - Terminated stuck/zombie node processes on port 5020 using `taskkill`.
- **Fix 5 (Frontend Enhancements)**:
  - Added "Inspirational Images" search input to `public/index.html`.
  - Fixed "Back" button functionality in `public/index.html`.
  - Removed duplicate "Next" buttons in `public/js/app.js`.
  - Removed "rank filtering" in `public/js/app.js` to stop hiding valid articles.

---
*End of Log Entry*
