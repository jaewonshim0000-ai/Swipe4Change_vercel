import { Image } from 'react-native';
import './intro.css';

const communityPhoto = require('../../assets/photos/meeting.jpg');

export function Intro({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="intro">
      <nav className="intro-nav" aria-label="Introduction">
        <a className="intro-brand" href="/">
          Swipe4Change
        </a>
        <button className="intro-link" onClick={onContinue}>
          Explore petitions <span aria-hidden="true">↗</span>
        </button>
      </nav>

      <section className="intro-hero" aria-labelledby="intro-heading">
        <div className="intro-copy">
          <p className="intro-eyebrow">Change starts close to home.</p>
          <h1 id="intro-heading">
            What would you change
            <br className="intro-desktop-break" /> about your community?
          </h1>
          <p className="intro-description">
            A safer crossing. A park worth looking after. Something your neighborhood needs. Find a
            petition you care about, or start one of your own.
          </p>
          <div className="intro-actions">
            <button className="intro-cta" onClick={onContinue}>
              Find your next cause <span aria-hidden="true">↗</span>
            </button>
            <a className="intro-how" href="#how-it-works">
              How it works
            </a>
          </div>
          <p className="intro-note">You can look around before signing up.</p>
        </div>
        <figure className="intro-photo">
          <div className="intro-photo-frame">
            <Image
              source={communityPhoto}
              accessibilityLabel="People talking together at an outdoor community gathering"
              resizeMode="cover"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <figcaption>
            <span>It starts with a conversation.</span>
            <span>Then we take the next step.</span>
          </figcaption>
        </figure>
      </section>

      <section id="how-it-works" className="intro-steps" aria-labelledby="intro-steps-heading">
        <h2 id="intro-steps-heading">From an idea to a next step.</h2>
        <ol>
          {[
            ['Find a cause', 'Browse petitions by topic, location, or what matters to you.'],
            ['Add your voice', 'Read the request, see who it goes to, and decide whether to sign.'],
            ['Stay involved', 'Join the community and follow updates from the organizer.'],
          ].map(([title, description], index) => (
            <li key={title}>
              <span className="intro-step-number">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>
      <footer className="intro-footer">
        <span>Swipe4Change</span>
        <a href="/legal">Privacy &amp; terms</a>
      </footer>
    </main>
  );
}
