import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import diningRoomImage from '../assets/ember-oak-dining-room.png';
import chefAlexanderImage from '../assets/chef-alexander-hart.png';
import managerMiaImage from '../assets/manager-mia-park.png';

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const heroRef = useRef(null);

  useEffect(() => {
    let animationFrame = 0;
    const updateHeroBlur = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const blur = Math.min(window.scrollY / 32, 9);
        heroRef.current?.style.setProperty('--hero-blur', `${blur}px`);
      });
    };

    updateHeroBlur();
    window.addEventListener('scroll', updateHeroBlur, { passive: true });
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('scroll', updateHeroBlur);
    };
  }, []);

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section" ref={heroRef}>
        <img className="hero-image" src={diningRoomImage} alt="" aria-hidden="true" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-eyebrow">A FIRE-LED DINING EXPERIENCE</div>
          <h1 className="hero-title">EMBER &amp; OAK</h1>
          <p className="hero-subtitle">WESTERN FINE DINING</p>
          <p className="hero-tagline">Thoughtfully sourced. Artfully composed. Unforgettable.</p>
          {user ? (
            <button className="hero-btn" onClick={() => navigate('/view-menu')}>VIEW OUR MENU →</button>
          ) : (
            <button className="hero-btn" onClick={() => navigate('/welcome')}>EXPLORE THE MENU →</button>
          )}
        </div>
        <span className="hero-scroll-cue" aria-hidden="true">SCROLL TO DISCOVER <span>↓</span></span>
      </section>

      {/* Info Bar */}
      <section className="info-bar">
        <div className="info-item">
          <span className="info-icon">📍</span>
          <div>
            <strong>LOCATION</strong>
            <p>Sik On House, <br />54-66 Hill Rd, <br />Shek Tong Tsui, <br />Hong Kong Island</p>
          </div>
        </div>
        <div className="info-item">
          <span className="info-icon">🕐</span>
          <div>
            <strong>OPENING HOURS</strong>
            <p>11:30 AM – 10:00 PM<br /></p>
          </div>
        </div>
        <div className="info-item">
          <span className="info-icon">🍂</span>
          <div>
            <strong>OUR STORY</strong>
            <p>Rooted in the spirit of the West. Inspired by fire, crafted with intention, and served with warmth.</p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="home-section dark-section">
        <div className="section-inner">
          <span className="section-label">OUR HISTORY</span>
          <h2>Where Fire Meets Heritage</h2>
          <p>
            Ember &amp; Oak was born from a deep respect for Western culinary traditions and the natural bounty of our region.
            Our name reflects the balance we hold dear — the ember for flame, transformation, and craft; the oak for strength,
            time, and terroir. We invite you to gather at our table and experience fine dining that honors where we've been
            and celebrates where we are.
          </p>
        </div>
      </section>

      {/* Membership Info */}
      <section className="home-section light-section">
        <div className="section-inner" style={{ textAlign: 'center' }}>
          <span className="section-label">MEMBERSHIP</span>
          <h2>A Members-Only Experience</h2>
          <p style={{ maxWidth: 600, margin: '0 auto 24px' }}>
            Ember &amp; Oak is a <strong>membership-based restaurant</strong>. To enjoy our services — including table bookings,
            pre-ordering, dine-in ordering, and joining the queue — you must first register as a member. 
            Registration is free and takes less than a minute.
          </p>
          {!user && (
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="hero-btn" onClick={() => navigate('/register/customer')}>Register Now →</button>
              <button className="hero-btn outline" onClick={() => navigate('/welcome')}>Sign In</button>
            </div>
          )}
        </div>
      </section>

      {/* Dining Rules */}
      <section className="home-section dark-section">
        <div className="section-inner">
          <span className="section-label">DINING GUIDE</span>
          <h2>How Dining Works at Ember &amp; Oak</h2>
          <div className="rules-grid">
            <div className="rule-card">
              <div className="rule-icon">📋</div>
              <h3>Bookings &amp; Pre-ordering</h3>
              <p>
                Book a table in advance and browse our menu to <strong>pre-order your courses</strong> during the booking process.
                Your selected dishes will be prepared as you arrive, ensuring a seamless dining experience.
                You can also edit your course selections anytime before your visit from the Booking Management page.
              </p>
            </div>
            <div className="rule-card">
              <div className="rule-icon">🔢</div>
              <h3>Walk-in Queue</h3>
              <p>
                No booking? No problem. Join our digital queue and receive a queue number. When your number is called,
                you'll be seated and can begin ordering from our full menu. Queue groups are categorized by party size:
                <strong> A</strong> (1–2 guests), <strong>B</strong> (3–6 guests), <strong>C</strong> (7+ guests).
              </p>
            </div>
            <div className="rule-card">
              <div className="rule-icon">🍽️</div>
              <h3>Ordering</h3>
              <p>
                Once you've been checked in by our manager — either through your booking or queue — the ordering page unlocks.
                Browse our menu, add items to your cart, and place your order directly from your device.
                <strong> You must have an arrived booking or called queue number to order.</strong>
              </p>
            </div>
            <div className="rule-card">
              <div className="rule-icon">⏱️</div>
              <h3>1-Hour Dining Window</h3>
              <p>
                Each dining session lasts <strong>approximately 1 hour</strong>. Our full-course experience — from appetizers
                to dessert — is thoughtfully designed to be savored within this timeframe. After 1 hour, your session
                completes automatically and our manager will visit your table for payment. Place orders within 45 minutes
                after seating; new orders stop at 21:00.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="home-section light-section">
        <div className="section-inner">
          <span className="section-label">OUR TEAM</span>
          <h2>The People Behind the Flame</h2>
          <div className="team-grid">
            <div className="team-member">
              <img className="team-avatar" src={chefAlexanderImage} alt="Chef Alexander Hart" />
              <h3>Chef Alexander Hart</h3>
              <p className="team-role">Head Chef</p>
              <p>Trained in Napa and abroad, Alex crafts menus that blend classic technique with modern sensibility and local soul.</p>
            </div>
            <div className="team-member">
              <img className="team-avatar" src={managerMiaImage} alt="Manager Mia Park" />
              <h3>Mia Park</h3>
              <p className="team-role">General Manager</p>
              <p>With a background in hospitality and a passion for wine, Mia leads our front of house with warmth, precision, and care.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions for logged-in users */}
      {user?.role === 'customer' && (
        <section className="home-section dark-section">
          <div className="section-inner" style={{ textAlign: 'center' }}>
            <span className="section-label">READY TO DINE?</span>
            <h2>What would you like to do?</h2>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
              <button className="hero-btn" onClick={() => navigate('/booking')}>Book a Table →</button>
              <button className="hero-btn outline" onClick={() => navigate('/queue')}>Join Queue →</button>
              <button className="hero-btn outline" onClick={() => navigate('/view-menu')}>Browse Menu →</button>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-inner">
          <div>
            <h3>EMBER &amp; OAK</h3>
            <p>Western Fine Dining</p>
          </div>
          <div>
            <p>© 2026 Ember &amp; Oak.</p>
            <p style={{ fontSize: '0.8rem', marginTop: 4 }}>COMP3322 Group Project</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
