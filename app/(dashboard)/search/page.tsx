'use client';

import { useState, useCallback } from 'react';
import { Search, Plus, ExternalLink, MapPin, Users, Loader2, Link2, CheckCircle2, Linkedin, ArrowRight, Building2 } from 'lucide-react';
import { useUser } from '@/components/user-context';

interface SearchResult {
  id?: string;
  provider_id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  headline?: string;
  location?: string;
  profile_url?: string;
  profile_picture_url?: string;
  network_distance?: string;
  is_relationship?: boolean;
  current_company?: string;
  current_title?: string;
}

export default function SearchPage() {
  const { apiQuery } = useUser();
  const [keywords, setKeywords] = useState('');
  const [searchUrl, setSearchUrl] = useState('');
  const [useUrl, setUseUrl] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [paging, setPaging] = useState<any>(null);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);

  const runSearch = useCallback(async (nextCursor?: string) => {
    setSearching(true);
    setError('');
    if (!nextCursor) {
      setResults([]);
      setCursor(null);
      setPaging(null);
    }

    try {
      const body: any = {};
      if (useUrl && searchUrl.trim()) {
        body.url = searchUrl.trim();
      } else if (keywords.trim()) {
        body.keywords = keywords.trim();
      } else {
        setError('Enter keywords or a LinkedIn search URL');
        setSearching(false);
        return;
      }

      body.category = 'people';
      if (nextCursor) body.cursor = nextCursor;

      const res = await fetch(`/api/linkedin/search${apiQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Search failed');
        setSearching(false);
        return;
      }

      const items = (data.items || []).map((item: any) => ({
        id: item.provider_id || item.id || item.public_identifier,
        provider_id: item.provider_id,
        first_name: item.first_name,
        last_name: item.last_name,
        name: item.name || item.display_name || [item.first_name, item.last_name].filter(Boolean).join(' '),
        headline: item.headline,
        location: item.location,
        profile_url: item.profile_url || item.public_profile_url || (item.public_identifier ? `https://www.linkedin.com/in/${item.public_identifier}` : ''),
        profile_picture_url: item.profile_picture_url || item.profile_picture_url_large,
        network_distance: item.network_distance,
        is_relationship: item.is_relationship,
        current_company: item.current_company_name || item.company_name,
        current_title: item.current_title || item.title || item.occupation,
      }));

      if (nextCursor) {
        setResults(prev => [...prev, ...items]);
      } else {
        setResults(items);
      }
      setCursor(data.cursor || null);
      setPaging(data.paging || null);
      setHasSearched(true);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [keywords, searchUrl, useUrl, apiQuery]);

  const addToContacts = async (result: SearchResult) => {
    const resultId = result.id || result.provider_id || '';
    setAddingId(resultId);
    try {
      // Extract LinkedIn slug from URL for proper format
      let linkedinUrl = result.profile_url || '';
      if (linkedinUrl && !linkedinUrl.startsWith('http')) {
        linkedinUrl = `https://www.linkedin.com/in/${linkedinUrl}`;
      }

      const res = await fetch(`/api/contacts${apiQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: result.first_name || '',
          last_name: result.last_name || '',
          name: result.name || '',
          linkedin_url: linkedinUrl,
          company: result.current_company || '',
          title: result.current_title || result.headline || '',
          source: 'linkedin_search',
          avatar_url: result.profile_picture_url || '',
        }),
      });

      if (res.ok) {
        setAddedIds(prev => new Set(prev).add(resultId));
      }
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">LinkedIn Search</h1>
        <p className="text-sm text-muted-foreground mt-1">Search LinkedIn for prospects and add them to your pipeline</p>
      </div>

      {/* Search form */}
      <div className="glass-card p-5 space-y-4">
        {/* Mode toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setUseUrl(false)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${!useUrl ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-muted-foreground hover:text-white'}`}
          >
            Keyword Search
          </button>
          <button
            onClick={() => setUseUrl(true)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${useUrl ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-muted-foreground hover:text-white'}`}
          >
            LinkedIn URL
          </button>
        </div>

        <div className="flex gap-3">
          {useUrl ? (
            <div className="flex-1 relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                value={searchUrl}
                onChange={(e) => setSearchUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
                placeholder="Paste a LinkedIn search URL from your browser..."
                className="w-full h-11 bg-[hsl(230,12%,10%)] border border-[hsl(230,10%,15%)] rounded-xl pl-10 pr-4 text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>
          ) : (
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
                placeholder="Search by name, title, company, keywords..."
                className="w-full h-11 bg-[hsl(230,12%,10%)] border border-[hsl(230,10%,15%)] rounded-xl pl-10 pr-4 text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all"
                autoFocus
              />
            </div>
          )}
          <button
            onClick={() => runSearch()}
            disabled={searching}
            className="px-6 h-11 rounded-xl btn-primary text-white font-medium text-sm disabled:opacity-50 flex items-center gap-2"
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
        )}
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              Results {paging?.total_count ? `(${paging.total_count.toLocaleString()})` : results.length > 0 ? `(${results.length})` : ''}
            </h2>
          </div>

          {results.length === 0 && !searching ? (
            <div className="glass-card p-12 text-center">
              <Search className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No results found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Try different keywords or a broader search</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((result, idx) => {
                const resultId = result.id || result.provider_id || String(idx);
                const isAdded = addedIds.has(resultId);
                const isAdding = addingId === resultId;
                const displayName = result.name || [result.first_name, result.last_name].filter(Boolean).join(' ') || 'Unknown';

                return (
                  <div key={resultId} className="glass-card px-5 py-4 flex items-center gap-4 group hover:border-[hsl(230,10%,18%)] transition-all">
                    {/* Avatar */}
                    {result.profile_picture_url ? (
                      <img src={result.profile_picture_url} alt="" className="w-12 h-12 rounded-xl object-cover border border-[hsl(230,10%,16%)] shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/15 flex items-center justify-center text-lg font-bold text-blue-300 shrink-0">
                        {displayName.charAt(0)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{displayName}</span>
                        {result.profile_url && (
                          <a href={result.profile_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 shrink-0">
                            <ExternalLink size={12} />
                          </a>
                        )}
                        {result.network_distance && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0 ${
                            result.is_relationship || result.network_distance === 'FIRST_DEGREE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                              : result.network_distance === 'SECOND_DEGREE'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15'
                              : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/15'
                          }`}>
                            {result.is_relationship ? '1st' : result.network_distance === 'FIRST_DEGREE' ? '1st' : result.network_distance === 'SECOND_DEGREE' ? '2nd' : result.network_distance === 'THIRD_DEGREE' ? '3rd' : result.network_distance?.replace('_DEGREE', '').toLowerCase()}
                          </span>
                        )}
                      </div>
                      {(result.current_title || result.current_company) && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {result.current_title}{result.current_title && result.current_company ? ' at ' : ''}{result.current_company}
                        </p>
                      )}
                      {!result.current_title && !result.current_company && result.headline && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{result.headline}</p>
                      )}
                      {result.location && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60 mt-1">
                          <MapPin size={10} />
                          <span className="truncate">{result.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="shrink-0">
                      {isAdded ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/15">
                          <CheckCircle2 size={13} />
                          Added
                        </span>
                      ) : (
                        <button
                          onClick={() => addToContacts(result)}
                          disabled={isAdding}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg btn-primary text-white disabled:opacity-50"
                        >
                          {isAdding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                          Add to Contacts
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Load more */}
              {cursor && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => runSearch(cursor)}
                    disabled={searching}
                    className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl bg-[hsl(230,12%,10%)] border border-[hsl(230,10%,15%)] text-white hover:bg-[hsl(230,12%,13%)] transition-all disabled:opacity-50"
                  >
                    {searching ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                    Load more results
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
