"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { supabaseClient } from "@/lib/supabase-client";
import { Logo } from "@/components/Logo";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  tokens: number;
  credits?: number;
  subscription_plan: string;
  provider: string;
  created_at: string;
}

const DEFAULT_TOKENS = 1000000;

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState("");
  const [previewPfp, setPreviewPfp] = useState("");
  const [uploadingPfp, setUploadingPfp] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    html.className = "layout-navbar-fixed layout-menu-fixed layout-compact";
    html.setAttribute("data-template", "vertical-menu-template");
    html.setAttribute("data-assets-path", "https://api.vreden.my.id/assets/");

    return () => {
      html.className = "layout-navbar-fixed layout-wide";
      html.setAttribute("data-template", "front-pages");
    };
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabaseClient.auth.getUser();
      
      if (!user) {
        router.replace("/login");
        return;
      }

      let { data: profileData, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching profile:", error);
      }

      if (!profileData) {
        const { data: newProfile, error: insertError } = await supabaseClient
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || "Guest User",
            avatar_url: user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user.user_metadata?.full_name || 'User'}&background=161B22&color=58A6FF`,
            credits: DEFAULT_TOKENS,
            subscription_plan: "free",
            provider: user.app_metadata?.provider || "email"
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating profile:", insertError);
          router.replace("/dashboard");
          return;
        }
        profileData = newProfile;
      }

      const tokens = profileData.credits ?? profileData.tokens ?? DEFAULT_TOKENS;
      
      setProfile({ ...profileData, tokens });
      setEditName(profileData.full_name || "Guest User");
      setPreviewPfp(profileData.avatar_url || `https://ui-avatars.com/api/?name=${profileData.full_name || 'User'}&background=161B22&color=58A6FF`);
      setLoading(false);
    };

    fetchProfile();
  }, [router]);

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    router.replace("/");
  };

  const handleDeleteAccount = async () => {
    await supabaseClient.auth.signOut();
    router.replace("/");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && profile) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewPfp(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProfilePicture = async (): Promise<string | null> => {
    if (!selectedFile || !profile) return null;

    setUploadingPfp(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("userId", profile.id);

      const response = await fetch("/api/upload/profile-picture", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    } finally {
      setUploadingPfp(false);
    }
  };

  const saveProfile = async () => {
    if (!editName.trim()) {
      alert("Silakan masukkan nama yang valid.");
      return;
    }

    if (!profile) return;

    let avatarUrl = previewPfp;

    if (selectedFile) {
      const uploadedUrl = await uploadProfilePicture();
      if (uploadedUrl) {
        avatarUrl = uploadedUrl;
      }
    }

    const { error } = await supabaseClient
      .from("profiles")
      .update({
        full_name: editName.trim(),
        avatar_url: avatarUrl
      })
      .eq("id", profile.id);

    if (error) {
      alert("Gagal menyimpan profil");
      return;
    }

    alert("Profil diperbarui!");
    setShowSettings(false);
    setSelectedFile(null);
    setProfile({ ...profile, full_name: editName.trim(), avatar_url: avatarUrl });
    setPreviewPfp(avatarUrl);
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toLocaleString('id-ID');
  };

  const getAvatarUrl = () => {
    if (profile?.avatar_url) return profile.avatar_url;
    return `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}&background=161B22&color=58A6FF`;
  };

  const isPremium = profile?.subscription_plan !== "free";
  const tokenPercentage = profile ? Math.min((profile.tokens / DEFAULT_TOKENS) * 100, 100) : 0;

  if (loading) {
    return (
      <>
        <link rel="stylesheet" href="https://api.vreden.my.id/assets/vendor/fonts/iconify-icons.css" />
        <link rel="stylesheet" href="https://api.vreden.my.id/assets/vendor/css/core.css" />
        <link rel="stylesheet" href="https://api.vreden.my.id/assets/css/demo.css" />
        <style>{`
          .loader-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.1);
            border-top-color: #4361EE;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <div className="loader-container bg-body">
          <div className="spinner"></div>
        </div>
      </>
    );
  }

  if (!profile) return null;

  return (
    <>
      <link rel="stylesheet" href="https://api.vreden.my.id/assets/vendor/fonts/iconify-icons.css" />
      <link rel="stylesheet" href="https://api.vreden.my.id/assets/vendor/libs/node-waves/node-waves.css" />
      <link rel="stylesheet" href="https://api.vreden.my.id/assets/vendor/libs/pickr/pickr-themes.css" />
      <link rel="stylesheet" href="https://api.vreden.my.id/assets/vendor/css/core.css" />
      <link rel="stylesheet" href="https://api.vreden.my.id/assets/css/demo.css" />
      <link rel="stylesheet" href="https://api.vreden.my.id/assets/vendor/libs/perfect-scrollbar/perfect-scrollbar.css" />

      <Script src="https://api.vreden.my.id/assets/vendor/js/helpers.js" strategy="beforeInteractive" />
      <Script src="/js/customizer.js" strategy="beforeInteractive" />
      <Script src="https://api.vreden.my.id/assets/js/config.js" strategy="beforeInteractive" />
      <Script src="https://api.vreden.my.id/assets/vendor/libs/jquery/jquery.js" strategy="afterInteractive" />
      <Script src="https://api.vreden.my.id/assets/vendor/libs/popper/popper.js" strategy="afterInteractive" />
      <Script src="https://api.vreden.my.id/assets/vendor/js/bootstrap.js" strategy="afterInteractive" />
      <Script src="https://api.vreden.my.id/assets/vendor/libs/node-waves/node-waves.js" strategy="afterInteractive" />
      <Script src="https://api.vreden.my.id/assets/vendor/libs/perfect-scrollbar/perfect-scrollbar.js" strategy="afterInteractive" />
      <Script src="https://api.vreden.my.id/assets/vendor/js/menu.js" strategy="afterInteractive" />
      <Script src="https://api.vreden.my.id/assets/js/main.js" strategy="afterInteractive" />
      <Script id="theme-switcher" strategy="afterInteractive">{`
        (function() {
          function setTheme(theme) {
            var html = document.documentElement;
            var activeTheme = theme;
            if (theme === 'system') {
              activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            html.setAttribute('data-bs-theme', activeTheme);
            localStorage.setItem('theme', theme);
            document.querySelectorAll('[data-bs-theme-value]').forEach(function(btn) {
              btn.classList.remove('active');
              if (btn.getAttribute('data-bs-theme-value') === theme) {
                btn.classList.add('active');
              }
            });
            var iconActive = document.querySelector('.theme-icon-active');
            if (iconActive) {
              iconActive.className = iconActive.className.replace(/ri-sun-line|ri-moon-clear-line|ri-computer-line/, '');
              if (theme === 'dark') {
                iconActive.classList.add('ri-moon-clear-line');
              } else if (theme === 'system') {
                iconActive.classList.add('ri-computer-line');
              } else {
                iconActive.classList.add('ri-sun-line');
              }
            }
          }
          var savedTheme = localStorage.getItem('theme') || 'light';
          setTheme(savedTheme);
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
            if (localStorage.getItem('theme') === 'system') {
              setTheme('system');
            }
          });
          document.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-bs-theme-value]');
            if (btn) {
              var theme = btn.getAttribute('data-bs-theme-value');
              setTheme(theme);
            }
          });
        })();
      `}</Script>

      <style jsx global>{`
        .profile-avatar-lg {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid var(--bs-primary);
        }
        .profile-avatar-edit {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid var(--bs-primary);
          cursor: pointer;
        }
        .avatar-edit-container {
          position: relative;
          display: inline-block;
        }
        .avatar-edit-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
          cursor: pointer;
        }
        .avatar-edit-container:hover .avatar-edit-overlay {
          opacity: 1;
        }
        .stat-card {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .profile-center-card {
          max-width: 600px;
          margin: 0 auto;
        }
        .profile-header-layout {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .profile-info-text {
          text-align: left;
        }
        .profile-info-text h4 {
          margin-bottom: 4px;
        }
        .profile-info-text p {
          margin-bottom: 2px;
        }
        @media (max-width: 576px) {
          .profile-header-layout {
            flex-direction: column;
            text-align: center;
          }
          .profile-info-text {
            text-align: center;
          }
        }
      `}</style>

      <div className="layout-wrapper layout-content-navbar">
        <div className="layout-container">
          <aside id="layout-menu" className="layout-menu menu-vertical menu bg-menu-theme">
            <div className="app-brand demo">
              <a href="/" className="app-brand-link">
                <span className="app-brand-logo demo me-1">
                  <Logo width={150} src="https://visora-dev-assets-id.assetsvsiddev.workers.dev/small-favicon/favicon-small.png" />
                </span>
              </a>
              <a href="javascript:void(0);" className="layout-menu-toggle menu-link text-large ms-auto">
                <i className="menu-toggle-icon d-xl-block align-middle"></i>
              </a>
            </div>
            <div className="menu-inner-shadow"></div>
            <ul className="menu-inner py-1">
              <li className="menu-item">
                <a href="/" className="menu-link">
                  <i className="menu-icon tf-icons ri ri-home-smile-line"></i>
                  <div>Beranda</div>
                </a>
              </li>
              <li className="menu-item">
                <a href="/dashboard" className="menu-link">
                  <i className="menu-icon tf-icons ri ri-dashboard-line"></i>
                  <div>Dashboard</div>
                </a>
              </li>
              <li className="menu-item active">
                <a href="/users/profile" className="menu-link">
                  <i className="menu-icon tf-icons ri ri-user-line"></i>
                  <div>Profil</div>
                </a>
              </li>
              <li className="menu-item">
                <a href="/plan" className="menu-link">
                  <i className="menu-icon tf-icons ri ri-vip-crown-line"></i>
                  <div>Upgrade Plan</div>
                </a>
              </li>
              <li className="menu-header mt-7">
                <span className="menu-header-text">Support</span>
              </li>
              <li className="menu-item">
                <a href="https://whatsapp.com/channel/0029Vb7fXyMId7nQmJJx1U1L" target="_blank" className="menu-link">
                  <i className="menu-icon tf-icons ri ri-whatsapp-line"></i>
                  <div>Channel Info</div>
                </a>
              </li>
              <li className="menu-item">
                <a href="https://wa.me/6289531606677" target="_blank" className="menu-link">
                  <i className="menu-icon tf-icons ri ri-customer-service-line"></i>
                  <div>WhatsApp</div>
                </a>
              </li>
            </ul>
          </aside>

          <div className="menu-mobile-toggler d-xl-none rounded-1">
            <a href="javascript:void(0);" className="layout-menu-toggle menu-link text-large text-bg-secondary p-2 rounded-1">
              <i className="ri ri-menu-line icon-base"></i>
              <i className="ri ri-arrow-right-s-line icon-base"></i>
            </a>
          </div>

          <div className="layout-page">
            <nav className="layout-navbar container-xxl navbar-detached navbar navbar-expand-xl align-items-center bg-navbar-theme" id="layout-navbar">
              <div className="layout-menu-toggle navbar-nav align-items-xl-center me-4 me-xl-0 d-xl-none">
                <a className="nav-item nav-link px-0 me-xl-6" href="javascript:void(0)">
                  <i className="icon-base ri ri-menu-line icon-md"></i>
                </a>
              </div>
              <div className="navbar-nav-right d-flex align-items-center justify-content-end" id="navbar-collapse">
                <ul className="navbar-nav flex-row align-items-center ms-md-auto">
                  <li className="nav-item dropdown me-sm-2 me-xl-0">
                    <a className="nav-link dropdown-toggle hide-arrow btn btn-icon btn-text-secondary rounded-pill" id="nav-theme" href="javascript:void(0);" data-bs-toggle="dropdown">
                      <i className="icon-base ri ri-sun-line icon-22px theme-icon-active"></i>
                    </a>
                    <ul className="dropdown-menu dropdown-menu-end">
                      <li>
                        <button type="button" className="dropdown-item align-items-center active" data-bs-theme-value="light">
                          <span><i className="icon-base ri ri-sun-line icon-md me-3"></i>Light</span>
                        </button>
                      </li>
                      <li>
                        <button type="button" className="dropdown-item align-items-center" data-bs-theme-value="dark">
                          <span><i className="icon-base ri ri-moon-clear-line icon-md me-3"></i>Dark</span>
                        </button>
                      </li>
                      <li>
                        <button type="button" className="dropdown-item align-items-center" data-bs-theme-value="system">
                          <span><i className="icon-base ri ri-computer-line icon-md me-3"></i>System</span>
                        </button>
                      </li>
                    </ul>
                  </li>
                  <li className="nav-item d-flex align-items-center">
                    <Logo width={50} src="https://visora-dev-assets-id.assetsvsiddev.workers.dev/small-favicon/favicon-small.png" />
                  </li>
                </ul>
              </div>
            </nav>

            <div className="content-wrapper">
              <div className="container-xxl flex-grow-1 container-p-y">
                <div className="row justify-content-center">
                  <div className="col-12 col-md-10 col-lg-8">
                    <div className="card mb-6 profile-center-card">
                      <div className="card-body pt-6">
                        <div className="profile-header-layout">
                          <img 
                            src={getAvatarUrl()} 
                            alt="Avatar" 
                            className="profile-avatar-lg"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}&background=161B22&color=58A6FF`;
                            }}
                          />
                          <div className="profile-info-text">
                            <h4 className="mb-1 d-flex align-items-center gap-2">
                              {profile.full_name || "Guest User"}
                              {isPremium && (
                                <span className="badge bg-label-primary rounded-pill">
                                  <i className="ri ri-vip-crown-fill me-1"></i>Premium
                                </span>
                              )}
                            </h4>
                            <p className="text-muted mb-1">UID: {profile.id.slice(0, 8).toUpperCase()}</p>
                            <p className="text-muted small mb-3">{profile.email}</p>
                            <button 
                              className="btn btn-primary btn-sm"
                              onClick={() => setShowSettings(true)}
                            >
                              <i className="ri ri-settings-3-line me-2"></i>
                              Edit Profil
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row g-6">
                  <div className="col-md-6 col-lg-3">
                    <div className="card stat-card h-100">
                      <div className="card-body">
                        <div className="d-flex align-items-center">
                          <div className="avatar">
                            <div className="avatar-initial bg-label-primary rounded shadow-xs">
                              <i className="ri ri-coin-line ri-24px"></i>
                            </div>
                          </div>
                          <div className="ms-3">
                            <p className="mb-0 text-muted small">Token Tersedia</p>
                            <h5 className="mb-0">{formatTokens(profile.tokens)}</h5>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="progress" style={{ height: '6px' }}>
                            <div 
                              className="progress-bar bg-primary" 
                              style={{ width: `${tokenPercentage}%` }}
                            ></div>
                          </div>
                          <small className="text-muted">{tokenPercentage.toFixed(0)}% dari {formatTokens(DEFAULT_TOKENS)}</small>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6 col-lg-3">
                    <div className="card stat-card h-100">
                      <div className="card-body">
                        <div className="d-flex align-items-center">
                          <div className="avatar">
                            <div className="avatar-initial bg-label-info rounded shadow-xs">
                              <i className="ri ri-vip-crown-line ri-24px"></i>
                            </div>
                          </div>
                          <div className="ms-3">
                            <p className="mb-0 text-muted small">Plan Aktif</p>
                            <h5 className="mb-0 text-capitalize">{profile.subscription_plan || 'Free'}</h5>
                          </div>
                        </div>
                        <a href="/plan" className="btn btn-sm btn-outline-primary mt-3 w-100">
                          <i className="ri ri-arrow-up-circle-line me-1"></i>Upgrade
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6 col-lg-3">
                    <div className="card stat-card h-100">
                      <div className="card-body">
                        <div className="d-flex align-items-center">
                          <div className="avatar">
                            <div className="avatar-initial bg-label-success rounded shadow-xs">
                              <i className="ri ri-calendar-check-line ri-24px"></i>
                            </div>
                          </div>
                          <div className="ms-3">
                            <p className="mb-0 text-muted small">Bergabung Sejak</p>
                            <h6 className="mb-0">{new Date(profile.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</h6>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6 col-lg-3">
                    <div className="card stat-card h-100">
                      <div className="card-body">
                        <div className="d-flex align-items-center">
                          <div className="avatar">
                            <div className="avatar-initial bg-label-warning rounded shadow-xs">
                              <i className="ri ri-shield-check-line ri-24px"></i>
                            </div>
                          </div>
                          <div className="ms-3">
                            <p className="mb-0 text-muted small">Provider</p>
                            <h6 className="mb-0 text-capitalize">{profile.provider || 'Email'}</h6>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row mt-6">
                  <div className="col-12">
                    <div className="card">
                      <div className="card-header d-flex align-items-center justify-content-between">
                        <h5 className="card-title m-0">Menu Cepat</h5>
                      </div>
                      <div className="card-body">
                        <div className="row g-4">
                          <div className="col-6 col-md-3">
                            <a href="/dashboard" className="card bg-label-primary text-center p-4 text-decoration-none h-100 d-flex flex-column align-items-center justify-content-center">
                              <i className="ri ri-dashboard-line ri-36px mb-2"></i>
                              <span className="fw-medium">Dashboard</span>
                            </a>
                          </div>
                          <div className="col-6 col-md-3">
                            <a href="/plan" className="card bg-label-info text-center p-4 text-decoration-none h-100 d-flex flex-column align-items-center justify-content-center">
                              <i className="ri ri-vip-crown-line ri-36px mb-2"></i>
                              <span className="fw-medium">Upgrade Plan</span>
                            </a>
                          </div>
                          <div className="col-6 col-md-3">
                            <a href="/" className="card bg-label-success text-center p-4 text-decoration-none h-100 d-flex flex-column align-items-center justify-content-center">
                              <i className="ri ri-home-line ri-36px mb-2"></i>
                              <span className="fw-medium">Beranda</span>
                            </a>
                          </div>
                          <div className="col-6 col-md-3">
                            <a 
                              href="#" 
                              onClick={(e) => { e.preventDefault(); handleLogout(); }}
                              className="card bg-label-danger text-center p-4 text-decoration-none h-100 d-flex flex-column align-items-center justify-content-center"
                            >
                              <i className="ri ri-logout-box-line ri-36px mb-2"></i>
                              <span className="fw-medium">Keluar</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <footer className="content-footer footer bg-footer-theme">
                <div className="container-xxl">
                  <div className="footer-container d-flex align-items-center justify-content-between py-4 flex-md-row flex-column">
                    <div className="text-body">
                      © {new Date().getFullYear()} • Build on{" "}
                      <a href="/" className="footer-link">Vallzx APIs</a>
                    </div>
                  </div>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <div 
          className="modal fade show d-block" 
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Pengaturan Profil</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowSettings(false)}
                ></button>
              </div>
              <div className="modal-body text-center">
                <div 
                  className="avatar-edit-container mb-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <img 
                    src={previewPfp} 
                    alt="Preview" 
                    className="profile-avatar-edit"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}&background=161B22&color=58A6FF`;
                    }}
                  />
                  <div className="avatar-edit-overlay">
                    <i className="ri ri-camera-line ri-24px text-white"></i>
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  hidden 
                  accept="image/*"
                  onChange={handleFileChange}
                />
                <p className="text-muted small mb-4">Klik gambar untuk mengubah foto profil</p>

                <div className="mb-4 text-start">
                  <label className="form-label">Nama Lengkap</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Masukkan nama"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                <button 
                  className="btn btn-primary w-100 mb-3"
                  onClick={saveProfile}
                  disabled={uploadingPfp}
                >
                  {uploadingPfp ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <i className="ri ri-save-line me-2"></i>
                      Simpan Perubahan
                    </>
                  )}
                </button>

                <hr />

                <button 
                  className="btn btn-outline-danger w-100"
                  onClick={handleDeleteAccount}
                >
                  <i className="ri ri-delete-bin-line me-2"></i>
                  Hapus Akun
                </button>

                <p className="text-muted small mt-3">
                  Butuh bantuan? <a href="https://wa.me/6289531606677" target="_blank">Hubungi Support</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
