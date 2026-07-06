# Implementation Plan: Search Bar for Past Newsletters

This plan designs and details the search tool for querying previously posted articles within historical newsletter sessions (e.g. searching across all weeks' articles). It allows the editor to quickly check if a specific topic has already been published.

## User Review Required

> [!IMPORTANT]
> - **Search Scope:** This feature queries across all previous newsletter sessions saved in the Supabase state database (table: `newsletter_state`, key: `'sessions'`).
> - **Performance & Snappiness:** To maintain lightning-fast response times, the entire list of historical sessions is lazy-loaded from the database once upon opening the search tool, cached in memory, and searched locally. Keystroke searching will be debounced (250ms) to ensure an ultra-smooth typing experience.
> - **Visual Design:** The design integrates a premium search button directly into the main navigation header (aligned to the right-hand side). Clicking it opens an elegant, interactive Glassmorphism overlay modal that fits the dark-emerald and cream luxury aesthetics of the Newsletter Studio.

---

## Proposed Changes

### 1. HTML Layout & Structure

#### [MODIFY] [index.html](file:///c:/Users/kaveh/Documents/GitHub/newlettermaker/public/index.html)
- Add the search trigger button in the main navigation container next to `nav-steps`.
- Add the Glassmorphism search modal at the bottom of the body.

```html
<!-- Inside <nav class="main-nav"> <div class="nav-container"> -->
<div class="nav-search-button-wrapper ml-auto pl-4">
  <button id="btn-open-archive-search" onclick="openArchiveSearch()" class="btn btn-secondary flex items-center gap-2 py-1.5 px-4 text-[0.9rem] rounded-full shadow-sm hover:shadow hover:bg-[#2f6e630d] hover:text-[#16423c] transition-all bg-white/80 border border-[#84725324]">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4 text-[#2f6e63]">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
    </svg>
    <span class="font-semibold">Search Past Newsletters</span>
  </button>
</div>
```

```html
<!-- At the bottom of index.html, right before </body> -->
<!-- Archive Search Modal Overlay -->
<div id="archive-search-modal" onclick="if (event.target===this) closeArchiveSearch()" class="hidden fixed inset-0 bg-[rgba(22,34,30,0.5)] z-[2000] items-center justify-center p-4 backdrop-blur-md transition-all duration-300">
  <div class="bg-[#fffffffb] rounded-[24px] p-6 max-w-2xl w-full max-h-[85vh] shadow-[0_20px_50px_rgba(22,34,30,0.18)] border border-[#84725333] flex flex-col transform transition-all duration-300 scale-95 opacity-0" id="archive-search-modal-content">
    
    <!-- Modal Header -->
    <div class="flex justify-between items-start pb-4 border-b border-[#84725322]">
      <div>
        <h3 class="text-xl font-bold font-serif text-[#16423c] flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5 text-[#2f6e63]">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
          </svg>
          Search Past Newsletters
        </h3>
        <p class="text-[0.78rem] text-[#555] mt-1">Search the titles of all previously saved newsletters to see if a topic was posted.</p>
      </div>
      <button onclick="closeArchiveSearch()" class="text-[#888] hover:text-[#333] hover:bg-[#84725318] transition-all p-1.5 rounded-full">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Search Input & Fetch State Loading -->
    <div class="mt-4 flex gap-2.5 items-center relative">
      <div class="relative flex-1">
        <input type="text" id="archive-search-input" placeholder="Type keyword, topic, or article title..." class="w-full pl-10 pr-4 py-2.5 border border-[#84725344] rounded-xl text-[0.95rem] focus:outline-none focus:border-[#2f6e63] focus:ring-2 focus:ring-[#2f6e6322] shadow-inner bg-white" oninput="debounceArchiveSearch()">
        <span class="absolute left-3.5 top-3 text-[#888]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4.5 h-4.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
          </svg>
        </span>
      </div>
      <button onclick="performArchiveSearch()" class="btn btn-primary btn-sm py-2.5 px-5 rounded-xl flex items-center gap-1 font-semibold">Search</button>
    </div>

    <!-- Search Results View -->
    <div class="mt-5 flex-1 overflow-y-auto pr-1 min-h-[350px] max-h-[50vh]" id="archive-search-results-container">
      <div class="flex flex-col items-center justify-center h-[350px] text-gray-400 gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12 text-[#2f6e632d]">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
        </svg>
        <span class="text-sm text-[#555] font-medium">Type a word above to search previous newsletters...</span>
      </div>
    </div>

    <!-- Modal Footer -->
    <div class="mt-4 pt-3 border-t border-[#84725322] flex justify-between items-center text-xs text-[#666]">
      <div id="archive-search-stats" class="font-medium">No search performed yet.</div>
      <div class="italic">Press ESC to close</div>
    </div>
  </div>
</div>
```

---

### 2. JavaScript Search Logic & State Integration

#### [MODIFY] [app.js](file:///c:/Users/kaveh/Documents/GitHub/newlettermaker/public/js/app.js)
At the bottom of `app.js`, add our modern modal handlers and full client-side search logic.

- **`openArchiveSearch()`**: Displays the modal, centers it, triggers a fade/scale animation, focuses the search input, and lazy-loads previous sessions from the database if they are not yet cached in memory.
- **`closeArchiveSearch()`**: Closes the modal with smooth exit animations.
- **`performArchiveSearch()`**: Matches case-insensitive query words inside article titles of previous sessions, extracts matching details (title, URL, date, session name, and active categories), highlights search matches, and dynamically renders them as gorgeous responsive cards.
- **`debounceArchiveSearch()`**: Debounces keyup events with a 250ms threshold.

```javascript
let cachedSessionsForSearch = null;
let archiveSearchDebounceTimer = null;

window.openArchiveSearch = async function() {
    const modal = document.getElementById('archive-search-modal');
    const content = document.getElementById('archive-search-modal-content');
    const input = document.getElementById('archive-search-input');
    const stats = document.getElementById('archive-search-stats');
    
    if (!modal || !content) return;
    
    // Show modal and start animations
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
    
    if (input) input.focus();
    
    // Add Esc key listener
    window.addEventListener('keydown', handleArchiveSearchEscKey);

    // Lazy-load sessions if not already cached
    if (!cachedSessionsForSearch) {
        stats.textContent = "Loading previous newsletters database...";
        try {
            const res = await fetch('/api/state?key=sessions');
            if (res.ok) {
                const { value } = await res.json();
                cachedSessionsForSearch = value || {};
                stats.textContent = "Newsletter database loaded. Ready to search.";
            } else {
                throw new Error("Server responded with " + res.status);
            }
        } catch (e) {
            console.warn("Failed to fetch sessions from server, falling back to local storage:", e);
            cachedSessionsForSearch = JSON.parse(localStorage.getItem('newsletter_saved_sessions') || '{}');
            stats.textContent = "Offline newsletter database loaded.";
        }
        
        // Trigger search on whatever is currently typed in
        if (input && input.value.trim()) {
            performArchiveSearch();
        }
    }
};

window.closeArchiveSearch = function() {
    const modal = document.getElementById('archive-search-modal');
    const content = document.getElementById('archive-search-modal-content');
    if (!modal || !content) return;
    
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }, 200);
    
    window.removeEventListener('keydown', handleArchiveSearchEscKey);
};

function handleArchiveSearchEscKey(event) {
    if (event.key === 'Escape') {
        closeArchiveSearch();
    }
}

window.debounceArchiveSearch = function() {
    clearTimeout(archiveSearchDebounceTimer);
    archiveSearchDebounceTimer = setTimeout(() => {
        performArchiveSearch();
    }, 250);
};

window.performArchiveSearch = function() {
    const query = document.getElementById('archive-search-input').value.trim();
    const container = document.getElementById('archive-search-results-container');
    const stats = document.getElementById('archive-search-stats');
    
    if (!container) return;
    
    if (!query) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-[350px] text-gray-400 gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12 text-[#2f6e632d]">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
                </svg>
                <span class="text-sm text-[#555] font-medium">Type a word above to search previous newsletters...</span>
            </div>
        `;
        if (stats) stats.textContent = "No search query entered.";
        return;
    }
    
    if (!cachedSessionsForSearch) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-[350px] text-[#856404] bg-[#fff3cd] border border-[#fbc02d] rounded-xl p-5 gap-2">
                <span class="font-bold">Database is loading...</span>
                <span class="text-xs">Your past newsletter data is loading from Supabase. Search will automatically execute once ready.</span>
            </div>
        `;
        return;
    }
    
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    // Sort sessions in reverse chronological order (newest sessions first)
    const sortedSessions = Object.entries(cachedSessionsForSearch).sort((a, b) => {
        const aName = a[0];
        const bName = b[0];
        
        // Custom extract number helper (e.g. "Week 19" -> 19)
        const aNum = parseInt(aName.replace(/\D/g, '')) || 0;
        const bNum = parseInt(bName.replace(/\D/g, '')) || 0;
        
        if (aNum !== bNum) return bNum - aNum;
        return bName.localeCompare(aName);
    });
    
    for (const [sessionName, sessionData] of sortedSessions) {
        const sessionArticles = sessionData.articles || [];
        for (const article of sessionArticles) {
            if (article.title && article.title.toLowerCase().includes(lowerQuery)) {
                // Determine category ranks (must be 'Y', 'YM', or numerical rank to be considered "included")
                const activeCategories = [];
                ['MED', 'THC', 'CBD', 'INV'].forEach(cat => {
                    const r = String((article.ranks && article.ranks[cat]) || '').trim().toUpperCase();
                    if (r === 'Y' || r === 'YM' || /^\d+$/.test(r)) {
                        activeCategories.push(cat);
                    }
                });
                
                // Fallback check
                if (activeCategories.length === 0 && Array.isArray(article.categories)) {
                    article.categories.forEach(cat => {
                        if (['MED', 'THC', 'CBD', 'INV'].includes(cat) && (article.status === 'Y' || article.status === 'YM')) {
                            activeCategories.push(cat);
                        }
                    });
                }
                
                results.push({
                    title: article.title,
                    url: article.url || '#',
                    date: article.date || (article.addedAt ? article.addedAt.substring(0, 10) : '') || (sessionData.savedAt ? sessionData.savedAt.substring(0, 10) : '') || 'Unknown Date',
                    session: sessionName,
                    categories: [...new Set(activeCategories)],
                });
            }
        }
    }
    
    if (stats) {
        stats.textContent = `Found ${results.length} matching articles in previous issues.`;
    }
    
    if (results.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-[350px] text-gray-500 gap-3 bg-gray-50/50 rounded-2xl border border-dashed border-[#84725322]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-10 h-10 text-gray-300">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-sm font-semibold">No matches found</span>
                <span class="text-xs text-[#777] text-center max-w-[320px]">"${query}" was not found in any article titles of previous newsletters. Feel free to use this topic!</span>
            </div>
        `;
        return;
    }
    
    // Highlight helper
    const highlightMatches = (text, search) => {
        if (!search) return text;
        const regex = new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
        return text.replace(regex, `<mark class="bg-[#ffeb3b80] text-[#16423c] font-semibold px-0.5 rounded">$1</mark>`);
    };
    
    container.innerHTML = results.map(res => {
        const catBadges = res.categories.length > 0 
            ? res.categories.map(cat => {
                let badgeClass = 'bg-gray-100 text-gray-700';
                if (cat === 'MED') badgeClass = 'bg-[#e8eaf6] text-[#0d47a1] border border-[#0d47a118]';
                else if (cat === 'THC') badgeClass = 'bg-[#e8f5e9] text-[#1b5e20] border border-[#1b5e2018]';
                else if (cat === 'CBD') badgeClass = 'bg-[#fff3e0] text-[#e65100] border border-[#e6510018]';
                else if (cat === 'INV') badgeClass = 'bg-[#f3e5f5] text-[#4a148c] border border-[#4a148c18]';
                return `<span class="px-2 py-0.5 text-[0.7rem] font-bold rounded-md ${badgeClass}">${cat}</span>`;
            }).join(' ')
            : `<span class="px-2 py-0.5 text-[0.7rem] font-medium rounded-md bg-gray-100 text-gray-500 border border-gray-200">UNRANKED</span>`;

        return `
            <div class="p-4 mb-3 rounded-2xl border border-[#8472531e] bg-white hover:border-[#2f6e6377] hover:shadow-[0_4px_20px_rgba(22,34,30,0.04)] transition-all flex flex-col gap-2">
                <div class="flex justify-between items-start gap-4">
                    <a href="${res.url}" target="_blank" rel="noopener" class="text-[0.95rem] font-serif font-bold text-[#16423c] hover:text-[#2f6e63] hover:underline leading-snug break-words">
                        ${highlightMatches(res.title, query)}
                    </a>
                    <span class="shrink-0 text-[0.75rem] font-semibold text-[#666] bg-[#84725310] px-2.5 py-1 rounded-full border border-[#84725315]">
                        📅 ${res.date}
                    </span>
                </div>
                
                <div class="text-[0.75rem] text-[#22554e] truncate break-all opacity-85">
                    <a href="${res.url}" target="_blank" rel="noopener" class="hover:underline">
                        ${res.url}
                    </a>
                </div>

                <div class="flex items-center gap-2 mt-1 flex-wrap">
                    <span class="text-[0.7rem] font-bold tracking-wider text-[#7c6953] uppercase mr-1">Appeared in:</span>
                    <span class="px-2.5 py-0.75 text-[0.75rem] font-bold rounded-lg bg-[#eddab82f] text-[#715734] border border-[#8472531a] shadow-sm">${res.session}</span>
                    <div class="flex items-center gap-1.5 ml-2">
                        ${catBadges}
                    </div>
                </div>
            </div>
        `;
    }).join('');
};
```

---

## Verification Plan

### Manual Verification
1. **Load Page & Navigate:** Open the browser and verify the "Search Past Newsletters" button is visible on the top-right side of the navigation bar.
2. **Open Modal:** Click the button and check that:
   - The Glassmorphism overlay modal opens instantly with a smooth fade and scale transition.
   - The backdrop features a premium blur.
   - The search input gets focused automatically.
   - The status bar displays a loading message, then changes to "Ready to search" once the database state is loaded from Supabase.
3. **Perform a Search:**
   - Type a topic known to exist (e.g. `Captagon` or `rescheduling` or `marijuana`).
   - Confirm matches render in cards showing the Article Title, date, URL, session name (e.g. `Week 19`), and colored category badges (`MED`, `THC`, etc.).
   - Confirm clicking on the Title opens the link in a new tab.
4. **Keyword Highlighting:** Verify that matching keywords within the title are highlighted with a soft yellow background.
5. **No Results State:** Search for a non-existent topic (e.g. `Xyzabc123`). Verify that the "No matches found" screen displays cleanly.
6. **Closing Modal:** Verify that clicking the "X" button, clicking the backdrop, or pressing the `ESC` key closes the modal smoothly.
