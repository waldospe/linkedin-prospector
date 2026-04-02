'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, MapPin, Users, Linkedin, Loader2, Building2, Briefcase, GraduationCap, Award } from 'lucide-react';
import { useUser } from '@/components/user-context';

interface ProfilePanelProps {
  providerId: string;
  displayName: string;
  onClose: () => void;
}

export default function ProfilePanel({ providerId, displayName, onClose }: ProfilePanelProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { apiQuery } = useUser();

  useEffect(() => {
    setLoading(true);
    setError('');
    const sep = apiQuery.includes('?') ? '&' : '?';
    fetch(`/api/linkedin/profile${apiQuery}${sep}id=${encodeURIComponent(providerId)}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load profile');
        return r.json();
      })
      .then(data => setProfile(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [providerId, apiQuery]);

  const profileUrl = profile?.public_profile_url || profile?.profile_url
    || (profile?.public_identifier ? `https://www.linkedin.com/in/${profile.public_identifier}` : null);

  const experiences = profile?.experiences || profile?.positions || [];
  const educations = profile?.educations || profile?.education || [];
  const skills = profile?.skills || [];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute right-0 top-0 bottom-0 w-full max-w-[480px] bg-background border-l border-border flex flex-col animate-slide-in-right overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">LinkedIn Profile</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Loading profile...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-sm text-red-400 mb-2">Could not load profile</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          ) : profile ? (
            <div className="space-y-6">
              {/* Avatar + Name */}
              <div className="text-center">
                {(profile.profile_picture_url || profile.profile_picture_url_large) ? (
                  <img
                    src={profile.profile_picture_url_large || profile.profile_picture_url}
                    alt=""
                    className="w-24 h-24 rounded-2xl object-cover mx-auto border-2 border-border shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border-2 border-blue-500/15 flex items-center justify-center text-3xl font-bold text-blue-300 mx-auto">
                    {displayName.charAt(0)}
                  </div>
                )}
                <h3 className="text-xl font-semibold text-foreground mt-4">
                  {profile.first_name && profile.last_name
                    ? `${profile.first_name} ${profile.last_name}`
                    : profile.display_name || profile.name || displayName}
                </h3>
                {profile.headline && (
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{profile.headline}</p>
                )}

                {/* Connection status + location */}
                <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
                  {profile.is_relationship && (
                    <span className="text-[10px] font-medium px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">Connected</span>
                  )}
                  {profile.network_distance && !profile.is_relationship && (
                    <span className={`text-[10px] font-medium px-2.5 py-1 rounded-md ${
                      profile.network_distance === 'FIRST_DEGREE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                        : profile.network_distance === 'SECOND_DEGREE'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15'
                        : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/15'
                    }`}>
                      {profile.network_distance === 'FIRST_DEGREE' ? '1st' : profile.network_distance === 'SECOND_DEGREE' ? '2nd' : profile.network_distance === 'THIRD_DEGREE' ? '3rd' : profile.network_distance?.replace('_DEGREE', '')}
                    </span>
                  )}
                  {profile.is_premium && (
                    <span className="text-[10px] font-medium px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/15">Premium</span>
                  )}
                  {profile.location && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin size={10} />
                      {profile.location}
                    </span>
                  )}
                </div>

                {/* Connections count */}
                {profile.connections_count && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-2">
                    <Users size={11} />
                    <span>{profile.connections_count.toLocaleString()} connections</span>
                  </div>
                )}
              </div>

              {/* LinkedIn link */}
              {profileUrl && (
                <a href={profileUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/15 text-blue-400 text-sm hover:bg-blue-500/15 transition-all">
                  <Linkedin size={14} />
                  <span className="truncate text-xs flex-1">{profileUrl.replace('https://www.', '').replace('https://', '')}</span>
                  <ExternalLink size={12} className="shrink-0" />
                </a>
              )}

              {/* About/Summary */}
              {(profile.summary || profile.about) && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">About</p>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                    {profile.summary || profile.about}
                  </p>
                </div>
              )}

              {/* Experience */}
              {experiences.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Experience</p>
                  <div className="space-y-3">
                    {experiences.slice(0, 5).map((exp: any, i: number) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                          <Briefcase size={14} className="text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{exp.title || exp.position}</p>
                          <p className="text-xs text-muted-foreground">{exp.company_name || exp.company}</p>
                          {(exp.start_date || exp.starts_at) && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {formatDate(exp.start_date || exp.starts_at)} — {exp.end_date || exp.ends_at ? formatDate(exp.end_date || exp.ends_at) : 'Present'}
                            </p>
                          )}
                          {exp.location && (
                            <p className="text-[10px] text-muted-foreground/60">{exp.location}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {educations.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Education</p>
                  <div className="space-y-3">
                    {educations.slice(0, 3).map((edu: any, i: number) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                          <GraduationCap size={14} className="text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{edu.school_name || edu.school || edu.institution_name}</p>
                          {(edu.degree_name || edu.degree || edu.field_of_study) && (
                            <p className="text-xs text-muted-foreground">
                              {[edu.degree_name || edu.degree, edu.field_of_study].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {skills.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.slice(0, 15).map((skill: any, i: number) => (
                      <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-secondary text-foreground/70 border border-border">
                        {typeof skill === 'string' ? skill : skill.name || skill.skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
}

function formatDate(d: any): string {
  if (!d) return '';
  if (typeof d === 'string') return d;
  if (d.month && d.year) return `${d.month}/${d.year}`;
  if (d.year) return String(d.year);
  return '';
}
